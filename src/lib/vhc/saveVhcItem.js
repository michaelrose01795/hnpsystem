// file location: src/lib/vhc/saveVhcItem.js
import { supabase } from "@/lib/supabaseClient";
import { summariseTechnicianVhc } from "@/lib/vhc/summary";
import { upsertVhcIssueRow } from "@/lib/vhc/upsertVhcIssueRow";
import { buildStableDisplayId } from "@/lib/vhc/displayId";

const DEFAULT_LABOUR_RATE_GBP = 85;

const collapseWhitespace = (value = "") => String(value || "").trim().replace(/\s+/g, " ");

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSeverity = (value) => {
  const text = collapseWhitespace(value).toLowerCase();
  if (!text) return "amber";
  if (text.includes("red")) return "red";
  if (text.includes("amber") || text.includes("orange") || text.includes("yellow")) return "amber";
  if (text.includes("green") || text.includes("good") || text.includes("pass")) return "green";
  return "grey";
};

const normalizeApprovalStatus = (value) => {
  const text = collapseWhitespace(value).toLowerCase();
  if (!text) return "pending";
  if (text === "authorised" || text === "approved") return "authorized";
  if (["authorized", "declined", "completed", "pending"].includes(text)) return text;
  return "pending";
};

const resolveJobId = async (jobNumber) => {
  const { data: jobRow, error } = await supabase
    .from("jobs")
    .select("id")
    .eq("job_number", String(jobNumber || "").trim())
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve job for VHC save: ${error.message}`);
  }

  if (!jobRow?.id) {
    throw new Error(`Job not found for VHC save: ${jobNumber}`);
  }

  return jobRow.id;
};

export const buildVhcDedupeKey = ({ severity, section, category, details, issue_text, source_bucket } = {}) => {
  return [
    normalizeSeverity(severity),
    collapseWhitespace(section).toLowerCase(),
    collapseWhitespace(category).toLowerCase(),
    collapseWhitespace(issue_text || details).toLowerCase(),
    collapseWhitespace(source_bucket).toLowerCase(),
  ].join("|");
};

const resolveSectionType = (sectionName) => {
  const token = collapseWhitespace(sectionName).toLowerCase();
  if (token.includes("wheel") || token.includes("tyre")) return "wheels";
  if (token.includes("brake") || token.includes("hub")) return "brakes";
  if (token.includes("service") || token.includes("bonnet") || token.includes("oil")) return "service";
  if (token.includes("external")) return "external";
  if (token.includes("internal")) return "internal";
  if (token.includes("underside")) return "underside";
  return "other";
};

const resolveSubAreaForSummaryItem = ({ sectionName, heading, wheelKey }) => {
  if (wheelKey) return String(wheelKey);
  const sectionType = resolveSectionType(sectionName);
  const text = collapseWhitespace(heading).toLowerCase();

  if (sectionType === "brakes") {
    if (text.includes("front pads")) return "frontPads";
    if (text.includes("rear pads")) return "rearPads";
    if (text.includes("front discs")) return "frontDiscs";
    if (text.includes("rear discs")) return "rearDiscs";
    if (text.includes("rear drum")) return "rearDrums";
  }

  if (sectionType === "service") {
    if (text.includes("service reminder -")) return "serviceChoice";
    if (text.startsWith("oil level")) return "oilStatus";
    if (text.includes("service indicator & under bonnet -")) {
      return heading.split("-")[1]?.trim() || heading;
    }
  }

  return heading;
};

const resolveSourceBucket = ({ sectionName, heading, concernSource }) => {
  const sectionType = resolveSectionType(sectionName);
  if (sectionType !== "service") return "";
  if (concernSource) return String(concernSource);
  if (heading.includes("-")) return heading.split("-")[1]?.trim() || "";
  if (heading.toLowerCase().startsWith("oil level")) return "oil";
  if (heading.toLowerCase().includes("service reminder")) return "service";
  return "";
};

export const saveVhcItem = async (payload = {}, context = {}) => {
  const jobNumber = String(payload.job_number || "").trim();
  const resolvedJobId = context.jobId || (jobNumber ? await resolveJobId(jobNumber) : null);

  if (!resolvedJobId) {
    throw new Error("saveVhcItem requires job_number or context.jobId");
  }

  const dedupeKey = payload.dedupe_key || buildVhcDedupeKey(payload);
  const existingRowsByDedupe = context.existingRowsByDedupe || new Map();

  if (existingRowsByDedupe.has(dedupeKey)) {
    return {
      row: existingRowsByDedupe.get(dedupeKey),
      dedupeKey,
      identity: {
        slotCode: existingRowsByDedupe.get(dedupeKey)?.slot_code ?? null,
        lineKey: existingRowsByDedupe.get(dedupeKey)?.line_key ?? null,
      },
    };
  }

  const { row, identity } = await upsertVhcIssueRow({
    supabase,
    jobNumber,
    jobId: resolvedJobId,
    section: payload.section,
    subAreaKey: payload.sub_area_key || payload.category,
    sourceKey: payload.source_key,
    issue_title: payload.category || payload.section || "VHC Item",
    issue_description: payload.details || "",
    issueText: payload.issue_text || payload.details || payload.category || "",
    sourceBucket: payload.source_bucket,
    parts_cost: toNumber(payload.parts_gbp, 0),
    labour_hours: toNumber(payload.labour_hours, 0),
    labour_rate_gbp: toNumber(payload.labour_rate_gbp, DEFAULT_LABOUR_RATE_GBP),
    display_status: null,
    approval_status: normalizeApprovalStatus(payload.status),
    authorization_state: payload.authorization_state ?? null,
    severity: normalizeSeverity(payload.severity),
    display_id: payload.display_id || null,
    measurement: payload.measurement || null,
  });

  existingRowsByDedupe.set(dedupeKey, row);
  return { row, dedupeKey, identity };
};

export const buildNormalizedVhcItems = ({ job_number, vhcData, labour_rate_gbp = DEFAULT_LABOUR_RATE_GBP } = {}) => {
  const sections = summariseTechnicianVhc(vhcData || {}).sections || [];
  const rows = [];
  const seen = new Set();

  sections.forEach((section) => {
    const sectionName = section?.title || section?.name || "Vehicle Health Check";

    (section?.items || []).forEach((item, index) => {
      const heading = collapseWhitespace(item?.heading || sectionName || "VHC Item");
      const concerns = Array.isArray(item?.concerns) ? item.concerns : [];
      const notes = collapseWhitespace(item?.notes || item?.measurement || "");
      const subAreaKey = resolveSubAreaForSummaryItem({ sectionName, heading, wheelKey: item?.wheelKey });
      const displayId = buildStableDisplayId(sectionName, item, index);
      const measurement = Array.isArray(item?.rows) ? item.rows.filter(Boolean).join(" | ") : (item?.measurement || null);

      if (concerns.length > 0) {
        concerns.forEach((concern) => {
          const issueText = collapseWhitespace(concern?.text || notes || heading);
          const payload = {
            job_number,
            severity: concern?.status || item?.status || "Amber",
            section: sectionName,
            category: heading,
            details: issueText,
            issue_text: issueText,
            sub_area_key: subAreaKey,
            source_key: subAreaKey,
            source_bucket: resolveSourceBucket({ sectionName, heading, concernSource: concern?.source }),
            parts_gbp: 0,
            labour_hours: 0,
            labour_rate_gbp,
            status: "pending",
            source: "HEALTH_CHECK_POPUP",
            display_id: displayId,
            measurement,
          };
          payload.dedupe_key = buildVhcDedupeKey(payload);
          if (!seen.has(payload.dedupe_key)) {
            seen.add(payload.dedupe_key);
            rows.push(payload);
          }
        });
        return;
      }

      const issueText = notes || heading;
      const payload = {
        job_number,
        severity: item?.status || "Amber",
        section: sectionName,
        category: heading,
        details: issueText,
        issue_text: issueText,
        sub_area_key: subAreaKey,
        source_key: subAreaKey,
        source_bucket: resolveSourceBucket({ sectionName, heading }),
        parts_gbp: 0,
        labour_hours: 0,
        labour_rate_gbp,
        status: "pending",
        source: "HEALTH_CHECK_POPUP",
        display_id: displayId,
        measurement,
      };
      payload.dedupe_key = buildVhcDedupeKey(payload);
      if (!seen.has(payload.dedupe_key)) {
        seen.add(payload.dedupe_key);
        rows.push(payload);
      }
    });
  });

  return rows;
};

export const syncHealthCheckToCanonicalVhc = async ({ job_number, vhcData, labour_rate_gbp = DEFAULT_LABOUR_RATE_GBP } = {}) => {
  if (!job_number) {
    throw new Error("syncHealthCheckToCanonicalVhc requires job_number");
  }

  const jobId = await resolveJobId(job_number);
  const normalizedRows = buildNormalizedVhcItems({ job_number, vhcData, labour_rate_gbp });
  const existingRowsByDedupe = new Map();
  const savedRows = [];

  for (const rowPayload of normalizedRows) {
    try {
      const saved = await saveVhcItem(rowPayload, { jobId, existingRowsByDedupe });
      if (saved?.row) {
        savedRows.push(saved.row);
      }
    } catch (itemError) {
      console.error(`[syncHealthCheckToCanonicalVhc] Failed to save "${rowPayload.category}":`, itemError.message);
    }
  }

  return {
    success: true,
    jobId,
    count: savedRows.length,
    rows: savedRows,
  };
};
