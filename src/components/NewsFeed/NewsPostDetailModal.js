// file location: src/components/NewsFeed/NewsPostDetailModal.js
//
// The full view of one post: the whole body, its attachments and DMS links,
// who reacted, the comment thread, and — for the author and management — the
// edit history, the reach figures and the acknowledgement tracker.
//
// Opening this modal is what marks a post read, which is why the read call
// lives with the parent hook rather than here: this component stays a view.

import React, { useCallback, useEffect, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import ReactionSummary from "@/components/ui/ReactionSummary";
import { SkeletonBlock } from "@/components/ui/LoadingSkeleton";
import NewsAvatar from "./NewsAvatar";
import NewsBodyText from "./NewsBodyText";
import NewsChipRow from "./NewsChips";
import NewsAttachments from "./NewsAttachments";
import NewsRecordLinks from "./NewsRecordLinks";
import NewsCommentThread from "./NewsCommentThread";
import NewsInsightsPanel from "./NewsInsightsPanel";
import { fetchPostInsights } from "@/lib/api/news";
import {
  formatAuthorName,
  formatAuthorRole,
  formatDueLabel,
  formatPostDate,
} from "@/lib/news/format";
import { logFailure } from "@/lib/utils/logFailure";

export default function NewsPostDetailModal({
  post,
  isOpen,
  currentUserId,
  reactions = [],
  canModerate = false,
  onClose,
  onAcknowledge,
  onToggleSave,
  busyAction = null,
}) {
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const loadInsights = useCallback(async () => {
    if (!post?.id) return;
    setLoadingInsights(true);
    try {
      const data = await fetchPostInsights(post.id);
      setInsights(data);
    } catch (error) {
      logFailure("Failed to load post insights:", error);
      setInsights(null);
    } finally {
      setLoadingInsights(false);
    }
  }, [post?.id]);

  // Reset the panel between posts so a previous post's figures never flash.
  useEffect(() => {
    setInsights(null);
    setShowInsights(false);
  }, [post?.id]);

  useEffect(() => {
    if (showInsights && !insights && !loadingInsights) void loadInsights();
  }, [insights, loadInsights, loadingInsights, showInsights]);

  if (!post) return null;

  const dates = formatPostDate(post.publishedAt || post.createdAt);
  const authorName = formatAuthorName(post.authorUser?.name || post.author);
  const authorRole =
    post.authorUser?.jobTitle || formatAuthorRole(post.author) || post.authorUser?.role || "";

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={post.title}
      cardStyle={{
        width: "min(100%, 820px)",
        maxHeight: "88vh",
        overflowY: "auto",
        padding: "var(--page-card-padding)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}>
        <header className="app-popup-compact-header">
          <h3>{post.title}</h3>
          <div className="app-popup-compact-header__actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              busy={busyAction === "save"}
              aria-pressed={post.isSaved}
              onClick={() => onToggleSave?.(post)}
            >
              {post.isSaved ? "★ Saved" : "☆ Save"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        <NewsChipRow post={post} />

        <div className="app-news-byline">
          <NewsAvatar user={post.authorUser} name={post.author} size="lg" />
          <span className="app-news-byline__text">
            <span className="app-news-byline__name">{authorName}</span>
            <span className="app-news-byline__meta" title={dates.absolute}>
              {authorRole ? `${authorRole} · ` : ""}
              {dates.absolute} · {dates.relative}
            </span>
            {post.editCount > 0 && (
              <span className="app-news-byline__meta">
                {`Edited ${post.editCount} ${post.editCount === 1 ? "time" : "times"}`}
                {post.editedAt ? ` · last ${formatPostDate(post.editedAt).short}` : ""}
              </span>
            )}
          </span>
        </div>

        {post.requiresAck && (
          <div
            className={`app-news-ack ${
              post.isAcknowledged
                ? "app-news-ack--done"
                : post.ackDueAt && new Date(post.ackDueAt).getTime() < Date.now()
                  ? "app-news-ack--overdue"
                  : "app-news-ack--due"
            }`}
          >
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

        <NewsBodyText body={post.content} currentUserId={currentUserId} />

        {post.links.length > 0 && (
          <div>
            <p className="app-news-composer__hint">Related records</p>
            <NewsRecordLinks links={post.links} />
          </div>
        )}

        {post.attachments.length > 0 && (
          <div>
            <p className="app-news-composer__hint">Attachments</p>
            <NewsAttachments attachments={post.attachments} />
          </div>
        )}

        <LayerTheme gap="var(--space-3)">
          <ReactionSummary reactions={reactions} emptyLabel="No reactions yet." />
        </LayerTheme>

        <LayerTheme gap="var(--space-3)">
          <NewsCommentThread
            postId={post.id}
            currentUserId={currentUserId}
            canModerate={canModerate}
          />
        </LayerTheme>

        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowInsights((open) => !open)}
            aria-expanded={showInsights}
          >
            {showInsights ? "Hide reach & history" : "Reach, acknowledgements & edit history"}
          </Button>
        </div>

        {showInsights &&
          (loadingInsights ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SkeletonBlock width="70%" height="14px" />
              <SkeletonBlock width="100%" height="12px" />
              <SkeletonBlock width="90%" height="12px" />
            </div>
          ) : (
            <NewsInsightsPanel insights={insights} />
          ))}
      </div>
    </PopupModal>
  );
}
