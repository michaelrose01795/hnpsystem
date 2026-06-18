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
  // When true the upload is flagged as the job's main customer-facing VHC
  // video (the end-of-check walkaround), stored in job_files.is_main_vhc_video
  // and pinned at the top of the Video / Photo tab.
  isMainVideo = false,
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
  formData.append("isMainVideo", String(isMainVideo === true));

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

// Update an existing VHC media file's customer visibility and/or its concern
// link (the "Linked item" it is grouped under). Pass only the fields you want
// to change — omit `visibleToCustomer` to leave visibility untouched, omit
// `concernLink` to leave the link untouched, or pass `concernLink: null` to
// unlink the media. Backs the visibility toggle + relink controls in the
// Photo Preview popup.
export async function updateVhcMediaRecord({ fileId, visibleToCustomer, concernLink } = {}) {
  if (fileId === undefined || fileId === null || String(fileId).trim() === "") {
    throw new Error("Missing fileId");
  }

  const payload = { fileId };
  if (visibleToCustomer !== undefined) payload.visibleToCustomer = visibleToCustomer === true;
  if (concernLink !== undefined) payload.concernLink = concernLink;

  const response = await fetch("/api/vhc/update-media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let result = {};
  try {
    result = await response.json();
  } catch {
    result = {};
  }

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.error || `Update failed (${response.status})`);
  }

  return result?.file || null;
}

// Promote/demote an existing job_files video as the job's main customer-facing
// VHC video (job_files.is_main_vhc_video). Used by the "Set as main video"
// toggle in the VHC Video / Photo tab.
export async function setMainVhcVideo({ fileId, isMain = true }) {
  if (fileId === undefined || fileId === null || String(fileId).trim() === "") {
    throw new Error("Missing fileId");
  }

  const response = await fetch("/api/vhc/set-main-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, isMain: isMain === true }),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || payload?.error || `Update failed (${response.status})`);
  }

  return payload?.file || null;
}
