// file location: src/lib/storage/vhcMediaBucketService.js
// Manages storage for VHC customer media (videos, photos, documents).
// Handles bucket creation and ensures organized folder structure by job number and media type.

import { supabaseService } from "@/lib/database/supabaseClient";

const BUCKET_NAME = "vhc-customer-media";
const MEDIA_TYPES = {
  photo: "photo",
  video: "video",
  customerVideo: "customer-video",
  document: "document",
};

// Cache the bucket-exists check for the lifetime of the Node process
let bucketReadyPromise = null;

/**
 * Ensure the VHC customer media bucket exists.
 * Requires the service-role key — the anon key can't create buckets.
 * Safe to call on every upload; the real work only runs once per process.
 * @returns {Promise<void>}
 */
export async function ensureVhcMediaBucket() {
  if (bucketReadyPromise) return bucketReadyPromise;

  bucketReadyPromise = (async () => {
    if (!supabaseService) {
      throw new Error(
        `VHC media bucket "${BUCKET_NAME}" does not exist and SUPABASE_SERVICE_ROLE_KEY is not set — cannot auto-create.`
      );
    }

    try {
      const { data: existing, error: getError } = await supabaseService.storage.getBucket(BUCKET_NAME);
      if (existing && !getError) {
        console.log(`✅ VHC media bucket "${BUCKET_NAME}" already exists`);
        return;
      }
    } catch (e) {
      // Fall through to create
      console.log(`ℹ️ Checking bucket existence...`);
    }

    // Create the bucket
    const { error: createError } = await supabaseService.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 52428800, // 50 MB — matches the VHC video limit
    });

    if (createError && !/already exists/i.test(createError.message || "")) {
      bucketReadyPromise = null; // allow a retry on the next call
      throw new Error(`Failed to create VHC media bucket "${BUCKET_NAME}": ${createError.message}`);
    }

    console.log(`✅ Ensured Supabase Storage bucket "${BUCKET_NAME}" exists`);
  })();

  return bucketReadyPromise;
}

/**
 * Sanitize a filename to prevent path-traversal and filesystem issues.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeMediaFileName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");
}

/**
 * Build a storage path for VHC media organized by job number and media type.
 * Path structure: jobs/{jobNumber}/{mediaType}/{timestamp}-{fileName}
 *
 * @param {string|number} jobNumber
 * @param {string} mediaType one of: photo, video, customer-video, document
 * @param {string} fileName original file name
 * @returns {string}
 */
export function buildVhcMediaStoragePath(jobNumber, mediaType, fileName) {
  const safeType = String(mediaType || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "_");
  const safeName = sanitizeMediaFileName(fileName);
  return `jobs/${jobNumber}/${safeType}/${Date.now()}-${safeName}`;
}

/**
 * Upload a media file to VHC customer media bucket.
 *
 * @param {{ buffer: Buffer, fileName: string, mimeType: string }} file
 * @param {string|number} jobNumber
 * @param {string} mediaType one of: photo, video, customer-video, document
 * @returns {Promise<{ storagePath: string, publicUrl: string }>}
 */
export async function uploadVhcMediaFile(file, jobNumber, mediaType) {
  await ensureVhcMediaBucket();

  const client = supabaseService;
  if (!client) {
    throw new Error("Supabase service role is not configured");
  }

  const storagePath = buildVhcMediaStoragePath(jobNumber, mediaType, file.fileName);

  const { error } = await client.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file.buffer, {
      contentType: file.mimeType,
      upsert: false,
    });

  if (error) {
    console.error("❌ VHC media upload failed:", {
      bucket: BUCKET_NAME,
      storagePath,
      message: error.message,
      statusCode: error.statusCode,
    });
    const hint = /bucket/i.test(error.message || "")
      ? ` (check that the "${BUCKET_NAME}" bucket exists in Supabase Storage)`
      : "";
    throw new Error(`VHC media upload failed: ${error.message}${hint}`);
  }

  const publicUrl = client.storage.from(BUCKET_NAME).getPublicUrl(storagePath)?.data?.publicUrl || "";

  return { storagePath, publicUrl };
}

/**
 * Delete a media file from VHC customer media bucket.
 * @param {string} storagePath
 * @returns {Promise<void>}
 */
export async function deleteVhcMediaFile(storagePath) {
  if (!storagePath) return;

  const client = supabaseService;
  if (!client) {
    console.warn("⚠️ Supabase service not configured, cannot delete file");
    return;
  }

  const { error } = await client.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.warn(`⚠️ Failed to delete ${storagePath} from VHC media storage:`, error.message);
  }
}

export { BUCKET_NAME, MEDIA_TYPES };
