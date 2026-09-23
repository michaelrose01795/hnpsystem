// file location: src/components/NewsFeed/NewsAttachments.js
//
// Attachment rows on a post, plus the removable variant the composer uses.
//
// Every download goes through /api/news/attachments/:id — the storage bucket is
// private, so there is no public URL to leak. Images render a thumbnail from
// the same guarded route.
//
// Layout: one uniform row per file — a short file-type tag, the name, then the
// size — laid out on a responsive grid so a list of attachments reads as a
// tidy block rather than a wrapped run of pills. The type is spelled out
// (PDF / TXT / JPG) instead of an emoji glyph so the rows stay legible at
// caption size and match the rest of the staff UI.

import React from "react";
import Button from "@/components/ui/Button";
import { formatFileSize } from "@/lib/news/format";

// Short uppercase tag for the file — the extension when the name has a usable
// one, otherwise the mime subtype, otherwise a generic "FILE".
const tagFor = (fileName = "", mimeType = "") => {
  const extension = fileName.includes(".") ? fileName.split(".").pop().trim() : "";
  if (extension && extension.length <= 4 && /^[a-z0-9]+$/i.test(extension)) {
    return extension.toUpperCase();
  }

  const subtype = mimeType.split("/")[1] || "";
  if (subtype.includes("spreadsheet") || subtype.includes("excel")) return "XLS";
  if (subtype.includes("word") || subtype.includes("document")) return "DOC";
  if (subtype && subtype.length <= 4) return subtype.toUpperCase();

  const type = mimeType.split("/")[0];
  if (type === "image") return "IMG";
  if (type === "video") return "VID";
  if (type === "audio") return "AUD";
  return "FILE";
};

export default function NewsAttachments({
  attachments = [],
  showThumbnails = true,
  onRemove = null,
  removingId = null,
}) {
  if (!attachments.length) return null;

  return (
    <ul className="app-news-attachments">
      {attachments.map((attachment) => {
        const withThumb = showThumbnails && attachment.isImage;
        const size = formatFileSize(attachment.sizeBytes);

        return (
          <li key={attachment.id} className="app-news-attachment-row">
            <a
              className="app-news-attachment"
              href={attachment.downloadUrl}
              target="_blank"
              rel="noreferrer"
              title={`${attachment.fileName} (${size})`}
            >
              {withThumb ? (
                <img
                  className="app-news-attachment-thumb"
                  src={attachment.downloadUrl}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span className="app-news-attachment__tag" aria-hidden="true">
                  {tagFor(attachment.fileName, attachment.mimeType)}
                </span>
              )}

              <span className="app-news-attachment__text">
                <span className="app-news-attachment__name">{attachment.fileName}</span>
                <span className="app-news-attachment__size">{size}</span>
              </span>

              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="app-news-attachment__remove"
                  busy={removingId === attachment.id}
                  onClick={(event) => {
                    // The whole row is the download link, so the remove control
                    // has to stop the click before it navigates.
                    event.preventDefault();
                    event.stopPropagation();
                    onRemove(attachment);
                  }}
                  aria-label={`Remove ${attachment.fileName}`}
                >
                  ×
                </Button>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
