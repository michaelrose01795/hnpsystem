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
