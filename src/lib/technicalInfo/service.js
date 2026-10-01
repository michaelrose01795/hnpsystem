// Server-only orchestration. Register reviewed/licensed adapters here, never in the browser.
import { lookupDvla, lookupVpic } from "@/lib/vehicles/lookup";
import { cleanValue, DVLA_FIELDS, normaliseRegistration, normaliseVin, validVin, classifyRequest, suggestedQuestions, TECHNICAL_CATEGORIES } from "@/lib/technicalInfo/catalogue";

// No workshop data licence is configured. Identification providers are NOT repair-data providers.
export const workshopProviders = Object.freeze([]);

const present = (value) => cleanValue(value) !== null;
const safeUrl = (value) => {
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; } catch { return null; }
};

export async function getTechnicalInformation(context, { requestId = "", requestText = "", query = "", category = "", browse = false } = {}, dependencies = {}) {
  const dvlaLookup = dependencies.dvlaLookup || lookupDvla;
  const vinLookup = dependencies.vinLookup || lookupVpic;
  const providers = dependencies.providers || workshopProviders;
  const { job, vehicle: stored, requests } = context;
  const selectedRequest = requestId ? requests.find((row) => row.id === requestId) : null;
  if (requestId && !selectedRequest) {
    const error = new Error("This request no longer belongs to the job. Reopen technical information.");
    error.status = 404;
    throw error;
  }
  const requestDescription = selectedRequest?.description || requestText;
  const categories = classifyRequest(query || requestDescription);
  const warnings = [];
  const reg = normaliseRegistration(job.vehicle_reg || stored.registration || stored.reg_number);
  const storedReg = normaliseRegistration(stored.registration || stored.reg_number);
  // A stale vehicle link must never introduce another vehicle's VIN or specifications.
  const record = storedReg && reg && storedReg !== reg ? {} : stored;
  if (record !== stored) warnings.push("The linked vehicle registration differs from the job. Confirm the vehicle link before using workshop data.");
  const vehicle = {
    registration: reg, vin: normaliseVin(cleanValue(record.vin) || cleanValue(record.chassis)),
    make: cleanValue(record.make), model: cleanValue(record.model),
    makeModel: cleanValue(record.make_model || job.vehicle_make_model),
    year: cleanValue(record.year), engineNumber: cleanValue(record.engine_number || record.engine),
    engineCapacity: cleanValue(record.engine_capacity), fuelType: cleanValue(record.fuel_type),
    transmission: cleanValue(record.transmission),
    colour: cleanValue(record.colour), motDue: cleanValue(record.mot_due),
  };
  const facts = [];
  const addFacts = (data, labels, source, retrievedAt, url) => {
    Object.entries(labels).forEach(([key, label]) => {
      if (present(data[key])) facts.push({ id: `${source}:${key}`, label, value: data[key], source, retrievedAt, url });
    });
  };
  addFacts(vehicle, { registration: "Registration", vin: "VIN", makeModel: "Recorded make / model", make: "Recorded make", model: "Recorded model", year: "Recorded year", engineNumber: "Recorded engine number", engineCapacity: "Recorded engine capacity (cc)", fuelType: "Recorded fuel type", transmission: "Recorded transmission", colour: "Recorded colour", motDue: "Recorded MOT expiry" }, "DMS vehicle record", null, null);
  const statuses = [];
  let identityConflict = record !== stored;
  if (reg) {
    try {
      const result = await dvlaLookup(reg);
      addFacts(result.data, DVLA_FIELDS, result.source, result.retrievedAt, "https://www.gov.uk/get-vehicle-information-from-dvla");
      if (vehicle.make && result.data.make && vehicle.make.toLowerCase() !== result.data.make.toLowerCase()) {
        identityConflict = true;
        warnings.push("DVLA and the DMS have different makes. Confirm the vehicle identity before using workshop data.");
      }
      // VES remains the primary registration source; it does not provide model or VIN.
      Object.assign(vehicle, {
        make: result.data.make ?? vehicle.make, year: result.data.yearOfManufacture ?? vehicle.year,
        fuelType: result.data.fuelType ?? vehicle.fuelType, engineCapacity: result.data.engineCapacity ?? vehicle.engineCapacity,
      });
      statuses.push({ id: "dvla", label: result.source, status: "available" });
    } catch {
      statuses.push({ id: "dvla", label: "DVLA Vehicle Enquiry Service", status: "unavailable" });
      warnings.push("DVLA is unavailable for this registration. Recorded vehicle details remain visible.");
    }
  }
  if (validVin(vehicle.vin)) {
    try {
      const result = await vinLookup(vehicle.vin);
      statuses.push({ id: "vpic", label: "NHTSA vPIC", status: result.status });
      addFacts(result.data, { Make: "VIN make", Model: "VIN model", ModelYear: "VIN model year", BodyClass: "VIN body class", FuelTypePrimary: "VIN fuel type", EngineModel: "VIN engine model", EngineCylinders: "VIN engine cylinders", DisplacementCC: "VIN displacement (cc)", TransmissionStyle: "VIN transmission", DriveType: "VIN drive type", PlantCountry: "VIN plant country" }, "NHTSA vPIC", result.retrievedAt, "https://vpic.nhtsa.dot.gov/");
      // Partial UK VIN results are labelled enrichment, never used to select workshop specifications.
      if (result.status === "partial" || result.status === "unavailable") warnings.push("VIN decoding is partial or unavailable for this vehicle; UK coverage varies.");
    } catch {
      statuses.push({ id: "vpic", label: "NHTSA vPIC", status: "unavailable" });
      warnings.push("VIN enrichment is unavailable. The job and DVLA details are still usable.");
    }
  }
  const items = [];
  await Promise.all(providers.map(async (provider) => {
    if (provider.approved !== true) return;
    const status = { id: provider.id, label: provider.label, status: "unavailable" };
    statuses.push(status);
    if (identityConflict) { status.status = "vehicle-confirmation-required"; return; }
    try {
      const signal = AbortSignal.timeout(10_000);
      // Each adapter must resolve the exact variant; a make/model guess is not a match.
      const work = async () => {
        const match = await provider.resolveVehicle({ vehicle, signal });
        if (match?.status !== "exact" || !match.vehicleKey ||
            normaliseRegistration(match.registration) !== vehicle.registration ||
            (validVin(vehicle.vin) && normaliseVin(match.vin) !== vehicle.vin)) {
          return { status: "vehicle-confirmation-required", items: [] };
        }
        const records = await provider.search({ vehicle, match, query, category, categories: browse ? [] : categories, request: requestDescription, signal });
        if (!Array.isArray(records)) throw new Error("Invalid provider response");
        const accepted = records.filter((item) =>
          item.vehicleKey === match.vehicleKey && item.id && typeof item.title === "string" && typeof item.content === "string" &&
          TECHNICAL_CATEGORIES.some(({ id }) => id === item.category) &&
          item.source?.documentId && Number.isFinite(Date.parse(item.source.retrievedAt))
        ).map((item) => ({
          id: `${provider.id}:${item.id}`, title: item.title, content: item.content, category: item.category,
          source: { provider: provider.label, documentId: item.source.documentId, retrievedAt: item.source.retrievedAt, url: safeUrl(item.source.url) },
        }));
        return { items: accepted, status: accepted.length ? "available" : "no-results" };
      };
      const result = await Promise.race([work(), new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("Provider timed out")), { once: true }))]);
      items.push(...result.items);
      status.status = result.status;
    } catch { status.status = "unavailable"; }
  }));
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const visibleItems = items.filter((item) => (!category || item.category === category) &&
    (!terms.length || terms.every((term) => `${item.title} ${item.content}`.toLowerCase().includes(term))))
    .sort((a, b) => Number(categories.includes(b.category)) - Number(categories.includes(a.category)));
  const visibleFacts = query ? facts.filter((fact) => terms.every((term) => `${fact.label} ${fact.value}`.toLowerCase().includes(term))) : facts;
  return {
    vehicle, requests, selectedRequest: selectedRequest || (requestDescription ? { description: requestDescription } : null),
    categories, suggestions: suggestedQuestions(requestDescription), items: visibleItems, facts: visibleFacts,
    providers: statuses, warnings, workshopConfigured: providers.some((provider) => provider.approved === true),
    emptyReason: visibleItems.length ? null : "No approved workshop source has supplied matching information for this vehicle. No specifications have been inferred.",
  };
}
