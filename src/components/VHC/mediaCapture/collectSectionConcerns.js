// file location: src/components/VHC/mediaCapture/collectSectionConcerns.js
// Normalises every VHC section's raw concern shape into a single flat
// list that the per-section camera button + concern picker can consume
// without knowing each section's particular data model.
//
// Section shapes seen in the codebase:
//   - Wheels/Tyres: `{ tyres: { NSF: { concerns: [{ text, status }] }, ... } }`
//   - Brakes:       `{ frontPads: { concerns: [{ issue, status }] }, ... }`
//   - Service:      `{ concerns: [{ text, description, status, source }] }`
//   - External/Internal/Underside:
//                   `{ "Wipers/Washers/Horn": { concerns: [{ issue, status }] }, ... }`
//
// Output shape, per concern:
//   {
//     concernId: string,        // Stable id — section/category/index
//     section: string,          // "external" | "brakes" | ...
//     category: string,         // "Wipers/Washers/Horn" / "frontPads" / "NSF" / ""
//     categoryLabel: string,    // Human label for the category
//     label: string,            // Issue text the technician wrote
//     description: string,      // Optional extra line (Service only today)
//     status: "red" | "amber",  // Normalised — green concerns are filtered out
//     index: number,            // Position within the raw concerns array
//   }
//
// Only amber / red concerns are returned. Green (and anything blank)
// is filtered — the camera button is a customer-facing annotation tool
// so "OK" rows aren't interesting.

function normaliseStatus(raw = "") {
  const value = String(raw || "").toLowerCase().trim();
  if (value === "red" || value === "critical" || value === "danger") return "red";
  if (value === "amber" || value === "advisory" || value === "warning") return "amber";
  return ""; // green / n/a / blank → filter out
}

// Pick the first non-empty string from any of the common fields a
// concern might use for its display text.
function pickLabel(concern) {
  const candidates = [concern?.issue, concern?.text, concern?.label, concern?.title];
  for (const candidate of candidates) {
    const trimmed = String(candidate || "").trim();
    if (trimmed) return trimmed;
  }
  return "Untitled concern";
}

function mapKeyedCategories(sectionKey, source, categoryLabelMap = {}) {
  if (!source || typeof source !== "object") return [];
  const rows = [];
  Object.entries(source).forEach(([categoryKey, payload]) => {
    const concerns = Array.isArray(payload?.concerns) ? payload.concerns : [];
    concerns.forEach((concern, index) => {
      const status = normaliseStatus(concern?.status);
      if (status !== "red" && status !== "amber") return;
      rows.push({
        concernId: `${sectionKey}-${categoryKey}-${index}`,
        section: sectionKey,
        category: categoryKey,
        categoryLabel: categoryLabelMap[categoryKey] || categoryKey,
        label: pickLabel(concern),
        description: String(concern?.description || "").trim(),
        status,
        index,
      });
    });
  });
  return rows;
}

// Wheels use an axle key (NSF/OSF/NSR/OSR/Spare) rather than a free
// category name, and their concern field is `text` not `issue`.
function collectWheels(vhcData = {}) {
  const wheels = vhcData?.wheelsTyres || {};
  const labelMap = {
    NSF: "NSF tyre",
    OSF: "OSF tyre",
    NSR: "NSR tyre",
    OSR: "OSR tyre",
    Spare: "Spare tyre",
    spare: "Spare tyre",
  };
  return mapKeyedCategories("wheels", wheels, labelMap);
}

// Brakes store pads / discs / drums as top-level keys on `brakesHubs`.
function collectBrakes(vhcData = {}) {
  const source = vhcData?.brakesHubs;
  if (!source) return [];
  // Old shape was an array of axles; coerce to the flat object shape.
  const flat = Array.isArray(source)
    ? {
      frontPads: source[0]?.pad || source[0]?.pads || {},
      rearPads: source[1]?.pad || source[1]?.pads || {},
      frontDiscs: source[0]?.disc || source[0]?.discs || {},
      rearDiscs: source[1]?.disc || source[1]?.discs || {},
      rearDrums: source[1]?.drum || source[1]?.drums || {},
    }
    : source;
  const labelMap = {
    frontPads: "Front brake pads",
    rearPads: "Rear brake pads",
    frontDiscs: "Front discs",
    rearDiscs: "Rear discs",
    frontDrums: "Front drums",
    rearDrums: "Rear drums",
  };
  return mapKeyedCategories("brakes", flat, labelMap);
}

// Service Indicator stores a flat array — no category at all.
function collectService(vhcData = {}) {
  const concerns = Array.isArray(vhcData?.serviceIndicator?.concerns)
    ? vhcData.serviceIndicator.concerns
    : Array.isArray(vhcData?.service?.concerns)
      ? vhcData.service.concerns
      : [];
  const rows = [];
  concerns.forEach((concern, index) => {
    const status = normaliseStatus(concern?.status);
    if (status !== "red" && status !== "amber") return;
    rows.push({
      concernId: `service-${index}`,
      section: "service",
      category: "",
      categoryLabel: "",
      label: pickLabel(concern),
      description: String(concern?.description || "").trim(),
      status,
      index,
    });
  });
  return rows;
}

// External / Internal / Underside all share the keyed-category shape.
function collectExternal(vhcData = {}) {
  return mapKeyedCategories("external", vhcData?.externalInspection);
}

function collectInternal(vhcData = {}) {
  return mapKeyedCategories("internal", vhcData?.internalElectrics || vhcData?.internalInspection);
}

function collectUnderside(vhcData = {}) {
  return mapKeyedCategories("underside", vhcData?.undersideInspection || vhcData?.underside);
}

// Public helper keyed by section name so each modal can request just
// its own concerns without knowing any of the data-shape details.
export function collectSectionConcerns(sectionKey, vhcData = {}) {
  switch (sectionKey) {
    case "wheels":    return collectWheels(vhcData);
    case "brakes":    return collectBrakes(vhcData);
    case "service":   return collectService(vhcData);
    case "external":  return collectExternal(vhcData);
    case "internal":  return collectInternal(vhcData);
    case "underside": return collectUnderside(vhcData);
    default:          return [];
  }
}

// Convenience: true if at least one amber/red concern exists — used
// by the camera button to decide whether to render as enabled.
export function sectionHasActionableConcern(sectionKey, vhcData = {}) {
  return collectSectionConcerns(sectionKey, vhcData).length > 0;
}
