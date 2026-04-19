// file location: src/components/VHC/PhotoEditorModal.js
// Post-capture photo annotation editor. Opens in a VHCModalShell and
// offers pen / shape (circle, square, line, arrow) / eraser tools with
// a preset colour palette, a line-width slider and undo / redo / reset
// history.
//
// Annotations live on an offscreen canvas that sits above the base
// photo; the visible canvas is a composite of photo + annotations +
// (optionally) an in-flight shape preview. Because the eraser only
// operates on the annotations layer, it can never damage the photo.
//
// All colour / radius / spacing / typography values resolve through
// the global design tokens in src/styles/theme.css so the editor
// follows the user's chosen theme in both light and dark mode.

import React, { useState, useRef, useEffect, useMemo } from "react";
import VHCModalShell from "./VHCModalShell";
import Button from "@/components/ui/Button";

const TOOLS = [
  { id: "pen", label: "✏️ Pen", desc: "Freehand draw", group: "draw" },
  { id: "circle", label: "⭕ Circle", desc: "Drag to size", group: "draw" },
  { id: "square", label: "▭ Square", desc: "Drag to size", group: "draw" },
  { id: "line", label: "／ Line", desc: "Drag endpoints", group: "draw" },
  { id: "arrow", label: "➜ Arrow", desc: "Point & shoot", group: "draw" },
  { id: "eraser", label: "🧹 Eraser", desc: "Remove marks only", group: "erase" },
];

const SHAPE_TOOLS = new Set(["circle", "square", "line", "arrow"]);

// Annotation palette. The first three swatches map to the global
// danger / warning / success tokens so the editor's default marker
// colours stay in lock-step with the rest of the app. They are
// resolved lazily at runtime because Canvas 2D's strokeStyle cannot
// consume CSS variables directly — the fallback hex matches the
// token's light-mode value so a cold SSR render still looks right.
const PRESET_PALETTE_TOKENS = [
  { token: "--danger", fallback: "#ef4444" },
  { token: "--warning", fallback: "#f59e0b" },
  { token: "--success", fallback: "#22c55e" },
  // Remaining slots are annotation-only primaries with no direct
  // semantic equivalent in the design system.
  { token: null, fallback: "#06b6d4" },
  { token: null, fallback: "#3b82f6" },
  { token: null, fallback: "#a855f7" },
  { token: null, fallback: "#ffffff" },
  { token: null, fallback: "#000000" },
];

function resolvePresetColors() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return PRESET_PALETTE_TOKENS.map((entry) => entry.fallback);
  }
  const styles = window.getComputedStyle(document.documentElement);
  return PRESET_PALETTE_TOKENS.map((entry) => {
    if (!entry.token) return entry.fallback;
    const resolved = styles.getPropertyValue(entry.token).trim();
    return resolved || entry.fallback;
  });
}

const PANEL_STYLE = {
  background: "var(--surfaceMain)",
  border: "1px solid var(--accentBorder)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-4)",
};

const SECTION_LABEL_STYLE = {
  fontSize: "var(--text-label)",
  fontWeight: 700,
  color: "var(--text-primary)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  marginBottom: "var(--space-sm)",
  display: "block",
};

export default function PhotoEditorModal({ isOpen, photoFile, onSave, onCancel, onSkip }) {
  const [tool, setTool] = useState("pen");
  const presetColors = useMemo(() => {
    void isOpen;
    return resolvePresetColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  const [color, setColor] = useState(() => resolvePresetColors()[0]);
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [imageLoaded, setImageLoaded] = useState(false);

  const canvasRef = useRef(null);
  const annotationsRef = useRef(null); // offscreen canvas: annotations only
  const imageRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });

  const historyRef = useRef({ list: [], step: -1 });
  historyRef.current = { list: history, step: historyStep };

  // --- Compositing ---------------------------------------------------
  // Paint base image + annotations into the visible canvas. An optional
  // `preview` callback lets in-flight shape drags render on top without
  // being committed to the annotations layer.
  const compose = (preview) => {
    const canvas = canvasRef.current;
    const base = imageRef.current;
    const ann = annotationsRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    if (ann) ctx.drawImage(ann, 0, 0);
    if (preview) preview(ctx);
  };

  // --- Image load ----------------------------------------------------
  useEffect(() => {
    if (!isOpen || !photoFile) {
      setImageLoaded(false);
      setHistory([]);
      setHistoryStep(-1);
      imageRef.current = null;
      annotationsRef.current = null;
      return undefined;
    }

    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const img = new Image();
    let objectUrl = null;

    const sourceIsFile = typeof photoFile !== "string";
    if (sourceIsFile) {
      objectUrl = URL.createObjectURL(photoFile);
      img.src = objectUrl;
    } else {
      img.src = photoFile;
    }

    const handleReady = () => {
      if (cancelled) return;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      canvas.width = w;
      canvas.height = h;

      // Create an offscreen annotations layer sized to the image.
      const ann = document.createElement("canvas");
      ann.width = w;
      ann.height = h;
      annotationsRef.current = ann;
      imageRef.current = img;

      compose();
      setImageLoaded(true);
      saveHistory(); // empty-annotations baseline
    };

    if (typeof img.decode === "function") {
      img.decode().then(handleReady).catch((err) => {
        if (cancelled) return;
        img.onload = handleReady;
        img.onerror = () => {
          console.error("Error loading image:", err);
          setImageLoaded(false);
        };
      });
    } else {
      img.onload = handleReady;
      img.onerror = (err) => {
        console.error("Error loading image:", err);
        setImageLoaded(false);
      };
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, photoFile]);

  // --- History (annotations-layer snapshots) ------------------------
  const saveHistory = () => {
    const ann = annotationsRef.current;
    if (!ann) return;
    const snapshot = ann.toDataURL();
    const { list, step } = historyRef.current;
    const newHistory = list.slice(0, step + 1);
    newHistory.push(snapshot);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const restoreFromHistory = (step) => {
    const ann = annotationsRef.current;
    if (!ann || !history[step]) return;
    const ctx = ann.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, ann.width, ann.height);
      ctx.drawImage(img, 0, 0);
      compose();
    };
    img.src = history[step];
  };

  const undo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      restoreFromHistory(prevStep);
      setHistoryStep(prevStep);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      restoreFromHistory(nextStep);
      setHistoryStep(nextStep);
    }
  };

  const resetToOriginal = () => {
    if (history.length > 0) {
      restoreFromHistory(0);
      setHistoryStep(0);
    }
  };

  // --- Pointer coords in image space --------------------------------
  const getCanvasCoordinates = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX;
    let clientY;
    if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // --- Shape drawing helpers ----------------------------------------
  const applyStrokeStyle = (ctx) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  };

  const drawShape = (ctx, type, a, b) => {
    applyStrokeStyle(ctx);
    if (type === "line") {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      return;
    }
    if (type === "arrow") {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const headLen = Math.max(12, lineWidth * 5);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(
        b.x - headLen * Math.cos(angle - Math.PI / 6),
        b.y - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        b.x - headLen * Math.cos(angle + Math.PI / 6),
        b.y - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (type === "square") {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      ctx.strokeRect(x, y, w, h);
      return;
    }
    if (type === "circle") {
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rx = Math.abs(b.x - a.x) / 2;
      const ry = Math.abs(b.y - a.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  // --- Pointer handlers ---------------------------------------------
  const startDrawing = (event) => {
    if (!imageLoaded) return;
    event.preventDefault();
    const pos = getCanvasCoordinates(event);
    lastPosRef.current = pos;
    startPosRef.current = pos;
    drawingRef.current = true;
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const ann = annotationsRef.current;
    if (!ann) return;

    const pos = getCanvasCoordinates(event);

    if (tool === "pen") {
      const ctx = ann.getContext("2d");
      applyStrokeStyle(ctx);
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPosRef.current = pos;
      compose();
      return;
    }

    if (tool === "eraser") {
      // destination-out targets the annotations canvas only, so the
      // base photo is untouched when we recomposite.
      const ctx = ann.getContext("2d");
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = lineWidth * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      lastPosRef.current = pos;
      compose();
      return;
    }

    if (SHAPE_TOOLS.has(tool)) {
      // Render the in-flight shape as a live preview — it is not
      // written into the annotations layer until pointer-up.
      compose((ctx) => drawShape(ctx, tool, startPosRef.current, pos));
      lastPosRef.current = pos;
    }
  };

  const stopDrawing = (event) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;

    if (SHAPE_TOOLS.has(tool)) {
      const ann = annotationsRef.current;
      const end = event ? getCanvasCoordinates(event) : lastPosRef.current;
      const start = startPosRef.current;
      const hasSize = Math.hypot(end.x - start.x, end.y - start.y) > 2;
      if (ann && hasSize) {
        const ctx = ann.getContext("2d");
        drawShape(ctx, tool, start, end);
        compose();
        saveHistory();
        return;
      }
      // Zero-size drag — just clear the preview.
      compose();
      return;
    }

    // Pen / eraser — a stroke already committed to the annotations
    // layer, so just snapshot.
    saveHistory();
  };

  // --- Export --------------------------------------------------------
  const exportImage = () => {
    // Ensure we flatten the latest annotations into the visible canvas
    // before reading a blob off it.
    compose();
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const fileName = `edited_${Date.now()}.jpg`;
          const file = new File([blob], fileName, { type: "image/jpeg" });
          onSave(file);
        }
      },
      "image/jpeg",
      0.92
    );
  };

  const canUndo = historyStep > 0;
  const canRedo = historyStep < history.length - 1;

  const drawTools = TOOLS.filter((t) => t.group === "draw");
  const eraseTools = TOOLS.filter((t) => t.group === "erase");

  const footer = (
    <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "space-between", width: "100%", flexWrap: "wrap" }}>
      <Button variant="ghost" size="sm" onClick={onCancel} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
        Cancel
      </Button>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {onSkip && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onSkip(photoFile)}
            disabled={!imageLoaded}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
          >
            Skip Editing
          </Button>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={resetToOriginal}
          disabled={historyStep === 0}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
        >
          Reset
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={exportImage}
          disabled={!imageLoaded}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
        >
          Save Edits
        </Button>
      </div>
    </div>
  );

  const renderToolButton = (t) => {
    const active = tool === t.id;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => setTool(t.id)}
        aria-pressed={active}
        style={{
          padding: "var(--space-sm) var(--space-3)",
          borderRadius: "var(--radius-sm)",
          border: `1px solid ${active ? "var(--accentBorderStrong)" : "var(--accentBorder)"}`,
          background: active ? "var(--accentSurfaceHover)" : "var(--surfaceMain)",
          color: active ? "var(--accentMain)" : "var(--text-primary)",
          fontSize: "var(--text-body-sm)",
          fontWeight: active ? 700 : 500,
          fontFamily: "var(--font-family)",
          cursor: "pointer",
          textAlign: "left",
          transition: "var(--control-transition)",
          display: "grid",
          gap: 2,
        }}
      >
        <span>{t.label}</span>
        <span style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
          {t.desc}
        </span>
      </button>
    );
  };

  return (
    <VHCModalShell
      isOpen={isOpen}
      title="Edit Photo"
      subtitle="Draw annotations, highlights, or notes on the photo"
      width="1000px"
      height="750px"
      onClose={onCancel}
      footer={footer}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: "var(--space-4)",
          height: "100%",
          minHeight: 0,
        }}
      >
        {/* Toolbar */}
        <aside
          style={{
            ...PANEL_STYLE,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
            overflowY: "auto",
          }}
        >
          <div>
            <span style={SECTION_LABEL_STYLE}>Pen</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {drawTools.map(renderToolButton)}
            </div>
          </div>

          <div>
            <span style={SECTION_LABEL_STYLE}>Erase</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {eraseTools.map(renderToolButton)}
            </div>
          </div>

          {tool !== "eraser" && (
            <div>
              <span style={SECTION_LABEL_STYLE}>Colour</span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "var(--space-sm)",
                }}
              >
                {presetColors.map((c) => {
                  const active = color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      aria-label={`Choose colour ${c}`}
                      aria-pressed={active}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius-sm)",
                        background: c,
                        border: active
                          ? "3px solid var(--accentMain)"
                          : "1px solid var(--accentBorder)",
                        cursor: "pointer",
                        transition: "var(--control-transition)",
                      }}
                    />
                  );
                })}
              </div>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Custom colour"
                style={{
                  width: "100%",
                  height: 36,
                  marginTop: "var(--space-sm)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--accentBorder)",
                  cursor: "pointer",
                  background: "var(--surfaceMain)",
                }}
              />
            </div>
          )}

          <div>
            <span style={SECTION_LABEL_STYLE}>
              {tool === "eraser" ? "Eraser size" : "Line width"}
              {" · "}
              <span style={{ fontWeight: 800, color: "var(--accentMain)" }}>{lineWidth}px</span>
            </span>
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor: "var(--accentMain)",
                cursor: "pointer",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              style={{
                flex: 1,
                padding: "var(--space-sm)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--accentBorder)",
                background: "var(--surfaceMain)",
                color: canUndo ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "var(--text-body-sm)",
                fontWeight: 600,
                cursor: canUndo ? "pointer" : "not-allowed",
                opacity: canUndo ? 1 : 0.55,
                fontFamily: "var(--font-family)",
                transition: "var(--control-transition)",
              }}
            >
              ↶ Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              style={{
                flex: 1,
                padding: "var(--space-sm)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--accentBorder)",
                background: "var(--surfaceMain)",
                color: canRedo ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "var(--text-body-sm)",
                fontWeight: 600,
                cursor: canRedo ? "pointer" : "not-allowed",
                opacity: canRedo ? 1 : 0.55,
                fontFamily: "var(--font-family)",
                transition: "var(--control-transition)",
              }}
            >
              ↷ Redo
            </button>
          </div>
        </aside>

        {/* Canvas stage */}
        <div
          style={{
            background: "var(--surfaceMutedToken)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--accentBorder)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            minHeight: 0,
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              cursor: "crosshair",
              touchAction: "none",
              visibility: imageLoaded ? "visible" : "hidden",
            }}
          />
          {!imageLoaded && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                color: "var(--text-secondary)",
                pointerEvents: "none",
              }}
            >
              <div style={{ fontSize: "var(--text-h1)", marginBottom: "var(--space-sm)" }}>📷</div>
              <div style={{ fontSize: "var(--text-body-sm)" }}>Loading image…</div>
            </div>
          )}
        </div>
      </div>
    </VHCModalShell>
  );
}
