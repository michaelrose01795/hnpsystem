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

      // Fetch the job data for the public preview
      const { data: jobData, error: jobError } = await dbClient
        .from("jobs")
        .select(`
          id,
          job_number,
          checksheet,
          customer:customer_id(id, name, company_name),
          vehicle:vehicle_id(id, registration, make, model, colour),
          vhc_checks(
            vhc_id,
            job_id,
            section,
            issue_description,
            issue_title,
            measurement,
            created_at,
            updated_at,
            approval_status,
            display_status,
            labour_hours,
            parts_cost,
            total_override,
            labour_complete,
            parts_complete
          ),
          parts_job_items(
            id,
            part_id,
            quantity_requested,
            quantity_allocated,
            quantity_fitted,
            status,
            origin,
            vhc_item_id,
            unit_cost,
            unit_price,
            request_notes,
            created_at,
            updated_at,
            authorised,
            stock_status,
            labour_hours,
            part:part_id(id, part_number, name, unit_price)
          ),
          job_files(
            file_id,
            file_name,
            file_url,
            file_type,
            folder,
            uploaded_at
          )
        `)
        .eq("job_number", jobNumber)
        .maybeSingle();

      if (jobError) {
        console.error("Error fetching job data:", jobError);
        return res.status(500).json({ success: false, error: "Failed to fetch job data" });
      }

      if (!jobData) {
        return res.status(404).json({ success: false, error: "Job not found" });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        jobData,
        expiresAt: new Date(new Date(shareLink.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      console.error("Error validating share link:", error);
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
