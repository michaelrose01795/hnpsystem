// file location: src/lib/dev-platform/activityAudit.test.js
import { describe, expect, it } from "vitest";
import {
  EXPECTED_DEV_ACTIONS,
  shapeActivity,
  activityCoverage,
  groupActivityByDay,
} from "@/lib/dev-platform/activityAudit";

describe("shapeActivity", () => {
  it("returns an empty array for non-array / empty input", () => {
    expect(shapeActivity()).toEqual([]);
    expect(shapeActivity(null)).toEqual([]);
    expect(shapeActivity("nope")).toEqual([]);
    expect(shapeActivity([])).toEqual([]);
  });

  it("normalises snake_case columns", () => {
    const [item] = shapeActivity([
      {
        id: "row-1",
        action: "dev_platform_view",
        actor_user_id: "u-1",
        actor_role: "admin",
        entity_type: "ticket",
        entity_id: "t-9",
        created_at: "2026-06-01T10:00:00Z",
      },
    ]);
    expect(item).toMatchObject({
      id: "row-1",
      action: "dev_platform_view",
      actorUserId: "u-1",
      actorRole: "admin",
      entityType: "ticket",
      entityId: "t-9",
      at: "2026-06-01T10:00:00Z",
    });
  });

  it("normalises camelCase columns", () => {
    const [item] = shapeActivity([
      {
        audit_id: "row-2",
        action: "dev_platform_session",
        actorUserId: "u-2",
        actorRole: "dev",
        entityType: "session",
        entityId: "s-1",
        createdAt: "2026-06-02T08:00:00Z",
      },
    ]);
    expect(item).toMatchObject({
      id: "row-2",
      actorUserId: "u-2",
      actorRole: "dev",
      entityType: "session",
      entityId: "s-1",
      at: "2026-06-02T08:00:00Z",
    });
  });

  it("defaults a missing action to 'unknown'", () => {
    const [item] = shapeActivity([{ id: "x" }]);
    expect(item.action).toBe("unknown");
    expect(item.category).toBe("Other");
    expect(item.at).toBeNull();
  });

  it("sorts newest-first by `at`", () => {
    const shaped = shapeActivity([
      { id: "a", action: "view", created_at: "2026-06-01T00:00:00Z" },
      { id: "c", action: "view", created_at: "2026-06-03T00:00:00Z" },
      { id: "b", action: "view", created_at: "2026-06-02T00:00:00Z" },
    ]);
    expect(shaped.map((i) => i.id)).toEqual(["c", "b", "a"]);
  });

  it("categorises actions by pattern", () => {
    const cat = (action) => shapeActivity([{ action, created_at: "2026-06-01T00:00:00Z" }])[0].category;
    expect(cat("dev_platform_session")).toBe("Session");
    expect(cat("ticket_view")).toBe("Access");
    expect(cat("read_detail")).toBe("Access");
    expect(cat("added_comment")).toBe("Comment");
    expect(cat("triage_bulk")).toBe("Triage");
    expect(cat("severity_change")).toBe("Triage");
    expect(cat("github_sync")).toBe("Integration");
    expect(cat("issue_link")).toBe("Integration");
    expect(cat("notification_preference")).toBe("Configuration");
    expect(cat("knowledge_base")).toBe("Configuration");
    // "saved_view" contains "view", and Access precedes Configuration in the ordered list.
    expect(cat("saved_view")).toBe("Access");
    expect(cat("something_else")).toBe("Other");
  });

  it("builds a summary from diff.action + status + count", () => {
    const [item] = shapeActivity([
      { action: "dev_platform_action", diff: { action: "bulk_update", status: "closed", count: 3 }, created_at: "2026-06-01T00:00:00Z" },
    ]);
    expect(item.summary).toBe("bulk update → closed (3)");
  });

  it("falls back to diff.kind when diff.action is absent", () => {
    const [item] = shapeActivity([
      { action: "dev_platform_action", diff: { kind: "saved_view" }, created_at: "2026-06-01T00:00:00Z" },
    ]);
    expect(item.summary).toBe("saved view");
  });

  it("falls back to the humanised action when there is no diff", () => {
    const [item] = shapeActivity([
      { action: "dev_platform_session", created_at: "2026-06-01T00:00:00Z" },
    ]);
    expect(item.summary).toBe("dev platform session");
  });
});

describe("EXPECTED_DEV_ACTIONS", () => {
  it("lists the audited dev platform action types", () => {
    expect(EXPECTED_DEV_ACTIONS).toEqual([
      "dev_platform_session",
      "dev_platform_view",
      "dev_platform_action",
    ]);
  });
});

describe("activityCoverage", () => {
  it("reports full coverage and byAction counts", () => {
    const rows = [
      { action: "dev_platform_session" },
      { action: "dev_platform_view" },
      { action: "dev_platform_view" },
      { action: "dev_platform_action" },
    ];
    const cov = activityCoverage(rows);
    expect(cov.covered.sort()).toEqual([...EXPECTED_DEV_ACTIONS].sort());
    expect(cov.missing).toEqual([]);
    expect(cov.complete).toBe(true);
    expect(cov.byAction).toEqual({
      dev_platform_session: 1,
      dev_platform_view: 2,
      dev_platform_action: 1,
    });
  });

  it("reports missing actions and incompleteness", () => {
    const cov = activityCoverage([{ action: "dev_platform_view" }]);
    expect(cov.covered).toEqual(["dev_platform_view"]);
    expect(cov.missing).toEqual(["dev_platform_session", "dev_platform_action"]);
    expect(cov.complete).toBe(false);
  });

  it("ignores rows without an action", () => {
    const cov = activityCoverage([{}, { action: null }, { action: "dev_platform_view" }]);
    expect(cov.byAction).toEqual({ dev_platform_view: 1 });
  });

  it("honours a custom expected list", () => {
    const cov = activityCoverage([{ action: "custom_one" }], ["custom_one", "custom_two"]);
    expect(cov.covered).toEqual(["custom_one"]);
    expect(cov.missing).toEqual(["custom_two"]);
    expect(cov.complete).toBe(false);
  });

  it("handles empty / non-array input", () => {
    const cov = activityCoverage();
    expect(cov.covered).toEqual([]);
    expect(cov.missing).toEqual([...EXPECTED_DEV_ACTIONS]);
    expect(cov.complete).toBe(false);
    expect(cov.byAction).toEqual({});
  });
});

describe("groupActivityByDay", () => {
  it("groups by the YYYY-MM-DD prefix of `at`, newest day first", () => {
    const activities = [
      { id: "a", at: "2026-06-01T09:00:00Z" },
      { id: "b", at: "2026-06-03T12:00:00Z" },
      { id: "c", at: "2026-06-01T18:00:00Z" },
      { id: "d", at: "2026-06-02T06:00:00Z" },
    ];
    const groups = groupActivityByDay(activities);
    expect(groups.map((g) => g.day)).toEqual(["2026-06-03", "2026-06-02", "2026-06-01"]);
    expect(groups.find((g) => g.day === "2026-06-01").items.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("returns an empty array for empty / non-array input", () => {
    expect(groupActivityByDay()).toEqual([]);
    expect(groupActivityByDay(null)).toEqual([]);
  });

  it("buckets items with no `at` under 'unknown'", () => {
    const groups = groupActivityByDay([{ id: "x" }, { id: "y", at: "" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].day).toBe("unknown");
    expect(groups[0].items.map((i) => i.id)).toEqual(["x", "y"]);
  });

  it("integrates with shapeActivity output", () => {
    const shaped = shapeActivity([
      { id: "a", action: "view", created_at: "2026-06-01T09:00:00Z" },
      { id: "b", action: "view", created_at: "2026-06-02T09:00:00Z" },
    ]);
    const groups = groupActivityByDay(shaped);
    expect(groups.map((g) => g.day)).toEqual(["2026-06-02", "2026-06-01"]);
  });
});
