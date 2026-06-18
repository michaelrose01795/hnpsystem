// file location: src/lib/reporting/config/departments.js
//
// PRIORITY 1 — Department dimension support.
//
// The canonical department dimension (`dim_department`, Phase-2 §7). This is the
// single source of truth for department codes used everywhere in reporting:
// event ownership, status-history `department`, snapshot `department` slices,
// and permission scope.
//
// IMPORTANT (debt D3): the operational `users.department` column is free-text
// and populated with the WRONG vocabulary (Retail/Sales/Mobile/Customers from
// `roleCategories`). Until that is constrained + backfilled, department
// attribution in reporting is resolved from a user's ROLE via the role→department
// map below (Phase-2 §7.5 attribution order, with the role rule first because
// it is the only trustworthy signal today). The operational tables are NOT
// retro-fitted — department is denormalised onto event/history rows at write time.

// ---------------------------------------------------------------------------
// Canonical departments (dim_department rows). `kind` and `parent` drive
// rollups (department → aftersales tier → company total). Phase-2 §7.1/§7.2.
// ---------------------------------------------------------------------------
export const DEPARTMENTS = Object.freeze({
  workshop: { code: "workshop", name: "Workshop", kind: "operational", parent: "aftersales" },
  parts: { code: "parts", name: "Parts", kind: "operational", parent: "aftersales" },
  service: { code: "service", name: "Service Advisors", kind: "operational", parent: "aftersales" },
  mot: { code: "mot", name: "MOT", kind: "operational", parent: "aftersales" },
  valeting: { code: "valeting", name: "Valeting", kind: "operational", parent: "aftersales" },
  paint: { code: "paint", name: "Paint / Bodyshop", kind: "operational", parent: "aftersales" },
  accounts: { code: "accounts", name: "Accounts", kind: "commercial", parent: "management" },
  admin: { code: "admin", name: "Admin", kind: "support", parent: "management" },
  hr: { code: "hr", name: "HR", kind: "support-sensitive", parent: "management" },
  management: { code: "management", name: "Management", kind: "oversight", parent: null },
  // Virtual grouping tier (no operational events; a rollup parent only).
  aftersales: { code: "aftersales", name: "Aftersales", kind: "group", parent: "management" },
  // System/automated owner for cron/integration events (Phase-2 §8.3).
  system: { code: "system", name: "System", kind: "system", parent: null },
});

export const DEPARTMENT_CODES = Object.freeze(Object.keys(DEPARTMENTS));

// Departments that own operational events / appear as reportable slices.
export const OPERATIONAL_DEPARTMENT_CODES = Object.freeze(
  Object.values(DEPARTMENTS)
    .filter((d) => d.kind === "operational" || d.kind === "commercial")
    .map((d) => d.code)
);

export function isDepartmentCode(code) {
  return Boolean(code) && Object.prototype.hasOwnProperty.call(DEPARTMENTS, code);
}

export function getDepartment(code) {
  return DEPARTMENTS[code] || null;
}

// Ancestor chain for rollups, e.g. workshop → aftersales → management.
export function getDepartmentAncestors(code) {
  const chain = [];
  let current = DEPARTMENTS[code]?.parent || null;
  while (current && DEPARTMENTS[current]) {
    chain.push(current);
    current = DEPARTMENTS[current].parent;
  }
  return chain;
}

// ---------------------------------------------------------------------------
// Role → department map. Lowercase role string → department code.
// Built from src/config/users.js (roleCategories) + src/config/departmentDashboards.js.
// This is the trustworthy attribution path until users.department is fixed (D3).
// ---------------------------------------------------------------------------
const ROLE_DEPARTMENT_ENTRIES = [
  // Workshop
  ["workshop manager", "workshop"],
  ["workshop controller", "workshop"],
  ["techs", "workshop"],
  ["tech", "workshop"],
  ["technician", "workshop"],
  ["mobile technician", "workshop"],
  // Parts
  ["parts manager", "parts"],
  ["parts", "parts"],
  ["parts driver", "parts"],
  // Service advisors
  ["service manager", "service"],
  ["service", "service"],
  ["after sales manager", "service"],
  ["aftersales manager", "service"],
  ["after sales director", "service"],
  // MOT
  ["mot tester", "mot"],
  // Valeting
  ["valet service", "valeting"],
  ["valet sales", "valeting"],
  // Paint / bodyshop
  ["painters", "paint"],
  ["painter", "paint"],
  // Accounts
  ["accounts manager", "accounts"],
  ["accounts", "accounts"],
  // Admin
  ["admin", "admin"],
  ["receptionist", "admin"],
  // HR (sensitive)
  ["hr manager", "hr"],
  // Management / oversight (cross-department)
  ["admin manager", "management"],
  ["general manager", "management"],
  ["manager", "management"],
  ["owner", "management"],
  ["sales director", "management"],
  ["buying director", "management"],
];

export const ROLE_DEPARTMENT_MAP = Object.freeze(
  ROLE_DEPARTMENT_ENTRIES.reduce((acc, [role, dept]) => {
    acc[role] = dept;
    return acc;
  }, {})
);

// Resolve the producing department for a single role string. Returns a
// department code or null when the role is unmapped.
export function resolveDepartmentForRole(role) {
  if (!role) return null;
  return ROLE_DEPARTMENT_MAP[String(role).toLowerCase().trim()] || null;
}

// Resolve a department from a set of roles. The first mapped role wins, but an
// operational department is preferred over the catch-all `management` so that,
// e.g., a "Workshop Manager" who also holds "Manager" is attributed to workshop.
export function resolveDepartmentForRoles(roles = []) {
  const mapped = (roles || [])
    .map((r) => resolveDepartmentForRole(r))
    .filter(Boolean);
  if (mapped.length === 0) return null;
  const operational = mapped.find((code) => code !== "management" && code !== "admin");
  return operational || mapped[0];
}

export default DEPARTMENTS;
