// UI Registry — single source mapping a uiKey to a renderable mock component.
//
// The Presentation runner uses MOCKS_BY_SLIDE_ID to render the right page-ui
// for the current slide. The /dev/ui/[uiKey] route reuses the same registry
// to render any single page-ui standalone with demo data, no presentation
// chrome. Adding a new page-ui means: create the page-ui file, create the
// matching mock under src/features/presentation/mocks/<key>.js, register it
// in mocks/index.js — and it shows up here automatically.
//
// To add a friendly label or grouping, extend UI_LABELS / UI_GROUPS below.

import { MOCKS_BY_SLIDE_ID } from "./mocks";

// Friendly labels for the dev preview index. Keys not listed fall back to a
// title-cased version of the uiKey itself.
const UI_LABELS = {
  "dashboard": "Dashboard (default)",
  "dashboard-workshop": "Dashboard — Workshop",
  "dashboard-managers": "Dashboard — Managers",
  "dashboard-accounts": "Dashboard — Accounts",
  "dashboard-admin": "Dashboard — Admin",
  "dashboard-mot": "Dashboard — MOT",
  "dashboard-painting": "Dashboard — Painting",
  "dashboard-parts": "Dashboard — Parts",
  "dashboard-service": "Dashboard — Service",
  "dashboard-valeting": "Dashboard — Valeting",
  "job-cards-list": "Job Cards — List",
  "job-cards-waiting-nextjobs": "Job Cards — Waiting / Next Jobs",
  "job-cards-valet": "Job Cards — Valet detail",
  "job-create": "Job Cards — Create",
  "job-detail": "Job Card detail",
  "my-jobs": "Job Cards — My Jobs",
  "my-jobs-detail": "Job Cards — My Job detail",
  "archive": "Job Cards — Archive",
  "appointments": "Appointments",
  "vhc": "VHC",
  "vhc-customer-preview": "VHC — Customer preview",
  "vhc-customer-view": "VHC — Customer view",
  "vhc-share": "VHC — Share link",
  "parts": "Parts",
  "parts-manager": "Parts — Manager",
  "parts-create-order": "Parts — Create order",
  "parts-create-order-detail": "Parts — Order detail",
  "parts-goods-in": "Parts — Goods in",
  "parts-goods-in-detail": "Parts — Goods in detail",
  "parts-deliveries": "Parts — Deliveries",
  "parts-deliveries-detail": "Parts — Delivery detail",
  "parts-delivery-planner": "Parts — Delivery planner",
  "stock-catalogue": "Stock catalogue",
  "valet": "Valet",
  "messages": "Messages",
  "newsfeed": "Newsfeed",
  "profile": "Profile",
  "tracking": "Tracking",
  "clocking": "Clocking",
  "clocking-technician": "Clocking — Technician",
  "workshop-consumables-tracker": "Workshop — Consumables tracker",
  "tech-dashboard": "Tech — Dashboard",
  "tech-efficiency": "Tech — Efficiency",
  "tech-consumables-request": "Tech — Consumables request",
  "mobile-dashboard": "Mobile — Dashboard",
  "mobile-delivery": "Mobile — Delivery",
  "hr-dashboard": "HR — Dashboard",
  "hr-manager": "HR — Manager",
  "hr-attendance": "HR — Attendance",
  "hr-disciplinary": "HR — Disciplinary",
  "hr-employees": "HR — Employees",
  "hr-leave": "HR — Leave",
  "hr-payroll": "HR — Payroll",
  "hr-performance": "HR — Performance",
  "hr-recruitment": "HR — Recruitment",
  "hr-reports": "HR — Reports",
  "hr-settings": "HR — Settings",
  "hr-training": "HR — Training",
  "accounts": "Accounts",
  "accounts-create": "Accounts — Create",
  "accounts-edit": "Accounts — Edit",
  "accounts-view": "Accounts — View",
  "accounts-transactions": "Accounts — Transactions",
  "accounts-invoices": "Accounts — Invoices",
  "accounts-invoice-detail": "Accounts — Invoice detail",
  "accounts-payslips": "Accounts — Payslips",
  "accounts-reports": "Accounts — Reports",
  "accounts-settings": "Accounts — Settings",
  "company-accounts": "Company accounts",
  "company-accounts-detail": "Company accounts — Detail",
  "admin-users": "Admin — Users",
  "admin-profile": "Admin — Profile",
  "customer-portal": "Customer portal",
  "customer-messages": "Customer — Messages",
  "customer-parts": "Customer — Parts",
  "customer-payments": "Customer — Payments",
  "customer-vehicles": "Customer — Vehicles",
  "customer-vhc": "Customer — VHC",
  "customers": "Customers",
  "customer-detail": "Customer detail",
  "login": "Login",
  "unauthorized": "Unauthorized",
  "password-reset-reverted": "Password reset — Reverted",
};

// Group keys for the dev preview index (alphabetical inside each group).
const UI_GROUPS = [
  {
    label: "Dashboards",
    match: (k) => k === "dashboard" || k.startsWith("dashboard-") || k === "tech-dashboard" || k === "mobile-dashboard",
  },
  {
    label: "Job Cards",
    match: (k) =>
      k === "job-cards-list" ||
      k === "job-cards-waiting-nextjobs" ||
      k === "job-cards-valet" ||
      k === "job-create" ||
      k === "job-detail" ||
      k === "my-jobs" ||
      k === "my-jobs-detail" ||
      k === "archive",
  },
  {
    label: "Parts",
    match: (k) => k.startsWith("parts") || k === "stock-catalogue",
  },
  {
    label: "VHC",
    match: (k) => k.startsWith("vhc") || k === "customer-vhc",
  },
  {
    label: "HR",
    match: (k) => k.startsWith("hr-"),
  },
  {
    label: "Accounts",
    match: (k) => k.startsWith("accounts") || k.startsWith("company-accounts"),
  },
  {
    label: "Admin",
    match: (k) => k.startsWith("admin-"),
  },
  {
    label: "Customer Portal",
    match: (k) => k.startsWith("customer") || k === "customers",
  },
  {
    label: "Mobile",
    match: (k) => k.startsWith("mobile-"),
  },
  {
    label: "Tech",
    match: (k) => k.startsWith("tech-"),
  },
  {
    label: "Workshop & Tracking",
    match: (k) =>
      k === "tracking" ||
      k === "clocking" ||
      k === "clocking-technician" ||
      k === "workshop-consumables-tracker" ||
      k === "valet",
  },
  {
    label: "Comms & Profile",
    match: (k) => k === "messages" || k === "newsfeed" || k === "profile" || k === "appointments",
  },
  {
    label: "Public",
    match: (k) => k === "login" || k === "unauthorized" || k === "password-reset-reverted",
  },
];

function titleize(key) {
  return String(key)
    .split(/[-_/]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function getUiKeys() {
  return Object.keys(MOCKS_BY_SLIDE_ID).sort();
}

export function getUiLabel(uiKey) {
  return UI_LABELS[uiKey] || titleize(uiKey);
}

export function getMockComponent(uiKey) {
  return MOCKS_BY_SLIDE_ID[uiKey] || null;
}

export function getGroupedUiKeys() {
  const allKeys = getUiKeys();
  const used = new Set();
  const groups = UI_GROUPS.map((g) => {
    const keys = allKeys.filter((k) => g.match(k));
    keys.forEach((k) => used.add(k));
    return {
      label: g.label,
      items: keys
        .map((k) => ({ key: k, label: getUiLabel(k) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  }).filter((g) => g.items.length > 0);

  const ungrouped = allKeys
    .filter((k) => !used.has(k))
    .map((k) => ({ key: k, label: getUiLabel(k) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (ungrouped.length > 0) {
    groups.push({ label: "Other", items: ungrouped });
  }

  return groups;
}
