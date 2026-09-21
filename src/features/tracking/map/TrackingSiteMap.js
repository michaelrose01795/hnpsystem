// file location: src/features/tracking/map/TrackingSiteMap.js
//
// The Map view of /tracking → Key/Parking. It renders INLINE, inside the
// existing tracking content (app-layout-page-card → tracking-page). It is not
// a modal, not a route and not an overlay.
//
// Three layers, in this order:
//   1. base      the supplied H&P aerial render (trackingMapBackground.js),
//                object-fit: contain in a fixed-ratio stage. The vector plan
//                is drawn ONLY when that image is missing.
//   2. bays      the calibrated registry, as faint outlines over the photo
//   3. vehicles  one top-down car per vehicle that names a bay
//
// Nothing about a vehicle is baked into layers 1 or 2, and no vehicle is ever
// drawn in a bay its record does not name.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import StatusMessage from "@/components/ui/StatusMessage";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { SITE_BOUNDARY, SITE_BOUNDARY_LINES, SITE_SHAPES } from "@/features/tracking/map/trackingMapSite";
import {
  MISSING_REFERENCE_MESSAGE,
  TRACKING_MAP_ASPECT_RATIO,
  TRACKING_MAP_REFERENCE,
} from "@/features/tracking/map/trackingMapBackground";
import {
  TRACKING_MAP_AREA_LABELS,
  TRACKING_MAP_SITE_AREAS,
  TRACKING_MAP_SPACES,
  TRACKING_MAP_SPACE_COUNT,
} from "@/features/tracking/map/trackingMapSpaces";
import {
  buildMapAssignments,
  describeMove,
  getEntryKey,
  getMoveTargets,
  MARKER_STATUSES,
} from "@/features/tracking/map/trackingMapModel";

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOM_STEP = 1.4;
const SELECT_SCALE = 2.2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Keep the plan covering the frame: with origin 0 0 and `scale(s) translate(t)`
// a point p lands at s*(p+t), so t must stay within [1/s - 1, 0].
const clampPan = (value, scale) => clamp(value, Math.min(0, 1 / scale - 1), 0);

// The site boundary’s bounding box, in stage percent, with a little air.
const SITE_FIT = { x: 6.0, y: 7.0, width: 70.0, height: 70.0 };

const AREA_FILTER_OPTIONS = [
  { key: "all", value: "all", label: "Whole site" },
  ...TRACKING_MAP_SITE_AREAS.map((area) => ({
    key: area.id,
    value: area.id,
    label: area.label,
    description: `${area.capacity} spaces`,
  })),
];

// Vehicle paint, not theme. A silver car has to read as silver in both light
// and dark mode, so these are fixed values the way VHC annotation ink is —
// they are data about the car, not part of the design system. Anything the
// database does not name falls back to a token-derived neutral.
const CAR_PAINT = new Set(["white", "black", "silver", "grey", "gray", "red", "blue", "green", "yellow", "orange"]);
const paintClass = (colour) => {
  const key = String(colour || "").trim().toLowerCase();
  const normalised = key === "gray" ? "grey" : key;
  return CAR_PAINT.has(normalised) ? `tracking-map__car--${normalised}` : "tracking-map__car--unknown";
};

// A top-down car, drawn to fill its bay. Nose points up the row; the bay's own
// rotation turns it to match the row it belongs to.
function CarShape({ className }) {
  return (
    <svg className={`tracking-map__car ${className}`} viewBox="0 0 24 48" aria-hidden="true" focusable="false">
      <path
        className="tracking-map__car-body"
        d="M12 1c-3.2 0-5.6 1.6-6.4 4.3L4.3 11C3.6 13.4 3.3 16 3.3 19v18c0 3 .3 5.6 1 8l1.3 4.3C6.4 46.4 8.8 47 12 47s5.6-.6 6.4-2.7L19.7 40c.7-2.4 1-5 1-8V19c0-3-.3-5.6-1-8l-1.3-5.7C17.6 2.6 15.2 1 12 1Z"
      />
      <path className="tracking-map__car-glass" d="M7 9.5h10l.9 3.8H6.1L7 9.5Z" />
      <path className="tracking-map__car-glass" d="M6.4 33h11.2l-.8 3.6H7.2L6.4 33Z" />
    </svg>
  );
}

function BaseSitePlan() {
  return (
    <svg
      className="tracking-map__plan"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {SITE_SHAPES.map((shape) => {
        const className = `tracking-map__shape tracking-map__shape--${shape.kind}`;
        return shape.points ? (
          <polygon key={shape.id} className={className} points={shape.points} />
        ) : (
          <rect
            key={shape.id}
            className={className}
            x={shape.x}
            y={shape.y}
            width={shape.w}
            height={shape.h}
            rx={shape.radius || 0}
          />
        );
      })}
      {[SITE_BOUNDARY, ...SITE_BOUNDARY_LINES].map((path) => (
        <path key={path} className="tracking-map__boundary" d={path} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export default function TrackingSiteMap({
  entries = [],
  totalEntries = 0,
  loading = false,
  getFlags,
  isDeparted,
  getVehicleLabel,
  formatRelativeTime,
  onOpenEntry,
  onMoveVehicle,
  onOpenJob,
  onRefresh,
  isMobileView = false,
}) {
  const [selectedKey, setSelectedKey] = useState(null);
  const [areaFilter, setAreaFilter] = useState("all");
  // { entry, fromSpace|null } while the user is choosing a destination bay.
  const [placing, setPlacing] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const [moveStatus, setMoveStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [legendOpen, setLegendOpen] = useState(!isMobileView);
  const [unmappedOpen, setUnmappedOpen] = useState(false);
  const [referenceMissing, setReferenceMissing] = useState(false);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });

  const frameRef = useRef(null);
  const panRef = useRef(null);
  const markerRefs = useRef(new Map());

  const assignments = useMemo(
    () => buildMapAssignments(entries, { getFlags, isDeparted }),
    [entries, getFlags, isDeparted]
  );
  const { bySpaceId, unmapped, counts } = assignments;

  const selectedMarker = useMemo(() => {
    if (!selectedKey) return null;
    for (const marker of bySpaceId.values()) if (marker.key === selectedKey) return marker;
    return null;
  }, [bySpaceId, selectedKey]);

  const moveTargets = useMemo(
    () =>
      placing
        ? getMoveTargets({ spaces: TRACKING_MAP_SPACES, bySpaceId, currentSpaceId: placing.fromSpace?.id || null })
        : null,
    [bySpaceId, placing]
  );

  // A vehicle that has genuinely dropped out of the filter must not leave a
  // stale panel open, but one that is merely mid-refresh must not close it
  // under the reader either.
  useEffect(() => {
    if (!selectedKey || selectedMarker || loading) return undefined;
    const timer = setTimeout(() => setSelectedKey(null), 400);
    return () => clearTimeout(timer);
  }, [loading, selectedKey, selectedMarker]);

  const centreOn = useCallback((space, scale = SELECT_SCALE) => {
    if (!space) return;
    const px = (space.x + space.width / 2) / 100;
    const py = (space.y + space.height / 2) / 100;
    setView({ scale, x: clampPan(0.5 / scale - px, scale), y: clampPan(0.5 / scale - py, scale) });
  }, []);

  // "Fit site" frames the site boundary, not the whole coordinate space. The
  // reference render carries the A20 and the neighbouring land around the
  // edges, so fitting the raw image leaves a wide dead margin on every side -
  // the unused space this view used to waste.
  const fitSite = useCallback(() => {
    const scale = clamp(Math.min(100 / SITE_FIT.width, 100 / SITE_FIT.height), MIN_SCALE, MAX_SCALE);
    const px = (SITE_FIT.x + SITE_FIT.width / 2) / 100;
    const py = (SITE_FIT.y + SITE_FIT.height / 2) / 100;
    setView({ scale, x: clampPan(0.5 / scale - px, scale), y: clampPan(0.5 / scale - py, scale) });
  }, []);

  const resetView = fitSite;

  // Open on the site, not on the empty margin around it.
  useEffect(() => {
    fitSite();
  }, [fitSite]);

  const zoomBy = useCallback((factor) => {
    setView((current) => {
      const scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
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

  // Focusing an area in the filter frames that part of the site.
  const handleAreaFilter = useCallback(
    (nextArea) => {
      setAreaFilter(nextArea);
      if (nextArea === "all") {
        resetView();
        return;
      }
      const areaSpaces = TRACKING_MAP_SPACES.filter((space) => space.siteArea === nextArea);
      if (!areaSpaces.length) return;
      const left = Math.min(...areaSpaces.map((s) => s.x));
      const right = Math.max(...areaSpaces.map((s) => s.x + s.width));
      const top = Math.min(...areaSpaces.map((s) => s.y));
      const bottom = Math.max(...areaSpaces.map((s) => s.y + s.height));
      const scale = clamp(Math.min(90 / (right - left), 90 / (bottom - top)), MIN_SCALE, MAX_SCALE);
      centreOn({ x: left, y: top, width: right - left, height: bottom - top }, scale);
    },
    [centreOn, resetView]
  );

  const selectMarker = useCallback(
    (marker) => {
      setSelectedKey(marker.key);
      setMoveStatus(null);
      centreOn(marker.space);
    },
    [centreOn]
  );

  const closeDetails = useCallback(() => {
    const node = selectedKey ? markerRefs.current.get(selectedKey) : null;
    setPlacing(null);
    setSelectedKey(null);
    node?.focus?.();
  }, [selectedKey]);

  const handleEscape = useCallback(
    (event) => {
      if (event.key !== "Escape") return;
      if (placing) {
        event.stopPropagation();
        setPlacing(null);
        return;
      }
      if (selectedKey) {
        event.stopPropagation();
        const node = markerRefs.current.get(selectedKey);
        setSelectedKey(null);
        node?.focus?.();
      }
    },
    [placing, selectedKey]
  );

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

  const confirmMove = async () => {
    if (!pendingMove || saving) return;
    const { entry, fromSpace, space } = pendingMove;
    setSaving(true);
    const saved = await onMoveVehicle?.({ entry, location: space.locationValue, space, fromSpace });
    setSaving(false);
    setPendingMove(null);
    if (saved) {
      setPlacing(null);
      setSelectedKey(getEntryKey(entry));
      setMoveStatus({
        tone: "success",
        text: `${describeMove({ entry, toSpace: space }).reg} is now in ${space.siteArea} · ${space.label}.`,
      });
      centreOn(space);
    } else {
      setMoveStatus({ tone: "danger", text: "That move could not be saved. The vehicle has not been changed." });
    }
  };

  const visibleSpaces = useMemo(
    () => (areaFilter === "all" ? TRACKING_MAP_SPACES : TRACKING_MAP_SPACES.filter((s) => s.siteArea === areaFilter)),
    [areaFilter]
  );

  const stageStyle = {
    transform: `scale(${view.scale}) translate(${view.x * 100}%, ${view.y * 100}%)`,
    transformOrigin: "0 0",
  };

  const entry = selectedMarker?.entry;
  const detailRows = entry
    ? [
        ["Registration", String(entry.reg || "").toUpperCase() || "Unknown"],
        ["Vehicle", getVehicleLabel?.(entry) || "Make/model pending"],
        ["Colour", entry.colour || "Not recorded"],
        ["Customer", entry.customer || "Customer pending"],
        ["Job number", entry.jobNumber || "Not linked"],
        ["Job status", entry.status || entry.jobStatus || "Not recorded"],
        ["Parking space", selectedMarker.space.label],
        ["Area", selectedMarker.space.siteArea],
        ["Key location", entry.keyLocation || "Not recorded"],
        ["Last movement", formatRelativeTime?.(entry.updatedAt) || "Unknown"],
        ["Time at this space", formatRelativeTime?.(entry.updatedAt) || "Unknown"],
      ]
    : [];

  const startPlacing = (targetEntry, fromSpace) => {
    setPlacing({ entry: targetEntry, fromSpace: fromSpace || null });
    setMoveStatus(null);
    if (!fromSpace) resetView();
  };

  return (
    <LayerTheme
      className="tracking-map"
      sectionKey="tracking-map-view"
      parentKey="tracking-page-body"
      sectionType="section-shell"
      onKeyDown={handleEscape}
    >
      <div className="tracking-map__toolbar">
        <DropdownField
          value={areaFilter}
          onValueChange={handleAreaFilter}
          options={AREA_FILTER_OPTIONS}
          ariaLabel="Focus one part of the site"
          placeholder="Whole site"
          size="sm"
        />
        <div className="tracking-map__toolbar-group">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            disabled={view.scale <= MIN_SCALE}
            aria-label="Zoom out"
          >
            <span aria-hidden="true">−</span>
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
          <Button variant="secondary" size="sm" onClick={resetView}>
            Fit site
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setLegendOpen((open) => !open)} aria-pressed={legendOpen}>
            Legend
          </Button>
          <Button variant="secondary" size="sm" onClick={onRefresh} busy={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {referenceMissing && <StatusMessage tone="warning">{MISSING_REFERENCE_MESSAGE}</StatusMessage>}
      {moveStatus && <StatusMessage tone={moveStatus.tone}>{moveStatus.text}</StatusMessage>}
      {placing && (
        <StatusMessage tone="info">
          {`Choose a free space for ${String(placing.entry.reg || "this vehicle").toUpperCase()}. Only empty parking spaces can be selected. Press Escape to cancel.`}
        </StatusMessage>
      )}

      <div className={`tracking-map__body${selectedMarker ? " tracking-map__body--split" : ""}`}>
        <div
          ref={frameRef}
          className={`tracking-map__frame${placing ? " tracking-map__frame--placing" : ""}`}
          style={{ aspectRatio: TRACKING_MAP_ASPECT_RATIO }}
          onPointerDown={beginPan}
          onPointerMove={continuePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          <div className="tracking-map__stage" style={stageStyle}>
            {referenceMissing ? (
              <BaseSitePlan />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- a fixed, pre-sized site plan asset; next/image adds a layout wrapper that would break the percentage overlay this map depends on.
              <img
                className="tracking-map__photo"
                src={TRACKING_MAP_REFERENCE.src}
                alt={TRACKING_MAP_REFERENCE.alt}
                onError={() => setReferenceMissing(true)}
                draggable={false}
              />
            )}

            <div
              className="tracking-map__overlay"
              // Text overlays counter-scale so a label stays the same size on
              // screen however far the map is zoomed in.
              style={{ "--tmap-inv": 1 / view.scale }}
            >
              {areaFilter === "all" &&
                TRACKING_MAP_AREA_LABELS.map((anchor) => (
                  <span
                    key={`area-${anchor.id}`}
                    className="tracking-map__area-label"
                    style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
                  >
                    {anchor.label}
                  </span>
                ))}

              {visibleSpaces.map((space) => {
                const marker = bySpaceId.get(space.id);
                const isTarget = moveTargets ? moveTargets.has(space.id) : false;
                const positionStyle = {
                  left: `${space.x}%`,
                  top: `${space.y}%`,
                  width: `${space.width}%`,
                  height: `${space.height}%`,
                  ...(space.rotation ? { rotate: `${space.rotation}deg` } : null),
                };

                if (!marker) {
                  if (placing && isTarget) {
                    return (
                      <button
                        key={space.id}
                        type="button"
                        className="app-btn app-btn--map-bay tracking-map__space tracking-map__space--target"
                        style={positionStyle}
                        onClick={() => setPendingMove({ ...placing, space })}
                      >
                        <span className="tracking-map__sr">{`Put this vehicle in ${space.siteArea}, space ${space.label}`}</span>
                      </button>
                    );
                  }
                  return (
                    <span
                      key={space.id}
                      className={`tracking-map__space${placing ? " tracking-map__space--dim" : ""}`}
                      style={positionStyle}
                    />
                  );
                }

                const isSelected = marker.key === selectedKey;
                const conflicted = marker.conflicts.length > 0;
                const reg = String(marker.entry.reg || "Unknown registration").toUpperCase();
                const classes = [
                  "tracking-map__marker",
                  `tracking-map__marker--${marker.status.id}`,
                  isSelected ? "is-selected" : "",
                  placing ? "tracking-map__space--dim" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    key={space.id}
                    type="button"
                    className={`app-btn app-btn--map-bay ${classes}`}
                    style={positionStyle}
                    aria-pressed={isSelected}
                    onClick={() => selectMarker(marker)}
                    ref={(node) => {
                      if (node) markerRefs.current.set(marker.key, node);
                      else markerRefs.current.delete(marker.key);
                    }}
                  >
                    <CarShape className={paintClass(marker.entry.colour)} />
                    {conflicted && (
                      <span aria-hidden="true" className="tracking-map__conflict">
                        !
                      </span>
                    )}
                    <span aria-hidden="true" className="tracking-map__tip">
                      {`${reg} · ${space.label}`}
                    </span>
                    <span className="tracking-map__sr">
                      {`${reg}, ${space.siteArea}, space ${space.label}, ${marker.status.label}${
                        conflicted ? `, ${marker.conflicts.length} other records claim this space` : ""
                      }`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="tracking-map__hud">
            <span>{`${counts.occupiedSpaces} of ${counts.totalSpaces} spaces occupied`}</span>
            {counts.unmapped > 0 && <span>{`${counts.unmapped} unmapped`}</span>}
            {counts.conflicts > 0 && <span>{`${counts.conflicts} conflicts`}</span>}
          </div>
        </div>

        {selectedMarker && (
          <LayerSurface className="tracking-map__panel" radius="var(--radius-sm)">
            <h3 className="tracking-map__panel-title">
              {String(selectedMarker.entry.reg || "Selected vehicle").toUpperCase()}
            </h3>
            <p className="tracking-map__panel-status">
              <span aria-hidden="true" className={`tracking-map__chip tracking-map__chip--${selectedMarker.status.id}`}>
                {selectedMarker.status.glyph}
              </span>
              {selectedMarker.status.label}
            </p>
            <dl className="tracking-map__detail">
              {detailRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {selectedMarker.flags?.isOverdue && (
              <StatusMessage tone="warning">This vehicle has not moved since its last recorded movement.</StatusMessage>
            )}
            {selectedMarker.conflicts.length > 0 && (
              <>
                <StatusMessage tone="danger">
                  {`${selectedMarker.conflicts.length + 1} records claim ${selectedMarker.space.label}. Give each one its own space.`}
                </StatusMessage>
                <ul className="tracking-map__conflict-list">
                  {selectedMarker.conflicts.map((other) => (
                    <li key={getEntryKey(other)}>
                      <Button variant="ghost" size="sm" onClick={() => onOpenEntry?.(other)}>
                        {`${String(other.reg || "Unknown").toUpperCase()} — job ${other.jobNumber || "unknown"}`}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="tracking-map__panel-actions">
              <Button variant="primary" size="sm" onClick={() => onOpenEntry?.(selectedMarker.entry)}>
                Update location
              </Button>
              <Button
                variant={placing ? "ghost" : "secondary"}
                size="sm"
                aria-pressed={Boolean(placing)}
                onClick={() =>
                  placing ? setPlacing(null) : startPlacing(selectedMarker.entry, selectedMarker.space)
                }
              >
                {placing ? "Cancel move" : "Move vehicle"}
              </Button>
              {selectedMarker.entry.jobNumber && (
                <Button variant="secondary" size="sm" onClick={() => onOpenJob?.(selectedMarker.entry)}>
                  Open job
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={closeDetails}>
                Close
              </Button>
            </div>
          </LayerSurface>
        )}
      </div>

      {legendOpen && (
        <LayerSurface className="tracking-map__legend" radius="var(--radius-sm)" as="ul">
          {MARKER_STATUSES.map((status) => (
            <li key={status.id}>
              <span aria-hidden="true" className={`tracking-map__chip tracking-map__chip--${status.id}`}>
                {status.glyph}
              </span>
              {status.label}
            </li>
          ))}
          <li>
            <span aria-hidden="true" className="tracking-map__chip tracking-map__chip--empty" />
            Empty space
          </li>
        </LayerSurface>
      )}

      {totalEntries === 0 && !loading && (
        <StatusMessage tone="info">No active tracked vehicles to show on the site map.</StatusMessage>
      )}

      {unmapped.length > 0 && (
        <LayerSurface className="tracking-map__unmapped" radius="var(--radius-sm)">
          <div className="tracking-map__unmapped-head">
            <h3 className="tracking-map__panel-title">{`Unmapped vehicles (${unmapped.length})`}</h3>
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={unmappedOpen}
              onClick={() => setUnmappedOpen((open) => !open)}
            >
              {unmappedOpen ? "Hide list" : "Show list"}
            </Button>
          </div>
          <p className="tracking-map__panel-status">
            On site, but the record names an area rather than a numbered space, so the map cannot say which space.
            Assign one and the vehicle appears on the plan.
          </p>
          {unmappedOpen && (
            <ul className="tracking-map__unmapped-list">
              {unmapped.map(({ entry: item, area }) => (
                <li key={getEntryKey(item)} className="tracking-map__unmapped-row">
                  <span className="tracking-map__unmapped-reg">
                    {String(item.reg || "Unknown registration").toUpperCase()}
                  </span>
                  <span className="tracking-map__unmapped-meta">
                    {[
                      String(item.vehicleLocation || "").trim() || "no location recorded",
                      item.jobNumber ? `job ${item.jobNumber}` : null,
                      formatRelativeTime?.(item.updatedAt),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="tracking-map__unmapped-actions">
                    <Button variant="secondary" size="sm" onClick={() => startPlacing(item, null)}>
                      Assign space
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onOpenEntry?.(item)}>
                      Open
                    </Button>
                  </span>
                  {area ? <span className="tracking-map__sr">{`Recorded area ${area.label}`}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </LayerSurface>
      )}

      <p className="tracking-map__footnote">
        {`Calibrated site registry: ${TRACKING_MAP_SPACE_COUNT} vehicle-holding spaces across ${TRACKING_MAP_SITE_AREAS.length} site areas.`}
      </p>

      <ConfirmationDialog
        isOpen={Boolean(pendingMove)}
        title={pendingMove?.fromSpace ? "Move this vehicle?" : "Assign this space?"}
        message="The movement is recorded against the job and appears in the tracking history."
        confirmLabel={saving ? "Saving…" : pendingMove?.fromSpace ? "Move vehicle" : "Assign space"}
        cancelLabel="Cancel"
        onCancel={() => setPendingMove(null)}
        onConfirm={confirmMove}
        details={
          pendingMove
            ? (() => {
                const described = describeMove({
                  entry: pendingMove.entry,
                  fromSpace: pendingMove.fromSpace,
                  toSpace: pendingMove.space,
                });
                return [
                  { label: "Registration", value: described.reg, tone: "accent" },
                  { label: "Current location", value: described.from, tone: "neutral" },
                  { label: "Destination", value: described.to, tone: "success" },
                ];
              })()
            : undefined
        }
      />
    </LayerTheme>
  );
}
