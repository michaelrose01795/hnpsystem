import { describe, expect, it } from "vitest";
import {
  buildHrManagerTabHref,
  normalizeHrManagerTab,
  redirectToHrManagerTab,
} from "./hrManagerRoutes";

describe("HR Manager canonical routes", () => {
  it("builds one Manager route for every HR tab", () => {
    expect(buildHrManagerTabHref("dashboard")).toBe("/hr/manager");
    expect(buildHrManagerTabHref("employees")).toBe("/hr/manager?tab=employees");
    expect(buildHrManagerTabHref("leave")).toBe("/hr/manager?tab=leave");
  });

  it("falls back safely when an unknown tab is requested", () => {
    expect(normalizeHrManagerTab("not-a-tab")).toBe("dashboard");
    expect(redirectToHrManagerTab("not-a-tab")).toEqual({
      redirect: { destination: "/hr/manager", permanent: false },
    });
  });
});
