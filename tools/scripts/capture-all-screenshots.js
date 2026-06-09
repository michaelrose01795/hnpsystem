// file location: tools/scripts/capture-all-screenshots.js
// Captures full-page screenshots for every non-API Next.js page route plus
// discoverable modal/dialog states into Screenshots/<date>/.

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const ROOT = process.cwd();
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const TODAY = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = path.join(ROOT, "Screenshots", TODAY);
const AUTH_STATE = path.join(ROOT, "e2e", ".auth", "user.json");
const PAGE_ROOT = path.join(ROOT, "src", "pages");
const PRESENTATION_DOC = path.join(ROOT, "docs", "ui", "ui-presentation");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
const MODAL_SELECTOR = ".popup-backdrop, [aria-modal='true'], [data-modal-portal='true'], [role='dialog']";
const MAX_MODAL_CANDIDATES_PER_ROUTE = Number(process.env.SCREENSHOT_MODAL_LIMIT || 6);

const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/loginPresentation",
  "/password-reset",
  "/presentation",
  "/slideshow",
  "/unauthorized",
  "/vision",
  "/website",
  "/vhc/customer",
  "/vhc/customer-preview",
  "/vhc/customer-view",
  "/vhc/share",
];

const DANGEROUS_ACTION_RE =
  /\b(delete|remove|deactivate|archive|save|submit|send|confirm|complete|finish|approve|reject|decline|clock|checkout|pay|charge|allocate|assign|start route|mark delivered)\b/i;
const MODAL_ACTION_RE =
  /\b(add|new|create|edit|details|settings|help|history|order|search|schedule|booking|members|reset|forgot|stock|delivery|share|guide)\b/i;
const IGNORED_ACTION_RE =
  /\b(open notes|floating notes|open navigation sidebar|close navigation sidebar|open status sidebar|close status sidebar|create user|add update|open invoices|open job cards|open orders|profile)\b/i;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toRouteFromPageFile(filePath) {
  const rel = path.relative(PAGE_ROOT, filePath).replace(/\\/g, "/");
  let route = `/${rel.replace(/\.(jsx?|tsx?)$/, "")}`;
  route = route.replace(/\/index$/, "");
  return route === "/index" ? "/" : route;
}

function discoverPageRoutes() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "api") continue;
        walk(full);
        continue;
      }
      if (!/\.(jsx?|tsx?)$/.test(entry.name)) continue;
      if (entry.name === "_app.js" || entry.name === "_document.js") continue;
      out.push(toRouteFromPageFile(full));
    }
  };
  walk(PAGE_ROOT);
  return out.filter((route) => !route.startsWith("/presentation/["));
}

function discoverPresentationRoutes() {
  if (!fs.existsSync(PRESENTATION_DOC)) return [];
  const text = fs.readFileSync(PRESENTATION_DOC, "utf8");
  const routes = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*\d+\.\s+(\/presentation\/\S+)/);
    if (match) routes.push(match[1].replace(/\s*!+.*$/, ""));
  }
  return routes;
}

function discoverPresentationEntries() {
  if (!fs.existsSync(PRESENTATION_DOC)) return [];
  const text = fs.readFileSync(PRESENTATION_DOC, "utf8");
  const entries = [];
  let pendingPresentationRoute = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const presentationMatch = line.match(/^\d+\.\s+(\/presentation\/\S+)/);
    if (presentationMatch) {
      pendingPresentationRoute = presentationMatch[1].replace(/\s*!+.*$/, "");
      continue;
    }
    const routeMatch = line.match(/^Route:\s*(.+)$/i);
    if (routeMatch && pendingPresentationRoute) {
      entries.push({
        route: routeMatch[1].trim(),
        captureRoute: pendingPresentationRoute,
      });
      pendingPresentationRoute = null;
    }
  }
  return entries;
}

function safeName(value) {
  const clean = String(value || "page")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#]/g, "-")
    .replace(/\//g, "-")
    .replace(/\[|\]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || "home";
}

function uniqueFilePath(baseName, ext = ".png") {
  let candidate = path.join(OUTPUT_DIR, `${baseName}${ext}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(OUTPUT_DIR, `${baseName}-${index}${ext}`);
    index += 1;
  }
  return candidate;
}

function defaultFilePath(baseName, ext = ".png") {
  return path.join(OUTPUT_DIR, `${baseName}${ext}`);
}

function writeManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function isPublicRoute(route) {
  return route === "/" || PUBLIC_ROUTE_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

async function fetchJson(url, timeout = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function isServerReady() {
  try {
    const response = await fetchJson(`${BASE_URL}/api/health`, 3000);
    return response.ok;
  } catch (_error) {
    return false;
  }
}

async function waitForServer() {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (await isServerReady()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function startServerIfNeeded() {
  if (await isServerReady()) {
    return { started: false, child: null };
  }
  const child = spawn("npm", ["run", "dev"], {
    cwd: ROOT,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));
  const ready = await waitForServer();
  if (!ready) {
    child.kill();
    throw new Error(`Next dev server did not become ready at ${BASE_URL}`);
  }
  return { started: true, child };
}

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function generateTechnicianSlug(firstName, lastName, userId) {
  const sanitize = (value) => (value ? value.toString().replace(/[^a-zA-Z0-9]/g, "") : "");
  const formatSegment = (value) => {
    const sanitized = sanitize(value).trim();
    return sanitized ? sanitized.charAt(0).toUpperCase() + sanitized.slice(1) : "";
  };
  const namePart = `${formatSegment(firstName)}${formatSegment(lastName)}`.trim();
  const idSuffix = userId !== undefined && userId !== null ? `-${sanitize(userId)}` : "";
  return namePart ? `${namePart}${idSuffix}` : idSuffix ? `Tech${idSuffix}` : "Technician";
}

function createCustomerDisplaySlug(firstname = "", lastname = "") {
  const strip = (value = "") => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const pascal = (value = "") =>
    strip(value)
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
      .join("");
  return `${pascal(firstname)}${pascal(lastname)}`.trim();
}

async function maybeOne(db, table, columns, configure = (q) => q) {
  if (!db) return null;
  try {
    const query = configure(db.from(table).select(columns).limit(1));
    const { data, error } = await query.maybeSingle();
    if (error) return null;
    return data || null;
  } catch (_error) {
    return null;
  }
}

async function buildSamples() {
  const db = createDbClient();
  const job = await maybeOne(db, "jobs", "id, job_number, customer_id, assigned_to", (q) =>
    q.not("job_number", "is", null).order("updated_at", { ascending: false })
  );
  const account = await maybeOne(db, "accounts", "account_id", (q) => q.order("updated_at", { ascending: false }));
  const invoice = await maybeOne(db, "invoices", "id", (q) => q.order("created_at", { ascending: false }));
  const company = await maybeOne(db, "company_accounts", "account_number", (q) => q.order("created_at", { ascending: false }));
  const customer = await maybeOne(db, "customers", "id, firstname, lastname, slug_key", (q) => q.order("updated_at", { ascending: false }));
  const user = await maybeOne(db, "users", "user_id, first_name, last_name", (q) => q.eq("is_active", true).order("user_id", { ascending: true }));
  const delivery = await maybeOne(db, "parts_deliveries", "id", (q) => q.order("created_at", { ascending: false }));
  const goodsIn = await maybeOne(db, "parts_goods_in", "goods_in_number", (q) => q.order("created_at", { ascending: false }));
  const order = await maybeOne(db, "parts_order_cards", "order_number", (q) => q.order("created_at", { ascending: false }));
  const share = await maybeOne(db, "job_share_links", "link_code, job:job_id(job_number)", (q) =>
    q.not("link_code", "is", null).order("created_at", { ascending: false })
  );

  const jobNumber = job?.job_number || "TEST-1";
  const linkJobNumber = share?.job?.job_number || jobNumber;
  const linkCode = share?.link_code || "preview";
  const customerSlug = customer?.slug_key || createCustomerDisplaySlug(customer?.firstname || "Test", customer?.lastname || "Customer");
  const technicianSlug = generateTechnicianSlug(user?.first_name || "Technician", user?.last_name || "", user?.user_id || 1);

  return {
    accountId: account?.account_id || "1",
    invoiceId: invoice?.id || "1",
    accountNumber: company?.account_number || "COMP-1",
    customerSlug,
    technicianSlug,
    jobNumber,
    orderNumber: order?.order_number || "P00001",
    deliveryId: delivery?.id || "1",
    goodsInNumber: goodsIn?.goods_in_number || "GI-00001",
    linkCode,
    uiKey: "legacy",
    role: "general",
    pageSlug: "messages",
    slide: "0",
    linkJobNumber,
  };
}

function resolveDynamicRoute(route, samples) {
  let resolved = route;
  const replacements = {
    accountId: samples.accountId,
    invoiceId: samples.invoiceId,
    accountNumber: samples.accountNumber,
    customerSlug: samples.customerSlug,
    technicianSlug: samples.technicianSlug,
    jobNumber: route.includes("/vhc/") ? samples.linkJobNumber : samples.jobNumber,
    jobnumber: samples.jobNumber,
    orderNumber: samples.orderNumber,
    deliveryId: samples.deliveryId,
    goodsInNumber: samples.goodsInNumber,
    linkCode: samples.linkCode,
    uiKey: samples.uiKey,
    role: samples.role,
    pageSlug: samples.pageSlug,
    slide: samples.slide,
  };

  for (const [key, value] of Object.entries(replacements)) {
    resolved = resolved.replaceAll(`[${key}]`, encodeURIComponent(String(value || key)));
  }
  return resolved;
}

async function settlePage(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 7000 }).catch(() => {});
  await closeGlobalOverlays(page);
  await page.waitForTimeout(750);
}

async function closeGlobalOverlays(page) {
  await page.evaluate(() => {
    const consent = {
      categories: {
        essential: true,
        preferences: false,
        analytics: false,
        marketing: false,
      },
      policyVersion: "v1.0",
      anonymousId: "screenshot-runner",
      capturedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem("hnp.cookieConsent.v1", JSON.stringify(consent));
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("hnp-floating-notes-panel-open-")) {
          window.localStorage.setItem(key, "0");
        }
      }
    } catch (_error) {
      // Best effort only.
    }
    document.cookie = `hnp_cookie_consent=${encodeURIComponent(JSON.stringify(consent))}; path=/; SameSite=Lax`;
    document.cookie = "hnp_anon_id=screenshot-runner; path=/; SameSite=Lax";

    const notesPanels = Array.from(document.querySelectorAll("[class*='notesPanel'], [class*='panel']"))
      .filter((node) => /floating|note/i.test(node.textContent || ""));
    for (const node of notesPanels) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 180 && rect.height > 120) {
        const close = node.querySelector("button[aria-label*='Close'], button[title*='Close']");
        if (close) close.click();
      }
    }
  }).catch(() => {});

  const cookieDialog = page.getByRole("dialog", { name: /cookie consent|cookies on this site/i });
  if (await cookieDialog.isVisible().catch(() => false)) {
    const reject = page.getByRole("button", { name: /reject all/i });
    if (await reject.isVisible().catch(() => false)) {
      await reject.click({ timeout: 1500 }).catch(() => {});
    }
  }
}

async function installScreenshotDefaults(context) {
  const consent = {
    categories: {
      essential: true,
      preferences: false,
      analytics: false,
      marketing: false,
    },
    policyVersion: "v1.0",
    anonymousId: "screenshot-runner",
    capturedAt: new Date().toISOString(),
  };
  await context.addInitScript((payload) => {
    try {
      window.localStorage.setItem("hnp.cookieConsent.v1", JSON.stringify(payload));
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("hnp-floating-notes-panel-open-")) {
          window.localStorage.setItem(key, "0");
        }
      }
    } catch (_error) {
      // Best effort only.
    }
    document.cookie = `hnp_cookie_consent=${encodeURIComponent(JSON.stringify(payload))}; path=/; SameSite=Lax`;
    document.cookie = "hnp_anon_id=screenshot-runner; path=/; SameSite=Lax";
  }, consent);
}

async function capturePage(page, route, captureRoute, label, manifest) {
  const target = `${BASE_URL}${captureRoute}`;
  const baseName = safeName(label || route);
  const existingFile = defaultFilePath(baseName);
  if (fs.existsSync(existingFile)) {
    manifest.skipped.push({
      type: "page",
      route,
      captureRoute,
      reason: "existing screenshot",
      file: path.relative(ROOT, existingFile),
    });
    return false;
  }
  const file = uniqueFilePath(baseName);
  try {
    const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
    await settlePage(page);
    await closeGlobalOverlays(page);
    await page.screenshot({ path: file, fullPage: true });
    manifest.captured.push({
      type: "page",
      route,
      captureRoute,
      finalUrl: page.url(),
      status: response?.status() || null,
      file: path.relative(ROOT, file),
    });
    return true;
  } catch (error) {
    manifest.errors.push({ type: "page", route, message: error.message });
    return false;
  }
}

async function visibleDialogCount(page) {
  return page.locator(MODAL_SELECTOR).filter({ hasNotText: /^$/ }).count().catch(() => 0);
}

async function closeDialogs(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);
  const closeButtons = page.getByRole("button", { name: /close|cancel|dismiss/i });
  const count = await closeButtons.count().catch(() => 0);
  if (count > 0) {
    await closeButtons.first().click({ timeout: 1500 }).catch(() => {});
  }
  await page.waitForTimeout(300);
}

async function findModalCandidates(page) {
  return page.evaluate(
    ({ modalReSource, dangerousReSource, ignoredReSource, limit }) => {
      const modalRe = new RegExp(modalReSource, "i");
      const dangerousRe = new RegExp(dangerousReSource, "i");
      const nodes = Array.from(document.querySelectorAll("button, a, [role='button']"));
      const candidates = [];
      for (const node of nodes) {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (style.visibility === "hidden" || style.display === "none" || rect.width < 8 || rect.height < 8) continue;
        const label = (
          node.getAttribute("aria-label") ||
          node.getAttribute("title") ||
          node.textContent ||
          ""
        ).replace(/\s+/g, " ").trim();
        if (!label || label.length > 80) continue;
        if (new RegExp(ignoredReSource, "i").test(label)) continue;
        if (!modalRe.test(label) || dangerousRe.test(label)) continue;
        candidates.push({
          label,
          selector:
            node.id
              ? `#${CSS.escape(node.id)}`
              : node.getAttribute("aria-label")
                ? `${node.tagName.toLowerCase()}[aria-label="${CSS.escape(node.getAttribute("aria-label"))}"]`
                : null,
          index: nodes.indexOf(node),
        });
        if (candidates.length >= limit) break;
      }
      return candidates;
    },
    {
      modalReSource: MODAL_ACTION_RE.source,
      dangerousReSource: DANGEROUS_ACTION_RE.source,
      ignoredReSource: IGNORED_ACTION_RE.source,
      limit: MAX_MODAL_CANDIDATES_PER_ROUTE,
    }
  );
}

async function clickCandidate(page, candidate) {
  if (candidate.selector) {
    const locator = page.locator(candidate.selector).first();
    await locator.click({ timeout: 2500 });
    return;
  }
  await page.evaluate((index) => {
    const nodes = Array.from(document.querySelectorAll("button, a, [role='button']"));
    nodes[index]?.click();
  }, candidate.index);
}

async function captureDialogsForRoute(page, route, manifest) {
  const candidates = await findModalCandidates(page).catch(() => []);
  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const beforeUrl = page.url();
    const beforeDialogs = await visibleDialogCount(page);
    try {
      await clickCandidate(page, candidate);
      await page.waitForTimeout(900);
      await closeGlobalOverlays(page);
      const afterDialogs = await visibleDialogCount(page);
      if (afterDialogs > beforeDialogs || (await page.locator(MODAL_SELECTOR).first().isVisible().catch(() => false))) {
        const name = `${safeName(route)}--popup--${safeName(candidate.label)}`;
        if (fs.existsSync(defaultFilePath(name))) {
          await closeDialogs(page);
          continue;
        }
        const file = uniqueFilePath(name);
        await closeGlobalOverlays(page);
        await page.screenshot({ path: file, fullPage: true });
        manifest.captured.push({
          type: "popup",
          route,
          popup: candidate.label,
          file: path.relative(ROOT, file),
        });
        writeManifest(manifest);
        await closeDialogs(page);
      } else if (page.url() !== beforeUrl) {
        await page.goto(beforeUrl, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
        await settlePage(page);
      }
    } catch (error) {
      manifest.errors.push({ type: "popup", route, popup: candidate.label, message: error.message });
      if (page.url() !== beforeUrl) {
        await page.goto(beforeUrl, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
        await settlePage(page);
      }
      await closeDialogs(page);
    }
  }
}

async function main() {
  ensureDir(OUTPUT_DIR);
  const server = await startServerIfNeeded();
  const samples = await buildSamples();
  const presentationByRoute = new Map();
  for (const entry of discoverPresentationEntries()) {
    if (!presentationByRoute.has(entry.route)) {
      presentationByRoute.set(entry.route, entry.captureRoute);
    }
  }

  const entriesByRoute = new Map();
  for (const [route, captureRoute] of presentationByRoute.entries()) {
    const resolvedRoute = resolveDynamicRoute(route, samples);
    entriesByRoute.set(resolvedRoute, {
      route: resolvedRoute,
      captureRoute,
      label: resolvedRoute,
      source: "presentation",
    });
  }
  for (const route of discoverPageRoutes()) {
    if (presentationByRoute.has(route)) continue;
    const resolvedRoute = resolveDynamicRoute(route, samples);
    if (!entriesByRoute.has(resolvedRoute)) {
      entriesByRoute.set(resolvedRoute, {
        route: resolvedRoute,
        captureRoute: resolvedRoute,
        label: resolvedRoute,
        source: "page-file",
      });
    }
  }

  const entries = Array.from(entriesByRoute.values()).sort((a, b) => a.label.localeCompare(b.label));
  let previousManifest = null;
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      previousManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    } catch (_error) {
      previousManifest = null;
    }
  }
  const manifest = {
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    outputDir: path.relative(ROOT, OUTPUT_DIR),
    samples,
    routeCount: entries.length,
    captured: previousManifest?.captured || [],
    skipped: [],
    errors: previousManifest?.errors || [],
  };

  const browser = await chromium.launch({ headless: true });
  const authContextOptions = fs.existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {};
  const authContext = await browser.newContext({ ...authContextOptions, viewport: { width: 1440, height: 1100 } });
  const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await installScreenshotDefaults(authContext);
  await installScreenshotDefaults(publicContext);
  const authPage = await authContext.newPage();
  const publicPage = await publicContext.newPage();

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const page = isPublicRoute(entry.captureRoute) ? publicPage : authPage;
    process.stdout.write(`[${index + 1}/${entries.length}] ${entry.label} via ${entry.captureRoute}\n`);
    const ok = await capturePage(page, entry.route, entry.captureRoute, entry.label, manifest);
    writeManifest(manifest);
    if (ok && entry.source !== "presentation") {
      await captureDialogsForRoute(page, entry.route, manifest);
      writeManifest(manifest);
    }
  }

  await authContext.close();
  await publicContext.close();
  await browser.close();
  writeManifest(manifest);

  if (server.started && server.child) {
    server.child.kill();
  }

  console.log(`Captured ${manifest.captured.length} screenshots into ${path.relative(ROOT, OUTPUT_DIR)}`);
  console.log(`Errors: ${manifest.errors.length}`);
}

main().catch((error) => {
  try {
    ensureDir(OUTPUT_DIR);
    fs.appendFileSync(path.join(OUTPUT_DIR, "capture.err.log"), `${new Date().toISOString()} ${error.stack || error.message}\n`);
  } catch (_error) {
    // Ignore logging failures.
  }
  console.error(error);
  process.exitCode = 1;
});
