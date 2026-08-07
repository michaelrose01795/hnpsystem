// file location: src/lib/staff-style-review/codexPrompt.js
//
// Builds the one-sentence Codex prompt for a Staff Style Review finding.
//
// Lives in lib/ (not in the page) because two surfaces need the identical
// wording: the review popup's Copy action and the floating review command
// panel that travels with the reviewer onto the audited page.

// The shared staffglobal.css family each audit category should be adopting, named the way the
// prompt reader (Codex) needs to see it so it looks for the existing shared implementation.
export const STAFF_FAMILY_BY_CATEGORY = Object.freeze({
  badge: "the existing badge family (`.app-badge` and its tone modifiers)",
  button: "the existing button family (the shared `<Button>` component / `.app-btn` classes)",
  input: "the existing input family (`.app-input` and its field/label wrappers)",
  popup: "the existing popup/modal family (`.app-modal` / the shared `StaffModal` shell)",
  specialised: "whichever existing shared staff family already covers this type of UI",
});

export function condense(value, limit) {
  const text = String(value ?? "").replace(/`/g, "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

// A finding is flagged as a possible deliberate exception when the audit itself recorded a
// specialist-exception note or classified it as specialised — those must be inspected and
// reported on, never force-converted to a shared family.
export function isSpecialistException(finding) {
  return finding?.category === "specialised" || Boolean(String(finding?.specialistExceptionNotes || "").trim());
}

// One sentence, built only from the current finding plus the reviewer's own notes, so the prompt
// stays copy-and-run and never drifts from what is on screen. The category decides which shared
// staffglobal.css family the prompt names, so badge findings point Codex at the badge family,
// button findings at the button family, and so on.
export function buildCodexPrompt(finding, reviewNotes) {
  if (!finding) return "";
  const family = STAFF_FAMILY_BY_CATEGORY[finding.category] || STAFF_FAMILY_BY_CATEGORY.specialised;
  const source = condense(finding.sourceReference, 220);
  const note = condense(reviewNotes, 200);
  const visibility = condense(finding.visibilityInstructions, 240);
  return [
    `In HNPSystem, inspect ${source ? `\`${source}\`` : "the audited source (not recorded)"}`,
    " and every rendered use of the affected component",
    ` for "${condense(finding.sectionName, 120) || "the audited item"}"`,
    ` on route ${condense(finding.route, 120) || "the audited route"}`,
    ` (staff style audit ID ${finding.auditId}`,
    visibility ? `; how to see it: ${visibility}` : "",
    `; audit rationale: ${condense(finding.issueSummary, 240) || "not recorded"})`,
    `, confirm which shared \`staffglobal.css\` family already applies to this type of UI — here ${family} —`,
    " then replace only the custom inline or locally recreated visual styling that duplicates that shared staff styling",
    " with the correct existing shared classes or reusable component",
    ", removing conflicting inline visual overrides where appropriate",
    ", while preserving layout, behaviour, data logic, permissions, responsive behaviour and any deliberate feature-specific design",
    ", and changing no unrelated UI",
    isSpecialistException(finding)
      ? ", treating this as a possible deliberate specialist exception by inspecting and reporting back first rather than forcing a conversion if the current styling is intentional"
      : "",
    note ? `, taking the reviewer note "${note}" into account` : "",
    ".",
  ].join("");
}
