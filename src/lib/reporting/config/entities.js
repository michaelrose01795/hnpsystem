// file location: src/lib/reporting/config/entities.js
//
// Registry of reportable entities and their status-history tables (Phase-2 §6).
// Each reportable entity with a meaningful lifecycle gets a `<entity>_status_history`
// table following the generic pattern (Phase-2 §6.1), modelled on the proven
// `job_status_history`.
//
// This registry is the contract the data layer (statusHistory.js), the emit
// helpers, and the `check:report-events` lint use to know:
//   - which operational table owns the entity,
//   - the status column on it,
//   - the canonical status-history table name,
//   - the owning department, and
//   - the rollout priority (Phase-2 §6 / §19).
//
// `exists: true` means the history table already exists in the live DB today.
// Everything else is a Phase-4+ design target (graceful degradation until built).

import { STATUS_MODELS } from "./statusMaps";

const ENTITY_LIST = [
  {
    key: "job",
    label: "Job",
    sourceTable: "jobs",
    sourcePk: "id",
    statusColumn: "status",
    statusModelKey: "job",
    historyTable: "job_status_history", // EXISTS — the reference template
    exists: true,
    department: "workshop",
    priority: 0,
    eventName: "JOB_STATUS_CHANGED",
  },
  {
    key: "part",
    label: "Part line",
    sourceTable: "parts_job_items",
    sourcePk: "id",
    statusColumn: "status",
    statusModelKey: "part",
    historyTable: "parts_job_items_status_history", // proposed, P4 priority 1
    exists: false,
    department: "parts",
    priority: 1,
    eventName: "PART_STATUS_CHANGED",
  },
  {
    key: "vhc_item",
    label: "VHC item",
    sourceTable: "vhc_checks",
    sourcePk: "vhc_id",
    statusColumn: "approval_status",
    statusModelKey: "vhc_item",
    historyTable: "vhc_item_status_history", // proposed, P4 priority 2
    exists: false,
    department: "workshop",
    priority: 2,
    eventName: "VHC_ITEM_STATUS_CHANGED",
  },
  {
    key: "invoice",
    label: "Invoice",
    sourceTable: "invoices",
    sourcePk: "id",
    statusColumn: "payment_status",
    statusModelKey: "invoice",
    historyTable: "invoice_status_history", // proposed, P4 priority 3
    exists: false,
    department: "accounts",
    priority: 3,
    eventName: "INVOICE_STATUS_CHANGED",
  },
  {
    key: "account",
    label: "Account",
    sourceTable: "accounts",
    sourcePk: "id",
    statusColumn: "status",
    statusModelKey: "account",
    historyTable: "account_status_history", // proposed
    exists: false,
    department: "accounts",
    priority: 4,
    eventName: "ACCOUNT_STATUS_CHANGED",
  },
  {
    key: "appointment",
    label: "Appointment",
    sourceTable: "appointments",
    sourcePk: "id",
    statusColumn: "status",
    statusModelKey: "appointment",
    historyTable: "appointment_status_history", // proposed
    exists: false,
    department: "service",
    priority: 5,
    eventName: "APPOINTMENT_STATUS_CHANGED",
  },
  {
    key: "delivery",
    label: "Delivery",
    sourceTable: "deliveries",
    sourcePk: "id",
    statusColumn: "status",
    statusModelKey: null, // duplicate delivery families to reconcile first (D7)
    historyTable: "delivery_status_history", // proposed
    exists: false,
    department: "parts",
    priority: 6,
    eventName: null,
  },
];

export const ENTITIES = Object.freeze(
  ENTITY_LIST.reduce((acc, e) => {
    acc[e.key] = Object.freeze({ ...e, statusModel: STATUS_MODELS[e.statusModelKey] || null });
    return acc;
  }, {})
);

export const ENTITY_KEYS = Object.freeze(Object.keys(ENTITIES));

// Entities whose status-history tables are design targets (not yet built).
// Drives the "status-history rollout" section of the readiness reporting.
export const PENDING_HISTORY_ENTITIES = Object.freeze(
  ENTITY_LIST.filter((e) => !e.exists).sort((a, b) => a.priority - b.priority)
);

export function getEntity(key) {
  return ENTITIES[key] || null;
}

// Map a status-history table name back to its entity (used by the lint).
export function getEntityByHistoryTable(tableName) {
  return ENTITY_LIST.find((e) => e.historyTable === tableName) || null;
}

export default ENTITIES;
