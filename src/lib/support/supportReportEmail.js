// file location: src/lib/support/supportReportEmail.js
//
// Phase 11 — pure builder for the internal "new support report" notification
// email. Sent to a developer inbox whenever any authenticated user submits a
// Help & Diagnostics report (wired from src/pages/api/support/reports.js via
// supportReportNotifier.js).
//
// CONTENT: the reference code, the user's COMPLETE submitted text, the page and
// the action involved, the exact submission time with timezone (plus the user's
// own local time when they are in a different zone), device model / OS /
// browser, a plain-language error summary and — only when an actual error
// exists — the full technical error block. Every fact comes from
// buildReportFacts() (src/lib/support/reportDetails.js), the same source the
// Support Centre uses, and a fact that was not captured is shown as
// "Not available (reason)" — never guessed.
//
// PRIVACY (CLAUDE.md / plan §4): the raw `diagnostics` blob is NEVER placed in
// the email. Only the curated facts are, and they are re-run through the shared
// sanitiser (credentials, tokens, cookies, card numbers, emails redacted).
// Every dynamic value is HTML-escaped (the shell injects bodyHtml raw).
//
// LAYOUT: single-column stacked rows (label above value) so it reads on a phone
// without horizontal scrolling; long values and stack traces wrap. The link
// is ALWAYS absolute, built from the configured public site URL by the caller.
//
// This module is PURE (no I/O, no Supabase, no SMTP) so it is unit-testable.

import { escapeHtml, renderEmailShell } from "@/lib/email/template";
import { scrubString } from "@/lib/support/sanitise";
import { SUPPORT_CATEGORIES } from "@/lib/support/reportSubmission";
import { buildReportFacts, factText, technicalErrorText, NOT_AVAILABLE } from "@/lib/support/reportDetails";

// Hardcoded internal recipient (approved). Changing it is a one-line edit.
export const SUPPORT_NOTIFY_EMAIL = "michaelrose01795@icloud.com";

const CATEGORY_LABEL = new Map(SUPPORT_CATEGORIES.map((c) => [c.value, c.label]));

const DASH = "—";

// Email clients ignore <style> unevenly, so the few visual rules are inline.
// Colours are email-safe literals (the staff design tokens do not exist in an
// inbox) and match the palette of renderEmailShell.
const S = {
  sectionTitle: "margin:22px 0 8px 0;color:#991b1b;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;",
  label: "margin:0;color:#6b7280;font-size:12px;line-height:1.4;",
  value: "margin:2px 0 0 0;color:#111827;font-size:15px;line-height:1.5;word-break:break-word;overflow-wrap:anywhere;",
  missing: "margin:2px 0 0 0;color:#6b7280;font-size:14px;line-height:1.5;font-style:italic;",
  rowCell: "padding:7px 0;",
  text: "margin:0;font-size:15px;line-height:1.6;color:#111827;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;",
  ref: "display:inline-block;margin:0 0 4px 0;padding:6px 10px;border-radius:6px;background:#fef2f2;color:#991b1b;font-family:Menlo,Consolas,monospace;font-size:16px;font-weight:700;letter-spacing:0.04em;",
  summary: "margin:0;padding:12px 14px;border-radius:8px;background:#f9fafb;color:#111827;font-size:15px;line-height:1.5;",
  pre: "margin:0;padding:12px;border-radius:8px;background:#f3f4f6;color:#111827;font-family:Menlo,Consolas,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;",
  link: "margin:14px 0 0 0;color:#6b7280;font-size:12px;line-height:1.5;word-break:break-all;",
};

function categoryLabel(value) {
  return CATEGORY_LABEL.get(value) || value || DASH;
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

const asFact = (value) => (value && typeof value === "object" && "value" in value ? value : { value: value == null || value === "" ? null : String(value), missing: null });

// One stacked label/value row. `value` may be a fact ({ value, missing }) or a
// plain string; missing facts render as an honest, muted "Not available (…)".
function row(label, value) {
  const f = asFact(value);
  const body = f.value
    ? `<p style="${S.value}">${escapeHtml(scrubString(f.value))}</p>`
    : `<p style="${S.missing}">${escapeHtml(factText(f))}</p>`;
  return `<tr><td style="${S.rowCell}"><p style="${S.label}">${escapeHtml(label)}</p>${body}</td></tr>`;
}

function table(rows) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;width:100%;">${rows.join("")}</table>`;
}

const section = (title) => `<p style="${S.sectionTitle}">${escapeHtml(title)}</p>`;

// Plain-text line with aligned label.
const line = (label, value) => `${`${label}:`.padEnd(15)} ${typeof value === "object" && value ? factText(value) : value ?? DASH}`;

/**
 * Build the internal notification email for a submitted support report.
 *
 * @param {object} args
 * @param {object} args.report   Persisted/derived report fields (camelCase from
 *   the submit route, snake_case tolerated), INCLUDING `diagnostics`, which is
 *   read only through buildReportFacts() and never copied into the email.
 * @param {object[]} [args.errorEvents] Automatically-captured error events linked
 *   to the report by reference code.
 * @param {string} [args.appBaseUrl] Absolute public app origin for the link.
 * @param {string} [args.companyName]
 * @returns {{ to: string, subject: string, html: string, text: string }}
 */
export function buildSupportReportEmail({ report = {}, errorEvents = [], appBaseUrl = "", companyName = "HP Automotive" } = {}) {
  const id = report.id ? String(report.id) : "";
  const shortId = id ? id.slice(0, 8) : "unknown";
  const catLabel = categoryLabel(report.category);
  const severity = report.severity || "unset";
  const status = report.status || "new";
  const screenshotCount = Number.isFinite(report.screenshotCount) ? report.screenshotCount : 0;

  const facts = buildReportFacts({ report, errorEvents });
  const ref = facts.referenceCode.value;
  const refLabel = ref || `report ${shortId}`;

  // The user's words, complete. Defensively re-scrubbed (already scrubbed on
  // ingest), never truncated.
  const submittedText = scrubString(String(report.description || "")) || "";
  const submittedHtml = submittedText
    ? `<p style="${S.text}">${escapeHtml(submittedText)}</p>`
    : `<p style="${S.missing}">${escapeHtml(`${NOT_AVAILABLE} (no text was submitted)`)}</p>`;

  const base = String(appBaseUrl || "").replace(/\/+$/, "");
  const openPath = id ? `/dev/support-reports/${encodeURIComponent(id)}` : "/dev/support-reports";
  const openUrl = base ? `${base}${openPath}` : openPath;

  const error = facts.error;
  const technical = technicalErrorText(error);

  const bodyHtml = `
    <p style="${S.label}">Reference code</p>
    <p style="margin:4px 0 0 0;">${
      ref
        ? `<span style="${S.ref}">${escapeHtml(ref)}</span>`
        : `<span style="${S.missing}">${escapeHtml(factText(facts.referenceCode))}</span>`
    }</p>

    ${section("What happened")}
    <p style="${S.summary}">${escapeHtml(facts.errorSummary)}</p>

    ${section("What the user wrote")}
    ${submittedHtml}

    ${section("Where and when")}
    ${table([
      row("Page", facts.page),
      row("Page title", facts.pageTitle),
      row("Action", facts.action),
      row("Submitted (UK time)", facts.submittedAt),
      ...(facts.userLocalTime ? [row(`User's local time (${facts.userTimezone.value})`, facts.userLocalTime)] : []),
    ])}

    ${section("Device")}
    ${table([
      row("Device model", facts.deviceModel),
      row("Device type", facts.deviceType),
      row("Operating system", facts.os),
      row("Browser", facts.browser),
      row("Screen", facts.screen),
    ])}

    ${section("Reporter & triage")}
    ${table([
      row("Reporter", reporterName(report)),
      row("Role", reporterRoles(report)),
      row("Category", catLabel),
      row("Severity", severity),
      row("Status", status),
      row("Screenshots", String(screenshotCount)),
      row("Section", report.sectionKey ?? report.section_key ?? DASH),
      row("Source", sourceRef(report)),
      row("Report ID", id || DASH),
    ])}

    ${
      error
        ? `${section(error.certainty === "possible" ? "Technical details (possibly related)" : "Technical error")}
    <pre style="${S.pre}">${escapeHtml(technical)}</pre>`
        : ""
    }

    <p style="${S.link}">Open in the Support Centre:<br /><a href="${escapeHtml(openUrl)}" style="color:#b91c1c;">${escapeHtml(openUrl)}</a></p>
  `;

  const html = renderEmailShell({
    title: `Support report ${refLabel}`,
    previewText: `${catLabel} from ${reporterName(report)} — ${facts.errorSummary}`.slice(0, 180),
    companyName,
    eyebrow: "Support / Help & Diagnostics",
    headline: "New support report",
    intro: "A user has submitted a Help & Diagnostics report. The details captured are below.",
    bodyHtml,
    ctaLabel: "Open in Support Centre",
    ctaUrl: openUrl,
    footerText: "Internal support notification — HNP System Developer Platform. Sensitive values are redacted.",
  });

  const text = [
    "New support report",
    "",
    line("Reference", facts.referenceCode),
    "",
    "WHAT HAPPENED",
    facts.errorSummary,
    "",
    "WHAT THE USER WROTE",
    submittedText || `${NOT_AVAILABLE} (no text was submitted)`,
    "",
    "WHERE AND WHEN",
    line("Page", facts.page),
    line("Page title", facts.pageTitle),
    line("Action", facts.action),
    line("Submitted", facts.submittedAt),
    ...(facts.userLocalTime ? [line("User's time", facts.userLocalTime)] : []),
    "",
    "DEVICE",
    line("Device model", facts.deviceModel),
    line("Device type", facts.deviceType),
    line("OS", facts.os),
    line("Browser", facts.browser),
    line("Screen", facts.screen),
    "",
    "REPORTER & TRIAGE",
    line("Reporter", reporterName(report)),
    line("Role", reporterRoles(report)),
    line("Category", catLabel),
    line("Severity", severity),
    line("Status", status),
    line("Screenshots", String(screenshotCount)),
    line("Section", report.sectionKey ?? report.section_key ?? DASH),
    line("Source", sourceRef(report)),
    line("Report ID", id || DASH),
    ...(error ? ["", error.certainty === "possible" ? "TECHNICAL DETAILS (POSSIBLY RELATED)" : "TECHNICAL ERROR", technical] : []),
    "",
    `Open: ${openUrl}`,
  ].join("\n");

  return {
    to: SUPPORT_NOTIFY_EMAIL,
    subject: `[Support] ${ref ? `${ref} · ` : ""}${catLabel} — ${reporterName(report)}`,
    html,
    text,
  };
}
