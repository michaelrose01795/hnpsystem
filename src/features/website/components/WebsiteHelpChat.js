// file location: src/features/website/components/WebsiteHelpChat.js
//
// The help chat on every /website page: a 44px chat button in the bottom-right
// corner that opens a chat window above it (full screen on a phone).
//
// A visitor first talks to the keyword assistant (features/website/helpChat),
// which opens with five questions for the page they are on. "Chat with the team"
// puts the chat in the staff queue on /messages; once someone joins, the same
// window carries the conversation with them. Every chat is saved and listed
// under History.
//
// Mounted once from src/pages/_app.js for website routes. Every visual style is
// the @family help-chat block in src/styles/custglobal.css; bubbles follow the
// /messages layout (own messages right, others left, a tight tail corner on the
// sending side, sender and time under the bubble).

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import useWebsiteHelpChat from "../hooks/useWebsiteHelpChat";

/* ------------------------------------------------------------------ */
/* Glyphs — stroke follows the control's text colour                   */
/* ------------------------------------------------------------------ */

const Glyph = ({ children }) => (
  <svg className="ws-chat-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);
const ChatGlyph = () => (
  <Glyph>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />
  </Glyph>
);
const CloseGlyph = () => (
  <Glyph>
    <path d="M6 6l12 12M18 6L6 18" />
  </Glyph>
);
const HistoryGlyph = () => (
  <Glyph>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5M12 7v5l3 2" />
  </Glyph>
);
const NewGlyph = () => (
  <Glyph>
    <path d="M12 5v14M5 12h14" />
  </Glyph>
);
const SendGlyph = () => (
  <Glyph>
    <path d="M4 12l16-8-6 16-2.5-6.5L4 12Z" />
  </Glyph>
);

/* ------------------------------------------------------------------ */
/* Copy helpers                                                        */
/* ------------------------------------------------------------------ */

const ordinal = (n) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
};

const formatTime = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const formatDay = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? `Today, ${formatTime(iso)}`
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const STATUS_BADGE = { bot: "Assistant", queued: "Waiting", active: "With the team", closed: "Ended" };

function statusLine(chat) {
  if (!chat) return { tone: "online", text: "Assistant · replies instantly" };
  if (chat.status === "queued") {
    return {
      tone: "waiting",
      text: chat.queuePosition ? `Waiting for the team · ${ordinal(chat.queuePosition)} in the queue` : "Waiting for the team",
    };
  }
  if (chat.status === "active") return { tone: "online", text: `Chatting with ${chat.staffName || "our team"}` };
  if (chat.status === "closed") return { tone: "closed", text: "Chat ended" };
  return { tone: "online", text: "Assistant · replies instantly" };
}

function ChatLink({ link }) {
  const href = String(link?.href || "");
  if (!href || !link.label) return null;
  if (href.startsWith("/")) {
    return (
      <Link href={href} className="ws-chat-link">
        {link.label}
      </Link>
    );
  }
  const external = href.startsWith("http");
  return (
    <a href={href} className="ws-chat-link" target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {link.label}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Widget                                                              */
/* ------------------------------------------------------------------ */

export default function WebsiteHelpChat() {
  const helpChat = useWebsiteHelpChat();
  const { open, view, chat, messages, signedIn, history, busy, error, unread } = helpChat;

  const panelId = useId();
  const titleId = useId();
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [contact, setContact] = useState({ contactName: "", contactEmail: "" });

  const status = chat?.status || "bot";
  const status_ = statusLine(chat);
  const lastMessage = messages[messages.length - 1];
  const suggestions =
    status === "bot" && lastMessage?.author === "assistant" && Array.isArray(lastMessage.suggestions)
      ? lastMessage.suggestions
      : [];

  // Keep the newest message in view.
  useEffect(() => {
    if (!open || view !== "chat" || !bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [open, view, messages.length, handoffOpen]);

  // Escape closes the window; a mouse user lands in the message box.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") helpChat.closePanel();
    };
    document.addEventListener("keydown", onKey);
    if (window.matchMedia?.("(pointer: fine)").matches) inputRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, helpChat.closePanel]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new or different chat starts with the team form folded away.
  useEffect(() => {
    setHandoffOpen(false);
  }, [chat?.id, status]);

  const submitMessage = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    const ok = await helpChat.send(text);
    if (!ok) setDraft(text);
  };

  const askSuggestion = (question) => {
    if (!busy) helpChat.send(question);
  };

  const requestTeam = async () => {
    helpChat.clearError();
    if (signedIn) {
      await helpChat.joinQueue();
      return;
    }
    setHandoffOpen(true);
  };

  const submitHandoff = async (event) => {
    event.preventDefault();
    const ok = await helpChat.joinQueue(contact);
    if (ok) setHandoffOpen(false);
  };

  return (
    <div className="ws-chat" data-open={open ? "true" : "false"}>
      {open ? (
        <section id={panelId} className="ws-chat-panel" role="dialog" aria-labelledby={titleId}>
          <header className="ws-chat-header">
            <div className="ws-chat-header__text">
              <h2 id={titleId} className="ws-chat-title">
                {view === "history" ? "Your chats" : "Chat with us"}
              </h2>
              <p className="ws-chat-status">
                <span className="ws-chat-status__dot" data-tone={status_.tone} aria-hidden="true" />
                {view === "history" ? "Saved on this device and your account" : status_.text}
              </p>
            </div>
            <div className="ws-chat-header__actions">
              <button
                type="button"
                className="ws-chat-icon-btn"
                aria-label={view === "history" ? "Back to chat" : "Chat history"}
                aria-pressed={view === "history"}
                onClick={view === "history" && chat ? helpChat.backToChat : helpChat.showHistory}
              >
                <HistoryGlyph />
              </button>
              <button type="button" className="ws-chat-icon-btn" aria-label="Start a new chat" onClick={helpChat.newChat} disabled={busy}>
                <NewGlyph />
              </button>
              <button type="button" className="ws-chat-close" aria-label="Close chat" onClick={helpChat.closePanel}>
                <CloseGlyph />
              </button>
            </div>
          </header>

          {view === "chat" && status === "queued" ? (
            <div className="ws-chat-queue">
              <p className="ws-chat-queue__text">
                {chat?.queuePosition ? `You're ${ordinal(chat.queuePosition)} in the queue. ` : ""}
                A member of our team will join this chat shortly.
              </p>
              <button type="button" className="ws-chat-queue__leave" onClick={helpChat.endChat} disabled={busy}>
                Leave
              </button>
            </div>
          ) : null}

          {view === "history" ? (
            <div className="ws-chat-body" ref={bodyRef}>
              {history.loading ? (
                <p className="ws-chat-empty">Loading your chats…</p>
              ) : history.chats.length ? (
                <ul className="ws-chat-history">
                  {history.chats.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="ws-chat-history-item"
                        aria-current={chat?.id === item.id ? "true" : undefined}
                        onClick={() => helpChat.pickChat(item.id)}
                      >
                        <span className="ws-chat-history-item__title">{item.title}</span>
                        <span className="ws-chat-history-item__meta">
                          <span className="ws-chat-badge" data-status={item.status}>
                            {STATUS_BADGE[item.status] || item.status}
                          </span>
                          {formatDay(item.updatedAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ws-chat-empty">No saved chats yet.</p>
              )}
              {error ? (
                <p className="ws-chat-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="ws-chat-body" ref={bodyRef}>
              <div className="ws-chat-feed" role="log" aria-live="polite" aria-relevant="additions">
                {!chat && busy ? <p className="ws-chat-empty">Opening the chat…</p> : null}
                {messages.map((message, index) => {
                  if (message.author === "system") {
                    return (
                      <div key={message.id} className="ws-chat-row" data-author="system">
                        <p className="ws-chat-notice">{message.content}</p>
                      </div>
                    );
                  }
                  const previous = messages[index - 1];
                  const showSender = message.author !== "customer" && previous?.author !== message.author;
                  const sender = message.author === "staff" ? message.senderName || "Team" : "Assistant";
                  return (
                    <div key={message.id} className="ws-chat-row" data-author={message.author}>
                      {showSender ? <span className="ws-chat-sender">{sender}</span> : null}
                      <div className="ws-chat-bubble">{message.content}</div>
                      {Array.isArray(message.links) && message.links.length ? (
                        <div className="ws-chat-links">
                          {message.links.map((link) => (
                            <ChatLink key={`${link.href}-${link.label}`} link={link} />
                          ))}
                        </div>
                      ) : null}
                      <span className="ws-chat-meta">
                        {message.author === "customer" ? "You" : sender} · {formatTime(message.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {suggestions.length && !handoffOpen ? (
                <div className="ws-chat-suggestions" aria-label="Suggested questions">
                  {suggestions.map((question) => (
                    <button key={question} type="button" className="ws-chat-suggestion" onClick={() => askSuggestion(question)} disabled={busy}>
                      {question}
                    </button>
                  ))}
                </div>
              ) : null}

              {handoffOpen && status === "bot" ? (
                <form className="ws-chat-handoff" onSubmit={submitHandoff}>
                  <p className="ws-chat-handoff__title">Chat with the team</p>
                  <p className="ws-chat-handoff__text">
                    Tell us who you are and we&apos;ll put you in the queue. Your email lets the team get back to you if you have to leave.
                  </p>
                  <input
                    type="text"
                    className="ws-chat-input"
                    placeholder="Your name"
                    aria-label="Your name"
                    autoComplete="name"
                    maxLength={80}
                    value={contact.contactName}
                    onChange={(event) => setContact((prev) => ({ ...prev, contactName: event.target.value }))}
                    required
                  />
                  <input
                    type="email"
                    className="ws-chat-input"
                    placeholder="Email address"
                    aria-label="Email address"
                    autoComplete="email"
                    maxLength={160}
                    value={contact.contactEmail}
                    onChange={(event) => setContact((prev) => ({ ...prev, contactEmail: event.target.value }))}
                    required
                  />
                  {error ? (
                    <p className="ws-chat-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <div className="ws-chat-handoff__actions">
                    <button type="button" onClick={() => setHandoffOpen(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="app-btn" disabled={busy}>
                      {busy ? "Joining…" : "Join the queue"}
                    </button>
                  </div>
                </form>
              ) : error ? (
                <p className="ws-chat-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          )}

          <div className="ws-chat-footer">
            {view === "history" || status === "closed" ? (
              <button type="button" className="app-btn ws-chat-team-btn" onClick={helpChat.newChat} disabled={busy}>
                Start a new chat
              </button>
            ) : handoffOpen ? null : (
              <>
                {status === "bot" && chat ? (
                  <button type="button" className="ws-chat-team-btn" onClick={requestTeam} disabled={busy}>
                    Chat with the team
                  </button>
                ) : null}
                <form className="ws-chat-composer" onSubmit={submitMessage}>
                  <input
                    ref={inputRef}
                    type="text"
                    className="ws-chat-input"
                    placeholder={status === "bot" ? "Ask a question…" : "Message the team…"}
                    aria-label={status === "bot" ? "Ask a question" : "Message the team"}
                    autoComplete="off"
                    enterKeyHint="send"
                    maxLength={1000}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={!chat}
                  />
                  <button type="submit" className="app-btn ws-chat-send" aria-label="Send message" disabled={!chat || busy || !draft.trim()}>
                    <SendGlyph />
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="app-btn ws-chat-launcher"
        aria-label={open ? "Close chat" : unread ? "Open chat, new message" : "Open chat"}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={helpChat.toggle}
      >
        {open ? <CloseGlyph /> : <ChatGlyph />}
        {unread ? <span className="ws-chat-launcher__badge" aria-hidden="true" /> : null}
      </button>
    </div>
  );
}
