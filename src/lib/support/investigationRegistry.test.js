// file location: src/lib/support/investigationRegistry.test.js
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  registerInvestigationProvider,
  getInvestigationProviders,
  clearInvestigationProviders,
  collectInvestigationProviders,
} from "@/lib/support/investigationRegistry";

afterEach(() => clearInvestigationProviders());

describe("registerInvestigationProvider", () => {
  it("requires id + investigate()", () => {
    expect(() => registerInvestigationProvider({})).toThrow(/id/);
    expect(() => registerInvestigationProvider({ id: "x" })).toThrow(/investigate/);
  });

  it("registers, replaces by id, and unregisters", () => {
    registerInvestigationProvider({ id: "a", investigate: () => ({ v: 1 }) });
    registerInvestigationProvider({ id: "a", investigate: () => ({ v: 2 }) });
    expect(getInvestigationProviders()).toHaveLength(1);
    const off = registerInvestigationProvider({ id: "b", investigate: () => ({ w: 1 }) });
    off();
    expect(getInvestigationProviders().map((p) => p.id)).toEqual(["a"]);
  });
});

describe("collectInvestigationProviders", () => {
  it("merges fragments by id, drops empties, and passes context", () => {
    const spy = vi.fn(() => ({ tables: ["jobs"] }));
    registerInvestigationProvider({ id: "jobcard", investigate: spy });
    registerInvestigationProvider({ id: "empty", investigate: () => ({}) });
    const ctx = { snapshot: { a: 1 } };
    expect(collectInvestigationProviders(ctx)).toEqual({ jobcard: { tables: ["jobs"] } });
    expect(spy).toHaveBeenCalledWith(ctx);
  });

  it("never throws when a provider throws", () => {
    registerInvestigationProvider({ id: "boom", investigate: () => { throw new Error("no"); } });
    registerInvestigationProvider({ id: "ok", investigate: () => ({ ok: 1 }) });
    expect(collectInvestigationProviders()).toEqual({ ok: { ok: 1 } });
  });
});
