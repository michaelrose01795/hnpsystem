// file location: src/components/support/SupportScreenshotField.js
//
// Help & Diagnostics ("support") screenshot capture — multi-image gallery with
// per-image annotation, reordering, removal, and duplicate detection.
//
// Privacy model is unchanged (plan §4.5): NO silent capture. Every frame comes
// from getDisplayMedia (the browser shows its own share-picker — the user chooses
// what to share), is previewed here, and can be redacted (black boxes) before it
// is sent. Only the FLATTENED image (redactions baked in) is ever emitted.
//
// Behaviour:
//   - On open the popup asks to capture the underlying app screen immediately
//     (autoStart), falling back to a manual button when the browser blocks an
//     auto-start or doesn't support capture.
//   - The popup is HIDDEN during each capture (onCaptureVisibilityChange) so it's
//     never in the shot; the component stays mounted, so all state survives.
//   - "+ Add another" captures extra shots (capped). Identical re-captures are
//     detected and skipped.
//   - Each shot has an annotation field, and ↑/↓/Remove controls.
//   - Capture uses the stream's intrinsic device-pixel dimensions, so it is
//     correct across browser zoom levels and multi-monitor setups (the user picks
//     the surface in the browser's own picker).
//
// Value shape (in `initialScreenshots` and `onChange`): [{ src, annotation }].

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MAX_DRAFT_SCREENSHOTS } from "@/lib/support/supportDraft";

const MAX_DIMENSION = 1600; // cap the longest edge — keeps payload small
const MAX_SHOTS = MAX_DRAFT_SCREENSHOTS;

const nextFrame = () =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else resolve();
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Grab one frame from a display-media stream, scaled down, as a PNG data URL.
// Uses the stream's intrinsic dimensions (real device pixels) — independent of
// page/browser zoom — so the capture is reliable across zoom + monitors.
async function grabFrameDataUrl(stream) {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  await video.play();
  await nextFrame();

  const settings = stream.getVideoTracks?.()[0]?.getSettings?.() || {};
  const vw = video.videoWidth || settings.width || 1280;
  const vh = video.videoHeight || settings.height || 720;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(vw, vh));
  const w = Math.max(1, Math.round(vw * scale));
  const h = Math.max(1, Math.round(vh * scale));

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  off.getContext("2d").drawImage(video, 0, 0, w, h);
  return off.toDataURL("image/png");
}

// ---------------------------------------------------------------------------
// One editable (just-captured) shot: preview + drag-to-redact. Emits the
// flattened (base + baked redactions) PNG whenever the redaction set changes.
// ---------------------------------------------------------------------------
function EditableShot({ shotId, rawSrc, onChange, disabled }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [dims, setDims] = useState(null);
  const [rects, setRects] = useState([]);
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadImage(rawSrc)
      .then((img) => {
        if (cancelled) return;
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        imageRef.current = img;
        setDims({ w: Math.max(1, Math.round(img.width * scale)), h: Math.max(1, Math.round(img.height * scale)) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rawSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!dims || !canvas || !imageRef.current) return;
    if (canvas.width !== dims.w) canvas.width = dims.w;
    if (canvas.height !== dims.h) canvas.height = dims.h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    const live = drag ? [...rects, drag] : rects;
    for (const r of live) ctx.fillRect(r.x, r.y, r.w, r.h);
    if (!drag) {
      try {
        onChange(shotId, canvas.toDataURL("image/png"));
      } catch {
        /* keep existing src on failure */
      }
    }
  }, [dims, rects, drag, shotId, onChange]);

  const toCanvasPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = event.touches?.[0] || event;
    return {
      x: ((point.clientX - rect.left) * canvas.width) / rect.width,
      y: ((point.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const onPointerDown = (event) => {
    if (disabled) return;
    event.preventDefault();
    const p = toCanvasPoint(event);
    setDrag({ startX: p.x, startY: p.y, x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onPointerMove = (event) => {
    if (!drag) return;
    event.preventDefault();
    const p = toCanvasPoint(event);
    setDrag((d) => ({
      ...d,
      x: Math.min(d.startX, p.x),
      y: Math.min(d.startY, p.y),
      w: Math.abs(p.x - d.startX),
      h: Math.abs(p.y - d.startY),
    }));
  };
  const onPointerUp = () => {
    if (!drag) return;
    const committed = drag;
    setDrag(null);
    if (committed.w > 4 && committed.h > 4) {
      setRects((prev) => [...prev, { x: committed.x, y: committed.y, w: committed.w, h: committed.h }]);
    }
  };

  return (
    <>
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
          cursor: disabled ? "default" : "crosshair",
          touchAction: "none",
          background: "var(--theme)",
        }}
      />
      <button
        type="button"
        className="app-btn app-btn--ghost"
        onClick={() => setRects((prev) => prev.slice(0, -1))}
        disabled={disabled || rects.length === 0}
        style={{ minHeight: "44px", alignSelf: "flex-start" }}
      >
        Undo redaction
      </button>
    </>
  );
}

let shotSeq = 0;
const nextShotId = () => {
  shotSeq += 1;
  return `shot-${shotSeq}`;
};

const toItem = (shot) => ({
  id: nextShotId(),
  src: typeof shot === "string" ? shot : shot.src,
  annotation: typeof shot === "string" ? "" : shot.annotation || "",
  rawSrc: null, // restored shots are static (redactions already baked)
});

export default function SupportScreenshotsField({
  initialScreenshots = [],
  resetSignal = 0,
  autoStart = false,
  onChange,
  onCaptureVisibilityChange,
}) {
  const [items, setItems] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState(null);
  const autoStartedRef = useRef(false);

  const supported =
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function";

  // (Re)initialise from the saved draft on open / Clear.
  useEffect(() => {
    setItems(
      (Array.isArray(initialScreenshots) ? initialScreenshots : [])
        .filter((s) => (typeof s === "string" ? s : s?.src)?.startsWith?.("data:image/"))
        .slice(0, MAX_SHOTS)
        .map(toItem)
    );
    setError(null);
    autoStartedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const emit = useCallback(
    (list) => {
      onChange?.(list.filter((it) => it.src).map((it) => ({ src: it.src, annotation: it.annotation || "" })));
    },
    [onChange]
  );

  const updateItems = useCallback(
    (updater) => {
      setItems((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        emit(next);
        return next;
      });
    },
    [emit]
  );

  const handleShotSrc = useCallback(
    (id, src) => updateItems((prev) => prev.map((it) => (it.id === id ? { ...it, src } : it))),
    [updateItems]
  );
  const handleAnnotation = useCallback(
    (id, annotation) => updateItems((prev) => prev.map((it) => (it.id === id ? { ...it, annotation } : it))),
    [updateItems]
  );
  const handleRemove = useCallback((id) => updateItems((prev) => prev.filter((it) => it.id !== id)), [updateItems]);
  const move = useCallback(
    (id, dir) =>
      updateItems((prev) => {
        const i = prev.findIndex((it) => it.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= prev.length) return prev;
        const next = prev.slice();
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      }),
    [updateItems]
  );

  const capture = useCallback(async () => {
    if (isCapturing) return;
    setError(null);
    if (!supported) {
      setError("Screen capture is not available in this browser.");
      return;
    }
    if (items.length >= MAX_SHOTS) {
      setError(`You can attach up to ${MAX_SHOTS} screenshots.`);
      return;
    }

    setIsCapturing(true);
    onCaptureVisibilityChange?.(true);
    await nextFrame();

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: false,
      });
      const dataUrl = await grabFrameDataUrl(stream);
      // Duplicate detection — identical pixels → identical PNG data URL.
      if (items.some((it) => it.src === dataUrl)) {
        setError("That looks identical to a screenshot you already added — skipped.");
      } else {
        updateItems((prev) => [...prev, { id: nextShotId(), src: dataUrl, rawSrc: dataUrl, annotation: "" }]);
      }
    } catch (err) {
      if (err?.name !== "NotAllowedError" && err?.name !== "AbortError") {
        setError("Could not capture the screen. You can still submit without a screenshot.");
      }
    } finally {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      onCaptureVisibilityChange?.(false);
      setIsCapturing(false);
    }
  }, [isCapturing, supported, items, updateItems, onCaptureVisibilityChange]);

  // Auto-start a first capture on open (once per reset) when nothing is attached.
  useEffect(() => {
    if (!autoStart || autoStartedRef.current || !supported || items.length > 0) return;
    autoStartedRef.current = true;
    capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, resetSignal, supported]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <span style={{ fontWeight: 600, color: "var(--text-1)" }}>Screenshots (optional)</span>
        <button
          type="button"
          className="app-btn app-btn--secondary"
          onClick={capture}
          disabled={isCapturing || !supported || items.length >= MAX_SHOTS}
          aria-label="Add a screenshot"
          style={{ minHeight: "44px" }}
        >
          {isCapturing ? "Capturing…" : items.length ? "+ Add another" : "+ Capture screen"}
        </button>
      </div>

      {!supported && (
        <span style={{ fontSize: "0.8rem", color: "var(--text-1)", opacity: 0.7 }}>
          Screen capture isn&apos;t supported on this device — you can still submit without one.
        </span>
      )}

      {supported && items.length === 0 && !isCapturing && (
        <span style={{ fontSize: "0.8rem", color: "var(--text-1)", opacity: 0.7 }}>
          You choose what to share, preview it here, and can black out anything private before sending.
          The report popup is hidden while the screen is captured.
        </span>
      )}

      {items.map((item, index) => (
        <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-1)" }}>
              Screenshot {index + 1}
              {item.rawSrc ? " — drag on the image to black out anything private" : ""}
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className="app-btn app-btn--ghost"
                onClick={() => move(item.id, -1)}
                disabled={isCapturing || index === 0}
                aria-label={`Move screenshot ${index + 1} up`}
                style={{ minHeight: "44px", minWidth: "44px" }}
              >
                ↑
              </button>
              <button
                type="button"
                className="app-btn app-btn--ghost"
                onClick={() => move(item.id, 1)}
                disabled={isCapturing || index === items.length - 1}
                aria-label={`Move screenshot ${index + 1} down`}
                style={{ minHeight: "44px", minWidth: "44px" }}
              >
                ↓
              </button>
              <button
                type="button"
                className="app-btn app-btn--danger"
                onClick={() => handleRemove(item.id)}
                disabled={isCapturing}
                style={{ minHeight: "44px" }}
              >
                Remove
              </button>
            </div>
          </div>

          {item.rawSrc ? (
            <EditableShot shotId={item.id} rawSrc={item.rawSrc} onChange={handleShotSrc} disabled={isCapturing} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.src}
              alt={`Attached screenshot ${index + 1}`}
              style={{ width: "100%", height: "auto", borderRadius: "var(--radius-md)", background: "var(--theme)" }}
            />
          )}

          <input
            className="app-input"
            type="text"
            value={item.annotation}
            maxLength={500}
            onChange={(event) => handleAnnotation(item.id, event.target.value)}
            placeholder="Add a note about this screenshot (optional)"
            aria-label={`Note for screenshot ${index + 1}`}
            disabled={isCapturing}
          />
        </div>
      ))}

      {error && (
        <div className="app-status-message app-status-message--warning" role="status">
          {error}
        </div>
      )}
    </div>
  );
}
