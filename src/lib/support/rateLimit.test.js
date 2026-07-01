// file location: src/lib/support/rateLimit.test.js
// Phase 7 — unit tests for the support submit rate limiter. Deterministic: the
// clock is injected, so no timers are needed.

import { describe, it, expect } from "vitest";
import {
  SUPPORT_RATE_LIMIT,
  createRateStore,
  rateLimitKey,
  checkRateLimit,
  pruneRateStore,
} from "./rateLimit";

const run = (store, key, now, limit) => checkRateLimit({ key, store, now, limit });

describe("rateLimitKey", () => {
  it("prefers the user id over the ip", () => {
    expect(rateLimitKey({ userId: 42, ip: "1.2.3.4" })).toBe("user:42");
  });
  it("falls back to ip, then anon", () => {
    expect(rateLimitKey({ ip: "1.2.3.4" })).toBe("ip:1.2.3.4");
    expect(rateLimitKey({})).toBe("anon");
  });
});

describe("checkRateLimit", () => {
  it("allows up to `max` hits in the window then rejects", () => {
    const store = createRateStore();
    const t0 = 1_000_000;
    for (let i = 0; i < SUPPORT_RATE_LIMIT.max; i += 1) {
      const r = run(store, "user:1", t0 + i);
      expect(r.allowed).toBe(true);
    }
    const over = run(store, "user:1", t0 + SUPPORT_RATE_LIMIT.max);
    expect(over.allowed).toBe(false);
    expect(over.retryAfterMs).toBeGreaterThan(0);
    expect(over.remaining).toBe(0);
  });

  it("frees a slot once the oldest hit leaves the window", () => {
    const store = createRateStore();
    const limit = { windowMs: 1000, max: 2, abuseThreshold: 100 };
    expect(run(store, "k", 0, limit).allowed).toBe(true);
    expect(run(store, "k", 100, limit).allowed).toBe(true);
    expect(run(store, "k", 200, limit).allowed).toBe(false); // window full
    // After the first hit (t=0) ages out (>1000ms later), a slot reopens.
    expect(run(store, "k", 1101, limit).allowed).toBe(true);
  });

  it("keys are independent", () => {
    const store = createRateStore();
    const limit = { windowMs: 1000, max: 1, abuseThreshold: 100 };
    expect(run(store, "user:1", 0, limit).allowed).toBe(true);
    expect(run(store, "user:2", 0, limit).allowed).toBe(true);
    expect(run(store, "user:1", 1, limit).allowed).toBe(false);
  });

  it("flags abuse once hits exceed the abuse threshold within the window", () => {
    const store = createRateStore();
    const limit = { windowMs: 10_000, max: 2, abuseThreshold: 4 };
    let last;
    for (let i = 0; i < 6; i += 1) last = run(store, "bad", i, limit);
    expect(last.abuse).toBe(true);
    expect(last.allowed).toBe(false); // still rejected while abusing
  });

  it("rejected attempts still count towards abuse detection", () => {
    const store = createRateStore();
    const limit = { windowMs: 10_000, max: 1, abuseThreshold: 3 };
    run(store, "x", 0, limit); // allowed
    run(store, "x", 1, limit); // rejected
    run(store, "x", 2, limit); // rejected
    const r = run(store, "x", 3, limit); // rejected, count=4 > 3
    expect(r.abuse).toBe(true);
  });

  it("requires a store", () => {
    expect(() => checkRateLimit({ key: "k" })).toThrow();
  });
});

describe("pruneRateStore", () => {
  it("evicts keys whose newest hit is older than retainMs", () => {
    const store = createRateStore();
    const limit = { retainMs: 1000 };
    run(store, "stale", 0);
    run(store, "fresh", 5000);
    const evicted = pruneRateStore(store, 5000 + 1, limit);
    expect(evicted).toBe(1);
    expect(store.hits.has("stale")).toBe(false);
    expect(store.hits.has("fresh")).toBe(true);
  });
});
