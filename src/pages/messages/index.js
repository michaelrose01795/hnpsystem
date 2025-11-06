"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Layout from "../../components/Layout";
import { useUser } from "@/context/UserContext";
import { appShellTheme } from "@/styles/appTheme";

const palette = appShellTheme.palette;
const radii = appShellTheme.radii;
const shadows = appShellTheme.shadows;

const cardStyle = {
  background: "linear-gradient(160deg, #ffffff, #fff7f7)",
  border: `1px solid ${palette.border}`,
  borderRadius: "22px",
  padding: "20px",
  boxShadow: shadows.sm,
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const SectionTitle = ({ title, subtitle, action }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
    }}
  >
    <div>
      <h3
        style={{
          margin: 0,
          fontSize: "1rem",
          color: palette.accent,
        }}
      >
        {title}
      </h3>
      {subtitle && (
        <p style={{ margin: "4px 0 0", color: palette.textMuted, fontSize: "0.85rem" }}>
          {subtitle}
        </p>
      )}
    </div>
    {action}
  </div>
);

const ComposeToggleButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      flex: 1,
      borderRadius: radii.lg,
      padding: "10px 12px",
      border: `1px solid ${active ? palette.accent : palette.border}`,
      backgroundColor: active ? palette.accent : "#ffffff",
      color: active ? "#ffffff" : palette.accent,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 0.2s ease",
    }}
  >
    {children}
  </button>
);

const Chip = ({ label, onRemove }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 12px",
      borderRadius: radii.pill,
      backgroundColor: palette.accentSurface,
      color: palette.accent,
      fontSize: "0.85rem",
      fontWeight: 600,
    }}
  >
    {label}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        style={{
          border: "none",
          background: "transparent",
          color: palette.accent,
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        ×
      </button>
    )}
  </span>
);

const MessageBubble = ({ message, isMine }) => {
  const bubbleStyles = {
    padding: "14px 18px",
    borderRadius: isMine
      ? `${radii.lg} ${radii.sm} ${radii.lg} ${radii.lg}`
      : `${radii.sm} ${radii.lg} ${radii.lg} ${radii.lg}`,
    backgroundColor: isMine ? palette.accent : "#ffffff",
    color: isMine ? "#ffffff" : palette.textPrimary,
    maxWidth: "70%",
    alignSelf: isMine ? "flex-end" : "flex-start",
    boxShadow: isMine ? shadows.md : "0 8px 20px rgba(0,0,0,0.08)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: isMine ? palette.accent : "#b45309",
          textAlign: isMine ? "right" : "left",
        }}
      >
        {message.sender?.name || "Unknown"} •{" "}
        {new Date(message.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
      <div style={bubbleStyles}>{message.content}</div>
    </div>
  );
};

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.append(key, value);
  });
  return query.toString() ? `?${query.toString()}` : "";
};

function MessagesPage() {
  const { dbUserId, user } = useUser();

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [directory, setDirectory] = useState([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false);

  const [composeMode, setComposeMode] = useState("direct");
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [composeError, setComposeError] = useState("");

  const scrollerRef = useRef(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const mergeThread = useCallback((nextThread) => {
    if (!nextThread) return;
    setThreads((prev) => {
      const idx = prev.findIndex((thread) => thread.id === nextThread.id);
      if (idx === -1) {
        return [nextThread, ...prev].sort(
          (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
        );
      }
      const copy = [...prev];
      copy[idx] = nextThread;
      return copy.sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );
    });
  }, []);

  const fetchThreads = useCallback(async () => {
    if (!dbUserId) return;
    setLoadingThreads(true);
    try {
      const response = await fetch(
        `/api/messages/threads${buildQuery({ userId: dbUserId })}`
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to load threads");
      setThreads(payload.data || []);
    } catch (error) {
      console.error("❌ Failed to load threads:", error);
    } finally {
      setLoadingThreads(false);
    }
  }, [dbUserId]);

  const fetchDirectory = useCallback(
    async (searchTerm = "") => {
      if (!dbUserId) return;
      setDirectoryLoading(true);
      try {
        const response = await fetch(
          `/api/messages/users${buildQuery({
            q: searchTerm,
            exclude: dbUserId,
          })}`
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Failed to load users");
        setDirectory(payload.data || []);
      } catch (error) {
        console.error("❌ Failed to load directory:", error);
      } finally {
        setDirectoryLoading(false);
      }
    },
    [dbUserId]
  );

  const openThread = useCallback(
    async (threadId) => {
      if (!threadId || !dbUserId) return;
      setActiveThreadId(threadId);
      setLoadingMessages(true);
      try {
        const response = await fetch(
          `/api/messages/threads/${threadId}/messages${buildQuery({
            userId: dbUserId,
          })}`
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Failed to load messages");
        setMessages(payload.data || []);
      } catch (error) {
        console.error("❌ Failed to load conversation:", error);
      } finally {
        setLoadingMessages(false);
      }
    },
    [dbUserId]
  );

  const startDirectThread = useCallback(
    async (targetUserId) => {
      if (!dbUserId || !targetUserId) return;
      setComposeError("");
      try {
        const response = await fetch("/api/messages/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "direct",
            createdBy: dbUserId,
            targetUserId,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Unable to start chat");
        const thread = payload.data;
        if (!thread) throw new Error("Thread could not be created.");
        mergeThread(thread);
        await fetchThreads();
        await openThread(thread.id);
      } catch (error) {
        console.error("❌ Failed to start direct chat:", error);
        setComposeError(error.message || "Unable to start chat");
      }
    },
    [dbUserId, fetchThreads, mergeThread, openThread]
  );

  const handleCreateGroup = useCallback(async () => {
    if (!dbUserId) return;
    if (selectedRecipients.length === 0) {
      setComposeError("Select at least one colleague for the group.");
      return;
    }

    setComposeError("");
    try {
      const response = await fetch("/api/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "group",
          createdBy: dbUserId,
          title: groupName,
          memberIds: selectedRecipients.map((user) => user.id),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to create group");
      const thread = payload.data;
      if (!thread) throw new Error("Group thread was not created.");
      setSelectedRecipients([]);
      setGroupName("");
      setComposeMode("direct");
      mergeThread(thread);
      await fetchThreads();
      await openThread(thread.id);
    } catch (error) {
      console.error("❌ Failed to create group:", error);
      setComposeError(error.message || "Unable to create group");
    }
  }, [
    dbUserId,
    fetchThreads,
    groupName,
    mergeThread,
    openThread,
    selectedRecipients,
  ]);

  const handleSendMessage = useCallback(
    async (event) => {
      event?.preventDefault();
      if (!messageDraft.trim() || !activeThreadId || !dbUserId) return;
      setSending(true);
      try {
        const response = await fetch(`/api/messages/threads/${activeThreadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderId: dbUserId,
            content: messageDraft.trim(),
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Unable to send message");
        const newMessage = payload.data;
        if (!newMessage) throw new Error("Message payload missing.");
        setMessageDraft("");
        setMessages((prev) => [...prev, newMessage]);
        await fetchThreads();
        await openThread(activeThreadId);
      } catch (error) {
        console.error("❌ Failed to send message:", error);
      } finally {
        setSending(false);
      }
    },
    [activeThreadId, dbUserId, fetchThreads, messageDraft, openThread]
  );

  useEffect(() => {
    if (!dbUserId) return;
    fetchThreads();
  }, [dbUserId, fetchThreads]);

  useEffect(() => {
    if (!dbUserId) return;
    const handle = setTimeout(() => {
      fetchDirectory(directorySearch);
    }, 350);
    return () => clearTimeout(handle);
  }, [dbUserId, directorySearch, fetchDirectory]);

  useEffect(() => {
    if (!threads.length) {
      setActiveThreadId(null);
      setMessages([]);
      return;
    }
    if (!activeThreadId) {
      openThread(threads[0].id);
    }
  }, [threads, activeThreadId, openThread]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleDirectoryUser = (userEntry) => {
    if (composeMode === "direct") {
      startDirectThread(userEntry.id);
      return;
    }

    setSelectedRecipients((prev) => {
      const exists = prev.some((user) => user.id === userEntry.id);
      if (exists) {
        return prev.filter((user) => user.id !== userEntry.id);
      }
      return [...prev, userEntry];
    });
  };

  const isRecipientSelected = (userEntry) =>
    selectedRecipients.some((user) => user.id === userEntry.id);

  const canSend = Boolean(
    messageDraft.trim() && activeThread && !loadingMessages && !sending
  );

  if (!user) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2>Please log in to access internal messages.</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          minHeight: "calc(100vh - 180px)",
        }}
      >
        <div style={{ ...cardStyle, flexDirection: "row", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, color: palette.accent }}>Internal Messages</h2>
            <p style={{ margin: "6px 0 0", color: palette.textMuted }}>
              Chat with any colleague, launch focused group threads, and keep every job
              discussion inside H&P.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchThreads}
            style={{
              border: "none",
              borderRadius: radii.pill,
              padding: "12px 20px",
              backgroundColor: palette.accent,
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "360px minmax(0, 1fr)",
            gap: "20px",
            minHeight: "520px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={cardStyle}>
              <SectionTitle
                title="Start a Conversation"
                subtitle={
                  composeMode === "direct"
                    ? "Pick someone from the list to open a direct thread."
                    : "Select colleagues and give the group a name."
                }
              />

              <div style={{ display: "flex", gap: "10px" }}>
                <ComposeToggleButton
                  active={composeMode === "direct"}
                  onClick={() => {
                    setComposeMode("direct");
                    setSelectedRecipients([]);
                    setComposeError("");
                  }}
                >
                  Direct
                </ComposeToggleButton>
                <ComposeToggleButton
                  active={composeMode === "group"}
                  onClick={() => {
                    setComposeMode("group");
                    setComposeError("");
                  }}
                >
                  Group
                </ComposeToggleButton>
              </div>

              <input
                type="search"
                placeholder="Search everyone..."
                value={directorySearch}
                onChange={(event) => setDirectorySearch(event.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: radii.lg,
                  border: `1px solid ${palette.border}`,
                  backgroundColor: "#ffffff",
                }}
              />

              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {directoryLoading && (
                  <p style={{ color: palette.textMuted, margin: 0 }}>Loading colleagues…</p>
                )}
                {!directoryLoading &&
                  (directory.length ? (
                    directory.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => handleDirectoryUser(entry)}
                        style={{
                          textAlign: "left",
                          borderRadius: "16px",
                          border: `1px solid ${
                            composeMode === "group" && isRecipientSelected(entry)
                              ? palette.accent
                              : palette.border
                          }`,
                          padding: "12px 14px",
                          backgroundColor:
                            composeMode === "group" && isRecipientSelected(entry)
                              ? palette.accentSurface
                              : "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        <strong style={{ display: "block", fontSize: "0.95rem" }}>
                          {entry.name}
                        </strong>
                        <span style={{ fontSize: "0.8rem", color: palette.textMuted }}>
                          {entry.role || "Team member"}
                        </span>
                        <span
                          style={{
                            marginTop: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            color: palette.accent,
                            fontWeight: 600,
                            fontSize: "0.8rem",
                          }}
                        >
                          {composeMode === "direct" ? "Start chat" : "Toggle in group"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p style={{ margin: 0, color: palette.textMuted }}>
                      No colleagues found.
                    </p>
                  ))}
              </div>

              {composeMode === "group" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {selectedRecipients.length ? (
                      selectedRecipients.map((entry) => (
                        <Chip
                          key={entry.id}
                          label={entry.name}
                          onRemove={() =>
                            setSelectedRecipients((prev) =>
                              prev.filter((user) => user.id !== entry.id)
                            )
                          }
                        />
                      ))
                    ) : (
                      <span style={{ color: palette.textMuted, fontSize: "0.85rem" }}>
                        Pick at least one person for the group.
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Group name (optional)"
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: radii.lg,
                      border: `1px solid ${palette.border}`,
                      backgroundColor: "#ffffff",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={!selectedRecipients.length}
                    style={{
                      border: "none",
                      borderRadius: radii.pill,
                      padding: "12px 18px",
                      backgroundColor: selectedRecipients.length
                        ? palette.accent
                        : "#f3f4f6",
                      color: selectedRecipients.length ? "#ffffff" : "#9ca3af",
                      fontWeight: 600,
                      cursor: selectedRecipients.length ? "pointer" : "not-allowed",
                    }}
                  >
                    Create Group
                  </button>
                </div>
              )}

              {composeError && (
                <p style={{ color: "#b91c1c", margin: 0, fontSize: "0.85rem" }}>
                  {composeError}
                </p>
              )}
            </div>

            <div style={{ ...cardStyle, flex: 1, minHeight: 0 }}>
              <SectionTitle
                title="Threads"
                subtitle="Open conversations you’re part of."
                action={
                  <span style={{ fontSize: "0.8rem", color: palette.textMuted }}>
                    {threads.length} active
                  </span>
                }
              />

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {loadingThreads && (
                  <p style={{ color: palette.textMuted }}>Loading threads…</p>
                )}
                {!loadingThreads && !threads.length && (
                  <p style={{ color: palette.textMuted, margin: 0 }}>
                    No conversations yet. Start one above.
                  </p>
                )}
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => openThread(thread.id)}
                    style={{
                      borderRadius: "18px",
                      border: `1px solid ${
                        activeThreadId === thread.id ? palette.accent : palette.border
                      }`,
                      backgroundColor:
                        activeThreadId === thread.id ? palette.accentSurface : "#ffffff",
                      padding: "14px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <strong style={{ display: "block", fontSize: "0.95rem" }}>
                      {thread.title}
                    </strong>
                    {thread.lastMessage ? (
                      <span
                        style={{
                          display: "block",
                          marginTop: "4px",
                          fontSize: "0.85rem",
                          color: palette.textMuted,
                        }}
                      >
                        {thread.lastMessage.sender?.name || "Someone"}:{" "}
                        {thread.lastMessage.content.length > 64
                          ? `${thread.lastMessage.content.slice(0, 64)}…`
                          : thread.lastMessage.content}
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: palette.textMuted }}>
                        No messages yet
                      </span>
                    )}
                    {thread.hasUnread && (
                      <span
                        style={{
                          marginTop: "6px",
                          display: "inline-flex",
                          padding: "4px 10px",
                          borderRadius: radii.pill,
                          backgroundColor: palette.accent,
                          color: "#ffffff",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        Unread
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, flex: 1, minHeight: 0 }}>
            {activeThread ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "16px",
                    borderBottom: `1px solid ${palette.border}`,
                    paddingBottom: "12px",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, color: palette.accent }}>{activeThread.title}</h3>
                    <p style={{ margin: "4px 0 0", color: palette.textMuted }}>
                      {activeThread.members.length} participants
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "12px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                  }}
                >
                  {activeThread.members.map((member) => (
                    <Chip
                      key={member.userId}
                      label={member.profile?.name || "Unknown"}
                    />
                  ))}
                </div>

                <div
                  ref={scrollerRef}
                  style={{
                    marginTop: "16px",
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    paddingRight: "6px",
                  }}
                >
                  {loadingMessages && (
                    <p style={{ color: palette.textMuted }}>Loading conversation…</p>
                  )}
                  {!loadingMessages && messages.length === 0 && (
                    <p style={{ color: palette.textMuted }}>No messages yet.</p>
                  )}
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isMine={message.senderId === dbUserId}
                    />
                  ))}
                </div>

                <form
                  onSubmit={handleSendMessage}
                  style={{
                    marginTop: "16px",
                    borderTop: `1px solid ${palette.border}`,
                    paddingTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <textarea
                    rows={3}
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder="Write an internal update…"
                    style={{
                      width: "100%",
                      borderRadius: radii.lg,
                      border: `1px solid ${palette.border}`,
                      padding: "12px 14px",
                      resize: "none",
                      backgroundColor: "#ffffff",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                    <button
                      type="submit"
                      disabled={!canSend}
                      style={{
                        border: "none",
                        borderRadius: radii.pill,
                        padding: "12px 20px",
                        backgroundColor: canSend ? palette.accent : "#f3f4f6",
                        color: canSend ? "#ffffff" : "#9ca3af",
                        fontWeight: 600,
                        cursor: canSend ? "pointer" : "not-allowed",
                      }}
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: palette.textMuted,
                  textAlign: "center",
                }}
              >
                Select or start a conversation to begin messaging.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default MessagesPage;
