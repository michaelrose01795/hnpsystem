// file location: src/features/tracking/map/trackingMapLayout.js
// Data model + persistence for the /tracking site map editor.
//
// Every section on the map (road / building / parking / grass) is an item:
//   { id, type, variant?, x, y, w, h, rotate?, radius?, label?, spaces? }
// x/y/w/h are % of the map stage so the whole layout scales responsively.
// `variant` keeps the special hand-drawn paint classes (curved sweeps, the
// left loop ring) from trackingMap.css; position/size always come from the
// item so even the original shapes can be moved, resized or deleted.
//
// "Save" in the editor captures the current items and stores them here —
// the map then always renders those fixed positions. DEFAULT_LAYOUT is the
// hardcoded baseline (the original drawn map); "Copy layout" in the editor
// exports JSON that can be pasted over DEFAULT_LAYOUT to bake a new baseline
// in for every user/browser.

const STORAGE_KEY = "hnp-tracking-site-map-layout-v1";

const VALID_TYPES = new Set(["road", "building", "parking", "grass"]);

// The original hand-drawn map, converted 1:1 from the old fixed CSS classes.
export const DEFAULT_LAYOUT = [
  // Tarmac network
  { id: "road-main-top", type: "road", variant: "road-main-top", x: 16, y: 19, w: 66, h: 8, label: "Main road" },
  { id: "road-top-curve", type: "road", variant: "road-top-curve", x: 28, y: 9, w: 46, h: 5 },
  { id: "road-top-right-pad", type: "road", variant: "road-top-right-pad", x: 71, y: 4, w: 24, h: 18 },
  { id: "road-left-entry", type: "road", variant: "road-left-entry", x: 5, y: 29, w: 28, h: 9, rotate: -32 },
  { id: "road-left-loop", type: "road", variant: "road-left-loop", x: 9, y: 43, w: 45, h: 38, label: "Customer / parking loop" },
  { id: "road-centre-link", type: "road", variant: "road-centre-link", x: 47, y: 50, w: 17, h: 16 },
  { id: "road-right-yard", type: "road", variant: "road-right-yard", x: 58, y: 44, w: 34, h: 45, label: "Yard" },
  { id: "road-bottom", type: "road", variant: "road-bottom", x: 1, y: 86, w: 92, h: 10 },
  // Landscaping
  { id: "grass-island", type: "grass", x: 51, y: 79, w: 24, h: 8 },
  // Buildings — large workshops right, small cluster centre
  { id: "building-large-top", type: "building", x: 53, y: 34, w: 27, h: 13, label: "Workshop" },
  { id: "building-large-bottom", type: "building", x: 53, y: 58, w: 22, h: 12 },
  { id: "building-small-left", type: "building", x: 35, y: 40, w: 9, h: 16, rotate: -8 },
  { id: "building-centre-tall", type: "building", x: 47, y: 39, w: 8, h: 18, rotate: 1 },
  { id: "building-centre-low", type: "building", x: 52, y: 52, w: 12, h: 8 },
  // Parking bays along the top road and left entrance
  { id: "bay-a", type: "parking", x: 28, y: 11, w: 5, h: 4, spaces: 3 },
  { id: "bay-b", type: "parking", x: 43, y: 10, w: 5, h: 4, spaces: 3 },
  { id: "bay-c", type: "parking", x: 59, y: 10, w: 5, h: 4, spaces: 3 },
  { id: "bay-d", type: "parking", x: 10, y: 28, w: 5, h: 4, rotate: -45, spaces: 3 },
];

// Sensible starting geometry when placing a new section from the editbar.
const TYPE_DEFAULTS = {
  road: { w: 30, h: 7, radius: "14px" },
  building: { w: 14, h: 10 },
  grass: { w: 16, h: 7 },
  parking: { w: 18, h: 5, spaces: 10 },
};

let createdCount = 0;

export function createMapItem(type, overrides = {}) {
  createdCount += 1;
  return {
    id: `${type}-${Date.now().toString(36)}-${createdCount}`,
    type,
    x: 40,
    y: 40,
    rotate: 0,
    label: "",
    ...TYPE_DEFAULTS[type],
    ...overrides,
  };
}

export function getDefaultLayout() {
  return DEFAULT_LAYOUT.map((item) => ({ ...item }));
}

const sanitizeItem = (item) => {
  if (!item || typeof item !== "object") return null;
  if (!VALID_TYPES.has(item.type)) return null;
  const x = Number(item.x);
  const y = Number(item.y);
  const w = Number(item.w);
  const h = Number(item.h);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  return {
    id: String(item.id || `${item.type}-${Math.abs(x)}-${Math.abs(y)}`),
    type: item.type,
    ...(item.variant ? { variant: String(item.variant) } : null),
    x, y, w, h,
    rotate: Number.isFinite(Number(item.rotate)) ? Number(item.rotate) : 0,
    ...(item.radius ? { radius: String(item.radius) } : null),
    label: typeof item.label === "string" ? item.label : "",
    ...(item.type === "parking" ? { spaces: Math.min(200, Math.max(1, Math.round(Number(item.spaces) || 1))) } : null),
  };
};

export function loadTrackingMapLayout() {
  if (typeof window === "undefined") return getDefaultLayout();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultLayout();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.items)) return getDefaultLayout();
    return parsed.items.map(sanitizeItem).filter(Boolean);
  } catch (loadError) {
    console.error("Failed to load saved site-map layout", loadError);
    return getDefaultLayout();
  }
}

export function saveTrackingMapLayout(items) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }));
    return true;
  } catch (saveError) {
    console.error("Failed to save site-map layout", saveError);
    return false;
  }
}
