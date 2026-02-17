// file location: src/lib/vhc/quoteLines.js
import { parseVhcBuilderPayload, summariseTechnicianVhc } from "@/lib/vhc/summary";
import { normaliseDecisionStatus, resolveSeverityKey } from "@/lib/vhc/summaryStatus";

const WORKFLOW_DISPLAY_STATUSES = new Set(["authorized", "declined", "completed", "pending", "n/a", ""]); // Workflow statuses that are not severity colours.

const isWorkflowDisplayStatus = (value) => { // Identify workflow-only display_status values that must not be used as severity colour.
  const normalized = String(value ?? "").toLowerCase().trim();
  return WORKFLOW_DISPLAY_STATUSES.has(normalized);
};

const normaliseColour = (value) => {
  if (!value) return null;
  const lower = String(value).toLowerCase().trim();
  if (lower === "red" || lower.includes("red")) return "red";
  if (lower === "amber" || lower === "yellow" || lower === "orange" || lower.includes("amber")) return "amber";
  if (lower === "green" || lower === "good" || lower === "pass" || lower.includes("green")) return "green";
  if (lower === "grey" || lower === "gray" || lower === "neutral" || lower.includes("grey")) return "grey";
  return "grey";
};

const normaliseLookupToken = (value) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim(); // Create stable tokens for section/title matching.

const buildSectionTitleKey = (sectionName, issueTitle) => `${normaliseLookupToken(sectionName)}|${normaliseLookupToken(issueTitle)}`; // Build deterministic key for inferred severity lookup.

const resolveDisplaySeverity = (displayStatus) => { // Only allow display_status when it is an actual colour.
  if (isWorkflowDisplayStatus(displayStatus)) return null;
  const normalized = String(displayStatus || "").toLowerCase().trim();
  const candidate = normaliseColour(normalized);
  return candidate === "red" || candidate === "amber" || candidate === "green" ? candidate : null;
};

const buildStableDisplayId = (sectionName, item, index) => {
  const heading = item?.heading || item?.label || item?.name || "";
  const prefix = String(sectionName || "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase();
  const suffix = String(heading || "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase();
  return `${prefix}-${suffix}-${index}`;
};

const resolveCategoryForItem = (sectionName) => {
  const lower = String(sectionName || "").toLowerCase();
  if (lower.includes("wheel") || lower.includes("tyre")) return { id: "wheels_tyres", label: "Wheels & Tyres" };
  if (lower.includes("brake") || lower.includes("hub")) return { id: "brakes_hubs", label: "Brakes & Hubs" };
  if (lower.includes("service") || lower.includes("bonnet") || lower.includes("oil")) return { id: "service_indicator", label: "Service Indicator & Under Bonnet" };
  if (lower.includes("external")) return { id: "external_inspection", label: "External" };
  if (lower.includes("internal") || lower.includes("electrics")) return { id: "internal_electrics", label: "Internal" };
  if (lower.includes("underside")) return { id: "underside", label: "Underside" };
  return { id: "other", label: sectionName || "Other" };
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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
          approvalStatus: normaliseDecisionStatus(check?.approval_status) || "pending",
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
      approvalStatus: normaliseDecisionStatus(check.approval_status) || "pending",
      vhcCheck: check,
      rowId: id,
      slotCode: check?.slot_code ?? null,
      lineKey: check?.line_key ?? null,
    });
  });

  const lines = baseItems.map((item) => {
    const check = item.vhcCheck || {};
    const canonicalId = String(item.canonicalId || item.id);
    const itemId = String(item.id);

    let decisionKey = normaliseDecisionStatus(check.approval_status) || normaliseDecisionStatus(item.approvalStatus) || "pending";
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
