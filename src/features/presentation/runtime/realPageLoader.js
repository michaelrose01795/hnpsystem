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
  "/admin/profiles/[user]": () => import("@/pages/admin/profiles/[user]"),

  // Dashboards
  "/dashboard": () => import("@/pages/dashboard"),
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
  "/job-cards/waiting/nextjobs": () => import("@/pages/job-cards/waiting/nextjobs"),
  "/job-cards/view": () => import("@/pages/job-cards/view/index"),
  "/job-cards/[jobNumber]": () => import("@/pages/job-cards/[jobNumber]"),
  "/job-cards/create": () => import("@/pages/job-cards/create/index"),
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
  "/vhc/share/[jobNumber]/[linkCode]": () => import("@/pages/vhc/share/[jobNumber]/[linkCode]"),

  // Workshop / valet
  "/workshop/consumables-tracker": () => import("@/pages/workshop/consumables-tracker"),
  "/valet": () => import("@/pages/valet/index"),

  // Customers
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
};

export function hasRealPage(template) {
  return Object.prototype.hasOwnProperty.call(ROUTE_TO_MODULE, template);
}

export async function loadRealPage(template) {
  const factory = ROUTE_TO_MODULE[template];
  if (!factory) return null;
  const mod = await factory();
  return { Page: mod.default, getLayout: mod.default?.getLayout || mod.getLayout || null };
}

export function listSupportedRoutes() {
  return Object.keys(ROUTE_TO_MODULE);
}
