// file location: src/features/tracking/map/SectionPanel.js
//
// The right-hand panel of the site map. Two states, one component:
//
//   nothing selected -> OVERVIEW: every section as a compact table row with
//                       its occupied / capacity figures. Choosing a row
//                       selects the section, exactly like its map label.
//   a section        -> DETAIL: name, Capacity / Occupied / Available, a
//                       search within the section, and the vehicles in it,
//                       each with Open and Move actions.
//
// It sits on the map card's --theme layer, so it is a LayerSurface (the ladder
// flips back). Rows inside it are a list separated by --separating-line, not
// nested cards.
//
// MOVING A VEHICLE
// ----------------
// The destination list is every canonical section except the one the car is
// already in (getMoveDestinations). The panel never writes anything itself: it
// hands { entry, location } to `onMoveVehicle`, which is the page's existing
// server-owned `location_update` path through /api/tracking/next-action. That
// path appends to vehicle_tracking_events and sends NO key event, so moving a
// car never changes where its keys are recorded.

import React, { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import DataTableShell from "@/components/ui/DataTableShell";
import LayerSurface from "@/components/ui/LayerSurface";
import StatusMessage from "@/components/ui/StatusMessage";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { NA_VEHICLE_LOCATION_ID, OFF_SITE_VEHICLE_LOCATION_ID } from "@/lib/tracking/vehicleLocations";
import { TRACKING_SECTIONS } from "@/features/tracking/map/parkingAreas";
import {
  describeMove,
  filterEntriesForSection,
  getEntryKey,
  getEntrySection,
  getMarkerStatus,
  getMoveDestinations,
} from "@/features/tracking/map/trackingMapModel";

const SECTION_SEARCH_THRESHOLD = 6;

const formatFigure = (value) => (value === null || value === undefined ? "—" : String(value));

const describeSectionKind = (section) => {
  if (section.id === NA_VEHICLE_LOCATION_ID) return "Not a place — vehicles with no recorded location";
  if (section.id === OFF_SITE_VEHICLE_LOCATION_ID) return "Recorded as away from the site";
  if (!section.isOnMap) return "Valid location, not drawn on the site plan";
  return section.zone || "Site section";
};

function SectionStats({ occupancy }) {
  const capacityLabel = occupancy.capacity === null ? "Unlimited" : formatFigure(occupancy.capacity);
  return (
    <dl className="tracking-panel__stats">
      <div className="tracking-panel__stat">
        <dt>Capacity</dt>
        <dd>{capacityLabel}</dd>
      </div>
      <div className="tracking-panel__stat">
        <dt>Occupied</dt>
        <dd>{formatFigure(occupancy.occupied)}</dd>
      </div>
      <div className={`tracking-panel__stat${occupancy.isOverCapacity ? " is-over" : ""}`}>
        <dt>Available</dt>
        <dd>{occupancy.capacity === null ? "—" : formatFigure(occupancy.available)}</dd>
      </div>
    </dl>
  );
}

function VehicleRow({
  entry,
  isHighlighted,
  getFlags,
  getVehicleLabel,
  formatRelativeTime,
  onOpenEntry,
  onMove,
  moving,
}) {
  const [destination, setDestination] = useState("");
  const rowRef = useRef(null);
  const { section, isUnrecognised } = getEntrySection(entry);
  const status = getMarkerStatus(getFlags ? getFlags(entry) || {} : {});
  const destinations = useMemo(
    () => getMoveDestinations(entry).map((option) => ({ key: option.id, value: option.label, label: option.label })),
    [entry]
  );
  const reg = String(entry.reg || entry.vehicleReg || "No reg").toUpperCase();
  const meta = [entry.jobNumber ? `Job ${entry.jobNumber}` : null, getVehicleLabel ? getVehicleLabel(entry) : entry.makeModel]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    if (isHighlighted && rowRef.current?.scrollIntoView) {
      rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isHighlighted]);

  const submitMove = async () => {
    if (!destination) return;
    const ok = await onMove(entry, destination);
    if (ok) setDestination("");
  };

  return (
    <li
      ref={rowRef}
      className={`tracking-panel__vehicle${isHighlighted ? " is-highlighted" : ""}`}
      data-entry-key={getEntryKey(entry)}
    >
      <div className="tracking-panel__vehicle-head">
        <span className="app-record-plate app-record-plate--theme">{reg}</span>
        <span className="tracking-panel__vehicle-status" data-status={status.id} title={status.label}>
          <span aria-hidden="true">{status.glyph}</span>
          <span className="tracking-panel__sr">{status.label}</span>
        </span>
        <Button variant="primary" size="xs" symbol={false} onClick={() => onOpenEntry?.(entry)}>
          Open
        </Button>
      </div>
      {meta && <p className="tracking-panel__vehicle-meta">{meta}</p>}
      <p className="tracking-panel__vehicle-meta">
        {`Moved ${formatRelativeTime ? formatRelativeTime(entry.updatedAt) : ""}`.trim()}
        {section.id === NA_VEHICLE_LOCATION_ID && isUnrecognised && ` · recorded as “${entry.vehicleLocation}”`}
      </p>
      <div className="tracking-panel__move">
        <DropdownField
          options={destinations}
          value={destination}
          onValueChange={setDestination}
          placeholder="Move to…"
          ariaLabel={`Move ${reg} to`}
          size="sm"
        />
        <Button variant="secondary" size="sm" symbol={false} onClick={submitMove} disabled={!destination} busy={moving}>
          Move
        </Button>
      </div>
    </li>
  );
}

export default function SectionPanel({
  selectedSection = null,
  entries = [],
  counts = {},
  occupancyById = {},
  highlightKey = null,
  getFlags,
  getVehicleLabel,
  formatRelativeTime,
  onSelect,
  onOpenEntry,
  onMoveVehicle,
}) {
  const [query, setQuery] = useState("");
  const [movingKey, setMovingKey] = useState(null);
  const [message, setMessage] = useState(null);

  // A new section starts with an empty search; a stale success message from
  // the previous section would describe a car that is no longer listed here.
  useEffect(() => {
    setQuery("");
    setMessage(null);
  }, [selectedSection?.id]);

  const sectionEntries = useMemo(
    () => (selectedSection ? filterEntriesForSection(entries, selectedSection.id, query) : []),
    [entries, selectedSection, query]
  );

  const handleMove = async (entry, location) => {
    const toSection = TRACKING_SECTIONS.find((section) => section.label === location) || null;
    const move = describeMove({ entry, toSection });
    const key = getEntryKey(entry);
    setMovingKey(key);
    setMessage(null);
    try {
      const ok = await onMoveVehicle?.({ entry, location: move.destinationLocation, fromLabel: move.from });
      setMessage(
        ok
          ? { tone: "success", text: `${move.reg} moved from ${move.from} to ${move.to}.` }
          : { tone: "danger", text: `${move.reg} could not be moved. Please try again.` }
      );
      return Boolean(ok);
    } finally {
      setMovingKey(null);
    }
  };

  // ---------------------------------------------------------------- overview
  if (!selectedSection) {
    return (
      <LayerSurface className="tracking-panel" as="aside" aria-label="Sections overview" gap="var(--space-sm)">
        <div className="tracking-panel__head">
          <h3 className="tracking-panel__title">Sections</h3>
          <p className="tracking-panel__caption">Select a section on the map or below to see its vehicles.</p>
        </div>
        {/* The global table (staffglobal.css / families/tables.css), untouched.
            Every section is shown without an inner scroll — the panel itself
            is the one scroller — and three short columns stay a table on a
            phone rather than stacking into cards. */}
        <DataTableShell visibleRows={TRACKING_SECTIONS.length} stack={false}>
          <table className="app-data-table">
            <thead>
              <tr>
                <th scope="col">Section</th>
                <th scope="col">Vehicles</th>
                <th scope="col">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {TRACKING_SECTIONS.map((section) => {
                const occupancy = occupancyById[section.id];
                return (
                  <tr key={section.id} data-section-id={section.id}>
                    <td>
                      <Button
                        variant="secondary"
                        size="xs"
                        symbol={false}
                        className="tracking-panel__row-button"
                        onClick={() => onSelect?.(section.id)}
                      >
                        {section.label}
                      </Button>
                    </td>
                    <td>{counts[section.id] || 0}</td>
                    <td>
                      <span className={occupancy?.isOverCapacity ? "tracking-panel__over" : undefined}>
                        {occupancy?.capacity === null || occupancy?.capacity === undefined ? "—" : occupancy.capacity}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableShell>
      </LayerSurface>
    );
  }

  // ------------------------------------------------------------------ detail
  const occupancy = occupancyById[selectedSection.id] || { capacity: null, occupied: 0, available: null };
  const total = counts[selectedSection.id] || 0;

  return (
    <LayerSurface
      className="tracking-panel"
      as="aside"
      aria-label={`${selectedSection.label} section`}
      gap="var(--space-sm)"
      data-section-id={selectedSection.id}
    >
      <div className="tracking-panel__head">
        <div className="tracking-panel__title-row">
          <h3 className="tracking-panel__title">{selectedSection.label}</h3>
          <Button variant="secondary" size="xs" symbol={false} onClick={() => onSelect?.(null)} aria-label="Close section">
            Close
          </Button>
        </div>
        <p className="tracking-panel__caption">
          {`${describeSectionKind(selectedSection)} · ${total === 1 ? "1 vehicle" : `${total} vehicles`}`}
        </p>
      </div>

      {selectedSection.id !== NA_VEHICLE_LOCATION_ID && <SectionStats occupancy={occupancy} />}
      {!occupancy.capacityConfirmed && occupancy.capacity !== null && (
        <p className="tracking-panel__caption">Capacity is provisional until the section is measured.</p>
      )}

      {message && <StatusMessage tone={message.tone}>{message.text}</StatusMessage>}

      {total > SECTION_SEARCH_THRESHOLD && (
        <SearchBar
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          placeholder={`Search ${selectedSection.label}`}
          ariaLabel={`Search vehicles in ${selectedSection.label}`}
        />
      )}

      {sectionEntries.length === 0 ? (
        <p className="tracking-panel__empty">
          {query ? "No vehicles in this section match your search." : "No vehicles are recorded in this section."}
        </p>
      ) : (
        <ul className="tracking-panel__list">
          {sectionEntries.map((entry) => {
            const key = getEntryKey(entry);
            return (
              <VehicleRow
                key={key}
                entry={entry}
                isHighlighted={key === highlightKey}
                getFlags={getFlags}
                getVehicleLabel={getVehicleLabel}
                formatRelativeTime={formatRelativeTime}
                onOpenEntry={onOpenEntry}
                onMove={handleMove}
                moving={movingKey === key}
              />
            );
          })}
        </ul>
      )}
    </LayerSurface>
  );
}
