// Resolves a presentation deep link (role, slideIndex) to the real Next.js
// route template + concrete dynamic params filled from mock data, so the
// mounted real page sees router.query values that match a known mock row.

import { getPresentationRoleByKey } from "@/config/presentationRoleAccess";
import { getMockRows } from "../mockData";

// Map a bracketed param (without []) to a table whose first row provides its
// value. Order matters when a slug appears in multiple tables.
const PARAM_SOURCES = {
  jobNumber: { table: "jobs", column: "job_number" },
  jobnumber: { table: "jobs", column: "job_number" },
  job: { table: "jobs", column: "job_number" },
  customerSlug: { table: "customers", column: "id" },
  customerId: { table: "customers", column: "id" },
  invoiceId: { table: "invoices", column: "invoice_number" },
  accountId: { table: "accounts", column: "account_id" },
  accountNumber: { table: "company_accounts", column: "account_number" },
  orderNumber: { table: "parts_orders", column: "order_number" },
  deliveryId: { table: "parts_deliveries", column: "delivery_id" },
  goodsInNumber: { table: "parts_goods_in", column: "goods_in_number" },
  technicianSlug: { table: "users", column: "id" },
  user: { table: "users", column: "email" },
  linkCode: { table: "vhc_reports", column: "link_code" },
};

const ROUTE_PARAM_OVERRIDES = {
  "/customer": () => ({ customerSlug: fillParam("customerSlug"), tab: "insights" }),
  "/customer/messages": () => ({ customerSlug: fillParam("customerSlug"), tab: "messages" }),
  "/customer/parts": () => ({ customerSlug: fillParam("customerSlug"), tab: "history" }),
  "/customer/payments": () => ({ customerSlug: fillParam("customerSlug"), tab: "payment" }),
  "/customer/vehicles": () => ({ customerSlug: fillParam("customerSlug"), tab: "insights" }),
  "/customer/vhc": () => ({ customerSlug: fillParam("customerSlug"), tab: "history" }),
};

function fillParam(name) {
  const source = PARAM_SOURCES[name];
  if (!source) return `demo-${name}`;
  const row = (getMockRows(source.table) || [])[0];
  return row?.[source.column] || `demo-${name}`;
}

export function resolvePresentationRoute(roleKey, slideIndex) {
  const role = getPresentationRoleByKey(roleKey);
  if (!role) return null;
  const safeIndex = Math.max(0, Math.min(Number(slideIndex) || 0, role.routes.length - 1));
  const template = role.routes[safeIndex];
  if (!template) return null;

  const [pageTemplate, queryString = ""] = String(template).split("?");
  const params = {};
  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }
  const realRoute = pageTemplate.replace(/\[([^\]]+)\]/g, (_match, name) => {
    const value = fillParam(name);
    params[name] = value;
    return value;
  });
  Object.assign(params, ROUTE_PARAM_OVERRIDES[template]?.() || ROUTE_PARAM_OVERRIDES[pageTemplate]?.());

  return { template: pageTemplate, presentationTemplate: template, realRoute, params, role };
}
