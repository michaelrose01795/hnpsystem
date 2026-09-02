// file location: src/components/NewsFeed/NewsCommentThread.js
//
// The comment thread on a post: one level of replies, live-updating through
// the shared Supabase realtime subscription, with @mention support in both the
// composer and the rendered bodies.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonBlock } from "@/components/ui/LoadingSkeleton";
import NewsAvatar from "./NewsAvatar";
import NewsBodyText from "./NewsBodyText";
import MentionTextarea from "./MentionTextarea";
import { subscribeToComments } from "@/lib/database/newsFeed/comments";
import {
  createComment,
  deleteComment,
  fetchComments,
  updateComment,
} from "@/lib/api/news";
import { formatPostDate } from "@/lib/news/format";
import { logFailure } from "@/lib/utils/logFailure";

function CommentRow({
  comment,
  currentUserId,
  canModerate,
  onReply,
  onEdited,
  onDeleted,
  depth = 0,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);

  const isMine = String(comment.userId) === String(currentUserId);
  const dates = formatPostDate(comment.createdAt);

  const save = async () => {
    setBusy(true);
    try {
      const updated = await updateComment(comment.id, draft);
      onEdited?.(updated);
      setEditing(false);
    } catch (error) {
      logFailure("Failed to save the comment:", error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteComment(comment.id);
      onDeleted?.(comment);
    } catch (error) {
      logFailure("Failed to delete the comment:", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-news-comment">
      <NewsAvatar user={comment.author} size="sm" />
      <div className="app-news-comment__main">
        <div className="app-news-comment__meta">
          <span className="app-news-comment__author">{comment.author?.name || "Unknown user"}</span>
          <span title={dates.absolute}>{dates.short}</span>
          {comment.isEdited && !comment.isDeleted && <span>edited</span>}
        </div>

        {comment.isDeleted ? (
          <p className="app-news-comment__body app-news-comment__body--deleted">
            This comment was removed.
          </p>
        ) : editing ? (
          <>
            <MentionTextarea
              id={`comment-edit-${comment.id}`}
              value={draft}
              onChange={setDraft}
              rows={3}
              ariaLabel="Edit your comment"
            />
            <div className="app-news-comment__actions">
              <Button type="button" variant="primary" size="xs" busy={busy} onClick={save}>
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                disabled={busy}
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <NewsBodyText
            body={comment.body}
            currentUserId={currentUserId}
            className="app-news-comment__body"
          />
        )}

        {!comment.isDeleted && !editing && (
          <div className="app-news-comment__actions">
            {depth === 0 && (
              <Button type="button" variant="ghost" size="xs" onClick={() => onReply?.(comment)}>
                Reply
              </Button>
            )}
            {isMine && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            )}
            {(isMine || canModerate) && (
              <Button type="button" variant="ghost" size="xs" busy={busy} onClick={remove}>
                Delete
              </Button>
            )}
          </div>
        )}

        {comment.replies?.length > 0 && (
          <div className="app-news-comment__replies">
            {comment.replies.map((reply) => (
              <CommentRow
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                canModerate={canModerate}
                onEdited={onEdited}
                onDeleted={onDeleted}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewsCommentThread({ postId, currentUserId, canModerate = false }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!postId) return;
    try {
      const rows = await fetchComments(postId);
      setComments(Array.isArray(rows) ? rows : []);
    } catch (loadError) {
      logFailure("Failed to load comments:", loadError);
      setError("We could not load the comments. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    setLoading(true);
    void load();
    // Somebody else commenting is a write to news_comments, which lands here.
    return subscribeToComments(postId, () => {
      void load();
    });
  }, [load, postId]);

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setError("");
    try {
      await createComment(postId, { body, parentId: replyTo?.id || null });
      setDraft("");
      setReplyTo(null);
      await load();
    } catch (submitError) {
      logFailure("Failed to post the comment:", submitError);
      setError(submitError.message || "We could not post your comment.");
    } finally {
      setPosting(false);
    }
  };

  const total = useMemo(
    () =>
      comments.reduce(
        (sum, comment) => sum + (comment.isDeleted ? 0 : 1) + (comment.replies?.length || 0),
        0
      ),
    [comments]
  );

  return (
    <div className="app-news-comments">
      <p className="app-news-composer__hint">
        {total === 0 ? "No comments yet" : `${total} ${total === 1 ? "comment" : "comments"}`}
      </p>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SkeletonBlock width="60%" height="12px" />
          <SkeletonBlock width="90%" height="12px" />
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon="💬"
          title="No comments yet"
          description="Start the conversation — mention a colleague with @ to bring them in."
        />
      ) : (
        comments.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            canModerate={canModerate}
            onReply={setReplyTo}
            onEdited={load}
            onDeleted={load}
          />
        ))
      )}

      <div className="app-news-composer__field">
        {replyTo && (
          <span className="app-news-composer__hint">
            {`Replying to ${replyTo.author?.name || "a comment"} · `}
            <Button type="button" variant="ghost" size="xs" onClick={() => setReplyTo(null)}>
              Cancel reply
            </Button>
          </span>
        )}
        <MentionTextarea
          id={`comment-new-${postId}`}
          value={draft}
          onChange={setDraft}
          rows={3}
          placeholder="Add a comment — type @ to mention a colleague"
          ariaLabel="Add a comment"
        />
        {error && (
          <div className="app-status-message app-status-message--danger" role="alert">
            {error}
          </div>
        )}
        <div className="app-news-comment__actions">
          <Button
            type="button"
            variant="primary"
            size="sm"
            busy={posting}
            disabled={!draft.trim()}
            onClick={submit}
          >
            {replyTo ? "Post reply" : "Post comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
