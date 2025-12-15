// file location: src/components/VHC/PhotoEditorModal.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import VHCModalShell, { buildModalButton } from "./VHCModalShell";

export default function PhotoEditorModal({ isOpen, photoFile, onSave, onCancel }) {
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#FF0000");
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [imageLoaded, setImageLoaded] = useState(false);

  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Load image when modal opens
  useEffect(() => {
    if (isOpen && photoFile) {
      // Set loaded immediately to show canvas
      setImageLoaded(true);
      loadImage();
    } else {
      setImageLoaded(false);
    }
  }, [isOpen, photoFile]);

  // Load image to canvas - optimized for instant loading
  const loadImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const img = new Image();

      // Create object URL
      const url = URL.createObjectURL(photoFile);
      img.src = url;

      // Use decode() for faster rendering
      await img.decode();

      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw image immediately
      ctx.drawImage(img, 0, 0);

      // Save initial state
      imageRef.current = img;
      saveHistory();

      // Cleanup URL
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error loading image:", err);
      setImageLoaded(false);
    }
  };

  // Save canvas state to history
  const saveHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  // Undo
  const undo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      restoreFromHistory(prevStep);
      setHistoryStep(prevStep);
    }
  };

  // Redo
  const redo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      restoreFromHistory(nextStep);
      setHistoryStep(nextStep);
    }
  };

  // Restore canvas from history
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

  // Reset to original
  const resetToOriginal = () => {
    if (history.length > 0) {
      restoreFromHistory(0);
      setHistoryStep(0);
    }
  };

  // Get canvas coordinates from mouse/touch event
  const getCanvasCoordinates = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;

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

  // Start drawing
  const startDrawing = (event) => {
    event.preventDefault();
    const pos = getCanvasCoordinates(event);
    lastPosRef.current = pos;
    drawingRef.current = true;
    setIsDrawing(true);
  };

  // Draw
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

  // Stop drawing
  const stopDrawing = () => {
    if (drawingRef.current) {
      drawingRef.current = false;
      setIsDrawing(false);
      saveHistory();
    }
  };

  // Export canvas to blob
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

  // Preset colors
  const presetColors = [
    "#FF0000", // Red
    "#FFFF00", // Yellow
    "#00FF00", // Green
    "#00FFFF", // Cyan
    "#0000FF", // Blue
    "#FF00FF", // Magenta
    "#FFFFFF", // White
    "#000000", // Black
  ];

  // Modal footer
  const footer = (
    <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", width: "100%" }}>
      <button
        onClick={onCancel}
        style={{
          ...buildModalButton("ghost"),
          padding: "10px 20px",
        }}
      >
        Cancel
      </button>

      <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={resetToOriginal}
          style={{
            ...buildModalButton("secondary"),
            padding: "10px 20px",
          }}
          disabled={historyStep === 0}
        >
          Reset
        </button>

        <button
          onClick={exportImage}
          style={{
            ...buildModalButton("primary"),
            padding: "10px 20px",
          }}
          disabled={!imageLoaded}
        >
          Save & Continue
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
      <div style={{ display: "flex", gap: "16px", height: "100%" }}>
        {/* Toolbar */}
        <div style={{
          width: "200px",
          background: "var(--surface)",
          borderRadius: "12px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}>
          {/* Tools */}
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "8px" }}>
              Tool
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { id: "pen", label: "✏️ Pen", desc: "Draw lines" },
                { id: "highlighter", label: "🖍️ Highlighter", desc: "Transparent marks" },
                { id: "eraser", label: "🧹 Eraser", desc: "Remove marks" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: `2px solid ${tool === t.id ? "var(--primary)" : "var(--accent-purple-surface)"}`,
                    background: tool === t.id ? "var(--primary-surface)" : "var(--surface)",
                    color: tool === t.id ? "var(--primary)" : "var(--text)",
                    fontSize: "13px",
                    fontWeight: tool === t.id ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div>{t.label}</div>
                  <div style={{ fontSize: "11px", color: "var(--info)", marginTop: "2px" }}>
                    {t.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          {tool !== "eraser" && (
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "8px" }}>
                Color
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                {presetColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "6px",
                      background: c,
                      border: color === c ? "3px solid var(--primary)" : "1px solid var(--accent-purple-surface)",
                      cursor: "pointer",
                    }}
                    title={c}
                  />
                ))}
              </div>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{
                  width: "100%",
                  height: "36px",
                  marginTop: "8px",
                  borderRadius: "6px",
                  border: "1px solid var(--accent-purple-surface)",
                  cursor: "pointer",
                }}
              />
            </div>
          )}

          {/* Line Width */}
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "8px" }}>
              {tool === "eraser" ? "Eraser Size" : "Line Width"}: {lineWidth}px
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              style={{
                width: "100%",
              }}
            />
          </div>

          {/* Undo/Redo */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={undo}
              disabled={historyStep <= 0}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid var(--accent-purple-surface)",
                background: "var(--surface)",
                color: historyStep <= 0 ? "var(--info)" : "var(--text)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: historyStep <= 0 ? "not-allowed" : "pointer",
              }}
            >
              ↶ Undo
            </button>
            <button
              onClick={redo}
              disabled={historyStep >= history.length - 1}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid var(--accent-purple-surface)",
                background: "var(--surface)",
                color: historyStep >= history.length - 1 ? "var(--info)" : "var(--text)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: historyStep >= history.length - 1 ? "not-allowed" : "pointer",
              }}
            >
              ↷ Redo
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div style={{
          flex: 1,
          background: "var(--background)",
          borderRadius: "12px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}>
          {!imageLoaded ? (
            <div style={{ textAlign: "center", color: "var(--info)" }}>
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>📷</div>
              <div style={{ fontSize: "14px" }}>Loading image...</div>
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
                cursor: tool === "eraser" ? "crosshair" : "crosshair",
                touchAction: "none",
              }}
            />
          )}
        </div>
      </div>
    </VHCModalShell>
  );
}
