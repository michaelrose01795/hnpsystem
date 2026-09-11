// Unit tests for the manager and admin dashboard aggregations. Both builders
// are pure: they take already-fetched rows plus a window and return the exact
// shape the dashboard renders, so every figure on the page is covered here
// without touching Supabase.
import { describe, it, expect } from "vitest";
import dayjs from "dayjs";
import { dashboardWindow, tally, bucket, delta, dailySumSeries } from "@/lib/database/dashboard/managementInsights";
import { buildManagerInsights, stageOf } from "@/lib/database/dashboard/managers";
import { buildAdminInsights } from "@/lib/database/dashboard/admin";

const NOW = dayjs("2026-09-08T15:00:00.000Z");
const window7 = dashboardWindow(7, NOW);
const at = (day, time = "09:00") => window7.today.subtract(day, "day").format(`YYYY-MM-DD[T]${time}:00.000Z`);

describe("dashboardWindow", () => {
  it("opens an equal-length comparison window immediately before the current one", () => {
    expect(window7.start.diff(window7.previousStart, "day")).toBe(7);
    expect(window7.previousStart.isBefore(window7.start)).toBe(true);
  });
});

describe("shared aggregation helpers", () => {
  it("folds a long tail into a single Other row", () => {
    const rows = [{ k: "a" }, { k: "a" }, { k: "b" }, { k: "c" }, { k: "d" }];
    expect(tally(rows, (row) => row.k, { limit: 2 })).toEqual([
      { label: "a", value: 2 }, { label: "b", value: 1 }, { label: "Other", value: 2 },
    ]);
  });

  it("labels a missing value rather than dropping the row", () => {
    expect(tally([{ k: null }], (row) => row.k)).toEqual([{ label: "Not recorded", value: 1 }]);
  });

  it("returns every bucket even when empty, in declaration order", () => {
    const definitions = [{ label: "low", test: (v) => v < 5 }, { label: "high", test: () => true }];
    expect(bucket([{ v: 1 }, { v: 9 }, { v: 2 }], definitions, (row) => row.v))
      .toEqual([{ label: "low", value: 2 }, { label: "high", value: 1 }]);
  });

  it("reports no percentage when the previous period was zero", () => {
    expect(delta(5, 0)).toEqual({ current: 5, previous: 0, change: 5, percent: null });
    expect(delta(8, 10)).toEqual({ current: 8, previous: 10, change: -2, percent: -20 });
  });

  it("sums a value column per day and zero-fills the gaps", () => {
    const rows = [{ on: at(1), v: 10 }, { on: at(1), v: 5 }, { on: at(0), v: 2 }];
    const series = dailySumSeries(rows, "on", "v", window7.start, 7);
    expect(series).toHaveLength(7);
    expect(series.at(-1)).toEqual({ key: window7.today.format("YYYY-MM-DD"), value: 2 });
    expect(series.at(-2).value).toBe(15);
    expect(series[0].value).toBe(0);
  });
});

describe("stageOf", () => {
  it("reports the furthest blocking stage a job has reached", () => {
    expect(stageOf({})).toBe("Awaiting arrival");
    expect(stageOf({ checked_in_at: at(1) })).toBe("Awaiting allocation");
    expect(stageOf({ checked_in_at: at(1), assigned_to: 4 })).toBe("Allocated, not started");
    expect(stageOf({ checked_in_at: at(1), assigned_to: 4, workshop_started_at: at(1) })).toBe("In workshop");
    expect(stageOf({ checked_in_at: at(1), workshop_started_at: at(1), vhc_required: true })).toBe("VHC outstanding");
    expect(stageOf({ checked_in_at: at(1), vhc_sent_at: at(1) })).toBe("Awaiting authorisation");
    expect(stageOf({ checked_in_at: at(1), vhc_sent_at: at(1), parts_ordered_at: at(1) })).toBe("Awaiting parts");
    expect(stageOf({ checked_in_at: at(1), wash_started_at: at(0) })).toBe("Wash and valet");
  });
});

describe("buildManagerInsights", () => {
  const open = [
    // On site four days, update overdue, unassigned, VHC outstanding.
    { id: 1, job_number: "J1", status: "in_progress", type: "Service", job_division: "Retail", job_source: "Phone",
      checked_in_at: at(4), vhc_required: true, next_update_due: at(1) },
    // On site today, allocated and started.
    { id: 2, job_number: "J2", status: "in_progress", type: "MOT", job_division: "Retail", job_source: "Online",
      checked_in_at: at(0), assigned_to: 10, workshop_started_at: at(0) },
    // Booked, never arrived.
    { id: 3, job_number: "J3", status: "booked", type: "Service", job_division: "Trade" },
    // Cancelled work must never count as open.
    { id: 4, job_number: "J4", status: "cancelled", checked_in_at: at(2) },
  ];
  const activity = [
    { id: 5, assigned_to: 10, checked_in_at: at(2, "08:00"), completed_at: at(1, "16:00") },
    { id: 6, assigned_to: 10, checked_in_at: at(1, "08:00"), completed_at: at(1, "12:00"), vhc_completed_at: at(1),
      vhc_sent_at: at(1), vhc_authorized_total: 300, vhc_declined_total: 100 },
    // Previous period — feeds the comparison only.
    { id: 7, assigned_to: 10, checked_in_at: at(9, "08:00"), completed_at: at(9, "18:00") },
  ];
  const extras = {
    staff: [{ user_id: 10, first_name: "Sam", last_name: "Doe", role: "Technician", is_active: true }],
    clocking: [{ id: 1, user_id: 10, clock_in: at(1, "08:00"), clock_out: at(1, "12:00") }],
    invoices: [
      { id: "a", created_at: at(1), grand_total: 500, labour_total: 300, parts_total: 200 },
      { id: "b", created_at: at(9), grand_total: 250 },
    ],
    partsQueue: [{ request_id: 1, created_at: at(2), description: "Brake pads", quantity: 2 }],
  };
  const data = buildManagerInsights(open, activity, window7, extras);

  it("counts only genuinely open work", () => {
    expect(data.openCount).toBe(3);
    expect(data.onSiteCount).toBe(2);
    expect(data.agedCount).toBe(1);
    expect(data.overdueCount).toBe(1);
    expect(data.unassignedCount).toBe(1);
    expect(data.pendingVhcCount).toBe(1);
  });

  it("measures turnaround from arrival to completion and compares periods", () => {
    // 32h (id 5) and 4h (id 6) in the period; 10h in the one before.
    expect(data.avgTurnaroundHours).toBe(18);
    expect(data.medianTurnaroundHours).toBe(18);
    expect(data.turnaroundDelta.previous).toBe(10);
    expect(data.turnaroundDelta.change).toBe(8);
    expect(data.completedDelta).toMatchObject({ current: 2, previous: 1 });
  });

  it("splits open work by the stage it is stuck at", () => {
    expect(data.stageMix).toEqual(expect.arrayContaining([
      { label: "Awaiting allocation", value: 1 },
      { label: "In workshop", value: 1 },
      { label: "Awaiting arrival", value: 1 },
    ]));
    expect(data.stageMix.reduce((total, item) => total + item.value, 0)).toBe(3);
    expect(data.ageing.find((item) => item.label === "4–7 days").value).toBe(1);
    expect(data.ageing.find((item) => item.label === "Not checked in").value).toBe(1);
  });

  it("builds one workload row per person, naming them from the staff list", () => {
    const sam = data.technicians.find((tech) => tech.userId === 10);
    expect(sam).toMatchObject({ name: "Sam Doe", role: "Technician", openJobs: 1, completedJobs: 2, hours: 4 });
    expect(data.clockedHours).toBe(4);
  });

  it("reports VHC authorisation as a share of the value offered", () => {
    expect(data.vhcAuthorisedTotal).toBe(300);
    expect(data.vhcDeclinedTotal).toBe(100);
    expect(data.vhcConversionRate).toBe(75);
  });

  it("counts invoiced value inside the period only", () => {
    expect(data.invoicedTotal).toBe(500);
    expect(data.invoicedCount).toBe(1);
    expect(data.labourTotal).toBe(300);
    expect(data.invoicedDelta).toMatchObject({ previous: 250, change: 250 });
  });

  it("ages the pending parts queue", () => {
    expect(data.partsQueue[0].ageHours).toBeGreaterThan(48);
    expect(data.partsAgeing.find((item) => item.label === "3+ days").value).toBe(1);
  });

  it("puts overdue work at the top of the attention list with its stage and technician", () => {
    expect(data.attention[0].job_number).toBe("J1");
    expect(data.attention[0].reason).toContain("Update overdue");
    expect(data.attention[0].stage).toBe("Awaiting allocation");
    expect(data.longestOpen[0].job_number).toBe("J1");
  });
});

describe("buildAdminInsights", () => {
  const appointments = [
    { appointment_id: 1, scheduled_time: window7.today.hour(9).toISOString(), status: "booked" },
    { appointment_id: 2, scheduled_time: window7.today.hour(14).toISOString(), status: "cancelled" },
    { appointment_id: 3, scheduled_time: window7.today.add(2, "day").hour(10).toISOString(), status: "booked" },
    { appointment_id: 4, scheduled_time: at(2, "11:00"), status: "booked" },
    { appointment_id: 5, scheduled_time: at(9, "11:00"), status: "booked" },
  ];
  const invoices = [
    { invoice_id: "a", created_at: at(1), grand_total: 400, payment_status: "Paid", paid: true, payment_method: "Card" },
    { invoice_id: "b", created_at: at(2), due_date: window7.today.subtract(45, "day").format("YYYY-MM-DD"), grand_total: 600, payment_status: "Issued" },
    { invoice_id: "c", created_at: at(3), grand_total: 100, payment_status: "Draft" },
    { invoice_id: "d", created_at: at(40), grand_total: 900, payment_status: "Issued", due_date: window7.today.subtract(120, "day").format("YYYY-MM-DD") },
  ];
  const data = buildAdminInsights(appointments, window7, {
    invoices,
    staff: [
      { user_id: 1, first_name: "Ann", last_name: "Lee", role: "Admin", department: "Office", is_active: true },
      { user_id: 2, first_name: "Bo", last_name: "Ray", role: "Technician", department: "Workshop", is_active: false },
    ],
    attendance: [{ id: 1, user_id: 1, date: window7.today.format("YYYY-MM-DD"), clock_in: at(0, "08:00"), total_hours: 7 }],
    absences: [{ absence_id: 1, user_id: 2, type: "Holiday", start_date: window7.today.format("YYYY-MM-DD"), end_date: window7.today.add(2, "day").format("YYYY-MM-DD") }],
    recentJobs: [{ id: 1, created_at: at(1), job_source: "Phone", job_division: "Retail" }],
  });

  it("separates today, the reporting period and the week ahead", () => {
    expect(data.appointmentsToday).toBe(2);
    expect(data.appointmentsUpcoming).toBe(3);
    expect(data.appointmentsPeriod).toBe(3);
    expect(data.appointmentsDelta).toMatchObject({ current: 3, previous: 1 });
    expect(data.upcomingAppointments).toHaveLength(1);
  });

  it("reports the cancellation rate over the period", () => {
    expect(data.cancelledCount).toBe(1);
    expect(data.cancellationRate).toBeCloseTo(33.3, 1);
  });

  it("spreads upcoming demand across the working day", () => {
    expect(data.bookingHours.find((item) => item.label === "09:00").value).toBe(1);
    expect(data.bookingHours.find((item) => item.label === "10:00").value).toBe(1);
    expect(data.bookingWeekdays).toHaveLength(7);
  });

  it("separates invoiced, settled, outstanding and draft value", () => {
    expect(data.invoicedTotal).toBe(1100);
    expect(data.settledTotal).toBe(400);
    expect(data.outstandingTotal).toBe(1500);
    expect(data.outstandingCount).toBe(2);
    expect(data.draftTotal).toBe(100);
    expect(data.paymentMix).toEqual([{ label: "Card", value: 1 }]);
  });

  it("ages outstanding debt against the due date", () => {
    expect(data.debtAgeing.find((item) => item.label === "31–60 days").value).toBe(1);
    expect(data.debtAgeing.find((item) => item.label === "Over 90 days").value).toBe(1);
    expect(data.oldestOutstanding[0].invoice_id).toBe("d");
    expect(data.oldestOutstanding[0].daysOverdue).toBe(120);
  });

  it("summarises who is in, who is away and how accounts are distributed", () => {
    expect(data.onSiteCount).toBe(1);
    expect(data.attendance[0]).toMatchObject({ name: "Ann Lee", state: "On site" });
    expect(data.absentTodayCount).toBe(1);
    expect(data.activeStaffCount).toBe(1);
    expect(data.inactiveStaffCount).toBe(1);
    expect(data.roleMix).toEqual([{ label: "Admin", value: 1 }]);
    expect(data.departmentMix).toEqual([{ label: "Office", value: 1 }]);
  });

  it("tracks job intake alongside bookings", () => {
    expect(data.jobIntakeCount).toBe(1);
    expect(data.jobSourceMix).toEqual([{ label: "Phone", value: 1 }]);
    expect(data.jobIntakeSeries).toHaveLength(7);
  });
});
