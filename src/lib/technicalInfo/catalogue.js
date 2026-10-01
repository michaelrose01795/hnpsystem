// Request classification suggests topics only; it never supplies specifications.
export const TECHNICAL_CATEGORIES = [
  ["servicing", "Servicing", /\b(service|servicing|maintenance|inspection|filter)\b/i, ["service schedule", "service reset"]],
  ["engine", "Engine", /\b(engine|misfire|cylinder|turbo|compression|sump)\b/i, ["engine identification", "compression test procedure"]],
  ["fluids", "Fluids", /\b(oil|fluid|coolant|antifreeze|capacity|capacities|sump|filter)\b/i, ["oil capacity", "oil specification", "coolant specification"]],
  ["torques", "Tightening torques", /\b(torque|torques|tighten|tightening|bolt|bolts|sump|disc|discs|wheel|wheels)\b/i, ["sump plug torque", "wheel bolt torque"]],
  ["brakes", "Brakes", /\b(brake|brakes|braking|disc|discs|pad|pads|caliper|abs)\b/i, ["front disc minimum thickness", "brake fluid specification"]],
  ["suspension", "Suspension", /\b(suspension|spring|springs|shock|shocks|damper|bush|bushes|wishbone|steering|track rod)\b/i, ["suspension tightening torques", "wheel alignment procedure"]],
  ["timing", "Timing", /\b(timing|cambelt|camshaft|chain)\b/i, ["timing belt replacement interval", "timing procedure"]],
  ["electrical", "Electrical", /\b(electrical|wiring|fuse|relay|light|lights|alternator|starter)\b/i, ["wiring diagram", "fuse locations"]],
  ["battery", "Battery", /\b(battery|batteries|charging|start.stop)\b/i, ["battery replacement procedure", "battery registration procedure"]],
  ["diagnostics", "Diagnostics", /\b(diagnos\w*|fault|dtc|code|codes|warning|noise|misfire|non.start|not starting)\b/i, ["diagnostic trouble codes", "diagnostic test procedure"]],
  ["locations", "Component locations", /\b(location|locations|where|sensor|fuse|relay|ecu)\b/i, ["component locations", "diagnostic connector location"]],
  ["air-conditioning", "Air conditioning", /\b(air con|air conditioning|a\/c|ac|refrigerant|regas|compressor)\b/i, ["refrigerant type and charge", "air conditioning service procedure"]],
  ["wheels-tyres", "Wheels / tyres", /\b(wheel|wheels|tyre|tyres|tire|tires|tpms|puncture|alignment)\b/i, ["tyre pressures", "wheel bolt torque", "TPMS reset procedure"]],
  ["transmission", "Transmission", /\b(transmission|gearbox|clutch|gear|gears|dsg|automatic|differential)\b/i, ["transmission fluid specification", "transmission service procedure"]],
  ["repair-times", "Repair times", /\b(labour|labor|time|times|replace|replacement|repair)\b/i, ["repair times"]],
  ["bulletins", "Technical bulletins", /\b(bulletin|bulletins|tsb|known|recall|recurring)\b/i, ["technical bulletins"]],
].map(([id, label, pattern, questions]) => ({ id, label, pattern, questions }));

export function classifyRequest(text = "") {
  return TECHNICAL_CATEGORIES.filter(({ pattern }) => pattern.test(text)).map(({ id }) => id);
}

export function suggestedQuestions(text = "") {
  const categories = classifyRequest(text);
  return [...new Set(TECHNICAL_CATEGORIES.filter(({ id }) => categories.includes(id)).flatMap(({ questions }) => questions))];
}

export const cleanValue = (value) => {
  if (value === null || value === undefined || /^(unknown|not provided|n\/a|not available)$/i.test(String(value).trim())) return null;
  return typeof value === "string" ? value.trim() || null : value;
};

export const normaliseRegistration = (value) => String(value || "").replace(/\s/g, "").toUpperCase();
export const normaliseVin = (value) => String(cleanValue(value) || "").trim().toUpperCase();
export const validVin = (value) => /^[A-HJ-NPR-Z0-9]{17}$/.test(normaliseVin(value));

// VES fields from the official DVLA response schema, including false/zero values.
export const DVLA_FIELDS = {
  registrationNumber: "Registration", make: "Make", yearOfManufacture: "Year of manufacture",
  colour: "Colour", fuelType: "Fuel type", engineCapacity: "Engine capacity (cc)",
  co2Emissions: "CO₂ emissions (g/km)", taxStatus: "Tax status", taxDueDate: "Tax due date",
  motStatus: "MOT status", motExpiryDate: "MOT expiry", markedForExport: "Marked for export",
  wheelplan: "Wheel plan", typeApproval: "Type approval", revenueWeight: "Revenue weight (kg)",
  euroStatus: "Euro status", realDrivingEmissions: "Real driving emissions",
  monthOfFirstRegistration: "First registration", monthOfFirstDvlaRegistration: "First DVLA registration",
  dateOfLastV5CIssued: "Last V5C issued", artEndDate: "Additional rate of tax end date",
  automatedVehicle: "Automated vehicle",
};

export function pickDvlaFields(data) {
  return Object.fromEntries(Object.keys(DVLA_FIELDS).filter((key) => cleanValue(data?.[key]) !== null).map((key) => [key, data[key]]));
}
