import { describe, expect, it } from "vitest";
import { buildJobOperationalStatusCounts, buildJobRowSummary, buildTechnicianWorkloadMap, formatOperationalDuration, getJobBookedHours } from "./jobRowSummary";

describe("job row operational summary", () => {
  const now = new Date("2026-08-11T12:00:00Z");

  it("formats elapsed time without placeholder values", () => {
    expect(formatOperationalDuration("2026-08-11T10:35:00Z", now)).toBe("1h 25m");
    expect(formatOperationalDuration(null, now)).toBe("");
  });

  it("uses canonical requests and reliable overdue signals", () => {
    const summary = buildJobRowSummary({
      status: "In Progress",
      statusUpdatedAt: "2026-08-11T11:00:00Z",
      checkedInAt: "2026-08-11T09:30:00Z",
      assignedTo: 7,
      jobRequests: [{ description: "Investigate brake noise", hours: 1.5, status: "in_progress", updatedAt: "2026-08-11T11:30:00Z" }],
      bookingRequest: { estimatedCompletion: "2026-08-11T11:30:00Z" },
      nextUpdateDue: "2026-08-11T11:45:00Z",
      vhcRequired: false,
    }, { now });

    expect(summary.presenceLabel).toBe("Waiting 2h 30m");
    expect(summary.scheduleLabel).toBe("");
    expect(summary.vhc.label).toBe("No VHC");
    expect(summary.statusDuration).toBe("1h in status");
    expect(summary.requests).toEqual([{
      text: "Investigate brake noise",
      hours: 1.5,
      status: "In Progress",
      statusDuration: "30m",
    }]);
    expect(summary.promisedState).toEqual({ label: "Late", tone: "danger" });
    expect(summary.signals.map((signal) => signal.label)).toEqual([
      "Collection overdue",
      "Customer update overdue",
    ]);
  });

  it("omits unsupported parts and timing details", () => {
    const summary = buildJobRowSummary({ status: "Booked", vhcRequired: true }, { now });
    expect(summary.parts).toBeNull();
    expect(summary.appointmentTime).toBe("");
    expect(summary.promisedLabel).toBe("");
    expect(summary.promisedState).toBeNull();
  });

  it("counts due time from appointment plus the current total booked work", () => {
    const job = {
      status: "Booked",
      appointment: { date: "2026-08-11", time: "10:00" },
      jobRequests: [{ description: "Service", hours: 1 }],
      vhcRequired: false,
    };

    expect(getJobBookedHours(job)).toBe(1);
    expect(buildJobRowSummary(job, { now: new Date("2026-08-11T09:30:00") }).scheduleLabel).toBe("Due +30m");
    expect(buildJobRowSummary(job, { now: new Date("2026-08-11T10:30:00") }).scheduleLabel).toBe("Due +30m");
    expect(buildJobRowSummary(job, { now: new Date("2026-08-11T16:46:00") }).scheduleLabel).toBe("Overdue -5h 46m");

    job.jobRequests.push({ description: "Authorised additional work", hours: 0.5, requestSource: "vhc_authorised" });

    expect(getJobBookedHours(job)).toBe(1.5);
    const extendedSummary = buildJobRowSummary(job, { now: new Date("2026-08-11T16:46:00") });
    expect(extendedSummary.scheduleLabel).toBe("Overdue -5h 16m");
    expect(extendedSummary.scheduleState).toBe("overdue");
  });

  it("derives technician workload only from stored active jobs and request hours", () => {
    const workloads = buildTechnicianWorkloadMap([
      { assignedTo: 7, status: "In Progress", jobRequests: [{ hours: 1.5 }] },
      { assignedTo: 7, status: "Checked In", jobRequests: [{ hours: 2 }] },
      { assignedTo: 7, status: "Released", jobRequests: [{ hours: 9 }] },
    ]);

    expect(workloads[7]).toEqual({ activeJobs: 2, bookedHours: 3.5 });
  });

  it("builds the operational status strip from existing job state", () => {
    const counts = buildJobOperationalStatusCounts([
      {
        status: "Checked In",
        rawStatus: "customer_arrived",
        checkedInAt: "2026-08-11T10:00:00Z",
        appointment: { date: "2026-08-11", time: "09:30" },
        vhcRequired: false,
      },
      {
        status: "In Progress",
        rawStatus: "retail_parts_on_order",
        checkedInAt: "2026-08-10T09:00:00Z",
        workshopStartedAt: "2026-08-10T10:00:00Z",
        appointment: { date: "2026-08-10", time: "09:00" },
        partsAllocations: [{ status: "on_order" }],
        bookingRequest: { estimatedCompletion: "2026-08-11T11:00:00Z" },
        vhcRequired: false,
      },
      {
        status: "In Progress",
        rawStatus: "vhc_sent_to_customer",
        vhcRequired: true,
        vhcChecks: [{ severity: "amber", approval_status: "pending" }],
        vhcSentAt: "2026-08-11T10:30:00Z",
      },
      { status: "In Progress", rawStatus: "ready_for_release", vhcRequired: false },
    ], { now });

    expect(counts).toEqual({
      arrived: 2,
      waiting: 1,
      inWorkshop: 1,
      awaitingParts: 1,
      awaitingAuthorisation: 1,
      ready: 1,
      overdue: 1,
      carryOvers: 1,
    });
  });
});
