import { describe, expect, it } from "vitest";
import {
  getClockingAwareJobStatus,
  getWriteUpChecklistTasks,
  getVhcCompletionUpdatesFromWriteUpTasks,
  getWriteUpCompletionState,
  isCustomerRequestCompleteInWriteUp,
} from "./selectors";

describe("getClockingAwareJobStatus", () => {
  it("promotes checked-in jobs after real workshop clocking activity", () => {
    expect(getClockingAwareJobStatus({
      jobStatus: "Checked In",
      hasClockingActivity: true,
    })).toEqual({ statusId: "in_progress", statusLabel: "In Progress" });
  });

  it("does not promote a checked-in job without clocking activity", () => {
    expect(getClockingAwareJobStatus({
      jobStatus: "Checked In",
      hasClockingActivity: false,
    })).toEqual({ statusId: "checked_in", statusLabel: "Checked In" });
  });
});

describe("getWriteUpCompletionState", () => {
  it("keeps the default state when no request rows are complete", () => {
    const state = getWriteUpCompletionState({
      checklistTasks: [
        { checked: false },
        { status: "inprogress" },
      ],
    });

    expect(state.isPartiallyComplete).toBe(false);
    expect(state.isCompleteInstant).toBe(false);
  });

  it("marks the write-up as partially complete when some request rows are complete", () => {
    const state = getWriteUpCompletionState({
      checklistTasks: [
        { checked: true },
        { checked: false },
      ],
    });

    expect(state.checkedRowCount).toBe(1);
    expect(state.isPartiallyComplete).toBe(true);
    expect(state.isCompleteInstant).toBe(false);
  });

  it("marks the write-up complete only when every request row is complete", () => {
    const state = getWriteUpCompletionState({
      checklistTasks: [
        { checked: true },
        { status: "completed" },
      ],
    });

    expect(state.checkedRowCount).toBe(2);
    expect(state.isPartiallyComplete).toBe(false);
    expect(state.isCompleteInstant).toBe(true);
  });

  it("falls back to persisted request-row statuses when no checklist exists", () => {
    const state = getWriteUpCompletionState({
      checklistTasks: [],
      requestRows: [
        { requestId: 1, status: "completed" },
      ],
    });

    expect(state.checkedRowCount).toBe(1);
    expect(state.rowCount).toBe(1);
    expect(state.isPartiallyComplete).toBe(false);
    expect(state.isCompleteInstant).toBe(true);
  });

  it("uses persisted request rows for partial progress when no checklist exists", () => {
    const state = getWriteUpCompletionState({
      requestRows: [
        { requestId: 1, status: "completed" },
        { requestId: 2, status: "inprogress" },
      ],
    });

    expect(state.checkedRowCount).toBe(1);
    expect(state.rowCount).toBe(2);
    expect(state.isPartiallyComplete).toBe(true);
    expect(state.isCompleteInstant).toBe(false);
  });

  it("prefers the visible persisted row status over a stale checklist snapshot", () => {
    const state = getWriteUpCompletionState({
      checklistTasks: [
        { requestId: 1, status: "inprogress", checked: false },
      ],
      requestRows: [
        { requestId: 1, status: "completed" },
      ],
    });

    expect(state.checkedRowCount).toBe(1);
    expect(state.rowCount).toBe(1);
    expect(state.isCompleteInstant).toBe(true);
  });

  it("keeps partial visible rows incomplete when the aggregate status is stale", () => {
    const state = getWriteUpCompletionState({
      completionStatus: "complete",
      requestRows: [
        { requestId: 1, status: "completed" },
        { requestId: 2, status: "inprogress" },
      ],
    });

    expect(state.isPartiallyComplete).toBe(true);
    expect(state.isCompleteInstant).toBe(false);
  });
});

describe("customer request write-up linkage", () => {
  it("reads all supported stored checklist shapes", () => {
    const tasks = [{ source: "request", requestId: 31, checked: true }];
    expect(getWriteUpChecklistTasks(tasks)).toEqual(tasks);
    expect(getWriteUpChecklistTasks({ tasks })).toEqual(tasks);
    expect(getWriteUpChecklistTasks(JSON.stringify({ tasks }))).toEqual(tasks);
  });

  it("matches a request by its stable request ID", () => {
    expect(isCustomerRequestCompleteInWriteUp({
      request: { requestId: 31, sortOrder: 1 },
      checklistTasks: [{ source: "request", requestId: 31, sortOrder: 1, checked: true }],
    })).toBe(true);
  });

  it("does not let a VHC row with the same sort order complete a customer request", () => {
    expect(isCustomerRequestCompleteInWriteUp({
      request: { requestId: 31, sortOrder: 1 },
      requestIndex: 0,
      checklistTasks: [{ source: "vhc", requestId: 90, sortOrder: 1, checked: true }],
    })).toBe(false);
  });

  it("does not fall through to sort order when stable request IDs disagree", () => {
    expect(isCustomerRequestCompleteInWriteUp({
      request: { requestId: 31, sortOrder: 1 },
      checklistTasks: [{ source: "request", requestId: 32, sortOrder: 1, checked: true }],
    })).toBe(false);
  });
});

describe("getVhcCompletionUpdatesFromWriteUpTasks", () => {
  it("maps authorised write-up tasks to their canonical VHC completion flags", () => {
    const updates = getVhcCompletionUpdatesFromWriteUpTasks([
      { source: "request", requestId: 10, checked: true },
      { source: "vhc", vhcItemId: 1806, checked: true },
      { source: "vhc", vhcItemId: 1810, status: "additional_work" },
    ]);

    expect(updates).toEqual([
      { vhcItemId: 1806, complete: true },
      { vhcItemId: 1810, complete: false },
    ]);
  });

  it("ignores VHC tasks that do not have a persisted VHC item ID", () => {
    expect(getVhcCompletionUpdatesFromWriteUpTasks([
      { source: "vhc", sourceKey: "vhc-missing", checked: true },
    ])).toEqual([]);
  });
});
