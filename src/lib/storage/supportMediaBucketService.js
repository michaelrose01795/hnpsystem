// file location: src/lib/storage/supportMediaBucketService.js
// Manages storage for Help & Diagnostics ("support") screenshots.
//
// Unlike the job-files / vhc-customer-media buckets, this bucket is PRIVATE
// (public: false). Screenshots may contain whatever the user had on screen, so
// they are never publicly addressable — admins view them via short-TTL signed
// URLs minted server-side. Path layout: {reportId}/screenshot-{timestamp}.{ext}
//
// Server-only — every operation needs the service-role key.

import { supabaseService } from "@/lib/database/supabaseClient";

const BUCKET_NAME = "support-reports";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — screenshots are capped client-side too
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

// Cache the bucket-exists check for the lifetime of the Node process.
let bucketReadyPromise = null;

/**
 * Ensure the private support-reports bucket exists. Requires the service-role
 * key. Safe to call on every upload; the real work runs once per process.
 * @returns {Promise<void>}
 */
export async function ensureSupportBucket() {
  if (bucketReadyPromise) return bucketReadyPromise;

  bucketReadyPromise = (async () => {
    if (!supabaseService) {
      throw new Error(
        `Support bucket "${BUCKET_NAME}" does not exist and SUPABASE_SERVICE_ROLE_KEY is not set — cannot auto-create.`
      );
    }

    try {
      const { data: existing, error: getError } = await supabaseService.storage.getBucket(BUCKET_NAME);
      if (existing && !getError) return;
    } catch {
      // Fall through to create.
    }

    const { error: createError } = await supabaseService.storage.createBucket(BUCKET_NAME, {
      public: false, // PRIVATE — screenshots are sensitive
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });

    if (createError && !/already exists/i.test(createError.message || "")) {
      bucketReadyPromise = null; // allow a retry on the next call
      throw new Error(`Failed to create support bucket "${BUCKET_NAME}": ${createError.message}`);
    }

    console.log(`✅ Ensured private Supabase Storage bucket "${BUCKET_NAME}" exists`);
  })();

  return bucketReadyPromise;
}

const extForMime = (mime) =>
  mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";

/**
 * Build the object path for a report's screenshot.
 * @param {string} reportId
 * @param {string} mimeType
 * @returns {string}
 */
export function buildSupportScreenshotPath(reportId, mimeType) {
  return `${reportId}/screenshot-${Date.now()}.${extForMime(mimeType)}`;
}

/**
 * Upload a screenshot for a report. Validates MIME type and size.
 * @param {{ buffer: Buffer, mimeType: string }} file
 * @param {string} reportId
 * @returns {Promise<{ storagePath: string }>}
 */
export async function uploadSupportScreenshot(file, reportId) {
  if (!reportId) throw new Error("reportId is required");
  if (!file?.buffer) throw new Error("file buffer is required");
  if (!ALLOWED_MIME.has(file.mimeType)) {
    throw new Error(`Unsupported screenshot type: ${file.mimeType}`);
  }
  if (file.buffer.length > MAX_BYTES) {
    throw new Error("Screenshot exceeds the size limit");
  }

  await ensureSupportBucket();
  const client = supabaseService;
  if (!client) throw new Error("Supabase service role is not configured");

  const storagePath = buildSupportScreenshotPath(reportId, file.mimeType);

  const { error } = await client.storage.from(BUCKET_NAME).upload(storagePath, file.buffer, {
    contentType: file.mimeType,
    upsert: false,
  });

  if (error) {
    console.error("[support] screenshot upload failed:", {
      bucket: BUCKET_NAME,
      storagePath,
      message: error.message,
    });
    throw new Error(`Support screenshot upload failed: ${error.message}`);
  }

  return { storagePath };
}

/**
 * Mint a short-TTL signed URL for an admin to view a screenshot.
 * @param {string} storagePath
 * @param {number} [ttlSeconds]
 * @returns {Promise<string|null>}
 */
export async function getSupportScreenshotSignedUrl(storagePath, ttlSeconds = SIGNED_URL_TTL_SECONDS) {
  if (!storagePath) return null;
  const client = supabaseService;
  if (!client) return null;

  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, ttlSeconds);

  if (error) {
    console.warn(`[support] failed to sign ${storagePath}:`, error.message);
    return null;
  }
  return data?.signedUrl || null;
}

/**
 * Delete a screenshot (used by retention / report deletion).
 * @param {string} storagePath
 * @returns {Promise<void>}
 */
export async function deleteSupportScreenshot(storagePath) {
  if (!storagePath) return;
  const client = supabaseService;
  if (!client) return;

  const { error } = await client.storage.from(BUCKET_NAME).remove([storagePath]);
  if (error) {
    console.warn(`[support] failed to delete ${storagePath}:`, error.message);
  }
}

export { BUCKET_NAME, MAX_BYTES, SIGNED_URL_TTL_SECONDS, ALLOWED_MIME };
