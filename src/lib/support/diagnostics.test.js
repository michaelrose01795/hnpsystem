// file location: src/lib/support/diagnostics.test.js
import { describe, expect, it } from "vitest";
import {
  createRingBuffer,
  createDiagnosticsStore,
  recordConsole,
  recordError,
  recordFailedRequest,
  recordAction,
  resolveCodeOwnership,
  captureDiagnostics,
  snapshotDevice,
  BUFFER_LIMITS,
} from "@/lib/support/diagnostics";
import { DEV_LAYOUT_SECTION_SOURCE_MAP } from "@/lib/dev-layout/sectionSourceMap.generated";

describe("createRingBuffer", () => {
  it("keeps only the most recent N items in order", () => {
    const buf = createRingBuffer(3);
    [1, 2, 3, 4, 5].forEach((n) => buf.push(n));
    expect(buf.toArray()).toEqual([3, 4, 5]);
    expect(buf.size).toBe(3);
  });

  it("clamps a bad limit to a sane default", () => {
    const buf = createRingBuffer(0);
    expect(buf.limit).toBeGreaterThan(0);
  });
});

describe("record helpers scrub at capture time", () => {
  it("scrubs secrets out of console messages", () => {
    const store = createDiagnosticsStore();
    recordConsole(store, {
      level: "error",
      args: ["request failed", "eyJh.eyJb.cccc", { url: "/api?token=leakme" }],
      ts: 1,
    });
    const [entry] = store.console.toArray();
    expect(entry.level).toBe("error");
    expect(entry.msg).not.toContain("eyJh.eyJb.cccc");
    expect(entry.msg).not.toContain("leakme");
  });

  it("captures error message + stack, scrubbed", () => {
    const store = createDiagnosticsStore();
    recordError(store, { message: "boom", stack: "at f (sk_live_abcdef12)", ts: 2 });
    const [entry] = store.errors.toArray();
    expect(entry.message).toBe("boom");
    expect(entry.stack).toContain("[REDACTED:KEY]");
  });

  it("reduces request URL to path+scrubbed-query, no body", () => {
    const store = createDiagnosticsStore();
    recordFailedRequest(store, {
      method: "post",
      url: "https://app.example.com/api/x?token=secret&tab=1",
      status: 500,
      ms: 12.7,
      ts: 3,
    });
    const [entry] = store.requests.toArray();
    expect(entry.method).toBe("POST");
    expect(entry.url.startsWith("/api/x")).toBe(true);
    expect(entry.url).not.toContain("secret");
    expect(entry.url).toContain("tab=1");
    expect(entry.status).toBe(500);
    expect(entry.ms).toBe(13);
    expect("body" in entry).toBe(false);
  });

  it("records route_change and click actions with scrubbed labels", () => {
    const store = createDiagnosticsStore();
    recordAction(store, { type: "route_change", from: "/a?token=x", to: "/b", ts: 4 });
    recordAction(store, { type: "click", label: "Edit david@x.com", sectionKey: "jobcard-tab", ts: 5 });
    const [routeChange, click] = store.actions.toArray();
    expect(routeChange.type).toBe("route_change");
    expect(routeChange.from).toContain("token=[REDACTED]");
    expect(click.type).toBe("click");
    expect(click.sectionKey).toBe("jobcard-tab");
    expect(click.label).toContain("d***@x.com");
  });
});

describe("resolveCodeOwnership", () => {
  it("returns file/line for a known exact section key from the generated map", () => {
    const exact = DEV_LAYOUT_SECTION_SOURCE_MAP.find(
      (e) => e && e.dynamic !== true && !String(e.key).includes("*") && e.file
    );
    expect(exact).toBeTruthy(); // the map should contain at least one static key
    const result = resolveCodeOwnership(exact.key);
    expect(result.section_key).toBe(exact.key);
    expect(result.file).toBe(exact.file);
  });

  it("returns just the key when nothing matches (no-hyphen key dodges the `*-*` catch-all)", () => {
    // The dev-layout map has a catch-all dynamic pattern `*-*` that matches any
    // hyphenated key, so use a single token with no hyphen to exercise the
    // genuine no-match path.
    const result = resolveCodeOwnership("totallyunknownkeyxyz");
    expect(result).toEqual({ section_key: "totallyunknownkeyxyz" });
  });

  it("returns null for empty input", () => {
    expect(resolveCodeOwnership("")).toBeNull();
  });
});

describe("captureDiagnostics", () => {
  it("assembles buffers + snapshots, applies session/flag allowlists, and scrubs", () => {
    const store = createDiagnosticsStore();
    recordConsole(store, { level: "error", args: ["err"], ts: 1 });
    recordFailedRequest(store, { method: "GET", url: "/api/x", status: 404, ms: 5, ts: 2 });

    const bundle = captureDiagnostics(store, {
      capturedAt: "2026-06-30T00:00:00.000Z",
      route: { asPath: "/job-cards/00076", pathname: "/job-cards/[jobNumber]" },
      session: {
        authStatus: "authenticated",
        roles: ["service manager"],
        dbUserId: 42,
        isDevLogin: false,
        // disallowed fields that must be dropped:
        accessToken: "eyJh.eyJb.cccc",
        email: "secret@x.com",
      },
      flags: {
        NEXT_PUBLIC_DEV_AUTH_BYPASS: false,
        presentationMode: true,
        SUPABASE_SERVICE_ROLE_KEY: "service_role_leak", // must be dropped
      },
      device: { ua: "test", viewport: { w: 1280, h: 800 } },
      build: { version: "0.1.0" },
    });

    // allowlist enforced
    expect(bundle.session).toEqual({
      authStatus: "authenticated",
      roles: ["service manager"],
      dbUserId: 42,
      isDevLogin: false,
    });
    expect(bundle.feature_flags).toEqual({
      NEXT_PUBLIC_DEV_AUTH_BYPASS: false,
      presentationMode: true,
    });

    // no leaked secrets anywhere in the serialised bundle
    const json = JSON.stringify(bundle);
    expect(json).not.toContain("eyJh.eyJb.cccc");
    expect(json).not.toContain("secret@x.com");
    expect(json).not.toContain("service_role_leak");

    // buffers present
    expect(bundle.console_errors).toHaveLength(1);
    expect(bundle.failed_requests).toHaveLength(1);
    expect(bundle.captured_at).toBe("2026-06-30T00:00:00.000Z");
  });

  it("tolerates an empty store / missing context", () => {
    const bundle = captureDiagnostics(createDiagnosticsStore(), {});
    expect(bundle.console_errors).toEqual([]);
    expect(bundle.recent_actions).toEqual([]);
    expect(bundle.session).toEqual({});
  });
});

describe("snapshotDevice", () => {
  it("returns {} when no window is available", () => {
    expect(snapshotDevice(undefined)).toEqual({});
  });

  it("reads from an injected window-like object", () => {
    const fakeWin = {
      navigator: { userAgent: "UA", platform: "P", language: "en-GB", onLine: true },
      innerWidth: 1024,
      innerHeight: 768,
      devicePixelRatio: 2,
      matchMedia: () => ({ matches: false }),
    };
    const d = snapshotDevice(fakeWin);
    expect(d.ua).toBe("UA");
    expect(d.lang).toBe("en-GB");
    expect(d.viewport).toEqual({ w: 1024, h: 768 });
    expect(d.dpr).toBe(2);
    expect(d.isMobile).toBe(false);
  });
});

describe("BUFFER_LIMITS", () => {
  it("are sane positive caps", () => {
    expect(BUFFER_LIMITS.console).toBeGreaterThan(0);
    expect(BUFFER_LIMITS.actions).toBeGreaterThanOrEqual(BUFFER_LIMITS.console);
  });
});
