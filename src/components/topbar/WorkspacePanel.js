// file location: src/components/topbar/WorkspacePanel.js
//
// Personal productivity panel (Phase 3.6). A right-hand drawer that surfaces each
// user's upcoming/outstanding work, contextual suggestions, personal reminders,
// recent activity, favourites and a live department snapshot. Opened with
// ⌘/Ctrl+J or from the palette; adds nothing to the top bar.
//
// Reuses the shared PopupModal (borderless, token-driven) styled as an edge
// drawer, and the canonical LayerTheme surface for each widget block so it obeys
// the layer/border laws. Data-driven from resolveWidgets — new widgets need no
// change here (reminders are the one interactive widget).

import React, { useState } from "react";
import { useRouter } from "next/router";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerTheme from "@/components/ui/LayerTheme";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const TONE_COLOR = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--info)",
  success: "var(--success-base)",
};

function ToneDot({ tone }) {
  if (!tone || !TONE_COLOR[tone]) return null;
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: "var(--radius-pill)",
        background: TONE_COLOR[tone],
        flexShrink: 0,
      }}
    />
  );
}

export default function WorkspacePanel({
  isOpen = false,
  onClose,
  widgets = [],
  reminders,
  onCustomise,
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  useEscapeKey(onClose, isOpen);

  const go = (href) => {
    if (!href) return;
    onClose?.();
    router.push(href);
  };

  const submitReminder = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    reminders?.addReminder?.(text);
    setDraft("");
  };

  if (!isOpen) return null;

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Workspace panel"
      backdropStyle={{ justifyContent: "flex-end", alignItems: "stretch", padding: 0, zIndex: 9998 }}
      cardStyle={{
        width: "min(100%, 440px)",
        height: "100dvh",
        maxHeight: "100dvh",
        borderRadius: 0,
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "16px 18px",
          borderBottom: "var(--separating-line)", // header rule (allowed list separator)
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--accent)" }}>
          My workspace
        </h2>
        <div style={{ display: "flex", gap: "8px" }}>
          {onCustomise && (
            <button type="button" onClick={onCustomise} className="app-btn app-btn--ghost">
              Customise
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="app-btn app-btn--ghost"
            aria-label="Close workspace panel"
          >
            Close
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "14px 14px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {widgets.map((widget) => (
          <LayerTheme key={widget.id} radius="var(--radius-md)" gap="8px" padding="14px">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span aria-hidden="true">{widget.icon}</span>
              <h3
                style={{
                  margin: 0,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-1)",
                  opacity: 0.7,
                }}
              >
                {widget.title}
              </h3>
            </div>

            {widget.interactive === "reminders" ? (
              <ReminderList reminders={reminders} items={widget.items} emptyText={widget.emptyText}
                draft={draft} setDraft={setDraft} onSubmit={submitReminder} />
            ) : widget.items.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.55 }}>{widget.emptyText}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {widget.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item.href)}
                    disabled={!item.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 6px",
                      border: "none",
                      background: "transparent",
                      color: "var(--text-1)",
                      cursor: item.href ? "pointer" : "default",
                      font: "inherit",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <ToneDot tone={item.tone} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.86rem",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.label}
                      </span>
                      {item.subtitle && (
                        <span style={{ display: "block", fontSize: "0.7rem", opacity: 0.55 }}>
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    {item.href && <span aria-hidden="true" style={{ opacity: 0.4 }}>→</span>}
                  </button>
                ))}
              </div>
            )}
          </LayerTheme>
        ))}
      </div>
    </PopupModal>
  );
}

function ReminderList({ reminders, items, emptyText, draft, setDraft, onSubmit }) {
  return (
    <>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.55 }}>{emptyText}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 4px" }}
            >
              <button
                type="button"
                onClick={() => reminders?.toggleReminder?.(item.id)}
                aria-pressed={item.done}
                aria-label={item.done ? "Mark as not done" : "Mark as done"}
                style={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  borderRadius: "var(--radius-sm)",
                  border: "var(--checkbox-ring)", // checkbox outline (allowed)
                  background: item.done ? "var(--success-base)" : "transparent",
                  color: "var(--onAccentText)",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  lineHeight: 1,
                }}
              >
                {item.done ? "✓" : ""}
              </button>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: "0.86rem",
                  color: "var(--text-1)",
                  opacity: item.done ? 0.5 : 1,
                  textDecoration: item.done ? "line-through" : "none",
                }}
              >
                {item.label}
              </span>
              <button
                type="button"
                onClick={() => reminders?.removeReminder?.(item.id)}
                className="app-btn app-btn--ghost"
                aria-label="Remove reminder"
                style={{ padding: "2px 8px", minHeight: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={onSubmit} style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a reminder…"
          aria-label="Add a reminder"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "8px 10px",
            fontSize: "0.85rem",
            color: "var(--text-1)",
            background: "var(--surface)",
            border: "var(--input-ring)", // form input (allowed)
            borderRadius: "var(--input-radius)",
            outline: "none",
          }}
        />
        <button type="submit" className="app-btn app-btn--secondary" disabled={!draft.trim()}>
          Add
        </button>
      </form>
    </>
  );
}
