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
// THE PLAN IS FIXED
// -----------------
// The plan cannot be zoomed or panned at any width or orientation: no pinch,
// no wheel zoom, no drag. It is always fitted to the frame and the page
// scrolls normally over it. Sections are chosen with a plain tap / click.

import React, { useCallback, useMemo, useReducer } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import ParkingSiteMap from "@/features/tracking/map/ParkingSiteMap";
import SectionPanel from "@/features/tracking/map/SectionPanel";
import { TRACKING_SECTION_BY_ID } from "@/features/tracking/map/parkingAreas";
import {
  INITIAL_SECTION_SELECTION,
  buildSectionOccupancy,
  groupEntriesBySection,
  searchVehicles,
  sectionSelectionReducer,
} from "@/features/tracking/map/trackingMapModel";

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
  // One selection for the labels, regions, strip, overview and search results.
  // The transitions are the tested sectionSelectionReducer in trackingMapModel.
  const [selection, dispatch] = useReducer(sectionSelectionReducer, initialSelectedId, (id) =>
    sectionSelectionReducer(INITIAL_SECTION_SELECTION, { type: "select", id })
  );
  // The find query belongs to the page's shared search bar, not the reducer.
  const { selectedId, highlightKey } = selection;

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
            stretched, so it keeps its own proportions at any width. It is
            fixed: no zoom and no pan on any device or orientation. */}
        <div className="tracking-map__frame">
          <div className="tracking-map__stage">
            <ParkingSiteMap selectedId={selectedId} counts={grouped.counts} onSelect={selectSection} />
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
