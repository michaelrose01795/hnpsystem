// file location: src/lib/storage/storageService.js
// Unified file-storage service.  All upload routes funnel through here so
// every file lands in one place (Supabase Storage) with consistent metadata
// persisted to the `job_files` table.
//
// Bucket layout inside "job-files":
//   VHC/{jobId}/{timestamp}-{safeName}
//   documents/{jobId}/{timestamp}-{safeName}
//   dealer-files/{jobId}/{timestamp}-{safeName}

import { supabaseService, supabase as supabaseFallback } from "@/lib/database/supabaseClient";
import {
  ensureJobFilesSchema,
  getRepairableJobFilesColumnsFromError,
} from "@/lib/storage/jobFilesSchemaRepair";

const BUCKET = "job-files"; // single bucket for all job-related uploads
const JOB_FILES_OPTIONAL_COLUMNS = ["visible_to_customer", "storage_path", "vhc_concern_link"];

// Prefer the service-role client (server-side); fall back to anon client.
function getClient() {
  return supabaseService || supabaseFallback;
}

function isMissingSchemaColumnError(error, columnName) {
  const message = String(error?.message || "").toLowerCase();
  const column = String(columnName || "").toLowerCase();
  return Boolean(column) && message.includes(column) && message.includes("schema cache");
}

// Cache the bucket-exists check for the lifetime of the Node process so we
// don't hit Supabase for every upload once it's known to exist.
let bucketReadyPromise = null;

/**
 * Ensure the "job-files" bucket exists.  Requires the service-role key — the
 * anon key can't create buckets.  Safe to call on every upload; the real work
 * only runs once per process.
 * @returns {Promise<void>}
 */
export async function ensureBucket() {
  if (bucketReadyPromise) return bucketReadyPromise;

  bucketReadyPromise = (async () => {
    const client = getClient();
    try {
      const { data: existing, error: getError } = await client.storage.getBucket(BUCKET);
      if (existing && !getError) return;
    } catch {
      // fall through to create
    }

    if (!supabaseService) {
      throw new Error(
        `Storage bucket "${BUCKET}" does not exist and SUPABASE_SERVICE_ROLE_KEY is not set — cannot auto-create. Add the service-role key to your environment or create the bucket manually in Supabase Storage.`
      );
    }

    const { error: createError } = await supabaseService.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 52428800, // 50 MB — matches the VHC video limit
    });

    if (createError && !/already exists/i.test(createError.message || "")) {
      bucketReadyPromise = null; // allow a retry on the next call
      throw new Error(`Failed to create storage bucket "${BUCKET}": ${createError.message}`);
    }

    console.log(`✅ Ensured Supabase Storage bucket "${BUCKET}" exists`);
  })();

  return bucketReadyPromise;
}

/**
 * Sanitise a user-supplied filename to prevent path-traversal and filesystem issues.
 * @param {string} name
 * @returns {string}
 */
export function sanitiseFileName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");
}

/**
 * Build a deterministic object path inside the bucket.
 * @param {string} folder   e.g. "VHC", "documents", "dealer-files"
 * @param {string|number} jobId
 * @param {string} fileName original file name (will be sanitised)
 * @returns {string}
 */
export function buildStoragePath(folder, jobId, fileName) {
  const safe = sanitiseFileName(fileName);
  return `${folder}/${jobId}/${Date.now()}-${safe}`;
}

/**
 * Upload a Buffer to Supabase Storage.
 *
 * @param {{ buffer: Buffer, fileName: string, mimetype: string }} file
 * @param {string} folder      e.g. "VHC"
 * @param {string|number} jobId
 * @returns {Promise<{ storagePath: string, publicUrl: string }>}
 */
export async function uploadFile(file, folder, jobId) {
  await ensureBucket();
  const client = getClient();
  const storagePath = buildStoragePath(folder, jobId, file.fileName);

  const { error } = await client.storage.from(BUCKET).upload(storagePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) {
    console.error("❌ Supabase Storage upload failed:", {
      bucket: BUCKET,
      storagePath,
      message: error.message,
      statusCode: error.statusCode,
      name: error.name,
    });
    const hint = /bucket/i.test(error.message || "")
      ? ` (check that the "${BUCKET}" bucket exists in Supabase Storage)`
      : "";
    throw new Error(`Supabase Storage upload failed: ${error.message}${hint}`);
  }

  const publicUrl =
    client.storage.from(BUCKET).getPublicUrl(storagePath)?.data?.publicUrl || "";

  return { storagePath, publicUrl };
}

/**
 * Delete a file from Supabase Storage.
 * @param {string} storagePath  e.g. "VHC/42/17127…-photo.jpg"
 * @returns {Promise<void>}
 */
export async function deleteFile(storagePath) {
  if (!storagePath) return;

  const client = getClient();
  const { error } = await client.storage.from(BUCKET).remove([storagePath]);

  if (error) {
    console.warn(`⚠️ Failed to delete ${storagePath} from storage:`, error.message);
  }
}

/**
 * Persist a file record to the `job_files` table.
 * This is the single authoritative call — all upload routes use it.
 *
 * @param {{
 *   jobId: number|string,
 *   fileName: string,
 *   fileUrl: string,
 *   fileType: string,
 *   folder: string,
 *   uploadedBy: string|number,
 *   visibleToCustomer?: boolean,
 *   fileSize?: number,
 *   storageType?: string,
 *   storagePath?: string,
 * }} meta
 * @returns {Promise<{ success: boolean, data?: object, error?: object }>}
 */
export async function saveFileRecord(meta) {
  const client = getClient();

  // uploaded_by is an integer FK — coerce to number or null; never insert a string.
  const rawUploadedBy = meta.uploadedBy;
  const uploadedBy = rawUploadedBy && /^\d+$/.test(String(rawUploadedBy)) ? Number(rawUploadedBy) : null;

  const row = {
    job_id: meta.jobId,
    file_name: meta.fileName,
    file_url: meta.fileUrl,
    file_type: meta.fileType,
    folder: meta.folder || "general",
    uploaded_by: uploadedBy,
    uploaded_at: new Date().toISOString(),
    visible_to_customer: meta.visibleToCustomer ?? true,
    storage_path: meta.storagePath || null,
    // Concern link JSON — only included when the caller provided it.
    // Empty objects are filtered so the column stays NULL by default.
    ...(meta.concernLink && typeof meta.concernLink === "object" && Object.keys(meta.concernLink).length
      ? { vhc_concern_link: meta.concernLink }
      : {}),
  };

  const insertRow = { ...row };
  let data = null;
  let error = null;
  let hasAttemptedSchemaRepair = false;

  while (true) {
    const response = await client
      .from("job_files")
      .insert([insertRow])
      .select("file_id, job_id, file_name, file_url, file_type, folder, uploaded_by, uploaded_at, visible_to_customer")
      .single();

    data = response.data;
    error = response.error;

    if (!error) break;

    const repairableColumns = getRepairableJobFilesColumnsFromError(
      error,
      Object.keys(insertRow)
    );

    if (repairableColumns.length && !hasAttemptedSchemaRepair) {
      hasAttemptedSchemaRepair = true;
      const repaired = await ensureJobFilesSchema(repairableColumns);
      if (repaired) {
        continue;
      }
    }

    const missingColumn = JOB_FILES_OPTIONAL_COLUMNS.find(
      (columnName) =>
        Object.prototype.hasOwnProperty.call(insertRow, columnName) &&
        isMissingSchemaColumnError(error, columnName)
    );

    if (!missingColumn) break;

    delete insertRow[missingColumn];
  }

  if (error) {
    console.error("❌ saveFileRecord error:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      row,
    });
    const combined = [error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" — ");
    return { success: false, error: { message: combined || "Database insert failed" } };
  }

  return { success: true, data };
}

export async function updateFileRecord(fileId, meta) {
  const client = getClient();
  const rawUploadedBy = meta.uploadedBy;
  const uploadedBy = rawUploadedBy && /^\d+$/.test(String(rawUploadedBy)) ? Number(rawUploadedBy) : null;

  const updates = {
    file_name: meta.fileName,
    file_url: meta.fileUrl,
    file_type: meta.fileType,
    folder: meta.folder || "general",
    uploaded_by: uploadedBy,
    uploaded_at: new Date().toISOString(),
    visible_to_customer: meta.visibleToCustomer ?? true,
    storage_path: meta.storagePath || null,
    ...(meta.concernLink && typeof meta.concernLink === "object" && Object.keys(meta.concernLink).length
      ? { vhc_concern_link: meta.concernLink }
      : {}),
  };

  const updatePayload = { ...updates };
  let data = null;
  let error = null;
  let hasAttemptedSchemaRepair = false;

  while (true) {
    const response = await client
      .from("job_files")
      .update(updatePayload)
      .eq("file_id", fileId)
      .select("file_id, job_id, file_name, file_url, file_type, folder, uploaded_by, uploaded_at, visible_to_customer")
      .single();

    data = response.data;
    error = response.error;

    if (!error) break;

    const repairableColumns = getRepairableJobFilesColumnsFromError(
      error,
      Object.keys(updatePayload)
    );

    if (repairableColumns.length && !hasAttemptedSchemaRepair) {
      hasAttemptedSchemaRepair = true;
      const repaired = await ensureJobFilesSchema(repairableColumns);
      if (repaired) {
        continue;
      }
    }

    const missingColumn = JOB_FILES_OPTIONAL_COLUMNS.find(
      (columnName) =>
        Object.prototype.hasOwnProperty.call(updatePayload, columnName) &&
        isMissingSchemaColumnError(error, columnName)
    );

    if (!missingColumn) break;

    delete updatePayload[missingColumn];
  }

  if (error) {
    console.error("❌ updateFileRecord error:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      fileId,
      updates,
    });
    const combined = [error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" — ");
    return { success: false, error: { message: combined || "Database update failed" } };
  }

  return { success: true, data };
}

/**
 * Full upload + persist pipeline.
 * Uploads the file to Supabase Storage then writes a `job_files` row.
 *
 * @param {{ buffer: Buffer, fileName: string, mimetype: string, size: number }} file
 * @param {{ jobId: string|number, folder: string, uploadedBy: string|number, visibleToCustomer?: boolean }} opts
 * @returns {Promise<{ success: boolean, data?: object, publicUrl?: string, error?: string }>}
 */
export async function uploadAndRecord(file, opts) {
  const { storagePath, publicUrl } = await uploadFile(file, opts.folder, opts.jobId);

  const result = await saveFileRecord({
    jobId: opts.jobId,
    fileName: file.fileName,
    fileUrl: publicUrl,
    fileType: file.mimetype,
    folder: opts.folder,
    uploadedBy: opts.uploadedBy,
    visibleToCustomer: opts.visibleToCustomer,
    fileSize: file.size ?? file.buffer.length,
    storageType: "supabase",
    storagePath,
    concernLink: opts.concernLink || null,
  });

  if (!result.success) {
    // Attempt cleanup — the file is orphaned in storage if the DB insert failed.
    await deleteFile(storagePath);
    return { success: false, error: result.error?.message || "Database insert failed" };
  }

  return { success: true, data: result.data, publicUrl };
}
