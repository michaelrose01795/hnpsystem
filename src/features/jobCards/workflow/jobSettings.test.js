import { describe, expect, it } from "vitest";
import {
  describeWorkflowLocks,
  getStatusChangeBlocker,
  isReasonValid,
  planStatusChange,
  resolveJobTypeForSource,
} from "./jobSettings";
import { resolveJobCardPermissions } from "./permissions";

const serviceAdvisor = (jobStatus) => resolveJobCardPermissions({ userRoles: ["service"], jobStatus });
const serviceManager = (jobStatus) => resolveJobCardPermissions({ userRoles: ["service manager"], jobStatus });

describe("planStatusChange", () => {
  it("treats a canonical next step as a forward move", () => {
    const plan = planStatusChange({ currentStatus: "Booked", targetStatus: "checked_in" });
    expect(plan.isForward).toBe(true);
    expect(plan.requiresOverride).toBe(false);
    expect(plan.requiresReason).toBe(false);
  });

  it("treats a backward move as an override that needs a reason", () => {
    const plan = planStatusChange({ currentStatus: "In Progress", targetStatus: "booked" });
    expect(plan.isForward).toBe(false);
    expect(plan.isBackward).toBe(true);
    expect(plan.requiresOverride).toBe(true);
    expect(plan.requiresReason).toBe(true);
  });

  it("recognises reopening an invoiced or released job", () => {
    expect(planStatusChange({ currentStatus: "Invoiced", targetStatus: "in_progress" }).isReopen).toBe(true);
    expect(planStatusChange({ currentStatus: "Released", targetStatus: "in_progress" }).isReopen).toBe(true);
    expect(planStatusChange({ currentStatus: "Booked", targetStatus: "in_progress" }).isReopen).toBe(false);
  });

  it("treats skipping a stage as an override", () => {
    expect(planStatusChange({ currentStatus: "Checked In", targetStatus: "invoiced" }).requiresOverride).toBe(true);
  });

  it("treats leaving an unknown legacy status as an override rather than guessing", () => {
    const plan = planStatusChange({ currentStatus: "Open", targetStatus: "booked" });
    expect(plan.fromId).toBe(null);
    expect(plan.requiresOverride).toBe(true);
  });

  it("does not offer Cancelled as a manual target", () => {
    expect(planStatusChange({ currentStatus: "Booked", targetStatus: "cancelled" }).isValidTarget).toBe(false);
  });

  it("blocks moves that would strand an open clocking entry", () => {
    expect(
      planStatusChange({ currentStatus: "In Progress", targetStatus: "invoiced", hasActiveClocking: true }).blockedByClocking
    ).toBe(true);
    expect(
      planStatusChange({ currentStatus: "Booked", targetStatus: "in_progress", hasActiveClocking: true }).blockedByClocking
    ).toBe(false);
  });
});

describe("getStatusChangeBlocker", () => {
  it("lets an editor make a forward move without a reason", () => {
    const plan = planStatusChange({ currentStatus: "Booked", targetStatus: "checked_in" });
    expect(getStatusChangeBlocker(plan, serviceAdvisor("Booked"))).toBe(null);
  });

  it("refuses an override for a non-manager", () => {
    const plan = planStatusChange({ currentStatus: "In Progress", targetStatus: "booked" });
    expect(getStatusChangeBlocker(plan, serviceAdvisor("In Progress"), { reason: "Customer changed their mind" })).toMatch(
      /manager or admin/
    );
  });

  it("requires a reason for a manager override", () => {
    const plan = planStatusChange({ currentStatus: "Invoiced", targetStatus: "in_progress" });
    const permissions = serviceManager("Invoiced");
    expect(getStatusChangeBlocker(plan, permissions, { reason: "short" })).toMatch(/reason/);
    expect(getStatusChangeBlocker(plan, permissions, { reason: "Invoice raised against the wrong labour line" })).toBe(null);
  });

  it("only lets staff with the release action release an invoiced job", () => {
    const plan = planStatusChange({ currentStatus: "Invoiced", targetStatus: "released" });
    expect(getStatusChangeBlocker(plan, serviceAdvisor("Invoiced"))).toBe(null);
    expect(getStatusChangeBlocker(plan, resolveJobCardPermissions({ userRoles: ["techs"], jobStatus: "Invoiced" }))).toMatch(
      /release/
    );
  });

  it("refuses a move to the current status", () => {
    const plan = planStatusChange({ currentStatus: "Booked", targetStatus: "booked" });
    expect(getStatusChangeBlocker(plan, serviceManager("Booked"))).toMatch(/already/);
  });
});

describe("settings permissions", () => {
  it("gives reopen to managers on invoiced and released jobs only", () => {
    expect(serviceManager("Invoiced").canReopenJob).toBe(true);
    expect(serviceManager("Released").canReopenJob).toBe(true);
    expect(serviceManager("In Progress").canReopenJob).toBe(false);
    expect(serviceAdvisor("Invoiced").canReopenJob).toBe(false);
  });

  it("allows cancelling only before invoicing, and archiving only once released or cancelled", () => {
    expect(serviceAdvisor("In Progress").canCancelJob).toBe(true);
    expect(serviceAdvisor("Invoiced").canCancelJob).toBe(false);
    expect(serviceAdvisor("In Progress").canArchiveJob).toBe(false);
    expect(serviceAdvisor("Released").canArchiveJob).toBe(true);
    expect(serviceAdvisor("Cancelled").canArchiveJob).toBe(true);
  });

  it("grants nothing workflow-breaking on the archived copy", () => {
    const permissions = resolveJobCardPermissions({ userRoles: ["admin"], jobStatus: "Released", isArchiveMode: true });
    expect(permissions.canOverrideWorkflow).toBe(false);
    expect(permissions.canReopenJob).toBe(false);
    expect(permissions.canArchiveJob).toBe(false);
  });
});

describe("describeWorkflowLocks", () => {
  it("reports the invoiced read-only lock with a reopen override for managers", () => {
    const locks = describeWorkflowLocks(serviceManager("Invoiced"), { statusLabel: "Invoiced" });
    const readOnly = locks.find((lock) => lock.id === "read-only");
    expect(readOnly?.overridable).toBe(true);
  });

  it("reports the booked parts / write-up / VHC lock without an override", () => {
    const locks = describeWorkflowLocks(serviceAdvisor("Booked"));
    expect(locks.find((lock) => lock.id === "parts-writeup-vhc")?.overridable).toBe(false);
  });

  it("reports only the archive lock on the archived copy", () => {
    const locks = describeWorkflowLocks(serviceAdvisor("Released"), { isArchiveMode: true });
    expect(locks.map((lock) => lock.id)).toEqual(["archived"]);
  });
});

describe("helpers", () => {
  it("derives the job type from the source, as job creation does", () => {
    expect(resolveJobTypeForSource("Warranty")).toBe("Warranty");
    expect(resolveJobTypeForSource("Retail")).toBe("Service");
  });

  it("requires a meaningful reason", () => {
    expect(isReasonValid("  too short ")).toBe(false);
    expect(isReasonValid("Customer asked to rebook next week")).toBe(true);
  });
});
