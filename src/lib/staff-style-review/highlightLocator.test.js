// file location: src/lib/staff-style-review/highlightLocator.test.js
import { describe, expect, it } from "vitest";
import {
  MIN_TARGET_SCORE,
  extractLocatorHints,
  hasUsableHints,
  parseStyleAttribute,
  scoreDescriptor,
  sectionKeyMatches,
} from "@/lib/staff-style-review/highlightLocator";

const lines = (source) => source.split("\n");

describe("extractLocatorHints", () => {
  it("pulls class tokens, literal attributes and static text from the audited element", () => {
    const source = lines(`
export function Pill() {
  return (
    <span className="app-badge app-badge--warning" aria-label="Alert summary">
      Awaiting authorisation
    </span>
  );
}
`);
    const hints = extractLocatorHints(source, 4);
    expect(hints.classNames).toEqual(["app-badge", "app-badge--warning"]);
    expect(hints.attributes).toEqual([{ name: "aria-label", value: "Alert summary" }]);
    expect(hints.texts).toContain("Awaiting authorisation");
  });

  it("reads inline style declarations from a `return (` line, kebab-casing the properties", () => {
    // Mirrors audit finding 1 (TopbarAlerts AlertBadge): the recorded line is the
    // `return (`, and the element itself carries no class or literal text.
    const source = lines(`
export function AlertBadge() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "-12px",
        borderRadius: "var(--radius-pill)",
        background: tone.bg,
      }}
    >
      {latest.message}
    </div>
  );
}
`);
    const hints = extractLocatorHints(source, 3);
    expect(hints.styleDeclarations).toEqual([
      { property: "position", value: "absolute" },
      { property: "bottom", value: "-12px" },
      { property: "border-radius", value: "var(--radius-pill)" },
    ]);
    expect(hasUsableHints(hints)).toBe(true);
  });

  it("keeps the static segments of a template-literal className and drops interpolations", () => {
    const source = lines(`<span className={\`app-badge app-badge--\${tone}\`}>x</span>`);
    expect(extractLocatorHints(source, 1).classNames).toEqual(["app-badge"]);
  });

  it("returns no usable hints when the element is entirely dynamic", () => {
    const source = lines(`<div style={{ background: tone.bg }}>{value}</div>`);
    expect(hasUsableHints(extractLocatorHints(source, 1))).toBe(false);
  });
});

describe("scoreDescriptor", () => {
  const hints = {
    classNames: ["app-badge"],
    attributes: [{ name: "aria-label", value: "Alert summary" }],
    styleDeclarations: [{ property: "bottom", value: "-12px" }],
    texts: ["Awaiting authorisation"],
  };

  it("scores an exact match above the target threshold and reports what matched", () => {
    const result = scoreDescriptor(
      { classList: ["app-badge"], attributes: { "aria-label": "Alert summary" }, style: { bottom: "-12px" }, text: "Awaiting authorisation" },
      hints
    );
    expect(result.score).toBe(3 + 4 + 2 + 2);
    expect(result.matched).toContain('aria-label="Alert summary"');
  });

  it("leaves an unrelated element below the threshold", () => {
    const result = scoreDescriptor({ classList: ["app-card"], attributes: {}, style: { bottom: "0px" }, text: "Other" }, hints);
    expect(result.score).toBeLessThan(MIN_TARGET_SCORE);
  });

  it("matches on inline style alone when that is the only surviving signal", () => {
    const styleOnly = { styleDeclarations: [{ property: "bottom", value: "-12px" }, { property: "position", value: "absolute" }] };
    const result = scoreDescriptor({ classList: [], attributes: {}, style: { bottom: "-12px", position: "absolute" }, text: "" }, styleOnly);
    expect(result.score).toBeGreaterThanOrEqual(MIN_TARGET_SCORE);
  });
});

describe("parseStyleAttribute", () => {
  it("normalises a rendered style attribute into comparable declarations", () => {
    expect(parseStyleAttribute("position: absolute; bottom: -12px; border-radius: var(--radius-pill);")).toEqual({
      position: "absolute",
      bottom: "-12px",
      "border-radius": "var(--radius-pill)",
    });
  });
});

describe("sectionKeyMatches", () => {
  it("matches exact keys and dynamic patterns from the section source map", () => {
    expect(sectionKeyMatches("profile-work-shell", "profile-work-shell")).toBe(true);
    expect(sectionKeyMatches("*-chart", "service-overview-chart")).toBe(true);
    expect(sectionKeyMatches("*-chart", "service-overview-table")).toBe(false);
  });
});
