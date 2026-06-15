// file location: src/lib/vhc/buildVhcMediaLibrary.js
// Single source of truth for turning a job's raw job_files rows into the
// VHC "Video / Photo" library used by both the office VhcDetailsPanel media
// tab and the technician-facing VhcMediaGallery. Keeping the classify +
// grouping logic here means both surfaces always agree on what counts as VHC
// media and how it is bucketed by concern.

// A file is VHC media when it lives in the VHC storage folder. The upload
// route writes "VHC"; legacy/seed rows may use "vhc" / "vhc-media".
export function isVhcMediaFile(file = {}) {
  const folder = String(file.folder || "").trim().toLowerCase();
  return folder === "vhc" || folder === "vhc-media";
}

export function isImageFile(file = {}) {
  const type = (file.file_type || "").toLowerCase();
  const name = (file.file_name || "").toLowerCase();
  return type.startsWith("image") || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name);
}

export function isVideoFile(file = {}) {
  const type = (file.file_type || "").toLowerCase();
  const name = (file.file_name || "").toLowerCase();
  return type.startsWith("video") || /\.(mp4|mov|avi|mkv|webm)$/i.test(name);
}

// Split a raw job_files array into the VHC photo + video sets.
export function classifyVhcMedia(jobFiles = []) {
  const files = Array.isArray(jobFiles) ? jobFiles.filter(Boolean) : [];
  return {
    photoFiles: files.filter((file) => isVhcMediaFile(file) && isImageFile(file)),
    videoFiles: files.filter((file) => isVhcMediaFile(file) && isVideoFile(file)),
  };
}

// Group VHC media (photos + videos) by the request/concern they were captured
// against (job_files.vhc_concern_link). Each linked concern becomes one row
// carrying both its photos and its videos. Media with no concern link falls
// into the "unlinked" bucket. Any video flagged job_files.is_main_vhc_video is
// the customer-facing "main" walkaround and is pulled out + pinned separately,
// regardless of whether it is also linked to a concern.
export function groupVhcMedia({ photoFiles = [], videoFiles = [] } = {}) {
  const groups = new Map();
  const unlinkedPhotos = [];
  const unlinkedVideos = [];
  const mainVideos = [];
  let customerVisible = 0;

  const place = (file, kind) => {
    if (file?.visible_to_customer) customerVisible += 1;
    if (kind === "video" && file?.is_main_vhc_video) {
      mainVideos.push(file);
      return;
    }
    const link =
      file?.vhc_concern_link && typeof file.vhc_concern_link === "object"
        ? file.vhc_concern_link
        : null;
    const key = link?.concernId != null ? String(link.concernId) : null;
    if (!key) {
      if (kind === "video") unlinkedVideos.push(file);
      else unlinkedPhotos.push(file);
      return;
    }
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: link.label || link.categoryLabel || "Reported concern",
        section: link.section || "",
        status: String(link.status || "").toLowerCase(),
        photos: [],
        videos: [],
      });
    }
    const group = groups.get(key);
    if (kind === "video") group.videos.push(file);
    else group.photos.push(file);
  };

  photoFiles.forEach((file) => place(file, "photo"));
  videoFiles.forEach((file) => place(file, "video"));

  const linkedGroups = Array.from(groups.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  // Newest main video first so the latest end-of-check walkaround leads.
  mainVideos.sort(
    (a, b) =>
      new Date(b.uploaded_at || 0).getTime() -
      new Date(a.uploaded_at || 0).getTime(),
  );

  return {
    groups: linkedGroups,
    unlinkedPhotos,
    unlinkedVideos,
    mainVideos,
    stats: {
      photos: photoFiles.length,
      videos: videoFiles.length,
      customerVisible,
    },
  };
}

// Convenience: raw job_files → full media library in one call.
export function buildVhcMediaLibrary(jobFiles = []) {
  const { photoFiles, videoFiles } = classifyVhcMedia(jobFiles);
  return { photoFiles, videoFiles, ...groupVhcMedia({ photoFiles, videoFiles }) };
}
