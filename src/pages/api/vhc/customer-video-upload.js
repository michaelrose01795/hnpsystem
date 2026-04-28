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
    const isUploadedFile =
      key === "file" &&
      value &&
      typeof value === "object" &&
      typeof value.arrayBuffer === "function";

    if (isUploadedFile) {
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

const readJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
};

const normaliseVideoMeta = ({ fileName, mimeType, fileSize }) => {
  const safeFileName = String(fileName || "customer-video.webm").trim();
  const safeMimeType = String(mimeType || "video/webm").trim();
  const safeFileSize = Number(fileSize || 0);

  if (!safeMimeType.startsWith("video/")) {
    throw Object.assign(new Error("Only video uploads are allowed."), { statusCode: 400 });
  }

  return {
    fileName: safeFileName,
    mimeType: safeMimeType,
    fileSize: Number.isFinite(safeFileSize) ? safeFileSize : 0,
  };
};

const createCustomerVideoRecord = async ({
  jobNumber,
  storagePath,
  publicUrl,
  mimeType,
  fileSize,
  overlays,
  contextLabel,
  uploadedBy,
}) => {
  const { data: record, error: insertError } = await supabaseService
    .from("vhc_customer_media")
    .insert({
      job_number: jobNumber,
      media_type: "video",
      storage_bucket: BUCKET_NAME,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: mimeType,
      file_size_bytes: fileSize,
      overlays,
      context_label: contextLabel || null,
      uploaded_by: uploadedBy,
    })
    .select("id, job_number, media_type, public_url, storage_bucket, storage_path, overlays, created_at")
    .single();

  if (insertError) {
    throw Object.assign(new Error(insertError.message || "Failed to save metadata."), { statusCode: 500 });
  }

  return record;
};

const handleSignedUploadRequest = async (body, res) => {
  const action = String(body.action || "").trim();

  if (action === "createSignedUpload") {
    const jobNumber = String(body.jobNumber || "").trim();
    if (!jobNumber) {
      return res.status(400).json({ success: false, message: "Missing job number." });
    }

    const fileMeta = normaliseVideoMeta(body);
    await ensureVhcMediaBucket();

    const storagePath = buildVhcMediaStoragePath(
      jobNumber,
      MEDIA_TYPES.customerVideo,
      fileMeta.fileName
    );
    const { data, error } = await supabaseService
      .storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(storagePath);

    if (error) {
      return res.status(500).json({ success: false, message: error.message || "Failed to prepare upload." });
    }

    return res.status(200).json({
      success: true,
      bucket: BUCKET_NAME,
      storagePath,
      signedUrl: data?.signedUrl || "",
      token: data?.token || "",
    });
  }

  if (action === "completeSignedUpload") {
    const jobNumber = String(body.jobNumber || "").trim();
    const storagePath = String(body.storagePath || "").trim();
    if (!jobNumber) {
      return res.status(400).json({ success: false, message: "Missing job number." });
    }
    if (!storagePath) {
      return res.status(400).json({ success: false, message: "Missing storage path." });
    }

    const fileMeta = normaliseVideoMeta(body);
    const uploadedBy = String(body.uploadedBy || "system").trim();
    const overlays = Array.isArray(body.overlays) ? body.overlays : [];
    const contextLabel = String(body.contextLabel || "").trim();
    const publicUrl = supabaseService.storage.from(BUCKET_NAME).getPublicUrl(storagePath)?.data?.publicUrl || "";

    const record = await createCustomerVideoRecord({
      jobNumber,
      storagePath,
      publicUrl,
      mimeType: fileMeta.mimeType,
      fileSize: fileMeta.fileSize,
      overlays,
      contextLabel,
      uploadedBy,
    });

    return res.status(200).json({ success: true, record });
  }

  return res.status(400).json({ success: false, message: "Unknown upload action." });
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
    const contentType = req.headers["content-type"] || "";
    if (contentType.startsWith("application/json")) {
      const body = await readJsonBody(req);
      return handleSignedUploadRequest(body, res);
    }

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

    const record = await createCustomerVideoRecord({
      jobNumber,
      storagePath,
      publicUrl,
      mimeType: file.mimeType,
      fileSize: file.size,
      overlays,
      contextLabel,
      uploadedBy,
    });

    return res.status(200).json({ success: true, record });
  } catch (error) {
    console.error("❌ Customer video upload error:", {
      message: error?.message,
      stack: error?.stack,
    });
    return res.status(error?.statusCode || 500).json({ success: false, message: error?.message || "Unexpected upload error." });
  }
}

export default withRoleGuard(handler);
