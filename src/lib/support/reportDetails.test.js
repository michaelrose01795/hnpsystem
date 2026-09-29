// file location: src/lib/support/reportDetails.test.js
//
// The facts every support report shows (email + Support Centre) must be
// accurate, honest about what is missing, and free of secrets.

import { describe, it, expect } from "vitest";
import {
  buildReportFacts,
  describeErrorPlainly,
  describeReportAction,
  factText,
  formatReportTime,
  isValidReferenceCode,
  mintSupportReferenceCode,
  parseUserAgent,
  resolveReportError,
  technicalErrorText,
} from "@/lib/support/reportDetails";
import { buildErrorAlert } from "@/lib/notifications/buildErrorAlert";
import { buildBoundaryReportPrefill } from "@/lib/support/errorBoundaryDiagnostics";

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  samsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  androidReduced:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
};

describe("parseUserAgent", () => {
  it("reads iPhone OS, Safari and the (generic) Apple model", () => {
    const p = parseUserAgent(UA.iphone);
    expect(p.os.value).toBe("iOS 17.5");
    expect(p.browser.value).toBe("Safari 17");
    expect(p.deviceModel.value).toBe("iPhone");
    expect(p.deviceType.value).toBe("Phone");
  });

  it("reads a real Android model and Samsung Internet", () => {
    const p = parseUserAgent(UA.samsung);
    expect(p.os.value).toBe("Android 14");
    expect(p.deviceModel.value).toBe("SM-S918B");
    expect(p.browser.value).toBe("Samsung Internet 25");
  });

  it("does NOT treat Chrome's reduced-UA 'K' as a model", () => {
    const p = parseUserAgent(UA.androidReduced);
    expect(p.deviceModel.value).toBeNull();
    expect(factText(p.deviceModel)).toMatch(/^Not available \(/);
  });

  it("takes the model and OS version from client hints when shared", () => {
    const p = parseUserAgent(UA.androidReduced, { platform: "Android", platformVersion: "14.0.0", model: "Pixel 8" });
    expect(p.deviceModel.value).toBe("Pixel 8");
    expect(p.os.value).toBe("Android 14.0.0");
  });

  it("distinguishes Windows 11 via client hints and names Edge over Chrome", () => {
    expect(parseUserAgent(UA.windowsEdge).os.value).toBe("Windows 10 or 11");
    const p = parseUserAgent(UA.windowsEdge, { platform: "Windows", platformVersion: "15.0.0" });
    expect(p.os.value).toBe("Windows 11");
    expect(p.browser.value).toBe("Edge 126");
    expect(p.deviceModel.missing).toMatch(/desktop/);
  });

  it("recognises an iPad posing as a Mac by its touch points", () => {
    expect(parseUserAgent(UA.mac).os.value).toBe("macOS");
    expect(parseUserAgent(UA.mac, {}, { touchPoints: 5 }).os.value).toBe("iPadOS");
  });

  it("says the browser was not recorded when there is no user agent", () => {
    const p = parseUserAgent("");
    expect(p.os.value).toBeNull();
    expect(p.browser.missing).toMatch(/not recorded/);
  });

  it("reads Firefox on Linux", () => {
    const p = parseUserAgent(UA.firefox);
    expect(p.os.value).toBe("Linux");
    expect(p.browser.value).toBe("Firefox 127");
  });
});

describe("formatReportTime", () => {
  it("labels summer UK time as BST with its offset and zone", () => {
    const t = formatReportTime("2026-07-01T10:15:30.000Z");
    expect(t.value).toContain("11:15:30");
    expect(t.value).toContain("BST");
    expect(t.value).toContain("UTC+01:00");
    expect(t.value).toContain("Europe/London");
    expect(t.iso).toBe("2026-07-01T10:15:30.000Z");
  });

  it("labels winter UK time as GMT", () => {
    const t = formatReportTime("2026-01-15T09:00:00.000Z");
    expect(t.value).toContain("09:00:00");
    expect(t.value).toContain("GMT");
  });

  it("formats in another zone when asked", () => {
    const t = formatReportTime("2026-07-01T10:15:30.000Z", "America/New_York");
    expect(t.value).toContain("06:15:30");
    expect(t.value).toContain("America/New_York");
  });

  it("is honest about a missing or bad time", () => {
    expect(formatReportTime(null).value).toBeNull();
    expect(formatReportTime("not a date").missing).toMatch(/could not be read/);
  });
});

describe("reference codes", () => {
  it("mints SUP-… codes that validate", () => {
    const code = mintSupportReferenceCode(1_760_000_000_000, () => 0.5);
    expect(code).toMatch(/^SUP-[A-Z0-9]{6}$/);
    expect(isValidReferenceCode(code)).toBe(true);
  });
  it("accepts ERR-… codes and rejects junk", () => {
    expect(isValidReferenceCode("ERR-K3F9Q2")).toBe(true);
    expect(isValidReferenceCode("<script>")).toBe(false);
    expect(isValidReferenceCode("")).toBe(false);
  });
});

describe("describeReportAction", () => {
  it("skips the click that opened the report and names the one before", () => {
    const a = describeReportAction({
      recent_actions: [
        { type: "click", label: "Save changes" },
        { type: "click", label: "Report a problem" },
      ],
    });
    expect(a.value).toContain("Clicked “Save changes”");
    expect(a.value).toContain("Report a problem");
  });

  it("describes navigation", () => {
    const a = describeReportAction({ recent_actions: [{ type: "route_change", from: "/a", to: "/b" }] });
    expect(a.value).toContain("Navigated from /a to /b");
  });

  it("says plainly when nothing was recorded", () => {
    expect(describeReportAction({}).value).toMatch(/No earlier action was recorded/);
  });

  it("names the error notification origin", () => {
    expect(describeReportAction({ trigger: { origin: "error-toast" } }).value).toMatch(/error notification/);
  });
});

describe("resolveReportError", () => {
  it("returns null when no error exists", () => {
    expect(resolveReportError({})).toBeNull();
    expect(describeErrorPlainly(null)).toMatch(/No technical error was recorded/);
  });

  it("reads the full technical detail back out of an error toast's devInfo", () => {
    const err = new TypeError("Request failed with status 500");
    const alert = buildErrorAlert("Couldn't save the job card", err, { endpoint: "/api/jobcards/save" });
    const e = resolveReportError({
      trigger: { origin: "error-toast", referenceCode: alert.referenceCode, message: alert.message, devInfo: alert.devInfo },
    });
    expect(e.certainty).toBe("confirmed");
    expect(e.name).toBe("TypeError");
    expect(e.message).toBe("Request failed with status 500");
    expect(e.statusCode).toBe(500);
    expect(e.endpoint).toBe("/api/jobcards/save");
    expect(e.stack).toContain("TypeError");
    expect(describeErrorPlainly(e)).toMatch(/server hit an error.*HTTP 500.*Couldn't save the job card/);
  });

  it("uses the crash the user reported from on the recovery screen", () => {
    const error = new Error("Cannot read properties of undefined (reading 'map')");
    const prefill = buildBoundaryReportPrefill({
      error,
      componentStack: "\n    in PartsTable (at x.js:1)",
      referenceCode: "ERR-AB12CD",
    });
    const e = resolveReportError({ trigger: prefill.trigger });
    expect(e.kind).toBe("render");
    expect(e.message).toContain("reading 'map'");
    expect(e.component).toBe("PartsTable");
    expect(e.componentStack).toContain("PartsTable");
    expect(describeErrorPlainly(e)).toMatch(/part of the screen stopped working/i);
  });

  it("merges linked auto-captured events", () => {
    const e = resolveReportError({}, [
      { kind: "api", message: "Upload failed", status_code: 413, stack: "Error: Upload failed", occurrences: 3 },
    ]);
    expect(e.certainty).toBe("confirmed");
    expect(e.statusCode).toBe(413);
    expect(e.occurrences).toBe(3);
    expect(describeErrorPlainly(e)).toMatch(/too large.*HTTP 413/);
  });

  it("flags session errors as only possibly related", () => {
    const e = resolveReportError({ unhandled_errors: [{ message: "x is not a function", stack: "at y" }] });
    expect(e.certainty).toBe("possible");
    expect(describeErrorPlainly(e)).toMatch(/^No error was shown to the user, but/);
  });

  it("describes a network failure", () => {
    const e = resolveReportError({ failed_requests: [{ method: "POST", url: "/api/x", status: 0 }] });
    expect(describeErrorPlainly(e)).toMatch(/could not reach the server/);
  });
});

describe("buildReportFacts", () => {
  const report = {
    id: "11111111-2222-3333-4444-555555555555",
    description: "Line one\nLine two",
    route: "/job-cards/00076",
    created_at: "2026-07-01T10:15:30.000Z",
    diagnostics: {
      report_context: { reference_code: "SUP-ABCD12", reference_source: "report" },
      route: { asPath: "/job-cards/00076", pathname: "/job-cards/[jobNumber]", title: "Job Card 00076" },
      device: {
        ua: UA.samsung,
        timezone: "Europe/Madrid",
        viewport: { w: 412, h: 915 },
        dpr: 2.625,
        online: true,
        lang: "en-GB",
      },
      session: { token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig-part-here" },
    },
  };

  it("collects every human-facing fact", () => {
    const f = buildReportFacts({ report });
    expect(f.referenceCode.value).toBe("SUP-ABCD12");
    expect(f.submittedText).toBe("Line one\nLine two");
    expect(f.page.value).toBe("/job-cards/00076");
    expect(f.pageTitle.value).toBe("Job Card 00076");
    expect(f.submittedAt.value).toContain("BST");
    expect(f.userLocalTime.value).toContain("12:15:30");
    expect(f.userLocalTime.value).toContain("Europe/Madrid");
    expect(f.deviceModel.value).toBe("SM-S918B");
    expect(f.os.value).toBe("Android 14");
    expect(f.screen.value).toBe("412×915 @2.625x");
    expect(f.error).toBeNull();
  });

  it("never carries session values into the facts", () => {
    expect(JSON.stringify(buildReportFacts({ report }))).not.toContain("sig-part-here");
  });

  it("is honest about an old report with nothing captured", () => {
    const f = buildReportFacts({ report: { description: "old", created_at: null } });
    expect(f.referenceCode.value).toBeNull();
    expect(factText(f.referenceCode)).toMatch(/before reference codes were issued/);
    expect(f.deviceModel.value).toBeNull();
    expect(f.submittedAt.value).toBeNull();
    expect(f.userLocalTime).toBeNull();
  });

  it("falls back to the request user agent when the client sent no device", () => {
    const f = buildReportFacts({
      report: { description: "x", diagnostics: { report_context: { request_user_agent: UA.iphone } } },
    });
    expect(f.os.value).toBe("iOS 17.5");
  });

  it("redacts secrets that reach the technical block", () => {
    const text = technicalErrorText({
      certainty: "confirmed",
      source: "x",
      message: "failed with Authorization: Bearer abc.def.ghi and password=hunter2",
      stack: "at fetch (https://admin:pa55@example.com/x)",
    });
    expect(text).not.toContain("abc.def.ghi");
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("pa55");
  });
});
