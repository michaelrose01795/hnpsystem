// Static import map keyed by Next.js route template. The presentation
// deep-link page dynamic-imports the real page module from this table so the
// /presentation/* URL renders the exact same component the live route uses.
// Webpack code-splits each entry because the factory contains a literal import().

const ROUTE_TO_MODULE = {
  // Accounts
  "/dashboard/accounts": () => import("@/pages/dashboard/accounts/index"),
  "/accounts": () => import("@/pages/accounts/index"),
  "/accounts/create": () => import("@/pages/accounts/create"),
  "/accounts/edit/[accountId]": () => import("@/pages/accounts/edit/[accountId]"),
  "/accounts/view/[accountId]": () => import("@/pages/accounts/view/[accountId]"),
  "/accounts/transactions/[accountId]": () => import("@/pages/accounts/transactions/[accountId]"),
  "/accounts/invoices": () => import("@/pages/accounts/invoices/index"),
  "/accounts/invoices/[invoiceId]": () => import("@/pages/accounts/invoices/[invoiceId]"),
  "/accounts/payslips": () => import("@/pages/accounts/payslips/index"),
  "/accounts/reports": () => import("@/pages/accounts/reports/index"),
  "/accounts/settings": () => import("@/pages/accounts/settings"),
  "/company-accounts": () => import("@/pages/company-accounts/index"),
  "/company-accounts/[accountNumber]": () => import("@/pages/company-accounts/[accountNumber]"),

  // Admin
  "/dashboard/admin": () => import("@/pages/dashboard/admin/index"),
  "/admin/users": () => import("@/pages/admin/users/index"),
  "/admin/compliance": () => import("@/pages/admin/compliance/index"),
  "/admin/compliance/breaches": () => import("@/pages/admin/compliance/breaches"),
  "/admin/compliance/dpias": () => import("@/pages/admin/compliance/dpias"),
  "/admin/compliance/retention": () => import("@/pages/admin/compliance/retention"),
  "/admin/compliance/ropa": () => import("@/pages/admin/compliance/ropa"),
  "/admin/compliance/sars": () => import("@/pages/admin/compliance/sars"),
  "/staff/website-manager": () => import("@/pages/staff/website-manager"),

  // Dashboards
  "/dashboard/managers": () => import("@/pages/dashboard/managers/index"),
  "/dashboard/mot": () => import("@/pages/dashboard/mot/index"),
  "/dashboard/painting": () => import("@/pages/dashboard/painting/index"),
  "/dashboard/parts": () => import("@/pages/dashboard/parts/index"),
  "/dashboard/service": () => import("@/pages/dashboard/service/index"),
  "/dashboard/valeting": () => import("@/pages/dashboard/valeting/index"),
  "/dashboard/workshop": () => import("@/pages/dashboard/workshop/index"),

  // HR
  "/hr": () => import("@/pages/hr/index"),
  "/hr/manager": () => import("@/pages/hr/manager/index"),
  "/hr/attendance": () => import("@/pages/hr/attendance"),
  "/hr/disciplinary": () => import("@/pages/hr/disciplinary"),
  "/hr/employees": () => import("@/pages/hr/employees/index"),
  "/hr/leave": () => import("@/pages/hr/leave"),
  "/hr/payroll": () => import("@/pages/hr/payroll"),
  "/hr/performance": () => import("@/pages/hr/performance"),
  "/hr/recruitment": () => import("@/pages/hr/recruitment"),
  "/hr/reports": () => import("@/pages/hr/reports"),
  "/hr/settings": () => import("@/pages/hr/settings"),
  "/hr/training": () => import("@/pages/hr/training"),

  // Job cards
  "/job-cards": () => import("@/pages/job-cards/index"),
  "/job-cards/waiting/nextjobs": () => import("@/pages/job-cards/waiting/nextjobs"),
  "/job-cards/view": () => import("@/pages/job-cards/view/index"),
  "/job-cards/[jobNumber]": () => import("@/pages/job-cards/[jobNumber]"),
  "/job-cards/create": () => import("@/pages/job-cards/create/index"),
  "/job-cards/archive": () => import("@/pages/job-cards/archive/index"),
  "/job-cards/appointments": () => import("@/pages/job-cards/appointments"),
  "/job-cards/myjobs": () => import("@/pages/job-cards/myjobs/index"),
  "/job-cards/myjobs/[jobNumber]": () => import("@/pages/job-cards/myjobs/[jobNumber]"),
  "/job-cards/valet/[jobnumber]": () => import("@/pages/job-cards/valet/[jobnumber]"),

  // Parts
  "/parts": () => import("@/pages/parts/index"),
  "/parts/manager": () => import("@/pages/parts/manager"),
  "/parts/create-order": () => import("@/pages/parts/create-order/index"),
  "/parts/create-order/[orderNumber]": () => import("@/pages/parts/create-order/[orderNumber]"),
  "/parts/deliveries": () => import("@/pages/parts/deliveries"),
  "/parts/deliveries/[deliveryId]": () => import("@/pages/parts/deliveries/[deliveryId]"),
  "/parts/delivery-planner": () => import("@/pages/parts/delivery-planner"),
  "/parts/goods-in": () => import("@/pages/parts/goods-in"),
  "/parts/goods-in/[goodsInNumber]": () => import("@/pages/parts/goods-in/[goodsInNumber]"),
  "/stock-catalogue": () => import("@/pages/stock-catalogue"),

  // Tech
  "/tech/dashboard": () => import("@/pages/tech/dashboard"),
  "/tech/efficiency": () => import("@/pages/tech/efficiency"),
  "/tech/consumables-request": () => import("@/pages/tech/consumables-request"),

  // Mobile
  "/mobile/dashboard": () => import("@/pages/mobile/dashboard"),
  "/mobile/delivery/[jobNumber]": () => import("@/pages/mobile/delivery/[jobNumber]"),

  // VHC
  "/vhc": () => import("@/pages/vhc/index"),
  "/vhc/customer-preview/[jobNumber]": () => import("@/pages/vhc/customer-preview/[jobNumber]"),
  "/vhc/customer-view/[jobNumber]": () => import("@/pages/vhc/customer-view/[jobNumber]"),
  "/vhc/share/[jobNumber]/[linkCode]": () => import("@/pages/vhc/customer/[jobNumber]/[linkCode]"),
  "/vhc/customer/[jobNumber]/[linkCode]": () => import("@/pages/vhc/customer/[jobNumber]/[linkCode]"),

  // Public website / customer-facing routes
  "/website": () => import("@/pages/website"),
  "/website/login": () => import("@/pages/website/login"),
  "/website/profile": () => import("@/pages/website/profile"),
  "/website/shop/cart": () => import("@/pages/website/shop/cart"),
  "/website/shop/checkout": () => import("@/pages/website/shop/checkout"),
  "/website/shop/success": () => import("@/pages/website/shop/success"),
  "/website/shop/cancel": () => import("@/pages/website/shop/cancel"),

  // Workshop / valet
  "/workshop/consumables-tracker": () => import("@/pages/workshop/consumables-tracker"),
  "/valet": () => import("@/pages/valet/index"),

  // Staff-side customers
  "/customers": () => import("@/pages/customers/index"),
  "/customers/[customerSlug]": () => import("@/pages/customers/[customerSlug]"),

  // Clocking / tracking / appointments
  "/clocking": () => import("@/pages/clocking/index"),
  "/clocking/[technicianSlug]": () => import("@/pages/clocking/[technicianSlug]"),
  "/tracking": () => import("@/pages/tracking/index"),
  "/appointments": () => import("@/pages/appointments/index"),

  // Shared
  "/messages": () => import("@/pages/messages/index"),
  "/newsfeed": () => import("@/pages/newsfeed"),
  "/profile": () => import("@/pages/profile/index"),
  "/profile/privacy": () => import("@/pages/profile/privacy"),
  "/account/security": () => import("@/pages/account/security"),
  "/login": () => import("@/pages/login"),
  "/password-reset/new": () => import("@/pages/password-reset/new"),
};

function normalizeTemplate(template) {
  return String(template || "").split("?")[0].split("#")[0];
}

// Resolved-module cache keyed by template — lets the deep-link page swap pages
// synchronously between slides instead of paying a microtask round-trip for
// an already-loaded dynamic import (which causes a one-frame loading flash).
const LOADED_MODULES = new Map();
// In-flight load promises so concurrent callers share one import() per template.
const PENDING_LOADS = new Map();

function toPageRecord(mod) {
  if (!mod) return null;
  return { Page: mod.default, getLayout: mod.default?.getLayout || mod.getLayout || null };
}

export function hasRealPage(template) {
  return Object.prototype.hasOwnProperty.call(ROUTE_TO_MODULE, normalizeTemplate(template));
}

// Synchronous getter — returns the resolved page module if it has already
// been preloaded, or null. Used by the deep-link page to skip the loading
// placeholder when navigating between slides whose modules are already warm.
export function getLoadedPage(template) {
  return LOADED_MODULES.get(normalizeTemplate(template)) || null;
}

export async function loadRealPage(template) {
  const key = normalizeTemplate(template);
  const cached = LOADED_MODULES.get(key);
  if (cached) return cached;
  const factory = ROUTE_TO_MODULE[key];
  if (!factory) return null;
  if (PENDING_LOADS.has(key)) return PENDING_LOADS.get(key);
  const promise = factory().then((mod) => {
    const record = toPageRecord(mod);
    if (record) LOADED_MODULES.set(key, record);
    PENDING_LOADS.delete(key);
    return record;
  }).catch((err) => {
    PENDING_LOADS.delete(key);
    throw err;
  });
  PENDING_LOADS.set(key, promise);
  return promise;
}

export function preloadRealPages(templates = []) {
  const uniqueTemplates = Array.from(new Set(templates.filter(Boolean).map(normalizeTemplate)));
  return Promise.allSettled(
    uniqueTemplates.map((template) => loadRealPage(template))
  );
}

export function listSupportedRoutes() {
  return Object.keys(ROUTE_TO_MODULE);
}
