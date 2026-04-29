// file location: src/pages/api/vhc/update-customer-description.js
// Saves a customer-facing override for a VHC item's issue_description. The
// technician's original issue_description is left untouched. An empty string
// clears the override (NULL) so customer views fall back to issue_description.
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabase } from "@/lib/database/supabaseClient";
import { logJobActivity } from "@/lib/database/jobActivity";
import { writeAuditLog } from "@/lib/audit/auditLog";
import { getAuditContext } from "@/lib/audit/auditContext";

async function handler(req, res, session) {
  if (req.method !== "PATCH" && req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { vhcItemId, customerDescription } = req.body || {};
  if (!vhcItemId) {
    return res.status(400).json({ success: false, message: "vhcItemId is required" });
  }

  const trimmed =
    typeof customerDescription === "string" ? customerDescription.trim() : "";
  const nextValue = trimmed.length > 0 ? trimmed : null;

  const { data, error } = await supabase
    .from("vhc_checks")
    .update({
      customer_description: nextValue,
      updated_at: new Date().toISOString(),
    })
    .eq("vhc_id", vhcItemId)
    .select("vhc_id, job_id, issue_title, section, customer_description, issue_description, updated_at");

  if (error) {
    console.error("update-customer-description error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update customer description",
      error: error.message,
    });
  }
  if (!data || data.length === 0) {
    return res.status(404).json({
      success: false,
      message: `No vhc_checks row found for vhc_id ${vhcItemId}`,
    });
  }

  // Tracker logging — non-blocking.
  try {
    const row = data[0];
    if (row?.job_id) {
      const itemTitle = row.issue_title || row.section || `item ${vhcItemId}`;
      await logJobActivity({
        jobId: row.job_id,
        category: "vhc",
        action: nextValue ? "customer_description_set" : "customer_description_cleared",
        summary: nextValue
          ? `Customer description edited on: ${itemTitle}`
          : `Customer description cleared on: ${itemTitle}`,
        targetType: "vhc_check",
        targetId: String(vhcItemId),
        payload: { customerDescription: nextValue },
        performedBy: session?.user?.user_id || session?.user?.id || null,
      });
    }
  } catch (logErr) {
    console.warn("update-customer-description activity log failed:", logErr?.message || logErr);
  }

  try {
    const auditCtx = await getAuditContext(req, res);
    await writeAuditLog({
      ...auditCtx,
      action: "update",
      entityType: "vhc_check",
      entityId: vhcItemId,
      diff: {
        field: "customer_description",
        cleared: nextValue === null,
        job_id: data[0]?.job_id ?? null,
      },
    });
  } catch {
    // audit best-effort
  }

  return res.status(200).json({ success: true, data: data[0] });
}

export default withRoleGuard(handler);
