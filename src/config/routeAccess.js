// file location: src/config/routeAccess.js
//
// SINGLE SOURCE OF TRUTH for route-level access rules.
//
// Before this file, the same route lists were duplicated across:
//   - src/proxy.js                  (public / protected prefixes + HR/admin rules)
//   - src/lib/auth/pageAccess.js    (always-allowed paths, topbar links, accounts
//                                     links, dynamic-detail inheritance)
//   - src/components/Layout.js       (topbar action links, accounts sidebar section)
//
// They are consolidated here so the three consumers below import one definition:
//   - src/proxy.js                       → edge route protection
//   - src/lib/auth/pageAccess.js         → client "can the user land here" check
//   - src/components/layout/StaffSidebar  → (indirectly, via navigation config)
//   - src/components/ProtectedRoute.js   → page-level role guard helper
//
// IMPORTANT: this module must stay edge-runtime safe (it is imported by
// src/proxy.js / middleware). Keep it to plain data + pure helpers — no Node
// APIs, no React, no Supabase.

import { SERVICE_ACTION_ROLE_SET } from "@/lib/auth/serviceActionRoles";

// ---------------------------------------------------------------------------
// 1. Edge / proxy route protection (consumed by src/proxy.js)
// ---------------------------------------------------------------------------

// Static asset extensions that never need auth.
export const PUBLIC_FILE_PATTERN =
  /\.(?:avif|bmp|css|gif|ico|jpg|jpeg|js|json|map|png|svg|txt|webmanifest|webp|woff|woff2)$/i;

// Exact pathnames that are always public.
export const PUBLIC_PATHS = new Set([
  "/",
  "/favicon.ico",
  "/login",
  "/loginPresentation",
  "/unauthorized",
  "/website",
  "/vision",
  "/presentation",
  "/slideshow",
]);

// Path prefixes that are always public (auth flow, customer website, public
// VHC share links, presentation/vision decks, static dirs).
export const PUBLIC_PREFIXES = [
  "/_next",
  "/api/auth",
  "/api/cookies",
  "/api/health",
  "/api/website/auth",
  "/images",
  "/website",
  "/vision",
  "/presentation",
  "/vhc/customer",
  "/vhc/customer-preview",
];

// Path prefixes that require an authenticated session.
export const PROTECTED_PREFIXES = [
  "/account",
  "/accounts",
  "/admin",
  "/appointments",
  "/clocking",
  "/company-accounts",
  "/customers",
  "/dashboard",
  "/dev",
  "/hr",
  "/job-cards",
  "/messages",
  "/mobile",
  "/parts",
  "/profile",
  "/tech",
  "/tracking",
  "/valet",
  "/vhc",
  "/workshop",
];

// HR routes that scoped managers (not just HR-core roles) may reach.
export const HR_ALLOWED_PATHS_FOR_MANAGERS = ["/hr/employees", "/hr/leave"];

// Shared path matcher: exact match, or `${prefix}/...` segment match.
export const startsWithPath = (pathname, prefix) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isPublicPath = (pathname) =>
  PUBLIC_PATHS.has(pathname) ||
  PUBLIC_FILE_PATTERN.test(pathname) ||
  PUBLIC_PREFIXES.some((prefix) => startsWithPath(pathname, prefix));

export const isProtectedPath = (pathname) =>
  PROTECTED_PREFIXES.some((prefix) => startsWithPath(pathname, prefix));

// ---------------------------------------------------------------------------
// 2. Nav-derived page access (consumed by src/lib/auth/pageAccess.js)
//    Rule: "users can only land on pages that appear in their sidebar/topbar."
// ---------------------------------------------------------------------------

const PARTS_NAV_ROLE_SET = new Set(["parts", "parts manager"]);
const ACCOUNTS_NAV_ROLE_SET = new Set(["accounts", "accounts manager"]);

// Mirror of the topbar action links rendered in the staff layout
// (src/components/layout/StaffTopbar.js → SERVICE_ACTION_LINKS / PARTS_ACTION_LINKS).
// Keep in sync if those topbar lists change.
export const TOPBAR_LINKS = [
  { href: "/job-cards/create", roles: SERVICE_ACTION_ROLE_SET },
  { href: "/job-cards/appointments", roles: SERVICE_ACTION_ROLE_SET },
  { href: "/parts/delivery-planner", roles: PARTS_NAV_ROLE_SET },
  { href: "/parts/create-order", roles: PARTS_NAV_ROLE_SET },
  { href: "/parts/goods-in", roles: PARTS_NAV_ROLE_SET },
];

// Mirror of the dynamic "Accounts" sidebar section built at render time inside
// the staff layout (accountsSidebarSections). It is not in config/navigation.js,
// so the sidebar walk in pageAccess.js cannot see it — mirror it here.
export const ACCOUNTS_NAV_LINKS = [
  { href: "/accounts", roles: ACCOUNTS_NAV_ROLE_SET },
  { href: "/company-accounts", roles: ACCOUNTS_NAV_ROLE_SET },
  { href: "/accounts/invoices", roles: ACCOUNTS_NAV_ROLE_SET },
  { href: "/accounts/reports", roles: ACCOUNTS_NAV_ROLE_SET },
];

// Paths any authenticated user can reach regardless of role (auth flow, own
// profile, dashboards, customer portal/website, presentation, public shares).
export const ALWAYS_ALLOWED_EXACT = new Set([
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

export const ALWAYS_ALLOWED_PREFIXES = [
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

// Detail/landing pages not present in any sidebar/topbar config; they inherit
// access from the list pages that link to them. Keys are Next.js pathname
// patterns ([param] placeholders); values are the list pages granting entry.
export const DYNAMIC_DETAIL_EXTENDS = {
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
  // /customers isn't in the sidebar but staff with job-card or admin access
  // reach it via search/links — grant it to anyone with job-card visibility.
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
  "/company-accounts": ["/accounts", "/accounts/payslips", "/admin/users"],
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
  "/parts": [
    "/job-cards/view",
    "/parts/goods-in",
    "/parts/deliveries",
    "/stock-catalogue",
  ],
  "/parts/manager": ["/parts/deliveries"],
  "/tech/dashboard": ["/job-cards/myjobs"],
  "/workshop": ["/workshop/consumables-tracker"],
  "/newpage": ["/workshop/consumables-tracker"],
  "/job-cards": ["/job-cards/view"],
  // /job-cards/appointments redirects to /appointments — grant /appointments
  // anywhere /job-cards/appointments is in nav.
  "/appointments": ["/appointments", "/job-cards/appointments"],
};
