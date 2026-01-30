// Helper to keep VHC-linked parts, requests, and write-up data in sync.
import { supabase } from "@/lib/supabaseClient";

const REQUEST_SOURCE = "vhc_authorised";
const APPROVAL_AUTHORIZED = "authorized";
const APPROVAL_DECLINED = "declined";

const resolveCanonicalVhcId = async ({ jobId, rawVhcId }) => {
  if (rawVhcId === null || rawVhcId === undefined) return null;

  const displayId = String(rawVhcId).trim();
  if (!displayId) return null;

  const { data: aliasRow, error: aliasError } = await supabase
    .from("vhc_item_aliases")
    .select("vhc_item_id")
    .eq("job_id", jobId)
    .eq("display_id", displayId)
    .maybeSingle();

  if (aliasError) {
    throw new Error(`Failed to resolve VHC alias for display id ${displayId}: ${aliasError.message}`);
  }

  if (aliasRow?.vhc_item_id) return aliasRow.vhc_item_id;

  const parsed = Number(displayId);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  return null;
};

const pickLatestByUpdatedAt = (rows) => {
  let latest = null;
  for (const row of rows || []) {
    if (!row?.updated_at) continue;
    if (!latest) {
      latest = row;
      continue;
    }
    if (new Date(row.updated_at) > new Date(latest.updated_at)) {
      latest = row;
    }
  }
  return latest;
};

const normaliseApprovalStatus = (value) => {
  if (value === null || value === undefined) return null;
  const normalised = String(value).trim().toLowerCase();
  if (!normalised) return null;
  if (normalised === "authorised" || normalised === "approved") return "authorized";
  return normalised;
};

export const syncVhcPartsAuthorisation = async ({ jobId, vhcItemId, approvalStatus }) => {
  if (!jobId || vhcItemId === null || vhcItemId === undefined) return;

  const canonicalVhcId = await resolveCanonicalVhcId({ jobId, rawVhcId: vhcItemId });
  if (!canonicalVhcId) return;

  const { data: partRows, error: partsError } = await supabase
    .from("parts_job_items")
    .select("id, authorised, pre_pick_location, updated_at")
    .eq("job_id", jobId)
    .eq("vhc_item_id", canonicalVhcId);

  if (partsError) {
    throw new Error(`Failed to load VHC-linked parts for sync: ${partsError.message}`);
  }

  const authorisedParts = (partRows || []).filter((part) => part.authorised === true);
  const hasAuthorisedParts = authorisedParts.length > 0;
  const normalizedApproval = normaliseApprovalStatus(approvalStatus);
  const hasSummaryApproval =
    normalizedApproval === APPROVAL_AUTHORIZED || normalizedApproval === "completed";
  const isPendingReset = normalizedApproval === "pending";
  const nextApprovalStatus = isPendingReset
    ? "pending"
    : hasAuthorisedParts || hasSummaryApproval
    ? APPROVAL_AUTHORIZED
    : normalizedApproval === APPROVAL_DECLINED
    ? APPROVAL_DECLINED
    : APPROVAL_DECLINED;
  const isAuthorised = nextApprovalStatus === APPROVAL_AUTHORIZED || nextApprovalStatus === "completed";
  const now = new Date().toISOString();

  const vhcUpdatePayload = {
    approval_status: nextApprovalStatus,
    updated_at: now,
  };

  if (nextApprovalStatus === APPROVAL_AUTHORIZED || nextApprovalStatus === APPROVAL_DECLINED) {
    vhcUpdatePayload.display_status = nextApprovalStatus;
    vhcUpdatePayload.approved_at = now;
  } else if (isPendingReset) {
    vhcUpdatePayload.approved_at = null;
    vhcUpdatePayload.approved_by = null;
  }

  const { data: vhcUpdateRows, error: vhcUpdateError } = await supabase
    .from("vhc_checks")
    .update(vhcUpdatePayload)
    .eq("vhc_id", canonicalVhcId)
    .select("job_id, vhc_id, issue_title, issue_description, section");

  if (vhcUpdateError) {
    throw new Error(`Failed to sync vhc_checks approval status: ${vhcUpdateError.message}`);
  }

  let vhcRow = Array.isArray(vhcUpdateRows) ? vhcUpdateRows[0] : null;
  if (!vhcRow) {
    const { data: vhcFetch, error: vhcFetchError } = await supabase
      .from("vhc_checks")
      .select("job_id, vhc_id, issue_title, issue_description, section")
      .eq("vhc_id", canonicalVhcId)
      .maybeSingle();

    if (vhcFetchError) {
      throw new Error(`Failed to load VHC item ${canonicalVhcId}: ${vhcFetchError.message}`);
    }
    vhcRow = vhcFetch || null;
  }

  const resolvedJobId = vhcRow?.job_id ?? jobId;
  if (!resolvedJobId) return;

  const description =
    (vhcRow?.issue_title || vhcRow?.issue_description || vhcRow?.section || "")
      .toString()
      .trim() || `Authorised item ${canonicalVhcId}`;

  if (isAuthorised) {
    const latestPrePick = pickLatestByUpdatedAt(
      authorisedParts.filter((part) =>
        part.pre_pick_location && String(part.pre_pick_location).trim()
      )
    );

    const latestAuthorisedPart = latestPrePick || pickLatestByUpdatedAt(authorisedParts);

    const latestPrePickLocation = latestPrePick?.pre_pick_location || null;
    const partsJobItemId = latestAuthorisedPart?.id || null;

    const { data: noteRows, error: notesError } = await supabase
      .from("job_notes")
      .select("note_text, updated_at")
      .eq("job_id", resolvedJobId)
      .or(`linked_vhc_id.eq.${canonicalVhcId},linked_vhc_ids.cs.{${canonicalVhcId}}`)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (notesError) {
      throw new Error(`Failed to load VHC-linked notes: ${notesError.message}`);
    }

    const noteText = noteRows?.[0]?.note_text || null;

    const { data: requestRows, error: requestError } = await supabase
      .from("job_requests")
      .select("request_id")
      .eq("job_id", resolvedJobId)
      .eq("request_source", REQUEST_SOURCE)
      .eq("vhc_item_id", canonicalVhcId);

    if (requestError) {
      throw new Error(`Failed to load job_requests for VHC item: ${requestError.message}`);
    }

    const primaryRequestId = requestRows?.[0]?.request_id || null;
    if (requestRows && requestRows.length > 1) {
      const duplicateIds = requestRows.slice(1).map((row) => row.request_id);
      await supabase.from("job_requests").delete().in("request_id", duplicateIds);
    }

    const requestPayload = {
      job_id: resolvedJobId,
      description,
      hours: null,
      job_type: "Customer",
      sort_order: 0,
      status: "inprogress",
      request_source: REQUEST_SOURCE,
      vhc_item_id: canonicalVhcId,
      parts_job_item_id: partsJobItemId,
      pre_pick_location: latestPrePickLocation,
      note_text: noteText,
      updated_at: now,
    };

    if (primaryRequestId) {
      const { error: requestUpdateError } = await supabase
        .from("job_requests")
        .update(requestPayload)
        .eq("request_id", primaryRequestId);

      if (requestUpdateError) {
        throw new Error(`Failed to update job_requests row: ${requestUpdateError.message}`);
      }
    } else {
      const { error: requestInsertError } = await supabase
        .from("job_requests")
        .insert([{ ...requestPayload, created_at: now }]);

      if (requestInsertError) {
        throw new Error(`Failed to insert job_requests row: ${requestInsertError.message}`);
      }
    }

    const { data: jobRow, error: jobError } = await supabase
      .from("jobs")
      .select("job_number")
      .eq("id", resolvedJobId)
      .maybeSingle();

    if (jobError) {
      throw new Error(`Failed to load job number for rectification sync: ${jobError.message}`);
    }

    const { data: writeupRow, error: writeupError } = await supabase
      .from("job_writeups")
      .select("writeup_id")
      .eq("job_id", resolvedJobId)
      .maybeSingle();

    if (writeupError) {
      throw new Error(`Failed to load writeup for rectification sync: ${writeupError.message}`);
    }

    const { data: rectificationRows, error: rectificationError } = await supabase
      .from("writeup_rectification_items")
      .select("id")
      .eq("job_id", resolvedJobId)
      .eq("vhc_item_id", canonicalVhcId);

    if (rectificationError) {
      throw new Error(`Failed to load rectification rows: ${rectificationError.message}`);
    }

    const rectificationId = rectificationRows?.[0]?.id || null;
    if (rectificationRows && rectificationRows.length > 1) {
      const duplicateIds = rectificationRows.slice(1).map((row) => row.id);
      await supabase
        .from("writeup_rectification_items")
        .delete()
        .in("id", duplicateIds);
    }

    const rectificationPayload = {
      job_id: resolvedJobId,
      job_number: jobRow?.job_number || null,
      writeup_id: writeupRow?.writeup_id ?? null,
      description,
      status: "waiting",
      is_additional_work: true,
      vhc_item_id: canonicalVhcId,
      authorization_id: null,
      authorized_amount: null,
      updated_at: now,
    };

    if (rectificationId) {
      const { error: rectificationUpdateError } = await supabase
        .from("writeup_rectification_items")
        .update(rectificationPayload)
        .eq("id", rectificationId);

      if (rectificationUpdateError) {
        throw new Error(
          `Failed to update writeup rectification row: ${rectificationUpdateError.message}`
        );
      }
    } else {
      const { error: rectificationInsertError } = await supabase
        .from("writeup_rectification_items")
        .insert([{ ...rectificationPayload, created_at: now }]);

      if (rectificationInsertError) {
        throw new Error(
          `Failed to insert writeup rectification row: ${rectificationInsertError.message}`
        );
      }
    }
  } else {
    const { error: requestDeleteError } = await supabase
      .from("job_requests")
      .delete()
      .eq("job_id", resolvedJobId)
      .eq("request_source", REQUEST_SOURCE)
      .eq("vhc_item_id", canonicalVhcId);

    if (requestDeleteError) {
      throw new Error(`Failed to delete job_requests rows: ${requestDeleteError.message}`);
    }

    const { error: prePickClearError } = await supabase
      .from("parts_job_items")
      .update({ pre_pick_location: null, updated_at: now })
      .eq("job_id", resolvedJobId)
      .eq("vhc_item_id", canonicalVhcId);

    if (prePickClearError) {
      throw new Error(`Failed to clear pre-pick location: ${prePickClearError.message}`);
    }

    const { error: rectificationDeleteError } = await supabase
      .from("writeup_rectification_items")
      .delete()
      .eq("job_id", resolvedJobId)
      .eq("vhc_item_id", canonicalVhcId);

    if (rectificationDeleteError) {
      throw new Error(`Failed to delete rectification rows: ${rectificationDeleteError.message}`);
    }

    const { data: notesToUpdate, error: notesError } = await supabase
      .from("job_notes")
      .select("note_id, linked_vhc_id, linked_vhc_ids")
      .eq("job_id", resolvedJobId)
      .or(`linked_vhc_id.eq.${canonicalVhcId},linked_vhc_ids.cs.{${canonicalVhcId}}`);

    if (notesError) {
      throw new Error(`Failed to load VHC-linked notes for cleanup: ${notesError.message}`);
    }

    for (const note of notesToUpdate || []) {
      const nextLinkedVhcId =
        String(note.linked_vhc_id ?? "") === String(canonicalVhcId)
          ? null
          : note.linked_vhc_id;

      const nextLinkedVhcIds = Array.isArray(note.linked_vhc_ids)
        ? note.linked_vhc_ids.filter((id) => String(id) !== String(canonicalVhcId))
        : note.linked_vhc_ids;

      if (
        nextLinkedVhcId === note.linked_vhc_id &&
        nextLinkedVhcIds === note.linked_vhc_ids
      ) {
        continue;
      }

      const { error: noteUpdateError } = await supabase
        .from("job_notes")
        .update({
          linked_vhc_id: nextLinkedVhcId,
          linked_vhc_ids: nextLinkedVhcIds,
          updated_at: now,
        })
        .eq("note_id", note.note_id);

      if (noteUpdateError) {
        throw new Error(`Failed to update job note linkage: ${noteUpdateError.message}`);
      }
    }
  }
};
