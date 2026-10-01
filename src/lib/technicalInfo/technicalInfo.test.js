import { describe, expect, it, vi } from "vitest";
import { classifyRequest, pickDvlaFields } from "@/lib/technicalInfo/catalogue";
import { getTechnicalInformation } from "@/lib/technicalInfo/service";
import { createLookupCache, lookupVpic, lookupDvla } from "@/lib/vehicles/lookup";
import { vehicleStateFromDvla, dvlaVehicleColumns } from "@/lib/vehicles/vehicleFormState";

const context = {
  job: { job_number: "00042", vehicle_reg: "AB12 CDE" },
  vehicle: { reg_number: "AB12CDE", make: "FORD", model: "Focus", vin: "WF0AXXWPMAPS12345" },
  requests: [{ id: "5", description: "Replace front brake discs" }],
};
const deps = () => ({
  dvlaLookup: vi.fn().mockResolvedValue({ data: { registrationNumber: "AB12CDE", make: "FORD", engineCapacity: 1596, markedForExport: false }, source: "DVLA", retrievedAt: "2026-10-01T12:00:00Z" }),
  vinLookup: vi.fn().mockResolvedValue({ status: "partial", data: { Make: "FORD" }, retrievedAt: "2026-10-01T12:00:00Z" }),
});
const provider = (overrides = {}) => ({
  id: "approved-test", label: "Approved test source", approved: true,
  resolveVehicle: async () => ({ status: "exact", vehicleKey: "variant-1", registration: "AB12CDE", vin: context.vehicle.vin }),
  search: async () => [{ id: "procedure", title: "Brake inspection", content: "Consult the identified manufacturer's procedure.", category: "brakes", vehicleKey: "variant-1", source: { documentId: "manual-1", retrievedAt: "2026-10-01T12:00:00Z", url: "https://example.com/manual" } }],
  ...overrides,
});

describe("request-scoped technical information", () => {
  it.each([
    ["sump plug torque", ["engine", "fluids", "torques"]],
    ["oil capacity", ["fluids"]],
    ["front disc minimum thickness", ["brakes"]],
    ["timing belt replacement", ["timing", "repair-times"]],
    ["air conditioning regas", ["air-conditioning"]],
  ])("categorises %s without producing specifications", (text, expected) => {
    expect(classifyRequest(text)).toEqual(expect.arrayContaining(expected));
  });
  it("returns an explicit absence of specifications and preserves source labels", async () => {
    const result = await getTechnicalInformation(context, { requestId: "5" }, deps());
    expect(result.items).toEqual([]);
    expect(result.emptyReason).toContain("No specifications have been inferred");
    expect(result.suggestions).toContain("front disc minimum thickness");
    expect(result.facts.find((fact) => fact.label === "Marked for export").value).toBe(false);
    expect(result.warnings.join(" ")).toContain("partial");
  });
  it("rejects requests belonging to another job before calling vehicle providers", async () => {
    const dependencies = deps();
    await expect(getTechnicalInformation(context, { requestId: "999" }, dependencies)).rejects.toMatchObject({ status: 404 });
    expect(dependencies.dvlaLookup).not.toHaveBeenCalled();
  });
  it("does not decode a missing VIN and survives DVLA failure", async () => {
    const dependencies = deps(); dependencies.dvlaLookup.mockRejectedValue(new Error("offline"));
    const result = await getTechnicalInformation({ ...context, vehicle: { reg_number: "AB12CDE" } }, {}, dependencies);
    expect(dependencies.vinLookup).not.toHaveBeenCalled();
    expect(result.vehicle.registration).toBe("AB12CDE");
    expect(result.items).toEqual([]);
  });
  it("does not use the VIN of a mismatched linked vehicle", async () => {
    const dependencies = deps();
    const result = await getTechnicalInformation({ ...context, vehicle: { ...context.vehicle, reg_number: "XY99ZZZ" } }, {}, dependencies);
    expect(dependencies.vinLookup).not.toHaveBeenCalled();
    expect(result.vehicle.vin).toBe("");
  });
  it("accepts only sourced records for the resolved variant", async () => {
    const result = await getTechnicalInformation(context, {}, { ...deps(), providers: [provider()] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].source.documentId).toBe("manual-1");
    const invalid = await getTechnicalInformation(context, {}, { ...deps(), providers: [provider({ search: async () => [
      { id: "bad", title: "Guess", content: "Invented", category: "torques", vehicleKey: "other" },
    ] })] });
    expect(invalid.items).toEqual([]);
  });
  it("refuses ambiguous, mismatched and unapproved providers", async () => {
    for (const adapter of [provider({ approved: false }), provider({ resolveVehicle: async () => ({ status: "ambiguous" }) }), provider({ resolveVehicle: async () => ({ status: "exact", vehicleKey: "wrong", registration: "OTHER" }) })]) {
      expect((await getTechnicalInformation(context, {}, { ...deps(), providers: [adapter] })).items).toEqual([]);
    }
  });
  it("isolates a failing provider while another returns sourced information", async () => {
    const result = await getTechnicalInformation(context, {}, { ...deps(), providers: [provider({ id: "failed", search: async () => { throw Error("offline"); } }), provider()] });
    expect(result.items).toHaveLength(1);
    expect(result.providers.find((item) => item.id === "failed").status).toBe("unavailable");
  });
});

describe("vehicle lookup reuse and field correctness", () => {
  it("coalesces concurrent requests and expires cached values", async () => {
    let now = 0; const cache = createLookupCache({ max: 2, now: () => now });
    const loader = vi.fn().mockResolvedValue({ make: "FORD" });
    await Promise.all([cache("reg", 100, loader), cache("reg", 100, loader)]);
    expect(loader).toHaveBeenCalledTimes(1);
    now = 101; await cache("reg", 100, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it("backs off failures, then retries", async () => {
    let now = 0; const cache = createLookupCache({ now: () => now });
    const loader = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(cache("reg", 100, loader)).rejects.toThrow("offline");
    await expect(cache("reg", 100, loader)).rejects.toThrow("offline");
    expect(loader).toHaveBeenCalledTimes(1);
    now = 30_001; await expect(cache("reg", 100, loader)).rejects.toThrow();
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it("retains useful DVLA fields including false/zero without inventing an engine number", () => {
    const data = { registrationNumber: "AB12CDE", make: "FORD", engineCapacity: 1596, co2Emissions: 0, markedForExport: false, automatedVehicle: false, dateOfLastV5CIssued: "2025-01-01" };
    const state = vehicleStateFromDvla(data);
    expect(state.engine).toBe(""); expect(state.chassis).toBe("");
    expect(state.dvlaData.automatedVehicle).toBe(false);
    expect(pickDvlaFields(data).co2Emissions).toBe(0);
    expect(dvlaVehicleColumns(data, "AB12 CDE")).toMatchObject({ engine_capacity: 1596, marked_for_export: false });
    expect(dvlaVehicleColumns(data, "OTHER")).toEqual({});
  });
  it("does not carry another vehicle's VIN across a registration lookup", () => {
    const state = vehicleStateFromDvla({ registrationNumber: "XY99ZZZ" }, { previous: { reg: "AB12CDE", chassis: context.vehicle.vin, engine: "serial" } });
    expect(state.chassis).toBe(""); expect(state.engine).toBe("");
  });
  it("retains the recorded model and VIN when DVLA cannot supply them", () => {
    const state = vehicleStateFromDvla({ registrationNumber: "AB12CDE", make: "FORD" }, { previous: { reg: "AB12 CDE", identityRegistration: "AB12CDE", makeModel: "FORD Focus", chassis: context.vehicle.vin, engine: "serial" } });
    expect(state.makeModel).toBe("FORD Focus");
    expect(state.chassis).toBe(context.vehicle.vin);
    expect(state.engine).toBe("serial");
  });
  it("does not retain stale identity when the registration input has changed", () => {
    const state = vehicleStateFromDvla({ registrationNumber: "XY99ZZZ", make: "OTHER" }, { previous: { reg: "XY99ZZZ", identityRegistration: "AB12CDE", chassis: context.vehicle.vin, engine: "serial", makeModel: "FORD Focus" } });
    expect(state.chassis).toBe(""); expect(state.engine).toBe(""); expect(state.makeModel).toBe("OTHER");
  });
  it("normalises and coalesces DVLA HTTP calls, retaining the complete documented field set", async () => {
    vi.stubEnv("DVLA_API_KEY", "unit-test-key");
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ registrationNumber: "ZZ11ZZZ", make: "FORD", automatedVehicle: false, revenueWeight: 2000 }) });
    vi.stubGlobal("fetch", fetcher);
    try {
      const [first, second] = await Promise.all([lookupDvla("zz11 zzz"), lookupDvla("ZZ11ZZZ")]);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(first).toEqual(second);
      expect(first.data).toMatchObject({ automatedVehicle: false, revenueWeight: 2000 });
      expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ registrationNumber: "ZZ11ZZZ" });
    } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
  });
  it("returns partial UK VIN data without treating it as an exact workshop match", async () => {
    vi.stubEnv("VPIC_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ Results: [{ VIN: context.vehicle.vin, ErrorCode: "7", Make: "FORD", Model: "", EngineModel: "" }] }) }));
    try {
      const result = await lookupVpic(context.vehicle.vin);
      expect(result.status).toBe("partial");
      expect(result.data).toEqual({ Make: "FORD" });
    } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
  });
  it("bounds reusable lookup entries", async () => {
    const cache = createLookupCache({ max: 2 });
    const loader = vi.fn().mockResolvedValue("data");
    await cache("one", 10000, loader); await cache("two", 10000, loader); await cache("three", 10000, loader);
    await cache("one", 10000, loader);
    expect(loader).toHaveBeenCalledTimes(4);
  });
  it("skips vPIC when disabled or VIN is invalid", async () => {
    vi.stubEnv("VPIC_ENABLED", "false");
    expect((await lookupVpic(context.vehicle.vin)).status).toBe("disabled");
    vi.stubEnv("VPIC_ENABLED", "true");
    expect((await lookupVpic("Not provided")).status).toBe("unavailable");
    vi.unstubAllEnvs();
  });
});
