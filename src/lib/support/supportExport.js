// file location: src/lib/support/supportExport.js
//
// Help & Diagnostics ("support") — Phase 6. PURE export/copy helpers for the
// developer Support Centre: a one-click GitHub issue, a copyable developer
// bundle, and a markdown summary. All read only the already-sanitised report /
// diagnostics (the investigation lives inside the RLS-locked blob but is served
// to devs in the detail endpoint), so these add no new privacy surface.

const short = (sha) => (sha ? String(sha).slice(0, 7) : "");
const arr = (v) => (Array.isArray(v) ? v : []);

/** Build a stable deep link to a report in the Support Centre. */
export function reportDeepLink(report, baseUrl = "") {
  const id = report?.id || "";
  const base = String(baseUrl || "").replace(/\/$/, "");
  return `${base}/dev/support-reports/${id}`;
}

function buildLabels(report) {
  const labels = ["support"];
  if (report?.category) labels.push(report.category);
  const sev = report?.severity && report.severity !== "unset" ? report.severity : report?.inv_severity;
  if (sev && sev !== "unset") labels.push(`severity:${sev}`);
  const inv = report?.diagnostics?.investigation;
  if (inv?.priority) labels.push(inv.priority);
  if (inv?.versionHistory?.isRegression) labels.push("regression");
  return Array.from(new Set(labels));
}

/**
 * Build a ready-to-file GitHub issue from a report + its (dev-only) investigation.
 * @param {object} report full detail row (with diagnostics.investigation)
 * @param {{ baseUrl?: string }} [opts]
 * @returns {{ title: string, body: string, labels: string[] }}
 */
export function buildGithubIssue(report = {}, { baseUrl = "" } = {}) {
  const inv = report?.diagnostics?.investigation || {};
  const build = report?.diagnostics?.build || {};
  const titleSource =
    report.title ||
    inv.affected?.component ||
    (report.description ? report.description.split("\n")[0] : "") ||
    "Support incident";
  const sevTag = report.severity && report.severity !== "unset" ? report.severity.toUpperCase() : "";
  const title = `[Support] ${String(titleSource).slice(0, 120)}${sevTag ? ` (${sevTag})` : ""}`;

  const lines = [];
  if (inv.summary) {
    lines.push(inv.summary);
    lines.push("");
  } else {
    lines.push(report.description || "_No description provided._");
    lines.push("");
  }
  lines.push("### Context");
  if (report.route) lines.push(`- Route: \`${report.route}\``);
  if (report.source_file) {
    lines.push(`- Code owner: \`${report.source_file}${report.source_line ? `:${report.source_line}` : ""}\``);
  }
  if (build.version || build.commit_sha) {
    lines.push(`- Captured on: ${build.version || "?"} ${short(build.commit_sha)}${build.commit_ref ? ` @ ${build.commit_ref}` : ""}`.trim());
  }
  if (inv.codeState?.drift?.drifted) lines.push(`- ⚠️ Code drift: ${inv.codeState.drift.note}`);
  if (report.reporter_username) lines.push(`- Reported by: ${report.reporter_username}`);
  lines.push(`- Support report: ${reportDeepLink(report, baseUrl)}`);
  lines.push("");

  if (arr(inv.debuggingOrder).length) {
    lines.push("### Suggested debugging order");
    inv.debuggingOrder.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push("");
  }
  if (arr(inv.regressionTests).length) {
    lines.push("### Regression tests to add");
    inv.regressionTests.forEach((t) => lines.push(`- [ ] ${t}`));
    lines.push("");
  }
  lines.push("_Filed from the HNPSystem Help & Diagnostics Support Centre._");

  return { title, body: lines.join("\n"), labels: buildLabels(report) };
}

/**
 * A compact, copyable developer bundle (the useful subset of the diagnostics,
 * not the whole blob). Returns both the object and a pretty-printed string.
 * @param {object} report
 * @returns {{ bundle: object, text: string }}
 */
export function buildDevBundle(report = {}) {
  const d = report?.diagnostics || {};
  const inv = d.investigation || {};
  const bundle = {
    id: report.id,
    createdAt: report.created_at,
    category: report.category,
    status: report.status,
    severity: report.severity,
    reporter: report.reporter_username || null,
    route: report.route || d.route?.asPath || null,
    codeOwnership: {
      sectionKey: report.section_key || d.code_ownership?.section_key || null,
      file: report.source_file || d.code_ownership?.file || null,
      line: report.source_line ?? d.code_ownership?.line ?? null,
    },
    build: d.build || null,
    codeState: inv.codeState || null,
    versionHistory: inv.versionHistory || null,
    fingerprint: d.fingerprint || null,
    ownership: inv.ownership || null,
    rootCauses: inv.rootCauses || null,
    inspectFirst: inv.inspectFirst || null,
    counts: {
      consoleErrors: arr(d.console_errors).length,
      failedRequests: arr(d.failed_requests).length,
      unhandledErrors: arr(d.unhandled_errors).length,
      recentActions: arr(d.recent_actions).length,
    },
  };
  return { bundle, text: JSON.stringify(bundle, null, 2) };
}

/**
 * A human-readable markdown summary for pasting into chat / notes.
 * @param {object} report
 * @param {{ baseUrl?: string }} [opts]
 * @returns {string}
 */
export function buildMarkdownReport(report = {}, { baseUrl = "" } = {}) {
  const inv = report?.diagnostics?.investigation || {};
  const lines = [];
  lines.push(`# ${report.title || "Support report"} (${report.severity || "unset"})`);
  lines.push("");
  lines.push(report.description || "");
  if (inv.explanation) {
    lines.push("");
    lines.push(`**Analysis:** ${inv.explanation}`);
  }
  lines.push("");
  lines.push(`Link: ${reportDeepLink(report, baseUrl)}`);
  return lines.join("\n");
}
