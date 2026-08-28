// file location: src/lib/auth/returnRoute.test.js
// Covers the two rules every restored route must obey: it has to be a safe
// in-app staff route, and the CURRENT user has to be allowed to land on it.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isRestorableRoute,
  rememberStaffRoute,
  readRememberedStaffRoute,
  clearRememberedStaffRoute,
  resolveReturnRoute,
  LAST_ROUTE_STORAGE_KEY,
} from "@/lib/auth/returnRoute";

const ADMIN_MANAGER = ["admin manager"];
const TECH = ["techs"];
const FALLBACK = "/newsfeed";

// Minimal localStorage stand-in — the vitest environment is "node".
function installStorage() {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  return store;
}

describe("returnRoute — isRestorableRoute", () => {
  it("accepts ordinary in-app staff routes, with query and dynamic segments", () => {
    expect(isRestorableRoute("/jobs")).toBe(true);
    expect(isRestorableRoute("/job-cards/12345")).toBe(true);
    expect(isRestorableRoute("/website-manager?tab=preview")).toBe(true);
    expect(isRestorableRoute("/tech/12345")).toBe(true);
  });

  it("rejects auth and non-working routes that would bounce straight back", () => {
    expect(isRestorableRoute("/")).toBe(false);
    expect(isRestorableRoute("/login")).toBe(false);
    expect(isRestorableRoute("/login?redirectedFrom=/jobs")).toBe(false);
    expect(isRestorableRoute("/loginPresentation")).toBe(false);
    expect(isRestorableRoute("/unauthorized")).toBe(false);
  });

  it("rejects anything that could leave the app", () => {
    // A crafted ?redirectedFrom= must not become an open redirect after login.
    expect(isRestorableRoute("//evil.example.com")).toBe(false);
    expect(isRestorableRoute("https://evil.example.com")).toBe(false);
    expect(isRestorableRoute("\\\\evil.example.com")).toBe(false);
    expect(isRestorableRoute("/\\evil.example.com")).toBe(false);
    expect(isRestorableRoute("/api/auth/signout")).toBe(false);
    expect(isRestorableRoute("")).toBe(false);
    expect(isRestorableRoute(null)).toBe(false);
    expect(isRestorableRoute(undefined)).toBe(false);
  });
});

describe("returnRoute — remembered route storage", () => {
  beforeEach(() => installStorage());
  afterEach(() => {
    delete globalThis.window;
  });

  it("round-trips a route for the user it was stored for", () => {
    rememberStaffRoute(7, "/jobs");
    expect(readRememberedStaffRoute(7)).toBe("/jobs");
    expect(readRememberedStaffRoute("7")).toBe("/jobs");
  });

  it("never returns one user's route to another user", () => {
    rememberStaffRoute(7, "/hr/manager");
    expect(readRememberedStaffRoute(9)).toBeNull();
  });

  it("refuses to store a non-restorable route", () => {
    rememberStaffRoute(7, "/login");
    expect(readRememberedStaffRoute(7)).toBeNull();
  });

  it("ignores a corrupt entry rather than throwing", () => {
    globalThis.window.localStorage.setItem(LAST_ROUTE_STORAGE_KEY, "{not json");
    expect(readRememberedStaffRoute(7)).toBeNull();
  });

  it("clears on request", () => {
    rememberStaffRoute(7, "/jobs");
    clearRememberedStaffRoute();
    expect(readRememberedStaffRoute(7)).toBeNull();
  });
});

describe("returnRoute — resolveReturnRoute precedence", () => {
  it("prefers the route the user actually asked for", () => {
    expect(
      resolveReturnRoute({
        redirectedFrom: "/jobs",
        remembered: "/hr/manager",
        roles: ADMIN_MANAGER,
        fallback: FALLBACK,
      })
    ).toBe("/jobs");
  });

  it("uses the remembered route only when there is no current route", () => {
    expect(
      resolveReturnRoute({
        redirectedFrom: null,
        remembered: "/hr/manager",
        roles: ADMIN_MANAGER,
        fallback: FALLBACK,
      })
    ).toBe("/hr/manager");
  });

  it("falls back when nothing is offered", () => {
    expect(resolveReturnRoute({ roles: ADMIN_MANAGER, fallback: FALLBACK })).toBe(FALLBACK);
  });

  it("never restores a route the current user cannot access", () => {
    // /hr/manager belongs to Admin Manager; a technician must not land there
    // just because it was carried in the URL or left behind in storage.
    expect(
      resolveReturnRoute({
        redirectedFrom: "/hr/manager",
        roles: TECH,
        fallback: FALLBACK,
      })
    ).toBe(FALLBACK);

    expect(
      resolveReturnRoute({
        remembered: "/hr/manager",
        roles: TECH,
        fallback: FALLBACK,
      })
    ).toBe(FALLBACK);
  });

  it("skips a forbidden current route but still honours a permitted remembered one", () => {
    expect(
      resolveReturnRoute({
        redirectedFrom: "/hr/manager",
        remembered: "/jobs",
        roles: ADMIN_MANAGER,
        fallback: FALLBACK,
      })
    ).toBe("/hr/manager");
  });

  it("authorises a detail URL through its list page", () => {
    // Job cards are reached by direct URL; the list page is what the manifest
    // grants, so the detail route has to inherit from it.
    const resolved = resolveReturnRoute({
      redirectedFrom: "/job-cards/12345",
      roles: ADMIN_MANAGER,
      fallback: FALLBACK,
    });
    expect(resolved).toBe("/job-cards/12345");
  });

  it("keeps the query string of the requested route", () => {
    expect(
      resolveReturnRoute({
        redirectedFrom: "/jobs?status=open",
        roles: ADMIN_MANAGER,
        fallback: FALLBACK,
      })
    ).toBe("/jobs?status=open");
  });

  it("refuses an off-site redirect even when it is the only candidate", () => {
    expect(
      resolveReturnRoute({
        redirectedFrom: "//evil.example.com",
        roles: ADMIN_MANAGER,
        fallback: FALLBACK,
      })
    ).toBe(FALLBACK);
  });
});
