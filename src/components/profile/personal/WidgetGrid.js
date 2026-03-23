import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitiseWidgetLayout, sortWidgetsForDisplay } from "@/lib/profile/personalWidgets";

const GRID_COLUMNS = 2;
const SWAP_DELAY_MS = 1700;
const COMPACT_BREAKPOINT = 1024;

function reorderVisibleWidgets(visibleWidgets, sourceIndex, targetIndex) {
  if (sourceIndex === targetIndex) {
    return visibleWidgets;
  }

  const next = [...visibleWidgets];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

export default function WidgetGrid({
  widgets = [],
  onWidgetsChange,
  onWidgetsCommit,
  renderWidget,
}) {
  const [isCompact, setIsCompact] = useState(false);
  const [moveModeWidgetId, setMoveModeWidgetId] = useState(null);
  const [draggedWidgetId, setDraggedWidgetId] = useState(null);
  const [hoveredWidgetId, setHoveredWidgetId] = useState(null);
  const [pendingSwapWidgetId, setPendingSwapWidgetId] = useState(null);
  const pendingSwapTimerRef = useRef(null);

  useEffect(() => {
    const updateCompactState = () => {
      if (typeof window === "undefined") return;
      setIsCompact(window.innerWidth < COMPACT_BREAKPOINT);
    };
    updateCompactState();
    window.addEventListener("resize", updateCompactState);
    return () => window.removeEventListener("resize", updateCompactState);
  }, []);

  useEffect(() => {
    if (isCompact && moveModeWidgetId) {
      setMoveModeWidgetId(null);
      setDraggedWidgetId(null);
      setHoveredWidgetId(null);
      setPendingSwapWidgetId(null);
    }
  }, [isCompact, moveModeWidgetId]);

  const cancelPendingSwap = useCallback(() => {
    if (pendingSwapTimerRef.current) {
      window.clearTimeout(pendingSwapTimerRef.current);
      pendingSwapTimerRef.current = null;
    }
    setPendingSwapWidgetId(null);
  }, []);

  useEffect(() => () => cancelPendingSwap(), [cancelPendingSwap]);

  const visibleWidgets = useMemo(
    () => sortWidgetsForDisplay((widgets || []).filter((widget) => widget.isVisible !== false)),
    [widgets]
  );

  const visibleWidgetIds = useMemo(() => visibleWidgets.map((widget) => widget.id), [visibleWidgets]);

  useEffect(() => {
    if (moveModeWidgetId && !visibleWidgetIds.includes(moveModeWidgetId)) {
      setMoveModeWidgetId(null);
      setDraggedWidgetId(null);
      setHoveredWidgetId(null);
      cancelPendingSwap();
    }
  }, [cancelPendingSwap, moveModeWidgetId, visibleWidgetIds]);

  const mergeVisibleWithAllWidgets = useCallback(
    (nextVisibleWidgets) => {
      const visibleMap = new Map(nextVisibleWidgets.map((widget) => [widget.id, widget]));
      const merged = widgets.map((widget) => {
        if (widget.isVisible === false) {
          return widget;
        }
        return visibleMap.get(widget.id) || widget;
      });
      return sanitiseWidgetLayout(merged);
    },
    [widgets]
  );

  const applySwap = useCallback(
    async (sourceWidgetId, targetWidgetId) => {
      if (!sourceWidgetId || !targetWidgetId || sourceWidgetId === targetWidgetId) {
        return;
      }

      const sourceIndex = visibleWidgets.findIndex((widget) => widget.id === sourceWidgetId);
      const targetIndex = visibleWidgets.findIndex((widget) => widget.id === targetWidgetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return;
      }

      const reorderedVisibleWidgets = reorderVisibleWidgets(visibleWidgets, sourceIndex, targetIndex);
      const mergedWidgets = mergeVisibleWithAllWidgets(reorderedVisibleWidgets);
      onWidgetsChange?.(mergedWidgets);
      await onWidgetsCommit?.(mergedWidgets);
    },
    [mergeVisibleWithAllWidgets, onWidgetsChange, onWidgetsCommit, visibleWidgets]
  );

  const startPendingSwap = useCallback(
    (sourceWidgetId, targetWidgetId) => {
      cancelPendingSwap();
      setPendingSwapWidgetId(targetWidgetId);
      pendingSwapTimerRef.current = window.setTimeout(async () => {
        pendingSwapTimerRef.current = null;
        setPendingSwapWidgetId(null);
        await applySwap(sourceWidgetId, targetWidgetId);
      }, SWAP_DELAY_MS);
    },
    [applySwap, cancelPendingSwap]
  );

  const isMoveMode = Boolean(moveModeWidgetId);

  return (
    <div
      className={isMoveMode ? "personal-widget-board personal-widget-board--move" : "personal-widget-board"}
      style={{
        maxHeight: "min(72vh, 980px)",
        overflowY: "auto",
        paddingRight: "6px",
      }}
    >
      <div
        className={isMoveMode ? "personal-widget-grid personal-widget-grid--active" : "personal-widget-grid"}
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: isCompact ? "1fr" : `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
          alignItems: "stretch",
        }}
      >
        {visibleWidgets.map((widget, index) => {
          const isSlotHovered = hoveredWidgetId === widget.id;
          const isSwapPending = pendingSwapWidgetId === widget.id;
          const isDraggingWidget = draggedWidgetId === widget.id;
          const canDrag = !isCompact && moveModeWidgetId === widget.id;

          return (
            <div
              key={widget.id}
              draggable={canDrag}
              onDragStart={(event) => {
                if (!canDrag) {
                  event.preventDefault();
                  return;
                }
                setDraggedWidgetId(widget.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", widget.id);
              }}
              onDragEnd={() => {
                setDraggedWidgetId(null);
                setHoveredWidgetId(null);
                cancelPendingSwap();
              }}
              onDragOver={(event) => {
                if (!draggedWidgetId || draggedWidgetId === widget.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDragEnter={() => {
                if (!draggedWidgetId || draggedWidgetId === widget.id) return;
                setHoveredWidgetId(widget.id);
                startPendingSwap(draggedWidgetId, widget.id);
              }}
              onDragLeave={(event) => {
                if (!draggedWidgetId || draggedWidgetId === widget.id) return;
                const relatedTarget = event.relatedTarget;
                if (event.currentTarget.contains(relatedTarget)) {
                  return;
                }
                setHoveredWidgetId((current) => (current === widget.id ? null : current));
                cancelPendingSwap();
              }}
              style={{
                minHeight: "280px",
                borderRadius: "20px",
                border: isMoveMode
                  ? isSwapPending
                    ? "2px solid rgba(var(--warning-rgb, 239,108,0), 0.82)"
                    : isSlotHovered
                      ? "2px dashed rgba(var(--accent-purple-rgb), 0.8)"
                      : "1px dashed rgba(var(--accent-purple-rgb), 0.35)"
                  : "1px solid transparent",
                background: isMoveMode
                  ? isDraggingWidget
                    ? "rgba(var(--accent-purple-rgb), 0.14)"
                    : "rgba(var(--accent-purple-rgb), 0.05)"
                  : "transparent",
                padding: isMoveMode ? "6px" : 0,
                transition: "border-color 140ms ease, background 140ms ease",
              }}
            >
              {renderWidget?.(widget, {
                compact: isCompact,
                isMoveMode,
                canDrag,
                isDraggingWidget,
                hoveredWidgetId,
                pendingSwapWidgetId,
                moveButtonProps: {
                  onClick: () => {
                    if (isCompact) return;
                    setMoveModeWidgetId((current) => (current === widget.id ? null : widget.id));
                    setDraggedWidgetId(null);
                    setHoveredWidgetId(null);
                    cancelPendingSwap();
                  },
                  disabled: isCompact,
                },
                moveSlotIndex: index,
                swapDelayMs: SWAP_DELAY_MS,
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
