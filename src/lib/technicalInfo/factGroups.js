// Presentation model for the vehicle facts returned by the technical information service.
// Pure and browser-safe: it only regroups, de-duplicates and formats what the service sent —
// it never supplies or infers a value.

export const FACT_GROUPS = [
  { id: "vehicle", label: "Vehicle", primary: true },
  { id: "engine", label: "Engine and drivetrain", primary: true },
  { id: "registration", label: "Registration, MOT and tax", primary: false },
  { id: "additional", label: "Additional details", primary: false },
];

// Fact key -> [group, shared label]. Keys that describe the same thing from different
// sources (DMS record, DVLA, VIN decode) share one label so matching values collapse.
const FACT_FIELDS = {
  registration: ["vehicle", "Registration"],
  registrationNumber: ["vehicle", "Registration"],
  vin: ["vehicle", "VIN"],
  makeModel: ["vehicle", "Make / model"],
  make: ["vehicle", "Make"],
  Make: ["vehicle", "Make"],
  model: ["vehicle", "Model"],
  Model: ["vehicle", "Model"],
  year: ["vehicle", "Year of manufacture"],
  yearOfManufacture: ["vehicle", "Year of manufacture"],
  ModelYear: ["vehicle", "Model year"],
  BodyClass: ["vehicle", "Body class"],
  colour: ["vehicle", "Colour"],
  wheelplan: ["vehicle", "Wheel plan"],

  engineNumber: ["engine", "Engine number"],
  EngineModel: ["engine", "Engine model"],
  engineCapacity: ["engine", "Engine capacity (cc)"],
  DisplacementCC: ["engine", "Engine capacity (cc)"],
  EngineCylinders: ["engine", "Cylinders"],
  fuelType: ["engine", "Fuel type"],
  FuelTypePrimary: ["engine", "Fuel type"],
  transmission: ["engine", "Transmission"],
  TransmissionStyle: ["engine", "Transmission"],
  DriveType: ["engine", "Drive type"],
  euroStatus: ["engine", "Euro status"],
  co2Emissions: ["engine", "CO₂ emissions (g/km)"],
  realDrivingEmissions: ["engine", "Real driving emissions"],

  motStatus: ["registration", "MOT status"],
  motDue: ["registration", "MOT expiry"],
  motExpiryDate: ["registration", "MOT expiry"],
  taxStatus: ["registration", "Tax status"],
  taxDueDate: ["registration", "Tax due date"],
  monthOfFirstRegistration: ["registration", "First registration"],
  monthOfFirstDvlaRegistration: ["registration", "First DVLA registration"],
  dateOfLastV5CIssued: ["registration", "Last V5C issued"],
  artEndDate: ["registration", "Additional rate of tax end date"],
};
const FIELD_ORDER = Object.keys(FACT_FIELDS);

const DATE = /^\d{4}-\d{2}-\d{2}/;
const MONTH = /^\d{4}-\d{2}$/;

// Values are compared loosely so "FORD" / "Ford" or a date with and without a time collapse.
const comparable = (value) => {
  const text = String(value).trim();
  return (DATE.test(text) ? text.slice(0, 10) : text).toLowerCase().replace(/\s+/g, "");
};

export function formatFactValue(value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value).trim();
  if (DATE.test(text)) {
    const date = new Date(`${text.slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  if (MONTH.test(text)) {
    const date = new Date(`${text}-01T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return text;
}

export function formatRetrievedAt(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Returns the facts as ordered groups of fields plus one entry per source.
// A value reported identically by several sources becomes one field listing those sources;
// sources that DISAGREE are kept as separate fields and flagged, never silently merged.
export function groupVehicleFacts(facts = []) {
  const sources = [];
  const fields = new Map();
  facts.forEach((fact) => {
    if (!sources.some((source) => source.name === fact.source)) {
      sources.push({ name: fact.source, retrievedAt: fact.retrievedAt || null, url: fact.url || null });
    }
    const key = String(fact.id).slice(String(fact.id).lastIndexOf(":") + 1);
    const [group, label] = FACT_FIELDS[key] || ["additional", fact.label];
    const order = FIELD_ORDER.includes(key) ? FIELD_ORDER.indexOf(key) : FIELD_ORDER.length;
    const id = `${group}:${label}:${comparable(fact.value)}`;
    const existing = fields.get(id);
    if (existing) {
      if (!existing.sources.includes(fact.source)) existing.sources.push(fact.source);
      existing.order = Math.min(existing.order, order);
    } else {
      fields.set(id, { id, group, label, value: formatFactValue(fact.value), sources: [fact.source], order, conflict: false });
    }
  });
  const all = [...fields.values()];
  all.forEach((field) => {
    field.conflict = all.some((other) => other !== field && other.group === field.group && other.label === field.label);
  });
  const groups = FACT_GROUPS
    .map((group) => ({ ...group, fields: all.filter((field) => field.group === group.id).sort((a, b) => a.order - b.order) }))
    .filter((group) => group.fields.length);
  return { groups, sources };
}
