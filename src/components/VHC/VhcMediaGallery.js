// file location: src/components/VHC/VhcMediaGallery.js
// Read-only "Video / Photo" gallery for the technician's job view. The
// technician captures photos/videos against concerns during the health check
// (via SectionCameraButton); this component lets them see what they captured
// without leaving their job. It mirrors the office VhcDetailsPanel media tab's
// row layout but is purely a viewer — no upload / set-main-video controls.
//
// Data and grouping are shared with the office tab via buildVhcMediaLibrary so
// both surfaces always agree on what counts as VHC media and how it is bucketed
// by concern. Files are fetched through the getJobFiles DB helper (no raw
// Supabase queries in the component, per CLAUDE.md §5).

import React, { useEffect, useMemo, useState } from "react";
import { getJobFiles } from "@/lib/database/jobs";
import { buildVhcMediaLibrary } from "@/lib/vhc/buildVhcMediaLibrary";

const THUMB_SIZE = 88;

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function statusDotColour(status) {
  if (status === "red") return "var(--danger)";
  if (status === "amber") return "var(--warning)";
  if (status === "green") return "var(--success)";
  return "var(--text-1)";
}

function severityBadge(status) {
  if (status === "red") return { label: "Safety Critical", color: "var(--danger)", bg: "var(--danger-surface)" };
  if (status === "amber") return { label: "Advisory", color: "var(--warning)", bg: "var(--warning-surface)" };
  if (status === "green") return { label: "Monitor", color: "var(--success)", bg: "var(--success-surface)" };
  return null;
}

function ThumbIndex({ index }) {
  return (
    <span
      style={{
        position: "absolute",
        top: "6px",
        left: "6px",
        minWidth: "18px",
        height: "18px",
        padding: "0 5px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        background: "var(--overlay)",
        color: "var(--text-2)",
        fontSize: "11px",
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {index + 1}
    </span>
  );
}

function PhotoThumb({ file, index }) {
  return (
    <figure style={{ margin: 0, width: `${THUMB_SIZE}px`, flexShrink: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
      <a
        href={file.file_url}
        target="_blank"
        rel="noreferrer"
        title={`${file.file_name || "Photo"} · ${formatDateTime(file.uploaded_at)}`}
        style={{
          position: "relative",
          display: "block",
          width: `${THUMB_SIZE}px`,
          height: `${THUMB_SIZE}px`,
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          background: "var(--surface)",
        }}
      >
        <img
          src={file.file_url}
          alt={file.file_name || "VHC photo"}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        <ThumbIndex index={index} />
      </a>
      <figcaption style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-1)", opacity: 0.65 }}>
        {formatDateTime(file.uploaded_at)}
      </figcaption>
    </figure>
  );
}

function VideoThumb({ file, index }) {
  const width = Math.round(THUMB_SIZE * 1.6);
  return (
    <figure style={{ margin: 0, width: `${width}px`, flexShrink: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
      <div
        title={`${file.file_name || "Video"} · ${formatDateTime(file.uploaded_at)}`}
        style={{
          position: "relative",
          width: `${width}px`,
          height: `${THUMB_SIZE}px`,
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          background: "var(--surface)",
        }}
      >
        <video
          src={file.file_url}
          controls
          preload="metadata"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        <ThumbIndex index={index} />
      </div>
      <figcaption style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-1)", opacity: 0.65 }}>
        {formatDateTime(file.uploaded_at)}
      </figcaption>
    </figure>
  );
}

function RequestRow({ label, section, status, photos, videos, hideMediaCounts = false }) {
  const badge = severityBadge(status);
  let mediaIndex = -1;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        gap: "24px",
        background: "var(--theme)",
        borderRadius: "var(--radius-md)",
        padding: "20px",
      }}
    >
      {/* Left — the report/concern this set of media belongs to */}
      <div style={{ flex: "0 0 200px", minWidth: "180px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              aria-hidden="true"
              style={{ width: "10px", height: "10px", borderRadius: "var(--radius-pill)", background: statusDotColour(status), flexShrink: 0 }}
            />
            <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-1)" }}>{label}</span>
          </div>
          {section ? (
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-1)", opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {section}
            </span>
          ) : null}
        </div>

        {badge ? (
          <span
            style={{
              alignSelf: "flex-start",
              padding: "3px 10px",
              borderRadius: "var(--radius-pill)",
              background: badge.bg,
              color: badge.color,
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {badge.label}
          </span>
        ) : null}

        {hideMediaCounts ? null : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)", opacity: 0.7 }}>
              {photos.length} {photos.length === 1 ? "Photo" : "Photos"}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)", opacity: 0.7 }}>
              {videos.length} {videos.length === 1 ? "Video" : "Videos"}
            </span>
          </div>
        )}
      </div>

      {/* Right — the photos + videos captured for that request */}
      <div style={{ flex: "1 1 280px", minWidth: 0, display: "flex", flexWrap: "wrap", gap: "14px" }}>
        {videos.map((file) => { mediaIndex += 1; return <VideoThumb key={file.file_id} file={file} index={mediaIndex} />; })}
        {photos.map((file) => { mediaIndex += 1; return <PhotoThumb key={file.file_id} file={file} index={mediaIndex} />; })}
      </div>
    </div>
  );
}

export default function VhcMediaGallery({ jobId, reloadToken = 0 }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId) {
      setFiles([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const result = await getJobFiles(jobId);
      if (cancelled) return;
      if (result?.success) {
        setFiles(Array.isArray(result.data) ? result.data : []);
      } else {
        setError(result?.error?.message || "Could not load media.");
        setFiles([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, reloadToken]);

  const { groups, unlinkedPhotos, unlinkedVideos, mainVideos, stats } = useMemo(
    () => buildVhcMediaLibrary(files),
    [files],
  );

  const hasRequestMedia = groups.length > 0 || unlinkedPhotos.length > 0 || unlinkedVideos.length > 0;
  const hasAnyMedia = hasRequestMedia || mainVideos.length > 0;

  const statTiles = [
    { label: "Photos", value: stats.photos },
    { label: "Videos", value: stats.videos },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>Photos &amp; Videos</h3>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)", opacity: 0.7 }}>
            Media you have captured against concerns on this check
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {statTiles.map((tile) => (
            <div
              key={tile.label}
              style={{ background: "var(--theme)", borderRadius: "var(--radius-md)", padding: "8px 16px", display: "flex", flexDirection: "column", gap: "2px", minWidth: "72px" }}
            >
              <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-1)", lineHeight: 1 }}>{tile.value}</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-1)", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.7 }}>
                {tile.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <div role="alert" style={{ fontSize: "13px", fontWeight: 600, color: "var(--danger)" }}>{error}</div>
      ) : loading && !hasAnyMedia ? (
        <div style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.7 }}>Loading media…</div>
      ) : !hasAnyMedia ? (
        <div
          style={{
            background: "var(--theme)",
            borderRadius: "var(--radius-md)",
            padding: "20px",
            fontSize: "13px",
            color: "var(--text-1)",
            opacity: 0.75,
          }}
        >
          No photos or videos captured yet. Use the camera on a concern to add some.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {mainVideos.length > 0 && (
            <RequestRow label="Customer Video" section="Main walkaround" status="" photos={[]} videos={mainVideos} hideMediaCounts />
          )}
          {groups.map((group) => (
            <RequestRow
              key={group.key}
              label={group.label}
              section={group.section}
              status={group.status}
              photos={group.photos}
              videos={group.videos}
            />
          ))}
          {(unlinkedPhotos.length > 0 || unlinkedVideos.length > 0) && (
            <RequestRow label="Unlinked media" section="" status="" photos={unlinkedPhotos} videos={unlinkedVideos} />
          )}
        </div>
      )}
    </div>
  );
}
