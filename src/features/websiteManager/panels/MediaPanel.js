// file location: src/features/websiteManager/panels/MediaPanel.js
// Website media library — upload new assets, replace existing images, and
// remove unused media.
import React, { useMemo, useState } from "react";
import Section from "@/components/Section";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import { EmptyState, formatDateTime, formatSize } from "../helpers";

// Build a media-asset record from a browser File. For mock mode the preview
// uses an in-memory object URL.
// TODO: upload the File to the website storage bucket and persist the public
//       URL via POST /api/website/media instead of createObjectURL.
function fileToAsset(file) {
  const isImage = file.type.startsWith("image/");
  return {
    name: file.name,
    url: isImage ? URL.createObjectURL(file) : null,
    type: isImage ? "image" : "document",
    sizeKb: file.size / 1024,
  };
}

function Thumbnail({ asset }) {
  const sharedStyle = {
    width: "100%",
    height: 150,
    borderRadius: "var(--radius-sm, 8px)",
  };
  if (asset.url && asset.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.url}
        alt={asset.name}
        style={{ ...sharedStyle, objectFit: "cover", display: "block" }}
      />
    );
  }
  const ext = (asset.name.split(".").pop() || "file").toUpperCase();
  return (
    <LayerTheme
      padding="0"
      gap="0"
      radius="var(--radius-sm, 8px)"
      style={{
        ...sharedStyle,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        className="app-badge app-badge--accent-soft app-badge--control app-badge--uppercase"
      >
        {asset.type === "image" ? `${ext} image` : ext}
      </span>
    </LayerTheme>
  );
}

export default function MediaPanel({
  media,
  onAddMedia,
  onReplaceMedia,
  onDeleteMedia,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return media;
    return media.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.usedOn || "").toLowerCase().includes(q)
    );
  }, [media, query]);

  const handleUpload = (fileList) => {
    Array.from(fileList || []).forEach((file) => onAddMedia(fileToAsset(file)));
  };

  const handleReplace = (mediaId, fileList) => {
    const file = fileList && fileList[0];
    if (file) onReplaceMedia(mediaId, fileToAsset(file));
  };

  const handleDelete = (asset) => {
    if (window.confirm(`Delete media asset "${asset.name}"?`)) {
      onDeleteMedia(asset.id);
    }
  };

  return (
    <>
      <Section
        title="Website Media Uploads"
        subtitle="Upload images and documents for use across the public website. Existing assets can be swapped without changing where they are referenced."
      >
        <LayerTheme padding="18px" gap="8px" style={{ alignItems: "flex-start" }}>
          <div style={{ fontWeight: 700, color: "var(--accentText)" }}>
            Upload new media
          </div>
          <div style={{ fontSize: "0.84rem", color: "var(--text-1)" }}>
            Accepts images (JPG, PNG, WebP) and documents (PDF). Files are added
            to the library below.
          </div>
          {/* Label-wrapped input keeps the native file picker without extra refs. */}
          <label className="app-btn app-btn--primary" style={{ cursor: "pointer" }}>
            Choose files to upload
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => {
                handleUpload(e.target.files);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
          </label>
        </LayerTheme>
      </Section>

      <Section title="Media Library">
        <input
          className="app-input"
          type="search"
          placeholder="Search media by name or page…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 320 }}
        />

        {filtered.length === 0 ? (
          <EmptyState message="No media assets match your search." />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {filtered.map((asset) => (
              <LayerTheme key={asset.id} padding="12px" gap="8px">
                <Thumbnail asset={asset} />
                <div style={{ fontWeight: 600, wordBreak: "break-word" }}>
                  {asset.name}
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-1)" }}>
                  {asset.type === "image" ? "Image" : "Document"} ·{" "}
                  {formatSize(asset.sizeKb)}
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-1)" }}>
                  Used on: {asset.usedOn || "Unassigned"}
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-1)" }}>
                  {asset.uploadedBy
                    ? `By ${asset.uploadedBy} · ${formatDateTime(asset.uploadedAt)}`
                    : "Live website asset"}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <label
                    className="app-btn app-btn--secondary app-btn--sm"
                    style={{ cursor: "pointer", flex: 1, textAlign: "center" }}
                  >
                    Replace
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        handleReplace(asset.id, e.target.files);
                        e.target.value = "";
                      }}
                      style={{ display: "none" }}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(asset)}
                  >
                    Delete
                  </Button>
                </div>
              </LayerTheme>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
