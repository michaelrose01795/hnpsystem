// file location: src/components/VHC/photoEditor/ShapeRenderer.js
// Pure drawing helpers for the shape photo editor. These functions know
// how to paint vector shapes (circle, square, line, arrow) onto a 2D
// canvas context and how to hit-test against them for selection /
// move / resize interactions. They contain no React or UI state.

export const SHAPE_TOOLS = ["circle", "square", "line", "arrow"];

// Shared stroke settings. Kept thin-but-visible, no heavy fills. A
// faint translucent fill is used on closed shapes so they read well
// against both light and dark photos without obscuring detail.
const DEFAULT_STROKE = 2.5;
const FILL_ALPHA = 0.08;
const ARROW_HEAD_RATIO = 0.22;
const ARROW_HEAD_MAX = 28;
const ARROW_HEAD_MIN = 10;
const HANDLE_SIZE = 14;
const HIT_SLOP = 10;

function toRgba(hexOrRgb, alpha) {
  if (!hexOrRgb) return `rgba(255,255,255,${alpha})`;
  if (hexOrRgb.startsWith("rgb")) {
    const nums = hexOrRgb.match(/\d+(?:\.\d+)?/g) || [];
    const [r, g, b] = nums;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  let hex = hexOrRgb.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function applyStroke(ctx, color, scale) {
  ctx.strokeStyle = color;
  ctx.lineWidth = DEFAULT_STROKE * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

export function drawShape(ctx, shape, { scale = 1, selected = false, handleColor = "#ffffff", handleBorder = "#111111" } = {}) {
  const { type, color, x1, y1, x2, y2 } = shape;
  ctx.save();
  applyStroke(ctx, color, scale);

  if (type === "circle") {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = toRgba(color, FILL_ALPHA);
    ctx.fill();
    ctx.stroke();
  } else if (type === "square") {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    ctx.fillStyle = toRgba(color, FILL_ALPHA);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  } else if (type === "line") {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  } else if (type === "arrow") {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const headLen = Math.max(
      ARROW_HEAD_MIN * scale,
      Math.min(ARROW_HEAD_MAX * scale, len * ARROW_HEAD_RATIO)
    );
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  if (selected) {
    ctx.setLineDash([6 * scale, 4 * scale]);
    ctx.strokeStyle = toRgba(color, 0.7);
    ctx.lineWidth = 1 * scale;
    const bbox = getBoundingBox(shape);
    ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
    ctx.setLineDash([]);
    getHandles(shape).forEach((h) => {
      const s = HANDLE_SIZE * scale;
      ctx.fillStyle = handleColor;
      ctx.strokeStyle = handleBorder;
      ctx.lineWidth = 1.5 * scale;
      ctx.fillRect(h.x - s / 2, h.y - s / 2, s, s);
      ctx.strokeRect(h.x - s / 2, h.y - s / 2, s, s);
    });
  }

  ctx.restore();
}

export function renderScene(ctx, image, shapes, selectedId, viewScale = 1) {
  if (!ctx) return;
  const { canvas } = ctx;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (image) ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  shapes.forEach((s) =>
    drawShape(ctx, s, { scale: 1 / viewScale, selected: s.id === selectedId })
  );
}

export function getBoundingBox(shape) {
  const x = Math.min(shape.x1, shape.x2);
  const y = Math.min(shape.y1, shape.y2);
  const w = Math.abs(shape.x2 - shape.x1);
  const h = Math.abs(shape.y2 - shape.y1);
  return { x, y, w, h };
}

// Handles are endpoints for open shapes (line/arrow) and the four
// bbox corners for closed shapes (circle/square).
export function getHandles(shape) {
  if (shape.type === "line" || shape.type === "arrow") {
    return [
      { id: "p1", x: shape.x1, y: shape.y1 },
      { id: "p2", x: shape.x2, y: shape.y2 },
    ];
  }
  const { x, y, w, h } = getBoundingBox(shape);
  return [
    { id: "nw", x, y },
    { id: "ne", x: x + w, y },
    { id: "sw", x, y: y + h },
    { id: "se", x: x + w, y: y + h },
  ];
}

export function hitTestHandle(shape, px, py, viewScale = 1) {
  const slop = (HANDLE_SIZE / 2 + 4) / viewScale;
  return getHandles(shape).find(
    (h) => Math.abs(h.x - px) <= slop && Math.abs(h.y - py) <= slop
  );
}

export function hitTestShape(shape, px, py, viewScale = 1) {
  const slop = HIT_SLOP / viewScale;
  if (shape.type === "line" || shape.type === "arrow") {
    return distanceToSegment(px, py, shape.x1, shape.y1, shape.x2, shape.y2) <= slop;
  }
  const bb = getBoundingBox(shape);
  return (
    px >= bb.x - slop &&
    px <= bb.x + bb.w + slop &&
    py >= bb.y - slop &&
    py <= bb.y + bb.h + slop
  );
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function applyHandleDrag(shape, handleId, px, py) {
  if (shape.type === "line" || shape.type === "arrow") {
    if (handleId === "p1") return { ...shape, x1: px, y1: py };
    return { ...shape, x2: px, y2: py };
  }
  const bb = getBoundingBox(shape);
  let { x, y, w, h } = bb;
  if (handleId.includes("n")) { h = h + (y - py); y = py; }
  if (handleId.includes("s")) { h = py - y; }
  if (handleId.includes("w")) { w = w + (x - px); x = px; }
  if (handleId.includes("e")) { w = px - x; }
  return { ...shape, x1: x, y1: y, x2: x + w, y2: y + h };
}

export function translateShape(shape, dx, dy) {
  return {
    ...shape,
    x1: shape.x1 + dx,
    y1: shape.y1 + dy,
    x2: shape.x2 + dx,
    y2: shape.y2 + dy,
  };
}
