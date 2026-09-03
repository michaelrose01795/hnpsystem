// Tests for the pure parts of the automatic error-capture client.
//
// The network side (postEvent) is deliberately not exercised here: the repo's
// Vitest runs in the node environment with no jsdom, so `typeof window ===
// "undefined"` and logErrorEvent() short-circuits — which is itself the first
// thing worth asserting, because server-side rendering must never try to POST.

import { describe, it, expect, beforeEach } from "vitest";
import {
  normaliseMessage,
  normaliseRoute,
  buildEventFingerprint,
  logErrorEvent,
  resetAutoErrorLog,
  ERROR_KINDS,
  ERROR_EVENTS_ENDPOINT,
} from "@/lib/support/autoErrorLog";

beforeEach(() => {
  resetAutoErrorLog();
});

describe("normaliseMessage", () => {
  it("collapses ids, uuids, hex and quoted values so repeats group together", () => {
    const a = normaliseMessage('Cannot read job 12345 for "Alice"');
    const b = normaliseMessage('Cannot read job 98761 for "Bob"');
    expect(a).toBe(b);
  });

  it("treats a uuid as one token rather than a run of numbers", () => {
    expect(normaliseMessage("missing 3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toContain("<uuid>");
  });

  it("keeps genuinely different failures apart", () => {
    expect(normaliseMessage("Cannot read property x")).not.toBe(
      normaliseMessage("Network request failed")
    );
  });

  it("is safe on empty / non-string input", () => {
    expect(normaliseMessage(undefined)).toBe("");
    expect(normaliseMessage(null)).toBe("");
  });
});

describe("normaliseRoute", () => {
  it("collapses numeric route segments", () => {
    expect(normaliseRoute("/job-cards/12345")).toBe("/job-cards/<id>");
  });

  it("collapses uuid route segments", () => {
    expect(normaliseRoute("/vhc/3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe("/vhc/<uuid>");
  });

  it("drops the query string and hash so one page is one route", () => {
    expect(normaliseRoute("/parts?tab=orders#top")).toBe("/parts");
  });
});

describe("buildEventFingerprint", () => {
  it("gives the same fingerprint to the same failure on different records", () => {
    const one = buildEventFingerprint({
      kind: ERROR_KINDS.RENDER,
      message: "Cannot read properties of undefined (reading 'id')",
      route: "/job-cards/111",
      component: "JobCardModal",
    });
    const two = buildEventFingerprint({
      kind: ERROR_KINDS.RENDER,
      message: "Cannot read properties of undefined (reading 'id')",
      route: "/job-cards/222",
      component: "JobCardModal",
    });
    expect(one).toBe(two);
  });

  it("separates the same message in different components", () => {
    const base = { kind: ERROR_KINDS.RENDER, message: "boom", route: "/parts" };
    expect(buildEventFingerprint({ ...base, component: "PartsTab" })).not.toBe(
      buildEventFingerprint({ ...base, component: "NotesTab" })
    );
  });

  it("separates different HTTP statuses on the same endpoint", () => {
    const base = { kind: ERROR_KINDS.API, message: "Request failed", route: "/jobs" };
    expect(buildEventFingerprint({ ...base, statusCode: 403 })).not.toBe(
      buildEventFingerprint({ ...base, statusCode: 500 })
    );
  });
});

describe("logErrorEvent", () => {
  it("is inert on the server (no window) rather than attempting a request", () => {
    expect(typeof window).toBe("undefined");
    expect(logErrorEvent({ kind: ERROR_KINDS.RUNTIME, message: "server-side" })).toBeNull();
  });

  it("never throws, whatever it is handed", () => {
    expect(() => logErrorEvent()).not.toThrow();
    expect(() => logErrorEvent({ error: null })).not.toThrow();
    // A self-referencing object would break a naive JSON.stringify.
    const circular = {};
    circular.self = circular;
    expect(() => logErrorEvent({ context: circular })).not.toThrow();
  });
});

describe("endpoint contract", () => {
  it("posts to the support error-events route", () => {
    expect(ERROR_EVENTS_ENDPOINT).toBe("/api/support/error-events");
  });
});
