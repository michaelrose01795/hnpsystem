// file location: src/features/tracking/map/trackingMapLayout.js
// Data model + browser persistence for the /tracking site map editor.
//
// Every section on the map (road / building / parking / grass / fence) is an item:
//   { id, type, x, y, w, h, rotate?, radius?, label?, spaces? }
// x/y/w/h are percentages of the map stage so the layout scales responsively.
//
// The default is intentionally blank. Once an item is added, removed, moved,
// resized, rotated, or relabelled, TrackingMap saves the full item list here so
// reloads keep the edited map.

const STORAGE_KEY = "hnp-tracking-site-map-layout-v2";

const VALID_TYPES = new Set(["road", "building", "parking", "grass", "fence"]);
const MIN_ITEM_SIZE = 2;
export const MAX_PARKING_SPACES = 200;

export const DEFAULT_LAYOUT = [];

const TYPE_DEFAULTS = {
  road: { w: 30, h: 7 },
  building: { w: 14, h: 10 },
  grass: { w: 16, h: 7 },
  parking: { w: 18, h: 5 },
  fence: { w: 32, h: 2 },
};

let createdCount = 0;

export function createMapItem(type, overrides = {}) {
  createdCount += 1;
  const item = {
    id: `${type}-${Date.now().toString(36)}-${createdCount}`,
    type,
    x: 40,
    y: 40,
    rotate: 0,
    label: "",
    ...TYPE_DEFAULTS[type],
    ...overrides,
  };
  return item.type === "parking" ? { ...item, spaces: calculateParkingSpaces(item) } : item;
}

export function getDefaultLayout() {
  return DEFAULT_LAYOUT.map((item) => ({ ...item }));
}

const sanitizeItem = (item) => {
  if (!item || typeof item !== "object") return null;
  if (!VALID_TYPES.has(item.type)) return null;
  const rawX = Number(item.x);
  const rawY = Number(item.y);
  const rawW = Number(item.w);
  const rawH = Number(item.h);
  if (![rawX, rawY, rawW, rawH].every(Number.isFinite)) return null;
  const x = Math.min(100 - MIN_ITEM_SIZE, Math.max(0, rawX));
  const y = Math.min(100 - MIN_ITEM_SIZE, Math.max(0, rawY));
  const w = Math.min(100 - x, Math.max(MIN_ITEM_SIZE, rawW));
  const h = Math.min(100 - y, Math.max(MIN_ITEM_SIZE, rawH));
  return {
    id: String(item.id || `${item.type}-${Math.abs(x)}-${Math.abs(y)}`),
    type: item.type,
    ...(item.variant ? { variant: String(item.variant) } : null),
    x,
    y,
    w,
    h,
    rotate: Number.isFinite(Number(item.rotate)) ? Number(item.rotate) : 0,
    ...(item.radius ? { radius: String(item.radius) } : null),
    label: typeof item.label === "string" ? item.label : "",
    ...(item.type === "parking" ? { spaces: calculateParkingSpaces({ ...item, x, y, w, h }) } : null),
  };
};

export function calculateParkingSpaces(item = {}) {
  const explicitSpaces = Number(item.spaces);
  if (Number.isFinite(explicitSpaces)) {
    return Math.min(MAX_PARKING_SPACES, Math.max(1, Math.round(explicitSpaces)));
  }
  const w = Math.max(0, Number(item.w) || 0);
  const h = Math.max(0, Number(item.h) || 0);
  const area = w * h;
  if (!area) return 1;
  const density = area <= 120 ? 9 : 8;
  return Math.min(MAX_PARKING_SPACES, Math.max(1, Math.round(area / density)));
}

export function sanitizeTrackingMapLayout(items) {
  return (Array.isArray(items) ? items : []).map(sanitizeItem).filter(Boolean);
}

export function loadTrackingMapLayout() {
  if (typeof window === "undefined") return getDefaultLayout();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultLayout();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.items)) return getDefaultLayout();
    return sanitizeTrackingMapLayout(parsed.items);
  } catch (loadError) {
    console.error("Failed to load saved site-map layout", loadError);
    return getDefaultLayout();
  }
}

export function saveTrackingMapLayout(items) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        items: sanitizeTrackingMapLayout(items),
      })
    );
    return true;
  } catch (saveError) {
    console.error("Failed to save site-map layout", saveError);
    return false;
  }
}
