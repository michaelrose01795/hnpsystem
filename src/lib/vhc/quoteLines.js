// file location: src/lib/vhc/quoteLines.js
import { parseVhcBuilderPayload, summariseTechnicianVhc } from "@/lib/vhc/summary";
import { buildStableDisplayId } from "@/lib/vhc/displayId";
import { normaliseColour, resolveCategoryForItem, toNumber } from "@/lib/vhc/shared";
// Phase 6 follow-up: every VHC normalisation goes through the engine. Local
// resolveDisplaySeverity / isWorkflowDisplayStatus / WORKFLOW_DISPLAY_STATUSES
// were deleted earlier; the summaryStatus.js helpers used here now live inside
// the engine, so callers have one import path.
import {
  resolveVhcItemState,
  DECISION,
  normalizeSeverity,
  normaliseDecisionStatus,
  resolveSeverityKey,
} from "@/features/vhc/vhcStatusEngine";

const resolveColourFromDisplayStatus = (displayStatus) => { // Replaces resolveDisplaySeverity.
  const colour = normalizeSeverity(displayStatus); // null for workflow strings, "red"|"amber"|"green"|"grey" otherwise.
  return colour && colour !== "grey" ? colour : null; // Match legacy: grey is treated as "no override".
};

const normaliseLookupToken = (value) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim(); // Create stable tokens for section/title matching.

const buildSectionTitleKey = (sectionName, issueTitle) => `${normaliseLookupToken(sectionName)}|${normaliseLookupToken(issueTitle)}`; // Build deterministic key for inferred severity lookup.

const resolveDecisionStatus = (check = {}, fallback = null) => { // Delegates to canonical resolver; keeps local signature stable.
  if (check && (check.approval_status || check.approvalStatus || check.authorization_state || check.authorizationState)) {
    return resolveVhcItemState(check).decision; // Use unified resolver.
  }
  return normaliseDecisionStatus(fallback) || DECISION.PENDING; // Fallback path.
};

const buildRowIdLabel = (rowId) => {
  if (rowId === null || rowId === undefined) return "";
  const value = String(rowId).trim();
  if (!value) return "";
  const numeric = Number(value);
  if (Number.isInteger(numeric) && String(numeric) === value) {
    return `#${value}`;
  }
  return `#${value.slice(0, 8)}`;
};

const buildDedupeKey = (line) => {
  const slotCode = Number(line.slot_code ?? line.slotCode);
  const lineKeySource = line.line_key ?? line.lineKey ?? "";
  const lineKey = String(lineKeySource).trim().toLowerCase();
  if (Number.isFinite(slotCode) && lineKey) {
    return `slot:${slotCode}|line:${lineKey}`;
  }
  if (line.canonicalId) {
    return `id:${String(line.canonicalId).toLowerCase().trim()}`;
  }
  const parts = [
    line.severity || "",
    line.sectionName || "",
    line.categoryLabel || "",
    line.label || "",
    line.concernText || "",
    line.notes || "",
    line.measurement || "",
  ]
    .map((value) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim());
  return parts.join("|");
};

// Rank decisions so a collapsed duplicate keeps the row that carries the real
// outcome. A customer decision (authorised / declined / completed) always wins
// over a still-pending mirror of the same concern.
const DECISION_RANK = {
  [DECISION.COMPLETED]: 4,
  [DECISION.AUTHORIZED]: 3,
  [DECISION.DECLINED]: 2,
  [DECISION.PENDING]: 1,
  [DECISION.NA]: 0,
};

// Identity of the *concern itself*, independent of which DB row expresses it.
// Two vhc_checks rows for the same job that share section + heading + description
// + measurement are the same logical item — e.g. a technician-reported row and a
// seed/enrichment row that mirrors it. Distinct concerns under one heading (front
// vs rear wiper blade) keep different descriptions, so they stay separate.
const buildLogicalIdentityKey = (line) => {
  const label = String(line.label || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!label) return null; // Never collapse rows with no heading to key on.
  const parts = [
    line.categoryLabel || line.category?.label || line.sectionName || "",
    label,
    line.concernText || "",
    line.notes || "",
    line.measurement || "",
  ].map((value) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim());
  return parts.join("|");
};

// Collapse rows that describe the same logical concern, keeping the one with the
// strongest decision (then the chargeable / higher-value row). This guarantees a
// single concern can never surface in two Summary buckets at once (e.g. pending
// "Red Repairs" and "Approved" simultaneously) when duplicate DB rows exist.
const collapseLogicalDuplicates = (rows) => {
  const order = [];
  const groups = new Map();
  rows.forEach((line) => {
    const key = buildLogicalIdentityKey(line);
    if (!key) {
      order.push({ single: line });
      return;
    }
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push({ key });
    }
    groups.get(key).push(line);
  });

  const pickWinner = (group) =>
    group.reduce((best, candidate) => {
      const bestRank = DECISION_RANK[best.approvalStatus] ?? 0;
      const candidateRank = DECISION_RANK[candidate.approvalStatus] ?? 0;
      if (candidateRank !== bestRank) return candidateRank > bestRank ? candidate : best;
      const bestChargeable = isChargeable(best);
      const candidateChargeable = isChargeable(candidate);
      if (candidateChargeable !== bestChargeable) return candidateChargeable ? candidate : best;
      const bestTotal = toNumber(best.total_gbp, 0);
      const candidateTotal = toNumber(candidate.total_gbp, 0);
      if (candidateTotal !== bestTotal) return candidateTotal > bestTotal ? candidate : best;
      return best;
    });

  return order.map((slot) => {
    if (slot.single) return slot.single;
    const group = groups.get(slot.key);
    if (group.length === 1) return group[0];
    const winner = pickWinner(group);
    // Never lose a cost: if the winning row has no value but a dropped duplicate
    // did, carry the value across so Summary totals stay accurate.
    if (toNumber(winner.total_gbp, 0) === 0) {
      const valued = group.find((line) => toNumber(line.total_gbp, 0) > 0);
      if (valued) {
        return {
          ...winner,
          parts_gbp: valued.parts_gbp,
          labour_hours: valued.labour_hours,
          labour_rate_gbp: valued.labour_rate_gbp,
          labour_gbp: valued.labour_gbp,
          total_gbp: valued.total_gbp,
          partsCost: valued.parts_gbp,
          labourHours: valued.labour_hours,
          total: valued.total_gbp,
        };
      }
    }
    return winner;
  });
};

const normaliseMatchText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractWheelPositionToken = (value = "") => {
  const text = normaliseMatchText(value);
  if (!text) return "";
  if (/\bnsf\b/.test(text) || text.includes("near side front")) return "nsf";
  if (/\bosf\b/.test(text) || text.includes("off side front")) return "osf";
  if (/\bnsr\b/.test(text) || text.includes("near side rear")) return "nsr";
  if (/\bosr\b/.test(text) || text.includes("off side rear")) return "osr";
  return "";
};

const WHEEL_TOKEN_TO_KEY = { nsf: "NSF", osf: "OSF", nsr: "NSR", osr: "OSR" };

const extractTyreSizeKey = (value = "") => {
  const raw = String(value || "").toUpperCase();
  const match = raw.match(/(\d{3}\s*\/\s*\d{2}\s*R\s*\d{2})/);
  if (!match?.[1]) return "";
  return match[1].replace(/\s+/g, "");
};

const formatTyreTextValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const formatTyreTreadValue = (value) => {
  const text = formatTyreTextValue(value);
  if (!text) return "";
  const numeric = Number.parseFloat(text);
  const formatted = Number.isFinite(numeric)
    ? numeric.toFixed(1).replace(/\.0$/, "")
    : text;
  return formatted.toLowerCase().includes("mm") ? formatted : `${formatted}mm`;
};

const formatTyreTreadMeasurements = (tread = {}) => {
  if (!tread || typeof tread !== "object") return "";
  const segments = [
    ["outer", "Outer"],
    ["middle", "Middle"],
    ["inner", "Inner"],
  ]
    .map(([key, label]) => {
      const value = formatTyreTreadValue(tread?.[key]);
      return value ? `${label} ${value}` : null;
    })
    .filter(Boolean);
  return segments.join(" / ");
};

const normaliseTyreDetailRow = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const TYRE_ROW_SEPARATOR_RE = /\s*(?:\u2022|\u00e2\u20ac\u00a2)\s*/g;

const parseTyreDetailsFromRows = (rows = []) => {
  const detailRows = [];
  let make = "";
  let model = "";
  let size = "";
  let loadSpeed = "";
  let measurement = "";

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const text = normaliseTyreDetailRow(row);
    if (!text) return;
    const makeMatch = text.match(/^make:\s*(.+)$/i);
    if (makeMatch?.[1]) make = makeMatch[1].trim();
    const modelMatch = text.match(/^model:\s*(.+)$/i);
    if (modelMatch?.[1]) model = modelMatch[1].trim();
    const sizeMatch = text.match(/^size:\s*(.+)$/i);
    if (sizeMatch?.[1]) size = sizeMatch[1].trim();
    if (/^load\b/i.test(text) || /^speed\b/i.test(text)) {
      loadSpeed = text.replace(TYRE_ROW_SEPARATOR_RE, " / ").trim();
    }
    const treadMatch = text.match(/^tread:\s*(.+)$/i);
    if (treadMatch?.[1]) {
      measurement = treadMatch[1].replace(TYRE_ROW_SEPARATOR_RE, " / ").trim();
    }
  });

  const sizeParts = [size, loadSpeed].filter(Boolean);
  if (make) detailRows.push(`Make: ${make}`);
  if (model) detailRows.push(`Model: ${model}`);
  if (sizeParts.length > 0) detailRows.push(`Size: ${sizeParts.join(" / ")}`);
  if (measurement) detailRows.push(`Measurements: ${measurement}`);

  return {
    tyreMake: make,
    tyreModel: model,
    tyreSize: sizeParts.join(" / "),
    tyreMeasurement: measurement,
    tyreDetailRows: detailRows,
  };
};

const resolveTyreWheelKey = (item = {}) => {
  const direct = formatTyreTextValue(item?.wheelKey).toLowerCase();
  if (WHEEL_TOKEN_TO_KEY[direct]) return WHEEL_TOKEN_TO_KEY[direct];
  const token = extractWheelPositionToken(
    [
      item?.label,
      item?.heading,
      item?.issue_title,
      item?.name,
      item?.title,
      item?.notes,
      item?.issue_description,
      item?.concernText,
      item?.measurement,
      ...(Array.isArray(item?.rows) ? item.rows : []),
    ].join(" ")
  );
  return WHEEL_TOKEN_TO_KEY[token] || "";
};

const buildTyreDetailPayload = (vhcData = {}, item = {}) => {
  const categoryId = item?.category?.id || item?.categoryId || null;
  if (categoryId !== "wheels_tyres") return null;
  const wheelKey = resolveTyreWheelKey(item);
  const tyre = wheelKey ? vhcData?.wheelsTyres?.[wheelKey] : null;
  const fallback = parseTyreDetailsFromRows(item.rows);
  if (!tyre || typeof tyre !== "object") {
    return wheelKey ? { tyreWheelKey: wheelKey, ...fallback } : null;
  }

  const make = formatTyreTextValue(tyre.manufacturer || tyre.make || tyre.brand);
  const model = formatTyreTextValue(tyre.model || tyre.pattern || tyre.tyreModel || tyre.productModel || tyre.range);
  const size = formatTyreTextValue(tyre.size);
  const load = formatTyreTextValue(tyre.load);
  const speed = formatTyreTextValue(tyre.speed);
  const sizeParts = [size, load ? `Load ${load}` : "", speed ? `Speed ${speed}` : ""].filter(Boolean);
  const treadMeasurements = formatTyreTreadMeasurements(tyre.tread);

  const rows = [];
  if (make) rows.push(`Make: ${make}`);
  if (model) rows.push(`Model: ${model}`);
  if (sizeParts.length > 0) rows.push(`Size: ${sizeParts.join(" / ")}`);
  if (treadMeasurements) rows.push(`Measurements: ${treadMeasurements}`);
  if (typeof tyre.runFlat === "boolean") rows.push(`Run Flat: ${tyre.runFlat ? "Yes" : "No"}`);

  return {
    tyreWheelKey: wheelKey,
    tyreMake: make || fallback.tyreMake,
    tyreModel: model || fallback.tyreModel,
    tyreSize: sizeParts.join(" / ") || fallback.tyreSize,
    tyreMeasurement: treadMeasurements || fallback.tyreMeasurement,
    tyreDetailRows: rows.length > 0 ? rows : fallback.tyreDetailRows,
  };
};

const stripMetaSuffix = (value = "") => {
  const text = String(value || "");
  const markerIndex = text.indexOf("VHC_META:");
  if (markerIndex === -1) return text.trim();
  return text.slice(0, markerIndex).trim();
};

const BRAKE_TEXT_RE = /\b(brake|pad|pads|disc|discs|drum|drums|hub|hubs|caliper|servo)\b/i;
const EXTERNAL_TEXT_RE = /\b(number\s*plate|plate\s*lamp|wiper|washer|horn|front\s*light|rear\s*light|headlight|tail\s*light|indicator|fog\s*light|door|trim|clutch|transmission)\b/i;

const inferSectionNameForCheck = (sectionName, check = {}) => {
  const baseSection = sectionName || "Other";
  const category = resolveCategoryForItem(baseSection);
  if (category.id !== "brakes_hubs") return baseSection;

  const checkText = [
    check.issue_title,
    check.issue_description,
    check.customer_description,
    check.note_text,
  ].join(" ");
  if (EXTERNAL_TEXT_RE.test(checkText) && !BRAKE_TEXT_RE.test(checkText)) {
    return "External";
  }

  return baseSection;
};

const shouldDetachBrakeMeasurementFromCheck = (sectionName, check = {}) => {
  const measurement = String(check.measurement || "").trim();
  if (!measurement) return false;
  const category = resolveCategoryForItem(sectionName);
  if (category.id !== "brakes_hubs") return false;
  const checkText = [
    check.issue_title,
    check.issue_description,
    check.customer_description,
    check.note_text,
  ].join(" ");
  return !BRAKE_TEXT_RE.test(checkText);
};

const isChargeable = (line) => {
  const parts = toNumber(line.parts_gbp, 0);
  const labourHours = toNumber(line.labour_hours, 0);
  const labour = toNumber(line.labour_gbp, 0);
  const total = toNumber(line.total_gbp, 0);
  return parts > 0 || labourHours > 0 || labour > 0 || total > 0;
};

export const buildVhcQuoteLinesModel = ({
  job = null,
  sections = null,
  vhcChecksData = [],
  partsJobItems = [],
  vhcIdAliases = {},
  authorizedViewRows = [],
  labourRate = 85,
  mode = "withPlaceholders",
} = {}) => {
  let fallbackChecksheet = null;
  if (job?.checksheet) {
    if (typeof job.checksheet === "string") {
      try {
        fallbackChecksheet = JSON.parse(job.checksheet);
      } catch (_err) {
        fallbackChecksheet = null;
      }
    } else if (typeof job.checksheet === "object") {
      fallbackChecksheet = job.checksheet;
    }
  }
  const parsedFromDb = parseVhcBuilderPayload(vhcChecksData || []);
  const vhcData = parsedFromDb || fallbackChecksheet || {};
  const derivedSections = Array.isArray(sections) ? sections : (summariseTechnicianVhc(vhcData || {}).sections || []);
  const inferredSeverityMap = new Map();

  derivedSections.forEach((section) => {
    const sectionName = section?.name || section?.title || "Vehicle Health Check";
    (section?.items || []).forEach((item) => {
      const heading = item?.heading || item?.label || item?.issue_title || item?.name || item?.title || sectionName;
      const inferred = normaliseColour(item?.status || item?.colour || section?.colour || section?.status);
      if (!inferred || inferred === "grey") return;
      const key = buildSectionTitleKey(sectionName, heading);
      if (!inferredSeverityMap.has(key)) {
        inferredSeverityMap.set(key, inferred);
      }
    });
  });

  const checksMap = new Map();
  const checksBySectionTitle = new Map();
  (vhcChecksData || []).forEach((check) => {
    if (!check?.vhc_id) return;
    checksMap.set(String(check.vhc_id), check);
    if (check.section === "VHC_CHECKSHEET") return;
    const rawSectionName = check.section || "Other";
    const inferredSectionName = inferSectionNameForCheck(rawSectionName, check);
    const titleKeys = new Set([
      buildSectionTitleKey(rawSectionName, check.issue_title || ""),
      buildSectionTitleKey(inferredSectionName, check.issue_title || ""),
    ]);
    titleKeys.forEach((titleKey) => {
      if (!checksBySectionTitle.has(titleKey)) {
        checksBySectionTitle.set(titleKey, []);
      }
      checksBySectionTitle.get(titleKey).push(check);
    });
  });
  Object.entries(vhcIdAliases || {}).forEach(([displayId, canonicalId]) => {
    const check = checksMap.get(String(canonicalId));
    if (check && !checksMap.has(String(displayId))) {
      checksMap.set(String(displayId), check);
    }
  });

  const authorizedViewIds = new Set(
    (authorizedViewRows || [])
      .map((row) => (row?.vhc_item_id ? String(row.vhc_item_id) : null))
      .filter(Boolean)
  );

  const labourHoursMap = new Map();
  (vhcChecksData || []).forEach((check) => {
    if (!check?.vhc_id) return;
    const hours = toNumber(check.labour_hours, 0);
    if (hours > 0) labourHoursMap.set(String(check.vhc_id), hours);
  });
  (partsJobItems || []).forEach((part) => {
    if (!part?.vhc_item_id) return;
    const hours = toNumber(part.labour_hours, 0);
    if (hours <= 0) return;
    const key = String(part.vhc_item_id);
    const current = labourHoursMap.get(key) || 0;
    labourHoursMap.set(key, Math.max(current, hours));
  });

  const partsCostMap = new Map();
  (partsJobItems || []).forEach((part) => {
    if (!part?.vhc_item_id) return;
    const key = String(part.vhc_item_id);
    const qty = toNumber(part.quantity_requested, 1) || 1;
    const unitPrice = toNumber(part.unit_price ?? part?.part?.unit_price, 0);
    partsCostMap.set(key, (partsCostMap.get(key) || 0) + qty * unitPrice);
  });

  const baseItems = [];
  const processedIds = new Set();

  if (mode !== "quotedOnly") {
    derivedSections.forEach((section) => {
      const sectionName = section?.name || section?.title || "Vehicle Health Check";
      (section?.items || []).forEach((item, index) => {
        const severity = normaliseColour(item?.status || item?.colour || section?.colour || section?.status);
        if (!severity) return;

        const legacyId = `${sectionName}-${index}`;
        const heading = item?.heading || item?.label || item?.issue_title || item?.name || item?.title || sectionName;
        const titleKey = buildSectionTitleKey(sectionName, heading);
        const titleMatches = checksBySectionTitle.get(titleKey) || [];

        // When DB already has multiple rows for the same section/title (e.g. multiple concerns),
        // don't emit a synthetic placeholder row; rely on concrete vhc_checks rows below.
        const hasExplicitIdLink = Boolean(item?.vhc_id || vhcIdAliases?.[legacyId]);
        if (!hasExplicitIdLink && titleMatches.length > 1) {
          return;
        }

        const provisionalId = item?.vhc_id ? String(item.vhc_id) : vhcIdAliases?.[legacyId] ? legacyId : buildStableDisplayId(sectionName, item, index);
        const provisionalCanonicalId = String(vhcIdAliases?.[String(provisionalId)] || String(provisionalId));
        const matchedByTitle = !hasExplicitIdLink && titleMatches.length === 1 ? titleMatches[0] : null;
        const check = checksMap.get(provisionalCanonicalId) || checksMap.get(String(provisionalId)) || matchedByTitle || null;
        const id = check?.vhc_id ? String(check.vhc_id) : String(provisionalId);
        const canonicalId = String(vhcIdAliases?.[String(id)] || check?.vhc_id || String(id));

        const category = resolveCategoryForItem(sectionName);
        const concerns = Array.isArray(item?.concerns) ? item.concerns : [];
        const primaryConcern = concerns.find((c) => normaliseColour(c?.status) === severity) || concerns[0] || null;

        // Customer override on the linked vhc_check row replaces the technician's
        // description in every customer-facing surface (Summary, customer
        // preview, share/customer link, view/copy/send flows).
        const customerOverride = (check?.customer_description || "").trim();
        baseItems.push({
          id: String(id),
          canonicalId,
          sectionName,
          category,
          categoryLabel: category.label,
          label: heading || "Recorded item",
          notes: customerOverride || item?.notes || item?.issue_description || "",
          concernText: customerOverride || primaryConcern?.text || "",
          customerDescription: customerOverride || "",
          measurement: item?.measurement || "",
          rows: Array.isArray(item?.rows) ? item.rows : [],
          rawSeverity: severity,
          severityKey: severity,
          approvalStatus: resolveDecisionStatus(check),
          vhcCheck: check || null,
          rowId: check?.vhc_id ? String(check.vhc_id) : null,
          slotCode: check?.slot_code ?? null,
          lineKey: check?.line_key ?? null,
          ...buildTyreDetailPayload(vhcData, { ...item, category, label: heading }),
        });

        processedIds.add(String(id));
        processedIds.add(canonicalId);
      });
    });
  }

  (vhcChecksData || []).forEach((check) => {
    if (!check?.vhc_id) return;
    const id = String(check.vhc_id);
    if (processedIds.has(id)) return;
    if (check.section === "VHC_CHECKSHEET") return;

    const severityFromColumn = normaliseColour(check.severity);
    const severityFromDisplay = resolveColourFromDisplayStatus(check.display_status);
    const inferredSeverity = inferredSeverityMap.get(buildSectionTitleKey(check.section || "Other", check.issue_title || ""));
    const severity = severityFromColumn || severityFromDisplay || inferredSeverity || "grey";

    const rawSectionName = check.section || "Other";
    const sectionName = inferSectionNameForCheck(rawSectionName, check);
    const category = resolveCategoryForItem(sectionName);
    const detachMeasurement = shouldDetachBrakeMeasurementFromCheck(rawSectionName, check);

    const customerOverride = (check?.customer_description || "").trim();
    baseItems.push({
      id,
      canonicalId: id,
      sectionName,
      category,
      categoryLabel: category.label,
      label: check.issue_title || sectionName || "Recorded item",
      notes: customerOverride || check.issue_description || "",
      concernText: customerOverride || "",
      customerDescription: customerOverride || "",
      measurement: detachMeasurement ? "" : check.measurement || "",
      rows: [],
      rawSeverity: severity,
      severityKey: severity,
      approvalStatus: resolveDecisionStatus(check),
      vhcCheck: check,
      rowId: id,
      slotCode: check?.slot_code ?? null,
      lineKey: check?.line_key ?? null,
      ...buildTyreDetailPayload(vhcData, {
        ...check,
        category,
        label: check.issue_title || sectionName || "Recorded item",
        notes: customerOverride || check.issue_description || "",
        concernText: customerOverride || "",
      }),
    });
  });

  // Legacy fallback: infer VHC row for historical parts with null vhc_item_id so Summary totals stay accurate.
  const searchableRows = baseItems.map((item) => {
    const canonicalId = String(item.canonicalId || item.id);
    const haystack = normaliseMatchText(
      [
        item?.measurement,
        item?.label,
        item?.notes,
        item?.concernText,
        item?.sectionName,
        item?.categoryLabel,
        ...(Array.isArray(item?.rows) ? item.rows : []),
      ]
        .filter(Boolean)
        .join(" ")
    );
    return { canonicalId, haystack };
  });

  const legacyTieAllocationCount = new Map();
  const wheelTokenRank = { nsf: 0, osf: 1, nsr: 2, osr: 3 };

  const resolveLegacyPartVhcId = (part) => {
    const partPositionToken = extractWheelPositionToken(
      [
        part?.part?.name,
        part?.part_name_snapshot,
        part?.row_description,
        part?.request_notes,
        part?.requestNotes,
      ]
        .filter(Boolean)
        .join(" ")
    );
    const partTyreSizeKey = extractTyreSizeKey(
      [
        part?.part?.name,
        part?.part_name_snapshot,
        part?.part?.description,
        part?.row_description,
        part?.request_notes,
        part?.requestNotes,
      ]
        .filter(Boolean)
        .join(" ")
    );

    const hints = [
      part?.row_description,
      part?.part?.name,
      part?.part_name_snapshot,
      part?.part?.description,
      part?.part?.part_number,
      part?.part_number_snapshot,
      stripMetaSuffix(part?.request_notes || part?.requestNotes || ""),
    ]
      .map((value) => normaliseMatchText(value))
      .filter((value) => value && value.length >= 4);

    if (hints.length === 0) return null;

    const ranked = searchableRows
      .map((row) => {
        let score = 0;
        const rowPositionToken = extractWheelPositionToken(row.haystack);
        const rowTyreSizeKey = extractTyreSizeKey(row.haystack);

        if (partPositionToken && rowPositionToken) {
          score += partPositionToken === rowPositionToken ? 60 : -35;
        }
        if (partTyreSizeKey && rowTyreSizeKey) {
          score += partTyreSizeKey === rowTyreSizeKey ? 24 : -12;
        }

        hints.forEach((hint) => {
          if (row.haystack.includes(hint)) {
            score += Math.min(50, hint.length * 3);
            return;
          }
          const tokens = hint.split(" ").filter((token) => token.length >= 4);
          const tokenHits = tokens.filter((token) => row.haystack.includes(token)).length;
          score += tokenHits * 4;
        });
        return { row, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) return null;
    if (ranked.length === 1) return ranked[0].row.canonicalId;
    if (ranked[0].score > ranked[1].score) return ranked[0].row.canonicalId;

    const topScore = ranked[0].score;
    const tied = ranked.filter((entry) => entry.score === topScore);
    if (tied.length === 0) return null;

    const tyreContextText = normaliseMatchText(
      [
        part?.part?.name,
        part?.part_name_snapshot,
        part?.part?.description,
        part?.part?.part_number,
        part?.part_number_snapshot,
        part?.row_description,
        stripMetaSuffix(part?.request_notes || part?.requestNotes || ""),
      ]
        .filter(Boolean)
        .join(" ")
    );
    const isTyreContext = Boolean(partTyreSizeKey) || /\b(tyre|tire|wheel)\b/.test(tyreContextText);
    if (!isTyreContext) return null;

    const sizeMatchedPool = tied.filter((entry) => {
      if (!partTyreSizeKey) return true;
      const rowTyreSizeKey = extractTyreSizeKey(entry.row.haystack);
      return Boolean(rowTyreSizeKey) && rowTyreSizeKey === partTyreSizeKey;
    });
    const pool = (sizeMatchedPool.length > 0 ? sizeMatchedPool : tied).sort((a, b) => {
      const aToken = extractWheelPositionToken(a.row.haystack);
      const bToken = extractWheelPositionToken(b.row.haystack);
      const aRank = Object.prototype.hasOwnProperty.call(wheelTokenRank, aToken) ? wheelTokenRank[aToken] : 99;
      const bRank = Object.prototype.hasOwnProperty.call(wheelTokenRank, bToken) ? wheelTokenRank[bToken] : 99;
      if (aRank !== bRank) return aRank - bRank;
      return a.row.canonicalId.localeCompare(b.row.canonicalId);
    });
    if (pool.length === 0) return null;

    const allocationSignature = normaliseMatchText(
      [
        partTyreSizeKey,
        part?.part?.part_number,
        part?.part_number_snapshot,
        part?.part?.name,
        part?.part_name_snapshot,
      ]
        .filter(Boolean)
        .join(" ")
    );
    const signatureKey = allocationSignature || "legacy-tyre";
    const currentIndex = legacyTieAllocationCount.get(signatureKey) || 0;
    legacyTieAllocationCount.set(signatureKey, currentIndex + 1);
    return pool[currentIndex % pool.length].row.canonicalId;
  };

  (partsJobItems || []).forEach((part) => {
    const linkedId = part?.vhc_item_id;
    if (linkedId !== null && linkedId !== undefined && String(linkedId).trim() !== "") return;
    const origin = String(part?.origin || "").toLowerCase();
    if (!origin.includes("vhc")) return;
    const inferredCanonicalId = resolveLegacyPartVhcId(part);
    if (!inferredCanonicalId) return;
    const qty = toNumber(part.quantity_requested, 1) || 1;
    const unitPrice = toNumber(part.unit_price ?? part?.part?.unit_price, 0);
    partsCostMap.set(
      String(inferredCanonicalId),
      (partsCostMap.get(String(inferredCanonicalId)) || 0) + qty * unitPrice
    );
  });

  const lines = baseItems.map((item) => {
    const check = item.vhcCheck || {};
    const canonicalId = String(item.canonicalId || item.id);
    const itemId = String(item.id);

    let decisionKey = resolveDecisionStatus(check, item.approvalStatus);
    if (decisionKey === "authorized" || decisionKey === "completed") {
      if (authorizedViewIds.size > 0 && !authorizedViewIds.has(canonicalId) && !authorizedViewIds.has(itemId)) {
        decisionKey = "pending";
      }
    }

    const severityFromColumn = normaliseColour(check.severity);
    const severityFromDisplay = resolveColourFromDisplayStatus(check.display_status);
    const severity = severityFromColumn || severityFromDisplay || item.severityKey || item.rawSeverity || "grey";
    const parts = partsCostMap.get(itemId) ?? partsCostMap.get(canonicalId) ?? toNumber(check.parts_cost, 0);
    const labourHours = labourHoursMap.get(itemId) ?? labourHoursMap.get(canonicalId) ?? toNumber(check.labour_hours, 0);
    const totalOverride = toNumber(check.total_override, 0);
    const labour = labourHours * labourRate;
    const total = totalOverride > 0 ? totalOverride : parts + labour;

    return {
      ...item,
      id: itemId,
      rowId: item.rowId || canonicalId || itemId,
      rowIdLabel: buildRowIdLabel(item.rowId || canonicalId || itemId),
      slot_code: item.slotCode ?? check.slot_code ?? null,
      line_key: item.lineKey ?? check.line_key ?? null,
      approvalStatus: decisionKey,
      severity,
      parts_gbp: parts,
      labour_hours: labourHours,
      labour_rate_gbp: labourRate,
      labour_gbp: labour,
      total_gbp: total,
      // Legacy aliases retained for existing renderers that still read old keys.
      categoryId: item.category?.id || null,
      partsCost: parts,
      labourHours,
      total,
      partsComplete: Boolean(check.parts_complete),
      labourComplete: Boolean(check.labour_complete),
      displayStatus: check.display_status || null,
      severityKey: resolveSeverityKey(severity, check.display_status),
    };
  });

  const modeFiltered = mode === "quotedOnly" ? lines.filter(isChargeable) : lines;

  const dedupedMap = new Map();
  modeFiltered.forEach((line) => {
    const key = buildDedupeKey(line);
    const current = dedupedMap.get(key);
    if (!current) {
      dedupedMap.set(key, line);
      return;
    }
    const currentChargeable = isChargeable(current);
    const nextChargeable = isChargeable(line);
    if (nextChargeable && !currentChargeable) {
      dedupedMap.set(key, line);
      return;
    }
    if (nextChargeable === currentChargeable && toNumber(line.total_gbp, 0) > toNumber(current.total_gbp, 0)) {
      dedupedMap.set(key, line);
    }
  });

  // Second pass: collapse duplicate DB rows that describe the same logical concern
  // (e.g. a technician row plus a seed/enrichment mirror) so one item can never
  // render in two Summary buckets at once. Keeps the decided row over a pending one.
  const deduped = collapseLogicalDuplicates(Array.from(dedupedMap.values()));

  if (mode === "quotedOnly" && process.env.NODE_ENV !== "production") {
    const preFilterCount = lines.length;
    const postFilterCount = modeFiltered.length;
    const severityCounter = { red: 0, amber: 0, green: 0, grey: 0, other: 0 };
    modeFiltered.forEach((line) => {
      const severity = normaliseColour(line.severity);
      if (severity === "red") severityCounter.red += 1;
      else if (severity === "amber") severityCounter.amber += 1;
      else if (severity === "green") severityCounter.green += 1;
      else if (severity === "grey") severityCounter.grey += 1;
      else severityCounter.other += 1;
    });
    console.log("[VHC quotedOnly] counts", { preFilterCount, postFilterCount, severityCounter });
  }

  // Phase 3 of the VHC refactor: every line's approvalStatus and severity have
  // already been normalised through the engine upstream (resolveDecisionStatus
  // and normaliseColour). We use DECISION constants here so the bucketing keys
  // are guaranteed in lockstep with the engine vocabulary.
  const severityLists = { red: [], amber: [], green: [], other: [], authorized: [], completed: [], declined: [] };
  deduped.forEach((line) => {
    if (line.approvalStatus === DECISION.COMPLETED) {
      severityLists.completed.push(line);
      return;
    }
    if (line.approvalStatus === DECISION.AUTHORIZED) {
      severityLists.authorized.push(line);
      return;
    }
    if (line.approvalStatus === DECISION.DECLINED) {
      severityLists.declined.push(line);
      return;
    }
    if (line.severity === "red") {
      severityLists.red.push(line);
      return;
    }
    if (line.severity === "amber") {
      severityLists.amber.push(line);
      return;
    }
    if (line.severity === "green") {
      severityLists.green.push(line);
      return;
    }
    severityLists.other.push(line);
  });

  const sum = (rows) => rows.reduce((acc, row) => acc + toNumber(row.total_gbp, 0), 0);
  const totals = {
    red: sum([
      ...severityLists.red,
      ...severityLists.authorized.filter((r) => r.severity === "red"),
      ...severityLists.completed.filter((r) => r.severity === "red"),
      ...severityLists.declined.filter((r) => r.severity === "red"),
    ]),
    amber: sum([
      ...severityLists.amber,
      ...severityLists.authorized.filter((r) => r.severity === "amber"),
      ...severityLists.completed.filter((r) => r.severity === "amber"),
      ...severityLists.declined.filter((r) => r.severity === "amber"),
    ]),
    green: sum(severityLists.green),
    authorized: sum(severityLists.authorized),
    completed: sum(severityLists.completed),
    declined: sum(severityLists.declined),
  };

  return {
    items: deduped,
    severityLists,
    totals,
    labourRate,
  };
};
