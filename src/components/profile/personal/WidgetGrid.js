import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getWidgetDefinition, sanitiseWidgetLayout, sortWidgetsForDisplay } from "@/lib/profile/personalWidgets";

const GRID_COLUMNS = 12;
const GRID_GAP = 16;
const GRID_ROW_HEIGHT = 104;
const COMPACT_BREAKPOINT = 900;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function WidgetGrid({
  widgets = [],
  onWidgetsChange,
  onWidgetsCommit,
  renderWidget,
}) {
  const containerRef = useRef(null);
  const widgetsRef = useRef(widgets);
  const interactionRef = useRef(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  useEffect(() => {
    const updateCompactState = () => {
      if (typeof window === "undefined") return;
      setIsCompact(window.innerWidth < COMPACT_BREAKPOINT);
    };
    updateCompactState();
    window.addEventListener("resize", updateCompactState);
    return () => window.removeEventListener("resize", updateCompactState);
  }, []);

  const visibleWidgets = useMemo(
    () => sortWidgetsForDisplay((widgets || []).filter((widget) => widget.isVisible !== false)),
    [widgets]
  );

  const updateWidgets = useCallback(
    (nextWidgets) => {
      const sanitised = sanitiseWidgetLayout(nextWidgets);
      onWidgetsChange?.(sanitised);
      return sanitised;
    },
    [onWidgetsChange]
  );

  const getGridMetrics = useCallback(() => {
    const width = containerRef.current?.clientWidth || 0;
    const usableWidth = Math.max(width - GRID_GAP * (GRID_COLUMNS - 1), GRID_COLUMNS * 60);
    return {
      cellWidth: usableWidth / GRID_COLUMNS,
      rowHeight: GRID_ROW_HEIGHT,
    };
  }, []);

  const endInteraction = useCallback(
    async (shouldCommit = true) => {
      const currentInteraction = interactionRef.current;
      if (!currentInteraction) return;

      window.removeEventListener("pointermove", currentInteraction.handleMove);
      window.removeEventListener("pointerup", currentInteraction.handleUp);
      interactionRef.current = null;

      if (shouldCommit && currentInteraction.nextWidgets) {
        await onWidgetsCommit?.(currentInteraction.nextWidgets);
      }
    },
    [onWidgetsCommit]
  );

  useEffect(() => () => {
    endInteraction(false);
  }, [endInteraction]);

  const startInteraction = useCallback(
    (event, widget, mode) => {
      if (isCompact) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget?.setPointerCapture?.(event.pointerId);

      const definition = getWidgetDefinition(widget.widgetType);

      const handleMove = (moveEvent) => {
        const interaction = interactionRef.current;
        if (!interaction) return;

        const metrics = getGridMetrics();
        const deltaX = moveEvent.clientX - interaction.startX;
        const deltaY = moveEvent.clientY - interaction.startY;
        const deltaCols = Math.round(deltaX / (metrics.cellWidth + GRID_GAP));
        const deltaRows = Math.round(deltaY / (metrics.rowHeight + GRID_GAP));

        const nextWidgets = widgetsRef.current.map((currentWidget) => {
          if (currentWidget.id !== interaction.widgetId) {
            return currentWidget;
          }

          if (interaction.mode === "drag") {
            return {
              ...currentWidget,
              positionX: clamp(interaction.snapshot.positionX + deltaCols, 1, GRID_COLUMNS - interaction.snapshot.width + 1),
              positionY: Math.max(1, interaction.snapshot.positionY + deltaRows),
            };
          }

          return {
            ...currentWidget,
            width: clamp(interaction.snapshot.width + deltaCols, definition.minWidth, GRID_COLUMNS - interaction.snapshot.positionX + 1),
            height: clamp(interaction.snapshot.height + deltaRows, definition.minHeight, 10),
          };
        });

        interaction.nextWidgets = updateWidgets(nextWidgets);
      };

      const handleUp = async () => {
        await endInteraction(true);
      };

      interactionRef.current = {
        widgetId: widget.id,
        mode,
        snapshot: widget,
        startX: event.clientX,
        startY: event.clientY,
        nextWidgets: widgetsRef.current,
        handleMove,
        handleUp,
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp, { once: true });
    },
    [endInteraction, getGridMetrics, isCompact, updateWidgets]
  );

  return (
    <div
      ref={containerRef}
      style={{
        display: "grid",
        gap: `${GRID_GAP}px`,
        gridTemplateColumns: isCompact ? "1fr" : `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
        gridAutoRows: `${GRID_ROW_HEIGHT}px`,
        alignItems: "stretch",
      }}
    >
      {visibleWidgets.map((widget) => {
        const definition = getWidgetDefinition(widget.widgetType);
        const dragHandleProps = isCompact
          ? null
          : {
              onPointerDown: (event) => startInteraction(event, widget, "drag"),
            };
        const resizeHandleProps = isCompact
          ? null
          : {
              onPointerDown: (event) => startInteraction(event, widget, "resize"),
            };

        return (
          <div
            key={widget.id}
            style={
              isCompact
                ? { minHeight: "260px" }
                : {
                    minHeight: 0,
                    gridColumn: `${widget.positionX} / span ${widget.width}`,
                    gridRow: `${widget.positionY} / span ${widget.height}`,
                  }
            }
          >
            {renderWidget?.(widget, {
              compact: isCompact,
              definition,
              dragHandleProps,
              resizeHandleProps,
            })}
          </div>
        );
      })}
    </div>
  );
}
