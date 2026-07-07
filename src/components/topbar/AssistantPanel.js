// file location: src/components/topbar/AssistantPanel.js
//
// Intelligent operational assistant panel (Phase 5.6). A right-hand drawer — the
// reasoning counterpart to the personal WorkspacePanel (3.6) and the collaborative
// TeamPanel (4) — that surfaces, in one place:
//   • Proactive alerts needing attention (5.3)
//   • Predictive recommendations, with the reason why (5.1)
//   • The workflow next-steps for where you are (5.5)
//   • Smart reminders that shouldn't slip (5.4)
//   • Workload balancing (5.2, managers/controllers)
//   • Contextual guidance for the current page (5.6)
// with one-click "message the responsible team" shortcuts throughout (4.4).
// Opened with ⌘/Ctrl+I or from the palette; adds NOTHING to the top bar.
//
// Obeys the layer/border laws: the shared PopupModal (borderless) as an edge
// drawer, each block a canonical LayerTheme surface, header/list rules via
// --separating-line, focus/inputs via the allowed rings. Fully data-driven from
// buildAssistant — a new assistant section needs no change here.

import React from "react";
import { useRouter } from "next/router";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerTheme from "@/components/ui/LayerTheme";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { memberContactAction, audienceContactAction } from "@/config/topbar/communicationShortcuts";

const TONE_COLOR = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--info)",
  success: "var(--success-base)",
  neutral: "var(--text-1)",
};

function toneColor(tone) {
  return TONE_COLOR[tone] || "var(--text-1)";
}

function Dot({ tone }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: 8, height: 8, borderRadius: "var(--radius-pill)", background: toneColor(tone), flexShrink: 0 }}
    />
  );
}

function BlockHeading({ icon, title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span aria-hidden="true">{icon}</span>
      <h3
        style={{
          margin: 0,
          flex: 1,
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-1)",
          opacity: 0.7,
        }}
      >
        {title}
      </h3>
      {action}
    </div>
  );
}

// A single assistant item: navigates if it has an href, shows a done tick for a
// completed workflow step, and offers a "message the team/person" shortcut when
// the item names an audience or member.
function ItemRow({ item, presence, onNavigate }) {
  const messageHref =
    item.memberId != null
      ? memberContactAction(presence?.byId?.get?.(item.memberId))?.href
      : item.messageAudience
      ? audienceContactAction(item.messageAudience, presence?.departments)?.href
      : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <button
        type="button"
        onClick={() => item.href && onNavigate(item.href)}
        disabled={!item.href}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flex: 1,
          minWidth: 0,
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
        {item.done ? (
          <span aria-hidden="true" style={{ color: "var(--success-base)", flexShrink: 0 }}>✓</span>
        ) : (
          <Dot tone={item.tone} />
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "0.86rem",
              fontWeight: 500,
              opacity: item.done ? 0.55 : 1,
              textDecoration: item.done ? "line-through" : "none",
            }}
          >
            {item.label}
          </span>
          {item.subtitle && (
            <span style={{ display: "block", fontSize: "0.7rem", opacity: 0.55 }}>{item.subtitle}</span>
          )}
        </span>
        {item.href && <span aria-hidden="true" style={{ opacity: 0.4 }}>→</span>}
      </button>
      {messageHref && (
        <button
          type="button"
          onClick={() => onNavigate(messageHref)}
          className="app-btn app-btn--ghost"
          aria-label="Message the responsible team"
          title="Message the responsible team"
          style={{ padding: "4px 8px", minHeight: 0, flexShrink: 0 }}
        >
          💬
        </button>
      )}
    </div>
  );
}

export default function AssistantPanel({
  isOpen = false,
  onClose,
  assistant = { headline: null, sections: [], counts: {} },
  presence = { departments: [], byId: null },
  behaviour = null,
}) {
  const router = useRouter();
  useEscapeKey(onClose, isOpen);

  const go = (href) => {
    if (!href) return;
    onClose?.();
    router.push(href);
  };

  if (!isOpen) return null;

  const { headline, sections } = assistant || {};

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Operational assistant"
      backdropStyle={{ justifyContent: "flex-end", alignItems: "stretch", padding: 0, zIndex: 9998 }}
      cardStyle={{
        width: "min(100%, 460px)",
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
          borderBottom: "var(--separating-line)", // header rule (allowed separator)
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--accent)" }}>
            Operational assistant
          </h2>
          {headline?.text && (
            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: toneColor(headline.tone), opacity: 0.85 }}>
              {headline.text}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="app-btn app-btn--ghost" aria-label="Close operational assistant">
          Close
        </button>
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
        {(sections || []).map((section) => (
          <LayerTheme key={section.id} radius="var(--radius-md)" gap="6px" padding="14px">
            <BlockHeading icon={section.icon} title={section.title} />
            {section.items.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.55 }}>
                Nothing here right now — the assistant will surface items as they arise.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {section.items.map((item) => (
                  <ItemRow key={item.id} item={item} presence={presence} onNavigate={go} />
                ))}
              </div>
            )}
          </LayerTheme>
        ))}

        {/* 5.7 — personalisation is under the user's control: what it's learned + reset. */}
        {behaviour && behaviour.canLearn && (
          <LayerTheme radius="var(--radius-md)" gap="6px" padding="14px">
            <BlockHeading
              icon="🧠"
              title="Personalisation"
              action={
                behaviour.tracked > 0 ? (
                  <button
                    type="button"
                    onClick={() => behaviour.reset?.()}
                    className="app-btn app-btn--ghost"
                    style={{ padding: "2px 8px", minHeight: 0 }}
                  >
                    Reset
                  </button>
                ) : null
              }
            />
            <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.6 }}>
              {behaviour.tracked > 0
                ? `Learning from your ${behaviour.tracked} most-used page${behaviour.tracked === 1 ? "" : "s"} to personalise recommendations — on this device only.`
                : "As you move around, the assistant learns your most-used pages to personalise recommendations — on this device only."}
            </p>
          </LayerTheme>
        )}
      </div>
    </PopupModal>
  );
}
