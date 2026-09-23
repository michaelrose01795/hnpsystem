// file location: src/features/websiteManager/panels/MediaPanel.js
// Website media library — upload new assets, replace existing images, and
// remove unused media. Assets uploaded here are what the "Choose from Media"
// dropdown offers on every image field across the manager, so this is where a
// picture enters the site before it is placed on a section.
import React, { useMemo, useState } from "react";
import Section from "@/components/Section";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { formatDateTime, formatSize } from "../helpers";

const MAX_FILE_BYTES = 3 * 1024 * 1024;

// Data URLs remain valid after the browser session ends, unlike object URLs.
function fileToAsset(file) {
  if (file.size > MAX_FILE_BYTES) {
    return Promise.reject(new Error(`${file.name} is larger than the 3 MB upload limit.`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.onload = () =>
      resolve({
        name: file.name,
        url: String(reader.result || ""),
        type: file.type.startsWith("image/") ? "image" : "document",
        sizeKb: file.size / 1024,
      });
    reader.readAsDataURL(file);
  });
}

function Thumbnail({ asset }) {
  if (asset.url && asset.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="website-manager__media-thumb" src={asset.url} alt={asset.name} />
    );
  }
  const ext = (asset.name.split(".").pop() || "file").toUpperCase();
  return (
    <LayerSurface
      className="website-manager__media-placeholder"
      padding="0"
      gap="0"
      radius="var(--radius-sm)"
    >
      <span className="app-badge app-badge--accent-soft app-badge--uppercase">{ext}</span>
    </LayerSurface>
  );
}

export default function MediaPanel({
  media,
  onAddMedia,
  onReplaceMedia,
  onDeleteMedia,
}) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return media;
    return media.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.usedOn || "").toLowerCase().includes(q)
    );
  }, [media, query]);

  const handleUpload = async (fileList) => {
    setMessage("");
    setFailed(false);
    try {
      const assets = await Promise.all(Array.from(fileList || []).map(fileToAsset));
      assets.forEach(onAddMedia);
      setMessage(
        `${assets.length} file${assets.length === 1 ? "" : "s"} added to the media library.`
      );
    } catch (error) {
      setFailed(true);
      setMessage(error.message);
    }
  };

  const handleReplace = async (mediaId, fileList) => {
    const file = fileList && fileList[0];
    if (!file) return;
    setMessage("");
    setFailed(false);
    try {
      onReplaceMedia(mediaId, await fileToAsset(file));
      setMessage(`${file.name} replaced the selected asset.`);
    } catch (error) {
      setFailed(true);
      setMessage(error.message);
    }
  };

  const handleDelete = (asset) => {
    if (window.confirm(`Delete media asset "${asset.name}"? This cannot be undone.`)) {
      onDeleteMedia(asset.id);
    }
  };

  return (
    <>
      <Section title="Upload media">
        <LayerTheme gap="var(--space-3)">
          {/* Label-wrapped input keeps the native file picker without extra refs. */}
          <div className="website-manager__actions">
            <label className="app-btn app-btn--primary website-manager__file-label">
              Choose files to upload
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  handleUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="website-manager__meta">
              JPG, PNG, WebP or PDF · 3 MB maximum
            </span>
          </div>
          {message && (
            <div
              className={`website-manager__notice${
                failed ? " website-manager__notice--warning" : ""
              }`}
              role={failed ? "alert" : "status"}
            >
              {message}
            </div>
          )}
        </LayerTheme>
      </Section>

      <Section title="Media library">
        <div className="website-manager__toolbar">
          <input
            className="app-input"
            type="search"
            placeholder="Search media by name or page…"
            aria-label="Search media"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            variant="bare"
            role="status"
            title={media.length === 0 ? "No media yet" : "No media matches your search"}
            description={
              media.length === 0
                ? "Upload an image or PDF above and it becomes available on every image field in the manager."
                : "Clear the search box to see the whole library."
            }
          />
        ) : (
          <div className="website-manager__media-grid">
            {filtered.map((asset) => (
              <LayerTheme key={asset.id} className="website-manager__media-card">
                <Thumbnail asset={asset} />
                <span className="website-manager__media-name">{asset.name}</span>
                <span className="website-manager__meta">
                  {asset.type === "image" ? "Image" : "Document"} · {formatSize(asset.sizeKb)}
                </span>
                <span className="website-manager__meta">
                  Used on: {asset.usedOn || "Unassigned"}
                </span>
                <span className="website-manager__meta">
                  {asset.uploadedBy
                    ? `By ${asset.uploadedBy} · ${formatDateTime(asset.uploadedAt)}`
                    : "Live website asset"}
                </span>
                <div className="website-manager__media-actions">
                  <label className="app-btn app-btn--secondary app-btn--sm website-manager__file-label">
                    Replace
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        handleReplace(asset.id, e.target.files);
                        e.target.value = "";
                      }}
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
