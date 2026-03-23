import React, { useMemo } from "react";
import { sortWidgetsForDisplay } from "@/lib/profile/personalWidgets";

export default function WidgetGrid({ widgets = [], renderWidget }) {
  const visibleWidgets = useMemo(
    () => sortWidgetsForDisplay((widgets || []).filter((widget) => widget.isVisible !== false)),
    [widgets]
  );

  return (
    <div
      className="personal-widget-board"
      style={{
        maxHeight: "min(76vh, 980px)",
        overflowY: "auto",
        paddingRight: "6px",
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
          <div key={widget.id} style={{ minHeight: "280px" }}>
            {renderWidget?.(widget)}
          </div>
        ))}
      </div>
    </div>
  );
}
