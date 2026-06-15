// file location: src/pages/api/vhc/set-main-video.js
// Promote or demote a single job_files row as the job's main customer-facing
// VHC video (the end-of-check walkaround pinned at the top of the Video /
// Photo tab). Multiple main videos per job are allowed — this only flips the
// flag on the targeted file.
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
    const isMain = body.isMain === true || body.isMain === "true";

    const { data, error } = await client
      .from("job_files")
      .update({ is_main_vhc_video: isMain })
      .eq("file_id", numericFileId)
      .select("file_id, job_id, is_main_vhc_video")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to update media record.");
    }

    return res.status(200).json({ success: true, file: data });
  } catch (error) {
    console.error("❌ Set main VHC video error:", error?.message);
    return res.status(500).json({ success: false, message: error?.message || "Unexpected error." });
  }
}

export default withRoleGuard(handler);
