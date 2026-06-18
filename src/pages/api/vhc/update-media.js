// file location: src/pages/api/vhc/update-media.js
// Update an existing VHC job_files row's customer visibility and/or its
// concern link (the "Linked item" the media is grouped under in the Video /
// Photo tab). Either field is optional — only the keys present in the request
// body are written, so the same route powers the visibility toggle and the
// relink / create-new-location controls in the Photo Preview popup.
export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabaseService, supabase as supabaseFallback } from "@/lib/database/supabaseClient";

function getClient() {
  return supabaseService || supabaseFallback;
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: `Method ${req.method} not allowed` });
  }

  const client = getClient();
  if (!client) {
    return res.status(500).json({ success: false, message: "Supabase client is not configured." });
  }

  try {
    const body = typeof req.body === "object" && req.body ? req.body : {};
    const numericFileId = Number.parseInt(String(body.fileId ?? "").trim(), 10);
    if (!Number.isInteger(numericFileId) || numericFileId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid or missing fileId." });
    }

    // Build the patch from only the fields the caller supplied.
    const update = {};
    if (Object.prototype.hasOwnProperty.call(body, "visibleToCustomer")) {
      update.visible_to_customer = body.visibleToCustomer === true || body.visibleToCustomer === "true";
    }
    if (Object.prototype.hasOwnProperty.call(body, "concernLink")) {
      const link = body.concernLink;
      // null / "" clears the link (media drops back into the Unlinked row).
      update.vhc_concern_link = link && typeof link === "object" ? link : null;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: "No updatable fields supplied." });
    }

    const { data, error } = await client
      .from("job_files")
      .update(update)
      .eq("file_id", numericFileId)
      .select("file_id, job_id, visible_to_customer, vhc_concern_link, is_main_vhc_video")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to update media record.");
    }

    return res.status(200).json({ success: true, file: data });
  } catch (error) {
    console.error("❌ Update VHC media error:", error?.message);
    return res.status(500).json({ success: false, message: error?.message || "Unexpected error." });
  }
}

export default withRoleGuard(handler);
