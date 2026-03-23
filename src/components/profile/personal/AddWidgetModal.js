import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import { PERSONAL_WIDGET_TYPE_OPTIONS, sortWidgetsForDisplay } from "@/lib/profile/personalWidgets";

const moveButtonBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "22px",
  minWidth: "58px",
  borderRadius: "999px",
  border: "none",
  background: "rgba(var(--primary-rgb), 0.08)",
  color: "var(--text-primary)",
  cursor: "pointer",
  userSelect: "none",
  touchAction: "none",
  padding: "0 10px",
  fontSize: "0.75rem",
  fontWeight: 700,
};

export default function AddWidgetModal({
  isOpen,
  widgets = [],
  visibleWidgetsByType = {},
  onToggle,
  onReorder,
  onClose,
}) {
  useBodyModalLock(isOpen);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState(null);

  const widgetTypeById = useMemo(() => {
    const map = new Map();
    (widgets || []).forEach((widget) => map.set(widget.id, widget.widgetType));
    return map;
  }, [widgets]);

  const layoutWidgets = useMemo(() => sortWidgetsForDisplay(widgets || []), [widgets]);

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
        padding: "clamp(14px, 3vw, 24px)",
        zIndex: 2000,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "920px",
          maxHeight: "84vh",
          overflowY: "auto",
          background: "var(--surface)",
          borderRadius: "24px",
          border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
          boxShadow: "var(--shadow-lg)",
          padding: "clamp(14px, 3vw, 24px)",
          display: "grid",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>Add / Restore Widgets</div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "4px" }}>
              Show, hide, and reorder widgets. Personal tab order follows this layout exactly.
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setIsMoveMode((current) => !current)}
              style={{
                ...moveButtonBaseStyle,
                background: isMoveMode ? "var(--primary)" : moveButtonBaseStyle.background,
                color: isMoveMode ? "var(--text-inverse)" : "var(--text-primary)",
                boxShadow: isMoveMode ? "0 8px 18px rgba(0,0,0,0.2)" : "none",
              }}
            >
              {isMoveMode ? "Done" : "Move"}
            </button>
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
        </div>

        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
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
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: isVisible ? "var(--danger, #c62828)" : "var(--accent-purple)" }}>
                  {isVisible ? "Hide widget" : "Restore widget"}
                </div>
              </button>
            );
          })}
        </div>

        <section
          style={{
            display: "grid",
            gap: "10px",
            borderRadius: "16px",
            border: "1px solid rgba(var(--accent-purple-rgb), 0.14)",
            background: "rgba(var(--primary-rgb), 0.03)",
            padding: "14px",
            userSelect: isMoveMode ? "none" : "auto",
            WebkitUserSelect: isMoveMode ? "none" : "auto",
          }}
        >
          <div style={{ fontSize: "0.76rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
            2-column layout map
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            {isMoveMode ? "Drag slots to reorder. Hidden widgets stay in the model and can be repositioned." : "Enable Move mode to reorder slots."}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "10px",
            }}
          >
            {layoutWidgets.map((widget, index) => {
              const isVisible = widget.isVisible !== false;
              return (
                <div
                  key={widget.id}
                  draggable={isMoveMode}
                  onDragStart={(event) => {
                    if (!isMoveMode) return;
                    setDraggedWidgetId(widget.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", widget.id);
                  }}
                  onDragOver={(event) => {
                    if (!isMoveMode) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={async (event) => {
                    if (!isMoveMode) return;
                    event.preventDefault();
                    const sourceId = event.dataTransfer.getData("text/plain") || draggedWidgetId;
                    if (!sourceId || sourceId === widget.id) return;
                    await onReorder?.(sourceId, widget.id);
                    setDraggedWidgetId(null);
                  }}
                  onDragEnd={() => setDraggedWidgetId(null)}
                  style={{
                    borderRadius: "12px",
                    border: draggedWidgetId === widget.id ? "2px solid var(--primary)" : "1px dashed rgba(var(--accent-purple-rgb), 0.35)",
                    background: isVisible ? "rgba(var(--surface-rgb, 255, 255, 255), 0.9)" : "rgba(var(--primary-rgb), 0.06)",
                    minHeight: "72px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    cursor: isMoveMode ? "move" : "default",
                    opacity: draggedWidgetId === widget.id ? 0.75 : 1,
                  }}
                >
                  <div style={{ display: "grid", gap: "4px" }}>
                    <div style={{ fontWeight: 700 }}>{widget.config?.title || widgetTypeById.get(widget.id) || "Widget"}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      Slot {index + 1} • {isVisible ? "Visible" : "Hidden"}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, color: isVisible ? "var(--success, #2e7d32)" : "var(--text-secondary)" }}>
                    {isVisible ? "On" : "Off"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
