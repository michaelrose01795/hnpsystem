// file location: src/lib/vhc/uploadMediaClient.js
// Shared browser-side helper for creating or replacing VHC media files.

export async function uploadVhcMediaFile({
  file,
  jobId,
  jobNumber,
  userId,
  visibleToCustomer = true,
  replaceFileId = null,
  // Optional concern link for per-section camera captures. Shape:
  //   { section, category, categoryLabel, concernId, index, label, status }
  // When present the API route stores it in job_files.vhc_concern_link
  // so the media file can be correlated back to the exact concern that
  // prompted the technician to record it.
  concernLink = null,
}) {
  if (!file) {
    throw new Error("No media file provided");
  }

  const hasJobReference =
    (jobId !== undefined && jobId !== null && String(jobId).trim()) ||
    (jobNumber !== undefined && jobNumber !== null && String(jobNumber).trim());

  if (!hasJobReference) {
    throw new Error("Missing job reference");
  }

  const formData = new FormData();
  formData.append("file", file);

  if (jobId !== undefined && jobId !== null && String(jobId).trim()) {
    formData.append("jobId", String(jobId));
  }
  if (jobNumber !== undefined && jobNumber !== null && String(jobNumber).trim()) {
    formData.append("jobNumber", String(jobNumber));
  }

  formData.append("userId", String(userId || "system"));
  formData.append("visibleToCustomer", String(visibleToCustomer));

  if (replaceFileId !== undefined && replaceFileId !== null && String(replaceFileId).trim()) {
    formData.append("replaceFileId", String(replaceFileId));
  }

  if (concernLink && typeof concernLink === "object") {
    // Serialise as JSON so the route can store it straight into the
    // JSONB column without further transformation.
    try {
      formData.append("concernLink", JSON.stringify(concernLink));
    } catch {
      // Non-serialisable input — skip silently rather than failing the
      // whole upload; the file still lands in job_files, just without
      // the concern reference.
    }
  }

  const response = await fetch("/api/vhc/upload-media", {
    method: "POST",
    body: formData,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Upload failed (${response.status})`);
  }

  return payload?.file || null;
}
