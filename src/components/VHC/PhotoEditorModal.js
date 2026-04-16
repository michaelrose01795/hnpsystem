// file location: src/components/VHC/PhotoEditorModal.js
// Post-capture photo annotation editor. Opens in a VHCModalShell and
// offers pen / highlighter / eraser tools with a preset colour palette,
// a line-width slider and undo / redo / reset history.
//
// All colour / radius / spacing / typography values resolve through
// the global design tokens in src/styles/theme.css so the editor
// follows the user's chosen theme in both light and dark mode.

import React, { useState, useRef, useEffect, useMemo } from "react";
import VHCModalShell, { buildModalButton } from "./VHCModalShell";

const TOOLS = [
  { id: "pen", label: "✏️ Pen", desc: "Draw lines" },
  { id: "highlighter", label: "🖍️ Highlighter", desc: "Transparent marks" },
  { id: "eraser", label: "🧹 Eraser", desc: "Remove marks" },
];

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
  // Swatches resolve to the live theme tokens — re-read whenever the
  // modal opens so an accent/theme change between opens is reflected.
  const presetColors = useMemo(() => {
    // isOpen is a dependency so the palette is re-evaluated on each open.
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
  const imageRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  // Latest history needed inside callbacks that don't re-subscribe.
  const historyRef = useRef({ list: [], step: -1 });
  historyRef.current = { list: history, step: historyStep };

  useEffect(() => {
    if (isOpen && photoFile) {
      setImageLoaded(true);
      loadImage();
    } else {
      setImageLoaded(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, photoFile]);

  const loadImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const img = new Image();
      const url = URL.createObjectURL(photoFile);
      img.src = url;
      await img.decode();

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      imageRef.current = img;
      saveHistory();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error loading image:", err);
      setImageLoaded(false);
    }
  };

  const saveHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL();
    const { list, step } = historyRef.current;
    const newHistory = list.slice(0, step + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
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

  const restoreFromHistory = (step) => {
    const canvas = canvasRef.current;
    if (!canvas || !history[step]) return;

    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = history[step];
  };

  const resetToOriginal = () => {
    if (history.length > 0) {
      restoreFromHistory(0);
      setHistoryStep(0);
    }
  };

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

  const startDrawing = (event) => {
    event.preventDefault();
    const pos = getCanvasCoordinates(event);
    lastPosRef.current = pos;
    drawingRef.current = true;
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const pos = getCanvasCoordinates(event);

    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);

    if (tool === "pen") {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "source-over";
    } else if (tool === "highlighter") {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.3;
      ctx.globalCompositeOperation = "source-over";
    } else if (tool === "eraser") {
      ctx.strokeStyle = "white";
      ctx.lineWidth = lineWidth * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "destination-out";
    }

    ctx.stroke();
    ctx.globalAlpha = 1.0;
    lastPosRef.current = pos;
  };

  const stopDrawing = () => {
    if (drawingRef.current) {
      drawingRef.current = false;
      saveHistory();
    }
  };

  const exportImage = () => {
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

  const footer = (
    <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "space-between", width: "100%", flexWrap: "wrap" }}>
      <button onClick={onCancel} style={buildModalButton("ghost")}>
        Cancel
      </button>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {onSkip && (
          <button
            onClick={() => onSkip(photoFile)}
            style={buildModalButton("secondary", { disabled: !imageLoaded })}
            disabled={!imageLoaded}
          >
            Skip Editing
          </button>
        )}

        <button
          onClick={resetToOriginal}
          style={buildModalButton("secondary", { disabled: historyStep === 0 })}
          disabled={historyStep === 0}
        >
          Reset
        </button>

        <button
          onClick={exportImage}
          style={buildModalButton("primary", { disabled: !imageLoaded })}
          disabled={!imageLoaded}
        >
          Save Edits
        </button>
      </div>
    </div>
  );

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
            <span style={SECTION_LABEL_STYLE}>Tool</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {TOOLS.map((t) => {
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
              })}
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
          {!imageLoaded ? (
            <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
              <div style={{ fontSize: "var(--text-h1)", marginBottom: "var(--space-sm)" }}>📷</div>
              <div style={{ fontSize: "var(--text-body-sm)" }}>Loading image…</div>
            </div>
          ) : (
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
              }}
            />
          )}
        </div>
      </div>
    </VHCModalShell>
  );
}
