// file location: src/components/topbar/WorkspaceCustomiseOverlay.js
//
// Workspace personalisation UI (Phase 3.7). Lets a user show/hide and reorder
// their productivity-panel widgets and choose which quick actions they want,
// with everything persisted per-user (see useWorkspacePreferences). Reuses the
// shared PopupModal + LayerTheme so it stays on the design system.

import React from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerTheme from "@/components/ui/LayerTheme";
import { WIDGET_META } from "@/config/topbar/productivityWidgets";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export default function WorkspaceCustomiseOverlay({
  isOpen = false,
  onClose,
  prefs,
  onSetWidget,
  onReorderWidget,
  quickActions = [],
  onToggleQuickAction,
  onReset,
}) {
  useEscapeKey(onClose, isOpen);
  if (!isOpen) return null;

  const order = prefs?.widgetOrder || WIDGET_META.map((w) => w.id);
  const orderedWidgets = order
    .map((id) => WIDGET_META.find((w) => w.id === id))
    .filter(Boolean);
  const hiddenQuick = new Set(prefs?.hiddenQuickActions || []);

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Customise workspace"
      cardStyle={{
        width: "min(100%, 460px)",
        padding: "20px 22px 22px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--accent)" }}>
          Customise workspace
        </h2>
        <button type="button" onClick={onClose} className="app-btn app-btn--ghost" aria-label="Close customise">
          Close
        </button>
      </div>

      {/* Widgets: visibility + order */}
      <LayerTheme radius="var(--radius-md)" gap="8px" padding="14px">
        <h3 style={sectionTitleStyle}>Panel widgets</h3>
        {orderedWidgets.map((widget, index) => {
          const visible = prefs?.widgets?.[widget.id] !== false;
          return (
            <div
              key={widget.id}
              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 2px" }}
            >
              <button
                type="button"
                role="switch"
                aria-checked={visible}
                aria-label={`${visible ? "Hide" : "Show"} ${widget.title}`}
                onClick={() => onSetWidget?.(widget.id, !visible)}
                style={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  borderRadius: "var(--radius-sm)",
                  border: "var(--checkbox-ring)", // checkbox outline (allowed)
                  background: visible ? "var(--success-base)" : "transparent",
                  color: "var(--onAccentText)",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  lineHeight: 1,
                }}
              >
                {visible ? "✓" : ""}
              </button>
              <span style={{ flex: 1, minWidth: 0, fontSize: "0.86rem", color: "var(--text-1)" }}>
                {widget.icon} {widget.title}
              </span>
              <button
                type="button"
                onClick={() => onReorderWidget?.(widget.id, -1)}
                disabled={index === 0}
                className="app-btn app-btn--ghost"
                aria-label={`Move ${widget.title} up`}
                style={{ padding: "2px 8px", minHeight: 0, opacity: index === 0 ? 0.4 : 1 }}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onReorderWidget?.(widget.id, 1)}
                disabled={index === orderedWidgets.length - 1}
                className="app-btn app-btn--ghost"
                aria-label={`Move ${widget.title} down`}
                style={{ padding: "2px 8px", minHeight: 0, opacity: index === orderedWidgets.length - 1 ? 0.4 : 1 }}
              >
                ↓
              </button>
            </div>
          );
        })}
      </LayerTheme>

      {/* Quick actions: which to show */}
      {quickActions.length > 0 && (
        <LayerTheme radius="var(--radius-md)" gap="8px" padding="14px">
          <h3 style={sectionTitleStyle}>Quick actions</h3>
          {quickActions.map((action) => {
            const shown = !hiddenQuick.has(action.href);
            return (
              <div
                key={action.href}
                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 2px" }}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={shown}
                  aria-label={`${shown ? "Hide" : "Show"} ${action.label}`}
                  onClick={() => onToggleQuickAction?.(action.href)}
                  style={{
                    width: 20,
                    height: 20,
                    flexShrink: 0,
                    borderRadius: "var(--radius-sm)",
                    border: "var(--checkbox-ring)", // checkbox outline (allowed)
                    background: shown ? "var(--success-base)" : "transparent",
                    color: "var(--onAccentText)",
                    cursor: "pointer",
                    fontSize: "0.7rem",
                    lineHeight: 1,
                  }}
                >
                  {shown ? "✓" : ""}
                </button>
                <span style={{ flex: 1, minWidth: 0, fontSize: "0.86rem", color: "var(--text-1)" }}>
                  {action.label}
                </span>
              </div>
            );
          })}
        </LayerTheme>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={onReset} className="app-btn app-btn--secondary">
          Reset to defaults
        </button>
      </div>
    </PopupModal>
  );
}

const sectionTitleStyle = {
  margin: 0,
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-1)",
  opacity: 0.7,
};
