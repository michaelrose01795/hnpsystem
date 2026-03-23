import React, { useEffect, useMemo, useState } from "react";
import { sortWidgetsForDisplay } from "@/lib/profile/personalWidgets";

function useIsMobileBreakpoint() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const apply = () => setIsMobile(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  return isMobile;
}

export default function WidgetGrid({ widgets = [], renderWidget, onReorder = null, moveMode = false }) {
  const visibleWidgets = useMemo(
    () => sortWidgetsForDisplay((widgets || []).filter((widget) => widget.isVisible !== false)),
    [widgets]
  );
  const [draggingWidgetId, setDraggingWidgetId] = useState(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState(null);
  const isMobile = useIsMobileBreakpoint();

  const handleDrop = async (targetWidgetId) => {
    if (!moveMode || !draggingWidgetId || !targetWidgetId || draggingWidgetId === targetWidgetId) {
      setDraggingWidgetId(null);
      setDragOverWidgetId(null);
      return;
    }
    await onReorder?.(draggingWidgetId, targetWidgetId);
    setDraggingWidgetId(null);
    setDragOverWidgetId(null);
  };

  return (
    <div
      className="personal-widget-board"
      style={{
        maxHeight: "none",
        overflow: "visible",
        width: "100%",
        userSelect: moveMode ? "none" : "auto",
        WebkitUserSelect: moveMode ? "none" : "auto",
      }}
    >
      <div
        className="personal-widget-grid"
        style={{
          display: "grid",
          gap: isMobile ? "12px" : "16px",
          gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
          alignItems: "stretch",
        }}
      >
        {visibleWidgets.map((widget) => (
          <div
            key={widget.id}
            style={{
              minHeight: isMobile ? "220px" : "250px",
              borderRadius: "20px",
              outline:
                moveMode && dragOverWidgetId === widget.id
                  ? "2px dashed rgba(var(--accent-purple-rgb), 0.8)"
                  : "2px solid transparent",
              outlineOffset: "2px",
              position: "relative",
            }}
            draggable={moveMode}
            onDragStart={() => {
              if (!moveMode) return;
              setDraggingWidgetId(widget.id);
            }}
            onDragEnd={() => {
              setDraggingWidgetId(null);
              setDragOverWidgetId(null);
            }}
            onDragOver={(event) => {
              if (!moveMode) return;
              event.preventDefault();
              setDragOverWidgetId(widget.id);
            }}
            onDrop={(event) => {
              if (!moveMode) return;
              event.preventDefault();
              handleDrop(widget.id);
            }}
          >
            {moveMode ? (
              <div
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "12px",
                  zIndex: 5,
                  borderRadius: "999px",
                  border: "1px solid rgba(var(--accent-purple-rgb), 0.2)",
                  background: "rgba(var(--surface-rgb, 255, 255, 255), 0.92)",
                  padding: "6px 10px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  pointerEvents: "none",
                }}
              >
                Drag to move
              </div>
            ) : null}
            {renderWidget?.(widget)}
          </div>
        ))}
      </div>
    </div>
  );
}
