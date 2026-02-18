// file location: src/lib/vhc/upsertVhcIssueRow.js
import { supabase as sharedSupabase } from "@/lib/supabaseClient"; // Reuse the shared client used by existing VHC flows.
import { getSlotCode, makeLineKey, resolveLineType } from "@/lib/vhc/slotIdentity"; // Central slot and line identity helpers.

const DEFAULT_LABOUR_RATE_GBP = 85; // Customer-facing labour rate used by VHC quote lines.

const toNumber = (value, fallback = 0) => { // Coerce unknown input into a finite numeric value.
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const collapseWhitespace = (value = "") => String(value || "").trim().replace(/\s+/g, " "); // Normalize display text for stable writes.

const normalizeSeverity = (value) => { // Normalize severity labels to canonical lowercase values.
  const text = collapseWhitespace(value).toLowerCase();
  if (!text) return "amber";
  if (text.includes("red")) return "red";
  if (text.includes("amber") || text.includes("yellow") || text.includes("orange")) return "amber";
  if (text.includes("green") || text.includes("good") || text.includes("pass")) return "green";
  return "grey";
};

const normalizeDecisionStatus = (value) => { // Normalize status/authorization values to db-compatible approval_status values.
  const text = collapseWhitespace(value).toLowerCase();
  if (!text) return "pending";
  if (text === "authorised" || text === "approved") return "authorized";
  if (["authorized", "declined", "completed", "pending"].includes(text)) return text;
  return "pending";
};

const normalizeSourceBucket = (value = "") => { // Keep source labels stable for service concern line keys.
  const text = collapseWhitespace(value);
  if (!text) return "";
  return text;
};

const resolveJobIdFromNumber = async ({ supabase, jobNumber }) => { // Resolve UI job number (e.g., 00055) to jobs.id for DB relations.
  const normalizedJobNumber = collapseWhitespace(jobNumber);
  if (!normalizedJobNumber) {
    throw new Error("Unable to resolve job_id: jobNumber is required when jobId is not provided");
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("id")
    .eq("job_number", normalizedJobNumber)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve job_id for job number ${normalizedJobNumber}: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(`Job not found for job number ${normalizedJobNumber}`);
  }

  return data.id;
};

const buildDisplayStatus = ({ approvalStatus, severity, displayStatus }) => { // Derive display_status consistent with customer-preview behavior.
  if (displayStatus) return String(displayStatus).toLowerCase();
  if (approvalStatus === "authorized" || approvalStatus === "declined" || approvalStatus === "completed") {
    return approvalStatus;
  }
  return severity;
};

const buildLegacyMatchQuery = ({ supabase, jobId, section, issueTitle, issueText }) => { // Fallback path when slot columns are absent in DB.
  return supabase
    .from("vhc_checks")
    .select("vhc_id")
    .eq("job_id", jobId)
    .eq("section", section)
    .eq("issue_title", issueTitle)
    .eq("issue_description", issueText)
    .order("vhc_id", { ascending: false })
    .limit(1)
    .maybeSingle();
};

export const upsertVhcIssueRow = async ({
  supabase,
  jobNumber,
  jobId,
  section,
  subAreaKey,
  sourceKey,
  issue_title,
  issue_description,
  issueText,
  sourceBucket,
  parts_cost,
  labour_hours,
  labour_rate_gbp,
  display_status,
  approval_status,
  authorization_state,
  severity,
  display_id,
} = {}) => {
  const client = supabase || sharedSupabase; // Use injected client in tests/callers, fallback to shared client in app code.
  const resolvedJobId = Number.isInteger(Number(jobId)) ? Number(jobId) : await resolveJobIdFromNumber({ supabase: client, jobNumber });
  const now = new Date().toISOString();

  const normalizedSection = collapseWhitespace(section || "Vehicle Health Check");
  const normalizedTitle = collapseWhitespace(issue_title || subAreaKey || sourceKey || "VHC Item");
  const normalizedIssueText = collapseWhitespace(issueText || issue_description || "");
  const normalizedSeverity = normalizeSeverity(severity || display_status || approval_status);
  const normalizedApprovalStatus = normalizeDecisionStatus(approval_status || authorization_state);
  const normalizedSourceBucket = normalizeSourceBucket(sourceBucket || sourceKey || "");

  const slotCode = getSlotCode({
    section: normalizedSection,
    subAreaKey: subAreaKey || normalizedTitle,
    sourceKey: sourceKey || normalizedSourceBucket,
    issueTitle: normalizedTitle,
    issueDescription: normalizedIssueText,
  });

  const lineType = resolveLineType({
    slotCode,
    section: normalizedSection,
    sourceBucket: normalizedSourceBucket,
  });

  const lineKey = makeLineKey({
    type: lineType,
    issueText: normalizedIssueText || normalizedTitle,
    extra: { source: normalizedSourceBucket },
  });

  const hours = toNumber(labour_hours, 0);
  const rate = toNumber(labour_rate_gbp, DEFAULT_LABOUR_RATE_GBP);
  const parts = toNumber(parts_cost, 0);
  const labourTotal = hours * rate;
  const totalOverride = parts + labourTotal > 0 ? parts + labourTotal : null;

  const upsertPayload = {
    job_id: resolvedJobId,
    section: normalizedSection,
    issue_title: normalizedTitle,
    issue_description: normalizedIssueText,
    parts_cost: parts,
    labour_hours: hours,
    total_override: totalOverride,
    display_status: buildDisplayStatus({ approvalStatus: normalizedApprovalStatus, severity: normalizedSeverity, displayStatus: display_status }),
    approval_status: normalizedApprovalStatus,
    authorization_state: authorization_state ?? null,
    severity: normalizedSeverity,
    slot_code: slotCode,
    line_key: lineKey,
    display_id: display_id || null,
    updated_at: now,
  };

  try {
    const { data, error } = await client
      .from("vhc_checks")
      .upsert(upsertPayload, { onConflict: "job_id,slot_code,line_key" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return {
      row: data,
      identity: {
        jobId: resolvedJobId,
        slotCode,
        lineKey,
        lineType,
      },
    };
  } catch (error) {
    // DB-NOTES: this repo does not currently include a safe Supabase migrations folder/pattern.
    // If slot_code/line_key columns or partial unique index are not present yet, fallback to legacy matching to avoid runtime failures.
    const message = String(error?.message || "").toLowerCase();
    const looksLikeMissingIdentityColumns =
      message.includes("slot_code") ||
      message.includes("line_key") ||
      message.includes("on conflict") ||
      message.includes("constraint") ||
      message.includes("index");

    if (!looksLikeMissingIdentityColumns) {
      throw new Error(`Failed to upsert VHC issue row: ${error.message || error}`);
    }

    let existingRow = null;
    let existingError = null;

    // If identity columns exist but the unique onConflict target is missing, still match by identity first.
    if (slotCode !== null && slotCode !== undefined && lineKey) {
      try {
        const { data: identityRow, error: identityError } = await client
          .from("vhc_checks")
          .select("vhc_id")
          .eq("job_id", resolvedJobId)
          .eq("slot_code", slotCode)
          .eq("line_key", lineKey)
          .order("vhc_id", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!identityError && identityRow?.vhc_id) {
          existingRow = identityRow;
        } else if (identityError) {
          existingError = identityError;
        }
      } catch (identityLookupError) {
        existingError = identityLookupError;
      }
    }

    if (!existingRow) {
      const legacyResult = await buildLegacyMatchQuery({
        supabase: client,
        jobId: resolvedJobId,
        section: normalizedSection,
        issueTitle: normalizedTitle,
        issueText: normalizedIssueText,
      });
      existingRow = legacyResult?.data || null;
      existingError = existingError || legacyResult?.error || null;
    }

    if (existingError && existingError.code !== "PGRST116") {
      throw new Error(`Failed legacy VHC row lookup: ${existingError.message}`);
    }

    if (existingRow?.vhc_id) {
      const { data, error: updateError } = await client
        .from("vhc_checks")
        .update(upsertPayload)
        .eq("vhc_id", existingRow.vhc_id)
        .select("*")
        .single();

      if (updateError) {
        throw new Error(`Failed legacy VHC row update: ${updateError.message}`);
      }

      return {
        row: data,
        identity: {
          jobId: resolvedJobId,
          slotCode,
          lineKey,
          lineType,
        },
      };
    }

    const { data, error: insertError } = await client
      .from("vhc_checks")
      .insert([{ ...upsertPayload, created_at: now }])
      .select("*")
      .single();

    if (insertError) {
      throw new Error(`Failed legacy VHC row insert: ${insertError.message}`);
    }

    return {
      row: data,
      identity: {
        jobId: resolvedJobId,
        slotCode,
        lineKey,
        lineType,
      },
    };
  }
};
