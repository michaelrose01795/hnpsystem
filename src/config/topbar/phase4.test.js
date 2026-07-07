// file location: src/config/topbar/phase4.test.js
//
// Phase 4 — coverage for the pure collaborative-workspace modules: availability
// states (4.2), team presence (4.1), department activity (4.3), communication
// shortcuts (4.4), escalations (4.5), manager tools (4.6) and cross-department
// coordination (4.7). UI + hooks are excluded (they only wire these together).

import { describe, it, expect } from "vitest";
import {
  getAvailabilityState,
  resolveAvailabilityState,
  isAvailableState,
  selectableStates,
  availabilityFromLegacyStatus,
} from "@/config/topbar/availabilityStates";
import { buildTeamPresence, toTeamMembers, summariseGroup } from "@/config/topbar/teamPresence";
import { deriveActivityEvents } from "@/config/topbar/departmentActivity";
import {
  messageUserHref,
  messageGroupHref,
  memberContactAction,
  departmentContactAction,
} from "@/config/topbar/communicationShortcuts";
import { resolveEscalations, topEscalation } from "@/config/topbar/escalations";
import { buildManagerTools, isManagerRole } from "@/config/topbar/managerTools";
import { resolveCoordinationLinks } from "@/config/topbar/crossDepartment";

describe("availabilityStates", () => {
  it("resolves known + unknown ids and maps legacy status", () => {
    expect(getAvailabilityState("break").short).toBe("On break");
    expect(getAvailabilityState("nope")).toBeNull();
    expect(resolveAvailabilityState("nope").id).toBe("available"); // never null
    expect(isAvailableState("available")).toBe(true);
    expect(isAvailableState("working")).toBe(false);
    expect(availabilityFromLegacyStatus("Tea Break")).toBe("break");
    expect(availabilityFromLegacyStatus("In Progress")).toBe("working");
    expect(availabilityFromLegacyStatus("Waiting for Job")).toBe("available");
  });

  it("excludes the derived-only offline state from the self picker", () => {
    expect(selectableStates().some((s) => s.id === "offline")).toBe(false);
    expect(selectableStates().some((s) => s.id === "road-test")).toBe(true);
  });
});

describe("teamPresence", () => {
  const users = [
    { id: 1, name: "Alice", role: "Techs" },
    { id: 2, name: "Bob", role: "Techs" },
    { id: 3, name: "Cara", role: "Parts" },
    { id: 9, name: "Customer X", role: "Customer" }, // unmapped → excluded
  ];

  it("maps roster to staff, dropping unmapped roles", () => {
    const members = toTeamMembers(users);
    expect(members).toHaveLength(3);
    expect(members.find((m) => m.id === 9)).toBeUndefined();
    expect(members.find((m) => m.id === 1).department).toBe("workshop");
  });

  it("derives working (live) vs available (roster) and groups by department", () => {
    const res = buildTeamPresence({ users, working: [{ userId: 2, jobNumber: "123" }], selfId: 1 });
    const workshop = res.departments.find((d) => d.code === "workshop");
    expect(workshop.total).toBe(2);
    expect(workshop.working).toBe(1);
    expect(workshop.available).toBe(1);
    // Self surfaces first and is available; Bob is working with his job number.
    expect(res.self.id).toBe(1);
    expect(res.self.available).toBe(true);
    expect(res.byId.get(2).working).toBe(true);
    expect(res.byId.get(2).jobNumber).toBe("123");
    expect(res.totals.total).toBe(3);
  });

  it("lets a self-declared state win over the live signal", () => {
    const res = buildTeamPresence({
      users: [{ id: 1, name: "A", role: "Techs" }],
      working: [{ userId: 1 }], // clocked in…
      selfId: 1,
      selfAvailabilityId: "break", // …but declared on break
    });
    expect(res.self.availabilityId).toBe("break");
    expect(res.self.available).toBe(false);
  });

  it("is suppressed in the presentation shell and summarises a group", () => {
    expect(buildTeamPresence({ users, isPresentation: true }).departments).toEqual([]);
    const res = buildTeamPresence({ users, working: [{ userId: 2 }], selfId: 1 });
    expect(summariseGroup(res.departments.find((d) => d.code === "workshop"))).toBe(
      "1 available · 1 working"
    );
  });
});

describe("departmentActivity", () => {
  it("needs a baseline and derives metric movement", () => {
    const next = { metrics: { jobsInProgress: 4, appointmentsToday: 3 }, presenceById: new Map() };
    expect(deriveActivityEvents(null, next, { ts: 1 })).toEqual([]);
    const prev = { metrics: { jobsInProgress: 5, appointmentsToday: 2 }, presenceById: new Map() };
    const events = deriveActivityEvents(prev, next, { ts: 100 });
    expect(events.some((e) => e.kind === "job-complete")).toBe(true); // 5 → 4
    expect(events.some((e) => e.kind === "appointment")).toBe(true); // 2 → 3
  });

  it("derives per-person presence transitions (became available)", () => {
    const prevP = new Map([[1, { id: 1, name: "A", availabilityId: "working", working: true, available: false }]]);
    const nextP = new Map([[1, { id: 1, name: "A", availabilityId: "available", working: false, available: true }]]);
    const ev = deriveActivityEvents(
      { metrics: {}, presenceById: prevP },
      { metrics: {}, presenceById: nextP },
      { ts: 1 }
    );
    expect(ev.some((e) => e.kind === "presence-available")).toBe(true);
  });
});

describe("communicationShortcuts", () => {
  it("builds direct + group message hrefs", () => {
    expect(messageUserHref(7)).toBe("/messages?to=7");
    expect(messageUserHref(null)).toBeNull();
    expect(messageGroupHref([1, 2], "Workshop team")).toContain("compose=group");
    expect(messageGroupHref([])).toBeNull();
    expect(memberContactAction({ id: 5, name: "Bob" }).href).toBe("/messages?to=5");
  });

  it("falls back to a DM when a department has a single member", () => {
    const action = departmentContactAction({
      code: "parts",
      name: "Parts",
      members: [{ id: 3, name: "Cara" }],
    });
    expect(action.href).toBe("/messages?to=3");
  });
});

describe("escalations", () => {
  it("ranks by severity and role-gates department rules", () => {
    const list = resolveEscalations({ metrics: { overdueJobs: 6 }, roles: ["workshop manager"] });
    expect(list[0].severity).toBe("critical");
    expect(list[0].id).toContain("overdue-critical");
    // Parts rule must not fire for a non-parts role.
    const noParts = resolveEscalations({ metrics: { partsOutstanding: 10 }, roles: ["techs"] });
    expect(noParts.some((e) => e.id.includes("parts-outstanding"))).toBe(false);
    expect(topEscalation({ metrics: {}, roles: [] })).toBeNull();
  });
});

describe("managerTools", () => {
  it("gates on manager roles and builds three sections", () => {
    expect(isManagerRole(["techs"])).toBe(false);
    expect(isManagerRole(["workshop manager"])).toBe(true);
    expect(buildManagerTools({ roles: ["techs"] }).isManager).toBe(false);
    const mgr = buildManagerTools({
      roles: ["workshop manager"],
      presence: { departments: [], totals: { total: 0, available: 0, working: 0 } },
      metrics: { jobsWaiting: 2, techniciansAvailable: 1 },
      department: "workshop",
      myDepartment: null,
    });
    expect(mgr.isManager).toBe(true);
    expect(mgr.sections).toHaveLength(3);
    const balancing = mgr.sections.find((s) => s.id === "manager-balancing");
    expect(balancing.items.some((i) => /Assign 2 waiting/.test(i.label))).toBe(true);
  });
});

describe("crossDepartment", () => {
  it("excludes the viewer's own department and promotes contextual boosts", () => {
    const links = resolveCoordinationLinks({ department: "workshop", pathname: "/dashboard" });
    expect(links.some((l) => l.toDept === "parts")).toBe(true);
    expect(links.every((l) => l.toDept !== "workshop")).toBe(true);
    const onJob = resolveCoordinationLinks({ department: "workshop", pathname: "/job-cards/123" });
    expect(onJob[0].toDept).toBe("parts"); // "Chase parts for this job" wins
    expect(onJob[0].label).toContain("this job");
  });
});
