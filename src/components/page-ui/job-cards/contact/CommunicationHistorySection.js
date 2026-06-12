// file location: src/components/page-ui/job-cards/contact/CommunicationHistorySection.js
// "Communication History" section of the redesigned Contact tab. Renders the
// in-app job<->customer thread messages as a vertical tracking tree: each entry
// shows what was sent, the channel, the date/time and who sent it. Newest first.
import React, { useMemo } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

const formatTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function TimelineEntry({ entry, isLast }) {
  const meta = entry.metadata || {};
  const channel = meta.channel || "In-app";
  const title = meta.templateTitle || "Message";
  const sender = entry.sender?.name || "—";

  return (
    <div style={{ display: "flex", gap: "12px" }}>
      {/* Marker rail */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "16px" }}>
        <span
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "var(--radius-pill)",
            background: "var(--accent-strong)",
            flexShrink: 0,
            marginTop: "4px",
          }}
        />
        {!isLast && (
          <span
            style={{
              width: "2px",
              flex: 1,
              minHeight: "16px",
              background: "rgba(var(--accent-base-rgb), 0.25)",
              marginTop: "4px",
            }}
          />
        )}
      </div>

      {/* Entry body */}
      <LayerTheme
        sectionKey={`jobcard-contact-history-${entry.id}`}
        parentKey="jobcard-contact-history-list"
        radius="var(--radius-sm)"
        padding="var(--space-4)"
        gap="var(--space-2)"
        style={{ flex: 1, marginBottom: "12px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: "var(--text-1)" }}>{title}</span>
          <span className="app-badge app-badge--accent-soft app-badge--uppercase">{channel}</span>
        </div>
        <p style={{ margin: 0, color: "var(--text-1)", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
          {entry.content}
        </p>
        <span style={{ fontSize: "0.75rem", color: "var(--text-1)", opacity: 0.7 }}>
          {formatTimestamp(entry.createdAt)} · by {sender}
        </span>
      </LayerTheme>
    </div>
  );
}

export default function CommunicationHistorySection({ messages = [], loading = false }) {
  const ordered = useMemo(() => {
    return [...messages].sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [messages]);

  return (
    <LayerSurface
      sectionKey="jobcard-contact-history"
      sectionType="section-shell"
      parentKey="jobcard-tab-contact"
      shell
      gap="var(--space-4)"
    >
      <div className="app-layout-header-row">
        <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text-1)" }}>Communication History</h3>
        <span className="app-badge app-badge--neutral">{ordered.length}</span>
      </div>

      {loading && <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.7 }}>Loading history…</p>}

      {!loading && ordered.length === 0 && (
        <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.7 }}>
          No messages have been sent to this customer yet.
        </p>
      )}

      {!loading && ordered.length > 0 && (
        <div data-section="jobcard-contact-history-list" style={{ display: "flex", flexDirection: "column" }}>
          {ordered.map((entry, index) => (
            <TimelineEntry key={entry.id} entry={entry} isLast={index === ordered.length - 1} />
          ))}
        </div>
      )}
    </LayerSurface>
  );
}
