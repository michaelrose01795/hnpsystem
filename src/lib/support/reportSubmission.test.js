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
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_VALUES,
  DEFAULT_SUPPORT_CATEGORY,
  SCREENSHOT_MAX_BYTES,
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
    expect(result.input.diagnostics).toEqual({});
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
