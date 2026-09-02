// file location: src/components/NewsFeed/NewsPostCard.js
//
// One post in the feed.
//
// The card is a <LayerTheme> — the second rung of the surface ladder, sitting
// on the page card. Everything nested inside it (attachments, links, the
// acknowledgement banner) flips back to --surface, which is what
// src/styles/families/news.css does for those pieces.
//
// Density: "comfortable" and "compact" differ in padding, gap and how much of
// the body is shown. The padding/gap come through LayerTheme's props rather
// than a stylesheet override, because the primitive owns the surface.

import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import ReactionBar from "@/components/ui/ReactionBar";
import NewsAvatar from "./NewsAvatar";
import NewsChipRow from "./NewsChips";
import NewsBodyText from "./NewsBodyText";
import NewsAttachments from "./NewsAttachments";
import NewsRecordLinks from "./NewsRecordLinks";
import { DENSITY_COMPACT } from "@/lib/news/constants";
import {
  formatAuthorName,
  formatAuthorRole,
  formatDueLabel,
  formatPostDate,
} from "@/lib/news/format";

const DENSITY = {
  comfortable: {
    radius: "var(--radius-sm)",
    padding: "var(--space-5) var(--space-lg) var(--space-4)",
    gap: "var(--space-2)",
  },
  compact: {
    radius: "var(--radius-sm)",
    padding: "var(--space-3) var(--space-md)",
    gap: "var(--space-1)",
  },
};

// The banner tone is decided by where the reader stands, not by the post: done,
// overdue, due soon, or simply outstanding.
const ackTone = (post) => {
  if (post.isAcknowledged) return "app-news-ack--done";
  if (post.ackDueAt && new Date(post.ackDueAt).getTime() < Date.now()) {
    return "app-news-ack--overdue";
  }
  if (post.ackDueAt) return "app-news-ack--due";
  return "";
};

export default function NewsPostCard({
  post,
  currentUserId,
  density = "comfortable",
  reactions = [],
  myReactions = [],
  canPin = false,
  canEdit = false,
  canDelete = false,
  onOpen,
  onToggleRead,
  onToggleSave,
  onAcknowledge,
  onTogglePin,
  onEdit,
  onDelete,
  onReact,
  busyAction = null,
}) {
  if (!post) return null;

  const isCompact = density === DENSITY_COMPACT;
  const layer = isCompact ? DENSITY.compact : DENSITY.comfortable;
  const dates = formatPostDate(post.publishedAt || post.createdAt);
  const authorName = formatAuthorName(post.authorUser?.name || post.author);
  const authorRole =
    post.authorUser?.jobTitle || formatAuthorRole(post.author) || post.authorUser?.role || "";

  const cardClasses = [
    "app-news-card",
    isCompact ? "app-news-card--compact" : "",
    post.isRead ? "" : "app-news-card--unread",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <LayerTheme
      as="article"
      className={cardClasses}
      radius={layer.radius}
      padding={layer.padding}
      gap={layer.gap}
      aria-label={post.title}
    >
      <div className="app-news-card__head">
        <div className="app-news-card__headings">
          <h2 className="app-news-card__title">
            {!post.isRead && (
              <>
                <span className="app-news-dot" aria-hidden="true" />{" "}
                <span className="app-news-sr-only">Unread. </span>
              </>
            )}
            {post.title}
          </h2>
          <NewsChipRow post={post} />
        </div>

        <div className="app-news-card__actions">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onToggleSave?.(post)}
            busy={busyAction === "save"}
            aria-pressed={post.isSaved}
            aria-label={post.isSaved ? "Remove from saved" : "Save this update"}
            title={post.isSaved ? "Remove from saved" : "Save this update"}
          >
            {post.isSaved ? "★" : "☆"}
          </Button>
          <ReactionBar
            label="React to this update"
            selected={myReactions}
            onReact={(emoji) => onReact?.(post, emoji)}
          />
        </div>
      </div>

      <NewsBodyText
        body={post.content}
        currentUserId={currentUserId}
        clamped={isCompact || post.content.length > 600}
      />

      {post.links.length > 0 && <NewsRecordLinks links={post.links} />}

      {!isCompact && post.attachments.length > 0 && (
        <NewsAttachments attachments={post.attachments} />
      )}

      {post.requiresAck && (
        <div className={`app-news-ack ${ackTone(post)}`.trim()}>
          <span className="app-news-ack__text">
            {post.isAcknowledged
              ? "You have acknowledged this update."
              : "This update needs your acknowledgement."}
            {post.ackDueAt && !post.isAcknowledged ? ` ${formatDueLabel(post.ackDueAt)}.` : ""}
          </span>
          {!post.isAcknowledged && (
            <span className="app-news-ack__actions">
              <Button
                type="button"
                variant="primary"
                size="sm"
                busy={busyAction === "acknowledge"}
                onClick={() => onAcknowledge?.(post)}
              >
                I have read this
              </Button>
            </span>
          )}
        </div>
      )}

      <div className="app-news-card__footer">
        <span className="app-news-byline">
          <NewsAvatar user={post.authorUser} name={post.author} size="sm" />
          <span className="app-news-byline__text">
            <span className="app-news-byline__name">{authorName}</span>
            <span className="app-news-byline__meta" title={dates.absolute}>
              {authorRole ? `${authorRole} · ` : ""}
              {dates.short}
              {post.editCount > 0 ? " · edited" : ""}
            </span>
          </span>
        </span>

        <span className="app-news-card__footer-end">
          <Button type="button" variant="ghost" size="xs" onClick={() => onOpen?.(post)}>
            {post.commentCount > 0
              ? `Comments (${post.commentCount})`
              : reactions.length > 0
                ? `Open · ${reactions.length} reactions`
                : "Open"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="xs"
            busy={busyAction === "read"}
            onClick={() => onToggleRead?.(post)}
          >
            {post.isRead ? "Mark unread" : "Mark read"}
          </Button>

          {canPin && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              busy={busyAction === "pin"}
              onClick={() => onTogglePin?.(post)}
              aria-pressed={post.isPinned}
            >
              {post.isPinned ? "Unpin" : "Pin"}
            </Button>
          )}

          {canEdit && (
            <Button type="button" variant="ghost" size="xs" onClick={() => onEdit?.(post)}>
              Edit
            </Button>
          )}

          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              busy={busyAction === "delete"}
              onClick={() => onDelete?.(post)}
            >
              Delete
            </Button>
          )}
        </span>
      </div>
    </LayerTheme>
  );
}
