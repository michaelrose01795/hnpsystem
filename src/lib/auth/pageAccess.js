// file location: src/lib/auth/pageAccess.js
// Enforces the rule: "users can only access pages that appear in
// their sidebar or topbar." The accessible set is derived per-user
// from the existing nav config so there is one source of truth.
//
// canAccessPath(pathname, roles) returns true when:
//   1. The pathname is in ALWAYS_ALLOWED_PATHS or matches an always-allowed
//      prefix (login, auth, customer portal, website, etc.), OR
//   2. The pathname exactly matches an href in the user's filtered sidebar
//      or topbar, OR
//   3. The pathname is a dynamic-detail page covered by DYNAMIC_DETAIL_EXTENDS
//      whose underlying list page is itself accessible.
//
// Pages reached purely by direct URL with no nav presence will be blocked.

import { sidebarSections } from "@/config/navigation";
import { SERVICE_ACTION_ROLE_SET } from "@/lib/auth/serviceActionRoles";

const PARTS_NAV_ROLE_SET = new Set(["parts", "parts manager"]);

// Hard-coded mirror of the topbar action links in src/components/Layout.js.
// Keep in sync if those lists change.
const TOPBAR_LINKS = [
  { href: "/job-cards/create", roles: SERVICE_ACTION_ROLE_SET },
  { href: "/job-cards/appointments", roles: SERVICE_ACTION_ROLE_SET },
  { href: "/parts/delivery-planner", roles: PARTS_NAV_ROLE_SET },
  { href: "/parts/create-order", roles: PARTS_NAV_ROLE_SET },
  { href: "/parts/goods-in", roles: PARTS_NAV_ROLE_SET },
];

const ACCOUNTS_NAV_ROLE_SET = new Set(["accounts", "accounts manager"]);

// Hard-coded mirror of the dynamic "Accounts" sidebar section built in
// src/components/Layout.js (accountsSidebarSections). That section is added
// at render time rather than living in config/navigation.js, so it is not
// picked up by the sidebarSections walk below — mirror it here and keep the
// two lists in sync if either changes.
const ACCOUNTS_NAV_LINKS = [
  { href: "/accounts", roles: ACCOUNTS_NAV_ROLE_SET },
  { href: "/company-accounts", roles: ACCOUNTS_NAV_ROLE_SET },
  { href: "/accounts/invoices", roles: ACCOUNTS_NAV_ROLE_SET },
  { href: "/accounts/reports", roles: ACCOUNTS_NAV_ROLE_SET },
];

// Paths that any authenticated user can reach regardless of role. Covers
// the auth flow, the user's own profile, dashboards (each user has their
// own), the customer portal/website, presentation/slideshow, and the
// public share routes.
const ALWAYS_ALLOWED_EXACT = new Set([
  "/",
  "/login",
  "/loginPresentation",
  "/unauthorized",
  "/newsfeed",
  "/messages",
  "/profile",
  "/profile/privacy",
  "/account/security",
  "/website",
  "/_error",
  "/404",
  "/500",
]);

const ALWAYS_ALLOWED_PREFIXES = [
  "/dashboard/", // every role has its own dashboard sub-route
  "/website/", // customer-facing website
  "/customer/", // legacy customer portal
  "/password-reset/",
  "/presentation/",
  "/slideshow",
  "/vhc/customer/",
  "/vhc/customer-preview/",
  "/vhc/customer-view/",
  "/vhc/share/",
  "/dev/", // developer diagnostics — gate separately if needed
  "/vision/", // roadmap/vision pages
  "/mobile/", // mobile technician tools (own auth path)
  "/api/", // API routes are guarded server-side
];

// Pages that don't appear in any sidebar/topbar config but are reached
// by clicking through from a list page. They inherit access from the
// list pages that link to them. Keys are Next.js pathname patterns
// (with [param] placeholders); values are the list pages whose access
// grants entry.
const DYNAMIC_DETAIL_EXTENDS = {
  "/job-cards/[jobNumber]": [
    "/job-cards/view",
    "/job-cards/myjobs",
    "/job-cards/create",
    "/job-cards/waiting/nextjobs",
    "/job-cards/archive",
  ],
  "/job-cards/myjobs/[jobNumber]": ["/job-cards/myjobs"],
  "/job-cards/valet/[jobnumber]": ["/valet", "/job-cards/view"],
  "/job-cards/view": ["/job-cards/view"],
  // /customers isn't in the sidebar but staff with job-card or admin
  // access reach it routinely via search/links. Grant it to anyone with
  // job-card visibility.
  "/customers": [
    "/job-cards/view",
    "/job-cards/myjobs",
    "/job-cards/create",
    "/job-cards/waiting/nextjobs",
    "/admin/users",
  ],
  "/customers/[customerSlug]": [
    "/job-cards/view",
    "/job-cards/myjobs",
    "/job-cards/create",
    "/job-cards/waiting/nextjobs",
    "/admin/users",
  ],
  "/clocking/[technicianSlug]": ["/clocking"],
  "/accounts/edit/[accountId]": ["/accounts"],
  "/accounts/view/[accountId]": ["/accounts"],
  "/accounts/transactions/[accountId]": ["/accounts"],
  "/accounts/invoices/[invoiceId]": ["/accounts/invoices", "/accounts"],
  "/accounts/invoices": ["/accounts", "/accounts/invoices"],
  "/accounts/reports": ["/accounts"],
  "/accounts/payslips": ["/accounts/payslips"],
  "/accounts/settings": ["/accounts"],
  "/accounts/create": ["/accounts"],
  "/accounts": ["/accounts"],
  "/admin/compliance/breaches": ["/admin/compliance"],
  "/admin/compliance/dpias": ["/admin/compliance"],
  "/admin/compliance/retention": ["/admin/compliance"],
  "/admin/compliance/ropa": ["/admin/compliance"],
  "/admin/compliance/sars": ["/admin/compliance"],
  "/company-accounts/[accountNumber]": [
    "/accounts",
    "/accounts/payslips",
    "/admin/users",
  ],
  "/company-accounts": [
    "/accounts",
    "/accounts/payslips",
    "/admin/users",
  ],
  "/hr/attendance": ["/hr/manager"],
  "/hr/disciplinary": ["/hr/manager"],
  "/hr/employees": ["/hr/manager"],
  "/hr": ["/hr/manager"],
  "/hr/leave": ["/hr/manager"],
  "/hr/payroll": ["/hr/manager"],
  "/hr/performance": ["/hr/manager"],
  "/hr/recruitment": ["/hr/manager"],
  "/hr/reports": ["/hr/manager"],
  "/hr/settings": ["/hr/manager"],
  "/hr/training": ["/hr/manager"],
  "/parts/create-order/[orderNumber]": ["/parts/create-order"],
  "/parts/deliveries": ["/parts/deliveries"],
  "/parts/deliveries/[deliveryId]": ["/parts/deliveries"],
  "/parts/goods-in/[goodsInNumber]": ["/parts/goods-in"],
  "/parts": ["/job-cards/view", "/parts/goods-in", "/parts/deliveries", "/stock-catalogue"],
  "/parts/manager": ["/parts/deliveries"],
  "/tech/dashboard": ["/job-cards/myjobs"],
  "/workshop": ["/workshop/consumables-tracker"],
  "/job-cards": ["/job-cards/view"],
  // /job-cards/appointments is a redirect page that lands on /appointments —
  // grant /appointments anywhere /job-cards/appointments is in nav.
  "/appointments": ["/appointments", "/job-cards/appointments"],
};

const normalizeRoles = (roles) =>
  (Array.isArray(roles) ? roles : [roles])
    .filter(Boolean)
    .map((role) => String(role).toLowerCase().trim());

const hasMatchingRole = (allowedRoles, userRoleSet) => {
  if (!allowedRoles || allowedRoles.length === 0) return true; // open to all signed-in staff
  if (allowedRoles instanceof Set) {
    for (const role of userRoleSet) if (allowedRoles.has(role)) return true;
    return false;
  }
  return allowedRoles.some((role) => userRoleSet.has(String(role).toLowerCase()));
};

const isAlwaysAllowed = (pathname) => {
  if (ALWAYS_ALLOWED_EXACT.has(pathname)) return true;
  return ALWAYS_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

// Walk the sidebar + topbar configs once per role-set and return the
// set of pathnames the user is allowed to land on directly.
export const getAccessibleNavPaths = (roles) => {
  const userRoleSet = new Set(normalizeRoles(roles));
  const accessible = new Set();

  for (const section of sidebarSections) {
    for (const item of section.items || []) {
      if (!item.href) continue;
      if (hasMatchingRole(item.roles || [], userRoleSet)) {
        accessible.add(item.href);
      }
    }
  }

  for (const link of TOPBAR_LINKS) {
    if (hasMatchingRole(link.roles, userRoleSet)) {
      accessible.add(link.href);
    }
  }

  for (const link of ACCOUNTS_NAV_LINKS) {
    if (hasMatchingRole(link.roles, userRoleSet)) {
      accessible.add(link.href);
    }
  }

  return accessible;
};

export const canAccessPath = (pathname, roles) => {
  if (!pathname) return true;
  if (isAlwaysAllowed(pathname)) return true;

  const accessible = getAccessibleNavPaths(roles);
  if (accessible.has(pathname)) return true;

  const extendsFrom = DYNAMIC_DETAIL_EXTENDS[pathname];
  if (Array.isArray(extendsFrom)) {
    return extendsFrom.some((p) => accessible.has(p));
  }

  return false;
};
