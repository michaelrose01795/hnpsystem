// file location: src/lib/vehicles/vehicleFormState.js
// Shape of the Vehicle Details form used by the Create Job Card page and the
// Create Parts Order page. Extracted so both pages hold vehicle state in the
// same shape and the shared <VehicleDetailsCard> can render either one.

export const createInitialVehicleState = () => ({
  reg: "",
  colour: "",
  makeModel: "",
  make: "",
  year: null,
  chassis: "",
  engine: "",
  mileage: "",
});

// Copy a Supabase vehicle row into the form shape above. Values already held in
// `previous` win when the stored row has nothing for that field, so a partially
// typed form is never blanked by a background lookup.
export const hydrateVehicleState = (storedVehicle, previous = createInitialVehicleState(), { registration = "" } = {}) => {
  if (!storedVehicle) return previous;

  const combinedMakeModel = (
    storedVehicle.make_model || `${storedVehicle.make || ""} ${storedVehicle.model || ""}`
  ).trim();

  return {
    ...previous,
    reg: registration || previous.reg,
    makeModel: combinedMakeModel || previous.makeModel,
    make: storedVehicle.make || previous.make,
    year: storedVehicle.year != null ? Number(storedVehicle.year) : previous.year,
    colour: storedVehicle.colour || previous.colour,
    chassis: storedVehicle.chassis || storedVehicle.vin || previous.chassis,
    engine: storedVehicle.engine || storedVehicle.engine_number || previous.engine,
    mileage:
      storedVehicle.mileage === null || storedVehicle.mileage === undefined
        ? previous.mileage
        : String(storedVehicle.mileage),
  };
};

// Normalise a DVLA lookup payload into the same form shape.
export const vehicleStateFromDvla = (data = {}, { registration = "", previousMileage = "" } = {}) => {
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
    makeModel: combinedMakeModel.length > 0 ? combinedMakeModel : detectedMake || "Unknown",
    make: detectedMake || "",
    year:
      (Number.isFinite(Number(data.yearOfManufacture)) ? Number(data.yearOfManufacture) : null) || firstRegYear,
    colour: data.colour || data.vehicleColour || data.bodyColour || "Not provided",
    chassis: data.vin || data.chassisNumber || data.vehicleIdentificationNumber || "Not provided",
    engine: data.engineNumber || data.engineCapacity || data.engine || "Not provided",
    mileage: data.mileage || data.currentMileage || (data.motTests && data.motTests[0]?.odometerValue) || previousMileage || "",
  };
};
