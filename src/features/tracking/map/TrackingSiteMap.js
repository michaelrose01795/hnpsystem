// file location: src/features/tracking/map/TrackingSiteMap.js
//
// The Map view of /tracking -> Key/Parking. It renders INLINE, inside the
// existing tracking content (app-layout-page-card -> tracking-page). It is not
// a modal, not a route and not an overlay.
//
// ONE TOOL, THREE PARTS, ONE SELECTION
// ------------------------------------
//   results   find-a-vehicle matches for the PAGE's search bar
//   map       the supplied site-plan image with a selectable overlay
//   panel     the selected section (or an overview of all of them)
//
// There is no search bar in here. The page's shared search (tracking-ui.js)
// is the only one on the page: it filters the entries this view draws AND,
// as `findQuery`, drives the find-a-vehicle results, which are portalled into
// `findResultsSlot` so they drop down under that bar.
//
// All three share `selectedId`. Clicking a map label, clicking a building or
// yard region, choosing an overview row and choosing a search
// result all set it; Escape and the panel's Close clear it. There is no second copy of the
// selection anywhere.
//
// DATA
// ----
// /tracking passes live (not departed) entries, already narrowed by the page's
// own search and filters — this view never fetches. `allEntries` is the same
// set without the page filters, so "find a vehicle" works whatever filters are
// applied. Moves go back through `onMoveVehicle`, the page's server-owned
// location_update path; the page reloads the snapshot and every count here is
// re-derived from it.
//
// ZOOM IS PHONE-ONLY
// ------------------
// On a tablet landscape or desktop the frame is big enough to read the whole
// plan, so the plan is fixed: no wheel zoom, no panning, and
// the page scrolls normally over it. At tablet portrait width and below the
// frame shrinks to the plan's own proportions, and the plan can be zoomed with
// a pinch (or the wheel) and panned with a drag.

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import ParkingSiteMap from "@/features/tracking/map/ParkingSiteMap";
import SectionPanel from "@/features/tracking/map/SectionPanel";
import { useIsTablet } from "@/hooks/useIsMobile";
import { TRACKING_SECTION_BY_ID } from "@/features/tracking/map/parkingAreas";
import {
  INITIAL_SECTION_SELECTION,
  buildSectionOccupancy,
  groupEntriesBySection,
  searchVehicles,
  sectionSelectionReducer,
} from "@/features/tracking/map/trackingMapModel";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 1.4;
// A pointer that travels further than this between down and up was a pan, not
// a click, and must not select the section under it.
const DRAG_THRESHOLD_PX = 4;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Keep the plan covering the frame: with origin 0 0 and `scale(s) translate(t)`
// a point p lands at s*(p+t), so t must stay within [1/s - 1, 0].
const clampPan = (value, scale) => clamp(value, Math.min(0, 1 / scale - 1), 0);

const INITIAL_VIEW = { scale: 1, x: 0, y: 0 };

export default function TrackingSiteMap({
  entries = [],
  allEntries = null,
  getFlags,
  getVehicleLabel,
  formatRelativeTime,
  onOpenEntry,
  onMoveVehicle,
  initialSelectedId = null,
  findQuery = "",
  onFindQueryChange,
  findResultsSlot = null,
}) {
  const [view, setView] = useState(INITIAL_VIEW);
  const canZoom = useIsTablet();
  // True while a finger or mouse is dragging / pinching, so the stage follows
  // it directly instead of easing behind it.
  const [gesturing, setGesturing] = useState(false);
  // One selection for the labels, regions, strip, overview and search results.
  // The transitions are the tested sectionSelectionReducer in trackingMapModel.
  const [selection, dispatch] = useReducer(sectionSelectionReducer, initialSelectedId, (id) =>
    sectionSelectionReducer(INITIAL_SECTION_SELECTION, { type: "select", id })
  );
  // The find query belongs to the page's shared search bar, not the reducer.
  const { selectedId, highlightKey } = selection;

  const frameRef = useRef(null);
  const panRef = useRef(null);
  const pinchRef = useRef(null);
  const pointersRef = useRef(new Map());
  const draggedRef = useRef(false);

  const searchable = allEntries || entries;

  const grouped = useMemo(() => groupEntriesBySection(entries), [entries]);
  const occupancyById = useMemo(() => buildSectionOccupancy(grouped.counts), [grouped]);
  const findResults = useMemo(() => searchVehicles(searchable, findQuery), [searchable, findQuery]);

  const selectedSection = selectedId ? TRACKING_SECTION_BY_ID.get(selectedId) || null : null;

  const selectSection = useCallback((id) => dispatch({ type: "select", id }), []);

  // Picking a result opens its section with the car highlighted, and clears
  // the shared search so the map shows the whole section again.
  const chooseResult = (result) => {
    dispatch({ type: "choose-result", sectionId: result.section.id, key: result.key });
    onFindQueryChange?.("");
  };

  // Escape backs out one step: first the find results, then the selection.
  // Only swallowed when it did something, so an Escape with nothing to close
  // still reaches anything listening further up.
  const handleKeyDown = (event) => {
    if (event.key !== "Escape") return;
    if (findQuery) {
      event.stopPropagation();
      onFindQueryChange?.("");
    } else if (selectedId) {
      event.stopPropagation();
      dispatch({ type: "clear" });
    }
  };

  const zoomBy = useCallback((factor) => {
    setView((current) => {
      const scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      // Keep whatever is in the middle of the frame in the middle of it.
      const cx = 0.5 / current.scale - current.x;
      const cy = 0.5 / current.scale - current.y;
      return { scale, x: clampPan(0.5 / scale - cx, scale), y: clampPan(0.5 / scale - cy, scale) };
    });
  }, []);

  // Growing past tablet width drops back to the fitted plan, so a desktop never
  // keeps a zoom it has no controls to undo.
  useEffect(() => {
    if (!canZoom) setView(INITIAL_VIEW);
  }, [canZoom]);

  // Wheel zoom has to be a non-passive listener or the browser scrolls the page
  // out from under the map before we see the event. Phones only.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !canZoom) return undefined;
    const handleWheel = (event) => {
      if (!event.deltaY) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    };
    frame.addEventListener("wheel", handleWheel, { passive: false });
    return () => frame.removeEventListener("wheel", handleWheel);
  }, [zoomBy, canZoom]);

  // Pinch: the point of the plan under the fingers' midpoint stays under it.
  const beginPinch = (rect) => {
    const [a, b] = [...pointersRef.current.values()];
    panRef.current = null;
    draggedRef.current = true;
    pinchRef.current = {
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mx: ((a.x + b.x) / 2 - rect.left) / rect.width,
      my: ((a.y + b.y) / 2 - rect.top) / rect.height,
      origin: view,
      rect,
    };
  };

  const continuePinch = () => {
    const pinch = pinchRef.current;
    const [a, b] = [...pointersRef.current.values()];
    const { origin, rect } = pinch;
    const scale = clamp((origin.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.distance, MIN_SCALE, MAX_SCALE);
    const mx = ((a.x + b.x) / 2 - rect.left) / rect.width;
    const my = ((a.y + b.y) / 2 - rect.top) / rect.height;
    // The plan point that sat under the starting midpoint.
    const px = pinch.mx / origin.scale - origin.x;
    const py = pinch.my / origin.scale - origin.y;
    setView({ scale, x: clampPan(mx / scale - px, scale), y: clampPan(my / scale - py, scale) });
  };

  const beginPan = (event) => {
    if (!canZoom) return;
    if (event.button !== undefined && event.button !== 0) return;
    const frame = frameRef.current;
    if (!frame) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setGesturing(true);
    if (pointersRef.current.size === 2) {
      beginPinch(frame.getBoundingClientRect());
      return;
    }
    if (pointersRef.current.size > 2) return;
    draggedRef.current = false;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: view,
      rect: frame.getBoundingClientRect(),
    };
  };

  const continuePan = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchRef.current && pointersRef.current.size === 2) {
      continuePinch();
      return;
    }
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - pan.startX) + Math.abs(event.clientY - pan.startY) < DRAG_THRESHOLD_PX) return;
    draggedRef.current = true;
    const dx = (event.clientX - pan.startX) / (pan.rect.width * pan.origin.scale);
    const dy = (event.clientY - pan.startY) / (pan.rect.height * pan.origin.scale);
    setView({
      scale: pan.origin.scale,
      x: clampPan(pan.origin.x + dx, pan.origin.scale),
      y: clampPan(pan.origin.y + dy, pan.origin.scale),
    });
  };

  const endPan = (event) => {
    pointersRef.current.delete(event.pointerId);
    // Lifting one finger of a pinch ends it; the remaining finger does not turn
    // into a pan, which would jump the plan.
    pinchRef.current = null;
    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) panRef.current = null;
    if (pointersRef.current.size === 0) setGesturing(false);
  };

  const shouldIgnoreClick = useCallback(() => draggedRef.current, []);

  // Portalled under the page's search bar when the slot is there; drawn at the
  // top of the map otherwise, so the results are never lost.
  const findResultsList = findQuery ? (
    <ul id="tracking-map-find-results" className="tracking-map__find-results" aria-label="Matching vehicles">
      {findResults.length === 0 ? (
        <li className="tracking-map__find-empty">No tracked vehicle matches “{findQuery}”.</li>
      ) : (
        findResults.map((result) => (
          <li key={result.key}>
            <Button
              variant="secondary"
              size="sm"
              symbol={false}
              className="tracking-map__find-result"
              onClick={() => chooseResult(result)}
              aria-label={`${String(result.entry.reg || "No reg").toUpperCase()}, in ${result.section.label}`}
            >
              <span className="app-record-plate">{String(result.entry.reg || "No reg").toUpperCase()}</span>
              <span className="tracking-map__find-meta">
                {result.entry.jobNumber ? `Job ${result.entry.jobNumber}` : ""}
              </span>
              <span className="tracking-map__find-section">{result.section.label}</span>
            </Button>
          </li>
        ))
      )}
    </ul>
  ) : null;

  const stageStyle = {
    transform: `scale(${view.scale}) translate(${view.x * 100}%, ${view.y * 100}%)`,
    transformOrigin: "0 0",
  };

  return (
    <LayerTheme
      className="tracking-map"
      sectionKey="tracking-map-view"
      parentKey="tracking-page-body"
      sectionType="section-shell"
      onKeyDown={handleKeyDown}
    >
      {findResultsSlot
        ? createPortal(findResultsList, findResultsSlot)
        : findResultsList && <div className="tracking-shared-find">{findResultsList}</div>}

      <div className="tracking-map__body">
        {/* The frame sizes the view; the plan inside it is fitted, never
            stretched, so it keeps its own proportions at any width. The stage
            carries the pan/zoom, which moves the plan and its overlay together. */}
        <div
          ref={frameRef}
          className={`tracking-map__frame${canZoom ? " is-zoomable" : ""}${gesturing ? " is-gesturing" : ""}`}
          onPointerDown={beginPan}
          onPointerMove={continuePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          <div className="tracking-map__stage" style={stageStyle}>
            <ParkingSiteMap
              selectedId={selectedId}
              counts={grouped.counts}
              onSelect={selectSection}
              shouldIgnoreClick={shouldIgnoreClick}
            />
          </div>
        </div>

        <SectionPanel
          selectedSection={selectedSection}
          entries={entries}
          counts={grouped.counts}
          occupancyById={occupancyById}
          highlightKey={highlightKey}
          getFlags={getFlags}
          getVehicleLabel={getVehicleLabel}
          formatRelativeTime={formatRelativeTime}
          onSelect={selectSection}
          onOpenEntry={onOpenEntry}
          onMoveVehicle={onMoveVehicle}
        />
      </div>
    </LayerTheme>
  );
}
