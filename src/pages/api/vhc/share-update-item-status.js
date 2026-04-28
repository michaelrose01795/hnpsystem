// file location: src/pages/api/vhc/share-update-item-status.js
// Public endpoint: lets a customer with a valid share link code authorise or
// decline a single VHC item. linkCode is validated server-side; customers
// cannot edit labour, parts, or any other field — only approval status.
import { createClient } from "@supabase/supabase-js";
import { resolveJobIdentity } from "@/lib/jobs/jobIdentity";
import { applyVhcDecision } from "@/features/vhc/vhcStatusEngine";
import { calculateVhcFinancialTotals } from "@/lib/vhc/calculateVhcTotals";
import { logJobActivity } from "@/lib/database/jobActivity";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase configuration");
}

const dbClient = createClient(supabaseUrl, serviceRoleKey);

const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const isLinkExpired = (createdAt) =>
  Date.now() - new Date(createdAt).getTime() > LINK_TTL_MS;

const ALLOWED_STATUSES = new Set(["pending", "authorized", "declined"]);

export default async function handler(req, res) {
  if (req.method !== "PATCH" && req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { jobNumber, linkCode, vhcItemId, approvalStatus } = req.body || {};

  if (!jobNumber || !linkCode || !vhcItemId) {
    return res
      .status(400)
      .json({ success: false, message: "jobNumber, linkCode and vhcItemId are required" });
  }

  const nextStatus = approvalStatus === null || approvalStatus === undefined
    ? "pending"
    : String(approvalStatus).trim().toLowerCase();

  if (!ALLOWED_STATUSES.has(nextStatus)) {
    return res.status(400).json({
      success: false,
      message: "approvalStatus must be 'authorized', 'declined' or null/'pending'"
    });
  }

  try {
    const identity = await resolveJobIdentity({
      client: dbClient,
      identifier: jobNumber,
      select: "id, job_number"
    });
    if (!identity?.id) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const { data: shareLink, error: linkErr } = await dbClient
      .from("job_share_links")
      .select("*")
      .eq("job_number", identity.job_number)
      .eq("link_code", linkCode)
      .maybeSingle();

    if (linkErr || !shareLink) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }
    if (isLinkExpired(shareLink.created_at)) {
      return res.status(410).json({ success: false, message: "Link has expired" });
    }

    const { data: existingCheck, error: checkErr } = await dbClient
      .from("vhc_checks")
      .select("vhc_id, job_id, severity, display_status, issue_title, section")
      .eq("vhc_id", vhcItemId)
      .maybeSingle();

    if (checkErr || !existingCheck) {
      return res.status(404).json({ success: false, message: "VHC item not found" });
    }
    if (existingCheck.job_id !== identity.id) {
      return res.status(403).json({ success: false, message: "VHC item does not belong to this job" });
    }

    const updateData = {
      approval_status: nextStatus,
      authorization_state: nextStatus,
      updated_at: new Date().toISOString()
    };

    if (nextStatus === "authorized") {
      updateData.display_status = "authorized";
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = "customer";
    } else if (nextStatus === "declined") {
      updateData.display_status = "declined";
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = "customer";
    } else {
      // pending — restore original severity as display status
      updateData.display_status = existingCheck.severity || null;
      updateData.approved_at = null;
      updateData.approved_by = null;
    }

    const { data: updated, error: updateErr } = await dbClient
      .from("vhc_checks")
      .update(updateData)
      .eq("vhc_id", vhcItemId)
      .select();

    if (updateErr) {
      console.error("share-update-item-status update error:", updateErr);
      return res.status(500).json({ success: false, message: "Failed to update status" });
    }

    // Cascade through the engine so parts reservations / job_requests stay in sync.
    try {
      await applyVhcDecision({
        jobId: existingCheck.job_id,
        vhcItemId,
        targetDecision: nextStatus
      });
    } catch (cascadeErr) {
      console.warn("share-update-item-status cascade warning:", cascadeErr);
    }

    // Recalculate totals on the VHC_CHECKSHEET row
    try {
      const [{ data: allChecks }, { data: allParts }] = await Promise.all([
        dbClient.from("vhc_checks").select("*").eq("job_id", existingCheck.job_id),
        dbClient
          .from("parts_job_items")
          .select("*, parts_catalog(unit_price)")
          .eq("job_id", existingCheck.job_id)
      ]);
      if (Array.isArray(allChecks)) {
        const newTotals = calculateVhcFinancialTotals(allChecks, allParts || [], {
          forceRecalculate: true
        });
        const checksheetRow = allChecks.find((c) => {
          const section = (c?.section || "").toString().trim();
          return section === "VHC_CHECKSHEET" || section === "VHC Checksheet";
        });
        if (checksheetRow?.vhc_id) {
          await dbClient
            .from("vhc_checks")
            .update({
              authorized_total_gbp: newTotals.authorized,
              declined_total_gbp: newTotals.declined,
              updated_at: new Date().toISOString()
            })
            .eq("vhc_id", checksheetRow.vhc_id);
        }
      }
    } catch (totalsErr) {
      console.warn("share-update-item-status totals recalc warning:", totalsErr);
    }

    // Tracker logging — capture customer-side decisions distinctly so the
    // tracker can show "by customer (link)" instead of a staff actor.
    try {
      const itemTitle = existingCheck.issue_title || existingCheck.section || `item ${vhcItemId}`;
      const labelMap = {
        authorized: "Customer authorised VHC item",
        declined: "Customer declined VHC item",
        pending: "Customer reset VHC item to pending",
      };
      await logJobActivity({
        jobId: existingCheck.job_id,
        category: "vhc",
        action: `customer_${nextStatus}`,
        summary: `${labelMap[nextStatus] || "Customer changed VHC item"}: ${itemTitle}`,
        targetType: "vhc_check",
        targetId: String(vhcItemId),
        payload: { approvalStatus: nextStatus, source: "share_link" },
        performedBy: null,
      });
    } catch (logErr) {
      console.warn("share-update-item-status activity log failed:", logErr?.message || logErr);
    }

    return res.status(200).json({
      success: true,
      data: updated?.[0] || null
    });
  } catch (err) {
    console.error("share-update-item-status fatal error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
