// file location: src/config/topbar/topbarWorkspace.test.js
//
// Phase 2 — coverage for the reusable top-bar workspace modules: KPIs (2.2),
// insights (2.6), notifications (2.7), the rotating view assembler (2.1/2.2/2.6),
// quick actions (2.4) and the continue-context classifier (2.3).

import { describe, it, expect } from "vitest";
import { resolveKpis, formatKpiLine } from "@/config/topbar/departmentKpis";
import { resolveInsights } from "@/config/topbar/departmentInsights";
import { resolveNotifications } from "@/config/topbar/departmentNotifications";
import { buildStatusViews, buildTopbarSections } from "@/config/topbar/statusViews";
import { resolveQuickActions, SERVICE_QUICK_ACTIONS } from "@/config/topbar/quickActions";
import { resolveResumable, isSamePath } from "@/lib/topbar/continueContext";

const WORKSHOP = { jobsWaiting: 4, jobsInProgress: 7, techniciansAvailable: 2, overdueJobs: 3 };

describe("departmentKpis", () => {
  it("resolves only KPIs with a numeric value, in order", () => {
    const kpis = resolveKpis("workshop", { jobsWaiting: 4, jobsInProgress: 7 });
    expect(kpis.map((k) => k.key)).toEqual(["jobsWaiting", "jobsInProgress"]);
  });

  it("drops missing metrics", () => {
    const kpis = resolveKpis("workshop", { jobsWaiting: 4 });
    expect(kpis).toHaveLength(1);
  });

  it("formats a capped compact line", () => {
    expect(formatKpiLine(resolveKpis("workshop", WORKSHOP), 3)).toBe(
      "4 waiting · 7 in progress · 2 techs free"
    );
  });

  it("returns nothing for an unknown department", () => {
    expect(resolveKpis("nope", WORKSHOP)).toEqual([]);
  });
});

describe("departmentInsights", () => {
  it("renders applicable insights in priority order", () => {
    const insights = resolveInsights("workshop", WORKSHOP);
    expect(insights[0]).toBe("3 jobs overdue — needs chasing");
    expect(insights).toContain("4 jobs waiting to start");
  });

  it("skips insights whose metric is absent/zero", () => {
    expect(resolveInsights("workshop", { jobsInProgress: 5 })).toEqual([]);
  });
});

describe("departmentNotifications", () => {
  it("prioritises high items first and tags priority", () => {
    const items = resolveNotifications("workshop", WORKSHOP);
    expect(items[0].priority).toBe("high");
    expect(items.every((i) => i.message)).toBe(true);
  });

  it("filters by minimum priority", () => {
    const high = resolveNotifications("workshop", WORKSHOP, { minPriority: "high" });
    expect(high.every((i) => i.priority === "high")).toBe(true);
  });
});

describe("buildStatusViews", () => {
  it("assembles summary + kpi line + insights, de-duplicated", () => {
    const views = buildStatusViews("workshop", WORKSHOP);
    expect(views[0]).toBe("7 jobs in progress"); // summary first
    expect(views).toContain("4 waiting · 7 in progress · 2 techs free");
    expect(new Set(views).size).toBe(views.length); // no dupes
  });

  it("collapses to a single static view in presentation mode", () => {
    const views = buildStatusViews("workshop", WORKSHOP, { isPresentation: true });
    expect(views).toEqual(["Workshop floor active"]);
  });

  it("always returns at least one view", () => {
    expect(buildStatusViews("accounts", {}).length).toBeGreaterThan(0);
  });
});

describe("buildTopbarSections", () => {
  it("returns KPI descriptors and insight strings as separate sections", () => {
    const { kpis, insights } = buildTopbarSections("workshop", WORKSHOP);
    expect(kpis.map((k) => k.key)).toEqual([
      "jobsWaiting",
      "jobsInProgress",
      "techniciansAvailable",
      "overdueJobs",
    ]);
    expect(kpis[0]).toMatchObject({ label: "waiting", value: 4 });
    expect(insights[0]).toBe("3 jobs overdue — needs chasing");
  });

  it("caps each section to its limit", () => {
    const { kpis, insights } = buildTopbarSections("workshop", WORKSHOP, {
      maxKpis: 2,
      maxInsights: 1,
    });
    expect(kpis).toHaveLength(2);
    expect(insights).toHaveLength(1);
  });

  it("surfaces nothing live in presentation mode", () => {
    expect(buildTopbarSections("workshop", WORKSHOP, { isPresentation: true })).toEqual({
      kpis: [],
      insights: [],
    });
  });
});

describe("resolveQuickActions", () => {
  it("prefers manifest actions and de-dupes by href", () => {
    const manifest = [{ href: "/a", label: "A" }, { href: "/a", label: "A2" }];
    expect(resolveQuickActions({ manifestQuickActions: manifest })).toEqual([
      { href: "/a", label: "A" },
    ]);
  });

  it("falls back to capability defaults", () => {
    const actions = resolveQuickActions({ canUseServiceActions: true });
    expect(actions).toEqual(SERVICE_QUICK_ACTIONS);
  });

  it("merges service + parts without duplicates", () => {
    const actions = resolveQuickActions({ canUseServiceActions: true, hasPartsAccess: true });
    const hrefs = actions.map((a) => a.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("continueContext", () => {
  it("classifies supported workflows", () => {
    expect(resolveResumable("/tech/12345").type).toBe("Job card");
    expect(resolveResumable("/tech/12345").label).toBe("Job 12345");
    expect(resolveResumable("/reports/workshop").type).toBe("Report");
    expect(resolveResumable("/customers/acme-ltd").type).toBe("Customer");
    expect(resolveResumable("/new-order").type).toBe("Parts order");
  });

  it("ignores unsupported / root routes", () => {
    expect(resolveResumable("/")).toBeNull();
    expect(resolveResumable("/dashboard/workshop")).toBeNull();
    expect(resolveResumable("")).toBeNull();
  });

  it("matches same-path ignoring hash", () => {
    const entry = resolveResumable("/tech/1");
    expect(isSamePath("/tech/1#notes", entry)).toBe(true);
    expect(isSamePath("/tech/2", entry)).toBe(false);
  });
});
