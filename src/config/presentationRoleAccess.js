// In-code mirror of docs/role-page-access-draft.md.
// Source-of-truth doc lives at docs/role-page-access-draft.md — when that file
// changes, update this config so /loginPresentation tiles, the per-role
// sidebar filter, and the presentation slide order stay in sync.
//
// Each entry: a presenting role available on /loginPresentation. `routes` are
// listed in the order the presentation should walk through the role's pages.

export const PRESENTATION_ROLES = [
  {
    key: "accounts-manager",
    roleId: "accounts manager",
    label: "Accounts Manager",
    demoName: "Demo Accounts Manager",
    routes: [
      "/dashboard/accounts",
      "/accounts",
      "/accounts/create",
      "/accounts/edit/[accountId]",
      "/accounts/view/[accountId]",
      "/accounts/transactions/[accountId]",
      "/accounts/invoices",
      "/accounts/invoices/[invoiceId]",
      "/accounts/payslips",
      "/accounts/reports",
      "/accounts/settings",
      "/company-accounts",
      "/company-accounts/[accountNumber]",
      "/messages",
      "/newsfeed",
      "/profile",
    ],
  },
  {
    key: "admin-manager",
    roleId: "admin manager",
    label: "Admin Manager",
    demoName: "Demo Admin Manager",
    routes: [
      "/dashboard/admin",
      "/job-cards/waiting/nextjobs",
      "/job-cards/view",
      "/job-cards/[jobNumber]",
      "/admin/users",
      "/admin/profiles/[user]",
      "/accounts/payslips",
      "/hr/manager",
      "/messages",
      "/newsfeed",
      "/profile",
    ],
  },
  {
    key: "after-sales-director",
    roleId: "after sales director",
    label: "After Sales Director",
    demoName: "Demo After Sales Director",
    routes: [
      "/dashboard/after-sales",
      "/dashboard",
      "/job-cards/view",
      "/job-cards/[jobNumber]",
      "/job-cards/waiting/nextjobs",
      "/parts/goods-in",
      "/messages",
      "/newsfeed",
      "/profile",
      "/tracking",
    ],
  },
  {
    key: "customer",
    roleId: "customer",
    label: "Customer",
    demoName: "Demo Customer",
    routes: [
      "/customer",
      "/customer/messages",
      "/customer/parts",
      "/customer/payments",
      "/customer/vehicles",
      "/customer/vhc",
      "/vhc/customer-preview/[jobNumber]",
      "/vhc/customer-view/[jobNumber]",
      "/vhc/share/[jobNumber]/[linkCode]",
    ],
  },
  {
    key: "general-manager",
    roleId: "general manager",
    label: "General Manager",
    demoName: "Demo General Manager",
    routes: [
      "/dashboard/managers",
      "/dashboard",
      "/job-cards/view",
      "/job-cards/[jobNumber]",
      "/job-cards/waiting/nextjobs",
      "/tracking",
      "/messages",
      "/newsfeed",
      "/profile",
    ],
  },
  {
    key: "hr-manager",
    roleId: "hr manager",
    label: "HR Manager",
    demoName: "Demo HR Manager",
    routes: [
      "/hr",
      "/hr/manager",
      "/hr/attendance",
      "/hr/disciplinary",
      "/hr/employees",
      "/hr/leave",
      "/hr/payroll",
      "/hr/performance",
      "/hr/recruitment",
      "/hr/reports",
      "/hr/settings",
      "/hr/training",
      "/messages",
      "/newsfeed",
      "/profile",
    ],
  },
  {
    key: "mobile-technician",
    roleId: "mobile technician",
    label: "Mobile Technician",
    demoName: "Demo Mobile Technician",
    routes: [
      "/mobile/dashboard",
      "/mobile/jobs",
      "/mobile/jobs/[jobNumber]",
      "/mobile/appointments",
      "/mobile/create",
      "/mobile/delivery/[jobNumber]",
      "/tech/consumables-request",
      "/messages",
      "/newsfeed",
      "/profile",
    ],
  },
  {
    key: "mot-tester",
    roleId: "mot tester",
    label: "MOT Tester",
    demoName: "Demo MOT Tester",
    routes: [
      "/dashboard/mot",
      "/job-cards/myjobs",
      "/job-cards/myjobs/[jobNumber]",
      "/job-cards/[jobNumber]",
      "/tech/efficiency",
      "/vhc",
      "/messages",
      "/newsfeed",
      "/profile",
    ],
  },
  {
    key: "owner",
    roleId: "owner",
    label: "Owner",
    demoName: "Demo Owner",
    routes: [
      "/dashboard/managers",
      "/hr/manager",
      "/admin/users",
      "/admin/profiles/[user]",
      "/accounts/payslips",
      "/messages",
      "/newsfeed",
      "/profile",
    ],
  },
  {
    key: "painters",
    roleId: "painters",
    label: "Painters",
    demoName: "Demo Painter",
    routes: [
      "/dashboard/painting",
      "/job-cards/myjobs",
      "/job-cards/myjobs/[jobNumber]",
      "/job-cards/[jobNumber]",
      "/messages",
      "/newsfeed",
      "/profile",
    ],
  },
  {
    key: "parts-manager",
    roleId: "parts manager",
    label: "Parts Manager",
    demoName: "Demo Parts Manager",
    routes: [
      "/dashboard/parts",
      "/parts",
      "/parts/manager",
      "/job-cards/view",
      "/job-cards/[jobNumber]",
      "/stock-catalogue",
      "/parts/create-order",
      "/parts/create-order/[orderNumber]",
      "/parts/deliveries",
      "/parts/deliveries/[deliveryId]",
      "/parts/delivery-planner",
      "/parts/goods-in",
      "/parts/goods-in/[goodsInNumber]",
      "/messages",
      "/newsfeed",
      "/profile",
    ],
  },
  {
    key: "receptionist",
    roleId: "receptionist",
    label: "Receptionist",
    demoName: "Demo Receptionist",
    routes: [
      "/dashboard",
      "/appointments",
      "/customers",
      "/customers/[customerSlug]",
      "/job-cards/create",
      "/job-cards/view",
      "/job-cards/[jobNumber]",
      "/messages",
      "/newsfeed",
      "/profile",
    ],
  },
  {
    key: "sales-director",
    roleId: "sales director",
    label: "Sales Director",
    demoName: "Demo Sales Director",
    routes: ["/dashboard/managers", "/newsfeed", "/messages", "/profile"],
  },
  {
    key: "service-manager",
    roleId: "service manager",
    label: "Service Manager",
    demoName: "Demo Service Manager",
    routes: [
      "/dashboard/service",
      "/dashboard",
      "/customers",
      "/customers/[customerSlug]",
      "/job-cards/create",
      "/job-cards/waiting/nextjobs",
      "/job-cards/view",
      "/job-cards/[jobNumber]",
      "/parts/goods-in",
      "/mobile/appointments",
      "/mobile/create",
      "/messages",
      "/newsfeed",
      "/profile",
      "/tracking",
    ],
  },
  {
    key: "techs",
    roleId: "techs",
    label: "Techs",
    demoName: "Demo Technician",
    routes: [
      "/dashboard/workshop",
      "/tech/dashboard",
      "/job-cards/myjobs",
      "/job-cards/myjobs/[jobNumber]",
      "/job-cards/[jobNumber]",
      "/tech/consumables-request",
      "/tech/efficiency",
      "/vhc",
      "/messages",
      "/newsfeed",
      "/profile",
      "/tracking",
    ],
  },
  {
    key: "valet-service",
    roleId: "valet service",
    label: "Valet Service",
    demoName: "Demo Valet",
    routes: [
      "/dashboard/valeting",
      "/valet",
      "/job-cards/valet/[jobnumber]",
      "/messages",
      "/newsfeed",
      "/profile",
    ],
  },
  {
    key: "workshop-manager",
    roleId: "workshop manager",
    label: "Workshop Manager",
    demoName: "Demo Workshop Manager",
    routes: [
      "/dashboard/workshop",
      "/dashboard",
      "/workshop",
      "/workshop/consumables-tracker",
      "/job-cards/waiting/nextjobs",
      "/job-cards/view",
      "/job-cards/[jobNumber]",
      "/clocking",
      "/clocking/[technicianSlug]",
      "/parts/goods-in",
      "/messages",
      "/newsfeed",
      "/profile",
      "/tracking",
    ],
  },
];

export function getPresentationRoleByKey(key) {
  if (!key) return null;
  return PRESENTATION_ROLES.find((r) => r.key === key) || null;
}

// Convert a route template like "/job-cards/[jobNumber]" into a regex matcher.
function buildRouteMatcher(template) {
  if (!template) return null;
  if (!template.includes("[")) {
    return (candidate) => candidate === template;
  }
  const pattern = new RegExp(
    "^" + template.replace(/\//g, "\\/").replace(/\[[^\]]+\]/g, "[^/]+") + "$"
  );
  return (candidate) => pattern.test(candidate);
}

// True if the given concrete route belongs to this role's allowed list.
export function routeAllowedForRole(role, route) {
  if (!role || !route) return false;
  const stripped = String(route).split("?")[0].split("#")[0];
  return role.routes.some((template) => {
    const match = buildRouteMatcher(template);
    return match ? match(stripped) : false;
  });
}

// Given the role's ordered route list, return slides that match (in that order).
export function orderSlidesForRole(role, allSlides) {
  if (!role) return [];
  const used = new Set();
  const ordered = [];
  for (const template of role.routes) {
    const match = buildRouteMatcher(template);
    if (!match) continue;
    for (const slide of allSlides) {
      if (used.has(slide.id)) continue;
      if (match(slide.route)) {
        ordered.push(slide);
        used.add(slide.id);
      }
    }
  }
  return ordered;
}
