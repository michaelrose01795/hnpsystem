// Phase 1 Staff Global Style Review importer.
//
// The markdown audit remains the immutable evidence source. This parser only
// imports the four requested implementation families (IDs 1-128) and the one
// specialised VHC camera/HUD decision. It does not inspect application source.

export const STAFF_STYLE_REVIEW_STATUSES = Object.freeze([
  "Pending",
  "Keep",
  "Change",
  "Unable to Locate",
  "Needs Manual Review",
  "Final Check",
]);

export const STAFF_STYLE_REVIEW_GROUPS = Object.freeze({
  badge: "Badges, chips, statuses, categories and counts",
  button: "Buttons and actions",
  input: "Inputs and form controls",
  popup: "Popup and modal shells",
  specialised: "Specialised cases",
});

const GROUP_HEADINGS = new Map([
  ["## Badge, chip, status, category, and count findings", "badge"],
  ["## Button and action findings", "button"],
  ["## Input and form-control findings", "input"],
  ["## Popup and modal-shell findings", "popup"],
]);

const RECOMMENDATIONS = Object.freeze({
  badge:
    "Use `.app-badge` with the relevant size/case modifiers and exactly one appropriate tone modifier.",
  button:
    "Use the shared `<Button>` or `.app-btn` family with an appropriate variant and size; do not recreate its core visuals inline.",
  input:
    "Use `.app-input` with `--search`, `--select`, or `--textarea` where applicable, or the appropriate purpose-built shared control API.",
  popup:
    "Use `PopupModal`, `.app-modal`, `.app-popup`, `.modal-panel`, `.popup-panel`, or a documented feature shell such as `VHCModalShell`.",
});

const stripMarkdown = (value = "") =>
  value
    .replace(/\*\*/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

function splitTableRow(line) {
  if (!line.startsWith("|")) return [];
  return line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function extractSourceDetails(sourceReference) {
  const references = Array.from(sourceReference.matchAll(/`([^`]+)`/g), (match) => match[1]);
  const sourceFiles = [];
  const lineReferences = [];
  let activeFile = null;

  for (const reference of references) {
    if (/^:\d+(?::\d+)?$/.test(reference) && activeFile) {
      lineReferences.push(`${activeFile}${reference}`);
      continue;
    }

    const match = reference.match(/^(.*?\.(?:js|jsx|ts|tsx|css|scss|sql|md))(?::(\d+)(?::(\d+))?)?$/i);
    if (!match) continue;
    activeFile = match[1];
    if (!sourceFiles.includes(activeFile)) sourceFiles.push(activeFile);
    if (match[2]) {
      lineReferences.push(`${activeFile}:${match[2]}${match[3] ? `:${match[3]}` : ""}`);
    }
  }

  return { sourceFiles, lineReferences };
}

function featureAreaFromRoute(route, subsection) {
  const firstRoute = route.match(/`(\/[^`]+)`/)?.[1];
  if (firstRoute) {
    const segment = firstRoute.split("/").filter(Boolean)[0];
    if (segment) return segment.replace(/-/g, " ");
  }
  if (/developer/i.test(route)) return "developer";
  if (/staff route/i.test(route)) return "global shell";
  if (/invoice/i.test(route)) return "invoices";
  return stripMarkdown(subsection || "Other");
}

function partialAdoptionNote(issueSummary) {
  if (!/partial adoption/i.test(issueSummary)) return null;
  return stripMarkdown(issueSummary);
}

function makeSourceKey(sourceReference) {
  return stripMarkdown(sourceReference).replace(/\s+/g, " ").toLowerCase();
}

function parseSpecialisedCase(lines, warnings) {
  const headingIndex = lines.findIndex((line) => line === "## Specialised case requiring an explicit decision");
  if (headingIndex < 0) {
    warnings.push({ code: "specialised_missing", message: "The specialised VHC camera/HUD decision section was not found." });
    return null;
  }

  const endIndex = lines.findIndex((line, index) => index > headingIndex && line.startsWith("## "));
  const block = lines.slice(headingIndex + 1, endIndex < 0 ? lines.length : endIndex);
  const introduction = block.find((line) => line.trim() && !line.startsWith("- ")) || "";
  const fields = {};
  for (const line of block.filter((entry) => entry.startsWith("- "))) {
    const match = line.match(/^- ([^:]+):\s*(.*)$/);
    if (match) fields[match[1].trim().toLowerCase()] = match[2].trim();
  }

  const required = ["routes", "how to see", "sources", "recommendation"];
  for (const key of required) {
    if (!fields[key]) warnings.push({ code: "specialised_field_missing", auditId: "VHC-HUD-DECISION", message: `Specialised case is missing ${key}.` });
  }
  const sourceReference = fields.sources || "";
  const { sourceFiles, lineReferences } = extractSourceDetails(sourceReference);

  return {
    auditId: "VHC-HUD-DECISION",
    originalAuditId: null,
    type: "Specialised",
    auditGroup: STAFF_STYLE_REVIEW_GROUPS.specialised,
    category: "specialised",
    featureArea: "vhc",
    subsection: "Specialised case requiring an explicit decision",
    route: stripMarkdown(fields.routes || ""),
    sectionName: "VHC full-screen camera/capture HUD status primitives",
    visibilityInstructions: stripMarkdown(fields["how to see"] || ""),
    issueSummary: stripMarkdown(introduction),
    sourceReference,
    sourceFiles,
    lineReferences,
    recommendation: stripMarkdown(fields.recommendation || ""),
    partialAdoption: false,
    partialAdoptionNotes: null,
    specialistExceptionNotes: stripMarkdown(introduction),
    sourceKey: makeSourceKey(sourceReference),
    reviewStatus: "Pending",
    reviewNotes: "",
  };
}

export function parseStaffStyleAudit(markdown = "") {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  const warnings = [];
  const records = [];
  const seenIds = new Set();
  const seenKeys = new Set();
  let category = null;
  let subsection = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (GROUP_HEADINGS.has(line)) {
      category = GROUP_HEADINGS.get(line);
      subsection = "";
      continue;
    }
    if (line.startsWith("## ") && !GROUP_HEADINGS.has(line)) {
      category = null;
      subsection = "";
      continue;
    }
    if (category && line.startsWith("### ")) {
      subsection = stripMarkdown(line.slice(4));
      continue;
    }
    if (!category || !/^\|\s*\d+\s*\|/.test(line)) continue;

    const cells = splitTableRow(line);
    if (cells.length !== 6) {
      warnings.push({ code: "invalid_column_count", line: index + 1, message: `Expected 6 table columns, found ${cells.length}.` });
      continue;
    }

    const originalAuditId = Number.parseInt(cells[0], 10);
    if (!Number.isInteger(originalAuditId) || originalAuditId < 1 || originalAuditId > 128) continue;
    const auditId = String(originalAuditId);
    const sourceReference = cells[5];
    const sourceKey = makeSourceKey(sourceReference);
    const compositeKey = `${auditId}|${sourceKey}`;
    if (seenKeys.has(compositeKey)) {
      warnings.push({ code: "duplicate", auditId, line: index + 1, message: "Duplicate audit ID and source reference." });
      continue;
    }
    seenKeys.add(compositeKey);
    seenIds.add(originalAuditId);

    const { sourceFiles, lineReferences } = extractSourceDetails(sourceReference);
    if (sourceFiles.length === 0) {
      warnings.push({ code: "source_unparsed", auditId, line: index + 1, message: "No source file reference could be parsed." });
    }

    const issueSummary = stripMarkdown(cells[4]);
    records.push({
      auditId,
      originalAuditId,
      type: category === "badge" ? "Badge" : category === "button" ? "Button" : category === "input" ? "Input" : "Popup",
      auditGroup: STAFF_STYLE_REVIEW_GROUPS[category],
      category,
      featureArea: featureAreaFromRoute(cells[1], subsection),
      subsection,
      route: stripMarkdown(cells[1]),
      sectionName: stripMarkdown(cells[2]),
      visibilityInstructions: stripMarkdown(cells[3]),
      issueSummary,
      sourceReference,
      sourceFiles,
      lineReferences,
      recommendation: RECOMMENDATIONS[category],
      partialAdoption: /partial adoption/i.test(issueSummary),
      partialAdoptionNotes: partialAdoptionNote(issueSummary),
      specialistExceptionNotes: null,
      sourceKey,
      reviewStatus: "Pending",
      reviewNotes: "",
    });
  }

  for (let auditId = 1; auditId <= 128; auditId += 1) {
    if (!seenIds.has(auditId)) warnings.push({ code: "missing_id", auditId: String(auditId), message: `Audit ID ${auditId} was not imported.` });
  }

  const specialised = parseSpecialisedCase(lines, warnings);
  if (specialised) records.push(specialised);

  const counts = records.reduce(
    (result, record) => {
      result[record.category] = (result[record.category] || 0) + 1;
      return result;
    },
    { badge: 0, button: 0, input: 0, popup: 0, specialised: 0 }
  );

  if (counts.badge !== 54) warnings.push({ code: "count_mismatch", message: `Expected 54 badge groups, parsed ${counts.badge}.` });
  if (counts.button !== 39) warnings.push({ code: "count_mismatch", message: `Expected 39 button groups, parsed ${counts.button}.` });
  if (counts.input !== 26) warnings.push({ code: "count_mismatch", message: `Expected 26 input groups, parsed ${counts.input}.` });
  if (counts.popup !== 9) warnings.push({ code: "count_mismatch", message: `Expected 9 popup groups, parsed ${counts.popup}.` });
  if (counts.specialised !== 1) warnings.push({ code: "count_mismatch", message: `Expected 1 specialised case, parsed ${counts.specialised}.` });

  return { records, warnings, counts, total: records.length };
}
