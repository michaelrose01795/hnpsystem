// file location: src/components/support/SupportScreenshotField.js
//
// Phase 3 — explicit, user-previewed, user-redactable screenshot capture for the
// Help & Diagnostics ("support") modal. There is NO silent capture (plan §4.5):
//   - The user clicks "Capture screen", which invokes getDisplayMedia (the
//     browser shows its own share-picker — the user chooses what to share).
//   - A single frame is grabbed, scaled down, and shown back to the user.
//   - The user can drag black redaction boxes over anything sensitive before it
//     is sent; only the FLATTENED (redactions baked in) image is emitted.
//   - "Remove" discards it entirely.
//
// The component owns its own pixels; the parent receives a PNG data URL (or null)
// via onChange and is otherwise unaware of the capture mechanics.

import React, { useCallback, useEffect, useRef, useState } from "react";

const MAX_DIMENSION = 1600; // cap the longest edge — keeps payload small

// Draw the captured frame + current redaction rectangles onto the visible canvas.
function paint(canvas, baseImage, rects) {
  if (!canvas || !baseImage) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  for (const r of rects) {
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

export default function SupportScreenshotField({ onChange }) {
  const canvasRef = useRef(null);
  const baseImageRef = useRef(null); // offscreen canvas holding the scaled frame
  const [dims, setDims] = useState(null); // { w, h } of the captured frame
  const [rects, setRects] = useState([]);
  const [drag, setDrag] = useState(null); // live drag rect { startX, startY, x, y, w, h }
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState(null);

  const hasImage = Boolean(dims);

  const supported =
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function";

  // Emit the flattened image (base + baked redactions) up to the parent.
  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImageRef.current) {
      onChange?.(null);
      return;
    }
    try {
      onChange?.(canvas.toDataURL("image/png"));
    } catch {
      onChange?.(null);
    }
  }, [onChange]);

  // Repaint whenever the captured frame or redaction set changes (including the
  // live drag rect). Only emit on committed state, not mid-drag.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!hasImage || !canvas) return;
    if (canvas.width !== dims.w) canvas.width = dims.w;
    if (canvas.height !== dims.h) canvas.height = dims.h;
    const live = drag ? [...rects, drag] : rects;
    paint(canvas, baseImageRef.current, live);
    if (!drag) emit();
  }, [dims, rects, drag, hasImage, emit]);

  const capture = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError("Screen capture is not available in this browser.");
      return;
    }
    setIsCapturing(true);
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      // Give the pipeline a frame to deliver real dimensions.
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));

      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(vw, vh));
      const w = Math.max(1, Math.round(vw * scale));
      const h = Math.max(1, Math.round(vh * scale));

      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      off.getContext("2d").drawImage(video, 0, 0, w, h);
      baseImageRef.current = off;

      setRects([]);
      setDrag(null);
      setDims({ w, h });
    } catch (err) {
      // User cancelled the picker (NotAllowedError/AbortError) — not an error.
      if (err?.name !== "NotAllowedError" && err?.name !== "AbortError") {
        setError("Could not capture the screen. You can still submit without a screenshot.");
      }
    } finally {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setIsCapturing(false);
    }
  }, [supported]);

  const remove = useCallback(() => {
    baseImageRef.current = null;
    setRects([]);
    setDrag(null);
    setDims(null);
    setError(null);
    onChange?.(null);
  }, [onChange]);

  const undoRedaction = useCallback(() => {
    setRects((prev) => prev.slice(0, -1));
  }, []);

  // ---- redaction drag handlers (map client coords → canvas pixels) ----
  const toCanvasPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = event.touches?.[0] || event;
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (point.clientX - rect.left) * sx,
      y: (point.clientY - rect.top) * sy,
    };
  };

  const onPointerDown = (event) => {
    if (!hasImage) return;
    event.preventDefault();
    const p = toCanvasPoint(event);
    setDrag({ startX: p.x, startY: p.y, x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (event) => {
    if (!drag) return;
    event.preventDefault();
    const p = toCanvasPoint(event);
    setDrag((d) => {
      const x = Math.min(d.startX, p.x);
      const y = Math.min(d.startY, p.y);
      return { ...d, x, y, w: Math.abs(p.x - d.startX), h: Math.abs(p.y - d.startY) };
    });
  };

  const onPointerUp = () => {
    if (!drag) return;
    const committed = drag;
    setDrag(null);
    // Ignore accidental taps (too small to be a real redaction).
    if (committed.w > 4 && committed.h > 4) {
      setRects((prev) => [...prev, { x: committed.x, y: committed.y, w: committed.w, h: committed.h }]);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <span style={{ fontWeight: 600, color: "var(--text-1)" }}>Screenshot (optional)</span>

      {!hasImage && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            className="app-btn app-btn--secondary"
            onClick={capture}
            disabled={isCapturing || !supported}
            style={{ alignSelf: "flex-start", minHeight: "44px" }}
          >
            {isCapturing ? "Capturing…" : "Capture screen"}
          </button>
          <span style={{ fontSize: "0.8rem", color: "var(--text-1)", opacity: 0.7 }}>
            {supported
              ? "You choose what to share, preview it here, and can black out anything private before sending."
              : "Screen capture is not supported on this device — you can still submit without one."}
          </span>
        </div>
      )}

      {/* The canvas is always mounted so its ref is available to capture(); it is
          simply hidden until a frame has been grabbed. */}
      <div style={{ display: hasImage ? "flex" : "none", flexDirection: "column", gap: "8px" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-1)", opacity: 0.7 }}>
          Drag over the image to black out anything you don&apos;t want to send.
        </span>
        <canvas
          ref={canvasRef}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
          style={{
            width: "100%",
            height: "auto",
            borderRadius: "var(--radius-md)",
            cursor: "crosshair",
            touchAction: "none",
            background: "var(--theme)",
          }}
        />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="app-btn app-btn--ghost"
            onClick={undoRedaction}
            disabled={rects.length === 0}
            style={{ minHeight: "44px" }}
          >
            Undo redaction
          </button>
          <button
            type="button"
            className="app-btn app-btn--ghost"
            onClick={capture}
            disabled={isCapturing}
            style={{ minHeight: "44px" }}
          >
            Retake
          </button>
          <button
            type="button"
            className="app-btn app-btn--danger"
            onClick={remove}
            style={{ minHeight: "44px" }}
          >
            Remove
          </button>
        </div>
      </div>

      {error && (
        <div className="app-status-message app-status-message--warning" role="status">
          {error}
        </div>
      )}
    </div>
  );
}
