// file location: src/lib/support/investigation.js
//
// Help & Diagnostics ("support") — the INVESTIGATION engine. Reviews a captured
// (already-sanitised) diagnostics snapshot the way an experienced senior
// developer would and produces a DEVELOPER-ONLY investigation:
//   - plain-English explanation of what most likely happened
//   - the exact sequence of events that led to the failure
//   - probable root causes ranked by confidence
//   - the incident (related console errors + failed requests + render exceptions)
//   - suspected database / API / frontend ownership
//   - estimated regression risk + user impact
//   - recommended debugging order
//   - files / components / API routes / DB tables to inspect first
//   - similar previous incidents + repeated failures (via incidentClustering)
//   - automatic severity + priority scoring, fix complexity, affected modules
//   - confidence the issue is reproducible
//   - recommended manual test scenarios + automated regression tests
//   - a GitHub-ready investigation summary
//   - provider fragments (investigationRegistry) for per-module enrichment
//
// PRIVACY: reads ONLY the already-sanitised snapshot (+ injected prior-report
// fingerprints, which are themselves derived from sanitised data). It introduces
// no new privacy surface and is stored only inside the RLS-locked diagnostics
// blob, so it is never exposed to reporters. PURE + node-testable (inject `now`).

import { analyseDiagnostics } from "@/lib/support/diagnosticAnalysis";
import { buildFingerprint, findSimilarReports, repeatedFailures } from "@/lib/support/incidentClustering";
import { collectInvestigationProviders } from "@/lib/support/investigationRegistry";

const arr = (v) => (Array.isArray(v) ? v : []);
const uniq = (list) => Array.from(new Set(list.filter(Boolean)));
const reducePath = (url) => String(url || "").split("?")[0];
const titleCase = (s) => String(s || "").replace(/^\//, "").split(/[\/-]/)[0].replace(/^\w/, (c) => c.toUpperCase());

const MODULE_MAP = [
  [/^\/job-cards/, "Job Cards"],
  [/^\/jobs/, "Jobs"],
  [/^\/vhc/, "VHC"],
  [/^\/customers?/, "Customers"],
  [/^\/parts/, "Parts"],
  [/^\/hr/, "HR"],
  [/^\/accounts/, "Accounts"],
  [/^\/invoice/, "Invoicing"],
  [/^\/loan/, "Loan Cars"],
  [/^\/newsfeed/, "Newsfeed"],
  [/^\/reporting/, "Reporting"],
];

function moduleForRoute(route) {
  const r = reducePath(route || "");
  for (const [re, name] of MODULE_MAP) if (re.test(r)) return name;
  return r && r !== "/" ? titleCase(r) : "App shell";
}

// Guess the owning DB table from an /api path (first meaningful segment).
function tableFromApiPath(path) {
  const parts = reducePath(path).split("/").filter(Boolean); // ["api","vhc","save"]
  if (parts[0] !== "api" || !parts[1]) return null;
  const seg = parts[1].toLowerCase();
  // Skip obvious verbs; take the resource-ish segment.
  const VERBS = new Set(["save", "create", "update", "delete", "list", "get", "auth"]);
  const resource = VERBS.has(seg) && parts[2] ? parts[2] : seg;
  return resource.replace(/[^a-z0-9_]/g, "");
}

// ---------------------------------------------------------------------------
// Ownership (database / api / frontend).
// ---------------------------------------------------------------------------
function buildOwnership(snapshot, affected) {
  const apiRoutes = uniq(
    arr(snapshot?.failed_requests)
      .map((r) => reducePath(r?.url))
      .filter((p) => p.startsWith("/api/"))
  );
  const dbTables = uniq(apiRoutes.map(tableFromApiPath));
  const frontend = uniq([affected?.component, affected?.sectionKey, affected?.codeOwnership?.file]);

  const hasApi = apiRoutes.length > 0;
  const hasError = arr(snapshot?.unhandled_errors).length > 0;

  // Primary suspected layer.
  let primary = "frontend";
  if (hasApi && arr(snapshot?.failed_requests).some((r) => (r?.status || 0) >= 500 || r?.status === 0)) {
    primary = "api";
  } else if (hasApi && !hasError) {
    primary = "api";
  } else if (hasError) {
    primary = "frontend";
  }

  return { primary, api: apiRoutes, database: dbTables, frontend };
}

// ---------------------------------------------------------------------------
// Root causes ranked by confidence.
// ---------------------------------------------------------------------------
function buildRootCauses(snapshot, analysis) {
  const causes = [];
  const pc = analysis.probableCause;
  if (pc && pc.confidence > 0.1) {
    causes.push({ cause: pc.summary, confidence: pc.confidence, rationale: pc.evidence?.join(" ") || "" });
  }

  // Secondary candidates: each 5xx/network request + each distinct render error.
  arr(snapshot?.failed_requests)
    .filter((r) => (r?.status || 0) >= 500 || r?.status === 0)
    .forEach((r) => {
      causes.push({
        cause: `Server error on ${r?.method || "GET"} ${reducePath(r?.url)} (${r?.status ?? "network"})`,
        confidence: 0.5,
        rationale: "A 5xx / network failure usually points at the API or database layer.",
      });
    });
  arr(snapshot?.unhandled_errors).forEach((e) => {
    causes.push({
      cause: `Unhandled error: ${e?.message || "unknown"}`,
      confidence: e?.componentStack ? 0.45 : 0.35,
      rationale: e?.componentStack ? "Has a component stack — likely a frontend render bug." : "No stack captured.",
    });
  });

  // De-dupe by cause text, keep the highest confidence, rank desc.
  const byCause = new Map();
  for (const c of causes) {
    const prev = byCause.get(c.cause);
    if (!prev || c.confidence > prev.confidence) byCause.set(c.cause, c);
  }
  return Array.from(byCause.values()).sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

// ---------------------------------------------------------------------------
// Scoring: severity, priority, user impact, regression risk, complexity, repro.
// ---------------------------------------------------------------------------
function scoreSeverity(snapshot, analysis) {
  const renderError = arr(snapshot?.unhandled_errors).length > 0;
  const has5xx = arr(snapshot?.failed_requests).some((r) => (r?.status || 0) >= 500 || r?.status === 0);
  const has4xx = arr(snapshot?.failed_requests).some((r) => (r?.status || 0) >= 400 && (r?.status || 0) < 500);
  const consoleErrors = arr(snapshot?.console_errors).some((c) => c?.level === "error");
  const cascade = analysis.incidents?.some((i) => i.cascade);

  if (renderError && cascade) return "critical";
  if (renderError || has5xx) return "high";
  if (has4xx || consoleErrors) return "medium";
  return "low";
}

const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

function scoreUserImpact(snapshot, severity) {
  const renderError = arr(snapshot?.unhandled_errors).length > 0;
  const has5xx = arr(snapshot?.failed_requests).some((r) => (r?.status || 0) >= 500 || r?.status === 0);
  if (renderError) return "high"; // the screen broke for the user
  if (has5xx) return "medium"; // an action failed but the page survived
  return severity === "low" ? "low" : "medium";
}

function scorePriority(severity, userImpact, repeated) {
  let rank = SEV_RANK[severity] || 1;
  if (userImpact === "high") rank += 1;
  if ((repeated?.routeCount || 0) + (repeated?.componentCount || 0) >= 2) rank += 1; // recurring → bump
  const p = Math.max(1, Math.min(4, 5 - rank)); // rank 5 → P1 ... rank 1 → P4
  return `P${p}`;
}

function scoreRegressionRisk(snapshot, analysis, repeated) {
  const cascade = analysis.incidents?.some((i) => i.cascade);
  const distinctErrors = analysis.duplicates?.length || 0;
  if (cascade || (repeated?.componentCount || 0) > 0) return "high";
  if (distinctErrors > 0 || arr(snapshot?.unhandled_errors).length > 0) return "medium";
  return "low";
}

function scoreComplexity(ownership, analysis, modules) {
  const owners = (ownership.api.length ? 1 : 0) + (ownership.frontend.length ? 1 : 0) + (ownership.database.length ? 1 : 0);
  const cascade = analysis.incidents?.some((i) => i.cascade);
  if (modules.length > 1) return "large";
  if (cascade || owners >= 3) return "medium";
  if (owners >= 2) return "small";
  return "trivial";
}

function scoreReproducible(snapshot, analysis) {
  let c = 0;
  if ((analysis.duplicates?.length || 0) > 0) c += 0.4; // same error repeated → deterministic
  if (arr(snapshot?.recent_actions).length > 0) c += 0.3; // we have the steps
  if (arr(snapshot?.failed_requests).some((r) => (r?.status || 0) >= 500)) c += 0.2; // server-side deterministic
  if (arr(snapshot?.unhandled_errors).some((e) => e?.stack)) c += 0.1;
  if (c === 0) return 0.1;
  return Number(Math.min(0.95, c).toFixed(2));
}

// ---------------------------------------------------------------------------
// Recommendations.
// ---------------------------------------------------------------------------
function buildDebuggingOrder(analysis, ownership, affected) {
  const steps = [];
  const trigger = analysis.incidents?.[0]?.trigger || analysis.timeline?.find((t) => t.isTrigger);
  if (ownership.primary === "api" && ownership.api[0]) {
    steps.push(`Reproduce the failing request to ${ownership.api[0]} and inspect the server logs / handler.`);
    if (ownership.database[0]) steps.push(`Check the "${ownership.database[0]}" table / query used by that route.`);
    steps.push(`Trace the frontend caller in ${affected.component || affected.sectionKey || "the page"}.`);
  } else {
    if (affected.codeOwnership?.file) {
      steps.push(`Open ${affected.codeOwnership.file}${affected.codeOwnership.line ? `:${affected.codeOwnership.line}` : ""}.`);
    }
    if (affected.component) steps.push(`Inspect the ${affected.component} component render path.`);
    steps.push("Reproduce using the timeline steps below and watch the console.");
  }
  if (trigger?.summary || trigger?.text) steps.unshift(`Start from the trigger: ${trigger.summary || trigger.text}.`);
  return steps;
}

function buildInspectList(snapshot, ownership, affected) {
  return {
    files: uniq([affected.codeOwnership?.file].filter(Boolean)),
    components: uniq([affected.component, affected.sectionKey]),
    apiRoutes: ownership.api,
    dbTables: ownership.database,
  };
}

function buildManualTests(snapshot, analysis, affected) {
  const steps = arr(analysis.timeline).map((t) => t.text);
  const scenarios = [];
  if (steps.length) {
    scenarios.push(`Repeat these steps and confirm no error: ${steps.join(" → ")}.`);
  }
  if (affected.page) scenarios.push(`Load ${affected.page} directly and confirm it renders without the error.`);
  if (arr(snapshot?.failed_requests).length) {
    scenarios.push("Retry the failing action and confirm a clear, non-crashing message when the request fails.");
  }
  return scenarios;
}

function buildRegressionTests(ownership, affected) {
  const tests = [];
  if (affected.component) {
    tests.push(`Unit test: ${affected.component} handles missing/empty data without throwing.`);
  }
  ownership.api.forEach((route) => {
    tests.push(`Integration test: the caller of ${route} degrades gracefully when it returns 5xx.`);
  });
  ownership.database.forEach((table) => {
    tests.push(`Data test: querying "${table}" with the incident's inputs returns/handles the expected shape.`);
  });
  if (!tests.length) tests.push("Add a regression test reproducing the captured console error.");
  return tests;
}

// ---------------------------------------------------------------------------
// GitHub-ready summary.
// ---------------------------------------------------------------------------
function buildSummary({ explanation, severity, priority, rootCauses, inspect, sequence, similarIncidents, affected }) {
  const lines = [];
  lines.push(`## ${affected.module || "App"} incident — ${severity.toUpperCase()} / ${priority}`);
  lines.push("");
  lines.push(explanation);
  lines.push("");
  if (rootCauses.length) {
    lines.push("### Probable root causes");
    rootCauses.forEach((c, i) => lines.push(`${i + 1}. ${c.cause} _(${Math.round(c.confidence * 100)}%)_`));
    lines.push("");
  }
  if (sequence.length) {
    lines.push("### Sequence");
    sequence.forEach((s, i) => lines.push(`${i + 1}. ${s.text}${s.isTrigger ? " ← trigger" : ""}`));
    lines.push("");
  }
  const inspectBits = [
    inspect.files.length ? `files: ${inspect.files.join(", ")}` : "",
    inspect.apiRoutes.length ? `API: ${inspect.apiRoutes.join(", ")}` : "",
    inspect.dbTables.length ? `tables: ${inspect.dbTables.join(", ")}` : "",
    inspect.components.length ? `components: ${inspect.components.join(", ")}` : "",
  ].filter(Boolean);
  if (inspectBits.length) {
    lines.push("### Inspect first");
    inspectBits.forEach((b) => lines.push(`- ${b}`));
    lines.push("");
  }
  if (similarIncidents.length) {
    lines.push(`### Similar prior incidents: ${similarIncidents.length}`);
    similarIncidents.forEach((s) => lines.push(`- ${s.reportId} (${Math.round(s.score * 100)}% — ${s.reasons.join(", ")})`));
  }
  return lines.join("\n");
}

/**
 * Build the developer-only investigation for a sanitised diagnostics snapshot.
 *
 * @param {object} snapshot sanitised diagnostics bundle
 * @param {{
 *   analysis?: object,               // pre-computed analyseDiagnostics() (optional)
 *   priorReports?: Array,            // [{ id, fingerprint, route, createdAt }]
 *   now?: string,                    // ISO string (injected for determinism)
 * }} [options]
 * @returns {object} investigation
 */
export function buildInvestigation(snapshot = {}, options = {}) {
  const analysis = options.analysis || snapshot?.analysis || analyseDiagnostics(snapshot);
  const priorReports = arr(options.priorReports);

  const affected = { ...analysis.affected, module: moduleForRoute(analysis.affected?.route) };
  const fingerprint = buildFingerprint(snapshot);
  const ownership = buildOwnership(snapshot, affected);
  const rootCauses = buildRootCauses(snapshot, analysis);

  const modules = uniq([affected.module]);
  const severity = scoreSeverity(snapshot, analysis);
  const repeated = repeatedFailures(fingerprint, priorReports);
  const userImpact = scoreUserImpact(snapshot, severity);
  const priority = scorePriority(severity, userImpact, repeated);
  const regressionRisk = scoreRegressionRisk(snapshot, analysis, repeated);
  const complexity = scoreComplexity(ownership, analysis, modules);
  const reproducibleConfidence = scoreReproducible(snapshot, analysis);

  const similarIncidents = findSimilarReports(fingerprint, priorReports);
  const sequence = arr(analysis.timeline);
  const inspect = buildInspectList(snapshot, ownership, affected);
  const debuggingOrder = buildDebuggingOrder(analysis, ownership, affected);
  const manualTests = buildManualTests(snapshot, analysis, affected);
  const regressionTests = buildRegressionTests(ownership, affected);

  const explanation =
    rootCauses.length > 0
      ? `On ${affected.page || affected.module}, ${rootCauses[0].cause} This appears to be a ${severity}-severity ${ownership.primary} issue affecting the ${affected.module} module.`
      : `No clear failure was captured on ${affected.page || affected.module}; this is likely a ${severity}-severity report based on the user's recent activity.`;

  const summary = buildSummary({
    explanation,
    severity,
    priority,
    rootCauses,
    inspect,
    sequence,
    similarIncidents,
    affected,
  });

  const providers = collectInvestigationProviders({ snapshot, analysis, priorReports, fingerprint, affected });

  return {
    generatedAt: options.now || null,
    developerOnly: true,
    explanation,
    sequence,
    rootCauses,
    incident: analysis.incidents?.find((i) => i.id === analysis.primaryIncidentId) || analysis.incidents?.[0] || null,
    ownership,
    affected,
    affectedModules: modules,
    severity,
    priority,
    userImpact,
    regressionRisk,
    fixComplexity: complexity,
    reproducibleConfidence,
    debuggingOrder,
    inspectFirst: inspect,
    similarIncidents,
    repeatedFailures: repeated,
    manualTests,
    regressionTests,
    summary,
    fingerprint,
    ...(Object.keys(providers).length ? { providers } : {}),
  };
}
