import React from "react";
import { createPortal } from "react-dom";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import { PERSONAL_WIDGET_TYPE_OPTIONS } from "@/lib/profile/personalWidgets";

export default function AddWidgetModal({
  isOpen,
  visibleWidgetsByType = {},
  onToggle,
  onClose,
}) {
  useBodyModalLock(isOpen);

  if (!isOpen) return null;

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.58)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 2000,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "720px",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "var(--surface)",
          borderRadius: "24px",
          border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
          boxShadow: "var(--shadow-lg)",
          padding: "24px",
          display: "grid",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>Add or restore widgets</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: "999px",
              border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
              background: "transparent",
              color: "var(--text-primary)",
              padding: "10px 14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {PERSONAL_WIDGET_TYPE_OPTIONS.map((definition) => {
            const isVisible = Boolean(visibleWidgetsByType[definition.type]);
            return (
              <button
                key={definition.type}
                type="button"
                onClick={() => onToggle?.(definition.type, isVisible)}
                style={{
                  textAlign: "left",
                  display: "grid",
                  gap: "8px",
                  borderRadius: "18px",
                  border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
                  background: isVisible ? "rgba(198, 40, 40, 0.08)" : "var(--surface)",
                  padding: "16px",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700 }}>{definition.label}</div>
                <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {definition.description}
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: isVisible ? "var(--danger, #c62828)" : "var(--accent-purple)",
                  }}
                >
                  {isVisible ? "Remove widget" : "Add widget"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
