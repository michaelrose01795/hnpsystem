// file location: src/lib/dev-platform/assistedInvestigation.js
//
// Phase 10 — AI-assisted investigation WITHOUT any external/paid AI service.
//
// This is a deterministic, heuristic "assistant" that reads the already-built
// developer investigation (src/lib/support/investigation.js — root causes,
// ownership, drift, version history, recommended tests) and composes a
// developer-focused write-up: a plain-English summary, a probable fix, the
// affected systems, concrete implementation suggestions, regression warnings,
// and a verification checklist. It is PURE + node-testable and introduces NO
// new privacy surface — it reads only the already-sanitised investigation.
//
// Why heuristic (not an LLM): CLAUDE.md / the support constraints forbid new
// external services and paid AI. The investigation engine already extracts the
// structured signals a human triager needs; this module turns them into the
// narrative + actionable checklist an LLM would otherwise produce, for free and
// deterministically (so it is testable and never leaks data to a third party).

const arr = (v) => (Array.isArray(v) ? v : []);
const first = (v) => (arr(v)[0] ?? null);
const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));
const pct = (n) => `${Math.round(clamp01(n) * 100)}%`;

function confidenceLabel(score) {
  if (score >= 0.66) return "high";
  if (score >= 0.33) return "medium";
  return "low";
}

// Overall confidence blends the top root-cause confidence with how reproducible
// the incident looks and whether we actually captured a failure signal.
function overallConfidence(inv) {
  const topCause = first(inv.rootCauses);
  const causeConf = topCause ? clamp01(topCause.confidence) : 0;
  const repro = clamp01(inv.reproducibleConfidence);
  const hasSignal = arr(inv.rootCauses).length > 0 ? 1 : 0;
  return clamp01(causeConf * 0.5 + repro * 0.35 + hasSignal * 0.15);
}

// The probable fix is derived from the primary suspected layer + the strongest
// root cause, phrased as a concrete engineering action rather than a restatement.
function probableFix(inv) {
  const ownership = inv.ownership || {};
  const cause = first(inv.rootCauses);
  const layer = ownership.primary || "frontend";
  const api = first(ownership.api);
  const table = first(ownership.database);
  const file = inv.affected?.codeOwnership?.file || first(inv.inspectFirst?.files);
  const component = inv.affected?.component;

  if (layer === "api" && api) {
    return `Harden the \`${api}\` handler${table ? ` and its \`${table}\` query` : ""}: validate inputs, guard the failing branch, and return a structured error the frontend can render instead of throwing.${cause ? ` Root signal: ${cause.cause}` : ""}`;
  }
  if (arr(inv.rootCauses).some((c) => /unhandled error/i.test(c.cause || ""))) {
    return `Add a defensive guard in ${component || file || "the failing component"} so the render path tolerates the missing/empty data that triggered the exception, and surface a fallback instead of crashing.`;
  }
  if (file || component) {
    return `Trace ${file ? `\`${file}${inv.affected?.codeOwnership?.line ? `:${inv.affected.codeOwnership.line}` : ""}\`` : component} along the reproduction steps, reproduce the captured signal, and add the guard/validation that prevents it.${cause ? ` Root signal: ${cause.cause}` : ""}`;
  }
  return "No deterministic failure was captured; reproduce using the recorded steps and instrument the suspected path before changing code.";
}

// Affected systems, de-duplicated and typed, so the UI can render clickable groups.
function affectedSystems(inv) {
  const out = [];
  const push = (type, value, ref) => {
    if (value == null || value === "") return;
    out.push(ref ? { type, value: String(value), ref } : { type, value: String(value) });
  };
  arr(inv.affectedModules).forEach((m) => push("module", m));
  const co = inv.affected?.codeOwnership;
  if (co?.file) push("file", `${co.file}${co.line ? `:${co.line}` : ""}`, { file: co.file, line: co.line ?? null });
  arr(inv.inspectFirst?.files).forEach((f) => push("file", f, { file: f, line: null }));
  if (inv.affected?.component) push("component", inv.affected.component);
  arr(inv.inspectFirst?.components).forEach((c) => push("component", c));
  arr(inv.ownership?.api).forEach((a) => push("api", a));
  arr(inv.ownership?.database).forEach((t) => push("table", t));
  // De-dupe by type+value.
  const seen = new Set();
  return out.filter((e) => {
    const k = `${e.type}:${e.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Implementation suggestions = the investigation's debugging order recast as
// forward-looking build actions, plus layer-specific advice.
function implementationSuggestions(inv) {
  const suggestions = [];
  arr(inv.debuggingOrder).forEach((step) => suggestions.push(step));
  if (inv.ownership?.primary === "api" && first(inv.ownership.api)) {
    suggestions.push(`Wrap the ${first(inv.ownership.api)} call site in the caller with explicit error handling and a user-facing failure state.`);
  }
  if (inv.fixComplexity === "large") {
    suggestions.push("This spans multiple modules — split the fix into a guarded quick-win plus a tracked follow-up rather than one large change.");
  }
  if (inv.codeState?.sourceMap?.status === "drift") {
    suggestions.push("Regenerate the dev-layout section map — the captured code ownership may point at a stale file:line.");
  }
  // De-dupe preserving order.
  return Array.from(new Set(suggestions.filter(Boolean)));
}

// Regression warnings surface the cross-release + drift signals prominently.
function regressionWarnings(inv) {
  const warnings = [];
  const vh = inv.versionHistory || {};
  if (vh.isRegression) {
    warnings.push(`This incident recurred across releases (first seen ${vh.firstSeenVersion || "?"}${vh.lastSeenVersion ? `, last on ${vh.lastSeenVersion}` : ""}) — treat as a regression, not a fresh bug.`);
  }
  if (inv.codeState?.drift?.drifted) {
    warnings.push(`Code drift: ${inv.codeState.drift.note || "the code moved since capture"} — verify the fix against the currently-deployed build.`);
  }
  if (inv.regressionRisk === "high") {
    warnings.push("High regression risk — the change touches a cascade/recurring path; add the regression tests below before merging.");
  }
  const rf = inv.repeatedFailures || {};
  if ((rf.routeCount || 0) + (rf.componentCount || 0) >= 2) {
    warnings.push("Repeated failures observed on this route/component — a partial fix is likely to reopen; verify the root cause, not just the symptom.");
  }
  return Array.from(new Set(warnings));
}

// Verification checklist merges the recommended manual tests + regression tests
// into an actionable, checkable list ({ text, kind }).
function verificationChecklist(inv) {
  const items = [];
  arr(inv.manualTests).forEach((t) => items.push({ text: t, kind: "manual" }));
  arr(inv.regressionTests).forEach((t) => items.push({ text: t, kind: "regression" }));
  if (inv.codeState?.drift?.drifted) {
    items.push({ text: "Confirm the fix reproduces + resolves on the currently-deployed commit (drift detected).", kind: "manual" });
  }
  if (!items.length) items.push({ text: "Reproduce the captured console error and confirm it no longer fires.", kind: "manual" });
  // De-dupe by text.
  const seen = new Set();
  return items.filter((i) => {
    if (seen.has(i.text)) return false;
    seen.add(i.text);
    return true;
  });
}

/**
 * Build the assisted investigation write-up from a developer investigation.
 *
 * @param {object} investigation  the object produced by buildInvestigation()
 * @param {{ report?: object }} [opts]  optional report row for titling context
 * @returns {{
 *   headline: string, summary: string, probableFix: string,
 *   affectedSystems: Array<{type:string,value:string,ref?:object}>,
 *   implementationSuggestions: string[], regressionWarnings: string[],
 *   verificationChecklist: Array<{text:string,kind:string}>,
 *   confidence: number, confidenceLabel: string, generated: boolean,
 * }}
 */
export function buildAssistedInvestigation(investigation, opts = {}) {
  const inv = investigation && typeof investigation === "object" ? investigation : {};
  const report = opts.report || {};

  const moduleName = inv.affected?.module || "the application";
  const severity = inv.severity || "unknown";
  const priority = inv.priority || "";
  const topCause = first(inv.rootCauses);
  const confidence = overallConfidence(inv);

  const subject =
    report.title ||
    inv.affected?.component ||
    (topCause ? topCause.cause : `an issue in ${moduleName}`);

  const headline = `${String(subject).slice(0, 120)} — ${severity.toUpperCase()}${priority ? ` / ${priority}` : ""}`;

  const summaryParts = [];
  summaryParts.push(inv.explanation || `A ${severity}-severity issue was reported in ${moduleName}.`);
  if (topCause) {
    summaryParts.push(`The strongest signal (${pct(topCause.confidence)} confidence) is: ${topCause.cause}`);
  }
  if (inv.ownership?.primary) {
    summaryParts.push(`It most likely sits in the ${inv.ownership.primary} layer.`);
  }
  const summary = summaryParts.join(" ");

  return {
    headline,
    summary,
    probableFix: probableFix(inv),
    affectedSystems: affectedSystems(inv),
    implementationSuggestions: implementationSuggestions(inv),
    regressionWarnings: regressionWarnings(inv),
    verificationChecklist: verificationChecklist(inv),
    confidence: Number(confidence.toFixed(2)),
    confidenceLabel: confidenceLabel(confidence),
    generated: Object.keys(inv).length > 0,
  };
}

/**
 * Compact markdown rendering of the assisted investigation (for copy / GitHub).
 * @param {object} assisted  output of buildAssistedInvestigation
 * @returns {string}
 */
export function assistedInvestigationMarkdown(assisted = {}) {
  const lines = [];
  lines.push(`## ${assisted.headline || "Assisted investigation"}`);
  lines.push("");
  if (assisted.summary) lines.push(assisted.summary, "");
  if (assisted.probableFix) {
    lines.push("### Probable fix");
    lines.push(assisted.probableFix, "");
  }
  if (arr(assisted.affectedSystems).length) {
    lines.push("### Affected systems");
    assisted.affectedSystems.forEach((s) => lines.push(`- **${s.type}:** ${s.value}`));
    lines.push("");
  }
  if (arr(assisted.implementationSuggestions).length) {
    lines.push("### Implementation suggestions");
    assisted.implementationSuggestions.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push("");
  }
  if (arr(assisted.regressionWarnings).length) {
    lines.push("### Regression warnings");
    assisted.regressionWarnings.forEach((w) => lines.push(`- ${w}`));
    lines.push("");
  }
  if (arr(assisted.verificationChecklist).length) {
    lines.push("### Verification checklist");
    assisted.verificationChecklist.forEach((c) => lines.push(`- [ ] ${c.text} _(${c.kind})_`));
    lines.push("");
  }
  lines.push(`_Confidence: ${assisted.confidenceLabel || "low"} (${pct(assisted.confidence)}). Generated deterministically from captured diagnostics — no external AI._`);
  return lines.join("\n");
}
