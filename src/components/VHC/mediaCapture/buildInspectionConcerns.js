// file location: src/components/VHC/mediaCapture/buildInspectionConcerns.js
// Pure helper: turn a job's vhcData into a flat list of tyre/brake rows
// that the full-screen customer video panel can render.
//
// Row visibility rules (per latest refinement):
//   - Tyres:  show green + amber + red rows
//   - Brakes: show green + amber + red rows
//   - Other sections (if ever added here): amber + red only
//
// Measurement rules (preserved):
//   - Disc rows ONLY appear when a real measurement is present.
//     Visual-only disc entries are always skipped.
//   - The same measured-only gating applies to drums.

// List of tyre wheel keys the VHC data uses for the four road wheels.
const WHEEL_KEYS = ["NSF", "OSF", "NSR", "OSR"];

// Label prefix for each wheel position (technician-friendly short form).
const WHEEL_LABELS = {
  NSF: "NSF tyre", // Near-side front
  OSF: "OSF tyre", // Off-side front
  NSR: "NSR tyre", // Near-side rear
  OSR: "OSR tyre", // Off-side rear
};

// Normalise a status string (from concerns) into one of red/amber/green/na.
function normaliseStatus(raw = "") {
  const value = String(raw || "").toLowerCase().trim(); // Safely lowercase status
  if (!value) return ""; // Empty status: return empty
  if (value === "red" || value === "critical" || value === "danger") return "red"; // Map danger aliases
  if (value === "amber" || value === "advisory" || value === "warning") return "amber"; // Map warning aliases
  if (value === "green" || value === "good" || value === "ok") return "green"; // Map ok aliases
  if (value === "n/a" || value === "na" || value === "not_applicable") return "na"; // Map not-applicable
  return value; // Pass through any other status (grey, etc.)
}

// Severity order for picking the "worst" concern: red > amber > green > null.
const SEVERITY_RANK = { red: 3, amber: 2, green: 1 }; // Higher number = more severe

// Return the worst concern status across a list (red/amber/green or null).
// Used when we want to include green rows too (tyres + brakes).
function worstConcernStatus(concerns = []) {
  let best = null; // Current worst
  let bestRank = 0; // Rank of current worst
  for (const concern of concerns) { // Iterate each concern
    const status = normaliseStatus(concern?.status); // Normalise
    const rank = SEVERITY_RANK[status] || 0; // Lookup rank
    if (rank > bestRank) { // Found a more severe one
      best = status; // Remember it
      bestRank = rank; // And its rank
      if (rank === 3) return "red"; // Short-circuit on red (can't get worse)
    }
  }
  return best; // Worst found (or null if no red/amber/green concerns)
}

// Parse the lowest tread reading from a tyre's `tread: { outer, middle, inner }`.
// Returns a finite number (mm) or null when no reading is present.
function lowestTreadReading(tread = {}) {
  const candidates = ["outer", "middle", "inner"] // Check all three positions
    .map((key) => parseFloat(tread?.[key])) // Convert each value to a number
    .filter((value) => Number.isFinite(value)); // Keep only real numbers
  if (candidates.length === 0) return null; // No readings at all
  return Math.min(...candidates); // Return the worst reading
}

// Human-readable short text for a tyre row, e.g. "3 mm" or "3.2 mm".
function formatDepth(value) {
  if (!Number.isFinite(value)) return ""; // Guard invalid numbers
  return Number.isInteger(value) ? `${value} mm` : `${value.toFixed(1)} mm`; // Pretty-print
}

// Derive the displayed status for a tyre row.
// Priority: worst concern > depth threshold > green.
function deriveTyreStatus(worstConcern, depth) {
  if (worstConcern === "red") return "red"; // Red concern always wins
  if (Number.isFinite(depth) && depth <= 2.5) return "red"; // Very thin tread → red
  if (worstConcern === "amber") return "amber"; // Amber concern next
  if (Number.isFinite(depth) && depth <= 3.5) return "amber"; // Thin tread → amber
  if (worstConcern === "green") return "green"; // Green concern preserved
  return "green"; // Everything else with data treated as green
}

// Build the tyre rows (4 wheels + optional spare).
function buildTyreRows(vhcData = {}) {
  const wheelsTyres = vhcData?.wheelsTyres || {}; // Main tyre container
  const rows = []; // Collect rows here

  WHEEL_KEYS.forEach((key) => { // Iterate the four road wheels
    const wheel = wheelsTyres?.[key] || {}; // Get the wheel data safely
    const concerns = Array.isArray(wheel.concerns) ? wheel.concerns : []; // Pull concern list
    const worst = worstConcernStatus(concerns); // Find worst concern status
    const depth = lowestTreadReading(wheel.tread || {}); // Find worst tread depth
    const hasData = worst || Number.isFinite(depth); // Either signal qualifies
    if (!hasData) return; // Skip wheels with nothing recorded

    const status = deriveTyreStatus(worst, depth); // Status for the row
    const depthLabel = formatDepth(depth); // Format depth for display
    rows.push({ // Push the normalised row
      id: `tyre-${key}`, // Stable ID for React keys
      kind: "tyre", // Row type
      section: key, // Wheel position (NSF/OSF/etc.)
      label: WHEEL_LABELS[key], // Short left-panel label
      measurement: depthLabel, // e.g. "3 mm"
      status, // Colour status
      widget: { // Data the floating widget will render
        title: WHEEL_LABELS[key], // Widget title (matches the label)
        value: depthLabel || (status === "green" ? "OK" : "Advisory"), // Big value line
        status, // Same colour as row
      },
    });
  });

  // Handle the spare — structure supports multiple types; only include tyre-bearing types.
  const spare = wheelsTyres?.Spare || wheelsTyres?.spare; // Support either case
  if (spare && typeof spare === "object") { // Only process when present
    const concerns = Array.isArray(spare.concerns) ? spare.concerns : []; // Spare concerns
    const worst = worstConcernStatus(concerns); // Severity check
    const details = spare?.details || {}; // Spare details (only set for real tyre types)
    const depth = lowestTreadReading(details.tread || {}); // Spare tread depth
    const hasData = worst || Number.isFinite(depth); // Any data at all?
    const hasTyre = spare.type === "spare" || spare.type === undefined; // Only real spares carry tread
    if (hasData && hasTyre) { // Skip non-tyre spares (repair_kit, boot_full, etc.)
      const status = deriveTyreStatus(worst, depth); // Status
      const depthLabel = formatDepth(depth); // Depth string
      rows.push({ // Append spare row
        id: "tyre-spare", // Stable ID
        kind: "tyre", // Same widget type as road tyres
        section: "Spare", // Label for section
        label: "Spare tyre", // Left-panel label
        measurement: depthLabel, // Tread mm or empty
        status, // Colour
        widget: { // Widget payload
          title: "Spare tyre", // Title
          value: depthLabel || (status === "green" ? "OK" : "Advisory"), // Value
          status, // Colour
        },
      });
    }
  }

  return rows; // Tyre rows ready
}

// Derive the displayed status for a brake pad row.
// Thresholds mirror BrakeDiagram: <=2mm → red, <4mm → amber, else green.
// Any concern severity bumps the status accordingly.
function derivePadStatus(worstConcern, numeric) {
  if (worstConcern === "red") return "red"; // Red concern wins
  if (Number.isFinite(numeric) && numeric <= 2) return "red"; // Very thin pad → red
  if (worstConcern === "amber") return "amber"; // Amber concern next
  if (Number.isFinite(numeric) && numeric < 4) return "amber"; // Thin pad → amber
  return "green"; // Everything else with data is green
}

// Compute the pad row visibility + status. Includes green rows.
function padRowStatus(padSection = {}) {
  const measurement = String(padSection?.measurement ?? "").trim(); // Get measurement text
  const numeric = parseFloat(measurement); // Convert to number
  const concerns = Array.isArray(padSection?.concerns) ? padSection.concerns : []; // Concern list
  const explicit = normaliseStatus(padSection?.status); // Any explicit status set
  const hasMeasurement = Number.isFinite(numeric); // Real number?
  const hasConcerns = concerns.length > 0; // Any concerns recorded?
  const hasExplicit = explicit === "red" || explicit === "amber" || explicit === "green"; // Valid status?
  const shouldShow = hasMeasurement || hasConcerns || hasExplicit; // Any signal present
  if (!shouldShow) return { shouldShow: false, status: null, measurement, numeric }; // Nothing to display

  const worst = worstConcernStatus(concerns); // Worst concern (red/amber/green/null)
  const derived = derivePadStatus(worst, numeric); // Combine concern + measurement
  // Explicit green shouldn't downgrade an amber/red derived from measurement.
  const status = derived === "green" && hasExplicit ? explicit : derived; // Allow explicit green/amber/red
  return { shouldShow: true, status, measurement, numeric }; // Final verdict
}

// Compute the disc row visibility + status. Measurement-only rule preserved.
function discRowStatus(discSection = {}) {
  const measurements = discSection?.measurements || {}; // Measurement sub-object
  const values = Array.isArray(measurements.values) ? measurements.values : []; // Array of readings
  const numericValues = values // Convert readings to numbers
    .map((value) => parseFloat(String(value || "").trim())) // Trim and parse each
    .filter((value) => Number.isFinite(value)); // Drop blanks/invalid

  if (numericValues.length === 0) { // No real measurement → do not show row
    return { shouldShow: false, status: null, measurement: "", numeric: null }; // Caller will skip
  }

  const worstReading = Math.min(...numericValues); // Worst (thinnest) disc reading
  const measurement = Number.isInteger(worstReading) // Format nicely
    ? `${worstReading} mm` // Integer rendering
    : `${worstReading.toFixed(1)} mm`; // Decimal rendering

  const concerns = Array.isArray(discSection.concerns) ? discSection.concerns : []; // Disc concerns
  const worst = worstConcernStatus(concerns); // Concern severity (red/amber/green/null)
  const explicit = normaliseStatus(measurements.status); // Explicit disc status

  // Disc thresholds aren't universal — defer to concern or explicit status,
  // falling back to green when neither suggests an issue.
  let status; // Final colour
  if (worst === "red" || explicit === "red") status = "red"; // Red wins
  else if (worst === "amber" || explicit === "amber") status = "amber"; // Then amber
  else status = "green"; // Otherwise green (since a measurement is present)
  return { shouldShow: true, status, measurement, numeric: worstReading }; // Verdict
}

// Compute the drum row visibility + status. Measurement-only rule preserved.
function drumRowStatus(drumSection = {}) {
  const measurement = String(drumSection?.measurement ?? "").trim(); // Optional lining measurement
  const numeric = parseFloat(measurement); // Parse to number
  const hasMeasurement = Number.isFinite(numeric); // True if a number was recorded
  if (!hasMeasurement) return { shouldShow: false, status: null, measurement: "", numeric: null }; // Skip visual-only drums

  const concerns = Array.isArray(drumSection?.concerns) ? drumSection.concerns : []; // Drum concerns
  const worst = worstConcernStatus(concerns); // Concern severity (red/amber/green/null)
  const explicit = normaliseStatus(drumSection?.status); // Explicit status

  let status; // Final colour
  if (worst === "red" || explicit === "red" || numeric <= 2) status = "red"; // Thin lining or red concern
  else if (worst === "amber" || explicit === "amber" || numeric < 4) status = "amber"; // Thin or amber concern
  else status = "green"; // Otherwise green

  return { shouldShow: true, status, measurement, numeric }; // Verdict
}

// Build brake rows from either the newer flat `brakesHubs` object
// (frontPads/rearPads/frontDiscs/rearDiscs/rearDrums) or the older
// per-axle array shape. Both shapes are read defensively.
function buildBrakeRows(vhcData = {}) {
  const source = vhcData?.brakesHubs; // Raw brakes container
  const rows = []; // Collect rows

  // Coalesce the two shapes into a single lookup with unified keys.
  const unified = Array.isArray(source) // Old shape was an array of axles
    ? { // Map to new-style keys for uniform access
        frontPads: source[0]?.pad || source[0]?.pads || {},
        rearPads: source[1]?.pad || source[1]?.pads || {},
        frontDiscs: source[0]?.disc || source[0]?.discs || {},
        rearDiscs: source[1]?.disc || source[1]?.discs || {},
        frontDrums: source[0]?.drum || source[0]?.drums || null,
        rearDrums: source[1]?.drum || source[1]?.drums || null,
      }
    : source || {}; // Already the flat shape

  // Front pads ------------------------------------------------------
  const frontPad = padRowStatus(unified.frontPads); // Evaluate front pads
  if (frontPad.shouldShow) { // Include green/amber/red
    const valueLabel = frontPad.measurement ? `${frontPad.measurement} mm` : ""; // With unit
    rows.push({
      id: "brake-frontPads", // Stable ID
      kind: "brake", // Widget kind
      section: "frontPads", // Section key
      label: "Front brake pads", // Human label
      measurement: valueLabel, // Display string
      status: frontPad.status, // Colour
      widget: { title: "Front brake pads", value: valueLabel || (frontPad.status === "green" ? "OK" : "Advisory"), status: frontPad.status },
    });
  }

  // Rear pads -------------------------------------------------------
  const rearPad = padRowStatus(unified.rearPads); // Evaluate rear pads
  if (rearPad.shouldShow) { // Include green/amber/red
    const valueLabel = rearPad.measurement ? `${rearPad.measurement} mm` : ""; // With unit
    rows.push({
      id: "brake-rearPads",
      kind: "brake",
      section: "rearPads",
      label: "Rear brake pads",
      measurement: valueLabel,
      status: rearPad.status,
      widget: { title: "Rear brake pads", value: valueLabel || (rearPad.status === "green" ? "OK" : "Advisory"), status: rearPad.status },
    });
  }

  // Front discs (only when a measurement is actually present) --------
  const frontDisc = discRowStatus(unified.frontDiscs); // Evaluate discs
  if (frontDisc.shouldShow) { // Skip visual-only
    rows.push({
      id: "brake-frontDiscs",
      kind: "brake",
      section: "frontDiscs",
      label: "Front discs",
      measurement: frontDisc.measurement, // Already includes mm
      status: frontDisc.status,
      widget: { title: "Front discs", value: frontDisc.measurement, status: frontDisc.status },
    });
  }

  // Rear discs (only when a measurement is actually present) ---------
  const rearDisc = discRowStatus(unified.rearDiscs); // Evaluate discs
  if (rearDisc.shouldShow) { // Skip visual-only
    rows.push({
      id: "brake-rearDiscs",
      kind: "brake",
      section: "rearDiscs",
      label: "Rear discs",
      measurement: rearDisc.measurement, // Already includes mm
      status: rearDisc.status,
      widget: { title: "Rear discs", value: rearDisc.measurement, status: rearDisc.status },
    });
  }

  // Front drums (rare but supported) --------------------------------
  const frontDrum = drumRowStatus(unified.frontDrums || {}); // Evaluate drums
  if (frontDrum.shouldShow) { // Only include when measurement present
    const valueLabel = frontDrum.measurement ? `${frontDrum.measurement} mm` : ""; // With unit
    rows.push({
      id: "brake-frontDrums",
      kind: "brake",
      section: "frontDrums",
      label: "Front drums",
      measurement: valueLabel,
      status: frontDrum.status,
      widget: { title: "Front drums", value: valueLabel || (frontDrum.status === "green" ? "OK" : "Advisory"), status: frontDrum.status },
    });
  }

  // Rear drums ------------------------------------------------------
  const rearDrum = drumRowStatus(unified.rearDrums || {}); // Evaluate drums
  if (rearDrum.shouldShow) { // Only include when measurement present
    const valueLabel = rearDrum.measurement ? `${rearDrum.measurement} mm` : ""; // With unit
    rows.push({
      id: "brake-rearDrums",
      kind: "brake",
      section: "rearDrums",
      label: "Rear drums",
      measurement: valueLabel,
      status: rearDrum.status,
      widget: { title: "Rear drums", value: valueLabel || (rearDrum.status === "green" ? "OK" : "Advisory"), status: rearDrum.status },
    });
  }

  return rows; // Finished brake rows
}

// Build external inspection rows from `vhcData.externalInspection`.
// Per the rule in the file header, external items are amber + red only
// (green items are noise for the capture panel). The raw shape is an
// object keyed by category name, each with a `concerns: []` array where
// entries look like `{ issue: string, status: "Red" | "Amber" | "Green" }`.
function buildExternalRows(vhcData = {}) {
  const source = vhcData?.externalInspection; // Raw container
  if (!source || typeof source !== "object") return []; // Nothing to show

  const rows = []; // Collected rows

  // The source can legitimately be either the normalised object shape
  // or the older array-of-concerns shape. Handle both defensively.
  const entries = Array.isArray(source)
    ? [["Miscellaneous", { concerns: source }]] // Flat list → bucket under Miscellaneous
    : Object.entries(source); // Keyed by category

  entries.forEach(([category, payload]) => {
    const concerns = Array.isArray(payload?.concerns) ? payload.concerns : []; // Safely pull concerns
    concerns.forEach((concern, index) => {
      const status = normaliseStatus(concern?.status); // Normalise colour
      if (status !== "red" && status !== "amber") return; // External = amber + red only
      const issue = String(concern?.issue || "").trim(); // Issue text
      if (!issue) return; // Skip empty rows
      rows.push({
        id: `external-${category}-${index}`, // Stable ID per category/index
        kind: "external", // Row type — matched by the widget recorder fallback
        section: category, // Keep the category for internal grouping
        label: issue, // Issue text appears as the main label
        measurement: "", // No category pill — the issue text is the whole row
        status, // Colour
        widget: {
          title: "", // No category header on the floating widget
          value: issue, // The issue text stands alone — the colour conveys severity
          status, // Same colour
        },
      });
    });
  });

  return rows; // External rows ready
}

// Main entry: returns { tyres, brakes, external } given the job's vhcData.
// Tyres and brakes include green + amber + red rows. Discs/drums are
// measurement-only. External items are amber + red only — a green
// external entry is rarely interesting during a customer video.
export function buildInspectionConcerns(vhcData = {}) {
  return { // Composite result
    tyres: buildTyreRows(vhcData), // Tyre row list (green + amber + red)
    brakes: buildBrakeRows(vhcData), // Brake row list (green + amber + red, discs/drums measurement-only)
    external: buildExternalRows(vhcData), // External concerns (amber + red only)
  };
}

// Small helper exposed for any consumer that needs to enforce the
// "other sections: amber + red only" rule on their own list of rows.
export function filterAmberRedOnly(rows = []) {
  return rows.filter((row) => row?.status === "amber" || row?.status === "red"); // Drop green/null
}

// Re-export small utilities for unit testing if ever needed.
export const __internals = { normaliseStatus, worstConcernStatus, padRowStatus, discRowStatus, drumRowStatus, deriveTyreStatus, derivePadStatus };
