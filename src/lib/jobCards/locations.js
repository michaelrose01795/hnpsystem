// file location: src/lib/jobCards/locations.js
//
// Vehicle / key location option data and the empty tracking-form shape. Moved
// verbatim out of src/pages/job-cards/[jobNumber].js so the technician route
// can reuse LocationUpdateModal without importing that 13k-line page.
//
// VEHICLE locations are no longer declared here. CAR_LOCATIONS and
// CAR_LOCATION_OPTIONS are derived from the canonical registry in
// src/lib/tracking/vehicleLocations.js, so the job card, the technician
// workspace, /tracking and the site map all offer exactly the same list.
//
// KEY locations still live here and are a separate domain: a key board called
// "Workshop" and a vehicle section called "Workshop" are different things that
// happen to share a word. Nothing below is derived from the vehicle registry.

import { VEHICLE_LOCATIONS, VEHICLE_LOCATION_OPTIONS } from "@/lib/tracking/vehicleLocations";

// `{ id, label }` — the shape every existing consumer reads.
const CAR_LOCATIONS = VEHICLE_LOCATIONS.map((section) => ({ id: section.id, label: section.label }));


const KEY_LOCATION_GROUPS = [
{
  title: "General",
  options: [{ id: "na", label: "N/A" }]
},
{
  title: "Key Locations",
  options: [
  { id: "service-showroom", label: "Service showroom" },
  { id: "sales-show-room", label: "Sales show room" },
  { id: "red-board", label: "Red board" },
  { id: "workshop", label: "Workshop" },
  { id: "valet", label: "Valet" },
  { id: "paint", label: "Paint" },
  { id: "sales", label: "Sales" },
  { id: "prep", label: "Prep" }]

}];


const KEY_LOCATIONS = KEY_LOCATION_GROUPS.flatMap((group) =>
group.options.map((option) => ({
  id: option.id,
  label: option.label,
  group: group.title
}))
);

const CAR_LOCATION_OPTIONS = VEHICLE_LOCATION_OPTIONS;

const KEY_LOCATION_OPTIONS = KEY_LOCATIONS.map((location) => ({
  key: location.id,
  value: location.label,
  label: location.label,
  description: location.group
}));

const normalizeKeyLocationLabel = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.
  replace(/^Keys (received|hung|updated)\s*[-–]\s*/i, "").
  replace(/^Key location\s*[-:–]\s*/i, "").
  replace(/^Key locations?\s*[-:–]\s*/i, "");
};

const ensureDropdownOption = (options = [], value = "") => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return options;
  const match = options.some((option) => {
    const optionValue = option?.value ?? option?.label ?? option;
    return String(optionValue || "").trim().toLowerCase() === normalizedValue.toLowerCase();
  });
  if (match) return options;
  return [
  { key: `current-${normalizedValue}`, value: normalizedValue, label: normalizedValue },
  ...options];

};

const emptyTrackingForm = {
  id: null,
  jobNumber: "",
  reg: "",
  customer: "",
  serviceType: "",
  vehicleLocation: "N/A",
  keyLocation: "N/A",
  keyTip: "",
  status: "Waiting For Collection",
  notes: ""
};

export {
  CAR_LOCATIONS,
  KEY_LOCATION_GROUPS,
  KEY_LOCATIONS,
  CAR_LOCATION_OPTIONS,
  KEY_LOCATION_OPTIONS,
  normalizeKeyLocationLabel,
  ensureDropdownOption,
  emptyTrackingForm,
};
