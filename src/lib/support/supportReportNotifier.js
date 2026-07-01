// file location: src/lib/support/supportReportNotifier.js
//
// Phase 11 — best-effort delivery of the internal "new support report" email.
// Called from the submit route AFTER the report is safely persisted. It must
// NEVER throw and NEVER block report creation: any failure (SMTP down, network,
// bad config) is logged and swallowed. When SMTP is not configured it skips
// silently. The email payload itself is built by the pure buildSupportReportEmail.
//
// `deps` are injectable so the "never blocks" behaviour is unit-testable without
// standing up nodemailer.

import { sendDmsEmail } from "@/lib/email/emailApi";
import { isSmtpConfigured } from "@/lib/email/smtp";
import { resolveEmailBaseUrl } from "@/lib/email/template";
import { buildSupportReportEmail } from "@/lib/support/supportReportEmail";

/**
 * Fire the internal support-report notification. Resolves an outcome object and
 * never rejects.
 *
 * @param {object} args
 * @param {object} [args.req]            The API request (for base-URL resolution + branding).
 * @param {object} args.report          The persisted/derived report fields (see buildSupportReportEmail).
 * @param {number} [args.screenshotCount]
 * @param {object} [args.deps]          { send, isConfigured, resolveBaseUrl } — injectable for tests.
 * @returns {Promise<{ sent: boolean, skipped?: boolean, error?: string }>}
 */
export async function sendSupportReportNotification({
  req,
  report,
  screenshotCount = 0,
  deps = {},
} = {}) {
  const send = deps.send || sendDmsEmail;
  const isConfigured = deps.isConfigured || isSmtpConfigured;
  const resolveBaseUrl = deps.resolveBaseUrl || resolveEmailBaseUrl;

  try {
    if (!isConfigured()) {
      // No SMTP — nothing to do. Report creation already succeeded.
      return { sent: false, skipped: true };
    }

    const appBaseUrl = resolveBaseUrl(req);
    const { to, subject, html, text } = buildSupportReportEmail({
      report: { ...report, screenshotCount },
      appBaseUrl,
    });

    await send({ req, to, subject, html, text });
    return { sent: true };
  } catch (error) {
    // Log safely (no report content) and swallow — never block the submission.
    console.error("[support] notification email failed:", error?.message || error);
    return { sent: false, error: error?.message || "send failed" };
  }
}
