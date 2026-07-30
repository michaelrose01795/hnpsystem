import { describe, expect, it } from "vitest";
import { getWriteUpCompletionState } from "./selectors";

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
});
