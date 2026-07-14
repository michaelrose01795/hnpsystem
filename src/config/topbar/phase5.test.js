// file location: src/config/topbar/phase5.test.js
//
// Phase 5 — coverage for the pure intelligent-assistance modules: operational
// trends (5.1), predictive recommendations (5.1), workload balancing (5.2),
// proactive alerts (5.3), smart reminders (5.4), workflow automation (5.5), the
// assistant assembler + guidance (5.6) and the behaviour model (5.7). UI + hooks
// are excluded (they only wire these pure modules together).

import { describe, it, expect } from "vitest";
import {
  deriveTrends,
  trendFor,
  isRising,
  isFalling,
  movementLabel,
} from "@/config/topbar/operationalTrends";
import { buildRecommendations, topRecommendation } from "@/config/topbar/recommendations";
import { buildWorkloadBalancing, canBalanceWorkload } from "@/config/topbar/workloadBalancing";
import { resolveAlerts, topAlert, summariseAlerts } from "@/config/topbar/operationalAlerts";
import { buildSmartReminders, countSmartReminders } from "@/config/topbar/smartReminders";
import { resolveWorkflow } from "@/config/topbar/workflowAutomation";
import {
  emptyModel,
  normaliseModel,
  recordVisit,
  rankActions,
  scoreEntry,
  trackedCount,
} from "@/config/topbar/behaviourModel";
import { buildAssistant, contextualGuidance } from "@/config/topbar/assistant";

describe("operationalTrends", () => {
  it("derives direction, delta and window movement from a rolling history", () => {
    const history = [
      { jobsWaiting: 2, overdueJobs: 0 },
      { jobsWaiting: 4, overdueJobs: 0 },
      { jobsWaiting: 6, overdueJobs: 1 },
    ];
    const trends = deriveTrends(history);
    const q = trendFor(trends, "jobsWaiting");
    expect(q.current).toBe(6);
    expect(q.previous).toBe(4);
    expect(q.first).toBe(2);
    expect(q.delta).toBe(2);
    expect(q.windowDelta).toBe(4);
    expect(q.direction).toBe("up");
    expect(q.rising).toBe(true);
    expect(isRising(trends, "jobsWaiting", 2)).toBe(true);
    expect(movementLabel(trends, "jobsWaiting")).toBe("4 → 6");
  });

  it("is empty-safe and skips absent samples rather than reading them as zero", () => {
    expect(deriveTrends(null).count).toBe(0);
    expect(trendFor(undefined, "jobsWaiting").current).toBeNull();
    // A poll where techniciansAvailable errored (absent) must not look like a drop.
    const trends = deriveTrends([
      { techniciansAvailable: 3 },
      { jobsWaiting: 1 }, // techniciansAvailable absent this sample
      { techniciansAvailable: 1 },
    ]);
    const cap = trendFor(trends, "techniciansAvailable");
    expect(cap.current).toBe(1);
    expect(cap.previous).toBe(3); // compares 3 → 1, ignoring the gap
    expect(isFalling(trends, "techniciansAvailable", 1)).toBe(true);
  });
});

describe("recommendations", () => {
  it("ranks a rising overdue trend as high-confidence and explains it", () => {
    const trends = deriveTrends([{ overdueJobs: 2 }, { overdueJobs: 5 }]);
    const recs = buildRecommendations({
      metrics: { overdueJobs: 5 },
      trends,
      roles: ["workshop manager"],
    });
    const overdue = recs.find((r) => r.id === "recommend:review-overdue");
    expect(overdue).toBeTruthy();
    expect(overdue.confidence).toBe("high");
    expect(overdue.source).toBe("trend");
    expect(overdue.reason).toMatch(/climbing/);
    expect(recs[0].id).toBe("recommend:review-overdue"); // strongest first
  });

  it("role-gates parts recommendations and drops the current page", () => {
    const notParts = buildRecommendations({
      metrics: { partsOutstanding: 9 },
      roles: ["techs"],
    });
    expect(notParts.some((r) => r.id === "recommend:book-parts")).toBe(false);
    const parts = buildRecommendations({
      metrics: { partsOutstanding: 9 },
      roles: ["parts"],
    });
    expect(parts.some((r) => r.id === "recommend:book-parts")).toBe(true);
    // Already on /nextjobs → the queue rec for that page is dropped.
    const onQueue = buildRecommendations({
      metrics: { jobsWaiting: 6 },
      roles: ["workshop manager"],
      pathname: "/nextjobs",
    });
    expect(onQueue.every((r) => r.href !== "/nextjobs")).toBe(true);
  });

  it("personalises from the on-device behaviour model, ranked below live work", () => {
    const recs = buildRecommendations({
      metrics: {},
      roles: ["service"],
      behaviour: { topActions: [{ href: "/reports/overview", label: "Overview report", count: 8 }] },
    });
    const habit = recs.find((r) => r.source === "behaviour");
    expect(habit).toBeTruthy();
    expect(habit.href).toBe("/reports/overview");
    expect(topRecommendation({ metrics: {}, roles: [] })).toBeNull();
  });
});

describe("workloadBalancing", () => {
  it("gates on managers and controllers", () => {
    expect(canBalanceWorkload(["techs"])).toBe(false);
    expect(canBalanceWorkload(["workshop manager"])).toBe(true);
    expect(canBalanceWorkload(["workshop controller"])).toBe(true);
    expect(buildWorkloadBalancing({ roles: ["techs"] }).isEligible).toBe(false);
  });

  it("computes utilisation and proposes assigning waiting work to free techs", () => {
    const res = buildWorkloadBalancing({
      roles: ["workshop manager"],
      metrics: { jobsWaiting: 3, techniciansAvailable: 2, techniciansOnJobs: 6, techniciansTotal: 8 },
      department: "workshop",
      myDepartment: { members: [{ id: 5, name: "Sam", roleLabel: "Tech", available: true, isSelf: false }] },
      presence: { departments: [] },
    });
    expect(res.isEligible).toBe(true);
    expect(res.utilisation.total).toBe(8);
    expect(res.utilisation.label).toBe("75% of the team utilised");
    expect(res.suggestions.some((s) => /Assign 3 waiting/.test(s.label))).toBe(true);
    // The free member is named + messageable.
    expect(res.suggestions.some((s) => s.memberId === 5)).toBe(true);
  });

  it("reaches into another department for help when local capacity is zero", () => {
    const res = buildWorkloadBalancing({
      roles: ["workshop controller"],
      metrics: { jobsWaiting: 4, techniciansAvailable: 0 },
      department: "workshop",
      presence: {
        departments: [
          { code: "workshop", name: "Workshop", available: 0, working: 3 },
          { code: "mot", name: "MOT", available: 2, working: 1 },
        ],
      },
    });
    const borrow = res.suggestions.find((s) => s.id === "balance:borrow:mot");
    expect(borrow).toBeTruthy();
    expect(borrow.deptCode).toBe("mot");
    expect(borrow.label).toMatch(/Pull in help from MOT/);
  });

  it("redistributes overdue work first by priority", () => {
    const res = buildWorkloadBalancing({
      roles: ["service manager"],
      metrics: { jobsWaiting: 0, overdueJobs: 2, techniciansAvailable: 1 },
      department: "service",
      presence: { departments: [] },
    });
    expect(res.suggestions[0].id).toBe("balance:overdue");
  });
});

describe("operationalAlerts", () => {
  it("flags a current-state bottleneck as critical and ranks it first", () => {
    const alerts = resolveAlerts({
      metrics: { jobsWaiting: 4, techniciansAvailable: 0, overdueJobs: 1 },
    });
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].kind).toBe("bottleneck");
    expect(alerts[0].predictive).toBe(false);
  });

  it("raises PREDICTIVE alerts before a threshold is breached", () => {
    const trends = deriveTrends([{ waitingApprovals: 1 }, { waitingApprovals: 2 }]);
    const alerts = resolveAlerts({ metrics: { waitingApprovals: 2 }, trends });
    const emerging = alerts.find((a) => a.id === "alert:approvals-emerging");
    expect(emerging).toBeTruthy();
    expect(emerging.predictive).toBe(true);
    expect(emerging.detail).toMatch(/rising/);
  });

  it("orders a live problem before a forecast of the same severity", () => {
    // overdue rising 3→5 fires overdue-critical (current) — capacity emerging is high.
    const trends = deriveTrends([{ overdueJobs: 3, techniciansAvailable: 3 }, { overdueJobs: 5, techniciansAvailable: 1 }]);
    const alerts = resolveAlerts({ metrics: { overdueJobs: 5, techniciansAvailable: 1, jobsWaiting: 2 }, trends });
    expect(alerts[0].predictive).toBe(false); // critical current-state overdue leads
    const summary = summariseAlerts(alerts);
    expect(summary.critical).toBeGreaterThanOrEqual(1);
    expect(summary.predictive).toBeGreaterThanOrEqual(1);
  });

  it("role-gates parts alerts and is empty-safe", () => {
    expect(resolveAlerts({ metrics: { partsOutstanding: 10 }, roles: ["techs"] }).some((a) => a.kind === "parts")).toBe(false);
    expect(topAlert({ metrics: {}, roles: [] })).toBeNull();
  });
});

describe("smartReminders", () => {
  it("auto-surfaces deadline/incomplete/appointment reminders ranked by urgency", () => {
    const list = buildSmartReminders({
      metrics: { overdueJobs: 2, waitingApprovals: 1, appointmentsToday: 4 },
      roles: ["service manager"],
    });
    expect(list[0].kind).toBe("deadline"); // overdue update leads
    expect(list.some((r) => r.kind === "appointment")).toBe(true);
    expect(list.some((r) => r.id === "smart:approvals-followup")).toBe(true);
    expect(countSmartReminders({ metrics: { overdueJobs: 2, appointmentsToday: 4 } })).toBe(2);
  });

  it("role-gates parts reminders and folds in the manual open-reminder nudge last", () => {
    const notParts = buildSmartReminders({ metrics: { partsOutstanding: 3 }, roles: ["techs"] });
    expect(notParts.some((r) => r.id === "smart:parts-to-book")).toBe(false);
    const withManual = buildSmartReminders({
      metrics: { overdueJobs: 1 },
      roles: ["service"],
      manualOutstanding: 3,
    });
    const manual = withManual.find((r) => r.id === "smart:manual-open");
    expect(manual).toBeTruthy();
    expect(manual.href).toBeNull();
    expect(withManual[withManual.length - 1].id).toBe("smart:manual-open"); // lowest priority
    // The manual nudge is excluded from the auto-count.
    expect(countSmartReminders({ metrics: { overdueJobs: 1 }, manualOutstanding: 3 })).toBe(1);
  });
});

describe("workflowAutomation", () => {
  it("surfaces the page-contextual flow on a job card, outranking state flows", () => {
    const flow = resolveWorkflow({
      pathname: "/job-cards/1234",
      roles: ["workshop manager"],
      metrics: { jobsWaiting: 5 },
    });
    expect(flow.id).toBe("progress-job");
    expect(flow.steps[0].id).toBe("progress-job:vhc");
    expect(flow.steps.every((s) => s.id.startsWith("progress-job:"))).toBe(true);
  });

  it("picks an operational-state flow and interpolates + conditionally includes steps", () => {
    const flow = resolveWorkflow({
      pathname: "/dashboard",
      roles: ["workshop manager"],
      metrics: { jobsWaiting: 4, overdueJobs: 2 },
    });
    expect(flow.id).toBe("allocate-queue");
    expect(flow.steps.find((s) => s.id === "allocate-queue:open").label).toMatch(/4-job queue/);
    // The overdue step only appears because overdueJobs > 0.
    expect(flow.steps.some((s) => s.id === "allocate-queue:overdue")).toBe(true);
    const noOverdue = resolveWorkflow({ pathname: "/dashboard", roles: ["workshop manager"], metrics: { jobsWaiting: 4 } });
    expect(noOverdue.steps.some((s) => s.id === "allocate-queue:overdue")).toBe(false);
  });

  it("marks a step done from live signal and always falls back to a day-start flow", () => {
    const flow = resolveWorkflow({
      pathname: "/dashboard",
      roles: ["service"],
      metrics: { waitingApprovals: 0 },
    });
    // No state flow fires for a plain service user with nothing waiting → day-start.
    expect(flow.id).toBe("day-start");
    const approvals = resolveWorkflow({ pathname: "/dashboard", roles: ["service"], metrics: { waitingApprovals: 2 } });
    expect(approvals.id).toBe("clear-approvals");
    expect(approvals.steps.find((s) => s.id === "clear-approvals:review").done).toBe(false);
  });
});

describe("behaviourModel", () => {
  const HALF = 1000;

  it("records visits, increments counts and ranks by frequency (min 2 visits)", () => {
    let m = emptyModel();
    m = recordVisit(m, { href: "/reports/overview", label: "Overview", ts: 0 }, { halfLifeMs: HALF });
    m = recordVisit(m, { href: "/reports/overview", label: "Overview", ts: 10 }, { halfLifeMs: HALF });
    m = recordVisit(m, { href: "/nextjobs", label: "Next jobs", ts: 10 }, { halfLifeMs: HALF });
    expect(m.counts["/reports/overview"].count).toBe(2);
    const ranked = rankActions(m, { now: 10, halfLifeMs: HALF });
    // Only the twice-visited page qualifies (min 2), single visit filtered out.
    expect(ranked).toHaveLength(1);
    expect(ranked[0].href).toBe("/reports/overview");
    expect(trackedCount(m)).toBe(2);
  });

  it("decays a stale habit so recent use outranks an older, more frequent one", () => {
    let m = emptyModel();
    // Old page: 4 visits but long ago (10 half-lives => weight ~4/1024).
    m = recordVisit(m, { href: "/old", label: "Old", ts: 0 }, { halfLifeMs: HALF });
    m.counts["/old"].count = 4;
    // Fresh page: 2 recent visits.
    m = recordVisit(m, { href: "/fresh", label: "Fresh", ts: 10000 }, { halfLifeMs: HALF });
    m = recordVisit(m, { href: "/fresh", label: "Fresh", ts: 10000 }, { halfLifeMs: HALF });
    const ranked = rankActions(m, { now: 10000, halfLifeMs: HALF });
    expect(ranked[0].href).toBe("/fresh"); // recency beats stale frequency
    expect(scoreEntry(m.counts["/old"], 10000, HALF)).toBeLessThan(scoreEntry(m.counts["/fresh"], 10000, HALF));
  });

  it("caps distinct entries, evicting the weakest, and normalises corrupt blobs", () => {
    let m = emptyModel();
    for (let i = 0; i < 5; i++) m = recordVisit(m, { href: `/p${i}`, ts: i }, { max: 3, halfLifeMs: HALF });
    expect(trackedCount(m)).toBe(3); // capped
    expect(normaliseModel({ counts: { "/x": { count: "nope" } } }).counts).toEqual({});
    expect(normaliseModel(null).version).toBe(1);
  });
});

describe("assistant (assembler + guidance)", () => {
  it("gives a page-aware guidance tip plus the always-on discovery tip", () => {
    const tips = contextualGuidance({ pathname: "/vhc/123", roles: ["techs"] });
    expect(tips[0].id).toBe("guidance:on-vhc");
    expect(tips.some((t) => t.id === "guidance:shortcut")).toBe(true);
    // No page rule → still returns the discovery tip.
    const bare = contextualGuidance({ pathname: "/", roles: [] });
    expect(bare.some((t) => t.id === "guidance:shortcut")).toBe(true);
  });

  it("assembles ranked sections, dropping empties but keeping guidance", () => {
    const assistant = buildAssistant({
      alerts: [{ id: "alert:overdue-critical", title: "5 jobs overdue", severityLabel: "Critical", detail: "chase now", tone: "danger", href: "/job-cards", audience: "workshop", predictive: false }],
      recommendations: [{ id: "recommend:allocate-queue", label: "Allocate 4 waiting jobs", reason: "Queue building", tone: "warning", href: "/nextjobs" }],
      workflow: { id: "allocate-queue", title: "Allocate the queue", icon: "🗂", steps: [{ id: "allocate-queue:open", label: "Open queue", href: "/nextjobs", done: false }] },
      smartReminders: [],
      balancing: { isEligible: false, suggestions: [] },
      pathname: "/dashboard",
      roles: ["workshop manager"],
    });
    const ids = assistant.sections.map((s) => s.id);
    expect(ids[0]).toBe("assistant-alerts"); // alerts lead
    expect(ids).toContain("assistant-recommendations");
    expect(ids).toContain("assistant-workflow");
    expect(ids).not.toContain("assistant-reminders"); // empty dropped
    expect(ids).not.toContain("assistant-balancing"); // not eligible dropped
    expect(ids).toContain("assistant-guidance"); // always kept
    // Headline surfaces the top alert; alert item carries a message audience.
    expect(assistant.headline.text).toBe("5 jobs overdue");
    expect(assistant.counts.total).toBe(2);
    const alertItem = assistant.sections[0].items[0];
    expect(alertItem.messageAudience).toBe("workshop");
  });

  it("includes the balancing section only when eligible, and headlines 'all clear' when idle", () => {
    const eligible = buildAssistant({
      balancing: { isEligible: true, utilisation: { label: "80% of the team utilised", tone: "warning" }, suggestions: [{ id: "balance:assign", label: "Assign 2 to 1 free", tone: "info", href: "/nextjobs" }] },
    });
    expect(eligible.sections.some((s) => s.id === "assistant-balancing")).toBe(true);
    expect(eligible.sections.find((s) => s.id === "assistant-balancing").title).toMatch(/80%/);
    const idle = buildAssistant({ alerts: [], recommendations: [] });
    expect(idle.headline.text).toMatch(/All clear/);
    expect(idle.headline.tone).toBe("success");
  });
});
