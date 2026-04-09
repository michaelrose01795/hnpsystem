// file location: src/pages/api/jobcards/[jobNumber]/upload-dealer-file.js
// Dealer file upload — now stores files in Supabase Storage and creates a
// proper job_files row instead of a job_notes entry.  Existing local files
// under public/uploads/dealer-files/ remain accessible via the legacy serve
// route for backward compatibility.
export const runtime = "nodejs";

import { parseMultipartForm } from "@/lib/storage/parseMultipartForm";
import { uploadAndRecord } from "@/lib/storage/storageService";
import { getJobByNumberOrReg } from "@/lib/database/jobs";

export const config = {
  api: {
    bodyParser: false, // required for multipart form data
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { jobNumber } = req.query; // route parameter

  try {
    const { fields, file } = await parseMultipartForm(req);

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("📎 Dealer file upload for job:", jobNumber);

    // Validate the job exists and resolve its numeric id
    const job = await getJobByNumberOrReg(jobNumber);
    if (!job) {
      return res.status(404).json({ error: "Job not found", jobNumber });
    }

    const userId = fields.userId || "system";

    // Upload to Supabase Storage + insert into job_files
    const result = await uploadAndRecord(file, {
      jobId: job.id,
      folder: "dealer-files",
      uploadedBy: userId,
      visibleToCustomer: false, // dealer files are internal by default
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Upload failed" });
    }

    console.log("✅ Dealer file uploaded successfully");

    return res.status(200).json({
      message: "File uploaded successfully",
      file: {
        originalName: file.fileName,
        filename: result.data?.file_name || file.fileName,
        path: result.publicUrl,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: result.data?.uploaded_at || new Date().toISOString(),
        fileId: result.data?.file_id,
      },
      jobNumber,
    });
  } catch (error) {
    console.error("❌ Dealer file upload error:", error);
    return res.status(500).json({
      error: "Failed to process upload",
      message: error.message,
    });
  }
}
