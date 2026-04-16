// file location: src/pages/api/vhc/customer-video-upload.js

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabaseService } from "@/lib/database/supabaseClient";
import { 
  ensureVhcMediaBucket, 
  buildVhcMediaStoragePath, 
  uploadVhcMediaFile,
  BUCKET_NAME,
  MEDIA_TYPES 
} from "@/lib/storage/vhcMediaBucketService";

export const config = {
  api: {
    bodyParser: false,
  },
};

const parseMultipart = async (req) => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    throw new Error("Expected multipart form upload.");
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const response = new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": contentType },
  });

  const formData = await response.formData();
  const fields = {};
  let file = null;

  for (const [key, value] of formData.entries()) {
    if (value instanceof File && key === "file") {
      const arrayBuffer = await value.arrayBuffer();
      file = {
        fileName: value.name,
        mimeType: value.type || "video/webm",
        size: value.size || 0,
        buffer: Buffer.from(arrayBuffer),
      };
    } else {
      fields[key] = value;
    }
  }

  return { fields, file };
};

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  if (!supabaseService) {
    return res.status(500).json({ success: false, message: "Supabase service role is not configured." });
  }

  try {
    // Ensure the bucket exists before upload
    await ensureVhcMediaBucket();

    const { fields, file } = await parseMultipart(req);
    if (!file) {
      return res.status(400).json({ success: false, message: "Missing video file." });
    }
    if (!file.mimeType.startsWith("video/")) {
      return res.status(400).json({ success: false, message: "Only video uploads are allowed." });
    }

    const jobNumber = String(fields.jobNumber || "").trim();
    if (!jobNumber) {
      return res.status(400).json({ success: false, message: "Missing job number." });
    }

    const uploadedBy = String(fields.uploadedBy || "system").trim();
    const overlays = parseJson(fields.overlays, []);
    const contextLabel = String(fields.contextLabel || "").trim();

    // Use the new storage structure with organized folders by media type
    const uploadResult = await uploadVhcMediaFile(
      file,
      jobNumber,
      MEDIA_TYPES.customerVideo
    );

    const publicUrl = uploadResult.publicUrl;
    const storagePath = uploadResult.storagePath;

    const { data: record, error: insertError } = await supabaseService
      .from("vhc_customer_media")
      .insert({
        job_number: jobNumber,
        media_type: "video",
        storage_bucket: BUCKET_NAME,
        storage_path: storagePath,
        public_url: publicUrl,
        mime_type: file.mimeType,
        file_size_bytes: file.size,
        overlays,
        context_label: contextLabel || null,
        uploaded_by: uploadedBy,
      })
      .select("id, job_number, media_type, public_url, storage_bucket, storage_path, overlays, created_at")
      .single();

    if (insertError) {
      return res.status(500).json({ success: false, message: insertError.message || "Failed to save metadata." });
    }

    return res.status(200).json({ success: true, record });
  } catch (error) {
    console.error("❌ Customer video upload error:", {
      message: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ success: false, message: error?.message || "Unexpected upload error." });
  }
}

export default withRoleGuard(handler);
