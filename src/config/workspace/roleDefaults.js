// file location: src/config/workspace/roleDefaults.js
//
// Central role -> Module -> Page defaults for Workspace Navigation. Pages are
// href references into the canonical workspace manifest; this file never
// creates routes or permissions. Selectors in manifest.js resolve labels and
// discard references that are unavailable for the active role/feature flags.
//
// THE LAW (2026-09 module-library sweep)
// --------------------------------------
// SIDEBAR_MODULE_LIBRARY — the module set rendered by the Developer Platform's
// "Module page map" popup — is the SINGLE SOURCE OF TRUTH for sidebar layout.
// A role default may only:
//   * name a module that exists in that library, and
//   * list pages that library module owns.
// It may not invent a module, rename one, mix pages from two library modules
// into one bundle, or reorder pages within a bundle. `mod()` enforces all four
// at import time, so a violation is a hard build failure rather than a layout
// that silently drifts from what the popup shows.
//
// Before this sweep there were 38 hand-authored modules here whose keys existed
// nowhere in the library, 16 of which mixed pages from two or three different
// library modules, and 6 of which meant different page sets depending on the
// role. Roles keep exactly the pages they had — only the grouping changed.

import { SIDEBAR_MODULE_LIBRARY, sortModulesByLibraryOrder } from "@/config/workspace/departments";

const LIBRARY_BY_KEY = new Map(
  SIDEBAR_MODULE_LIBRARY.map((navigationModule) => [navigationModule.key, navigationModule])
);

// A role's slice of one library module. The label always comes from the library
// (never from the caller) and the pages are re-sorted into library order, so the
// button order inside a module is identical for every role and cannot be
// authored differently here.
const mod = (key, hrefs) => {
  const library = LIBRARY_BY_KEY.get(key);
  if (!library) {
    throw new Error(
      `roleDefaults: "${key}" is not a module in SIDEBAR_MODULE_LIBRARY. Role defaults may only use library modules.`
    );
  }
  const stray = hrefs.filter((href) => !library.hrefs.includes(href));
  if (stray.length > 0) {
    throw new Error(
      `roleDefaults: ${stray.join(", ")} do(es) not belong to the "${library.label}" module. Pages cannot be mixed between modules.`
    );
  }
  const wanted = new Set(hrefs);
  return Object.freeze({
    key,
    label: library.label,
    hrefs: Object.freeze(library.hrefs.filter((href) => wanted.has(href))),
  });
};

// Modules are emitted in library order so every role's rail reads in the same
// sequence. Whatever order a role table happens to list them in is irrelevant:
// `layout()` re-sorts against SIDEBAR_MODULE_LIBRARY, the one place the rail
// order is authored. A role with no pages in a module simply skips it and the
// next module moves up.
const layout = (...modules) => Object.freeze(sortModulesByLibraryOrder(modules));

export const WORKSPACE_ROLE_DEFAULT_NAMES = Object.freeze([
  "Retail",
  "Service",
  "Service Manager",
  "Workshop Manager",
  "After Sales Director",
  "Techs",
  "Mobile Technician",
  "Parts",
  "Parts Manager",
  "Parts Driver",
  "MOT Tester",
  "Valet Service",
  "Sales / Administration",
  "Sales Director",
  "Sales",
  "Admin",
  "Admin Manager",
  "Accounts",
  "Accounts Manager",
  "General Manager",
  "Valet Sales",
  "Buying Director",
  "Second Hand Buying",
  "Vehicle Processor & Photographer",
  "Receptionist",
  "Painters",
  "Contractors",
]);

export const ROLE_WORKSPACE_DEFAULTS = Object.freeze({
  "retail": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
  ),
  "service": layout(
    mod("department-general", ["/newsfeed", "/messages", "/tracking"]),
    mod("department-management", ["/archive"]),
    mod("department-service", ["/dashboard/service", "/new-job", "/jobs"]),
  ),
  "service manager": layout(
    mod("department-general", ["/newsfeed", "/messages", "/tracking"]),
    mod("department-management", ["/dashboard/managers", "/archive"]),
    mod("department-service", ["/dashboard/service", "/new-job", "/appointments", "/jobs"]),
    mod("department-workshop", ["/nextjobs"]),
    mod("department-reports", ["/reports/workshop", "/reports/service", "/reports/mot", "/reports/paint", "/reports/valeting"]),
  ),
  "workshop manager": layout(
    mod("department-general", ["/newsfeed", "/messages", "/tracking"]),
    mod("department-management", ["/dashboard/managers", "/archive"]),
    mod("department-service", ["/new-job", "/appointments", "/jobs"]),
    mod("department-workshop", ["/dashboard/workshop", "/clocking", "/consumables-tracker", "/nextjobs"]),
    mod("department-reports", ["/reports/workshop", "/reports/mot", "/reports/paint", "/reports/valeting"]),
  ),
  "after sales director": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
    mod("department-reports", ["/reports/workshop", "/reports/service", "/reports/mot", "/reports/paint", "/reports/accounts", "/reports/valeting", "/reports/admin", "/reports/overview"]),
  ),
  "techs": layout(
    mod("department-general", ["/newsfeed", "/messages", "/tracking"]),
    mod("department-workshop", ["/dashboard/workshop"]),
    mod("department-tech", ["/tech/dashboard", "/tech", "/tech/efficiency", "/consumables-request"]),
  ),
  "technician": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-workshop", ["/dashboard/workshop"]),
  ),
  "tech": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
  ),
  "mobile technician": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-service", ["/new-job", "/appointments"]),
    mod("department-workshop", ["/mobile/dashboard"]),
    mod("department-tech", ["/tech", "/consumables-request"]),
  ),
  "parts": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
    mod("department-parts", ["/dashboard/parts", "/stock-catalogue", "/deliveries", "/goods-in"]),
  ),
  "parts manager": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/dashboard/managers", "/archive"]),
    mod("department-parts", ["/dashboard/parts", "/parts-manager", "/stock-catalogue", "/deliveries", "/goods-in"]),
    mod("department-reports", ["/reports/parts"]),
  ),
  "parts driver": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
    mod("department-parts", ["/deliveries"]),
  ),
  "mot tester": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-mot", ["/dashboard/mot", "/tech", "/tech/efficiency"]),
    mod("department-reports", ["/reports/mot"]),
  ),
  "valet service": layout(
    mod("department-general", ["/newsfeed", "/messages", "/tracking"]),
    mod("department-valeting", ["/dashboard/valeting", "/valet"]),
    mod("department-reports", ["/reports/valeting"]),
  ),
  "sales / administration": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
  ),
  "sales director": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
    mod("department-reports", ["/reports/workshop", "/reports/parts", "/reports/service", "/reports/mot", "/reports/paint", "/reports/accounts", "/reports/valeting", "/reports/admin", "/reports/overview"]),
  ),
  "sales": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/website-manager", "/archive"]),
  ),
  "admin": layout(
    mod("department-general", ["/newsfeed", "/messages", "/tracking"]),
    mod("department-management", ["/dashboard/admin", "/website-manager", "/archive"]),
    mod("department-accounts", ["/accounts/payslips"]),
    mod("department-reports", ["/reports/admin"]),
  ),
  "admin manager": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/dashboard/managers", "/dashboard/admin", "/admin/compliance", "/hr/manager", "/website-manager", "/archive"]),
    mod("department-accounts", ["/accounts/payslips"]),
    mod("department-reports", ["/reports/workshop", "/reports/parts", "/reports/service", "/reports/mot", "/reports/paint", "/reports/accounts", "/reports/valeting", "/reports/admin", "/reports/overview"]),
  ),
  "accounts": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-accounts", ["/dashboard/accounts", "/accounts/payslips", "/accounts", "/company-accounts", "/accounts/invoices", "/accounts/reports"]),
    mod("department-reports", ["/reports/accounts"]),
  ),
  "accounts manager": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/dashboard/managers"]),
    mod("department-accounts", ["/dashboard/accounts", "/accounts/payslips", "/accounts", "/company-accounts", "/accounts/invoices", "/accounts/reports"]),
    mod("department-reports", ["/reports/accounts"]),
  ),
  "general manager": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/dashboard/managers", "/website-manager", "/archive"]),
    mod("department-reports", ["/reports/workshop", "/reports/parts", "/reports/service", "/reports/mot", "/reports/paint", "/reports/accounts", "/reports/valeting", "/reports/admin", "/reports/overview"]),
  ),
  "valet sales": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
    mod("department-reports", ["/reports/valeting"]),
  ),
  "buying director": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
    mod("department-reports", ["/reports/workshop", "/reports/parts", "/reports/service", "/reports/mot", "/reports/paint", "/reports/accounts", "/reports/valeting", "/reports/admin", "/reports/overview"]),
  ),
  "second hand buying": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
  ),
  "vehicle processor & photographer": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
  ),
  "receptionist": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
  ),
  "painters": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
    mod("department-reports", ["/reports/paint"]),
  ),
  "painter": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
    mod("department-reports", ["/reports/paint"]),
  ),
  "contractors": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
  ),
  "aftersales manager": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
    mod("department-service", ["/jobs"]),
    mod("department-workshop", ["/nextjobs"]),
    mod("department-reports", ["/reports/service"]),
  ),
  "after sales manager": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
    mod("department-reports", ["/reports/service"]),
  ),
  "workshop controller": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
    mod("department-reports", ["/reports/workshop"]),
  ),
  "manager": layout(
    mod("department-general", ["/newsfeed", "/messages"]),
    mod("department-management", ["/archive"]),
    mod("department-reports", ["/reports/workshop", "/reports/parts", "/reports/service", "/reports/mot", "/reports/paint", "/reports/accounts", "/reports/valeting", "/reports/admin"]),
  ),});

export function normalizeWorkspaceRole(role) {
  return String(role || "").trim().toLowerCase();
}

// Roles with no authored default fall back to the two universally-safe library
// slices: the General bundle's comms pages and the Admin bundle's archive.
const FALLBACK_LAYOUT = layout(
  mod("department-general", ["/newsfeed", "/messages"]),
  mod("department-management", ["/archive"])
);

export function getConfiguredRoleDefault(role) {
  return ROLE_WORKSPACE_DEFAULTS[normalizeWorkspaceRole(role)] || FALLBACK_LAYOUT;
}
