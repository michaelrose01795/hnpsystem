const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DOC_PATH = path.join(ROOT, "docs", "ui", "ui-presentation");
const GENERATED_PATH = path.join(ROOT, "src", "config", "presentationRoleAccess.generated.js");
const DUPLICATE_MARKER = "!!!!!!!!!!!!!!!!!!!!!!";

const DEMO_NAMES = {
  "accounts-manager": "Demo Accounts Manager",
  "admin-manager": "Demo Admin Manager",
  "after-sales-director": "Demo After Sales Director",
  customer: "Demo Customer",
  general: "Demo General User",
  "general-manager": "Demo General Manager",
  "hr-manager": "Demo HR Manager",
  "mobile-technician": "Demo Mobile Technician",
  "mot-tester": "Demo MOT Tester",
  owner: "Demo Owner",
  painters: "Demo Painter",
  "parts-manager": "Demo Parts Manager",
  receptionist: "Demo Receptionist",
  "sales-director": "Demo Sales Director",
  "service-manager": "Demo Service Manager",
  techs: "Demo Technician",
  "valet-service": "Demo Valet",
  "workshop-manager": "Demo Workshop Manager",
};

const ROUTE_CATALOG = [
  "/messages",
  "/newsfeed",
  "/profile",
  "/profile?tab=personal",
  "/login",
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
  "/dashboard/admin",
  "/job-cards/waiting/nextjobs",
  "/job-cards/view",
  "/job-cards/[jobNumber]",
  "/admin/users",
  "/admin/profiles/[user]",
  "/hr/manager",
  "/dashboard",
  "/parts/goods-in",
  "/tracking",
  "/customer",
  "/customer/messages",
  "/customer/parts",
  "/customer/payments",
  "/customer/vehicles",
  "/customer/vhc",
  "/vhc/customer-preview/[jobNumber]",
  "/vhc/customer-view/[jobNumber]",
  "/vhc/share/[jobNumber]/[linkCode]",
  "/dashboard/managers",
  "/hr",
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
  "/mobile/dashboard",
  "/job-cards/myjobs",
  "/job-cards/myjobs/[jobNumber]",
  "/appointments",
  "/mobile/delivery/[jobNumber]",
  "/job-cards/create",
  "/tech/consumables-request",
  "/dashboard/mot",
  "/tech/efficiency",
  "/vhc",
  "/dashboard/painting",
  "/dashboard/parts",
  "/parts",
  "/parts/manager",
  "/stock-catalogue",
  "/parts/create-order",
  "/parts/create-order/[orderNumber]",
  "/parts/deliveries",
  "/parts/deliveries/[deliveryId]",
  "/parts/delivery-planner",
  "/parts/goods-in/[goodsInNumber]",
  "/customers",
  "/customers/[customerSlug]",
  "/dashboard/service",
  "/dashboard/workshop",
  "/tech/dashboard",
  "/dashboard/valeting",
  "/valet",
  "/job-cards/valet/[jobnumber]",
  "/workshop/consumables-tracker",
  "/clocking",
  "/clocking/[technicianSlug]",
];

function routeToSlug(route) {
  const [routePath, query = ""] = String(route || "").split("?");
  const base =
    routePath
      .replace(/^\//, "")
      .replace(/\//g, "-")
      .replace(/\[/g, "")
      .replace(/\]/g, "") || "home";
  const suffix = query
    ? `-${query.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`
    : "";
  return `${base}${suffix}`;
}

const ROUTE_BY_SLUG = new Map(ROUTE_CATALOG.map((route) => [routeToSlug(route), route]));

function roleIdFromKey(key) {
  return String(key || "").replace(/-/g, " ");
}

function parseSections(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const sections = [];
  let current = null;
  let currentEntry = null;
  let pendingHeading = null;

  function finishEntry() {
    if (current && currentEntry) {
      current.entries.push(currentEntry);
    }
    currentEntry = null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();
    const next = lines[index + 1]?.trim();
    const prev = lines[index - 1]?.trim();

    if (/^=+$/.test(line.trim()) && next && /^=+$/.test(lines[index + 2]?.trim() || "")) {
      finishEntry();
      pendingHeading = next;
      index += 1;
      continue;
    }

    if (pendingHeading && /^=+$/.test(line.trim())) {
      if (pendingHeading !== "PRESENTATION") {
        current = { label: pendingHeading, entries: [] };
        sections.push(current);
      } else {
        current = null;
      }
      pendingHeading = null;
      continue;
    }

    const routeMatch = line.match(/^(?:(\d+)\.\s*)?(\/presentation\/([^/]+)\/([^/\s]+)\/\d+)(?:\s+!+)?\s*(\(.*\))?\s*$/);
    if (routeMatch && current) {
      finishEntry();
      currentEntry = {
        order: routeMatch[1] ? Number(routeMatch[1]) : null,
        sourceIndex: index,
        roleKey: routeMatch[3],
        slug: routeMatch[4],
        annotation: routeMatch[5] || null,
        route: null,
        details: [],
      };
      continue;
    }

    if (!currentEntry) continue;
    if (/^mock data$/i.test(line.trim())) continue;
    if (/^Route:\s*/i.test(line.trim())) {
      currentEntry.route = line.trim().replace(/^Route:\s*/i, "").trim();
      continue;
    }
    if (line.includes(DUPLICATE_MARKER)) continue;
    if (!line.trim() && prev && /^mock data$/i.test(prev)) continue;
    currentEntry.details.push(rawLine);
  }

  finishEntry();
  return sections;
}

function resolveRoute(entry) {
  if (entry.route) return entry.route;
  return ROUTE_BY_SLUG.get(entry.slug) || `/${entry.slug.replace(/-/g, "/")}`;
}

function sortedEntries(section) {
  return section.entries
    .map((entry, index) => ({ ...entry, route: resolveRoute(entry), fallbackOrder: index + 1 }))
    .sort((a, b) => (a.order || a.fallbackOrder) - (b.order || b.fallbackOrder));
}

function buildModel(sections) {
  return sections.map((section) => {
    const entries = sortedEntries(section);
    const key = entries[0]?.roleKey || section.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return {
      key,
      roleId: roleIdFromKey(key),
      label: section.label,
      demoName: DEMO_NAMES[key] || `Demo ${section.label}`,
      routes: entries.map((entry) => entry.route),
      entries,
    };
  });
}

function renderDoc(roles) {
  const routeCounts = new Map();
  for (const role of roles) {
    for (const route of role.routes) {
      routeCounts.set(route, (routeCounts.get(route) || 0) + 1);
    }
  }

  const out = [];
  out.push("====================================================");
  out.push("PRESENTATION");
  out.push("====================================================");
  out.push("");
  out.push("/loginPresentation");
  out.push("");
  out.push("URL pattern: /presentation/<role-key>/<page-slug>/<slide-index>");
  out.push("Source of truth: docs/ui/ui-presentation");
  out.push("Generated config: src/config/presentationRoleAccess.generated.js");
  out.push("");

  for (const role of roles) {
    out.push("");
    out.push("====================================================");
    out.push(role.label);
    out.push("====================================================");
    out.push("");
    role.entries.forEach((entry, index) => {
      const route = entry.route;
      const presentationUrl = `/presentation/${role.key}/${routeToSlug(route)}/${index}`;
      const duplicate = routeCounts.get(route) > 1 ? ` ${DUPLICATE_MARKER}` : "";
      const annotation = entry.annotation ? ` ${entry.annotation}` : "";
      out.push(`${index + 1}. ${presentationUrl}${duplicate}${annotation}`);
      out.push(`Route: ${route}`);
      const details = entry.details
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .split("\n")
        .filter((detailLine, detailIndex, all) => {
          if (detailLine.trim()) return true;
          return detailIndex > 0 && detailIndex < all.length - 1;
        });
      if (details.length > 0) out.push(...details);
      out.push("");
    });
  }

  return `${out.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd()}\n`;
}

function renderGeneratedConfig(roles) {
  const serialisable = roles.map(({ entries, ...role }) => role);
  return `// Generated by tools/scripts/sync-presentation-ui.js from docs/ui/ui-presentation.\n// Edit docs/ui/ui-presentation, then run npm run presentation:sync.\n\nexport const PRESENTATION_ROLES = ${JSON.stringify(serialisable, null, 2)};\n`;
}

function writeIfChanged(filePath, nextContent) {
  const previousContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (previousContent === nextContent) return false;
  fs.writeFileSync(filePath, nextContent, "utf8");
  return true;
}

function main() {
  const source = fs.readFileSync(DOC_PATH, "utf8");
  const sections = parseSections(source);
  const roles = buildModel(sections).filter((role) => role.routes.length > 0);
  if (roles.length === 0) {
    throw new Error("No presentation roles were found in docs/ui/ui-presentation.");
  }

  writeIfChanged(DOC_PATH, renderDoc(roles));
  writeIfChanged(GENERATED_PATH, renderGeneratedConfig(roles));
  console.log(`Synced ${roles.length} presentation roles from docs/ui/ui-presentation.`);
}

main();
