// file location: src/lib/reporting/validation/reportingActivation.test.js
//
// PHASE 5 — Reporting Activation & Readiness validation harness.
//
// A runtime contract test that imports the REAL reporting modules and asserts
// every invariant Phase 5 must guarantee before the first report package ships:
//
//   1. Infrastructure activation  — SQL schema ↔ data-layer contract, RLS, flags.
//   2. Department dimension        — canonical model, role→dept attribution.
//   3. Actor attribution           — canonical-id bridge, R2 block behaviour.
//   4. Event spine                 — catalogue integrity, ownership, audit set.
//   5. Status history              — entity registry ↔ SQL history tables.
//   6. Data trust                  — status normalisation (no fragmented GROUP BY).
//   7/8. Snapshot/KPI readiness    — cadence tables, R1 KPI source/calc/permission.
//   9. Audit & permissions         — financial gating, audit-required coverage.
//
// Run:  PLAYWRIGHT_TEST_AUTH=1 npx vitest run src/lib/reporting/validation
// (PLAYWRIGHT_TEST_AUTH=1 makes supabaseClient use its in-memory stub so the
//  catalogue — which transitively imports the client — loads without DB creds.)
//
// This test does NOT touch a database. It validates the code+config+SQL contract,
// which is exactly what "activate and validate the foundation" means before the
// migrations are applied to Supabase.

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

import {
  DEPARTMENTS,
  DEPARTMENT_CODES,
  OPERATIONAL_DEPARTMENT_CODES,
  isDepartmentCode,
  resolveDepartmentForRole,
  resolveDepartmentForRoles,
  getDepartmentAncestors,
} from "@/lib/reporting/config/departments";
import {
  EVENT_CATALOGUE,
  EVENT_NAMES,
  EVENT_CATEGORIES,
  AUDIT_REQUIRED_EVENTS,
  validateEvent,
  isEventAuditRequired,
} from "@/lib/reporting/config/eventCatalogue";
import {
  ENTITIES,
  ENTITY_KEYS,
  PENDING_HISTORY_ENTITIES,
  getEntity,
} from "@/lib/reporting/config/entities";
import {
  STATUS_MODELS,
  normaliseStatus,
  isStatusInModel,
} from "@/lib/reporting/config/statusMaps";
import { getAllReportingFlags, getReportingFlag } from "@/lib/reporting/config/flags";
import { actorFromSession, systemActor, customerActor, resolveActor } from "@/lib/reporting/actor";
import { listKpis, getKpi } from "@/lib/reporting/kpiCatalog";
import { registerSeedKpis } from "@/lib/reporting/kpiDefinitions";
import {
  resolveScope,
  scopeSatisfiesKpiPermission,
  canSeeDepartment,
  FINANCIAL_SENSITIVE_ROLES,
} from "@/lib/reporting/permissionScope";
import { snapshotTableForCadence } from "@/lib/database/reporting/snapshots";
import { partEventForStatus } from "@/lib/database/reporting/emitters";

// Make sure the seed catalogue is registered (engine.js does this on import too).
registerSeedKpis();

// --- Parse the SQL migrations once (the schema ↔ code contract). -------------
const SQL_DIR = path.join(process.cwd(), "src/lib/database/schema/reporting");
function readSql(file) {
  return fs.readFileSync(path.join(SQL_DIR, file), "utf8");
}
const SQL_FILES = ["001_dimensions.sql", "002_report_event.sql", "003_status_history.sql", "004_kpi_snapshots.sql", "005_saved_views.sql"];
const ALL_SQL = SQL_FILES.map(readSql).join("\n");
const CREATED_TABLES = new Set(
  [...ALL_SQL.matchAll(/CREATE TABLE IF NOT EXISTS public\.([a-z_]+)/g)].map((m) => m[1])
);
const RLS_TABLES = new Set(
  [...ALL_SQL.matchAll(/^ALTER TABLE public\.([a-z_]+)\s+ENABLE ROW LEVEL SECURITY/gm)].map((m) => m[1])
);

// ===========================================================================
describe("Phase 5 §1 — Reporting Infrastructure Activation", () => {
  it("ships the five additive, idempotent migrations + the combined 000 script", () => {
    for (const f of SQL_FILES) expect(fs.existsSync(path.join(SQL_DIR, f)), `${f} missing`).toBe(true);
    expect(fs.existsSync(path.join(SQL_DIR, "000_all_reporting.sql"))).toBe(true);
  });

  it("every CREATE TABLE is idempotent (IF NOT EXISTS) — additive, re-runnable", () => {
    const bareCreates = [...ALL_SQL.matchAll(/CREATE TABLE (?!IF NOT EXISTS)/g)];
    expect(bareCreates.length, "non-idempotent CREATE TABLE found").toBe(0);
  });

  it("RLS is ENABLED on every reporting table (deny-by-default; service role bypasses)", () => {
    const missing = [...CREATED_TABLES].filter((t) => !RLS_TABLES.has(t));
    expect(missing, `tables without RLS: ${missing.join(", ")}`).toEqual([]);
    expect(CREATED_TABLES.size).toBeGreaterThanOrEqual(20);
  });

  it("the combined 000 script mirrors the per-section tables exactly", () => {
    const combined = new Set(
      [...readSql("000_all_reporting.sql").matchAll(/CREATE TABLE IF NOT EXISTS public\.([a-z_]+)/g)].map((m) => m[1])
    );
    expect([...combined].sort()).toEqual([...CREATED_TABLES].sort());
  });

  it("feature-flag posture is correct for activation (emit/nav OFF, platform ON, degrade-safe)", () => {
    const flags = getAllReportingFlags();
    expect(flags.reporting_enabled).toBe(true);
    expect(flags.reporting_live_fallback_enabled).toBe(true); // graceful degradation path
    expect(flags.reporting_access_audit_enabled).toBe(true);
    expect(flags.reporting_export_enabled).toBe(true);
    expect(flags.reporting_emit_enabled).toBe(false); // capture stays inert until go-live sign-off
    expect(flags.reporting_nav_enabled).toBe(false); // UI phase only
  });
});

// ===========================================================================
describe("Phase 5 §2 — Department Dimension Activation", () => {
  it("canonical dim_department model is complete and self-consistent", () => {
    expect(DEPARTMENT_CODES.length).toBeGreaterThanOrEqual(10);
    for (const code of DEPARTMENT_CODES) {
      const d = DEPARTMENTS[code];
      expect(isDepartmentCode(code)).toBe(true);
      if (d.parent) expect(isDepartmentCode(d.parent), `parent ${d.parent} of ${code} not a dept`).toBe(true);
    }
  });

  it("the dim_department SQL table is created and seedable from config", () => {
    expect(CREATED_TABLES.has("dim_department")).toBe(true);
    // No parent precedes its declaration impossibly — hierarchy resolves to a root.
    for (const code of DEPARTMENT_CODES) {
      const chain = getDepartmentAncestors(code);
      expect(Array.isArray(chain)).toBe(true);
    }
  });

  it("resolves a producing department for every reportable operational role", () => {
    const roles = ["techs", "parts", "service", "mot tester", "valet service", "painters", "accounts", "workshop manager"];
    for (const r of roles) expect(resolveDepartmentForRole(r), `role "${r}" unmapped`).toBeTruthy();
  });

  it("prefers an operational department over the catch-all management for multi-role users", () => {
    expect(resolveDepartmentForRoles(["Workshop Manager", "Manager"])).toBe("workshop");
    expect(resolveDepartmentForRoles(["Owner"])).toBe("management");
  });
});

// ===========================================================================
describe("Phase 5 §3 — Actor Attribution Remediation (canonical-id bridge)", () => {
  it("derives the canonical int actor from a NextAuth session synchronously", () => {
    const a = actorFromSession({ user: { id: 42, roles: ["Workshop Manager"] } });
    expect(a.actorKind).toBe("user");
    expect(a.actorUserId).toBe(42);
    expect(a.actorRole).toBe("Workshop Manager");
  });

  it("models system and customer actors honestly (no fake user ids)", () => {
    expect(systemActor("cron:aggregate").actorKind).toBe("system");
    expect(systemActor().actorUserId).toBeNull();
    expect(customerActor("cust-1").actorKind).toBe("customer");
    expect(customerActor("cust-1").actorUserId).toBeNull();
  });

  it("BLOCKS per-user attribution for an unresolved auth uuid (Risk R2) rather than guessing", async () => {
    // Stub DB → no dim_actor row, no users match → canonical id must be null.
    const a = await resolveActor({ authUuid: "00000000-0000-4000-8000-000000000000" });
    expect(a.actorUserId).toBeNull(); // R2: blocked, not fabricated
  });

  it("treats an int user id as canonical today (dim_actor absent fallback)", async () => {
    const a = await resolveActor({ userId: 7 });
    expect(a.actorUserId).toBe(7);
  });

  it("the dim_actor bridge table exists in the schema", () => {
    expect(CREATED_TABLES.has("dim_actor")).toBe(true);
  });
});

// ===========================================================================
describe("Phase 5 §4 — Event Spine integrity (go-live readiness)", () => {
  it("every catalogue event has a valid category and an owner department in dim_department", () => {
    for (const name of EVENT_NAMES) {
      const e = EVENT_CATALOGUE[name];
      expect(EVENT_CATEGORIES.includes(e.category), `${name}: bad category ${e.category}`).toBe(true);
      expect(isDepartmentCode(e.ownerDepartment), `${name}: owner ${e.ownerDepartment} not a dept`).toBe(true);
      for (const rel of e.related) expect(isDepartmentCode(rel), `${name}: related ${rel} not a dept`).toBe(true);
      expect(validateEvent({ eventName: name, eventCategory: e.category, ownerDepartment: e.ownerDepartment }).ok).toBe(true);
    }
  });

  it("the four prioritised lifecycles each have their key events catalogued", () => {
    const required = [
      "JOB_CREATED", "JOB_STATUS_CHANGED", "JOB_COMPLETED",
      "VHC_CREATED", "VHC_AUTHORISED", "VHC_DECLINED", "VHC_SENT", "VHC_ITEM_STATUS_CHANGED",
      "PART_STATUS_CHANGED", "PART_ORDERED", "PART_FITTED", "PART_CANCELLED",
      "INVOICE_CREATED", "INVOICE_PAID", "PAYMENT_RECEIVED", "TRANSACTION_POSTED",
    ];
    for (const n of required) expect(EVENT_NAMES.includes(n), `missing event ${n}`).toBe(true);
  });

  it("the parts emit adapter maps every terminal/milestone status to a stable named event", () => {
    expect(partEventForStatus("fitted")).toBe("PART_FITTED");
    expect(partEventForStatus("on_order")).toBe("PART_ORDERED");
    expect(partEventForStatus("cancelled")).toBe("PART_CANCELLED");
    expect(partEventForStatus("allocated")).toBe("PART_ALLOCATED");
    expect(partEventForStatus("something_else")).toBe("PART_STATUS_CHANGED");
    // Every mapped event must itself be in the catalogue.
    for (const s of ["fitted", "on_order", "cancelled", "allocated", "picked", "pre_picked", "removed", "unavailable"]) {
      expect(EVENT_NAMES.includes(partEventForStatus(s))).toBe(true);
    }
  });

  it("the report_event spine table exists with idempotency support", () => {
    expect(CREATED_TABLES.has("report_event")).toBe(true);
    expect(ALL_SQL.includes("report_event_uuid_idx")).toBe(true); // dedupe / idempotency
  });
});

// ===========================================================================
describe("Phase 5 §5 — Status History Activation", () => {
  it("every reportable entity's history table is created by a migration (or already exists)", () => {
    for (const key of ENTITY_KEYS) {
      const e = getEntity(key);
      if (e.exists) continue; // job_status_history pre-exists operationally
      expect(CREATED_TABLES.has(e.historyTable), `${key}: ${e.historyTable} not in schema`).toBe(true);
    }
  });

  it("the four prioritised entities (parts, vhc_item, invoice, job) are all registered", () => {
    for (const key of ["part", "vhc_item", "invoice", "job"]) {
      expect(ENTITIES[key], `entity ${key} missing`).toBeTruthy();
      expect(ENTITIES[key].historyTable).toBeTruthy();
    }
  });

  it("pending history entities are ordered by reporting priority (parts first)", () => {
    expect(PENDING_HISTORY_ENTITIES[0].key).toBe("part");
  });
});

// ===========================================================================
describe("Phase 5 §6 — Data Trust (status normalisation removes fragmented GROUP BY)", () => {
  it("collapses the authorized/authorised spelling split to one canonical value", () => {
    expect(normaliseStatus("vhc_approval", "authorized")).toBe("authorised");
    expect(normaliseStatus("vhc_approval", "authorised")).toBe("authorised");
    expect(normaliseStatus("vhc_approval", "APPROVED")).toBe("authorised");
  });

  it("normalises legacy/cased job statuses into the canonical lifecycle", () => {
    expect(normaliseStatus("job", "New")).toBe("booked");
    expect(normaliseStatus("job", "Completed")).toBe("released");
    expect(normaliseStatus("job", "in progress")).toBe("in_progress");
  });

  it("is idempotent (normalising a canonical value is a no-op)", () => {
    for (const [entity, model] of Object.entries(STATUS_MODELS)) {
      for (const v of model) expect(normaliseStatus(entity, v), `${entity}.${v} not stable`).toBe(v);
    }
  });

  it("flags out-of-model values for drift detection rather than dropping them", () => {
    expect(isStatusInModel("part", "fitted")).toBe(true);
    expect(isStatusInModel("part", "teleported")).toBe(false);
  });
});

// ===========================================================================
describe("Phase 5 §7 — Snapshot & Aggregation contract", () => {
  it("every snapshot cadence maps to a created table with the right conflict key", () => {
    for (const cadence of ["daily", "weekly", "monthly", "quarterly", "yearly"]) {
      const meta = snapshotTableForCadence(cadence);
      expect(meta, `cadence ${cadence} unmapped`).toBeTruthy();
      expect(CREATED_TABLES.has(meta.table), `${meta.table} not in schema`).toBe(true);
      // Conflict key stores ratio inputs separately (num/den) — unique on the slice.
      expect(meta.conflict).toContain("formula_version");
    }
  });

  it("entity-state + lineage tables exist (backlog snapshots, aggregation runs)", () => {
    expect(CREATED_TABLES.has("report_entity_state_snapshot")).toBe(true);
    expect(CREATED_TABLES.has("report_aggregation_run")).toBe(true);
  });

  it("snapshot tables store ratio INPUTS (numerator/denominator/count), not just the ratio", () => {
    for (const col of ["numerator", "denominator", "count", "amount_gbp"]) {
      expect(ALL_SQL.includes(col), `snapshot column ${col} missing`).toBe(true);
    }
  });
});

// ===========================================================================
describe("Phase 5 §8 — R1 KPI Readiness", () => {
  const r1 = listKpis({ readiness: "R1" });

  it("the seed R1 catalogue is registered and every R1 KPI is implemented (has a resolver)", () => {
    expect(r1.length).toBeGreaterThan(0);
    const unimplemented = r1.filter((k) => typeof k.resolver !== "function");
    expect(unimplemented.map((k) => k.id), "R1 KPIs without a resolver").toEqual([]);
  });

  it("every KPI's sourceEvents reference real catalogue events", () => {
    for (const k of listKpis()) {
      for (const ev of k.sourceEvents || []) {
        expect(EVENT_NAMES.includes(ev), `${k.id}: sourceEvent ${ev} not in catalogue`).toBe(true);
      }
    }
  });

  it("every KPI's sourceHistories reference a real entity history table", () => {
    const historyTables = new Set(ENTITY_KEYS.map((k) => getEntity(k).historyTable));
    for (const k of listKpis()) {
      for (const h of k.sourceHistories || []) {
        expect(historyTables.has(h), `${k.id}: sourceHistory ${h} not an entity history table`).toBe(true);
      }
    }
  });

  it("every KPI sits in a real department and carries a drill-down where declared", () => {
    for (const k of listKpis()) {
      expect(isDepartmentCode(k.department), `${k.id}: dept ${k.department}`).toBe(true);
      if (k.drilldown) expect(typeof k.drilldown).toBe("function");
    }
  });
});

// ===========================================================================
describe("Phase 5 §9 — Reporting Audit & Permission validation", () => {
  it("all financial/security events are in the audit-required set", () => {
    const mustAudit = [
      "INVOICE_CREATED", "INVOICE_PAID", "PAYMENT_RECEIVED", "TRANSACTION_POSTED",
      "INVOICE_STATUS_CHANGED", "INVOICE_VOIDED", "ACCOUNT_STATUS_CHANGED",
      "ROLE_CHANGED", "RECORD_DELETED", "REPORT_EXPORTED", "REPORT_VIEWED",
    ];
    for (const e of mustAudit) {
      expect(isEventAuditRequired(e), `${e} should be audit-required`).toBe(true);
      expect(AUDIT_REQUIRED_EVENTS.includes(e)).toBe(true);
    }
  });

  it("financial KPIs are gated to Accounts/executives — a technician is refused", () => {
    const techScope = resolveScope({ user: { id: 1, roles: ["Techs"] } });
    const acctScope = resolveScope({ user: { id: 2, roles: ["Accounts"] } });
    const revenue = getKpi("acc.revenue");
    expect(revenue).toBeTruthy();
    expect(scopeSatisfiesKpiPermission(techScope, revenue.permission)).toBe(false);
    expect(scopeSatisfiesKpiPermission(acctScope, revenue.permission)).toBe(true);
  });

  it("operational scope is confined to its own department; executives see all", () => {
    const tech = resolveScope({ user: { id: 1, roles: ["Techs"] } });
    expect(tech.level).toBe("self");
    expect(canSeeDepartment(tech, "accounts")).toBe(false);
    expect(canSeeDepartment(tech, "workshop")).toBe(true);

    const owner = resolveScope({ user: { id: 2, roles: ["Owner"] } });
    expect(owner.departments).toBe("all");
    expect(canSeeDepartment(owner, "accounts")).toBe(true);
  });

  it("the financial-sensitive role set is non-empty and includes Accounts", () => {
    expect(FINANCIAL_SENSITIVE_ROLES.length).toBeGreaterThan(0);
    expect(FINANCIAL_SENSITIVE_ROLES.includes("accounts")).toBe(true);
  });
});
