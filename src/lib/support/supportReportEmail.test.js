// file location: src/lib/support/supportReportEmail.test.js
//
// Phase 11 — the internal support-report email must (a) carry every required
// field, (b) leak NOTHING — no diagnostics blob, no secret, no HTML injection —
// and (c) never block report creation. These are privacy/safety guarantees, so
// they are asserted here.

import { describe, it, expect, vi } from "vitest";
import {
  buildSupportReportEmail,
  SUPPORT_NOTIFY_EMAIL,
} from "@/lib/support/supportReportEmail";
import { sendSupportReportNotification } from "@/lib/support/supportReportNotifier";

const baseReport = {
  id: "11111111-2222-3333-4444-555555555555",
  reporterUsername: "Jane Tech",
  reporterRoles: ["techs"],
  category: "bug",
  route: "/job-cards/00076",
  sectionKey: "jobcard-summary-shell",
  sourceFile: "src/components/profile/ProfileWorkTab.js",
  sourceLine: 2046,
  severity: "unset",
  status: "new",
  description: "The save button does nothing when I click it.",
  created_at: "2026-07-01T10:15:00.000Z",
  screenshotCount: 2,
};

describe("buildSupportReportEmail — payload", () => {
  it("sends to the hardcoded internal address", () => {
    const email = buildSupportReportEmail({ report: baseReport });
    expect(email.to).toBe(SUPPORT_NOTIFY_EMAIL);
    expect(email.to).toBe("michaelrose01795@icloud.com");
  });

  it("includes every required field in the HTML and text", () => {
    const email = buildSupportReportEmail({ report: baseReport, appBaseUrl: "https://app.example" });
    for (const body of [email.html, email.text]) {
      expect(body).toContain(baseReport.id); // report id
      expect(body).toContain("Jane Tech"); // reporter name
      expect(body).toContain("techs"); // reporter role
      expect(body).toContain("Something is broken"); // category LABEL, not raw value
      expect(body).toContain("/job-cards/00076"); // route
      expect(body).toContain("jobcard-summary-shell"); // section
      expect(body).toContain("ProfileWorkTab.js:2046"); // source file:line
      expect(body).toContain("unset"); // severity
      expect(body).toContain("new"); // status
      expect(body).toContain("2"); // screenshot count
      expect(body).toContain("The save button does nothing"); // description
    }
    // Open link points at the report detail page.
    expect(email.html).toContain("/dev/support-reports/11111111-2222-3333-4444-555555555555");
    expect(email.subject).toContain("Something is broken");
  });

  it("falls back gracefully when reporter identity is missing", () => {
    const email = buildSupportReportEmail({ report: { ...baseReport, reporterUsername: null, reporterRoles: [] } });
    expect(email.html).toContain("Unknown user");
  });
});

describe("buildSupportReportEmail — never leaks", () => {
  it("never includes the diagnostics blob even if one is passed in", () => {
    const email = buildSupportReportEmail({
      report: {
        ...baseReport,
        diagnostics: { session: { token: "eyJhbGciOiJ.super.secret" }, cookies: "sid=abc123" },
      },
    });
    expect(email.html).not.toContain("super.secret");
    expect(email.html).not.toContain("sid=abc123");
    expect(email.text).not.toContain("super.secret");
  });

  it("scrubs pattern-detectable secrets pasted into the description", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.s3cr3tSignaturePart";
    const email = buildSupportReportEmail({
      report: { ...baseReport, description: `here is my token ${jwt} please help` },
    });
    expect(email.html).not.toContain(jwt);
    expect(email.text).not.toContain(jwt);
    expect(email.html).toContain("[REDACTED:JWT]");
  });

  it("HTML-escapes user free text so it cannot inject markup", () => {
    const email = buildSupportReportEmail({
      report: { ...baseReport, description: '<script>alert("xss")</script> & <b>bold</b>' },
    });
    expect(email.html).not.toContain("<script>alert");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("buildSupportReportEmail — complete, honest report", () => {
  const withDiagnostics = {
    ...baseReport,
    diagnostics: {
      report_context: { reference_code: "ERR-K3F9Q2", reference_source: "error" },
      route: { asPath: "/job-cards/00076", title: "Job Card 00076" },
      recent_actions: [{ type: "click", label: "Save changes" }],
      device: {
        ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        timezone: "Europe/London",
        viewport: { w: 390, h: 844 },
      },
      trigger: {
        origin: "error-toast",
        referenceCode: "ERR-K3F9Q2",
        message: "Couldn't save the job card",
        devInfo:
          "=== HNP SYSTEM ERROR ===\nReference: ERR-K3F9Q2\n\nUser Message: Couldn't save the job card\nTechnical Error: Request failed with status 500\nError Type: HttpError\n\nStack Trace:\nHttpError: Request failed\n    at save (jobs.js:10:5)",
      },
    },
  };

  it("keeps the user's COMPLETE text — no truncation", () => {
    const long = `${"word ".repeat(900)}THE-END-MARKER`;
    const email = buildSupportReportEmail({ report: { ...baseReport, description: long } });
    expect(email.html).toContain("THE-END-MARKER");
    expect(email.text).toContain("THE-END-MARKER");
  });

  it("shows reference, page, action, timezone'd time, device, summary and technical error", () => {
    const email = buildSupportReportEmail({ report: withDiagnostics, appBaseUrl: "https://app.example" });
    for (const body of [email.html, email.text]) {
      expect(body).toContain("ERR-K3F9Q2");
      expect(body).toContain("Job Card 00076");
      expect(body).toContain("Save changes");
      expect(body).toContain("BST");
      expect(body).toContain("Europe/London");
      expect(body).toContain("iOS 17.5");
      expect(body).toContain("Safari 17");
      expect(body).toContain("iPhone");
      expect(body).toMatch(/server hit an error/);
      expect(body).toContain("HttpError");
      expect(body).toContain("at save (jobs.js:10:5)");
    }
    expect(email.subject).toContain("ERR-K3F9Q2");
  });

  it("omits the technical block when there was no error, and says so plainly", () => {
    const email = buildSupportReportEmail({ report: baseReport });
    expect(email.text).not.toContain("TECHNICAL ERROR");
    expect(email.text).toContain("No technical error was recorded");
  });

  it("shows missing facts as Not available instead of inventing them", () => {
    const email = buildSupportReportEmail({ report: baseReport });
    expect(email.text).toMatch(/Device model:\s+Not available \(/);
    expect(email.text).toMatch(/Reference:\s+Not available \(/);
  });

  it("always builds an absolute link from the base URL it is given", () => {
    const email = buildSupportReportEmail({ report: baseReport, appBaseUrl: "https://dms.example.com/" });
    expect(email.html).toContain(`href="https://dms.example.com/dev/support-reports/${baseReport.id}"`);
    expect(email.text).toContain(`Open: https://dms.example.com/dev/support-reports/${baseReport.id}`);
    expect(email.html).not.toContain("localhost");
  });

  it("redacts a password typed into the description", () => {
    const email = buildSupportReportEmail({
      report: { ...baseReport, description: "I logged in, my password is Hunter2! and it failed" },
    });
    expect(email.html).not.toContain("Hunter2");
    expect(email.text).toContain("password is [REDACTED:CREDENTIAL]");
  });
});

describe("sendSupportReportNotification — never blocks", () => {
  it("skips cleanly (no send) when SMTP is not configured", async () => {
    const send = vi.fn();
    const res = await sendSupportReportNotification({
      report: baseReport,
      deps: { send, isConfigured: () => false, resolveBaseUrl: () => "https://app.example" },
    });
    expect(res).toEqual({ sent: false, skipped: true });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends to the internal address when configured", async () => {
    const send = vi.fn().mockResolvedValue({});
    const res = await sendSupportReportNotification({
      report: baseReport,
      screenshotCount: 2,
      deps: { send, isConfigured: () => true, resolveBaseUrl: () => "https://app.example" },
    });
    expect(res).toEqual({ sent: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe(SUPPORT_NOTIFY_EMAIL);
  });

  it("swallows send failures — resolves without throwing", async () => {
    const send = vi.fn().mockRejectedValue(new Error("SMTP exploded"));
    const res = await sendSupportReportNotification({
      report: baseReport,
      deps: { send, isConfigured: () => true, resolveBaseUrl: () => "https://app.example" },
    });
    expect(res.sent).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
