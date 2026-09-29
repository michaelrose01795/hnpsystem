// file location: src/lib/support/reportSubmission.test.js
//
// Phase 3 — tests for the pure submit-flow helpers used by POST /api/support/reports.
// These cover the two privacy-critical responsibilities of the route boundary:
//   1. Identity comes from the session, never the client body.
//   2. The diagnostics blob is re-sanitised server-side so planted secrets never
//      reach the database (defence in depth on top of the Phase 1/2 scrubs).
// Plus screenshot decode validation (format / size / empty / none).

import { describe, expect, it } from "vitest";
import {
  buildReportInsert,
  decodeScreenshot,
  decodeScreenshots,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_VALUES,
  DEFAULT_SUPPORT_CATEGORY,
  SCREENSHOT_MAX_BYTES,
  MAX_SCREENSHOTS,
} from "@/lib/support/reportSubmission";

const session = (over = {}) => ({
  user: { id: "42", name: "Dana Tech", roles: ["service manager"], ...over },
});

describe("buildReportInsert — validation", () => {
  it("rejects an empty description", () => {
    const result = buildReportInsert({ body: { description: "   " }, session: session() });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/describe/i);
  });

  it("defaults an unknown category to the safe default", () => {
    const result = buildReportInsert({
      body: { description: "broken", category: "not-a-real-category" },
      session: session(),
    });
    expect(result.ok).toBe(true);
    expect(result.input.category).toBe(DEFAULT_SUPPORT_CATEGORY);
  });

  it("keeps a valid category", () => {
    const result = buildReportInsert({
      body: { description: "x", category: "visual" },
      session: session(),
    });
    expect(result.input.category).toBe("visual");
  });
});

describe("buildReportInsert — identity comes from the session, not the client", () => {
  it("ignores client-supplied reporter fields and uses the session", () => {
    const result = buildReportInsert({
      body: {
        description: "something is wrong",
        reporterUserId: 9999, // attacker-supplied — must be ignored
        reporterUsername: "evil",
        reporterRoles: ["admin manager"],
      },
      session: session(),
    });
    expect(result.ok).toBe(true);
    expect(result.input.reporterUserId).toBe(42);
    expect(result.input.reporterUsername).toBe("Dana Tech");
    expect(result.input.reporterRoles).toEqual(["service manager"]);
  });

  it("yields a null reporterUserId for a non-numeric session id (dev bypass)", () => {
    const result = buildReportInsert({
      body: { description: "x" },
      session: { user: { roles: ["admin manager"] } },
    });
    expect(result.input.reporterUserId).toBeNull();
  });
});

describe("buildReportInsert — diagnostics re-sanitisation (defence in depth)", () => {
  it("scrubs planted secrets out of the diagnostics blob server-side", () => {
    const result = buildReportInsert({
      body: {
        description: "page errored",
        diagnostics: {
          route: { asPath: "/job-cards/00076?token=leakme" },
          console_errors: [{ level: "error", msg: "boom eyJh.eyJb.cccc", ts: 1 }],
          session: { password: "hunter2", access_token: "sk_live_abcdefgh12345678" },
        },
      },
      session: session(),
    });
    expect(result.ok).toBe(true);
    const json = JSON.stringify(result.input.diagnostics);
    expect(json).not.toContain("leakme");
    expect(json).not.toContain("eyJh.eyJb.cccc");
    expect(json).not.toContain("hunter2");
    expect(json).not.toContain("sk_live_abcdefgh12345678");
  });

  it("embeds screenshot annotations + a content hash into diagnostics.attachments by order", () => {
    const result = buildReportInsert({
      body: {
        description: "x",
        diagnostics: {},
        screenshots: [
          { src: "data:image/png;base64,AAAA", annotation: "the broken Save button" },
          { src: "data:image/png;base64,BBBB", annotation: "" }, // no annotation, but still hashed
        ],
      },
      session: session(),
    });
    expect(result.ok).toBe(true);
    const attachments = result.input.diagnostics.attachments;
    expect(attachments).toHaveLength(2);
    expect(attachments[0]).toMatchObject({ order: 0, annotation: "the broken Save button" });
    expect(attachments[0].hash).toEqual(expect.any(String));
    expect(attachments[1]).toMatchObject({ order: 1 });
    expect(attachments[1].annotation).toBeUndefined();
    // Different images → different hashes (feeds cross-report clustering).
    expect(attachments[0].hash).not.toBe(attachments[1].hash);
  });

  it("scrubs secrets planted inside a screenshot annotation", () => {
    const result = buildReportInsert({
      body: {
        description: "x",
        diagnostics: {},
        screenshots: [{ src: "data:image/png;base64,AAAA", annotation: "token sk_live_abcdefgh12345678" }],
      },
      session: session(),
    });
    expect(JSON.stringify(result.input.diagnostics)).not.toContain("sk_live_abcdefgh12345678");
  });

  it("derives route / code-ownership / build columns from the sanitised blob", () => {
    const result = buildReportInsert({
      body: {
        description: "x",
        diagnostics: {
          route: { asPath: "/vhc/123" },
          code_ownership: { section_key: "vhc-tab", file: "src/features/vhc/X.js", line: 710 },
          build: { version: "1.2.3", commit_sha: "abc123", commit_ref: "main", build_id: "bd-9" },
        },
      },
      session: session(),
    });
    expect(result.input.route).toBe("/vhc/123");
    expect(result.input.sectionKey).toBe("vhc-tab");
    expect(result.input.sourceFile).toBe("src/features/vhc/X.js");
    expect(result.input.sourceLine).toBe(710);
    expect(result.input.appVersion).toBe("1.2.3");
    expect(result.input.commitSha).toBe("abc123");
    expect(result.input.commitRef).toBe("main");
    expect(result.input.buildId).toBe("bd-9");
  });

  it("tolerates a missing diagnostics blob", () => {
    const result = buildReportInsert({ body: { description: "x" }, session: session() });
    expect(result.ok).toBe(true);
    expect(result.input.route).toBeNull();
    // Only the server-stamped report context — nothing from the (absent) client blob.
    expect(Object.keys(result.input.diagnostics)).toEqual(["report_context"]);
    expect(result.input.diagnostics.report_context.reference_code).toMatch(/^SUP-/);
  });
});

describe("decodeScreenshot", () => {
  // 1x1 transparent PNG.
  const PNG_1PX =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  it("returns file:null when no screenshot is attached", () => {
    expect(decodeScreenshot(null)).toEqual({ ok: true, file: null });
    expect(decodeScreenshot("")).toEqual({ ok: true, file: null });
    expect(decodeScreenshot(undefined)).toEqual({ ok: true, file: null });
  });

  it("decodes a valid PNG data URL into a buffer + mime type", () => {
    const result = decodeScreenshot(PNG_1PX);
    expect(result.ok).toBe(true);
    expect(result.file.mimeType).toBe("image/png");
    expect(Buffer.isBuffer(result.file.buffer)).toBe(true);
    expect(result.file.buffer.length).toBeGreaterThan(0);
  });

  it("rejects a non-image data URL", () => {
    const result = decodeScreenshot("data:text/html;base64,PHNjcmlwdD4=");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/format/i);
  });

  it("rejects a non-data-url string", () => {
    expect(decodeScreenshot("https://evil.example/x.png").ok).toBe(false);
  });

  it("rejects an oversized screenshot", () => {
    // Build a data URL whose decoded length exceeds the cap.
    const bytes = Buffer.alloc(SCREENSHOT_MAX_BYTES + 1024, 1);
    const oversized = `data:image/png;base64,${bytes.toString("base64")}`;
    const result = decodeScreenshot(oversized);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });
});

describe("decodeScreenshots", () => {
  const PNG_1PX =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  it("returns an empty list when nothing is attached", () => {
    expect(decodeScreenshots(null)).toEqual({ ok: true, files: [] });
    expect(decodeScreenshots([])).toEqual({ ok: true, files: [] });
    expect(decodeScreenshots(undefined)).toEqual({ ok: true, files: [] });
  });

  it("decodes an array of valid images", () => {
    const result = decodeScreenshots([PNG_1PX, PNG_1PX]);
    expect(result.ok).toBe(true);
    expect(result.files).toHaveLength(2);
    expect(result.files.every((f) => f.mimeType === "image/png")).toBe(true);
  });

  it("tolerates a legacy single screenshot string", () => {
    const result = decodeScreenshots(PNG_1PX);
    expect(result.ok).toBe(true);
    expect(result.files).toHaveLength(1);
  });

  it("reads the src from { src, annotation } entries", () => {
    const result = decodeScreenshots([{ src: PNG_1PX, annotation: "here" }]);
    expect(result.ok).toBe(true);
    expect(result.files).toHaveLength(1);
  });

  it("fails the whole batch if any entry is invalid (no half-attached report)", () => {
    const result = decodeScreenshots([PNG_1PX, "data:text/html;base64,PHNjcmlwdD4="]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/format/i);
  });

  it("rejects more than the maximum number of screenshots", () => {
    const result = decodeScreenshots(Array.from({ length: MAX_SCREENSHOTS + 1 }, () => PNG_1PX));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });
});

describe("category catalogue", () => {
  it("the default is a member of the catalogue", () => {
    expect(SUPPORT_CATEGORY_VALUES.has(DEFAULT_SUPPORT_CATEGORY)).toBe(true);
  });

  it("every catalogue entry has a value + label", () => {
    for (const c of SUPPORT_CATEGORIES) {
      expect(typeof c.value).toBe("string");
      expect(typeof c.label).toBe("string");
    }
  });
});

describe("buildReportInsert — complete text + reference code", () => {
  const session = { user: { id: "7", name: "Jane", roles: ["techs"] } };

  it("keeps the full description (up to the limit) without truncating", () => {
    const text = `${"a".repeat(4990)}END`;
    const result = buildReportInsert({ body: { description: text }, session });
    expect(result.ok).toBe(true);
    expect(result.input.description.endsWith("END")).toBe(true);
    expect(result.input.description.length).toBe(4993);
  });

  it("refuses an over-long description instead of silently cutting it", () => {
    const result = buildReportInsert({ body: { description: "a".repeat(5001) }, session });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/5,000 characters/);
  });

  it("keeps the error reference code the user already saw", () => {
    const result = buildReportInsert({ body: { description: "x", referenceCode: "ERR-K3F9Q2" }, session });
    expect(result.input.referenceCode).toBe("ERR-K3F9Q2");
    expect(result.input.diagnostics.report_context.reference_source).toBe("error");
  });

  it("mints a SUP code when none (or a malformed one) was sent", () => {
    const result = buildReportInsert({ body: { description: "x", referenceCode: "<b>bad</b>" }, session });
    expect(result.input.referenceCode).toMatch(/^SUP-[A-Z0-9]{6}$/);
    expect(result.input.diagnostics.report_context.reference_source).toBe("report");
  });

  it("stamps the server receive time and the request user agent", () => {
    const now = new Date("2026-07-01T10:15:30.000Z");
    const result = buildReportInsert({ body: { description: "x" }, session, userAgent: "UA/1.0", now });
    expect(result.input.diagnostics.report_context.received_at).toBe("2026-07-01T10:15:30.000Z");
    expect(result.input.diagnostics.report_context.request_user_agent).toBe("UA/1.0");
  });
});
