// file location: src/pages/api/vhc/upload-media.js
// VHC media upload — now stores files in Supabase Storage ("job-files" bucket)
// with a proper job_files row including file_size and visible_to_customer.
// Existing local files under public/uploads/vhc-media/ remain accessible.
export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { parseMultipartForm } from "@/lib/storage/parseMultipartForm";
import { uploadAndRecord } from "@/lib/storage/storageService";

export const config = {
  api: {
    bodyParser: false, // required for multipart form data
  },
};

// Validate file is image or video and within size limits
function validateMediaFile(mimetype, size) {
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
  const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

  const isImage = mimetype.startsWith("image/");
  const isVideo = mimetype.startsWith("video/");

  if (!isImage && !isVideo) {
    return { valid: false, error: "Only image and video files are allowed" };
  }
  if (isImage && size > MAX_IMAGE_SIZE) {
    return { valid: false, error: "Image file size exceeds 10MB limit" };
  }
  if (isVideo && size > MAX_VIDEO_SIZE) {
    return { valid: false, error: "Video file size exceeds 50MB limit" };
  }
  return { valid: true };
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { fields, file } = await parseMultipartForm(req);

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const rawJobId = fields.jobId;
    if (!rawJobId) {
      return res.status(400).json({ error: "Missing jobId" });
    }
    const isTempJob = typeof rawJobId === "string" && rawJobId.startsWith("temp-");
    const jobId = isTempJob
      ? rawJobId
      : /^\d+$/.test(String(rawJobId))
        ? Number(rawJobId)
        : rawJobId;
    const userId = fields.userId || "system";
    const visibleToCustomer = fields.visibleToCustomer === "true" || fields.visibleToCustomer === true;
    const description = fields.description || "";

    // Validate file type and size
    const validation = validateMediaFile(file.mimetype, file.size || file.buffer.length);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    console.log("📷 VHC Media upload:", {
      jobId,
      fileName: file.fileName,
      size: file.size || file.buffer.length,
      type: file.mimetype,
      visibleToCustomer,
    });

    // For temp jobs, store in Supabase Storage but skip the DB row.
    // The link-uploaded-files route will create the row when the job is finalised.
    if (isTempJob) {
      const { uploadFile } = await import("@/lib/storage/storageService");
      const { storagePath, publicUrl } = await uploadFile(file, "vhc-media", jobId);

      return res.status(200).json({
        success: true,
        message: "File uploaded successfully (temp)",
        file: {
          file_name: file.fileName,
          file_url: publicUrl,
          file_type: file.mimetype,
          visible_to_customer: visibleToCustomer,
          storage_path: storagePath,
          uploadedAt: new Date().toISOString(),
        },
      });
    }

    // Upload to Supabase Storage + insert into job_files
    const result = await uploadAndRecord(file, {
      jobId,
      folder: "vhc-media",
      uploadedBy: userId,
      visibleToCustomer,
    });

    if (!result.success) {
      console.warn("Failed to upload VHC media:", result.error);
      return res.status(500).json({
        error: "Upload failed",
        message: result.error || "Unknown storage/database failure",
      });
    }

    console.log("✅ VHC media uploaded successfully");

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      file: result.data || {
        file_name: file.fileName,
        file_url: result.publicUrl,
        file_type: file.mimetype,
        visible_to_customer: visibleToCustomer,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ VHC media upload error:", error);
    return res.status(500).json({
      error: "Failed to process upload",
      message: error.message,
    });
  }
}

export default withRoleGuard(handler);
