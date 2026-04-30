// file location: src/components/VHC/PhotoEditorModal.js
// Post-capture photo annotation editor. Opens in a VHCModalShell and
// offers shape annotation tools with a fixed stroke width and a small
// preset colour palette.

import React, { useState, useRef, useEffect, useMemo } from "react";
import VHCModalShell from "./VHCModalShell";
import Button from "@/components/ui/Button";

const TOOLS = [
  { id: "circle", label: "Circle" },
  { id: "square", label: "Square" },
  { id: "line", label: "Line" },
  { id: "arrow", label: "Arrow" },
];

const SHAPE_TOOLS = new Set(["circle", "square", "line", "arrow"]);
const FIXED_LINE_WIDTH = 10;

const PRESET_PALETTE_TOKENS = [
  { token: "--danger", fallback: "#ef4444" },
  { token: "--success", fallback: "#22c55e" },
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
  background: "var(--surface)",
  border: "1px solid var(--primary-border)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-4)",
};

const SECTION_LABEL_STYLE = {
  fontSize: "var(--text-label)",
  fontWeight: 700,
  color: "var(--text-1)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  marginBottom: "var(--space-sm)",
  display: "block",
};

const TOOL_BUTTON_STYLE = {
  padding: "var(--space-sm) var(--space-3)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--text-body-sm)",
  fontFamily: "var(--font-family)",
  cursor: "pointer",
  textAlign: "center",
  transition: "var(--control-transition)",
  userSelect: "none",
};

export default function PhotoEditorModal({ isOpen, photoFile, onSave, onCancel, onSkip }) {
  const [tool, setTool] = useState("circle");
  const presetColors = useMemo(() => {
    void isOpen;
    return resolvePresetColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  const [color, setColor] = useState(() => resolvePresetColors()[0]);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [imageLoaded, setImageLoaded] = useState(false);

  const canvasRef = useRef(null);
  const annotationsRef = useRef(null);
  const imageRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });

  const historyRef = useRef({ list: [], step: -1 });
  historyRef.current = { list: history, step: historyStep };

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

    if (typeof photoFile !== "string") {
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

      const ann = document.createElement("canvas");
      ann.width = w;
      ann.height = h;
      annotationsRef.current = ann;
      imageRef.current = img;

      compose();
      setImageLoaded(true);
      saveHistory();
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

  const applyStrokeStyle = (ctx) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = FIXED_LINE_WIDTH;
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
      const headLen = Math.max(12, FIXED_LINE_WIDTH * 5);
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
    if (SHAPE_TOOLS.has(tool)) {
      compose((ctx) => drawShape(ctx, tool, startPosRef.current, pos));
      lastPosRef.current = pos;
    }
  };

  const stopDrawing = (event) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;

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
    compose();
  };

  const exportImage = () => {
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

  const headerActions = (
    <div
      style={{
        display: "flex",
        gap: "var(--space-2)",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        userSelect: "none",
      }}
    >
      {onSkip && (
        <Button variant="secondary" size="sm" onClick={() => onSkip(photoFile)} disabled={!imageLoaded}>
          Skip Edit
        </Button>
      )}
      <Button variant="secondary" size="sm" onClick={resetToOriginal} disabled={historyStep === 0}>
        Reset
      </Button>
      <Button variant="primary" size="sm" onClick={exportImage} disabled={!imageLoaded}>
        Save Edit
      </Button>
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
          ...TOOL_BUTTON_STYLE,
          border: `1px solid ${active ? "var(--primary-border)" : "var(--primary-border)"}`,
          background: active ? "var(--secondary-hover)" : "var(--surface)",
          color: active ? "var(--primary)" : "var(--text-1)",
          fontWeight: active ? 700 : 500,
        }}
      >
        {t.label}
      </button>
    );
  };

  return (
    <VHCModalShell
      isOpen={isOpen}
      title="Edit Photo"
      width="1000px"
      height="750px"
      onClose={onCancel}
      headerActions={headerActions}
      overlayStyle={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: "var(--space-4)",
          height: "100%",
          minHeight: 0,
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
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
            <span style={SECTION_LABEL_STYLE}>Shape</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--space-sm)" }}>
              {TOOLS.map(renderToolButton)}
            </div>
          </div>

          <div>
            <span style={SECTION_LABEL_STYLE}>Colour</span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
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
                      width: "100%",
                      height: 44,
                      borderRadius: "var(--control-radius)",
                      background: c,
                      border: active
                        ? "3px solid var(--primary)"
                        : "1px solid var(--primary-border)",
                      cursor: "pointer",
                      transition: "var(--control-transition)",
                    }}
                  />
                );
              })}
            </div>
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
                border: "1px solid var(--primary-border)",
                background: "var(--surface)",
                color: canUndo ? "var(--text-1)" : "var(--text-1)",
                fontSize: "var(--text-body-sm)",
                fontWeight: 600,
                cursor: canUndo ? "pointer" : "not-allowed",
                opacity: canUndo ? 1 : 0.55,
                fontFamily: "var(--font-family)",
                transition: "var(--control-transition)",
                userSelect: "none",
              }}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              style={{
                flex: 1,
                padding: "var(--space-sm)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--primary-border)",
                background: "var(--surface)",
                color: canRedo ? "var(--text-1)" : "var(--text-1)",
                fontSize: "var(--text-body-sm)",
                fontWeight: 600,
                cursor: canRedo ? "pointer" : "not-allowed",
                opacity: canRedo ? 1 : 0.55,
                fontFamily: "var(--font-family)",
                transition: "var(--control-transition)",
                userSelect: "none",
              }}
            >
              Redo
            </button>
          </div>
        </aside>

        <div
          style={{
            background: "var(--surfaceMutedToken)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--primary-border)",
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
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          />
          {!imageLoaded && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                color: "var(--text-1)",
                pointerEvents: "none",
                fontSize: "var(--text-body-sm)",
              }}
            >
              Loading image...
            </div>
          )}
        </div>
      </div>
    </VHCModalShell>
  );
}
