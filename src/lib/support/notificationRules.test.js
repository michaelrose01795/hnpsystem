// file location: src/lib/support/notificationRules.test.js
import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_EVENTS,
  DEFAULT_NOTIFICATION_RULES,
  matchRule,
  describeEvent,
  buildNotifications,
} from "@/lib/support/notificationRules";

const rule = (over = {}) => ({
  owner_key: "u1",
  event: "report.critical",
  filters: {},
  channels: ["inapp"],
  enabled: true,
  ...over,
});

describe("constants", () => {
  it("exposes the known event types", () => {
    expect(NOTIFICATION_EVENTS).toEqual(
      expect.arrayContaining([
        "report.created",
        "report.critical",
        "report.regression",
        "report.assigned",
        "release.blocked",
        "release.approved",
      ])
    );
  });

  it("default rules fan out to everyone and are enabled", () => {
    expect(DEFAULT_NOTIFICATION_RULES.length).toBeGreaterThan(0);
    for (const r of DEFAULT_NOTIFICATION_RULES) {
      expect(r.owner_key).toBe("*");
      expect(r.enabled).toBe(true);
      expect(NOTIFICATION_EVENTS).toContain(r.event);
    }
  });
});

describe("matchRule — event type gating", () => {
  it("matches when rule.event equals event.type", () => {
    expect(matchRule(rule(), { type: "report.critical" })).toBe(true);
  });

  it("does not match a different event type", () => {
    expect(matchRule(rule(), { type: "report.created" })).toBe(false);
  });

  it("returns false for null rule / null event", () => {
    expect(matchRule(null, { type: "report.critical" })).toBe(false);
    expect(matchRule(rule(), null)).toBe(false);
    expect(matchRule(rule(), undefined)).toBe(false);
  });

  it("disabled rules never match", () => {
    expect(matchRule(rule({ enabled: false }), { type: "report.critical" })).toBe(false);
  });

  it("treats a missing enabled flag as enabled (only enabled === false disables)", () => {
    const r = rule();
    delete r.enabled;
    expect(matchRule(r, { type: "report.critical" })).toBe(true);
  });
});

describe("matchRule — minSeverity filter (info<low<medium<high<critical)", () => {
  const r = rule({ filters: { minSeverity: "high" } });

  it("passes when severity ranks >= minSeverity", () => {
    expect(matchRule(r, { type: "report.critical", severity: "high" })).toBe(true);
    expect(matchRule(r, { type: "report.critical", severity: "critical" })).toBe(true);
  });

  it("fails when severity ranks below minSeverity", () => {
    expect(matchRule(r, { type: "report.critical", severity: "medium" })).toBe(false);
    expect(matchRule(r, { type: "report.critical", severity: "low" })).toBe(false);
    expect(matchRule(r, { type: "report.critical", severity: "info" })).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(matchRule(r, { type: "report.critical", severity: "CRITICAL" })).toBe(true);
  });

  it("unknown/missing event severity ranks as 0 and fails a positive threshold", () => {
    expect(matchRule(r, { type: "report.critical" })).toBe(false);
    expect(matchRule(r, { type: "report.critical", severity: "bogus" })).toBe(false);
  });

  it("respects the full ordering info<low<medium<high<critical", () => {
    const order = ["info", "low", "medium", "high", "critical"];
    for (let i = 0; i < order.length; i++) {
      const gate = rule({ filters: { minSeverity: order[i] } });
      // everything at or above index i passes
      for (let j = 0; j < order.length; j++) {
        const expected = j >= i;
        expect(matchRule(gate, { type: "report.critical", severity: order[j] })).toBe(expected);
      }
    }
  });
});

describe("matchRule — category filter (string or array)", () => {
  it("matches a single-string category", () => {
    const r = rule({ filters: { category: "ui" } });
    expect(matchRule(r, { type: "report.critical", category: "ui" })).toBe(true);
    expect(matchRule(r, { type: "report.critical", category: "data" })).toBe(false);
  });

  it("matches when category is in an array", () => {
    const r = rule({ filters: { category: ["ui", "data"] } });
    expect(matchRule(r, { type: "report.critical", category: "data" })).toBe(true);
    expect(matchRule(r, { type: "report.critical", category: "auth" })).toBe(false);
  });

  it("compares by string value (coerces)", () => {
    const r = rule({ filters: { category: [1, 2] } });
    expect(matchRule(r, { type: "report.critical", category: 2 })).toBe(true);
    expect(matchRule(r, { type: "report.critical", category: "2" })).toBe(true);
  });
});

describe("matchRule — routePrefix filter", () => {
  const r = rule({ filters: { routePrefix: "/vhc" } });

  it("matches routes starting with the prefix", () => {
    expect(matchRule(r, { type: "report.critical", route: "/vhc/123" })).toBe(true);
    expect(matchRule(r, { type: "report.critical", route: "/vhc" })).toBe(true);
  });

  it("rejects routes not starting with the prefix", () => {
    expect(matchRule(r, { type: "report.critical", route: "/hr/leave" })).toBe(false);
    expect(matchRule(r, { type: "report.critical" })).toBe(false); // missing route -> "" -> no startsWith
  });
});

describe("matchRule — isRegression boolean filter", () => {
  it("matches only when the boolean equals event.isRegression", () => {
    const rTrue = rule({ filters: { isRegression: true } });
    const rFalse = rule({ filters: { isRegression: false } });
    expect(matchRule(rTrue, { type: "report.critical", isRegression: true })).toBe(true);
    expect(matchRule(rTrue, { type: "report.critical", isRegression: false })).toBe(false);
    expect(matchRule(rTrue, { type: "report.critical" })).toBe(false); // undefined -> false
    expect(matchRule(rFalse, { type: "report.critical", isRegression: false })).toBe(true);
    expect(matchRule(rFalse, { type: "report.critical" })).toBe(true); // falsy -> false
    expect(matchRule(rFalse, { type: "report.critical", isRegression: true })).toBe(false);
  });

  it("ignores the filter when it is not a boolean", () => {
    const r = rule({ filters: { isRegression: "yes" } });
    expect(matchRule(r, { type: "report.critical", isRegression: false })).toBe(true);
  });
});

describe("matchRule — assigneeKey filter", () => {
  const r = rule({ filters: { assigneeKey: "dev-7" } });

  it("matches only the named assignee (string-coerced)", () => {
    expect(matchRule(r, { type: "report.critical", assigneeKey: "dev-7" })).toBe(true);
    expect(matchRule(r, { type: "report.critical", assigneeKey: "dev-9" })).toBe(false);
  });

  it("does not match when the event has no assignee", () => {
    expect(matchRule(r, { type: "report.critical" })).toBe(false);
  });

  it("coerces numeric keys for comparison", () => {
    const rn = rule({ filters: { assigneeKey: 7 } });
    expect(matchRule(rn, { type: "report.critical", assigneeKey: "7" })).toBe(true);
  });
});

describe("matchRule — combined filters (AND semantics)", () => {
  const r = rule({ filters: { minSeverity: "high", category: "ui", routePrefix: "/vhc" } });
  it("requires every filter to pass", () => {
    expect(
      matchRule(r, { type: "report.critical", severity: "critical", category: "ui", route: "/vhc/1" })
    ).toBe(true);
    // one failing filter fails the whole rule
    expect(
      matchRule(r, { type: "report.critical", severity: "low", category: "ui", route: "/vhc/1" })
    ).toBe(false);
    expect(
      matchRule(r, { type: "report.critical", severity: "critical", category: "data", route: "/vhc/1" })
    ).toBe(false);
    expect(
      matchRule(r, { type: "report.critical", severity: "critical", category: "ui", route: "/hr" })
    ).toBe(false);
  });
});

describe("describeEvent", () => {
  it("report.created → info severity", () => {
    const d = describeEvent({ type: "report.created", category: "ui", route: "/vhc", title: "Boom" });
    expect(d.severity).toBe("info");
    expect(d.title).toContain("Boom");
    expect(d.body).toContain("ui");
    expect(d.body).toContain("/vhc");
  });

  it("report.critical → critical severity", () => {
    const d = describeEvent({ type: "report.critical", severity: "critical", route: "/hr", title: "Down" });
    expect(d.severity).toBe("critical");
    expect(d.title).toContain("Critical");
    expect(d.title).toContain("Down");
    expect(d.body).toContain("CRITICAL"); // severity uppercased into body
  });

  it("report.regression → warning severity, mentions first-seen version", () => {
    const d = describeEvent({ type: "report.regression", title: "Loop", firstSeenVersion: "v1.2.0" });
    expect(d.severity).toBe("warning");
    expect(d.title).toContain("Regression");
    expect(d.body).toContain("v1.2.0");
  });

  it("report.assigned → info severity, personalised title", () => {
    const d = describeEvent({ type: "report.assigned", title: "Fix me", route: "/parts" });
    expect(d.severity).toBe("info");
    expect(d.title).toContain("Assigned to you");
    expect(d.body).toContain("/parts");
  });

  it("release.blocked → critical severity with score", () => {
    const d = describeEvent({ type: "release.blocked", releaseKey: "R-42", score: 55 });
    expect(d.severity).toBe("critical");
    expect(d.title).toContain("R-42");
    expect(d.body).toContain("55");
  });

  it("release.approved → success severity, names the approver", () => {
    const d = describeEvent({ type: "release.approved", releaseKey: "R-9", approverKey: "lead-1" });
    expect(d.severity).toBe("success");
    expect(d.title).toContain("R-9");
    expect(d.body).toContain("lead-1");
  });

  it("falls back to a subject when route/title are absent", () => {
    const d = describeEvent({ type: "report.created" });
    expect(d.title).toContain("a report");
  });

  it("unknown event type → info default", () => {
    const d = describeEvent({ type: "mystery", title: "Huh", body: "raw body" });
    expect(d.severity).toBe("info");
    expect(d.title).toBe("Huh");
    expect(d.body).toBe("raw body");
  });

  it("tolerates being called with no argument", () => {
    const d = describeEvent();
    expect(d).toHaveProperty("severity");
    expect(d).toHaveProperty("title");
    expect(d).toHaveProperty("body");
  });
});

describe("buildNotifications — fan-out and de-dupe", () => {
  it("fans a '*' rule out to every recipient", () => {
    const rules = [rule({ owner_key: "*", channels: ["inapp"] })];
    const rows = buildNotifications(
      { type: "report.critical", severity: "critical" },
      rules,
      { recipients: ["a", "b", "c"] }
    );
    expect(rows.map((r) => r.owner_key).sort()).toEqual(["a", "b", "c"]);
    for (const r of rows) {
      expect(r.kind).toBe("report.critical");
      expect(r.severity).toBe("critical");
      expect(r.channels).toEqual(["inapp"]);
    }
  });

  it("targets a concrete owner_key directly (no recipients needed)", () => {
    const rows = buildNotifications(
      { type: "report.critical", severity: "critical" },
      [rule({ owner_key: "solo" })]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].owner_key).toBe("solo");
  });

  it("de-dupes per recipient and merges channels across matching rules", () => {
    const rules = [
      rule({ owner_key: "a", channels: ["inapp"] }),
      rule({ owner_key: "a", channels: ["email"] }),
      rule({ owner_key: "*", channels: ["push"] }),
    ];
    const rows = buildNotifications(
      { type: "report.critical", severity: "critical" },
      rules,
      { recipients: ["a", "b"] }
    );
    const byKey = Object.fromEntries(rows.map((r) => [r.owner_key, r]));
    // "a" appears once, with all three channels merged
    expect(rows.filter((r) => r.owner_key === "a")).toHaveLength(1);
    expect(byKey.a.channels.sort()).toEqual(["email", "inapp", "push"]);
    expect(byKey.b.channels).toEqual(["push"]);
  });

  it("skips rules that do not match the event", () => {
    const rules = [
      rule({ owner_key: "a", event: "report.created" }),
      rule({ owner_key: "b", event: "report.critical" }),
    ];
    const rows = buildNotifications({ type: "report.critical", severity: "critical" }, rules);
    expect(rows.map((r) => r.owner_key)).toEqual(["b"]);
  });

  it("ignores empty/falsy recipient keys from a '*' fan-out", () => {
    const rows = buildNotifications(
      { type: "report.critical", severity: "critical" },
      [rule({ owner_key: "*" })],
      { recipients: ["a", "", null, undefined] }
    );
    expect(rows.map((r) => r.owner_key)).toEqual(["a"]);
  });

  it("defaults channels to ['inapp'] when a matching rule carries none", () => {
    const rows = buildNotifications(
      { type: "report.critical", severity: "critical" },
      [rule({ owner_key: "a", channels: [] })]
    );
    expect(rows[0].channels).toEqual(["inapp"]);
  });

  it("returns [] when nothing matches", () => {
    expect(
      buildNotifications({ type: "release.approved" }, [rule({ event: "report.critical" })])
    ).toEqual([]);
  });

  it("carries event body/link/entity fields onto the row", () => {
    const rows = buildNotifications(
      {
        type: "report.critical",
        severity: "critical",
        body: "custom body",
        link: "/dev/support-reports/9",
        entityType: "report",
        entityId: 9,
      },
      [rule({ owner_key: "a" })]
    );
    expect(rows[0].body).toBe("custom body");
    expect(rows[0].link).toBe("/dev/support-reports/9");
    expect(rows[0].entity_type).toBe("report");
    expect(rows[0].entity_id).toBe("9"); // coerced to string
  });
});

describe("buildNotifications — report.assigned only targets the assignee", () => {
  it("drops all non-assignee recipients even via a '*' rule", () => {
    const rows = buildNotifications(
      { type: "report.assigned", assigneeKey: "dev-7", title: "Fix" },
      [rule({ owner_key: "*", event: "report.assigned", channels: ["inapp"] })],
      { recipients: ["dev-1", "dev-7", "dev-9"] }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].owner_key).toBe("dev-7");
    expect(rows[0].kind).toBe("report.assigned");
  });

  it("drops a concrete-owner rule that is not the assignee", () => {
    const rows = buildNotifications(
      { type: "report.assigned", assigneeKey: "dev-7" },
      [rule({ owner_key: "dev-1", event: "report.assigned" })]
    );
    expect(rows).toEqual([]);
  });

  it("keeps a concrete-owner rule that matches the assignee", () => {
    const rows = buildNotifications(
      { type: "report.assigned", assigneeKey: "dev-7" },
      [rule({ owner_key: "dev-7", event: "report.assigned" })]
    );
    expect(rows.map((r) => r.owner_key)).toEqual(["dev-7"]);
  });

  it("does not restrict recipients when the assigned event has no assigneeKey", () => {
    const rows = buildNotifications(
      { type: "report.assigned" },
      [rule({ owner_key: "*", event: "report.assigned" })],
      { recipients: ["a", "b"] }
    );
    expect(rows.map((r) => r.owner_key).sort()).toEqual(["a", "b"]);
  });
});
