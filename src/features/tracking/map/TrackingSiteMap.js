// file location: src/features/tracking/map/TrackingSiteMap.js
//
// The Map view of /tracking -> Key/Parking. It renders INLINE, inside the
// existing tracking content (app-layout-page-card -> tracking-page). It is not
// a modal, not a route and not an overlay.
//
// WHAT THIS VIEW IS NOW
// ---------------------
// The supplied site-map image (ParkingSiteMap.js) with a light SVG overlay
// over it, in a frame that can be panned and zoomed. The site is NOT drawn in
// code - the image is the map. There are no vehicles, bays or occupancy
// figures on it yet: the site is divided into AREAS - Service, Sales 1-10,
// Staff, Trade - and selecting one, and placing vehicles in it, is the next
// piece of work. The overlay already carries an empty interaction layer for
// exactly that.
//
// THE PROPS THIS STILL ACCEPTS
// ----------------------------
// /tracking passes the tracked entries and the move/open callbacks. They are
// deliberately left in place, unread, while the map carries no vehicle layer -
// the page's own statistics still come from the same registry, and the vehicle
// layer is returning here. Nothing on the page had to change for this view.

import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import ParkingSiteMap from "@/features/tracking/map/ParkingSiteMap";
import { PARKING_AREA_COUNT } from "@/features/tracking/map/parkingAreas";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 1.4;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Keep the plan covering the frame: with origin 0 0 and `scale(s) translate(t)`
// a point p lands at s*(p+t), so t must stay within [1/s - 1, 0].
const clampPan = (value, scale) => clamp(value, Math.min(0, 1 / scale - 1), 0);

const INITIAL_VIEW = { scale: 1, x: 0, y: 0 };

export default function TrackingSiteMap({ loading = false, onRefresh }) {
  const [view, setView] = useState(INITIAL_VIEW);

  const frameRef = useRef(null);
  const panRef = useRef(null);

  const resetView = useCallback(() => setView(INITIAL_VIEW), []);

  const zoomBy = useCallback((factor) => {
    setView((current) => {
      const scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      // Keep whatever is in the middle of the frame in the middle of it.
      const cx = 0.5 / current.scale - current.x;
      const cy = 0.5 / current.scale - current.y;
      return { scale, x: clampPan(0.5 / scale - cx, scale), y: clampPan(0.5 / scale - cy, scale) };
    });
  }, []);

  // Wheel zoom has to be a non-passive listener or the browser scrolls the page
  // out from under the map before we see the event.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const handleWheel = (event) => {
      if (!event.deltaY) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    };
    frame.addEventListener("wheel", handleWheel, { passive: false });
    return () => frame.removeEventListener("wheel", handleWheel);
  }, [zoomBy]);

  const beginPan = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const frame = frameRef.current;
    if (!frame) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: view,
      rect: frame.getBoundingClientRect(),
    };
  };

  const continuePan = (event) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - pan.startX) + Math.abs(event.clientY - pan.startY) < 4) return;
    const dx = (event.clientX - pan.startX) / (pan.rect.width * pan.origin.scale);
    const dy = (event.clientY - pan.startY) / (pan.rect.height * pan.origin.scale);
    setView({
      scale: pan.origin.scale,
      x: clampPan(pan.origin.x + dx, pan.origin.scale),
      y: clampPan(pan.origin.y + dy, pan.origin.scale),
    });
  };

  const endPan = (event) => {
    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) panRef.current = null;
  };

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
    >
      <div className="tracking-map__toolbar">
        <p className="tracking-map__caption">
          {`Site plan - ${PARKING_AREA_COUNT} parking areas`}
        </p>
        <div className="tracking-map__toolbar-group">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            disabled={view.scale <= MIN_SCALE}
            aria-label="Zoom out"
          >
            <span aria-hidden="true">-</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={view.scale >= MAX_SCALE}
            aria-label="Zoom in"
          >
            <span aria-hidden="true">+</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={resetView} disabled={view.scale <= MIN_SCALE}>
            Fit site
          </Button>
          <Button variant="secondary" size="sm" onClick={onRefresh} busy={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* The frame sizes the view; the plan inside it is fitted, never
          stretched, so it keeps its own proportions at any width. The stage
          carries the pan/zoom, which moves the plan and its overlay together. */}
      <div
        ref={frameRef}
        className="tracking-map__frame"
        onPointerDown={beginPan}
        onPointerMove={continuePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <div className="tracking-map__stage" style={stageStyle}>
          <ParkingSiteMap />
        </div>
      </div>

      <p className="tracking-map__footnote">Area names are provisional until the selectable areas are added.</p>
    </LayerTheme>
  );
}
