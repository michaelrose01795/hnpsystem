// file location: src/pages/api/job-cards/[jobNumber]/share-link.js
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase configuration");
}

const dbClient = createClient(supabaseUrl, serviceRoleKey);

// Generate a unique link code (alphanumeric, 12 characters)
function generateLinkCode() {
  return crypto.randomBytes(9).toString("base64url").slice(0, 12);
}

// Check if a link is expired (24 hours)
function isLinkExpired(createdAt) {
  const expiryMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const created = new Date(createdAt).getTime();
  return Date.now() - created > expiryMs;
}

export default async function handler(req, res) {
  const { jobNumber } = req.query;

  if (!jobNumber) {
    return res.status(400).json({ success: false, error: "Job number is required" });
  }

  // GET: Validate a share link
  if (req.method === "GET") {
    const { linkCode } = req.query;

    if (!linkCode) {
      return res.status(400).json({ success: false, error: "Link code is required" });
    }

    try {
      // Look up the share link
      const { data: shareLink, error: linkError } = await dbClient
        .from("job_share_links")
        .select("*")
        .eq("job_number", jobNumber)
        .eq("link_code", linkCode)
        .maybeSingle();

      if (linkError) {
        console.error("Error fetching share link:", linkError);
        return res.status(500).json({ success: false, error: "Failed to validate link" });
      }

      if (!shareLink) {
        return res.status(404).json({ success: false, error: "Link not found or invalid" });
      }

      // Check if link is expired
      if (isLinkExpired(shareLink.created_at)) {
        return res.status(410).json({ success: false, error: "Link has expired" });
      }

      // Fetch the job row first (simpler queries are more reliable)
      const { data: jobRow, error: jobRowError } = await dbClient
        .from("jobs")
        .select(`
          *,
          customer:customer_id(*),
          vehicle:vehicle_id(*)
        `)
        .eq("job_number", jobNumber)
        .maybeSingle();

      if (jobRowError) {
        console.error("Error fetching job row:", jobRowError);
        const details = process.env.NODE_ENV !== 'production' ? (jobRowError && jobRowError.message ? jobRowError.message : JSON.stringify(jobRowError, Object.getOwnPropertyNames(jobRowError))) : undefined;
        return res.status(500).json({ success: false, error: "Failed to fetch job data", details });
      }

      if (!jobRow) {
        return res.status(404).json({ success: false, error: "Job not found" });
      }

      // Fetch related collections separately to avoid complex nested-select failures.
      // Use Promise.all so requests are parallel, then inspect errors and return partial results with warnings.
      const [vhcChecksRes, partsRes, filesRes, aliasesRes, authItemsRes] = await Promise.all([
        dbClient
          .from("vhc_checks")
          .select(
            `vhc_id, job_id, section, issue_description, issue_title, measurement, created_at, updated_at, approval_status, display_status, approved_by, approved_at, labour_hours, parts_cost, total_override, labour_complete, parts_complete`
          )
          .eq("job_id", jobRow.id),
        dbClient
          .from("parts_job_items")
          .select(
            `id, part_id, quantity_requested, quantity_allocated, quantity_fitted, status, origin, vhc_item_id, unit_cost, unit_price, request_notes, created_at, updated_at, authorised, stock_status, labour_hours, part:part_id(id, part_number, name, unit_price)`
          )
          .eq("job_id", jobRow.id),
        dbClient
          .from("job_files")
          .select(`file_id, file_name, file_url, file_type, folder, uploaded_at`)
          .eq("job_id", jobRow.id),
        dbClient
          .from("vhc_item_aliases")
          .select(`display_id, vhc_item_id`)
          .eq("job_id", jobRow.id),
        dbClient
          .from("vhc_authorized_items")
          .select(`vhc_item_id, approval_status`)
          .eq("job_id", jobRow.id),
      ]);

      const warnings = [];
      if (vhcChecksRes.error) {
        console.error("Error fetching vhc_checks:", vhcChecksRes.error);
        warnings.push("vhc_checks");
      }
      if (partsRes.error) {
        console.error("Error fetching parts_job_items:", partsRes.error);
        warnings.push("parts_job_items");
      }
      if (filesRes.error) {
        console.error("Error fetching job_files:", filesRes.error);
        warnings.push("job_files");
      }
      if (aliasesRes.error) {
        console.error("Error fetching vhc_item_aliases:", aliasesRes.error);
        warnings.push("vhc_item_aliases");
      }
      if (authItemsRes.error) {
        console.error("Error fetching vhc_authorized_items:", authItemsRes.error);
        warnings.push("vhc_authorized_items");
      }

      const jobData = {
        ...jobRow,
        vhc_checks: (vhcChecksRes.data) || [],
        parts_job_items: (partsRes.data) || [],
        job_files: (filesRes.data) || [],
        vhc_item_aliases: (aliasesRes.data) || [],
        vhc_authorized_items: (authItemsRes.data) || [],
      };

      return res.status(200).json({
        success: true,
        valid: true,
        jobData,
        warnings: warnings.length ? warnings : undefined,
        debug: process.env.NODE_ENV !== 'production' ? { vhcChecksError: vhcChecksRes.error, partsError: partsRes.error, filesError: filesRes.error, aliasesError: aliasesRes.error, authError: authItemsRes.error } : undefined,
        expiresAt: new Date(new Date(shareLink.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      console.error("Error validating share link:", error);
      // Return detailed error info in development to aid debugging
      if (process.env.NODE_ENV !== 'production') {
        return res.status(500).json({ success: false, error: "Internal server error", details: String(error.message || error), stack: error.stack });
      }
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  // POST: Generate a new share link (or return existing valid one)
  if (req.method === "POST") {
    try {
      // First, check if there's an existing valid (non-expired) link
      const { data: existingLinks, error: fetchError } = await dbClient
        .from("job_share_links")
        .select("*")
        .eq("job_number", jobNumber)
        .order("created_at", { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error("Error fetching existing links:", fetchError);
        // Continue to create a new link
      }

      // Check if the most recent link is still valid
      if (existingLinks && existingLinks.length > 0) {
        const latestLink = existingLinks[0];
        if (!isLinkExpired(latestLink.created_at)) {
          // Return the existing valid link
          return res.status(200).json({
            success: true,
            linkCode: latestLink.link_code,
            createdAt: latestLink.created_at,
            expiresAt: new Date(new Date(latestLink.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
            isNew: false,
          });
        }
      }

      // Generate a new link code
      const linkCode = generateLinkCode();

      // Get the job ID
      const { data: job, error: jobError } = await dbClient
        .from("jobs")
        .select("id")
        .eq("job_number", jobNumber)
        .maybeSingle();

      if (jobError || !job) {
        return res.status(404).json({ success: false, error: "Job not found" });
      }

      // Insert the new share link
      const { data: newLink, error: insertError } = await dbClient
        .from("job_share_links")
        .insert({
          job_id: job.id,
          job_number: jobNumber,
          link_code: linkCode,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating share link:", insertError);
        return res.status(500).json({ success: false, error: "Failed to create share link" });
      }

      return res.status(201).json({
        success: true,
        linkCode: newLink.link_code,
        createdAt: newLink.created_at,
        expiresAt: new Date(new Date(newLink.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        isNew: true,
      });
    } catch (error) {
      console.error("Error generating share link:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
