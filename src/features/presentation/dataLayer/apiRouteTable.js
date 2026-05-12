// Maps internal /api/* URLs to the mock table they should pull from when in
// presentation mode. Entries are evaluated top-to-bottom; first match wins.
// `transform` (optional) shapes rows into the response envelope a real API
// route returns; the default envelope is `{ success: true, data: rows }`.
//
// Add new entries here as presentation pages report empty data or warnings.
// Unmatched /api requests fall through to a permissive default (empty list)
// with a console.warn so gaps surface during demo walkthroughs.

import { getMockRows } from "../mockData";

function paginate(rows, query) {
  const page = Math.max(1, Number(query.get("page") || 1));
  const pageSize = Math.max(1, Number(query.get("pageSize") || query.get("limit") || rows.length || 20));
  const start = (page - 1) * pageSize;
  const data = rows.slice(start, start + pageSize);
  return { data, pagination: { page, pageSize, total: rows.length } };
}

const passthroughList = () => (rows, q) => ({ success: true, ...paginate(rows, q) });
const passthroughSingle = () => (rows) => ({ success: true, data: rows[0] || null });

export const API_ROUTE_TABLE = [
  // Accounts / invoices / company-accounts
  { pattern: /^\/api\/accounts\/?$/, table: "accounts", transform: (rows, q) => ({ success: true, ...paginate(rows, q), summary: { openCount: rows.length, frozenCount: 0, totalBalance: 0, creditExposure: 0, overdueInvoices: 0 } }) },
  { pattern: /^\/api\/accounts\/settings\/?$/, table: "accounts", transform: () => ({ success: true, data: { defaults: {}, integrations: {} } }) },
  { pattern: /^\/api\/accounts\/[^/]+\/transactions\/?$/, table: "invoices", transform: passthroughList() },
  { pattern: /^\/api\/accounts\/[^/]+\/?$/, table: "accounts", transform: passthroughSingle() },
  { pattern: /^\/api\/account\/recent-activity\/?$/, table: "activity_logs", transform: passthroughList() },
  { pattern: /^\/api\/invoices\/by-job\//, table: "invoices", transform: passthroughList() },
  { pattern: /^\/api\/invoices\/by-order\//, table: "invoices", transform: passthroughList() },
  { pattern: /^\/api\/invoices\/create\/?$/, table: "invoices", transform: passthroughSingle() },
  { pattern: /^\/api\/invoices\/email\/?/, table: "invoices", transform: () => ({ success: true }) },
  { pattern: /^\/api\/invoices\/payments\//, table: "invoices", transform: () => ({ success: true }) },
  { pattern: /^\/api\/invoices\/proforma-overrides\/?/, table: "invoices", transform: passthroughList() },
  { pattern: /^\/api\/invoices\/share\/?/, table: "invoices", transform: passthroughSingle() },
  { pattern: /^\/api\/invoices\/?$/, table: "invoices", transform: passthroughList() },
  { pattern: /^\/api\/invoices\/[^/]+\/?$/, table: "invoices", transform: passthroughSingle() },
  { pattern: /^\/api\/company-accounts\/next-number\/?$/, table: "company_accounts", transform: () => ({ success: true, data: { next: "CO-2099" } }) },
  { pattern: /^\/api\/company-accounts\/?$/, table: "company_accounts", transform: passthroughList() },
  { pattern: /^\/api\/company-accounts\/[^/]+\/?$/, table: "company_accounts", transform: passthroughSingle() },

  // Payslips
  { pattern: /^\/api\/payslips\/?/, table: "payslips", transform: passthroughList() },

  // HR
  { pattern: /^\/api\/hr\/dashboard\/?$/, table: "hr_employees", transform: (rows) => ({ success: true, data: { employees: rows, attendance: getMockRows("hr_attendance"), leave: getMockRows("hr_leave"), training: getMockRows("hr_training") } }) },
  { pattern: /^\/api\/hr\/operations\/?$/, table: "hr_employees", transform: (rows) => ({ success: true, data: { employees: rows, attendance: getMockRows("hr_attendance"), leave: getMockRows("hr_leave"), training: getMockRows("hr_training") } }) },
  { pattern: /^\/api\/hr\/employees\/?$/, table: "hr_employees", transform: passthroughList() },
  { pattern: /^\/api\/hr\/employees\/[^/]+\/?$/, table: "hr_employees", transform: passthroughSingle() },
  { pattern: /^\/api\/hr\/attendance\/?/, table: "hr_attendance", transform: passthroughList() },
  { pattern: /^\/api\/hr\/leave-requests\/[^/]+\/decision\/?$/, table: "hr_leave", transform: () => ({ success: true }) },
  { pattern: /^\/api\/hr\/leave\/?/, table: "hr_leave", transform: passthroughList() },
  { pattern: /^\/api\/hr\/training-courses\/?$/, table: "hr_training", transform: passthroughList() },
  { pattern: /^\/api\/hr\/training-courses\/[^/]+\/?$/, table: "hr_training", transform: passthroughSingle() },
  { pattern: /^\/api\/hr\/training\/?/, table: "hr_training", transform: passthroughList() },

  // Parts
  { pattern: /^\/api\/parts\/allocate-to-request\/?$/, table: "parts", transform: () => ({ success: true }) },
  { pattern: /^\/api\/parts\/catalog\/?$/, table: "parts_inventory", transform: passthroughList() },
  { pattern: /^\/api\/parts\/catalog\/[^/]+\/?$/, table: "parts_inventory", transform: passthroughSingle() },
  { pattern: /^\/api\/parts\/orders\/?$/, table: "parts_orders", transform: passthroughList() },
  { pattern: /^\/api\/parts\/orders\/[^/]+\/?$/, table: "parts_orders", transform: passthroughSingle() },
  { pattern: /^\/api\/parts\/deliveries\/add-stop\/?$/, table: "parts_deliveries", transform: () => ({ success: true }) },
  { pattern: /^\/api\/parts\/deliveries\/confirm-job\/?$/, table: "parts_deliveries", transform: () => ({ success: true }) },
  { pattern: /^\/api\/parts\/deliveries\/items\/[^/]+\/?$/, table: "parts_deliveries", transform: passthroughSingle() },
  { pattern: /^\/api\/parts\/deliveries\/[^/]+\/items\/?/, table: "parts_deliveries", transform: passthroughList() },
  { pattern: /^\/api\/parts\/deliveries\/[^/]+\/?$/, table: "parts_deliveries", transform: passthroughSingle() },
  { pattern: /^\/api\/parts\/deliveries\/?$/, table: "parts_deliveries", transform: passthroughList() },
  { pattern: /^\/api\/parts\/delivery-logs\/[^/]+\/?$/, table: "parts_deliveries", transform: passthroughSingle() },
  { pattern: /^\/api\/parts\/delivery-logs\/?$/, table: "parts_deliveries", transform: passthroughList() },
  { pattern: /^\/api\/parts\/goods-in\/?/, table: "parts_goods_in", transform: passthroughList() },
  { pattern: /^\/api\/parts\/inventory\/?/, table: "parts_inventory", transform: passthroughList() },

  // Jobs / job-cards / job-requests
  { pattern: /^\/api\/jobs\/log-activity\/?$/, table: "activity_logs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/jobs\/[^/]+\/timeline\/?$/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/jobs\/[^/]+\/?$/, table: "jobs", transform: passthroughSingle() },
  { pattern: /^\/api\/jobs\/?$/, table: "jobs", transform: passthroughList() },
  { pattern: /^\/api\/jobcards\/archive\/search\/?$/, table: "jobs", transform: passthroughList() },
  { pattern: /^\/api\/jobcards\/archive\/create\/?$/, table: "jobs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/jobcards\/create(-vhc-item)?\/?$/, table: "jobs", transform: () => ({ success: true, data: getMockRows("jobs")[0] || null }) },
  { pattern: /^\/api\/jobcards\/link-uploaded-files\/?$/, table: "jobs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/jobcards\/upload-document\/?$/, table: "jobs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/jobcards\/[^/]+\/files\/?$/, table: "jobs", transform: () => ({ success: true, data: [] }) },
  { pattern: /^\/api\/jobcards\/[^/]+\/parse-checksheet\/?$/, table: "jobs", transform: () => ({ success: true, data: [] }) },
  { pattern: /^\/api\/jobcards\/[^/]+\/upload-dealer-file\/?$/, table: "jobs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/jobcards\/[^/]+\/?$/, table: "jobs", transform: passthroughSingle() },
  { pattern: /^\/api\/job-cards\/[^/]+\/booking-request\/?$/, table: "jobs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/job-cards\/[^/]+\/send-vhc\/?$/, table: "vhc_reports", transform: () => ({ success: true }) },
  { pattern: /^\/api\/job-cards\/[^/]+\/share-link\/?$/, table: "vhc_reports", transform: () => ({ success: true, data: { url: "https://demo.invalid/share/ABCD" } }) },
  { pattern: /^\/api\/job-requests\/presets\//, table: "jobs", transform: () => ({ success: true, data: [] }) },

  // Customers / vehicles / bookings
  { pattern: /^\/api\/customers\/bookings\/calendar\/?$/, table: "appointments", transform: passthroughList() },
  { pattern: /^\/api\/customers\/deliveries\/?$/, table: "parts_deliveries", transform: passthroughList() },
  { pattern: /^\/api\/customers\/?$/, table: "customers", transform: passthroughList() },
  { pattern: /^\/api\/customers\/[^/]+\/?$/, table: "customers", transform: passthroughSingle() },
  { pattern: /^\/api\/vehicles\/dvla\/?/, table: "vehicles", transform: () => ({ success: true, data: getMockRows("vehicles")[0] || null }) },
  { pattern: /^\/api\/vehicles\/?$/, table: "vehicles", transform: passthroughList() },

  // Customer portal
  { pattern: /^\/api\/customer\/payment-methods\/?$/, table: "accounts", transform: () => ({ success: true, data: [{ id: "pm-demo-001", brand: "Visa", last4: "4242", expiry: "12/29" }] }) },
  { pattern: /^\/api\/customer\/profile\/?$/, table: "customers", transform: passthroughSingle() },
  { pattern: /^\/api\/customer\/widgets\/?$/, table: "customers", transform: () => ({ success: true, data: { upcoming: getMockRows("appointments"), invoices: getMockRows("invoices") } }) },

  // Messages / notifications
  { pattern: /^\/api\/messages\/connect-customer\/?$/, table: "messages", transform: () => ({ success: true }) },
  { pattern: /^\/api\/messages\/system-notifications\/send\/?$/, table: "messages", transform: () => ({ success: true }) },
  { pattern: /^\/api\/messages\/system-notifications\/?$/, table: "messages", transform: passthroughList() },
  { pattern: /^\/api\/messages\/threads\/[^/]+\/members\/?$/, table: "users", transform: passthroughList() },
  { pattern: /^\/api\/messages\/threads\/[^/]+\/messages\/?$/, table: "messages", transform: passthroughList() },
  { pattern: /^\/api\/messages\/threads\/?$/, table: "messages", transform: passthroughList() },
  { pattern: /^\/api\/messages\/messages\/[^/]+\/save\/?$/, table: "messages", transform: () => ({ success: true }) },
  { pattern: /^\/api\/messages\/users\/?$/, table: "users", transform: passthroughList() },
  { pattern: /^\/api\/messages\/?$/, table: "messages", transform: passthroughList() },

  // Mobile
  { pattern: /^\/api\/mobile\/jobs\/[^/]+\/redirect-to-workshop\/?$/, table: "jobs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/mobile\/jobs\/[^/]+\/?$/, table: "jobs", transform: passthroughSingle() },
  { pattern: /^\/api\/mobile\/jobs\/?$/, table: "jobs", transform: passthroughList() },
  { pattern: /^\/api\/mobile\/parts-request\/?$/, table: "parts", transform: () => ({ success: true }) },

  // Staff / status / users / roster
  { pattern: /^\/api\/staff\/job-summary\/?$/, table: "jobs", transform: () => ({ success: true, data: { open: getMockRows("jobs").length, completed: 0 } }) },
  { pattern: /^\/api\/staff\/vehicle-history(\/sync)?\/?$/, table: "vehicles", transform: passthroughList() },
  { pattern: /^\/api\/staff\/vehicles\/?$/, table: "vehicles", transform: passthroughList() },
  { pattern: /^\/api\/status\/snapshot\/?$/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/status\/getCurrentStatus\/?$/, table: "tracking_events", transform: passthroughSingle() },
  { pattern: /^\/api\/status\/getHistory\/?$/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/status\/search\/?$/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/status\/update\/?$/, table: "tracking_events", transform: () => ({ success: true }) },
  { pattern: /^\/api\/users\/roster\/?$/, table: "users", transform: passthroughList() },

  // Tracking / clocking / appointments / activity
  { pattern: /^\/api\/tracking\/equipment\/?$/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/tracking\/next-action\/?$/, table: "tracking_events", transform: passthroughSingle() },
  { pattern: /^\/api\/tracking\/oil-stock\/?$/, table: "consumables", transform: passthroughList() },
  { pattern: /^\/api\/tracking\/snapshot\/?$/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/tracking\/?/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/clocking\/?/, table: "clocking", transform: passthroughList() },
  { pattern: /^\/api\/appointments\/?$/, table: "appointments", transform: passthroughList() },
  { pattern: /^\/api\/activity-logs\/?$/, table: "activity_logs", transform: passthroughList() },

  // VHC
  { pattern: /^\/api\/vhc\/customer-video-upload\/?$/, table: "vhc_reports", transform: () => ({ success: true }) },
  { pattern: /^\/api\/vhc\/declinations\/?$/, table: "vhc_reports", transform: passthroughList() },
  { pattern: /^\/api\/vhc\/item-aliases\/?$/, table: "vhc_reports", transform: passthroughList() },
  { pattern: /^\/api\/vhc\/labour-time-overrides\/?$/, table: "vhc_reports", transform: passthroughList() },
  { pattern: /^\/api\/vhc\/labour-time-suggestions\/?$/, table: "vhc_reports", transform: passthroughList() },
  { pattern: /^\/api\/vhc\/parts-search(-learning|-suggestions)?\/?$/, table: "parts_inventory", transform: passthroughList() },
  { pattern: /^\/api\/vhc\/pre-pick-location\/?$/, table: "parts_inventory", transform: passthroughSingle() },
  { pattern: /^\/api\/vhc\/share-update-item-status\/?$/, table: "vhc_reports", transform: () => ({ success: true }) },
  { pattern: /^\/api\/vhc\/update-customer-description\/?$/, table: "vhc_reports", transform: () => ({ success: true }) },
  { pattern: /^\/api\/vhc\/update-item-status\/?$/, table: "vhc_reports", transform: () => ({ success: true }) },
  { pattern: /^\/api\/vhc\/upload-media\/?$/, table: "vhc_reports", transform: () => ({ success: true }) },
  { pattern: /^\/api\/vhc\//, table: "vhc_reports", transform: passthroughList() },

  // Workshop / consumables
  { pattern: /^\/api\/workshop\/consumables\/financials\/?$/, table: "consumables", transform: () => ({ success: true, data: { spend: 480, budget: 1200 } }) },
  { pattern: /^\/api\/workshop\/consumables\/items\/?$/, table: "consumables", transform: passthroughList() },
  { pattern: /^\/api\/workshop\/consumables\/logs\/?$/, table: "consumables", transform: passthroughList() },
  { pattern: /^\/api\/workshop\/consumables\/requests\/?$/, table: "consumables", transform: passthroughList() },
  { pattern: /^\/api\/workshop\/consumables\/stock-check\/?$/, table: "consumables", transform: passthroughList() },

  // Admin / compliance / settings / welcome-quote / dev-showcase
  { pattern: /^\/api\/admin\/users\/?$/, table: "users", transform: passthroughList() },
  { pattern: /^\/api\/admin\/compliance\//, table: "activity_logs", transform: passthroughList() },
  { pattern: /^\/api\/settings\/company-profile\/?$/, table: "users", transform: () => ({ success: true, data: { name: "Humphries & Parks (Demo)", phone: "01392 555 000" } }) },
  { pattern: /^\/api\/welcome-quote\/?$/, table: "users", transform: () => ({ success: true, data: { quote: "Welcome to the demo. Every figure shown here is mock data." } }) },
  { pattern: /^\/api\/dev\/showcase-notes\/?$/, table: "notes", transform: passthroughList() },

  // AI helpers — no-op success so UI doesn't error
  { pattern: /^\/api\/ai\//, table: "notes", transform: () => ({ success: true, data: { text: "" } }) },

  // Notes / consent / cookies / email
  { pattern: /^\/api\/notes\/?/, table: "notes", transform: passthroughList() },
  { pattern: /^\/api\/(consent|cookies\/consent)\/?$/, table: "users", transform: () => ({ success: true }) },
  { pattern: /^\/api\/email-api\/?/, table: "users", transform: () => ({ success: true }) },
  { pattern: /^\/api\/location\//, table: "users", transform: () => ({ success: true, data: { minutes: 12 } }) },
];

export function resolveApiRoute(pathname) {
  for (const entry of API_ROUTE_TABLE) {
    if (entry.pattern.test(pathname)) return entry;
  }
  return null;
}

export function buildMockApiResponse(url, method = "GET") {
  let parsed;
  try {
    parsed = new URL(url, "http://localhost");
  } catch {
    return { status: 200, body: { success: true, data: [] } };
  }
  const entry = resolveApiRoute(parsed.pathname);

  if (method !== "GET") {
    if (!entry) {
      if (typeof console !== "undefined") {
        console.warn(`[presentation] non-GET ${method} ${parsed.pathname} — returning success no-op`);
      }
      return { status: 200, body: { success: true, data: null } };
    }
    const rows = getMockRows(entry.table) || [];
    const body = entry.transform ? entry.transform(rows, parsed.searchParams) : { success: true, data: null };
    return { status: 200, body };
  }

  if (!entry) {
    if (typeof console !== "undefined") {
      console.warn(`[presentation] no mock for ${parsed.pathname}; returning empty list`);
    }
    return { status: 200, body: { success: true, data: [], pagination: { page: 1, pageSize: 0, total: 0 } } };
  }

  const rows = getMockRows(entry.table) || [];
  const body = entry.transform ? entry.transform(rows, parsed.searchParams) : { success: true, data: rows };
  return { status: 200, body };
}
