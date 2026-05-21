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

const ROUTE_PARAM_OVERRIDES = {};

function fillParam(name) {
  const source = PARAM_SOURCES[name];
  if (!source) return `demo-${name}`;
  const row = (getMockRows(source.table) || [])[0];
  return row?.[source.column] || `demo-${name}`;
}

export function routeToSlug(route) {
  const [pathWithHash, query = ""] = String(route || "").split("?");
  const [path, hash = ""] = pathWithHash.split("#");
  const base = path
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/\[/g, "")
    .replace(/\]/g, "")
    || "home";
  const hashSuffix = hash
    ? `-${hash.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`
    : "";
  const querySuffix = query
    ? `-${query.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`
    : "";
  return `${base}${hashSuffix}${querySuffix}`;
}

export function resolvePresentationRoute(roleKey, slideIndex, pageSlug = null) {
  const role = getPresentationRoleByKey(roleKey);
  if (!role) return null;
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= role.routes.length) {
    return null;
  }
  const template = role.routes[slideIndex];
  if (!template) return null;
  const expectedSlug = routeToSlug(template);
  if (pageSlug && pageSlug !== expectedSlug) return null;

  const [pageTemplateWithHash, queryString = ""] = String(template).split("?");
  const [pageTemplate, hash = ""] = pageTemplateWithHash.split("#");
  const params = {};
  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }
  const realPath = pageTemplate.replace(/\[([^\]]+)\]/g, (_match, name) => {
    const value = fillParam(name);
    params[name] = value;
    return value;
  });
  const realRoute = hash ? `${realPath}#${hash}` : realPath;
  Object.assign(params, ROUTE_PARAM_OVERRIDES[template]?.() || ROUTE_PARAM_OVERRIDES[pageTemplate]?.());

  return {
    template: pageTemplate,
    presentationTemplate: template,
    presentationSlug: expectedSlug,
    realRoute,
    params,
    role,
  };
}
