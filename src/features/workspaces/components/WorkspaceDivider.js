// file location: src/features/workspaces/components/WorkspaceDivider.js
//
// Draggable boundary between two visible workspaces. Pointer drag or keyboard
// (Left/Right in 2% steps, Home/End to the limits). Clamping to the minimum
// pane width lives in the model (resizePair), so this only reports a share.
import React, { useCallback, useRef, useState } from "react";

const KEY_STEP = 0.02;

export default function WorkspaceDivider({
  leftId,
  rightId,
  share,
  order,
  getPairRect,
  onResize,
  onResizeStart,
  onResizeEnd,
  leftLabel,
  rightLabel,
}) {
  const [dragging, setDragging] = useState(false);
  const rectRef = useRef(null);

  const report = useCallback(
    (nextShare) => {
      const rect = rectRef.current || getPairRect(leftId, rightId);
      if (!rect) return;
      onResize(leftId, rightId, nextShare, rect.width);
    },
    [getPairRect, leftId, rightId, onResize]
  );

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    const rect = getPairRect(leftId, rightId);
    if (!rect) return;
    rectRef.current = rect;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    setDragging(true);
    onResizeStart?.();
  };

  const onPointerMove = (event) => {
    if (!dragging || !rectRef.current) return;
    const { left, width } = rectRef.current;
    report((event.clientX - left) / width);
  };

  const endDrag = (event) => {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    rectRef.current = null;
    setDragging(false);
    onResizeEnd?.();
  };

  const onKeyDown = (event) => {
    const moves = {
      ArrowLeft: share - KEY_STEP,
      ArrowRight: share + KEY_STEP,
      Home: 0,
      End: 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    rectRef.current = null;
    report(moves[event.key]);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${leftLabel} and ${rightLabel}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share * 100)}
      aria-valuetext={`${leftLabel} ${Math.round(share * 100)}%, ${rightLabel} ${100 - Math.round(share * 100)}%`}
      tabIndex={0}
      className={`app-workspace-divider${dragging ? " is-dragging" : ""}`}
      style={{ order }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    />
  );
}
