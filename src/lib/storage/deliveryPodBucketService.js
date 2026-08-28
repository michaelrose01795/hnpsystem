// file location: src/lib/storage/deliveryPodBucketService.js
// Storage for parts delivery proof of delivery (drop photos and signatures).
//
// Same shape as vhcMediaBucketService.js — the bucket is separate because a
// delivery is not always attached to a job, so the job-keyed folder layout of
// the "job-files" bucket has nowhere to put it.
//
// Layout inside "delivery-proof":
//   {deliveryJobId}/photo/{timestamp}-{safeName}
//   {deliveryJobId}/signature/{timestamp}-signature.png

import { supabaseService } from "@/lib/database/supabaseClient";

const BUCKET_NAME = "delivery-proof";

// A drop photo from a phone camera. Well under the 50 MB VHC video ceiling —
// proof of delivery is a snapshot, not a media library.
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

const POD_KINDS = { photo: "photo", signature: "signature" };

// Cache the bucket-exists check for the lifetime of the Node process.
let bucketReadyPromise = null;

/**
 * Ensure the proof-of-delivery bucket exists. Requires the service-role key.
 * Safe to call on every upload; the real work only runs once per process.
 */
export async function ensureDeliveryPodBucket() {
  if (bucketReadyPromise) return bucketReadyPromise;

  bucketReadyPromise = (async () => {
    if (!supabaseService) {
      throw new Error(
        `Proof-of-delivery bucket "${BUCKET_NAME}" does not exist and SUPABASE_SERVICE_ROLE_KEY is not set — cannot auto-create.`
      );
    }

    try {
      const { data: existing, error: getError } = await supabaseService.storage.getBucket(BUCKET_NAME);
      if (existing && !getError) return;
    } catch {
      // Fall through to create.
    }

    const { error: createError } = await supabaseService.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: MAX_FILE_BYTES,
    });

    if (createError && !/already exists/i.test(createError.message || "")) {
      bucketReadyPromise = null; // allow a retry on the next call
      throw new Error(
        `Failed to create proof-of-delivery bucket "${BUCKET_NAME}": ${createError.message}`
      );
    }
  })();

  return bucketReadyPromise;
}

const safeFileName = (name) =>
  String(name || "proof.jpg")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .slice(-80);

/**
 * @param {string} deliveryJobId
 * @param {"photo"|"signature"} kind
 * @param {string} fileName
 */
export function buildDeliveryPodPath(deliveryJobId, kind, fileName) {
  const folder = POD_KINDS[kind] || POD_KINDS.photo;
  return `${deliveryJobId}/${folder}/${Date.now()}-${safeFileName(fileName)}`;
}

/**
 * Upload one proof-of-delivery file.
 *
 * @param {{buffer:Buffer, fileName:string, mimeType:string}} file
 * @param {string} deliveryJobId
 * @param {"photo"|"signature"} kind
 * @returns {Promise<{storagePath:string, publicUrl:string}>}
 */
export async function uploadDeliveryPodFile(file, deliveryJobId, kind) {
  if (!file?.buffer?.length) throw new Error("No proof-of-delivery file was supplied.");
  if (file.buffer.length > MAX_FILE_BYTES) {
    throw new Error(`Proof of delivery must be ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB or smaller.`);
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    throw new Error("Proof of delivery must be a JPEG, PNG, WebP or HEIC image.");
  }

  await ensureDeliveryPodBucket();
  const client = supabaseService;
  if (!client) throw new Error("Supabase service role is not configured");

  const storagePath = buildDeliveryPodPath(deliveryJobId, kind, file.fileName);
  const { error } = await client.storage.from(BUCKET_NAME).upload(storagePath, file.buffer, {
    contentType: file.mimeType,
    upsert: false,
  });
  if (error) {
    const hint = /bucket/i.test(error.message || "")
      ? ` (check that the "${BUCKET_NAME}" bucket exists in Supabase Storage)`
      : "";
    throw new Error(`Proof-of-delivery upload failed: ${error.message}${hint}`);
  }

  const publicUrl = client.storage.from(BUCKET_NAME).getPublicUrl(storagePath)?.data?.publicUrl || "";
  return { storagePath, publicUrl };
}

/**
 * Remove a stored proof file. Best-effort — a delete failure is logged, not
 * thrown, so replacing a photo never blocks the delivery being recorded.
 * @param {string} storagePath
 */
export async function deleteDeliveryPodFile(storagePath) {
  if (!storagePath || !supabaseService) return;
  const { error } = await supabaseService.storage.from(BUCKET_NAME).remove([storagePath]);
  if (error) {
    console.warn(`Failed to delete ${storagePath} from proof-of-delivery storage:`, error.message);
  }
}

export { BUCKET_NAME, MAX_FILE_BYTES, ALLOWED_MIME_TYPES, POD_KINDS };
