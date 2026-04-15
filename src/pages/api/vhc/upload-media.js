// file location: src/pages/api/vhc/upload-media.js
// Server endpoint for creating or replacing technician VHC media.
export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { supabaseService, supabase as supabaseFallback } from "@/lib/database/supabaseClient";
import { parseMultipartForm } from "@/lib/storage/parseMultipartForm";
import {
  deleteFile,
  updateFileRecord,
  uploadAndRecord,
  uploadFile,
} from "@/lib/storage/storageService";
import { ensureJobFilesSchema } from "@/lib/storage/jobFilesSchemaRepair";

export const config = {
  api: {
    bodyParser: false,
  },
};

const VHC_STORAGE_FOLDER = "VHC";

function getClient() {
  return supabaseService || supabaseFallback;
}

function buildJobNumberCandidates(value) {
  const token = String(value || "").trim().replace(/^#/, "");
  if (!token) return [];

  const candidates = new Set([token, token.toUpperCase()]);
  if (/^\d+$/.test(token)) {
    const parsed = Number.parseInt(token, 10);
    if (parsed > 0) {
      candidates.add(String(parsed));
      candidates.add(String(parsed).padStart(5, "0"));
    }
  }

  return Array.from(candidates);
}

async function resolveUploadJobId(rawJobId, rawJobNumber) {
  const rawId = String(rawJobId || "").trim();

  if (rawId.startsWith("temp-")) {
    return { jobId: rawId, isTempJob: true };
  }

  if (/^\d+$/.test(rawId)) {
    return { jobId: Number(rawId), isTempJob: false };
  }

  const candidates = buildJobNumberCandidates(rawJobNumber || rawJobId);
  if (!candidates.length) {
    throw new Error("Missing jobId");
  }

  const client = getClient();
  const { data, error } = await client
    .from("jobs")
    .select("id, job_number")
    .in("job_number", candidates)
    .limit(1);

  if (error) {
    throw new Error(`Failed to resolve job number: ${error.message}`);
  }

  const job = Array.isArray(data) ? data[0] : null;
  if (!job?.id) {
    throw new Error("Job not found for VHC media upload");
  }

  return { jobId: job.id, isTempJob: false };
}

function validateMediaFile(mimetype, size) {
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

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

function deriveStoragePathFromPublicUrl(fileUrl = "") {
  if (!fileUrl) return "";

  try {
    const parsed = new URL(fileUrl);
    const marker = "/storage/v1/object/public/job-files/";
    const index = parsed.pathname.indexOf(marker);
    if (index >= 0) {
      return decodeURIComponent(parsed.pathname.slice(index + marker.length));
    }
  } catch {
    // Fallback to simple string parsing below.
  }

  const fallbackMarker = "/storage/v1/object/public/job-files/";
  const fallbackIndex = String(fileUrl).indexOf(fallbackMarker);
  if (fallbackIndex >= 0) {
    return decodeURIComponent(String(fileUrl).slice(fallbackIndex + fallbackMarker.length));
  }

  return "";
}

async function fetchExistingMediaRow(client, numericFileId) {
  const selectColumns = ["file_id", "job_id", "folder", "storage_path", "file_url"];
  let hasAttemptedSchemaRepair = false;

  while (true) {
    const { data, error } = await client
      .from("job_files")
      .select(selectColumns.join(", "))
      .eq("file_id", numericFileId)
      .single();

    if (!error) {
      return data;
    }

    const message = String(error?.message || "").toLowerCase();
    if (message.includes("storage_path") && message.includes("schema cache")) {
      if (!hasAttemptedSchemaRepair) {
        hasAttemptedSchemaRepair = true;
        const repaired = await ensureJobFilesSchema(["storage_path"]);
        if (repaired) {
          continue;
        }
      }

      const nextColumns = selectColumns.filter((columnName) => columnName !== "storage_path");
      selectColumns.length = 0;
      selectColumns.push(...nextColumns);
      continue;
    }

    throw new Error(`Failed to load existing media: ${error.message}`);
  }
}

async function replaceExistingMedia({ fileId, jobId, file, uploadedBy, visibleToCustomer }) {
  const client = getClient();
  const numericFileId = Number.parseInt(String(fileId || "").trim(), 10);
  if (!Number.isInteger(numericFileId) || numericFileId <= 0) {
    throw new Error("Invalid media file id for replacement");
  }

  const existingRow = await fetchExistingMediaRow(client, numericFileId);
  if (!existingRow || String(existingRow.job_id) !== String(jobId)) {
    throw new Error("Existing media does not belong to this job");
  }

  const folder = existingRow.folder || VHC_STORAGE_FOLDER;
  const { storagePath, publicUrl } = await uploadFile(file, folder, jobId);

  const result = await updateFileRecord(numericFileId, {
    fileName: file.fileName,
    fileUrl: publicUrl,
    fileType: file.mimetype,
    folder,
    uploadedBy,
    visibleToCustomer,
    fileSize: file.size ?? file.buffer.length,
    storageType: "supabase",
    storagePath,
  });

  if (!result.success) {
    await deleteFile(storagePath);
    throw new Error(result.error?.message || "Failed to update media record");
  }

  const previousStoragePath = existingRow.storage_path || deriveStoragePathFromPublicUrl(existingRow.file_url);
  if (previousStoragePath && previousStoragePath !== storagePath) {
    await deleteFile(previousStoragePath);
  }

  return result.data;
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
    const rawJobNumber = fields.jobNumber;
    if (!rawJobId && !rawJobNumber) {
      return res.status(400).json({ error: "Missing jobId" });
    }

    const { jobId, isTempJob } = await resolveUploadJobId(rawJobId, rawJobNumber);
    const userId = fields.userId || "system";
    const visibleToCustomer = fields.visibleToCustomer === "true" || fields.visibleToCustomer === true;
    const replaceFileId = fields.replaceFileId || null;

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
      replaceFileId,
    });

    if (isTempJob) {
      const { storagePath, publicUrl } = await uploadFile(file, VHC_STORAGE_FOLDER, jobId);

      return res.status(200).json({
        success: true,
        message: "File uploaded successfully (temp)",
        file: {
          file_name: file.fileName,
          file_url: publicUrl,
          file_type: file.mimetype,
          visible_to_customer: visibleToCustomer,
          storage_path: storagePath,
          uploaded_at: new Date().toISOString(),
        },
      });
    }

    let savedFile = null;

    if (replaceFileId) {
      savedFile = await replaceExistingMedia({
        fileId: replaceFileId,
        jobId,
        file,
        uploadedBy: userId,
        visibleToCustomer,
      });
    } else {
      const result = await uploadAndRecord(file, {
        jobId,
        folder: VHC_STORAGE_FOLDER,
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

      savedFile = result.data || {
        file_name: file.fileName,
        file_url: result.publicUrl,
        file_type: file.mimetype,
        visible_to_customer: visibleToCustomer,
        uploaded_at: new Date().toISOString(),
      };
    }

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      file: savedFile,
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
