// file location: src/pages/api/jobcards/[jobNumber]/files.js
// Directly fetches job_files rows for a given job number.
// Uses a two-step query (jobs → job_files) to avoid relying on PostgREST
// embedded-join schema detection, which can silently return empty arrays when
// the FK relationship is not in the schema cache.
import { supabaseService, supabase as supabaseFallback } from "@/lib/database/supabaseClient";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { logJobActivity } from "@/lib/database/jobActivity";

function getClient() {
  return supabaseService || supabaseFallback;
}

const buildJobNumberCandidates = (value) => {
  const token = String(value || "").trim().replace(/^#/, "");
  if (!token) return [];
  const candidates = new Set([token, token.toUpperCase()]);
  if (/^\d+$/.test(token)) {
    const n = Number.parseInt(token, 10);
    if (n > 0) {
      candidates.add(String(n));
      candidates.add(String(n).padStart(5, "0"));
    }
  }
  return Array.from(candidates);
};

async function handler(req, res, session) {
  if (req.method === "PATCH") {
    return handleRename(req, res, session);
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET", "PATCH"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { jobNumber } = req.query;
  if (!jobNumber) {
    return res.status(400).json({ error: "Missing jobNumber" });
  }

  try {
    const client = getClient();
    const candidates = buildJobNumberCandidates(jobNumber);

    // Step 1: resolve job integer id from job_number
    const { data: jobRows, error: jobError } = await client
      .from("jobs")
      .select("id, job_number")
      .in("job_number", candidates)
      .limit(1);

    if (jobError) {
      console.error("❌ files.js: job lookup error:", jobError);
      return res.status(500).json({ error: "Failed to look up job", message: jobError.message });
    }

    const job = Array.isArray(jobRows) ? jobRows[0] : null;
    if (!job) {
      return res.status(404).json({ error: "Job not found", files: [] });
    }

    // Step 2: fetch job_files directly by integer job_id
    const { data: fileRows, error: filesError } = await client
      .from("job_files")
      .select("file_id, file_name, file_url, file_type, folder, uploaded_by, uploaded_at")
      .eq("job_id", job.id)
      .order("uploaded_at", { ascending: false });

    if (filesError) {
      console.error("❌ files.js: job_files query error:", filesError);
      return res.status(500).json({ error: "Failed to fetch files", message: filesError.message });
    }

    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({ files: fileRows || [], jobId: job.id });
  } catch (error) {
    console.error("❌ files.js handler error:", error);
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
}

async function handleRename(req, res, session) {
  const { fileId, fileName } = req.body || {};
  if (!fileId || !fileName || !String(fileName).trim()) {
    return res.status(400).json({ error: "fileId and fileName are required" });
  }
  const trimmedName = String(fileName).trim();
  try {
    const client = getClient();
    // Read old name first so the tracker entry can show the rename arrow.
    const { data: existing } = await client
      .from("job_files")
      .select("file_id, file_name, job_id, file_type")
      .eq("file_id", fileId)
      .maybeSingle();

    const { data, error } = await client
      .from("job_files")
      .update({ file_name: trimmedName })
      .eq("file_id", fileId)
      .select("file_id, file_name, job_id, file_type")
      .single();

    if (error) {
      console.error("❌ files.js rename error:", error);
      return res.status(500).json({ error: "Failed to rename file", message: error.message });
    }

    try {
      if (data?.job_id) {
        const kind = describeFileKind(data.file_type);
        const oldName = existing?.file_name || "(unnamed)";
        await logJobActivity({
          jobId: data.job_id,
          category: "files",
          action: "renamed",
          summary: `${kind} renamed: "${oldName}" → "${trimmedName}"`,
          targetType: "job_file",
          targetId: String(fileId),
          payload: { oldName, newName: trimmedName, fileType: data.file_type || null },
          performedBy: session?.user?.user_id || session?.user?.id || null,
        });
      }
    } catch (logErr) {
      console.warn("files rename activity log failed:", logErr?.message || logErr);
    }

    return res.status(200).json({ success: true, file: data });
  } catch (error) {
    console.error("❌ files.js rename handler error:", error);
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
}

function describeFileKind(mimeOrName) {
  const v = String(mimeOrName || "").toLowerCase();
  if (v.startsWith("image") || /\.(jpe?g|png|gif|webp|heic|bmp)$/.test(v)) return "Photo";
  if (v.startsWith("video") || /\.(mp4|mov|avi|mkv|webm)$/.test(v)) return "Video";
  return "Document";
}

export default withRoleGuard(handler);
