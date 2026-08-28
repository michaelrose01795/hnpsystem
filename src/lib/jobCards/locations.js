// file location: src/lib/jobCards/locations.js
//
// Vehicle / key location option data and the empty tracking-form shape. Moved
// verbatim out of src/pages/job-cards/[jobNumber].js so the technician route
// can reuse LocationUpdateModal without importing that 13k-line page.

const CAR_LOCATIONS = [
{ id: "na", label: "N/A" },
{ id: "service", label: "Service" },
{ id: "sales-1", label: "Sales 1" },
{ id: "sales-2", label: "Sales 2" },
{ id: "sales-3", label: "Sales 3" },
{ id: "sales-4", label: "Sales 4" },
{ id: "sales-5", label: "Sales 5" },
{ id: "sales-6", label: "Sales 6" },
{ id: "sales-7", label: "Sales 7" },
{ id: "sales-8", label: "Sales 8" },
{ id: "sales-9", label: "Sales 9" },
{ id: "sales-10", label: "Sales 10" },
{ id: "staff", label: "Staff" },
{ id: "trade", label: "Trade" }];


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

const CAR_LOCATION_OPTIONS = CAR_LOCATIONS.map((location) => ({
  key: location.id,
  value: location.label,
  label: location.label
}));

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
