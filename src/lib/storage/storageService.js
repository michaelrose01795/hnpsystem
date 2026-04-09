// file location: src/lib/storage/storageService.js
// Unified file-storage service.  All upload routes funnel through here so
// every file lands in one place (Supabase Storage) with consistent metadata
// persisted to the `job_files` table.
//
// Bucket layout inside "job-files":
//   vhc-media/{jobId}/{timestamp}-{safeName}
//   documents/{jobId}/{timestamp}-{safeName}
//   dealer-files/{jobId}/{timestamp}-{safeName}

import { supabaseService, supabase as supabaseFallback } from "@/lib/supabaseClient";

const BUCKET = "job-files"; // single bucket for all job-related uploads

// Prefer the service-role client (server-side); fall back to anon client.
function getClient() {
  return supabaseService || supabaseFallback;
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
 * @param {string} folder   e.g. "vhc-media", "documents", "dealer-files"
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
 * @param {string} folder      e.g. "vhc-media"
 * @param {string|number} jobId
 * @returns {Promise<{ storagePath: string, publicUrl: string }>}
 */
export async function uploadFile(file, folder, jobId) {
  const client = getClient();
  const storagePath = buildStoragePath(folder, jobId, file.fileName);

  const { error } = await client.storage.from(BUCKET).upload(storagePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const publicUrl =
    client.storage.from(BUCKET).getPublicUrl(storagePath)?.data?.publicUrl || "";

  return { storagePath, publicUrl };
}

/**
 * Delete a file from Supabase Storage.
 * @param {string} storagePath  e.g. "vhc-media/42/17127…-photo.jpg"
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

  const row = {
    job_id: meta.jobId,
    file_name: meta.fileName,
    file_url: meta.fileUrl,
    file_type: meta.fileType,
    folder: meta.folder || "general",
    uploaded_by: meta.uploadedBy,
    uploaded_at: new Date().toISOString(),
    visible_to_customer: meta.visibleToCustomer ?? true,
    file_size: meta.fileSize ?? null,
    storage_type: meta.storageType || "supabase",
    storage_path: meta.storagePath || null,
  };

  const { data, error } = await client
    .from("job_files")
    .insert([row])
    .select()
    .single();

  if (error) {
    console.error("❌ saveFileRecord error:", error);
    return { success: false, error: { message: error.message } };
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
  });

  if (!result.success) {
    // Attempt cleanup — the file is orphaned in storage if the DB insert failed.
    await deleteFile(storagePath);
    return { success: false, error: result.error?.message || "Database insert failed" };
  }

  return { success: true, data: result.data, publicUrl };
}
