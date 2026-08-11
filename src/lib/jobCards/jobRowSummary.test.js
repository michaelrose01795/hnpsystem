import { describe, expect, it } from "vitest";
import { buildJobOperationalStatusCounts, buildJobRowSummary, buildTechnicianWorkloadMap, findNextJobsTechnician, formatOperationalAge, formatOperationalDuration, getJobBookedHours } from "./jobRowSummary";
import { selectCurrentAppointment } from "./utils";

describe("job row operational summary", () => {
  const now = new Date("2026-08-11T12:00:00Z");

  it("formats elapsed time without placeholder values", () => {
    expect(formatOperationalDuration("2026-08-11T10:35:00Z", now)).toBe("1h 25m");
    expect(formatOperationalDuration(null, now)).toBe("");
  });

  it("formats long status ages using days, hours and minutes", () => {
    expect(formatOperationalAge("2026-07-22T11:42:00Z", now)).toBe("20d 18m");
    expect(formatOperationalAge("2026-08-09T08:56:00Z", now)).toBe("2d 3h 4m");
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
    expect(summary.statusDuration).toBe("1h since last update");
    expect(summary.requests).toEqual([{
      text: "Investigate brake noise",
      hours: 1.5,
      status: "In Progress",
    }]);
    expect(summary.promisedState).toEqual({ label: "Late", tone: "danger" });
    expect(summary.signals.map((signal) => signal.label)).toEqual([
      "Collection overdue",
      "Customer update overdue",
    ]);
  });

  it("uses workflow status instead of the legacy inprogress request default", () => {
    const summary = buildJobRowSummary({
      status: "Booked",
      jobRequests: [{ requestId: 31, sortOrder: 1, description: "Manufacturer warranty fault diagnosis", hours: 1.8, status: "inprogress" }],
      writeUp: {
        completion_status: "additional_work",
        task_checklist: { tasks: [{ requestId: 31, sortOrder: 1, checked: false }] },
      },
    }, { now });

    expect(summary.requests[0].status).toBe("Not Started");
  });

  it("shows a request as completed when its write-up checklist row is checked", () => {
    const summary = buildJobRowSummary({
      status: "Booked",
      jobRequests: [{ requestId: 31, sortOrder: 1, description: "Manufacturer warranty fault diagnosis", hours: 1.8, status: "inprogress" }],
      writeUp: {
        completion_status: "additional_work",
        task_checklist: { tasks: [{ requestId: 31, sortOrder: 1, checked: true }] },
      },
    }, { now });

    expect(summary.requests[0].status).toBe("Completed");
  });

  it("does not borrow completion from an authorised VHC row with the same order", () => {
    const summary = buildJobRowSummary({
      status: "Booked",
      jobRequests: [{ requestId: 31, sortOrder: 1, description: "Customer diagnosis", status: "inprogress" }],
      writeUp: {
        completion_status: "additional_work",
        task_checklist: {
          tasks: [{ source: "vhc", requestId: 90, sortOrder: 1, checked: true }],
        },
      },
    }, { now });

    expect(summary.requests[0].status).toBe("Not Started");
  });

  it("keeps VHC-authorised work out of the customer-request band", () => {
    const summary = buildJobRowSummary({
      status: "In Progress",
      jobRequests: [
        { description: "Customer diagnosis", requestSource: "customer_request" },
        { description: "Authorised tyre", requestSource: "vhc_authorised" },
      ],
    }, { now });

    expect(summary.requests.map((request) => request.text)).toEqual(["Customer diagnosis"]);
  });

  it("shows an explicit empty parts state and omits unsupported timing details", () => {
    const summary = buildJobRowSummary({ status: "Booked", vhcRequired: true }, { now });
    expect(summary.parts).toEqual({ label: "No parts status", tone: "neutral", detail: "" });
    expect(summary.appointmentTime).toBe("");
    expect(summary.promisedLabel).toBe("");
    expect(summary.promisedState).toBeNull();
  });

  it("labels fulfilled parts as available", () => {
    const summary = buildJobRowSummary({
      status: "Booked",
      vhcRequired: false,
      partsAllocations: [{ status: "fulfilled" }],
    }, { now });

    expect(summary.parts).toEqual({ label: "Parts available", tone: "success", detail: "1 item" });
  });

  it("combines allocated parts and manual requests before choosing the parts status", () => {
    const summary = buildJobRowSummary({
      status: "In Progress",
      partsAllocations: [{ status: "stock" }],
      partsRequests: [{ status: "on_order" }],
    }, { now });

    expect(summary.parts).toEqual({ label: "Parts on order", tone: "warning", detail: "2 items" });
  });

  it("selects the latest active appointment deterministically", () => {
    expect(selectCurrentAppointment([
      { appointment_id: 1, scheduled_time: "2026-08-10T09:00:00Z", status: "booked" },
      { appointment_id: 3, scheduled_time: "2026-08-13T09:00:00Z", status: "cancelled" },
      { appointment_id: 2, scheduled_time: "2026-08-12T09:00:00Z", status: "booked" },
    ])?.appointment_id).toBe(2);
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

  it("derives technician workload from the matching Next Jobs technician row", () => {
    const technicians = [{ id: 7, name: "Tech 3" }];
    const workloads = buildTechnicianWorkloadMap([
      { assignedTo: 7, status: "In Progress", jobRequests: [{ hours: 1.5 }] },
      { assignedTo: 7, status: "Checked In", jobRequests: [{ hours: 2 }] },
      { assignedTo: 7, status: "Released", jobRequests: [{ hours: 9 }] },
      { assignedTo: 8, status: "In Progress", jobRequests: [{ hours: 4 }] },
    ], technicians);

    expect(workloads[7]).toEqual({ activeJobs: 1, bookedHours: 1.5 });
    expect(workloads[8]).toBeUndefined();
    expect(findNextJobsTechnician({ status: "In Progress", assignedTech: { id: 7, name: "Tech 3" } }, technicians)).toEqual(technicians[0]);
    expect(findNextJobsTechnician({ status: "Booked", assignedTech: { id: 7, name: "Tech 3" } }, technicians)).toBeNull();
    expect(findNextJobsTechnician({ status: "In Progress", assignedTech: { id: 8, name: "Former Tech" } }, technicians)).toBeNull();
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
