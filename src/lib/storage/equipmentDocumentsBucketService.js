// file location: src/lib/storage/equipmentDocumentsBucketService.js
// Storage for equipment certificates, LOLER reports, manuals, invoices, service
// reports, warranty documents and check / fault photos.
//
// Same ensure-bucket / upload shape as deliveryPodBucketService.js, but the
// bucket is PRIVATE like support-reports: repair invoices and purchase paperwork
// are not for public URLs. Files are read through short-lived signed URLs minted
// by /api/tracking/equipment/documents after its role check.
//
// Layout inside "equipment-documents":
//   {equipmentId}/{docType}/{timestamp}-{safeName}
//
// Server-only — every operation needs the service-role key.

import { supabaseService } from "@/lib/database/supabaseClient";
import { EQUIPMENT_UPLOAD_MAX_BYTES } from "@/config/equipmentTracking";

const BUCKET_NAME = "equipment-documents";
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

// Cache the bucket-exists check for the lifetime of the Node process.
let bucketReadyPromise = null;

export async function ensureEquipmentDocumentsBucket() {
  if (bucketReadyPromise) return bucketReadyPromise;

  bucketReadyPromise = (async () => {
    if (!supabaseService) {
      throw new Error(
        `Equipment documents bucket "${BUCKET_NAME}" does not exist and SUPABASE_SERVICE_ROLE_KEY is not set — cannot auto-create.`
      );
    }

    try {
      const { data: existing, error: getError } = await supabaseService.storage.getBucket(BUCKET_NAME);
      if (existing && !getError) return;
    } catch {
      // Fall through to create.
    }

    const { error: createError } = await supabaseService.storage.createBucket(BUCKET_NAME, {
      public: false, // PRIVATE — invoices and purchase paperwork
      fileSizeLimit: EQUIPMENT_UPLOAD_MAX_BYTES,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
    });

    if (createError && !/already exists/i.test(createError.message || "")) {
      bucketReadyPromise = null; // allow a retry on the next call
      throw new Error(`Failed to create equipment documents bucket "${BUCKET_NAME}": ${createError.message}`);
    }
  })();

  return bucketReadyPromise;
}

const safeFileName = (name) =>
  String(name || "document")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .slice(-80);

const safeSegment = (value) => String(value || "other").replace(/[^A-Za-z0-9_-]/g, "") || "other";

/**
 * Upload one equipment file.
 * @param {{buffer:Buffer, fileName:string, mimeType:string}} file
 * @param {string} equipmentId
 * @param {string} docType
 * @returns {Promise<{storagePath:string}>}
 */
export async function uploadEquipmentDocument(file, equipmentId, docType) {
  if (!file?.buffer?.length) throw new Error("No file was supplied.");
  if (file.buffer.length > EQUIPMENT_UPLOAD_MAX_BYTES) {
    throw new Error(`Files must be ${Math.round(EQUIPMENT_UPLOAD_MAX_BYTES / 1024 / 1024)} MB or smaller.`);
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    throw new Error("Upload a PDF, or a JPEG, PNG, WebP or HEIC image.");
  }

  await ensureEquipmentDocumentsBucket();

  const storagePath = `${safeSegment(equipmentId)}/${safeSegment(docType)}/${Date.now()}-${safeFileName(file.fileName)}`;
  const { error } = await supabaseService.storage.from(BUCKET_NAME).upload(storagePath, file.buffer, {
    contentType: file.mimeType,
    upsert: false,
  });
  if (error) {
    const hint = /bucket/i.test(error.message || "")
      ? ` (check that the "${BUCKET_NAME}" bucket exists in Supabase Storage)`
      : "";
    throw new Error(`Equipment document upload failed: ${error.message}${hint}`);
  }
  return { storagePath };
}

/**
 * Short-lived signed URL for one stored file.
 * @param {string} storagePath
 * @param {{download?: string}} [options] pass a file name to force a download
 */
export async function getEquipmentDocumentSignedUrl(storagePath, { download } = {}) {
  if (!storagePath || !supabaseService) return null;
  const { data, error } = await supabaseService.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, download ? { download } : undefined);
  if (error) throw new Error(`Unable to open the document: ${error.message}`);
  return data?.signedUrl || null;
}

/**
 * Remove a stored file. Best-effort: used to clean up after a failed insert.
 * Documents a user removes are soft-deleted in the index and their file kept,
 * so the history stays provable.
 */
export async function deleteEquipmentDocumentFile(storagePath) {
  if (!storagePath || !supabaseService) return;
  const { error } = await supabaseService.storage.from(BUCKET_NAME).remove([storagePath]);
  if (error) console.warn(`Failed to delete ${storagePath} from equipment storage:`, error.message);
}

export { BUCKET_NAME, ALLOWED_MIME_TYPES };
