// file location: src/lib/support/supportReportEmail.js
//
// Phase 11 — pure builder for the internal "new support report" notification
// email. Sent to a developer inbox whenever any authenticated user submits a
// Help & Diagnostics report (wired from src/pages/api/support/reports.js via
// supportReportNotifier.js).
//
// PRIVACY (CLAUDE.md / plan §4): this email carries ONLY the already-sanitised,
// persisted report columns — reporter identity snapshot, category, route, code
// ownership, severity/status, the (scrubbed) user description and a screenshot
// count. It NEVER includes the RLS-locked `diagnostics` blob, tokens, cookies or
// any non-allowlisted value. Every dynamic value is HTML-escaped (the shell
// injects bodyHtml raw), and the free-text description is defensively re-run
// through the shared secret scrub before it is placed in the email.
//
// This module is PURE (no I/O, no Supabase, no SMTP) so the sanitisation +
// payload shape is unit-testable in the node Vitest environment.

import { escapeHtml, renderEmailShell } from "@/lib/email/template";
import { scrubString } from "@/lib/support/sanitise";
import { SUPPORT_CATEGORIES } from "@/lib/support/reportSubmission";

// Hardcoded internal recipient (approved). Changing it is a one-line edit.
export const SUPPORT_NOTIFY_EMAIL = "michaelrose01795@icloud.com";

const MAX_DESCRIPTION_IN_EMAIL = 2000;

const CATEGORY_LABEL = new Map(SUPPORT_CATEGORIES.map((c) => [c.value, c.label]));

const DASH = "—";

function categoryLabel(value) {
  return CATEGORY_LABEL.get(value) || value || DASH;
}

function formatSubmittedAt(value) {
  if (!value) return DASH;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  // UK English, explicit — matches the dev platform's other timestamps.
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function reporterName(report) {
  const name = report?.reporterUsername ?? report?.reporter_username;
  const clean = name ? String(name).trim() : "";
  return clean || "Unknown user";
}

function reporterRoles(report) {
  const roles = report?.reporterRoles ?? report?.reporter_roles;
  if (Array.isArray(roles) && roles.length) return roles.join(", ");
  return DASH;
}

function sourceRef(report) {
  const file = report?.sourceFile ?? report?.source_file;
  if (!file) return DASH;
  const line = report?.sourceLine ?? report?.source_line;
  return Number.isInteger(line) ? `${file}:${line}` : String(file);
}

// A safe, escaped label/value row for the email's definition table.
function row(label, value) {
  const safeValue = escapeHtml(value == null || value === "" ? DASH : String(value));
  return `
    <tr>
      <td style="padding:6px 12px 6px 0;vertical-align:top;color:#6b7280;font-size:13px;white-space:nowrap;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;vertical-align:top;color:#111827;font-size:13px;word-break:break-word;">${safeValue}</td>
    </tr>`;
}

/**
 * Build the internal notification email for a submitted support report.
 *
 * @param {object} args
 * @param {object} args.report   Persisted/derived report fields (camelCase from
 *   the submit route, snake_case tolerated): id, reporterUsername,
 *   reporterRoles[], category, route, sectionKey, sourceFile, sourceLine,
 *   severity, status, description, created_at, screenshotCount.
 * @param {string} [args.appBaseUrl] Absolute app origin for the open link.
 * @param {string} [args.companyName]
 * @returns {{ to: string, subject: string, html: string, text: string }}
 */
export function buildSupportReportEmail({ report = {}, appBaseUrl = "", companyName = "HP Automotive" } = {}) {
  const id = report.id ? String(report.id) : "";
  const shortId = id ? id.slice(0, 8) : "unknown";
  const catLabel = categoryLabel(report.category);
  const route = report.route || DASH;
  const sectionKey = report.sectionKey ?? report.section_key ?? DASH;
  const severity = report.severity || "unset";
  const status = report.status || "new";
  const submittedAt = formatSubmittedAt(report.created_at ?? report.createdAt);
  const screenshotCount = Number.isFinite(report.screenshotCount) ? report.screenshotCount : 0;

  // Defence in depth: the description is already value-scrubbed at ingest, but
  // re-scrub here so this module is safe in isolation, then escape + cap it.
  const rawDescription = report.description ? String(report.description) : "";
  const scrubbed = scrubString(rawDescription).slice(0, MAX_DESCRIPTION_IN_EMAIL);
  const descriptionHtml = escapeHtml(scrubbed).replaceAll("\n", "<br />") || escapeHtml(DASH);

  const base = String(appBaseUrl || "").replace(/\/+$/, "");
  const openPath = id ? `/dev/support-reports/${encodeURIComponent(id)}` : "/dev/support?tab=reports";
  const openUrl = base ? `${base}${openPath}` : openPath;

  const bodyHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
      ${row("Report ID", id || DASH)}
      ${row("Reporter", reporterName(report))}
      ${row("Reporter role", reporterRoles(report))}
      ${row("Category", catLabel)}
      ${row("Submitted", submittedAt)}
      ${row("Route / page", route)}
      ${row("Section", sectionKey)}
      ${row("Source", sourceRef(report))}
      ${row("Severity", severity)}
      ${row("Status", status)}
      ${row("Screenshots", String(screenshotCount))}
    </table>
    <div style="margin:16px 0 4px 0;color:#6b7280;font-size:13px;">Description</div>
    <div class="card" style="font-size:14px;line-height:1.6;color:#111827;white-space:normal;">${descriptionHtml}</div>
    <div style="margin:14px 0 0 0;color:#6b7280;font-size:12px;">Open in the Support Centre: ${escapeHtml(openPath)}</div>
  `;

  const html = renderEmailShell({
    title: `Support report ${shortId}`,
    previewText: `New support report (${catLabel}) from ${reporterName(report)}`,
    companyName,
    eyebrow: "Support / Help & Diagnostics",
    headline: "New support report",
    intro: "A user has submitted a Help & Diagnostics report. The details captured are below.",
    bodyHtml,
    ctaLabel: "Open in Support Centre",
    ctaUrl: openUrl,
    footerText: "Internal support notification — HNP System Developer Platform.",
  });

  const text = [
    "New support report",
    "",
    `Report ID:    ${id || DASH}`,
    `Reporter:     ${reporterName(report)}`,
    `Reporter role:${reporterRoles(report)}`,
    `Category:     ${catLabel}`,
    `Submitted:    ${submittedAt}`,
    `Route / page: ${route}`,
    `Section:      ${sectionKey}`,
    `Source:       ${sourceRef(report)}`,
    `Severity:     ${severity}`,
    `Status:       ${status}`,
    `Screenshots:  ${screenshotCount}`,
    "",
    "Description:",
    scrubbed || DASH,
    "",
    `Open: ${openUrl}`,
  ].join("\n");

  return {
    to: SUPPORT_NOTIFY_EMAIL,
    subject: `[Support] ${catLabel} — report ${shortId}`,
    html,
    text,
  };
}
