import React, { useMemo, useState } from "react";
import { sortWidgetsForDisplay } from "@/lib/profile/personalWidgets";

export default function WidgetGrid({ widgets = [], renderWidget, onReorder = null }) {
  const visibleWidgets = useMemo(
    () => sortWidgetsForDisplay((widgets || []).filter((widget) => widget.isVisible !== false)),
    [widgets]
  );
  const [draggingWidgetId, setDraggingWidgetId] = useState(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState(null);

  const handleDrop = async (targetWidgetId) => {
    if (!draggingWidgetId || !targetWidgetId || draggingWidgetId === targetWidgetId) {
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
        maxHeight: "min(76vh, 980px)",
        overflowY: "auto",
        paddingRight: "6px",
        userSelect: draggingWidgetId ? "none" : "auto",
      }}
    >
      <div
        className="personal-widget-grid"
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          alignItems: "stretch",
        }}
      >
        {visibleWidgets.map((widget) => (
          <div
            key={widget.id}
            style={{
              minHeight: "280px",
              borderRadius: "20px",
              outline: dragOverWidgetId === widget.id ? "2px dashed rgba(var(--accent-purple-rgb), 0.8)" : "2px solid transparent",
              outlineOffset: "2px",
            }}
            draggable
            onDragStart={() => setDraggingWidgetId(widget.id)}
            onDragEnd={() => {
              setDraggingWidgetId(null);
              setDragOverWidgetId(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverWidgetId(widget.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(widget.id);
            }}
          >
            {renderWidget?.(widget)}
          </div>
        ))}
      </div>
    </div>
  );
}
