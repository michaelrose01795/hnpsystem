// file location: src/features/vhc/vhcStatusEngine.test.js
// Phase 0 unit tests for the VHC status engine.
//
// Locks the projection (DB row → { condition, workflow_status, parts_status, labour_status })
// for ~20 representative scenarios. Subsequent refactor phases must keep these
// assertions green; if a phase deliberately changes a mapping, the corresponding
// fixture is updated in the same change so the diff is reviewable.

import { describe, it, expect } from "vitest";

import {
  projectVhcItem,
  projectVhcItems,
  getVhcSummary,
  getDisplayStatus,
  getNextActions,
  isItemComplete,
  applyVhcDecision,
  WORKFLOW_STATUS,
  PARTS_STATUS,
  LABOUR_STATUS,
  DECISION,
  SEVERITY,
  TECH_JOB_STATUS,
  CLOCKING_WORK_TYPE,
  hasOutstandingAuthorisedVhcWork,
  getJobTechStatusFromVhcItems,
  getClockingWorkTypeForJob,
  getPartAuthorisedDisplayStatus,
  AUTHORISED_PART_STATUS,
} from "@/features/vhc/vhcStatusEngine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseCheck = (overrides = {}) => ({ // Minimal vhc_checks row used as scenario base.
  vhc_id: "vhc-1",
  job_id: "job-1",
  section: "wheelsTyres",
  issue_title: "Front offside tyre",
  severity: "amber",
  approval_status: "pending",
  authorization_state: null,
  display_status: null,
  labour_complete: false,
  labour_hours: 0,
  parts_complete: false,
  parts_cost: 0,
  Complete: false,
  ...overrides,
});

const part = (overrides = {}) => ({ // Minimal parts_job_items row.
  id: "part-1",
  job_id: "job-1",
  vhc_item_id: "vhc-1",
  status: "pending",
  authorised: false,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Projection — table of scenarios
// ---------------------------------------------------------------------------

describe("projectVhcItem — workflow_status", () => {
  it("pending + vhc not sent → new", () => {
    const out = projectVhcItem(baseCheck({ approval_status: "pending" }), { job: { vhc_sent_at: null } });
    expect(out.workflow_status).toBe(WORKFLOW_STATUS.NEW);
  });

  it("pending + vhc sent → awaiting_customer", () => {
    const out = projectVhcItem(baseCheck({ approval_status: "pending" }), { job: { vhc_sent_at: "2026-04-28T09:00:00Z" } });
    expect(out.workflow_status).toBe(WORKFLOW_STATUS.AWAITING_CUSTOMER);
  });

  it("authorized, no labour, no parts fitted → approved", () => {
    const out = projectVhcItem(baseCheck({ approval_status: "authorized" }));
    expect(out.workflow_status).toBe(WORKFLOW_STATUS.APPROVED);
  });

  it("authorized + labour_hours > 0 + labour_complete=false → in_progress", () => {
    const out = projectVhcItem(baseCheck({ approval_status: "authorized", labour_hours: 1.5, labour_complete: false }));
    expect(out.workflow_status).toBe(WORKFLOW_STATUS.IN_PROGRESS);
    expect(out.labour_status).toBe(LABOUR_STATUS.IN_PROGRESS);
  });

  it("authorized + any linked part fitted → in_progress", () => {
    const out = projectVhcItem(
      baseCheck({ approval_status: "authorized", Complete: false }),
      { partsJobItems: [part({ status: "fitted" })] },
    );
    expect(out.workflow_status).toBe(WORKFLOW_STATUS.IN_PROGRESS);
    expect(out.parts_status).toBe(PARTS_STATUS.FITTED);
  });

  it("authorized + Complete=true → completed", () => {
    const out = projectVhcItem(baseCheck({ approval_status: "authorized", Complete: true }));
    expect(out.workflow_status).toBe(WORKFLOW_STATUS.COMPLETED);
    expect(out.isComplete).toBe(true);
  });

  it("approval_status='completed' → completed regardless of Complete flag", () => {
    const out = projectVhcItem(baseCheck({ approval_status: "completed", Complete: false }));
    expect(out.workflow_status).toBe(WORKFLOW_STATUS.COMPLETED);
  });

  it("declined → declined", () => {
    const out = projectVhcItem(baseCheck({ approval_status: "declined" }));
    expect(out.workflow_status).toBe(WORKFLOW_STATUS.DECLINED);
  });

  it("n/a renders as approved (preserves Summary tick)", () => {
    const out = projectVhcItem(baseCheck({ approval_status: "n/a" }));
    expect(out.workflow_status).toBe(WORKFLOW_STATUS.APPROVED);
  });

  it("British spelling 'authorised' is accepted", () => {
    const out = projectVhcItem(baseCheck({ approval_status: "authorised" }));
    expect(out.decision).toBe(DECISION.AUTHORIZED);
    expect(out.workflow_status).toBe(WORKFLOW_STATUS.APPROVED);
  });

  it("approval_status='Approved' (mixed case) is accepted", () => {
    const out = projectVhcItem(baseCheck({ approval_status: "Approved" }));
    expect(out.decision).toBe(DECISION.AUTHORIZED);
  });

  it("missing approval_status falls back to authorization_state", () => {
    const out = projectVhcItem(baseCheck({ approval_status: null, authorization_state: "authorized_added_to_job" }));
    expect(out.decision).toBe(DECISION.AUTHORIZED);
    expect(out.isAddedToJob).toBe(true);
  });
});

describe("projectVhcItem — condition", () => {
  it("severity red", () => {
    expect(projectVhcItem(baseCheck({ severity: "red" })).condition).toBe(SEVERITY.RED);
  });
  it("severity amber", () => {
    expect(projectVhcItem(baseCheck({ severity: "amber" })).condition).toBe(SEVERITY.AMBER);
  });
  it("severity green", () => {
    expect(projectVhcItem(baseCheck({ severity: "green" })).condition).toBe(SEVERITY.GREEN);
  });
  it("severity grey is preserved (not collapsed)", () => {
    expect(projectVhcItem(baseCheck({ severity: "grey" })).condition).toBe(SEVERITY.GREY);
  });
  it("missing severity defaults to grey", () => {
    expect(projectVhcItem(baseCheck({ severity: null })).condition).toBe(SEVERITY.GREY);
  });
});

describe("projectVhcItem — parts_status precedence", () => {
  it("no linked parts → none", () => {
    expect(projectVhcItem(baseCheck(), { partsJobItems: [] }).parts_status).toBe(PARTS_STATUS.NONE);
  });

  it("only removed/cancelled rows → none", () => {
    const out = projectVhcItem(baseCheck(), { partsJobItems: [part({ status: "removed" }), part({ status: "cancelled" })] });
    expect(out.parts_status).toBe(PARTS_STATUS.NONE);
  });

  it("any fitted wins over ready/ordered/required", () => {
    const out = projectVhcItem(baseCheck(), {
      partsJobItems: [part({ status: "pending" }), part({ status: "on_order" }), part({ status: "fitted" }), part({ status: "picked" })],
    });
    expect(out.parts_status).toBe(PARTS_STATUS.FITTED);
  });

  it("ready beats ordered and required", () => {
    const out = projectVhcItem(baseCheck(), {
      partsJobItems: [part({ status: "pending" }), part({ status: "on_order" }), part({ status: "stock" })],
    });
    expect(out.parts_status).toBe(PARTS_STATUS.READY);
  });

  it("ordered beats required", () => {
    const out = projectVhcItem(baseCheck(), {
      partsJobItems: [part({ status: "pending" }), part({ status: "booked" })],
    });
    expect(out.parts_status).toBe(PARTS_STATUS.ORDERED);
  });

  it("waiting_authorisation maps to required", () => {
    const out = projectVhcItem(baseCheck(), { partsJobItems: [part({ status: "waiting_authorisation" })] });
    expect(out.parts_status).toBe(PARTS_STATUS.REQUIRED);
  });
});

describe("projectVhcItem — labour_status", () => {
  it("not_started when no hours, not complete", () => {
    expect(projectVhcItem(baseCheck({ labour_complete: false, labour_hours: 0 })).labour_status).toBe(LABOUR_STATUS.NOT_STARTED);
  });
  it("in_progress when hours logged but not complete", () => {
    expect(projectVhcItem(baseCheck({ labour_complete: false, labour_hours: 0.5 })).labour_status).toBe(LABOUR_STATUS.IN_PROGRESS);
  });
  it("completed when labour_complete=true regardless of hours", () => {
    expect(projectVhcItem(baseCheck({ labour_complete: true, labour_hours: 0 })).labour_status).toBe(LABOUR_STATUS.COMPLETED);
  });
});

// ---------------------------------------------------------------------------
// Batch projection
// ---------------------------------------------------------------------------

describe("projectVhcItems", () => {
  it("returns empty array for empty input", () => {
    expect(projectVhcItems([])).toEqual([]);
  });

  it("builds the parts map once across the batch", () => {
    const checks = [baseCheck({ vhc_id: "a" }), baseCheck({ vhc_id: "b" })];
    const partsJobItems = [part({ vhc_item_id: "a", status: "fitted" }), part({ vhc_item_id: "b", status: "on_order" })];
    const out = projectVhcItems(checks, { partsJobItems });
    expect(out).toHaveLength(2);
    expect(out[0].parts_status).toBe(PARTS_STATUS.FITTED);
    expect(out[1].parts_status).toBe(PARTS_STATUS.ORDERED);
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

describe("getVhcSummary", () => {
  it("counts by condition / workflow / parts / labour", () => {
    const checks = [
      baseCheck({ vhc_id: "a", severity: "red", approval_status: "pending" }), // new + red
      baseCheck({ vhc_id: "b", severity: "amber", approval_status: "authorized" }), // approved + amber
      baseCheck({ vhc_id: "c", severity: "green", approval_status: "n/a" }), // approved + green
      baseCheck({ vhc_id: "d", severity: "amber", approval_status: "declined" }), // declined + amber
    ];
    const summary = getVhcSummary(checks, { job: { vhc_sent_at: null } });
    expect(summary.counts.total).toBe(4);
    expect(summary.counts.byCondition.red).toBe(1);
    expect(summary.counts.byCondition.amber).toBe(2);
    expect(summary.counts.byCondition.green).toBe(1);
    expect(summary.counts.byWorkflow.new).toBe(1);
    expect(summary.counts.byWorkflow.approved).toBe(2);
    expect(summary.counts.byWorkflow.declined).toBe(1);
    expect(summary.hasAwaitingCustomer).toBe(false);
  });

  it("hasAwaitingCustomer flips when vhc_sent_at is set with pending items", () => {
    const checks = [baseCheck({ approval_status: "pending" })];
    const summary = getVhcSummary(checks, { job: { vhc_sent_at: "2026-04-28T09:00:00Z" } });
    expect(summary.hasAwaitingCustomer).toBe(true);
    expect(summary.counts.byWorkflow.awaiting_customer).toBe(1);
  });

  it("totals stub is null until Phase 2", () => {
    expect(getVhcSummary([baseCheck()]).totals).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getDisplayStatus — must keep the existing UI shape stable
// ---------------------------------------------------------------------------

describe("getDisplayStatus", () => {
  it("authorized → label 'Authorised', dotState 'approved'", () => {
    const projected = projectVhcItem(baseCheck({ approval_status: "authorized" }));
    const view = getDisplayStatus(projected);
    expect(view.label).toBe("Authorised");
    expect(view.dotStateKey).toBe("approved");
  });

  it("declined → label 'Declined', showCross", () => {
    const projected = projectVhcItem(baseCheck({ approval_status: "declined" }));
    const view = getDisplayStatus(projected);
    expect(view.label).toBe("Declined");
    expect(view.showCross).toBe(true);
  });

  it("completed → label 'Completed', showTick", () => {
    const projected = projectVhcItem(baseCheck({ approval_status: "completed" }));
    const view = getDisplayStatus(projected);
    expect(view.label).toBe("Completed");
    expect(view.showTick).toBe(true);
  });

  it("n/a → label 'N/A'", () => {
    const projected = projectVhcItem(baseCheck({ approval_status: "n/a" }));
    expect(getDisplayStatus(projected).label).toBe("N/A");
  });

  it("pending with no labour or parts → 'Add labour & parts'", () => {
    // buildVhcRowStatusView treats any defined labour_hours value (including 0) as "labour logged".
    // To genuinely express "no labour entered", labour_hours must be null/undefined/empty string.
    const projected = projectVhcItem(baseCheck({ approval_status: "pending", labour_hours: null, parts_cost: 0 }));
    expect(getDisplayStatus(projected).label).toBe("Add labour & parts");
  });
});

// ---------------------------------------------------------------------------
// getNextActions / isItemComplete
// ---------------------------------------------------------------------------

describe("getNextActions", () => {
  it("new → authorize + decline", () => {
    const projected = projectVhcItem(baseCheck({ approval_status: "pending" }), { job: { vhc_sent_at: null } });
    const actions = getNextActions(projected).map((a) => a.action);
    expect(actions).toEqual(["authorize", "decline"]);
  });

  it("approved → complete + reset", () => {
    const projected = projectVhcItem(baseCheck({ approval_status: "authorized" }));
    const actions = getNextActions(projected).map((a) => a.action);
    expect(actions).toEqual(["complete", "reset"]);
  });

  it("completed → reopen", () => {
    const projected = projectVhcItem(baseCheck({ approval_status: "completed" }));
    const actions = getNextActions(projected).map((a) => a.action);
    expect(actions).toEqual(["reopen"]);
  });
});

describe("isItemComplete", () => {
  it("true when workflow_status is completed", () => {
    expect(isItemComplete(projectVhcItem(baseCheck({ approval_status: "completed" })))).toBe(true);
  });
  it("false otherwise", () => {
    expect(isItemComplete(projectVhcItem(baseCheck({ approval_status: "authorized" })))).toBe(false);
    expect(isItemComplete(projectVhcItem(baseCheck({ approval_status: "pending" })))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyVhcDecision — argument validation only (cascade hits Supabase, not unit-tested here)
// ---------------------------------------------------------------------------

describe("applyVhcDecision", () => {
  it("throws when jobId is missing", async () => {
    await expect(applyVhcDecision({ vhcItemId: "v-1", targetDecision: "authorized" })).rejects.toThrow(/jobId/);
  });
  it("throws when vhcItemId is missing", async () => {
    await expect(applyVhcDecision({ jobId: "j-1", targetDecision: "authorized" })).rejects.toThrow(/vhcItemId/);
  });
});

// ---------------------------------------------------------------------------
// Tech-side job status helpers — links VHC engine to Next Jobs / Complete Job.
// Scenarios mirror the requirement spec:
//   1. Normal job completed (no authorised work) → COMPLETED, hides from next jobs.
//   2. Authorised VHC work outstanding → AUTHORISED_ITEMS, reappears in next jobs.
//   3. Clocking onto an AUTHORISED_ITEMS job uses Additional Work.
//   4. Completing the authorised work → COMPLETED, hides again.
//   5. Reload (i.e. just persisted state + items) keeps the correct status.
// ---------------------------------------------------------------------------

describe("hasOutstandingAuthorisedVhcWork", () => {
  it("false when no items", () => {
    expect(hasOutstandingAuthorisedVhcWork([])).toBe(false);
    expect(hasOutstandingAuthorisedVhcWork(null)).toBe(false);
  });

  it("false when all items are pending / awaiting customer", () => {
    const items = projectVhcItems(
      [baseCheck({ vhc_id: "a", approval_status: "pending" })],
      { job: { vhc_sent_at: "2026-04-28T09:00:00Z" } },
    );
    expect(hasOutstandingAuthorisedVhcWork(items)).toBe(false);
  });

  it("false when all authorised items are completed", () => {
    const items = projectVhcItems([
      baseCheck({ vhc_id: "a", approval_status: "authorized", Complete: true }),
      baseCheck({ vhc_id: "b", approval_status: "completed" }),
    ]);
    expect(hasOutstandingAuthorisedVhcWork(items)).toBe(false);
  });

  it("false when only declined items remain", () => {
    const items = projectVhcItems([baseCheck({ approval_status: "declined" })]);
    expect(hasOutstandingAuthorisedVhcWork(items)).toBe(false);
  });

  it("true when at least one authorised item is not complete", () => {
    const items = projectVhcItems([
      baseCheck({ vhc_id: "a", approval_status: "authorized", Complete: false }),
    ]);
    expect(hasOutstandingAuthorisedVhcWork(items)).toBe(true);
  });

  it("true for an in_progress authorised item with parts fitted but not Complete", () => {
    const items = projectVhcItems(
      [baseCheck({ vhc_id: "a", approval_status: "authorized", labour_hours: 1.0 })],
    );
    expect(hasOutstandingAuthorisedVhcWork(items)).toBe(true);
  });
});

describe("getJobTechStatusFromVhcItems", () => {
  it("returns IN_PROGRESS when tech has not pressed Complete Job", () => {
    const items = projectVhcItems([baseCheck({ approval_status: "authorized" })]);
    expect(getJobTechStatusFromVhcItems(items, { techHasCompletedMainWork: false }))
      .toBe(TECH_JOB_STATUS.IN_PROGRESS);
  });

  it("scenario 1 — normal job completed (no authorised work) → COMPLETED", () => {
    const items = projectVhcItems([baseCheck({ approval_status: "pending" })]);
    expect(getJobTechStatusFromVhcItems(items, { techHasCompletedMainWork: true }))
      .toBe(TECH_JOB_STATUS.COMPLETED);
  });

  it("scenario 2 — authorised VHC work outstanding → AUTHORISED_ITEMS", () => {
    const items = projectVhcItems([
      baseCheck({ vhc_id: "a", approval_status: "authorized", Complete: false }),
    ]);
    expect(getJobTechStatusFromVhcItems(items, { techHasCompletedMainWork: true }))
      .toBe(TECH_JOB_STATUS.AUTHORISED_ITEMS);
  });

  it("scenario 4 — completing all authorised work → COMPLETED", () => {
    const items = projectVhcItems([
      baseCheck({ vhc_id: "a", approval_status: "authorized", Complete: true }),
      baseCheck({ vhc_id: "b", approval_status: "completed" }),
    ]);
    expect(getJobTechStatusFromVhcItems(items, { techHasCompletedMainWork: true }))
      .toBe(TECH_JOB_STATUS.COMPLETED);
  });

  it("declined items alone do not block completion", () => {
    const items = projectVhcItems([baseCheck({ approval_status: "declined" })]);
    expect(getJobTechStatusFromVhcItems(items, { techHasCompletedMainWork: true }))
      .toBe(TECH_JOB_STATUS.COMPLETED);
  });
});

describe("getClockingWorkTypeForJob", () => {
  it("returns INITIAL when persisted status is null (fresh job)", () => {
    const items = projectVhcItems([baseCheck()]);
    expect(getClockingWorkTypeForJob({ vhcItems: items, currentTechStatus: null }))
      .toBe(CLOCKING_WORK_TYPE.INITIAL);
  });

  it("returns INITIAL when persisted status is tech_complete (job done)", () => {
    const items = projectVhcItems([baseCheck({ approval_status: "completed" })]);
    expect(getClockingWorkTypeForJob({ vhcItems: items, currentTechStatus: TECH_JOB_STATUS.COMPLETED }))
      .toBe(CLOCKING_WORK_TYPE.INITIAL);
  });

  it("scenario 3 — AUTHORISED_ITEMS + outstanding work → ADDITIONAL", () => {
    const items = projectVhcItems([
      baseCheck({ vhc_id: "a", approval_status: "authorized", Complete: false }),
    ]);
    expect(
      getClockingWorkTypeForJob({ vhcItems: items, currentTechStatus: TECH_JOB_STATUS.AUTHORISED_ITEMS }),
    ).toBe(CLOCKING_WORK_TYPE.ADDITIONAL);
  });

  it("AUTHORISED_ITEMS but items have since all completed → INITIAL (defensive)", () => {
    // If persisted status is stale but the item set has caught up, do not
    // force Additional Work — the tech is starting fresh on something else.
    const items = projectVhcItems([baseCheck({ approval_status: "authorized", Complete: true })]);
    expect(
      getClockingWorkTypeForJob({ vhcItems: items, currentTechStatus: TECH_JOB_STATUS.AUTHORISED_ITEMS }),
    ).toBe(CLOCKING_WORK_TYPE.INITIAL);
  });
});

// ---------------------------------------------------------------------------
// VHC Parts Authorised button/status helper — locks the mapping between a
// parts_job_items row and the badge rendered in the VHC tab so it cannot
// drift away from the Parts Added / Parts On Order panels.
// ---------------------------------------------------------------------------

describe("getPartAuthorisedDisplayStatus", () => {
  it("status='booked' → ADDED_TO_JOB (row is in the Parts Added panel)", () => {
    expect(getPartAuthorisedDisplayStatus({ status: "booked" }))
      .toBe(AUTHORISED_PART_STATUS.ADDED_TO_JOB);
  });

  it("status='on_order' → ON_ORDER (row is in the On Order panel)", () => {
    expect(getPartAuthorisedDisplayStatus({ status: "on_order" }))
      .toBe(AUTHORISED_PART_STATUS.ON_ORDER);
  });

  it("alias 'ordered' is treated as ON_ORDER", () => {
    expect(getPartAuthorisedDisplayStatus({ status: "ordered" }))
      .toBe(AUTHORISED_PART_STATUS.ON_ORDER);
  });

  it("status='removed' → REMOVED", () => {
    expect(getPartAuthorisedDisplayStatus({ status: "removed" }))
      .toBe(AUTHORISED_PART_STATUS.REMOVED);
  });

  it("authorised but no progress (status='pending' / null / unknown) → ORDER", () => {
    expect(getPartAuthorisedDisplayStatus({ status: "pending" })).toBe(AUTHORISED_PART_STATUS.ORDER);
    expect(getPartAuthorisedDisplayStatus({ status: null })).toBe(AUTHORISED_PART_STATUS.ORDER);
    expect(getPartAuthorisedDisplayStatus({ status: "" })).toBe(AUTHORISED_PART_STATUS.ORDER);
    expect(getPartAuthorisedDisplayStatus({})).toBe(AUTHORISED_PART_STATUS.ORDER);
    expect(getPartAuthorisedDisplayStatus(null)).toBe(AUTHORISED_PART_STATUS.ORDER);
  });

  it("downstream stages (pre_pick/stock/fitted) keep showing ADDED_TO_JOB", () => {
    expect(getPartAuthorisedDisplayStatus({ status: "pre_pick" })).toBe(AUTHORISED_PART_STATUS.ADDED_TO_JOB);
    expect(getPartAuthorisedDisplayStatus({ status: "picked" })).toBe(AUTHORISED_PART_STATUS.ADDED_TO_JOB);
    expect(getPartAuthorisedDisplayStatus({ status: "stock" })).toBe(AUTHORISED_PART_STATUS.ADDED_TO_JOB);
    expect(getPartAuthorisedDisplayStatus({ status: "fitted" })).toBe(AUTHORISED_PART_STATUS.ADDED_TO_JOB);
  });
});

describe("scenario 5 — reload preserves the correct status", () => {
  // Simulates: page reloads, reads jobs.tech_completion_status from DB,
  // re-projects vhc_checks, and re-derives the clocking work type. The
  // engine must give the same answer it did before the reload.
  it("authorised_items + outstanding items still yield ADDITIONAL after reload", () => {
    const persistedAfterReload = "authorised_items"; // Raw DB value.
    const itemsAfterReload = projectVhcItems([
      baseCheck({ vhc_id: "a", approval_status: "authorized", Complete: false }),
    ]);
    expect(
      getClockingWorkTypeForJob({ vhcItems: itemsAfterReload, currentTechStatus: persistedAfterReload }),
    ).toBe(CLOCKING_WORK_TYPE.ADDITIONAL);
    expect(hasOutstandingAuthorisedVhcWork(itemsAfterReload)).toBe(true);
  });

  it("tech_complete + nothing outstanding still yields COMPLETED after reload", () => {
    const persistedAfterReload = "tech_complete";
    const itemsAfterReload = projectVhcItems([
      baseCheck({ approval_status: "authorized", Complete: true }),
    ]);
    expect(hasOutstandingAuthorisedVhcWork(itemsAfterReload)).toBe(false);
    expect(
      getJobTechStatusFromVhcItems(itemsAfterReload, { techHasCompletedMainWork: true }),
    ).toBe(TECH_JOB_STATUS.COMPLETED);
    // Persisted tech_complete + no outstanding work → next clock-in is INITIAL.
    expect(
      getClockingWorkTypeForJob({ vhcItems: itemsAfterReload, currentTechStatus: persistedAfterReload }),
    ).toBe(CLOCKING_WORK_TYPE.INITIAL);
  });
});
