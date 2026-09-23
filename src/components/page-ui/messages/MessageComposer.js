// file location: src/components/page-ui/messages/MessageComposer.js
//
// The bottom-fixed composer of a conversation.
//
//   notices   reply preview · editing · "the customer reads this" · errors
//   tools     attach · emoji · slash commands
//   input     auto-growing textarea; Enter sends, Shift+Enter is a new line
//   menus     "/" opens the DMS command picker, "@" the member picker; both
//             are listboxes driven from the keyboard while the textarea keeps
//             focus (the same pattern as the news hub's MentionTextarea)
//
// It owns only the interaction; drafting state, parsing and sending live in
// the page (src/pages/messages/index.js).

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import SymbolButton from "@/components/ui/SymbolButton";
import StatusMessage from "@/components/ui/StatusMessage";
import { formatFileSize } from "@/lib/news/format";
import { COMMAND_GROUPS, matchSlashCommands } from "@/lib/messages/conversationModel";

const EMOJIS = [
  "👍", "👎", "🙏", "👏", "🙌", "💪", "👀", "✅",
  "❌", "⚠️", "🔥", "🎉", "❤️", "😂", "😊", "😮",
  "😅", "🤔", "😬", "🙂", "🚗", "🔧", "🛠️", "📅",
  "⏰", "📦", "🧾", "📞", "✉️", "💷", "⭐", "🚨",
];

// "/fragment" or "@fragment" immediately before the caret, starting a word.
const SLASH_TRIGGER = /(?:^|\s)\/([a-z]*)$/i;
const MENTION_TRIGGER = /(?:^|\s)@([\p{L}\p{N}'\-.]{0,30})$/u;

const MAX_ROWS_HEIGHT = 180;

export default function MessageComposer({
  draft,
  onDraftChange,
  onSubmit,
  sending = false,
  canSend = false,
  replyTo = null,
  onCancelReply,
  editing = null,
  onCancelEdit,
  pendingAttachments = [],
  uploading = false,
  onAddFiles,
  onRemoveAttachment,
  externalAudience = null,
  commands = [],
  members = [],
  error = "",
  warning = "",
  onOpenHelp,
  placeholder = "Write a message…",
  inputRef: externalRef,
}) {
  const localRef = useRef(null);
  const textareaRef = externalRef || localRef;
  const fileRef = useRef(null);
  const [menu, setMenu] = useState(null); // { kind: "slash" | "mention", query }
  const [activeIndex, setActiveIndex] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // One line sits at the stylesheet's 44px so the box lines up with the send
  // button; longer drafts grow up to a cap, then scroll.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "";
    // An empty box stays one line: the browser counts a wrapped placeholder
    // in scrollHeight, which would otherwise grow it past the send button.
    if (!draft) return;
    const rings = el.offsetHeight - el.clientHeight;
    const needed = el.scrollHeight + rings;
    if (needed > el.offsetHeight) el.style.height = `${Math.min(needed, MAX_ROWS_HEIGHT)}px`;
  }, [draft, textareaRef]);

  const options = useMemo(() => {
    if (!menu) return [];
    if (menu.kind === "slash") return matchSlashCommands(menu.query, commands);
    const term = menu.query.toLowerCase();
    return members
      .filter((member) => String(member.profile?.name || "").toLowerCase().includes(term))
      .slice(0, 8);
  }, [commands, members, menu]);

  useEffect(() => {
    setActiveIndex(0);
  }, [menu?.kind, menu?.query]);

  // The emoji picker closes on any click outside it.
  const emojiRef = useRef(null);
  useEffect(() => {
    if (!emojiOpen) return undefined;
    const close = (event) => {
      if (emojiRef.current?.contains(event.target) || event.target.closest?.("[data-emoji-trigger]")) return;
      setEmojiOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [emojiOpen]);

  const detectMenu = useCallback((value, caret) => {
    const before = value.slice(0, caret);
    const slash = SLASH_TRIGGER.exec(before);
    if (slash) return setMenu({ kind: "slash", query: slash[1] });
    const mention = MENTION_TRIGGER.exec(before);
    if (mention) return setMenu({ kind: "mention", query: mention[1] });
    return setMenu(null);
  }, []);

  const replaceBeforeCaret = useCallback(
    (pattern, replacement) => {
      const el = textareaRef.current;
      const caret = el?.selectionStart ?? draft.length;
      const before = draft.slice(0, caret);
      const match = pattern.exec(before);
      if (!match) return;
      const start = before.length - match[0].length + (/^\s/.test(match[0]) ? 1 : 0);
      const next = `${draft.slice(0, start)}${replacement}${draft.slice(caret)}`;
      onDraftChange(next);
      setMenu(null);
      window.requestAnimationFrame(() => {
        const position = start + replacement.length;
        el?.focus();
        el?.setSelectionRange(position, position);
      });
    },
    [draft, onDraftChange, textareaRef]
  );

  const choose = useCallback(
    (option) => {
      if (!option || !menu) return;
      if (menu.kind === "slash") {
        replaceBeforeCaret(SLASH_TRIGGER, option.insert);
      } else {
        replaceBeforeCaret(
          MENTION_TRIGGER,
          `@[${option.profile?.name || "Member"}](u:${option.userId}) `
        );
      }
    },
    [menu, replaceBeforeCaret]
  );

  const insertAtCaret = useCallback(
    (text) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? draft.length;
      const end = el?.selectionEnd ?? draft.length;
      const next = `${draft.slice(0, start)}${text}${draft.slice(end)}`;
      onDraftChange(next);
      window.requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start + text.length, start + text.length);
      });
    },
    [draft, onDraftChange, textareaRef]
  );

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || []);
    // Reset so choosing the same file again still fires a change.
    event.target.value = "";
    if (files.length) onAddFiles?.(files);
  };

  const handleKeyDown = (event) => {
    if (menu && options.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % options.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + options.length) % options.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        choose(options[activeIndex]);
        return;
      }
    }
    if (event.key === "Escape") {
      if (menu || emojiOpen) {
        event.preventDefault();
        setMenu(null);
        setEmojiOpen(false);
        return;
      }
      if (editing) onCancelEdit?.();
      else if (replyTo) onCancelReply?.();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSubmit?.();
    }
  };

  // Group the slash options under their headings, keeping the flat index the
  // keyboard moves through.
  const slashGroups = useMemo(() => {
    if (menu?.kind !== "slash") return [];
    return COMMAND_GROUPS.map((group) => ({
      ...group,
      items: options
        .map((option, index) => ({ option, index }))
        .filter(({ option }) => option.group === group.value),
    })).filter((group) => group.items.length);
  }, [menu?.kind, options]);

  return (
    <form
      className="app-msg-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit?.();
      }}
    >
      {externalAudience && (
        <div className="app-msg-composer__notice app-msg-composer__notice--external" role="note">
          <span>Customer conversation: {externalAudience} will see everything you send here.</span>
        </div>
      )}

      {editing && (
        <div className="app-msg-composer__notice">
          <span className="app-msg-composer__notice-text">
            <strong>Editing your message</strong>
            <span>Enter saves, Escape cancels.</span>
          </span>
          <SymbolButton symbol="close" label="Cancel edit" onClick={onCancelEdit} />
        </div>
      )}

      {replyTo && !editing && (
        <div className="app-msg-composer__notice">
          <span className="app-msg-composer__notice-text">
            <strong>Replying to {replyTo.sender?.name || "message"}</strong>
            <span>{String(replyTo.content || "").slice(0, 160)}</span>
          </span>
          <SymbolButton symbol="close" label="Cancel reply" onClick={onCancelReply} />
        </div>
      )}

      {pendingAttachments.length > 0 && (
        <ul className="app-news-attachments" aria-label="Files to send">
          {pendingAttachments.map((attachment) => (
            <li key={attachment.id} className="app-news-attachment-row">
              <span className="app-news-attachment">
                <span className="app-news-attachment__text">
                  <span className="app-news-attachment__name">{attachment.fileName}</span>
                  <span className="app-news-attachment__size">{formatFileSize(attachment.sizeBytes)}</span>
                </span>
              </span>
              <SymbolButton
                symbol="close"
                label={`Remove ${attachment.fileName}`}
                onClick={() => onRemoveAttachment?.(attachment)}
              />
            </li>
          ))}
        </ul>
      )}

      {warning ? <StatusMessage tone="warning">{warning}</StatusMessage> : null}
      {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}

      <div className="app-msg-composer__row">
        {!editing && (
          <div className="app-msg-composer__tools">
            <input ref={fileRef} type="file" multiple onChange={handleFiles} style={{ display: "none" }} />
            <SymbolButton
              symbol="attach"
              label={uploading ? "Uploading…" : "Attach files"}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            />
            <span className="app-msg-anchor app-msg-composer__optional" data-emoji-trigger="">
              <SymbolButton
                symbol="emoji"
                label="Insert emoji"
                aria-expanded={emojiOpen}
                onClick={() => {
                  setEmojiOpen((value) => !value);
                  setMenu(null);
                }}
              />
            </span>
            <SymbolButton
              symbol="command"
              label="Slash commands"
              className="app-msg-composer__optional"
              onClick={() => {
                if (!draft.endsWith("/")) insertAtCaret(draft && !/\s$/.test(draft) ? " /" : "/");
                setMenu({ kind: "slash", query: "" });
              }}
            />
          </div>
        )}

        <div className="app-msg-composer__field">
          {emojiOpen && (
            <div ref={emojiRef} className="app-msg-popover" role="group" aria-label="Emoji">
              <div className="app-msg-emoji-grid">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="app-btn app-btn--secondary app-reaction-emoji"
                    aria-label={`Insert ${emoji}`}
                    onClick={() => {
                      insertAtCaret(emoji);
                      setEmojiOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {menu && options.length > 0 && (
            <div
              className="app-msg-popover"
              role="listbox"
              aria-label={menu.kind === "slash" ? "Slash commands" : "Mention a member"}
            >
              {/* Options, not buttons: the textarea keeps focus and drives the
                  list with the arrow keys. Pointer users click. */}
              {menu.kind === "slash"
                ? slashGroups.map((group) => (
                    <React.Fragment key={group.value}>
                      <span className="app-msg-popover__group">{group.label}</span>
                      {group.items.map(({ option, index }) => (
                        <div
                          key={option.name}
                          role="option"
                          aria-selected={index === activeIndex}
                          className={`app-msg-option${index === activeIndex ? " is-active" : ""}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => choose(option)}
                        >
                          <span className="app-msg-option__name">{option.syntax}</span>
                          <span className="app-msg-option__description">{option.description}</span>
                        </div>
                      ))}
                    </React.Fragment>
                  ))
                : options.map((member, index) => (
                    <div
                      key={member.userId}
                      role="option"
                      aria-selected={index === activeIndex}
                      className={`app-msg-option${index === activeIndex ? " is-active" : ""}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(member)}
                    >
                      <span className="app-msg-option__name">{member.profile?.name || "Member"}</span>
                      <span className="app-msg-option__description">
                        {member.profile?.jobTitle || member.profile?.role || ""}
                      </span>
                    </div>
                  ))}
              {menu.kind === "slash" && (
                <Button type="button" variant="ghost" symbol={false} onClick={onOpenHelp}>
                  All commands and examples
                </Button>
              )}
            </div>
          )}

          <textarea
            ref={textareaRef}
            id="message-textarea"
            className="app-input app-msg-composer__input"
            rows={1}
            value={draft}
            placeholder={placeholder}
            aria-label="Message"
            title="Type / for DMS commands and @ to mention someone"
            onChange={(event) => {
              onDraftChange(event.target.value);
              detectMenu(event.target.value, event.target.selectionStart ?? event.target.value.length);
            }}
            onKeyDown={handleKeyDown}
            onClick={(event) => detectMenu(draft, event.currentTarget.selectionStart ?? draft.length)}
            onBlur={() => window.setTimeout(() => setMenu(null), 120)}
          />
        </div>

        <Button type="submit" variant="primary" busy={sending} disabled={!canSend} aria-label={editing ? "Save edit" : "Send"}>
          {editing ? "Save" : "Send"}
        </Button>
      </div>
    </form>
  );
}
