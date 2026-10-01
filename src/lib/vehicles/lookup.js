// Server-only provider calls. Cache is bounded and per warm server instance.
import { normaliseRegistration, normaliseVin, validVin, pickDvlaFields } from "@/lib/technicalInfo/catalogue";

export function createLookupCache({ max = 500, now = Date.now } = {}) {
  const entries = new Map();
  return async function cached(key, ttl, loader) {
    const existing = entries.get(key);
    if (existing && (existing.pending || existing.expires > now())) return existing.promise;
    entries.delete(key);
    if (entries.size >= max) entries.delete(entries.keys().next().value);
    const entry = { pending: true, expires: 0 };
    entry.promise = Promise.resolve().then(loader).then((value) => {
      entry.pending = false;
      entry.expires = now() + ttl;
      return value;
    }).catch((error) => {
      entry.pending = false;
      entry.expires = now() + 30_000; // short backoff; errors never become vehicle facts
      throw error;
    });
    entries.set(key, entry);
    return entry.promise;
  };
}

const cached = createLookupCache();
export class VehicleLookupError extends Error {
  constructor(message, status = 503) { super(message); this.status = status; }
}

export async function lookupDvla(registration) {
  const reg = normaliseRegistration(registration);
  if (!/^[A-Z0-9]{1,7}$/.test(reg)) throw new VehicleLookupError("Enter a valid UK registration.", 400);
  if (!process.env.DVLA_API_KEY) throw new VehicleLookupError("DVLA lookup is not configured.");
  return cached(`dvla:${reg}`, 6 * 60 * 60 * 1000, async () => {
    const response = await fetch("https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles", {
      method: "POST",
      headers: { "x-api-key": process.env.DVLA_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ registrationNumber: reg }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new VehicleLookupError(
      response.status === 404 ? "Vehicle not found by DVLA." : "DVLA lookup is temporarily unavailable.",
      [400, 404, 429].includes(response.status) ? response.status : 503,
    );
    const data = pickDvlaFields(await response.json());
    if (normaliseRegistration(data.registrationNumber) !== reg) throw new VehicleLookupError("DVLA returned a different registration.");
    return { data, retrievedAt: new Date().toISOString(), source: "DVLA Vehicle Enquiry Service" };
  });
}

export async function lookupVpic(vin) {
  if (process.env.VPIC_ENABLED !== "true") return { status: "disabled", data: {} };
  if (!validVin(vin)) return { status: "unavailable", data: {} };
  const normalised = normaliseVin(vin);
  return cached(`vpic:${normalised}`, 30 * 24 * 60 * 60 * 1000, async () => {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(normalised)}?format=json`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new VehicleLookupError("VIN enrichment is temporarily unavailable.");
    const row = (await response.json()).Results?.[0];
    if (!row) return { status: "unavailable", data: {} };
    if (row.VIN && normaliseVin(row.VIN) !== normalised) return { status: "unavailable", data: {} };
    const fields = ["Make", "Model", "ModelYear", "BodyClass", "FuelTypePrimary", "EngineModel", "EngineCylinders", "DisplacementCC", "TransmissionStyle", "DriveType", "PlantCountry"];
    const data = Object.fromEntries(fields.filter((key) => row[key] && !/^(not applicable|not available|unknown)$/i.test(row[key])).map((key) => [key, row[key]]));
    return {
      data, status: Object.keys(data).length === 0 ? "unavailable" : row.ErrorCode === "0" ? "available" : "partial",
      retrievedAt: new Date().toISOString(), source: "NHTSA vPIC", vin: normalised,
    };
  });
}
