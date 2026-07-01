// file location: src/lib/support/diagnosticRegistry.test.js
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  registerDiagnosticProvider,
  getDiagnosticProviders,
  clearDiagnosticProviders,
  collectProviderDiagnostics,
} from "@/lib/support/diagnosticRegistry";

afterEach(() => clearDiagnosticProviders());

describe("registerDiagnosticProvider", () => {
  it("rejects providers without an id or collect()", () => {
    expect(() => registerDiagnosticProvider({})).toThrow(/id/);
    expect(() => registerDiagnosticProvider({ id: "x" })).toThrow(/collect/);
  });

  it("registers and replaces by id", () => {
    registerDiagnosticProvider({ id: "a", collect: () => ({ v: 1 }) });
    registerDiagnosticProvider({ id: "a", collect: () => ({ v: 2 }) });
    expect(getDiagnosticProviders()).toHaveLength(1);
    expect(collectProviderDiagnostics()).toEqual({ a: { v: 2 } });
  });

  it("returns an unregister function", () => {
    const off = registerDiagnosticProvider({ id: "a", collect: () => ({ v: 1 }) });
    off();
    expect(getDiagnosticProviders()).toHaveLength(0);
  });
});

describe("collectProviderDiagnostics", () => {
  it("merges contributions under their id and drops empties", () => {
    registerDiagnosticProvider({ id: "a", collect: () => ({ x: 1 }) });
    registerDiagnosticProvider({ id: "empty", collect: () => ({}) });
    registerDiagnosticProvider({ id: "nullish", collect: () => null });
    expect(collectProviderDiagnostics()).toEqual({ a: { x: 1 } });
  });

  it("passes the capture context through to collect()", () => {
    const spy = vi.fn(() => ({ ok: true }));
    registerDiagnosticProvider({ id: "ctx", collect: spy });
    const ctx = { isDev: true, win: { a: 1 } };
    collectProviderDiagnostics(ctx);
    expect(spy).toHaveBeenCalledWith(ctx);
  });

  it("skips devOnly providers unless the context is dev", () => {
    registerDiagnosticProvider({ id: "dev", devOnly: true, collect: () => ({ secret: 1 }) });
    expect(collectProviderDiagnostics({ isDev: false })).toEqual({});
    expect(collectProviderDiagnostics({ isDev: true })).toEqual({ dev: { secret: 1 } });
  });

  it("never throws when a provider throws", () => {
    registerDiagnosticProvider({ id: "boom", collect: () => { throw new Error("nope"); } });
    registerDiagnosticProvider({ id: "good", collect: () => ({ ok: 1 }) });
    expect(collectProviderDiagnostics()).toEqual({ good: { ok: 1 } });
  });
});
