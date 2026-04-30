// file location: src/components/VHC/photoEditor/PhotoEditorCanvas.js
// Lightweight shape-annotation photo editor. Renders an image into a
// responsive canvas and lets the user highlight areas with a small
// set of vector shapes (circle, square, line, arrow). Shapes are kept
// as plain data so they can be moved, resized and undone cleanly.
//
// All visual styling flows through the global theme tokens in
// src/styles/theme.css so the editor picks up the active light / dark
// palette automatically.

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ShapeToolbar, { PALETTE } from "./ShapeToolbar";
import {
  renderScene,
  hitTestHandle,
  hitTestShape,
  applyHandleDrag,
  translateShape,
} from "./ShapeRenderer";

const STAGE_STYLE = {
  position: "relative",
  width: "100%",
  height: "100%",
  minHeight: 0,
  background: "var(--surfaceMutedToken, var(--surfaceMuted))",
  border: "1px solid var(--primary-border)",
  borderRadius: "var(--radius-md)",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const CANVAS_STYLE = {
  display: "block",
  maxWidth: "100%",
  maxHeight: "100%",
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const TOOLBAR_WRAPPER_BASE = {
  position: "absolute",
  zIndex: 2,
  pointerEvents: "auto",
};

function resolvePalette() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return PALETTE.map((p) => ({ ...p, resolved: p.fallback }));
  }
  const styles = window.getComputedStyle(document.documentElement);
  return PALETTE.map((p) => {
    const v = styles.getPropertyValue(p.token).trim();
    return { ...p, resolved: v || p.fallback };
  });
}

function uid() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < 720 : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setNarrow(window.innerWidth < 720);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}

export default function PhotoEditorCanvas({
  imageSource,
  initialShapes = [],
  onChange,
  className,
  style,
}) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const viewScaleRef = useRef(1);

  const [palette, setPalette] = useState(() => resolvePalette());
  const [tool, setTool] = useState("circle");
  const [color, setColor] = useState(() => resolvePalette()[0]);
  const [shapes, setShapes] = useState(initialShapes);
  const [selectedId, setSelectedId] = useState(null);
  const [imageReady, setImageReady] = useState(false);

  const dragRef = useRef(null);
  const narrow = useIsNarrow();

  // Keep shape list flowing to a parent consumer.
  useEffect(() => {
    if (onChange) onChange(shapes);
  }, [shapes, onChange]);

  // Re-resolve palette whenever the theme changes (class on html).
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const observer = new MutationObserver(() => {
      const next = resolvePalette();
      setPalette(next);
      setColor((prev) => next.find((p) => p.id === prev.id) || next[0]);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  // Load the source image into an offscreen HTMLImageElement.
  useEffect(() => {
    if (!imageSource) return undefined;
    let cancelled = false;
    let objectUrl = null;
    const img = new Image();
    img.crossOrigin = "anonymous";

    const src =
      typeof imageSource === "string"
        ? imageSource
        : (() => {
            objectUrl = URL.createObjectURL(imageSource);
            return objectUrl;
          })();

    img.onload = () => {
      if (cancelled) return;
      imageRef.current = img;
      setImageReady(true);
    };
    img.onerror = () => {
      if (!cancelled) setImageReady(false);
    };
    img.src = src;

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageSource]);

  // Fit the canvas to its stage while preserving image aspect ratio.
  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const img = imageRef.current;
    if (!canvas || !stage || !img) return;

    const stageRect = stage.getBoundingClientRect();
    const maxW = stageRect.width;
    const maxH = stageRect.height;
    if (maxW <= 0 || maxH <= 0) return;

    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const cssW = Math.max(1, Math.floor(img.naturalWidth * scale));
    const cssH = Math.max(1, Math.floor(img.naturalHeight * scale));

    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    // Our shape coordinates are stored in natural (image) space; scale
    // the context so we can draw in that space regardless of display size.
    const ctx = canvas.getContext("2d");
    const displayScale = cssW / img.naturalWidth;
    viewScaleRef.current = displayScale;
    ctx.setTransform(dpr * displayScale, 0, 0, dpr * displayScale, 0, 0);
    renderScene(ctx, img, shapes, selectedId, displayScale);
  }, [shapes, selectedId]);

  useLayoutEffect(() => {
    if (!imageReady) return undefined;
    fitCanvas();
    const ro = new ResizeObserver(fitCanvas);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [imageReady, fitCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    renderScene(ctx, img, shapes, selectedId, viewScaleRef.current);
  }, [shapes, selectedId]);

  // Convert a pointer event into image-natural-space coordinates.
  const toImageSpace = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = img.naturalWidth / rect.width;
    const sy = img.naturalHeight / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }, []);

  const findShapeAt = useCallback(
    (px, py) => {
      const vs = viewScaleRef.current;
      // Prefer the currently selected shape so its handles always win.
      if (selectedId) {
        const sel = shapes.find((s) => s.id === selectedId);
        if (sel) {
          const h = hitTestHandle(sel, px, py, vs);
          if (h) return { shape: sel, handle: h };
        }
      }
      // Otherwise iterate top-down (last drawn first).
      for (let i = shapes.length - 1; i >= 0; i -= 1) {
        const s = shapes[i];
        const h = hitTestHandle(s, px, py, vs);
        if (h) return { shape: s, handle: h };
      }
      for (let i = shapes.length - 1; i >= 0; i -= 1) {
        const s = shapes[i];
        if (hitTestShape(s, px, py, vs)) return { shape: s, handle: null };
      }
      return null;
    },
    [shapes, selectedId]
  );

  const handlePointerDown = (event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(event.pointerId);

    const { x, y } = toImageSpace(event.clientX, event.clientY);
    const hit = findShapeAt(x, y);

    if (hit) {
      setSelectedId(hit.shape.id);
      dragRef.current = hit.handle
        ? { mode: "resize", id: hit.shape.id, handleId: hit.handle.id }
        : { mode: "move", id: hit.shape.id, prevX: x, prevY: y };
      return;
    }

    // Empty space → create a new shape with the active tool.
    const newShape = {
      id: uid(),
      type: tool,
      color: color.resolved || color.fallback,
      colorId: color.id,
      x1: x,
      y1: y,
      x2: x,
      y2: y,
    };
    setShapes((list) => [...list, newShape]);
    setSelectedId(newShape.id);
    dragRef.current = { mode: "create", id: newShape.id };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    const { x, y } = toImageSpace(event.clientX, event.clientY);

    setShapes((list) =>
      list.map((s) => {
        if (s.id !== drag.id) return s;
        if (drag.mode === "create") return { ...s, x2: x, y2: y };
        if (drag.mode === "resize") return applyHandleDrag(s, drag.handleId, x, y);
        if (drag.mode === "move") {
          const dx = x - drag.prevX;
          const dy = y - drag.prevY;
          drag.prevX = x;
          drag.prevY = y;
          return translateShape(s, dx, dy);
        }
        return s;
      })
    );
  };

  const handlePointerUp = (event) => {
    const canvas = canvasRef.current;
    canvas?.releasePointerCapture?.(event.pointerId);
    const drag = dragRef.current;
    if (drag?.mode === "create") {
      // Drop zero-sized accidental taps.
      setShapes((list) =>
        list.filter((s) => {
          if (s.id !== drag.id) return true;
          const w = Math.abs(s.x2 - s.x1);
          const h = Math.abs(s.y2 - s.y1);
          return w > 3 || h > 3;
        })
      );
    }
    dragRef.current = null;
  };

  const handleUndo = useCallback(() => {
    setShapes((list) => {
      const next = list.slice(0, -1);
      setSelectedId((sel) => (next.find((s) => s.id === sel) ? sel : null));
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setShapes([]);
    setSelectedId(null);
  }, []);

  // Expose a simple imperative export via a data attribute handle.
  // Parent callers can call `canvas.toBlob` on the underlying element
  // after selecting by ref; we render a clean (unselected) pass first.
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;
    node.__exportImage = async (mime = "image/jpeg", quality = 0.92) => {
      const img = imageRef.current;
      if (!img) return null;
      const off = document.createElement("canvas");
      off.width = img.naturalWidth;
      off.height = img.naturalHeight;
      const ctx = off.getContext("2d");
      renderScene(ctx, img, shapes, null, 1);
      return new Promise((resolve) => off.toBlob(resolve, mime, quality));
    };
    return () => {
      delete node.__exportImage;
    };
  }, [shapes]);

  const toolbarWrapperStyle = useMemo(() => {
    if (narrow) {
      return {
        ...TOOLBAR_WRAPPER_BASE,
        left: "50%",
        bottom: "var(--space-3)",
        transform: "translateX(-50%)",
        maxWidth: "calc(100% - var(--space-4))",
      };
    }
    return {
      ...TOOLBAR_WRAPPER_BASE,
      top: "var(--space-3)",
      left: "50%",
      transform: "translateX(-50%)",
    };
  }, [narrow]);

  const paletteWithResolved = useMemo(() => palette, [palette]);
  const activeColor = paletteWithResolved.find((p) => p.id === color.id) || palette[0];

  return (
    <div ref={stageRef} className={className} style={{ ...STAGE_STYLE, ...style }}>
      {!imageReady ? (
        <div
          style={{
            textAlign: "center",
            color: "var(--text-1)",
            fontFamily: "var(--font-family)",
            fontSize: "var(--text-body-sm)",
          }}
        >
          Loading image…
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            style={{
              ...CANVAS_STYLE,
              cursor: dragRef.current ? "grabbing" : "crosshair",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          <div style={toolbarWrapperStyle}>
            <ShapeToolbar
              tool={tool}
              onToolChange={setTool}
              color={activeColor}
              onColorChange={setColor}
              onUndo={handleUndo}
              onClear={handleClear}
              canUndo={shapes.length > 0}
              canClear={shapes.length > 0}
              orientation={narrow ? "horizontal" : "horizontal"}
            />
          </div>
        </>
      )}
    </div>
  );
}
