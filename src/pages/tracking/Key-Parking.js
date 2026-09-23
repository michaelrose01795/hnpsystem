// file location: src/pages/tracking/Key-Parking.js
//
// /tracking/Key-Parking — where every job's vehicle and keys are. This was the
// Key/Parking tab of the old four-tab /tracking page; Loan Cars, Equipment/Tools
// and Oil/Stock are now their own pages (Loan-car.js, Equipment-Tools.js,
// Oil-Stock.js) reached from the Service, Workshop and Parts sidebar modules.
// /tracking itself only redirects old links here (see ./index.js).
"use client";

import React, { memo, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { buildApiUrl } from "@/utils/apiClient";
import { useCoalescedRefresh } from "@/hooks/useCoalescedRefresh"; // collapse realtime bursts into one refetch
import { getAutoMovementRule } from "@/lib/tracking/autoMovement"; // shared rule table; the write itself is server-owned
import { supabaseClient } from "@/lib/database/supabaseClient";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { TrackingRouteSkeleton } from "@/components/ui/RouteSkeletons";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { Button, EmptyState, InputField, StatusMessage } from "@/components/ui";
import PopupModal from "@/components/popups/popupStyleApi";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import LayerSurface from "@/components/ui/LayerSurface"; // canonical --surface inner-section primitive
import LayerTheme from "@/components/ui/LayerTheme"; // canonical --theme summary-tile primitive
import TrackingDashboardUi from "@/components/page-ui/tracking/tracking-ui"; // Extracted presentation layer.
import useIdleWarm from "@/hooks/useIdleWarm";
import { logFailure } from "@/lib/utils/logFailure";
import { summariseSectionOccupancy } from "@/features/tracking/map/trackingMapModel"; // section-based occupancy (no bay registry)
import {
  CAR_LOCATIONS,
  CAR_LOCATION_OPTIONS,
  KEY_LOCATIONS,
  KEY_LOCATION_OPTIONS,
  ensureDropdownOption,
  normalizeKeyLocationLabel,
} from "@/lib/jobCards/locations"; // shared location vocabulary — no local copy
import {
  VEHICLE_LOCATIONS,
  formatVehicleLocation,
  getVehicleLocationId,
  isCanonicalVehicleLocation,
  toVehicleLocationFormValue,
} from "@/lib/tracking/vehicleLocations"; // canonical vehicle-location registry
import {
  getTrackerGroup,
  getTrackerLocationFlags,
  getTrackerRiskScore,
  isDepartedEntry,
  summariseTrackerEntries,
} from "@/features/tracking/trackingEntryState";

// `TrackingSiteMap` only mounts while the page is showing the Map view; Grid is
// the default, so the site plan, its space registry and its stylesheet stay out
// of the first paint. It is code-split and warmed on idle, so switching to Map
// finds the chunk already in cache rather than waiting on a request.
const loadTrackingSiteMap = () => import("@/features/tracking/map/TrackingSiteMap");
const TrackingSiteMap = dynamic(loadTrackingSiteMap, { ssr: false });

// Vehicle and key location vocabularies used to be copied verbatim into this
// file. They now come from src/lib/jobCards/locations.js (key) and the
// canonical registry src/lib/tracking/vehicleLocations.js (vehicle), so this
// page, the job card, the technician workspace and the site map cannot drift.
// Vehicle dropdowns use CAR_LOCATION_OPTIONS as-is — never ensureDropdownOption,
// which would re-offer legacy free text; key dropdowns keep it.

const NEXT_ACTION_ENDPOINT = "/api/tracking/next-action";

const TRACKING_SNAPSHOT_ENDPOINT = "/api/tracking/snapshot";

const TRACKING_CARD_GRID_TEMPLATE = "repeat(auto-fit, minmax(min(100%, 320px), 1fr))";

// A busy workshop tracks several hundred jobs, and mounting every card in one
// pass held the first paint of the grid back. The first screenful mounts
// straight away; the rest follow in a non-urgent transition just after, so the
// page is readable (and interactive) while they arrive. Every card still
// renders — nothing is paged away from search or the browser's find.
const INITIAL_CARD_BATCH = 36;

const renderTrackingSummaryItem = (item) => (
  <LayerTheme
    key={item.label}
    className="app-summary-item"
    radius="var(--radius-sm)"
    padding="8px 10px"
    gap="2px var(--space-sm)"
    style={{
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: "44px",
      minWidth: 0
    }}>
    <span className="app-summary-label">{item.label}</span>
    <strong className="app-summary-value">{item.value}</strong>
  </LayerTheme>
);

const emptyForm = {
  id: null,
  jobNumber: "",
  reg: "",
  customer: "",
  serviceType: "",
  makeModel: "",
  colour: "",
  vehicleDisplay: "",
  updatedAt: null,
  vehicleLocation: "N/A",
  keyLocation: "N/A",
  keyTip: "",
  status: "Waiting For Collection",
  notes: ""
};

const getVehicleSummaryLabel = (entry = {}) => {
  if (entry.vehicleDisplay) return entry.vehicleDisplay;
  return [entry.makeModel, entry.colour].filter(Boolean).join(" • ");
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "now";
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(1, Math.round(diff / (1000 * 60)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const TRACKER_QUICK_FILTERS = [
{ id: "all", label: "All" },
{ id: "overdue", label: "Overdue" },
{ id: "unknown", label: "Unknown Location" },
{ id: "workshop", label: "Workshop" },
{ id: "collection", label: "Collection" },
{ id: "customer-waiting", label: "Customer Waiting" }];


const VEHICLE_SECTION_FILTER_PREFIX = "section:";

const TRACKER_LOCATION_FILTERS = [
{ key: "all", value: "all", label: "All locations" },
{ key: "service-desk", value: "service-desk", label: "Service Desk" },
{ key: "workshop-board", value: "workshop-board", label: "Workshop Board" },
{ key: "collection", value: "collection", label: "Collection" },
{ key: "workshop-bays", value: "workshop-bays", label: "Workshop Bays" },
// Departed vehicles now group separately instead of being scattered through
// the on-site groups, so they are filterable rather than invisible. Labelled
// "Departed", not "Off Site": Off Site is now a real vehicle-location section
// (below) and the two must never be confused.
{ key: "off-site", value: "off-site", label: "Departed" },
{ key: "other", value: "other", label: "Other locations" },
{ key: "unknown", value: "unknown", label: "Unknown location" },
// Every canonical vehicle-location section, filterable directly. The value is
// prefixed so it can never collide with a group id above.
...VEHICLE_LOCATIONS.map((section) => ({
  key: `section-${section.id}`,
  value: `${VEHICLE_SECTION_FILTER_PREFIX}${section.id}`,
  label: section.label,
  description: "Vehicle location"
}))];


// The classification rules and the summary live in one tested module so the
// Grid view, the Map view and the unit tests cannot drift. Fixing them there
// is what corrected "384 off-site / 384 overdue / 64 waiting" — see the
// header of src/features/tracking/trackingEntryState.js.

const CombinedTrackerCard = ({ entry, isHighlighted, onClick, isMobileView = false }) => {
  const vehicleMeta = getVehicleSummaryLabel(entry);
  void isMobileView;

  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px 18px",
        borderRadius: "var(--radius-sm)",
        border: "none",
        background: isHighlighted ? "rgba(var(--danger-rgb), 0.08)" : "var(--theme)",
        boxShadow: "none",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        minHeight: "214px",
        height: "100%"
      }}>

      <LayerSurface
        radius="var(--radius-sm)"
        padding="10px 12px"
        gap="4px"
        style={{ minWidth: 0 }}>

        <strong
          style={{
            fontSize: "clamp(0.78rem, 1.4vw, var(--text-h3))",
            fontWeight: 700,
            color: "var(--text-1)",
            display: "block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}>

          Job {entry.jobNumber || "Unknown job"}
        </strong>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: isMobileView ? "1fr" : "repeat(2, minmax(0, 1fr))",
            gap: "4px 12px",
            margin: "4px 0 0",
            minWidth: 0,
            fontSize: "var(--text-caption)",
            color: "var(--text-1)"
          }}>

          {[
          ["Registration", entry.reg || "Unknown reg"],
          ["Customer", entry.customer || "Customer pending"],
          ["Vehicle", vehicleMeta || "Make/Model/Colour pending"],
          ["Last moved", formatRelativeTime(entry.updatedAt)]].map(([label, value]) =>
          <div key={label} style={{ minWidth: 0 }}>
              <dt style={{ fontWeight: 700, textTransform: "uppercase", opacity: 0.72 }}>{label}</dt>
              <dd
              style={{
                margin: "2px 0 0",
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>

                {value}
              </dd>
            </div>
          )}
        </dl>
      </LayerSurface>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobileView ? "1fr" : "1fr 1fr",
          gap: "8px",
          minWidth: 0
        }}>

        <LayerSurface
          radius="var(--radius-sm)"
          padding="10px 12px"
          gap="2px"
          style={{ minWidth: 0 }}>

          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--text-1)" }}>Key location</p>
          <strong
            style={{
              fontSize: "clamp(0.72rem, 1.1vw, var(--text-body))",
              color: "var(--text-accent)",
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>

            {normalizeKeyLocationLabel(entry.keyLocation) || "Pending"}
          </strong>
        </LayerSurface>
        <LayerSurface
          radius="var(--radius-sm)"
          padding="10px 12px"
          gap="2px"
          style={{ minWidth: 0 }}>

          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--text-1)" }}>Car location</p>
          <strong
            style={{
              fontSize: "clamp(0.72rem, 1.1vw, var(--text-body))",
              color: "var(--success-dark)",
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>

            {formatVehicleLocation(entry.vehicleLocation)}
          </strong>
        </LayerSurface>
      </div>
    </div>);

};
// One grid cell. Memoised so a search keystroke, a filter change or a modal
// opening only re-renders the cards whose entry actually changed.
const TrackerGridItem = memo(function TrackerGridItem({ entry, index, isHighlighted, isMobileView, onOpenEntry }) {
  const group = getTrackerGroup(entry);
  return (
    <DevLayoutSection
      sectionKey={`tracking-active-jobs-card-${group.id}-${index + 1}`}
      parentKey="tracking-active-jobs-list"
      sectionType="content-card">

      <CombinedTrackerCard
        entry={entry}
        isHighlighted={isHighlighted}
        isMobileView={isMobileView}
        onClick={() => onOpenEntry(entry)} />

    </DevLayoutSection>);

});

const LocationSearchModal = ({ type, options, onClose, onSelect }) => {
  const [query, setQuery] = useState("");
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <PopupModal
      isOpen
      onClose={onClose}
      ariaLabel="Search location"
      cardStyle={{
        width: "min(100%, 600px)",
        padding: "var(--section-card-padding)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--layout-card-gap)",
      }}>

        {/* Compact popup header convention: one clear title plus actions, no
            eyebrow label (staffglobal.css .app-popup-compact-header). */}
        <header className="app-popup-compact-header">
          <h2>{type === "car" ? "Search parking location" : "Search key location"}</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        <SearchBar
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          placeholder={type === "car" ? "Search bays or overflow" : "Search key safes, drawers"} />


        <div
          style={{
            maxHeight: "320px",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)"
          }}>

          {/* Each result is a --theme layer on the popup card's --surface, per
              the layer alternation law. */}
          {filtered.map((option) =>
          <LayerTheme
            key={option.id}
            padding="var(--space-4)"
            gap="var(--space-3)"
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap"
            }}>

              <strong>{option.label}</strong>
              <Button variant="secondary" size="sm" onClick={() => onSelect(option)}>
                Use location
              </Button>
            </LayerTheme>
          )}

          {filtered.length === 0 &&
          <EmptyState
            variant="bare"
            role="status"
            title="No locations found"
            description="Try a different search term." />

          }
        </div>

        {/* TODO: Replace static location lists with DB-driven results */}
    </PopupModal>);

};

const SimplifiedTrackingModal = ({ initialData, onClose, onSave }) => {
  const [form, setForm] = useState(() => ({
    jobNumber: initialData?.jobNumber || "",
    reg: initialData?.reg || "",
    customer: initialData?.customer || "",
    makeModel: initialData?.makeModel || "",
    colour: initialData?.colour || "",
    vehicleLocation: toVehicleLocationFormValue(initialData?.vehicleLocation),
    keyLocation: initialData?.keyLocation || KEY_LOCATIONS[0].label
  }));
  const [showUpdate, setShowUpdate] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-fill functionality when job number, reg, or customer is entered
  const handleAutoFill = async (searchField, searchValue) => {
    if (!searchValue || searchValue.trim().length < 2) return;

    setIsSearching(true);
    try {
      // Try to fetch job details from the database
      const { data, error } = await supabaseClient.
      from("jobs").
      select(`
          job_number,
          vehicle:vehicle_id(registration, reg, make, model, make_model, colour),
          customer:customer_id(name, firstname, lastname)
        `).
      or(
        searchField === "jobNumber" ? `job_number.ilike.%${searchValue}%` :
        searchField === "reg" ? `vehicle_id.registration.ilike.%${searchValue}%,vehicle_id.reg.ilike.%${searchValue}%` :
        `customer_id.name.ilike.%${searchValue}%,customer_id.firstname.ilike.%${searchValue}%,customer_id.lastname.ilike.%${searchValue}%`
      ).
      limit(1).
      single();

      if (!error && data) {
        setForm((prev) => ({
          ...prev,
          jobNumber: data.job_number || prev.jobNumber,
          reg: data.vehicle?.registration || data.vehicle?.reg || prev.reg,
          customer: data.customer?.name || `${data.customer?.firstname || ""} ${data.customer?.lastname || ""}`.trim() || prev.customer,
          makeModel: data.vehicle?.make_model || `${data.vehicle?.make || ""} ${data.vehicle?.model || ""}`.trim() || prev.makeModel,
          colour: data.vehicle?.colour || prev.colour
        }));
      }
    } catch (err) {
      logFailure("Auto-fill error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddLocation = (event) => {
    event.preventDefault();

    if (!form.jobNumber && !form.reg && !form.customer) {
      alert("Please fill in at least one of: Job Number, Registration, or Customer name");
      return;
    }

    const actionType = "job_checked_in";
    onSave({ ...form, actionType, context: "car" });
  };

  const handleUpdateLocation = (event) => {
    event.preventDefault();

    if (!form.jobNumber && !form.reg && !form.customer) {
      alert("Please fill in at least one of: Job Number, Registration, or Customer name");
      return;
    }

    const actionType = "location_update";
    onSave({ ...form, actionType, context: "update" });
  };

  return (
    <PopupModal
      isOpen
      onClose={onClose}
      ariaLabel="Vehicle and key tracking"
      cardStyle={{
        width: "min(100%, 800px)",
        padding: "var(--section-card-padding)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--layout-card-gap)",
      }}>

        <header className="app-popup-compact-header">
          <h2>Vehicle &amp; Key Tracking</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        {/* Canonical record fields on a --theme layer, per the surface ladder. */}
        <LayerTheme radius="var(--radius-sm)" padding="var(--space-md)">
          <div className="app-record-grid">
            {[
            ["Job Number", form.jobNumber],
            ["Registration", form.reg],
            ["Make & Model", form.makeModel],
            ["Colour", form.colour],
            ["Customer", form.customer]].
            map(([label, value]) =>
            <div key={label} className="app-record-field">
                <span className="app-record-field__label">{label}</span>
                <span className="app-record-field__value">{value || "—"}</span>
              </div>
            )}
          </div>
        </LayerTheme>

        <form onSubmit={handleAddLocation} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <h3 style={{ margin: "0" }}>Add Location</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-3)"
            }}>

            <InputField
              label="Job Number / Reg / Customer"
              value={form.jobNumber || form.reg || form.customer}
              onChange={(e) => {
                const value = e.target.value;
                if (value.match(/^\d+$/)) {
                  handleChange("jobNumber", value);
                  handleAutoFill("jobNumber", value);
                } else if (value.match(/^[A-Z0-9\s]+$/i) && value.length <= 10) {
                  handleChange("reg", value);
                  handleAutoFill("reg", value);
                } else {
                  handleChange("customer", value);
                  handleAutoFill("customer", value);
                }
              }}
              placeholder="Enter job number, reg, or customer name"
              disabled={isSearching} />

          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <DropdownField
              label="Vehicle Location"
              options={CAR_LOCATION_OPTIONS}
              value={form.vehicleLocation}
              onValueChange={(value) => handleChange("vehicleLocation", value)}
              placeholder="Select location"
              size="md" />

            <DropdownField
              label="Key Location"
              options={KEY_LOCATION_OPTIONS}
              value={form.keyLocation}
              onValueChange={(value) => handleChange("keyLocation", value)}
              placeholder="Select key location"
              size="md" />

          </div>

          <Button type="submit" variant="primary">
            Add Location
          </Button>
        </form>

        {/* The old 1px rule here painted --primary-border, a banned token that
            resolves to transparent — it rendered nothing. Borders law, §3.0a. */}
        <Button
          type="button"
          variant={showUpdate ? "primary" : "secondary"}
          onClick={() => setShowUpdate(!showUpdate)}>

          {showUpdate ? "Hide Update Section" : "Update Existing Location"}
        </Button>

        {showUpdate &&
        <form
          onSubmit={handleUpdateLocation}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

            <h3 style={{ margin: "0" }}>Update Location</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <DropdownField
              label="Vehicle Location"
              options={CAR_LOCATION_OPTIONS}
              value={form.vehicleLocation}
              onValueChange={(value) => handleChange("vehicleLocation", value)}
              placeholder="Select location"
              size="md" />

              <DropdownField
              label="Key Location"
              options={KEY_LOCATION_OPTIONS}
              value={form.keyLocation}
              onValueChange={(value) => handleChange("keyLocation", value)}
              placeholder="Select key location"
              size="md" />

            </div>

            <Button type="submit" variant="primary">
              Update
            </Button>
          </form>
        }
    </PopupModal>);

};

const LocationEntryModal = ({ context, entry, onClose, onSave, existingEntries = [] }) => {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...entry,
    vehicleDisplay: entry?.vehicleDisplay || getVehicleSummaryLabel(entry || {}),
    vehicleLocation: toVehicleLocationFormValue(entry?.vehicleLocation),
    keyLocation: normalizeKeyLocationLabel(entry?.keyLocation) || KEY_LOCATIONS[0].label,
    status: entry?.status || "Waiting For Collection"
  }));
  const [matchedExisting, setMatchedExisting] = useState(Boolean(entry)); // tracks whether form auto-filled from existing entry
  const vehicleDisplay = form.vehicleDisplay || getVehicleSummaryLabel(form) || "";
  const lastMovedLabel = form.updatedAt ? formatRelativeTime(form.updatedAt) : "Pending";
  // Canonical options only: a legacy value has already been resolved (or
  // cleared to the placeholder) by toVehicleLocationFormValue above.
  const vehicleLocationOptions = CAR_LOCATION_OPTIONS;
  const keyLocationOptions = useMemo(
    () => ensureDropdownOption(KEY_LOCATION_OPTIONS, form.keyLocation),
    [form.keyLocation]
  );

  // Auto-fill from existing entries when job number, reg, or customer matches
  const tryAutoFill = useCallback(
    (field, value) => {
      if (!value || !value.trim() || entry) return null; // skip if already editing an entry
      const trimmed = value.trim().toLowerCase();
      const match = existingEntries.find((e) => {
        if (field === "jobNumber") return e.jobNumber && e.jobNumber.trim().toLowerCase() === trimmed;
        if (field === "reg") return e.reg && e.reg.trim().toLowerCase() === trimmed;
        if (field === "customer") return e.customer && e.customer.trim().toLowerCase() === trimmed;
        return false;
      });
      return match || null;
    },
    [existingEntries, entry]
  );

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    // Auto-fill when typing in jobNumber, reg, or customer and a match is found
    if (["jobNumber", "reg", "customer"].includes(field)) {
      const match = tryAutoFill(field, value);
      if (match) {
        setForm((prev) => ({
          ...prev,
          [field]: value, // keep what user typed for this field
          id: match.id || prev.id,
          jobId: match.jobId || prev.jobId,
          jobNumber: field === "jobNumber" ? value : match.jobNumber || prev.jobNumber,
          reg: field === "reg" ? value : match.reg || prev.reg,
          customer: field === "customer" ? value : match.customer || prev.customer,
          serviceType: match.serviceType || prev.serviceType,
          colour: match.colour || prev.colour,
          makeModel: match.makeModel || prev.makeModel,
          vehicleDisplay: getVehicleSummaryLabel(match) || prev.vehicleDisplay,
          updatedAt: match.updatedAt || prev.updatedAt,
          vehicleLocation: match.vehicleLocation ? toVehicleLocationFormValue(match.vehicleLocation) : prev.vehicleLocation,
          keyLocation: normalizeKeyLocationLabel(match.keyLocation) || prev.keyLocation,
          status: match.status || prev.status,
          notes: match.notes || prev.notes
        }));
        setMatchedExisting(true); // switch heading to "Edit existing"
      } else {
        setMatchedExisting(false); // revert to "Log new" if no match
      }
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    // Validate that at least one of the key fields is filled
    const hasJobNumber = form.jobNumber && form.jobNumber.trim();
    const hasReg = form.reg && form.reg.trim();
    const hasCustomer = form.customer && form.customer.trim();

    if (!hasJobNumber && !hasReg && !hasCustomer) {
      alert("Please fill in at least one of: Job Number, Registration, or Customer name");
      return;
    }

    const actionType = context === "car" ? "job_checked_in" : "job_complete";
    onSave({ ...form, actionType, context });
  };

  return (
    <PopupModal
      isOpen
      onClose={onClose}
      ariaLabel={entry || matchedExisting ? "Edit existing tracking entry" : "Log new tracking entry"}
      cardStyle={{
        width: "min(100%, 640px)",
        maxHeight: "90vh",
        overflowY: "auto",
        padding: "var(--section-card-padding)",
      }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "18px"
        }}>

        <header className="app-popup-compact-header">
          <h2>{entry || matchedExisting ? "Edit existing" : "Log new"}</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="submit" variant="primary" size="sm">
              Save update
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        {/* Job identity card. "Last moved" is shown here and nowhere else in
            this popup. Tiles sit on --theme, so each takes the --surface fill. */}
        <LayerTheme
          radius="var(--radius-sm)"
          padding="12px"
          gap="10px"
          style={{ minWidth: 0 }}>
          <h3 className="app-record-heading">Job {form.jobNumber || "Unknown job"}</h3>
          <div className="app-record-grid">
            {[
            ["Registration", form.reg || "Unknown reg"],
            ["Customer", form.customer || "Customer pending"],
            ["Vehicle", vehicleDisplay || "Make/Model/Colour pending"],
            ["Last moved", lastMovedLabel]].
            map(([label, value]) =>
            <div key={label} className="app-record-field">
                <span className="app-record-field__label">{label}</span>
                <span className="app-record-field__value">{value}</span>
              </div>
            )}
          </div>
        </LayerTheme>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px"
          }}>

          {[
          { label: "Job Number", field: "jobNumber", placeholder: "00040" },
          { label: "Registration", field: "reg", placeholder: "GY21 HNP" },
          { label: "Customer", field: "customer", placeholder: "Customer name" },
          { label: "Vehicle", field: "vehicleDisplay", placeholder: "MERCEDES-BENZ • BLACK" }].
          map((input) =>
          <InputField
            key={input.field}
            label={input.label}
            value={form[input.field]}
            onChange={(event) => handleChange(input.field, event.target.value)}
            placeholder={input.placeholder} />

          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--space-2)"
          }}>

          <DropdownField
            label="Car location"
            options={vehicleLocationOptions}
            value={form.vehicleLocation}
            onValueChange={(value) => handleChange("vehicleLocation", value)}
            placeholder="Select location"
            size="md" />

          <DropdownField
            label="Key location"
            required
            options={keyLocationOptions}
            value={form.keyLocation}
            onValueChange={(value) => handleChange("keyLocation", value)}
            placeholder="Select key location"
            size="md" />

        </div>

        {/* TODO: Persist vehicle/key updates via API endpoint */}
      </form>
    </PopupModal>);

};

export default function TrackingDashboard() {
  const router = useRouter();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchModal, setSearchModal] = useState({ open: false, type: null });
  const [entryModal, setEntryModal] = useState({ open: false, type: null, entry: null });
  const [simplifiedModal, setSimplifiedModal] = useState({ open: false, initialData: null });
  const [highlightedJobNumber, setHighlightedJobNumber] = useState(null);
  // The page renders as either the tracker card grid or the inline site map.
  // Grid is the default; the switch never leaves the page and never touches
  // the search term or either filter.
  const [trackerView, setTrackerView] = useState("grid");
  const { dbUserId } = useUser();

  // The map view is reachable by every role on this page, so its chunk is
  // warmed unconditionally.
  useIdleWarm([loadTrackingSiteMap]);
  const [isMobileView, setIsMobileView] = useState(false); // portrait phone layout toggle
  const [trackerSearchTerm, setTrackerSearchTerm] = useState("");
  const [trackerQuickFilter, setTrackerQuickFilter] = useState("all");
  const [trackerLocationFilter, setTrackerLocationFilter] = useState("all");

  // Match the portrait-phone behaviour used across the app shell.
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px) and (orientation: portrait)");
    setIsMobileView(mediaQuery.matches);
    const handler = (event) => setIsMobileView(event.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Read through the API rather than calling `fetchTrackingSnapshot()` in the
  // browser.
  //
  // The direct call ran two deeply-joined Supabase queries from the page under
  // the public anon key, which (a) put the whole of lib/database/tracking.js —
  // loan-car helpers included — into this route's first-load bundle, (b) made
  // the route's data load invisible to the Server-Timing/hnpPerf instrumentation
  // every other hot route now reports through, and (c) required the tracking
  // tables to stay readable by anon. /api/tracking/snapshot already existed,
  // is role-guarded, runs the identical query under the service role and
  // returns the identical shape.
  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl(TRACKING_SNAPSHOT_ENDPOINT));
      const snapshot = await response.json().catch(() => null);
      if (!response.ok || !snapshot?.success) {
        throw new Error(snapshot?.message || "Failed to load tracking data");
      }
      const normalized = Array.isArray(snapshot.data) ? snapshot.data : [];
      setEntries(normalized);
    } catch (fetchError) {
      logFailure("Failed to fetch tracking snapshot", fetchError);
      setEntries([]);
      setError(fetchError?.message || "Unable to load tracking data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Handle URL parameters from job card redirect
  useEffect(() => {
    if (!router.isReady) return;

    const { jobNumber, reg, customer, makeModel, colour, openPopup } = router.query;

    // If we have URL params, check if an entry exists for this job
    if (jobNumber || reg || customer) {
      setHighlightedJobNumber(jobNumber);

      // If openPopup=true, use the simplified modal with pre-filled data
      if (openPopup === "true") {
        setSimplifiedModal({
          open: true,
          initialData: {
            jobNumber: jobNumber || "",
            reg: reg || "",
            customer: customer || "",
            makeModel: makeModel || "",
            colour: colour || ""
          }
        });
        return;
      }

      // Check if an existing entry matches the job
      const existingEntry = entries.find(
        (entry) =>
        jobNumber && entry.jobNumber?.toLowerCase() === jobNumber.toLowerCase() ||
        reg && entry.reg?.toLowerCase() === reg.toLowerCase()
      );

      // If no existing entry found, auto-open the Log New popup with pre-filled data
      if (!existingEntry && entries.length > 0) {
        openEntryModal("car", {
          ...emptyForm,
          jobNumber: jobNumber || "",
          reg: reg || "",
          customer: customer || ""
        });
      }
    }
  }, [router.isReady, router.query, entries]);

  // The job-status subscription below is unfiltered by design — any job in the
  // workshop can trip an auto-movement rule — so on a busy day it fires often,
  // and every hit reloaded the entire tracking list. The reload is now coalesced,
  // and skipped entirely while the tab is hidden.
  const scheduleEntriesRefresh = useCoalescedRefresh(loadEntries);

  // This page is a *viewer* of automatic movement, not its owner.
  //
  // It used to answer this subscription by POSTing the movement itself, which
  // meant the write only happened when somebody had this page open, happened
  // once per open tab, and was attributed to whoever was watching rather than
  // to whoever changed the status. That write now belongs to the status change
  // (`updateJob` and /api/status/update, via
  // `recordAutomaticMovementForStatus`), so all this subscription has to do is
  // notice that the underlying data moved and refresh the list.
  //
  // The subscription stays unfiltered by design — any job in the workshop can
  // trip a rule — so on a busy day it fires often. The refresh is coalesced and
  // skipped entirely while the tab is hidden, and the callback now does no
  // network work of its own.
  useEffect(() => {
    const channel = supabaseClient.
    channel("tracking-job-status").
    on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "jobs" },
      (payload) => {
        const newJob = payload?.new;
        const oldJob = payload?.old;
        if (!newJob?.status || newJob.status === oldJob?.status) {
          return;
        }
        // Gated on the same rule table as before, so the refresh cadence this
        // page has today is unchanged — only the write has moved away.
        if (!getAutoMovementRule(newJob.status)) return;
        scheduleEntriesRefresh();
      }
    ).
    subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [scheduleEntriesRefresh]);

  // Priority audit: this page previously sorted assigned-to-me jobs first, then
  // newest movement. Keep that useful personal tie-breaker, but put location
  // risk ahead of it so unknown/stale/key-moved records cannot be buried.
  const activeEntries = useMemo(() => {
    const isMine = (entry) => {
      if (!dbUserId) return false;
      const assigned = Number(entry?.assignedTo);
      return Number.isInteger(assigned) && assigned === Number(dbUserId);
    };
    return entries.
    filter((entry) => entry.jobId).
    sort((a, b) => {
      const riskDiff = getTrackerRiskScore(b) - getTrackerRiskScore(a);
      if (riskDiff !== 0) return riskDiff;
      const mineA = isMine(a) ? 1 : 0;
      const mineB = isMine(b) ? 1 : 0;
      if (mineA !== mineB) return mineB - mineA; // user's own jobs first
      return (
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

    });
  }, [entries, dbUserId]);

  // Typing stays immediate; the grid filters against the deferred term, so a
  // keystroke never waits for hundreds of cards to re-render.
  const deferredSearchTerm = useDeferredValue(trackerSearchTerm);
  const filteredActiveEntries = useMemo(() => {
    const query = deferredSearchTerm.trim().toLowerCase();

    return activeEntries.filter((entry) => {
      const flags = getTrackerLocationFlags(entry);
      const group = getTrackerGroup(entry);
      const matchesSearch =
      !query ||
      [
      entry.jobNumber,
      entry.reg,
      entry.customer,
      entry.makeModel,
      entry.colour,
      entry.serviceType,
      entry.status,
      entry.vehicleLocation,
      formatVehicleLocation(entry.vehicleLocation),
      normalizeKeyLocationLabel(entry.keyLocation)].

      filter(Boolean).
      some((value) => String(value).toLowerCase().includes(query));

      if (!matchesSearch) {
        return false;
      }

      if (trackerLocationFilter.startsWith(VEHICLE_SECTION_FILTER_PREFIX)) {
        // Vehicle-location section filter: matches on where the CAR is, never
        // on the key location.
        if (getVehicleLocationId(entry.vehicleLocation) !== trackerLocationFilter.slice(VEHICLE_SECTION_FILTER_PREFIX.length)) {
          return false;
        }
      } else if (trackerLocationFilter !== "all" && group.id !== trackerLocationFilter) {
        return false;
      }

      if (trackerQuickFilter === "overdue") return flags.isOverdue;
      if (trackerQuickFilter === "unknown") return flags.isUnknown;
      if (trackerQuickFilter === "workshop") return flags.isWorkshop;
      if (trackerQuickFilter === "collection") return flags.isCollection;
      if (trackerQuickFilter === "customer-waiting") return flags.isCustomerWaiting;

      return true;
    });
  }, [activeEntries, trackerLocationFilter, trackerQuickFilter, deferredSearchTerm]);

  // See INITIAL_CARD_BATCH. Once the full grid has been mounted it stays
  // mounted; later filter changes render at the deferred priority above.
  const [cardLimit, setCardLimit] = useState(INITIAL_CARD_BATCH);
  const needsMoreCards = filteredActiveEntries.length > cardLimit;
  useEffect(() => {
    if (!needsMoreCards) return undefined;
    // After the first batch has painted, not in the same frame.
    const frame = window.requestAnimationFrame(() => {
      startTransition(() => setCardLimit(Infinity));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [needsMoreCards]);
  const renderedEntries = useMemo(
    () => (needsMoreCards ? filteredActiveEntries.slice(0, cardLimit) : filteredActiveEntries),
    [cardLimit, filteredActiveEntries, needsMoreCards]
  );

  // Live vehicles only — departed (collected / closed) jobs are history and
  // must never occupy a section. The Map view and the tiles read the same set.
  const liveActiveEntries = useMemo(
    () => activeEntries.filter((entry) => !isDepartedEntry(entry)),
    [activeEntries]
  );
  const liveFilteredEntries = useMemo(
    () => filteredActiveEntries.filter((entry) => !isDepartedEntry(entry)),
    [filteredActiveEntries]
  );

  // Occupancy comes from the canonical sections and their configured
  // capacities — the same model the Map view draws — so the tiles and the
  // plan can never disagree. No bay registry is involved.
  const trackerMapping = useMemo(() => summariseSectionOccupancy(liveActiveEntries), [liveActiveEntries]);

  const trackerSummaryItems = useMemo(() => {
    const summary = summariseTrackerEntries(activeEntries, trackerMapping);
    return [
    { label: "Active Vehicles", value: summary.activeTracked },
    { label: "Mapped", value: summary.onSiteMapped },
    { label: "Unmapped", value: summary.onSiteUnmapped },
    { label: "Departed", value: summary.offSite },
    { label: "Overdue", value: summary.overdue },
    { label: "Waiting", value: summary.customerWaiting },
    { label: "Occupied", value: summary.occupiedSpaces },
    { label: "Available", value: summary.availableSpaces }];

  }, [activeEntries, trackerMapping]);

  const closeSearchModal = () => setSearchModal({ open: false, type: null });

  const openEntryModal = (type, entry = null) => setEntryModal({ open: true, type, entry });
  const closeEntryModal = () => setEntryModal({ open: false, type: null, entry: null });

  const handleLocationSelect = (option) => {
    closeSearchModal();
    openEntryModal(searchModal.type, {
      ...emptyForm,
      vehicleLocation: searchModal.type === "car" ? option.label : CAR_LOCATIONS[0].label,
      keyLocation: searchModal.type === "key" ? option.label : KEY_LOCATIONS[0].label
    });
  };

  const handleSave = async (form) => {
    try {
      setError(null);
      const jobNumberQuery = form.jobNumber ? form.jobNumber.trim() : "";
      const regQuery = form.reg ? form.reg.trim() : "";
      let resolvedJob = null;

      if (!form.jobId && jobNumberQuery) {
        const { data: jobMatches, error: jobLookupError } = await supabaseClient.
        from("jobs").
        select("id, vehicle_id").
        ilike("job_number", jobNumberQuery).
        limit(1);

        if (jobLookupError) {
          console.warn("Job lookup failed", jobLookupError);
        } else {
          resolvedJob = jobMatches?.[0] || null;
        }
      }

      if (!resolvedJob && !form.vehicleId && regQuery) {
        const { data: regMatches, error: regLookupError } = await supabaseClient.
        from("jobs").
        select("id, vehicle_id").
        ilike("vehicle_reg", regQuery).
        limit(1);

        if (regLookupError) {
          console.warn("Vehicle lookup failed", regLookupError);
        } else {
          resolvedJob = regMatches?.[0] || null;
        }
      }

      const payload = {
        actionType: form.actionType || "job_complete",
        jobId: form.jobId || resolvedJob?.id || null,
        jobNumber: jobNumberQuery ? jobNumberQuery.toUpperCase() : "",
        vehicleId: form.vehicleId || resolvedJob?.vehicle_id || null,
        vehicleReg: regQuery ? regQuery.toUpperCase() : "",
        keyLocation: form.keyLocation,
        // "" means an unrecognised legacy value the user did not re-choose:
        // leave the vehicle side unaddressed rather than overwrite it.
        vehicleLocation: form.vehicleLocation || undefined,
        notes: form.notes,
        performedBy: dbUserId || null
      };

      const response = await fetch(buildApiUrl(NEXT_ACTION_ENDPOINT), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ message: "Failed to save entry" }));
        throw new Error(errorPayload?.message || "Failed to save entry");
      }

      await loadEntries();
      closeEntryModal();
      setSimplifiedModal({ open: false, initialData: null });
      return true;
    } catch (saveError) {
      logFailure("Failed to log tracking entry", saveError);
      setError(saveError.message || "Unable to save tracking entry");
      return false;
    }
  };

  // The shape LocationEntryModal expects. Shared by the tracker card grid and
  // the site map so both open the same editor on the same record.
  const openTrackingEntry = (entry) =>
  openEntryModal("car", {
    id: entry.id,
    jobId: entry.jobId,
    jobNumber: entry.jobNumber,
    reg: entry.reg,
    customer: entry.customer,
    makeModel: entry.makeModel,
    colour: entry.colour,
    vehicleDisplay: getVehicleSummaryLabel(entry),
    serviceType: entry.serviceType,
    vehicleLocation: entry.vehicleLocation,
    keyLocation: entry.keyLocation,
    status: entry.status,
    keyTip: entry.keyTip,
    notes: entry.notes,
    updatedAt: entry.updatedAt
  });
  // A stable handle for the memoised grid cards, always calling the current
  // openTrackingEntry.
  const openTrackingEntryRef = useRef(openTrackingEntry);
  openTrackingEntryRef.current = openTrackingEntry;
  const openGridEntry = useCallback((entry) => openTrackingEntryRef.current(entry), []);

  // Moving a vehicle from the map is the SAME server-owned write the Update
  // Location modal performs — one `location_update` through /api/tracking/
  // next-action, appended to vehicle_tracking_events, followed by the same
  // snapshot refresh. No key event is sent, so a vehicle move never disturbs
  // where the keys are recorded. There is no map-specific persistence and no
  // schema change: the destination is written as the location value the
  // tracking vocabulary already uses.
  //
  // The destination must be a canonical vehicle-location label; anything else
  // is refused here AND by the server (validateVehicleLocationWrite).
  const handleMapMove = async ({ entry, location, fromLabel }) => {
    if (!isCanonicalVehicleLocation(location)) return false;
    return handleSave({
      actionType: "location_update",
      id: entry.id,
      jobId: entry.jobId,
      jobNumber: entry.jobNumber,
      vehicleId: entry.vehicleId,
      reg: entry.reg,
      vehicleLocation: location,
      notes: `Moved from ${fromLabel || formatVehicleLocation(entry.vehicleLocation)} to ${location} on the site map`
    });
  };

  // The Map view of the Key/Parking page. It renders in the same content slot
  // as the card grid, inside app-layout-page-card > tracking-page, and reads
  // the same already-filtered entries — never its own fetch.
  const renderTrackerMap = () =>
  <TrackingSiteMap
    entries={liveFilteredEntries}
    allEntries={liveActiveEntries}
    getFlags={getTrackerLocationFlags}
    getVehicleLabel={getVehicleSummaryLabel}
    formatRelativeTime={formatRelativeTime}
    onOpenEntry={openTrackingEntry}
    onMoveVehicle={handleMapMove} />;

  const renderTrackerContent = () =>
  <>
      <DevLayoutSection
      sectionKey="tracking-active-jobs-summary"
      parentKey="tracking-page-body"
      sectionType="stat-card"
      className="app-summary-section"
      style={{ width: "100%" }}>

        <div className="app-summary-grid">
          {trackerSummaryItems.map(renderTrackingSummaryItem)}
        </div>
      </DevLayoutSection>

      {trackerView === "map" ? renderTrackerMap() : renderTrackerGrid()}
    </>;

  // The Grid view - the tracker card experience, behaviour unchanged.
  const renderTrackerGrid = () =>
  <>
      {entries.length === 0 &&
    <DevLayoutSection
      sectionKey="tracking-active-jobs-empty-state"
      parentKey="tracking-page-body"
      sectionType="empty-state"
      style={{
        padding: "12px",
        borderRadius: "var(--radius-sm)",
        textAlign: "center",
        color: "var(--text-1)"
      }}>

          No active job tracking data yet.
        </DevLayoutSection>
    }
      {activeEntries.length === 0 && entries.length > 0 &&
    <DevLayoutSection
      sectionKey="tracking-active-jobs-unmapped-state"
      parentKey="tracking-page-body"
      sectionType="empty-state"
      style={{
        padding: "12px",
        borderRadius: "var(--radius-sm)",
        textAlign: "center",
        color: "var(--text-1)"
      }}>

          Waiting for job-mapped tracking entries.
        </DevLayoutSection>
    }
      {activeEntries.length > 0 && filteredActiveEntries.length === 0 &&
    <DevLayoutSection
      sectionKey="tracking-active-jobs-filter-empty-state"
      parentKey="tracking-page-body"
      sectionType="empty-state"
      style={{
        padding: "12px",
        borderRadius: "var(--radius-sm)",
        textAlign: "center",
        color: "var(--text-1)"
      }}>

          No active jobs match your search or filters.
        </DevLayoutSection>
    }
      {filteredActiveEntries.length > 0 &&
    <DevLayoutSection
      sectionKey="tracking-active-jobs-list"
      parentKey="tracking-page-body"
      sectionType="list"
      style={{
        display: "grid",
        gridTemplateColumns: TRACKING_CARD_GRID_TEMPLATE,
        alignItems: "stretch",
        gap: "20px",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0
      }}>

          {renderedEntries.map((entry, index) =>
        <TrackerGridItem
          key={entry.jobId || entry.id || `${entry.jobNumber}-${entry.updatedAt}`}
          entry={entry}
          index={index}
          isHighlighted={Boolean(highlightedJobNumber && entry.jobNumber?.toLowerCase() === highlightedJobNumber.toLowerCase())}
          isMobileView={isMobileView}
          onOpenEntry={openGridEntry} />

      )}
      </DevLayoutSection>
    }
    </>;



  return (
    <TrackingDashboardUi
      view="section1"
      activeTab="tracker"
      Button={Button}
      CAR_LOCATIONS={CAR_LOCATIONS}
      closeEntryModal={closeEntryModal}
      closeSearchModal={closeSearchModal}
      DevLayoutSection={DevLayoutSection}
      DropdownField={DropdownField}
      entries={entries}
      entryModal={entryModal}
      error={error}
      handleLocationSelect={handleLocationSelect}
      handleSave={handleSave}
      isMobileView={isMobileView}
      KEY_LOCATIONS={KEY_LOCATIONS}
      loading={loading}
      LocationEntryModal={LocationEntryModal}
      LocationSearchModal={LocationSearchModal}
      openEntryModal={openEntryModal}
      renderActiveTabContent={renderTrackerContent}
      SearchBar={SearchBar}
      searchModal={searchModal}
      setSimplifiedModal={setSimplifiedModal}
      setSharedSearchValue={setTrackerSearchTerm}
      setTrackerLocationFilter={setTrackerLocationFilter}
      setTrackerQuickFilter={setTrackerQuickFilter}
      sharedSearchPlaceholder="Search active jobs"
      sharedSearchValue={trackerSearchTerm}
      simplifiedModal={simplifiedModal}
      SimplifiedTrackingModal={SimplifiedTrackingModal}
      StatusMessage={StatusMessage}
      trackerLocationFilter={trackerLocationFilter}
      trackerLocationFilters={TRACKER_LOCATION_FILTERS}
      trackerQuickFilter={trackerQuickFilter}
      trackerQuickFilters={TRACKER_QUICK_FILTERS}
      trackerView={trackerView}
      setTrackerView={setTrackerView}
      TrackingRouteSkeleton={TrackingRouteSkeleton}
    />
  );















































































































































































}

TrackingDashboard.getLayout = (page) => <Layout disableContentCardHover>{page}</Layout>;
