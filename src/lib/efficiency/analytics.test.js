import { describe, expect, it } from "vitest";
import {
  aggregateWorkshopMetrics,
  buildCategoryAnalysis,
  buildClockingQualityAlerts,
  buildJobAnalysis,
  buildPeriodMetrics,
  reconcileEfficiencyEntries,
} from "@/lib/efficiency/analytics";

const target = { monthlyTargetHours: 160, weeklyContractedHours: 40, weight: 1 };
const options = {
  year: 2026,
  month: 8,
  period: "day",
  anchorDate: new Date(2026, 7, 12),
  referenceDate: new Date(2026, 7, 12, 17),
  weeklyContractedHours: 40,
};

describe("efficiency analytics", () => {
  it("aggregates workshop metrics from the same weighted technician rows", () => {
    const workshop = aggregateWorkshopMetrics([
      {
        weight: 0.5,
        metrics: {
          productiveHours: 8,
          loggedHours: 9,
          overtimeHours: 1,
          unallocatedHours: 0.5,
          targetHours: 8,
          fullMonthTargetHours: 160,
          allocatedHours: 10,
        },
      },
      {
        weight: 1,
        metrics: {
          productiveHours: 6,
          loggedHours: 8,
          overtimeHours: 2,
          unallocatedHours: 1,
          targetHours: 8,
          fullMonthTargetHours: 160,
          allocatedHours: 6,
        },
      },
    ]);

    expect(workshop.productiveHours).toBe(14);
    expect(workshop.loggedHours).toBe(17);
    expect(workshop.overtimeHours).toBe(3);
    expect(workshop.allocatedHours).toBe(16);
    expect(workshop.efficiencyPct).toBe(114.3);
    expect(workshop.weightedActual).toBe(10);
    expect(workshop.weightedTarget).toBe(12);
    expect(workshop.weightedDifference).toBe(-2);
  });

  it("keeps the automatic row and excludes a likely duplicate manual row", () => {
    const entries = [
      {
        id: "jc_1",
        user_id: 7,
        date: "2026-08-12",
        job_number: "J100",
        hours_spent: 2,
        allocated_hours: null,
        _source: "job_clocking",
      },
      {
        id: 22,
        user_id: 7,
        date: "2026-08-12",
        job_number: "J100",
        job_description: "Annual service",
        hours_spent: 2,
        allocated_hours: 1.5,
      },
    ];

    const reconciled = reconcileEfficiencyEntries(entries);
    const automatic = reconciled.find((entry) => entry.id === "jc_1");
    const manual = reconciled.find((entry) => entry.id === 22);

    expect(automatic.allocated_hours).toBe(1.5);
    expect(automatic.job_description).toBe("Annual service");
    expect(manual._excludedFromTotals).toBe(true);

    const metrics = buildPeriodMetrics(reconciled, target, options);
    expect(metrics.productiveHours).toBe(2);
    expect(metrics.allocatedHours).toBe(1.5);
    expect(metrics.efficiencyPct).toBe(75);
  });

  it("keeps overtime separate from productive efficiency", () => {
    const metrics = buildPeriodMetrics(
      [
        { id: 1, user_id: 7, date: "2026-08-12", hours_spent: 6, allocated_hours: 7 },
        {
          id: "ot_1",
          user_id: 7,
          date: "2026-08-12",
          hours_spent: 2,
          allocated_hours: null,
          _source: "overtime_sessions",
        },
      ],
      target,
      options
    );

    expect(metrics.productiveHours).toBe(6);
    expect(metrics.overtimeHours).toBe(2);
    expect(metrics.loggedHours).toBe(8);
    expect(metrics.efficiencyPct).toBe(116.7);
  });

  it("counts a repeated request allocation once across clocking segments", () => {
    const jobs = buildJobAnalysis([
      { id: "jc_1", user_id: 7, date: "2026-08-12", job_number: "J200", hours_spent: 1, allocated_hours: 2, _source: "job_clocking", _allocation_key: "request:4" },
      { id: "jc_2", user_id: 7, date: "2026-08-12", job_number: "J200", hours_spent: 1.5, allocated_hours: 2, _source: "job_clocking", _allocation_key: "request:4" },
    ]);

    expect(jobs.over[0]).toMatchObject({ allocatedHours: 2, actualHours: 2.5, difference: 0.5 });
  });

  it("uses existing category metadata and reports quality issues without editing rows", () => {
    const entry = {
      id: "jc_9",
      user_id: 7,
      date: "2026-08-12",
      job_number: "J300",
      job_description: "Diagnostic investigation",
      hours_spent: 13,
      allocated_hours: 0,
      _source: "job_clocking",
      _category: "Customer",
    };
    const categories = buildCategoryAnalysis([entry]);
    const alerts = buildClockingQualityAlerts([entry], [
      { id: 9, user_id: 7, job_number: "J300", clock_in: "2026-08-12T08:00:00Z", clock_out: null },
    ]);

    expect(categories[0].category).toBe("Diagnostics");
    expect(alerts.map((alert) => alert.title)).toEqual(
      expect.arrayContaining(["Missing allocation", "Unusually long clocking", "Missing clock-off"])
    );
    expect(entry).not.toHaveProperty("_qualityIssue");
  });
});

