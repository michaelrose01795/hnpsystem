// file location: src/lib/vehicles/vehicleFormState.js
// Shape of the Vehicle Details form used by the Create Job Card page and the
// Create Parts Order page. Extracted so both pages hold vehicle state in the
// same shape and the shared <VehicleDetailsCard> can render either one.

import { cleanValue, normaliseRegistration, normaliseVin, validVin, pickDvlaFields } from "@/lib/technicalInfo/catalogue";

// One display resolver for the existing form rows and both compact job summaries.
// Technical data may fill gaps only when it belongs to the same registration.
export function resolveVehicleDisplay(record = {}, technicalInfo = null) {
  const text = (...values) => values.map(cleanValue).find((value) => typeof value === "string" && value) || "";
  const registration = normaliseRegistration(text(record.reg, record.registration, record.reg_number, record.vehicle_reg));
  const technical = registration && normaliseRegistration(technicalInfo?.vehicle?.registration) === registration ? technicalInfo : null;
  const saved = technical?.vehicle || {};
  const make = text(saved.make, record.make);
  const model = text(saved.model, record.model);
  const combined = model.toLowerCase().startsWith(`${make.toLowerCase()} `) ? model : [make, model].filter(Boolean).join(" ");
  const candidates = [text(saved.makeModel), text(record.makeModel, record.make_model, record.vehicle_make_model), combined].filter(Boolean);
  let makeModel = candidates[0] || make;
  // A make-only snapshot must not hide the model, but retain a recorded trim level.
  for (const candidate of candidates) {
    if (!makeModel || candidate.toLowerCase().startsWith(`${makeModel.toLowerCase()} `)) makeModel = candidate;
  }
  const identifiers = [record.vin, record.chassis, saved.vin].map(cleanValue).filter(Boolean);
  const vin = normaliseVin(identifiers.find(validVin) || identifiers[0]);
  let modelSource = "DMS vehicle record";
  const vinProvider = technical?.providers?.find((provider) => provider.id === "vpic");
  // Partial VIN decoding is not reliable enough to relabel the vehicle summary.
  if (vinProvider?.status === "available" && validVin(vin) && normaliseVin(saved.vin) === vin && (!makeModel || makeModel.toLowerCase() === make.toLowerCase())) {
    const fact = (suffix) => technical.facts?.find((item) => item.id === `NHTSA vPIC:${suffix}`)?.value;
    const decodedMake = text(fact("Make"));
    const decodedModel = text(fact("Model"));
    if (decodedModel && decodedMake && (!make || decodedMake.toLowerCase() === make.toLowerCase())) {
      makeModel = [decodedMake, decodedModel].join(" ");
      modelSource = "NHTSA vPIC";
    }
  }
  const colour = text(saved.colour, record.colour);
  const engine = text(saved.engineNumber, record.engineNumber, record.engine_number, record.engine);
  const year = cleanValue(saved.year) || cleanValue(record.year);
  const fuel = text(saved.fuelType, record.fuelType, record.fuel_type);
  return {
    registration, makeModel, vin, modelSource, colour, engine,
    // One line: the compact summaries scroll it sideways rather than wrapping.
    summary: [
      makeModel || "Make / model not recorded", vin ? `VIN ${vin}` : "VIN not recorded",
      year ? String(year) : "", colour, fuel, engine ? `Engine ${engine}` : "",
    ].filter(Boolean).join(" · "),
  };
}

export const createInitialVehicleState = () => ({
  reg: "",
  colour: "",
  makeModel: "",
  make: "",
  year: null,
  chassis: "",
  engine: "",
  mileage: "",
  dvlaData: null,
  identityRegistration: "",
});

// Copy a Supabase vehicle row into the form shape above. Values already held in
// `previous` win when the stored row has nothing for that field, so a partially
// typed form is never blanked by a background lookup.
export const hydrateVehicleState = (storedVehicle, previous = createInitialVehicleState(), { registration = "" } = {}) => {
  if (!storedVehicle) return previous;

  const display = resolveVehicleDisplay(storedVehicle);

  return {
    ...previous,
    reg: registration || previous.reg,
    identityRegistration: normaliseRegistration(storedVehicle.registration || storedVehicle.reg_number || registration),
    makeModel: display.makeModel || previous.makeModel,
    make: storedVehicle.make || previous.make,
    year: storedVehicle.year != null ? Number(storedVehicle.year) : previous.year,
    colour: storedVehicle.colour || previous.colour,
    chassis: display.vin || previous.chassis,
    engine: display.engine || previous.engine,
    mileage:
      storedVehicle.mileage === null || storedVehicle.mileage === undefined
        ? previous.mileage
        : String(storedVehicle.mileage),
  };
};

// Normalise a DVLA lookup payload into the same form shape.
export const vehicleStateFromDvla = (data = {}, { registration = "", previousMileage = "", previous = {} } = {}) => {
  // The editable registration input may already contain a new registration while
  // the other fields still show the old vehicle. Compare the loaded identity.
  const previousIdentity = previous.identityRegistration || previous.dvlaData?.registrationNumber;
  const sameVehicle = Boolean(previousIdentity) && normaliseRegistration(previousIdentity) === normaliseRegistration(data.registrationNumber || registration);
  const retained = sameVehicle ? previous : {};
  const detectedMake = data.make || data.vehicleMake || "";
  const detectedModel = data.model || data.vehicleModel || "";
  const combinedMakeModel = `${detectedMake} ${detectedModel}`.trim();

  const firstRegYear = (() => {
    const rawFirstReg = data.monthOfFirstRegistration || data.dateOfFirstRegistration || "";
    const parsedFirstRegYear = Number(String(rawFirstReg).slice(0, 4));
    return Number.isFinite(parsedFirstRegYear) && parsedFirstRegYear > 1900 ? parsedFirstRegYear : null;
  })();

  return {
    reg: (data.registrationNumber || data.registration || registration || "").toString().toUpperCase(),
    makeModel: retained.makeModel || (combinedMakeModel.length > 0 ? combinedMakeModel : detectedMake || "Unknown"),
    make: detectedMake || "",
    year:
      (Number.isFinite(Number(data.yearOfManufacture)) ? Number(data.yearOfManufacture) : null) || firstRegYear,
    colour: data.colour || data.vehicleColour || data.bodyColour || "Not provided",
    // VES does not supply VIN, engine number or model. Never label capacity as a serial number.
    chassis: retained.chassis || "",
    engine: retained.engine || "",
    mileage: data.mileage || data.currentMileage || (data.motTests && data.motTests[0]?.odometerValue) || previousMileage || "",
    dvlaData: pickDvlaFields(data),
    identityRegistration: normaliseRegistration(data.registrationNumber || registration),
  };
};

// Only existing schema columns are persisted. Other VES fields remain available
// through the reusable lookup cache and the technical information panel.
export function dvlaVehicleColumns(data, registration) {
  if (!data || normaliseRegistration(data.registrationNumber) !== normaliseRegistration(registration)) return {};
  const fields = { yearOfManufacture: "year", engineCapacity: "engine_capacity", fuelType: "fuel_type", motExpiryDate: "mot_due", taxStatus: "tax_status", taxDueDate: "tax_due_date", co2Emissions: "co2_emissions", markedForExport: "marked_for_export", wheelplan: "wheelplan", monthOfFirstRegistration: "month_of_first_registration" };
  return Object.fromEntries(Object.entries(fields).filter(([source]) => data[source] !== undefined && data[source] !== null).map(([source, target]) => [target, data[source]]));
}
