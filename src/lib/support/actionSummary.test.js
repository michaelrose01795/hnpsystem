// file location: src/lib/support/actionSummary.test.js
import { describe, expect, it } from "vitest";
import { describeAction, buildDescriptionDraft } from "@/lib/support/actionSummary";

describe("describeAction", () => {
  it("describes a route change", () => {
    expect(describeAction({ type: "route_change", from: "/a", to: "/b" })).toBe("Opened /b from /a");
  });
  it("describes a labelled click with its section", () => {
    expect(describeAction({ type: "click", label: "Save", sectionKey: "jobcard-header" })).toBe(
      'Clicked "Save" (jobcard-header)'
    );
  });
  it("describes a render error", () => {
    expect(describeAction({ type: "render_error", label: "boom" })).toContain("A screen error occurred: boom");
  });
  it("falls back to type for unknown actions", () => {
    expect(describeAction({ type: "wibble" })).toBe("wibble");
  });
});

describe("buildDescriptionDraft", () => {
  const snapshot = {
    route: { asPath: "/job-cards/00099" },
    console_errors: [{ msg: "x" }],
    unhandled_errors: [{ message: "boom" }],
    failed_requests: [{ url: "/api/x" }],
    recent_actions: [
      { type: "route_change", to: "/job-cards/00099" },
      { type: "click", label: "Open VHC", sectionKey: "jobcard-tab-vhc" },
      { type: "render_error", label: "boom" },
    ],
  };

  it("includes the page, detected signals, and a numbered step list", () => {
    const draft = buildDescriptionDraft(snapshot);
    expect(draft).toContain("Page: /job-cards/00099");
    expect(draft).toContain("2 errors"); // 1 console + 1 unhandled
    expect(draft).toContain("1 failed request");
    expect(draft).toContain("1. Opened /job-cards/00099");
    expect(draft).toContain('2. Clicked "Open VHC" (jobcard-tab-vhc)');
    expect(draft).toContain("What went wrong / what I expected:");
  });

  it("caps the step list at the last 10 actions", () => {
    const many = {
      recent_actions: Array.from({ length: 25 }, (_, i) => ({ type: "click", label: `c${i}` })),
    };
    const draft = buildDescriptionDraft(many);
    expect(draft).toContain("Recent steps (last 10):");
    expect(draft).toContain("c24"); // most recent kept
    expect(draft).not.toContain("c14"); // older than the last 10 dropped
    expect(draft).toContain("10. ");
    expect(draft).not.toContain("11. ");
  });

  it("handles an empty snapshot gracefully", () => {
    const draft = buildDescriptionDraft({});
    expect(draft).toContain("Recent steps: none were captured.");
    expect(draft).not.toContain("Detected:");
  });
});
