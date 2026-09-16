// file location: src/components/page-ui/messages/WebsiteHelpQueue.js
//
// Website help chat queue, shown at the top of the /messages thread list for the
// roles that see the Bookings feed. Customers land here after pressing "Chat with
// the team" in the chat bubble on /website. Join adds the member of staff to the
// chat's message thread and opens it; from then on it is a normal conversation.
//
// Renders nothing while nobody is waiting.

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import LayerSurface from "@/components/ui/LayerSurface";
import StatusMessage from "@/components/ui/StatusMessage";

const QUEUE_API = "/api/messages/website-help-queue";
const POLL_MS = 15000;

const waitedFor = (iso) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (!Number.isFinite(minutes) || minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ${minutes % 60} min`;
};

export default function WebsiteHelpQueue({ onJoined }) {
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState("");
  const [joiningId, setJoiningId] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(QUEUE_API, { credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Could not load the website chat queue.");
      setQueue(Array.isArray(data.data) ? data.data : []);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const join = async (item) => {
    setJoiningId(item.id);
    try {
      const response = await fetch(QUEUE_API, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: item.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Could not join the chat.");
      setQueue((prev) => prev.filter((entry) => entry.id !== item.id));
      await onJoined?.(data.threadId);
    } catch (err) {
      setError(err.message);
      load();
    } finally {
      setJoiningId(null);
    }
  };

  if (!queue.length && !error) return null;

  return (
    <LayerSurface
      sectionKey="messages-website-help-queue"
      parentKey="messages-thread-list"
      padding="var(--space-sm)"
      gap="var(--space-sm)"
      aria-label="Website chat queue"
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)" }}>
        <strong>Website chat queue</strong>
        {queue.length ? <span className="app-badge app-badge--warning">{queue.length} waiting</span> : null}
      </div>
      {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
      {queue.map((item) => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", minWidth: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</strong>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.firstQuestion || item.pagePath || "Asked for the team straight away"}
            </span>
            <span>
              {item.signedIn ? "Signed in · " : ""}Waiting {waitedFor(item.queuedAt)}
            </span>
          </div>
          <Button type="button" variant="primary" size="sm" pill onClick={() => join(item)} disabled={joiningId !== null}>
            {joiningId === item.id ? "Joining…" : "Join"}
          </Button>
        </div>
      ))}
    </LayerSurface>
  );
}
