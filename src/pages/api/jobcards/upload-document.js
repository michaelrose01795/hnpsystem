// file location: src/pages/api/jobcards/upload-document.js
// Job document upload — now stores files in Supabase Storage ("job-files"
// bucket, documents/ folder) with a proper job_files row.
// Existing local files under public/uploads/job-documents/ remain accessible.
export const runtime = "nodejs";

import { parseMultipartForm } from "@/lib/storage/parseMultipartForm";
import { uploadAndRecord, uploadFile } from "@/lib/storage/storageService";
import { withRoleGuard } from "@/lib/auth/roleGuard";

export const config = {
  api: {
    bodyParser: false, // required for multipart form data
  },
};

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { fields, file } = await parseMultipartForm(req);

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const jobId = fields.jobId;
    const userId = fields.userId || "system";

    console.log("📎 Document upload:", {
      jobId,
      fileName: file.fileName,
      size: file.size || file.buffer.length,
    });

    // Temp jobs — upload to Supabase Storage but skip DB row.
    // The link-uploaded-files route creates the row once the job is confirmed.
    if (jobId.startsWith("temp-")) {
      const { storagePath, publicUrl } = await uploadFile(file, "documents", jobId);

      return res.status(200).json({
        message: "File uploaded successfully (temp)",
        file: {
          originalName: file.fileName,
          filename: file.fileName,
          path: publicUrl,
          size: file.size || file.buffer.length,
          mimetype: file.mimetype,
          storage_path: storagePath,
          uploadedAt: new Date().toISOString(),
        },
        jobId,
      });
    }

    // Upload to Supabase Storage + insert into job_files
    const result = await uploadAndRecord(file, {
      jobId,
      folder: "documents",
      uploadedBy: userId,
      visibleToCustomer: true,
    });

    if (!result.success) {
      console.warn("Failed to upload document:", result.error);
      return res.status(500).json({ error: result.error || "Upload failed" });
    }

    console.log("✅ Document uploaded successfully");

    return res.status(200).json({
      message: "File uploaded successfully",
      file: {
        originalName: file.fileName,
        filename: result.data?.file_name || file.fileName,
        path: result.publicUrl,
        size: file.size || file.buffer.length,
        mimetype: file.mimetype,
        uploadedAt: result.data?.uploaded_at || new Date().toISOString(),
        fileId: result.data?.file_id,
      },
      jobId,
    });
  } catch (error) {
    console.error("❌ Upload handler error:", error);
    return res.status(500).json({
      error: "Failed to process upload",
      message: error.message,
    });
  }
}

export default withRoleGuard(handler);
