// file location: src/lib/vhc/quoteLines.js
import { parseVhcBuilderPayload, summariseTechnicianVhc } from "@/lib/vhc/summary";
import { normaliseDecisionStatus, resolveSeverityKey } from "@/lib/vhc/summaryStatus";
import { buildStableDisplayId } from "@/lib/vhc/displayId";
import { normaliseColour, resolveCategoryForItem, toNumber } from "@/lib/vhc/shared";

const WORKFLOW_DISPLAY_STATUSES = new Set(["authorized", "declined", "completed", "pending", "n/a", ""]); // Workflow statuses that are not severity colours.

const isWorkflowDisplayStatus = (value) => { // Identify workflow-only display_status values that must not be used as severity colour.
  const normalized = String(value ?? "").toLowerCase().trim();
  return WORKFLOW_DISPLAY_STATUSES.has(normalized);
};

const normaliseLookupToken = (value) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim(); // Create stable tokens for section/title matching.

const buildSectionTitleKey = (sectionName, issueTitle) => `${normaliseLookupToken(sectionName)}|${normaliseLookupToken(issueTitle)}`; // Build deterministic key for inferred severity lookup.

const resolveDisplaySeverity = (displayStatus) => { // Only allow display_status when it is an actual colour.
  if (isWorkflowDisplayStatus(displayStatus)) return null;
  const normalized = String(displayStatus || "").toLowerCase().trim();
  const candidate = normaliseColour(normalized);
  return candidate === "red" || candidate === "amber" || candidate === "green" ? candidate : null;
};

const resolveDecisionStatus = (check = {}, fallback = null) => {
  const authState = normaliseDecisionStatus(check?.authorization_state);
  const approval = normaliseDecisionStatus(check?.approval_status);
  // Prefer explicit approval_status when auth_state is only the legacy "n/a" placeholder.
  if (authState === "n/a" && approval && approval !== "n/a") return approval;
  if (authState) return authState;
  if (approval) return approval;
  return normaliseDecisionStatus(fallback) || "pending";
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

const extractTyreSizeKey = (value = "") => {
  const raw = String(value || "").toUpperCase();
  const match = raw.match(/(\d{3}\s*\/\s*\d{2}\s*R\s*\d{2})/);
  if (!match?.[1]) return "";
  return match[1].replace(/\s+/g, "");
};

const stripMetaSuffix = (value = "") => {
  const text = String(value || "");
  const markerIndex = text.indexOf("VHC_META:");
  if (markerIndex === -1) return text.trim();
  return text.slice(0, markerIndex).trim();
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
    const titleKey = buildSectionTitleKey(check.section || "Other", check.issue_title || "");
    if (!checksBySectionTitle.has(titleKey)) {
      checksBySectionTitle.set(titleKey, []);
    }
    checksBySectionTitle.get(titleKey).push(check);
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

        baseItems.push({
          id: String(id),
          canonicalId,
          sectionName,
          category,
          categoryLabel: category.label,
          label: heading || "Recorded item",
          notes: item?.notes || item?.issue_description || "",
          concernText: primaryConcern?.text || "",
          measurement: item?.measurement || "",
          rows: Array.isArray(item?.rows) ? item.rows : [],
          rawSeverity: severity,
          severityKey: severity,
          approvalStatus: resolveDecisionStatus(check),
          vhcCheck: check || null,
          rowId: check?.vhc_id ? String(check.vhc_id) : null,
          slotCode: check?.slot_code ?? null,
          lineKey: check?.line_key ?? null,
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
    const severityFromDisplay = resolveDisplaySeverity(check.display_status);
    const inferredSeverity = inferredSeverityMap.get(buildSectionTitleKey(check.section || "Other", check.issue_title || ""));
    const severity = severityFromColumn || severityFromDisplay || inferredSeverity || "grey";

    const sectionName = check.section || "Other";
    const category = resolveCategoryForItem(sectionName);

    baseItems.push({
      id,
      canonicalId: id,
      sectionName,
      category,
      categoryLabel: category.label,
      label: check.issue_title || sectionName || "Recorded item",
      notes: check.issue_description || "",
      concernText: "",
      measurement: check.measurement || "",
      rows: [],
      rawSeverity: severity,
      severityKey: severity,
      approvalStatus: resolveDecisionStatus(check),
      vhcCheck: check,
      rowId: id,
      slotCode: check?.slot_code ?? null,
      lineKey: check?.line_key ?? null,
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
    const severityFromDisplay = resolveDisplaySeverity(check.display_status);
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

  const deduped = Array.from(dedupedMap.values());

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

  const severityLists = { red: [], amber: [], green: [], other: [], authorized: [], declined: [] };
  deduped.forEach((line) => {
    if (line.approvalStatus === "authorized" || line.approvalStatus === "completed") {
      severityLists.authorized.push(line);
      return;
    }
    if (line.approvalStatus === "declined") {
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
    red: sum([...severityLists.red, ...severityLists.authorized.filter((r) => r.severity === "red"), ...severityLists.declined.filter((r) => r.severity === "red")]),
    amber: sum([...severityLists.amber, ...severityLists.authorized.filter((r) => r.severity === "amber"), ...severityLists.declined.filter((r) => r.severity === "amber")]),
    green: sum(severityLists.green),
    authorized: sum(severityLists.authorized),
    declined: sum(severityLists.declined),
  };

  return {
    items: deduped,
    severityLists,
    totals,
    labourRate,
  };
};
