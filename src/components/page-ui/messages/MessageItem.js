// file location: src/components/page-ui/messages/MessageItem.js
//
// One message in a transcript: sender line, bubble, reactions and the actions
// that open when the message is clicked (or tapped).
//
//   bubble variants   peer (--surface) · mine (accent) · external (written by a
//                     customer, warning tint) · deleted
//   inside a bubble   reply quote, body, task / reminder card, leave request,
//                     attachments, footer (edited)
//   actions           a toolbar floated above the message — top left for a
//                     received message, top right for your own — holding the
//                     react button (the reactions slide open from it), reply,
//                     pin/unpin and more (copy, edit, delete). The controls
//                     are 32px circles in a 44px strip.
//
// Status / priority / owner changes posted by slash commands are rendered as a
// centred event line instead of a bubble.
//
// No avatars or initials: the sender is named in the meta line.

import React, { useCallback, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import SymbolButton from "@/components/ui/SymbolButton";
import NewsAttachments from "@/components/NewsFeed/NewsAttachments";
import MessageContent from "@/components/page-ui/messages/MessageContent";
import FloatingLayer from "@/components/page-ui/messages/FloatingLayer";
import ReactionBar from "@/components/ui/ReactionBar";
import { buildAttachmentUrl } from "@/lib/api/messages";
import { formatClock, formatDueLabel } from "@/lib/messages/conversationModel";

const toAttachmentRows = (threadId, attachments = []) =>
  attachments.map((file) => ({
    id: file.path,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    isImage: Boolean(file.isImage),
    downloadUrl: buildAttachmentUrl(threadId, file.path),
  }));

function LeaveRequestBlock({ meta, canDecide, busy, onApprove, onDecline }) {
  const status = String(meta?.status || "Pending").trim();
  const key = status.toLowerCase();
  const tone = key === "approved" ? "success" : key === "declined" ? "danger" : "warning";
  return (
    <div className="app-msg-card">
      <div className="app-msg-card__head">
        <span className="app-msg-tag">Leave request</span>
        <span className={`app-msg-tag app-msg-tag--${tone}`}>{status}</span>
      </div>
      <p className="app-msg-card__text">
        {meta.leaveType || "Leave"} · {meta.startDate || ""}
        {meta.endDate && meta.endDate !== meta.startDate ? ` to ${meta.endDate}` : ""}
      </p>
      {meta.requestNotes ? <span className="app-msg-muted">{meta.requestNotes}</span> : null}
      {meta.declineReason ? (
        <span className="app-msg-tag app-msg-tag--danger">Decline reason: {meta.declineReason}</span>
      ) : null}
      {canDecide ? (
        <div className="app-msg-card__foot">
          <Button type="button" variant="primary" pill disabled={busy} onClick={onApprove}>
            Approve
          </Button>
          <Button type="button" variant="danger" pill disabled={busy} onClick={onDecline}>
            Decline
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ActionCard({ kind, data, busy, onToggle }) {
  const done = data?.status === "done";
  const isReminder = kind === "reminder";
  const overdue = isReminder && !done && data?.dueAt && new Date(data.dueAt).getTime() < Date.now();
  const doneBy = data?.completedBy?.byName;
  return (
    <div className={`app-msg-card${done ? " app-msg-card--done" : ""}`}>
      <div className="app-msg-card__head">
        <span className="app-msg-tag app-msg-tag--accent">{isReminder ? "Reminder" : "Task"}</span>
        <span className={`app-msg-tag${done ? " app-msg-tag--success" : overdue ? " app-msg-tag--danger" : ""}`}>
          {done ? "Done" : overdue ? "Overdue" : "Open"}
        </span>
      </div>
      <p className="app-msg-card__text">{data?.text}</p>
      <div className="app-msg-card__foot">
        <span className="app-msg-muted">
          {isReminder && data?.dueAt ? `Due ${formatDueLabel(data.dueAt)}` : null}
          {done && doneBy ? `${isReminder && data?.dueAt ? " · " : ""}Done by ${doneBy}` : null}
        </span>
        <Button
          type="button"
          variant={done ? "secondary" : "primary"}
          pill
          symbol={false}
          disabled={busy}
          onClick={onToggle}
        >
          {done ? "Reopen" : "Mark done"}
        </Button>
      </div>
    </div>
  );
}

export default function MessageItem({
  message,
  threadId,
  isMine,
  isExternal,
  showMeta,
  senderLabel,
  senderRole,
  roles = [],
  currentUserId,
  reactions = [],
  onReact,
  onAction,
  onJumpTo,
  actionBusy = false,
  receipt = null,
  highlighted = false,
  readOnly = false,
  leave = {},
  registerRef,
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bubbleRef = useRef(null);
  const moreRef = useRef(null);
  const meta = message.metadata || {};
  const isDeleted = Boolean(meta.deleted);

  const closeAll = useCallback(() => {
    setOpen(false);
    setMenuOpen(false);
  }, []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const setRootRef = (node) => registerRef?.(message.id, node);

  if (meta.event) {
    return (
      <div className="app-msg-event" ref={setRootRef} data-message-id={message.id}>
        {senderLabel ? `${senderLabel} · ` : ""}
        {message.content} · {formatClock(message.createdAt)}
      </div>
    );
  }

  const counts = reactions.reduce((acc, entry) => {
    acc[entry.emoji] = (acc[entry.emoji] || 0) + 1;
    return acc;
  }, {});
  const myReaction =
    reactions.find((entry) => String(entry.userId) === String(currentUserId))?.emoji || null;

  const leaveMeta = meta.leaveRequest && meta.leaveRequest.absenceId ? meta.leaveRequest : null;
  const canDecideLeave =
    Boolean(leaveMeta) &&
    Array.isArray(leaveMeta.managerIds) &&
    leaveMeta.managerIds.includes(currentUserId) &&
    String(leaveMeta.status || "").toLowerCase() === "pending";

  const attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
  const bubbleClass = [
    "app-msg-bubble",
    isDeleted ? "app-msg-bubble--deleted" : isMine ? "app-msg-bubble--mine" : isExternal ? "app-msg-bubble--external" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const canAct = !readOnly && !isDeleted;
  // Received messages open their actions above and to the left, your own
  // above and to the right: the toolbar lines up with the bubble's side.
  const align = isMine ? "end" : "start";

  const act = (action) => {
    closeAll();
    onAction?.(message, action);
  };

  const copyText = async () => {
    closeAll();
    try {
      await navigator.clipboard?.writeText(message.content || "");
    } catch {
      // Clipboard can be blocked (http, permissions); nothing else to do.
    }
  };

  const toggleActions = () => {
    if (!canAct) return;
    setMenuOpen(false);
    setOpen((value) => !value);
  };

  return (
    <div
      ref={setRootRef}
      data-message-id={message.id}
      className={[
        "app-msg-item",
        isMine ? "app-msg-item--mine" : "",
        showMeta ? "app-msg-item--first" : "",
        open ? "is-actions-open" : "",
        highlighted ? "is-highlighted" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showMeta && (
        <div className="app-msg-item__meta">
          {!isMine && <span className="app-msg-item__sender">{senderLabel}</span>}
          {!isMine && senderRole ? <span className="app-msg-item__role">{senderRole}</span> : null}
          <span>{formatClock(message.createdAt)}</span>
        </div>
      )}

      <div className="app-msg-item__row">
        <div
          ref={bubbleRef}
          className={bubbleClass}
          onClick={toggleActions}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
              event.preventDefault();
              toggleActions();
            }
          }}
          tabIndex={0}
          role={canAct ? "button" : undefined}
          aria-haspopup={canAct ? "true" : undefined}
          aria-expanded={canAct ? open : undefined}
          aria-label={`Message from ${isMine ? "you" : senderLabel} at ${formatClock(message.createdAt)}${canAct ? ". Press to react or reply" : ""}`}
        >
          {meta.replyTo && !isDeleted ? (
            <div
              className="app-msg-quote"
              role="link"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onJumpTo?.(meta.replyTo.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.stopPropagation();
                  onJumpTo?.(meta.replyTo.id);
                }
              }}
            >
              <span className="app-msg-quote__author">Replying to {meta.replyTo.senderName || "message"}</span>
              <span className="app-msg-quote__text">{String(meta.replyTo.contentSnippet || "")}</span>
            </div>
          ) : null}

          {meta.task && !isDeleted ? (
            <ActionCard
              kind="task"
              data={meta.task}
              busy={actionBusy}
              onToggle={(event) => {
                event.stopPropagation();
                act(meta.task.status === "done" ? "task-reopen" : "task-done");
              }}
            />
          ) : meta.reminder && !isDeleted ? (
            <ActionCard
              kind="reminder"
              data={meta.reminder}
              busy={actionBusy}
              onToggle={(event) => {
                event.stopPropagation();
                act(meta.reminder.status === "done" ? "reminder-reopen" : "reminder-done");
              }}
            />
          ) : meta.attachmentsOnly && !isDeleted ? null : (
            <MessageContent content={message.content} roles={roles} currentUserId={currentUserId} />
          )}

          {leaveMeta && !isDeleted ? (
            <LeaveRequestBlock
              meta={leaveMeta}
              canDecide={canDecideLeave}
              busy={leave.busy}
              onApprove={(event) => {
                event?.stopPropagation?.();
                leave.onApprove?.(message);
              }}
              onDecline={(event) => {
                event?.stopPropagation?.();
                leave.onDecline?.(message);
              }}
            />
          ) : null}

          {attachments.length && !isDeleted ? (
            <div onClick={(event) => event.stopPropagation()}>
              <NewsAttachments attachments={toAttachmentRows(threadId, attachments)} />
            </div>
          ) : null}

          {/* Pinned messages are listed in the details panel; the bubble
              itself only says when it has been edited. */}
          {!isDeleted && meta.editedAt ? (
            <div className="app-msg-bubble__footer">
              <span>Edited</span>
            </div>
          ) : null}
        </div>
      </div>

      {open && canAct && (
        <FloatingLayer
          anchorRef={bubbleRef}
          align={align}
          placement="above"
          onClose={closeAll}
          className="app-msg-toolbar"
          role="toolbar"
          aria-label="Message actions"
        >
          {/* The shared react control: only the button shows until it is
              pressed, then the six reactions slide open out of it. */}
          <ReactionBar
            selected={myReaction ? [myReaction] : []}
            onReact={(emoji) => {
              onReact?.(emoji);
              closeAll();
            }}
          />
          <SymbolButton symbol="reply" label="Reply" className="app-symbol-btn--table" onClick={() => act("reply-start")} />
          <SymbolButton
            symbol="pin"
            className="app-symbol-btn--table"
            label={meta.pinned ? "Unpin message" : "Pin message"}
            aria-pressed={Boolean(meta.pinned)}
            disabled={actionBusy}
            onClick={() => act(meta.pinned ? "unpin" : "pin")}
          />
          <span ref={moreRef} className="app-msg-anchor">
            <SymbolButton
              symbol="more"
              className="app-symbol-btn--table"
              label="More message actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            />
          </span>
        </FloatingLayer>
      )}

      {open && menuOpen && (
        <FloatingLayer
          anchorRef={moreRef}
          align={align}
          placement="above"
          onClose={closeMenu}
          className="app-msg-menu"
          role="menu"
          aria-label="More message actions"
        >
          <Button type="button" variant="secondary" symbol={false} role="menuitem" onClick={copyText}>
            Copy text
          </Button>
          {isMine && (
            <Button type="button" variant="secondary" symbol={false} role="menuitem" onClick={() => act("edit-start")}>
              Edit message
            </Button>
          )}
          {isMine && (
            <Button type="button" variant="danger" symbol={false} role="menuitem" onClick={() => act("delete")}>
              Delete message
            </Button>
          )}
        </FloatingLayer>
      )}

      {Object.keys(counts).length > 0 && (
        <div className="app-msg-reactions">
          {Object.entries(counts).map(([emoji, count]) => (
            <Button
              key={emoji}
              type="button"
              variant="secondary"
              pill
              symbol={false}
              aria-pressed={myReaction === emoji}
              aria-label={`${emoji} ${count}`}
              onClick={() => onReact?.(emoji)}
            >
              {`${emoji}${count > 1 ? ` ${count}` : ""}`}
            </Button>
          ))}
        </div>
      )}

      {receipt ? <span className="app-msg-receipt">{receipt}</span> : null}
    </div>
  );
}
