// file location: src/components/NewsFeed/NewsAttachments.js
//
// Attachment rows on a post, plus the removable variant the composer uses.
//
// Every download goes through /api/news/attachments/:id — the storage bucket is
// private, so there is no public URL to leak. Images render a thumbnail from
// the same guarded route.

import React from "react";
import Button from "@/components/ui/Button";
import { formatFileSize } from "@/lib/news/format";

const iconFor = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "🖼";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎧";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") {
    return "📊";
  }
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  return "📎";
};

export default function NewsAttachments({
  attachments = [],
  showThumbnails = true,
  onRemove = null,
  removingId = null,
}) {
  if (!attachments.length) return null;

  return (
    <div className="app-news-attachments">
      {attachments.map((attachment) =>
        showThumbnails && attachment.isImage ? (
          <a
            key={attachment.id}
            className="app-news-attachment"
            href={attachment.downloadUrl}
            target="_blank"
            rel="noreferrer"
            title={`${attachment.fileName} (${formatFileSize(attachment.sizeBytes)})`}
          >
            <img
              className="app-news-attachment-thumb"
              src={attachment.downloadUrl}
              alt={attachment.fileName}
              loading="lazy"
            />
            <span className="app-news-attachment__name">{attachment.fileName}</span>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                busy={removingId === attachment.id}
                onClick={(event) => {
                  event.preventDefault();
                  onRemove(attachment);
                }}
                aria-label={`Remove ${attachment.fileName}`}
              >
                ×
              </Button>
            )}
          </a>
        ) : (
          <span key={attachment.id} className="app-news-attachment">
            <span aria-hidden="true">{iconFor(attachment.mimeType)}</span>
            <a
              className="app-news-attachment__name"
              href={attachment.downloadUrl}
              target="_blank"
              rel="noreferrer"
            >
              {attachment.fileName}
            </a>
            <span className="app-news-attachment__size">
              {formatFileSize(attachment.sizeBytes)}
            </span>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                busy={removingId === attachment.id}
                onClick={() => onRemove(attachment)}
                aria-label={`Remove ${attachment.fileName}`}
              >
                ×
              </Button>
            )}
          </span>
        )
      )}
    </div>
  );
}
