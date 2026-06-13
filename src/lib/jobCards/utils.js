// file location: src/lib/jobCards/utils.js
import {
  normalizeLegacyRequests,
  getJobRequests,
  pickMileageValue,
} from "@/lib/canonical/fields";
import { normalizeDecision } from "@/lib/vhc/vhcItemState"; // Canonical VHC decision normalizer.

/**
 * @deprecated Use normalizeLegacyRequests from @/lib/canonical/fields directly.
 * Kept as a re-export so existing callers are not broken.
 */
const normalizeRequests = normalizeLegacyRequests;

/** Delegates to canonical normalizeDecision. Returns "" for empty input (legacy behavior). */
const normalizeApprovalStatus = (value = "") => { // Thin wrapper for backward compat.
  return normalizeDecision(value) ?? ""; // Canonical normalizer, empty-string fallback.
};

const buildHistoryText = (...values) =>
  values
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";

// Resolve a "First Last" display name from an embedded users row
// (technician:assigned_to / advisor:booked_by). Returns "" when absent.
const buildPersonName = (person) =>
  person
    ? `${person.first_name || ""} ${person.last_name || ""}`.trim()
    : "";

// Tally a job's parts_job_items into the four counts shown in the history
// detail panel. allocated = status 'allocated'; onOrder = status 'on_order';
// backOrder = stock_status 'back_order'; total = every line on the job.
const summarisePartsItems = (items = []) => {
  const list = Array.isArray(items) ? items : [];
  return list.reduce(
    (acc, item) => {
      const status = String(item?.status || "").toLowerCase();
      const stockStatus = String(item?.stock_status || "").toLowerCase();
      if (status === "allocated") acc.allocated += 1;
      if (status === "on_order") acc.onOrder += 1;
      if (stockStatus === "back_order") acc.backOrder += 1;
      acc.total += 1;
      return acc;
    },
    { allocated: 0, onOrder: 0, backOrder: 0, total: 0 }
  );
};

const mapHistoryNote = (note = {}) => {
  const creatorName = note.user
    ? `${note.user.first_name || ""} ${note.user.last_name || ""}`.trim()
    : "";

  return {
    noteId: note.note_id ?? note.noteId ?? null,
    jobId: note.job_id ?? note.jobId ?? null,
    noteText: note.note_text ?? note.noteText ?? "",
    hiddenFromCustomer:
      note.hidden_from_customer ?? note.hiddenFromCustomer ?? true,
    createdAt: note.created_at ?? note.createdAt ?? null,
    updatedAt: note.updated_at ?? note.updatedAt ?? null,
    createdBy: creatorName || note.createdBy || "Unknown",
    createdByEmail: note.user?.email || note.createdByEmail || "",
  };
};

const mapCustomerJobsToHistory = (jobs = [], vehicleReg = "") => {
  const normalizedReg = vehicleReg ? vehicleReg.trim().toUpperCase() : "";

  return (Array.isArray(jobs) ? jobs : [])
    .filter((job) => {
      if (!normalizedReg) return true;
      const jobReg =
        (job.vehicle_reg || job.vehicleReg || "").trim().toUpperCase();
      return jobReg === normalizedReg;
    })
    .map((job) => {
      const requestedAt =
        job.appointments?.[0]?.scheduled_time ||
        job.created_at ||
        job.updated_at ||
        null;

      const serviceDateFormatted = requestedAt
        ? new Date(requestedAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
          })
        : "Unknown";

      const canonicalRequests = getJobRequests(job);
      const requests =
        Array.isArray(job.job_requests) && job.job_requests.length
          ? canonicalRequests.map((req) => ({
              requestId: req.request_id,
              text: req.description || "",
              time: req.hours ?? "",
              paymentType: req.job_type || "Customer",
              kind: "request",
              source: req.request_source || "job_request",
              noteText: req.note_text || ""
            }))
          : canonicalRequests;

      const approvedVhcRequests = Array.isArray(job.vhc_checks)
        ? job.vhc_checks
            .filter((item) => {
              const approval = normalizeApprovalStatus(item?.approval_status);
              const state = normalizeApprovalStatus(item?.authorization_state);
              return approval === "authorized" || approval === "completed" || state === "authorized";
            })
            .map((item) => ({
              vhcItemId: item.vhc_id ?? null,
              requestId: item.request_id ?? null,
              text: buildHistoryText(item.issue_title, item.issue_description, item.section, "Approved VHC item"),
              detail: buildHistoryText(item.issue_description),
              section: item.section || "",
              kind: "vhc_authorized",
              approvalStatus: normalizeApprovalStatus(item.approval_status || item.authorization_state),
              approvedAt: item.approved_at || item.updated_at || item.created_at || null,
            }))
        : [];

      const invoiceFile = (job.job_files || []).find((file) => {
        const type = (file.file_type || "").toLowerCase();
        const folder = (file.folder || "").toLowerCase();
        return type.includes("invoice") || folder.includes("invoice");
      });
      const invoiceRecord = Array.isArray(job.invoices) && job.invoices.length > 0
        ? [...job.invoices]
            .sort((a, b) => {
              const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
              const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
              return bTime - aTime;
            })[0]
        : null;
      const combinedRequests = [...requests, ...approvedVhcRequests];

      const spendValue =
        invoiceRecord?.invoice_total ?? invoiceRecord?.total ?? null;
      const spend =
        spendValue === null || spendValue === ""
          ? null
          : Number(spendValue);

      return {
        id: job.id,
        jobNumber: job.job_number || job.jobNumber,
        serviceDate: requestedAt,
        serviceDateFormatted,
        status: job.status || "",
        mileage: pickMileageValue(job.mileage, job.milage),
        advisor: buildPersonName(job.advisor),
        technician: buildPersonName(job.technician),
        // Parts user is allocated_by (auth.users uuid) — no clean name join
        // available yet, so surface "" and let the UI render "—". TODO: resolve.
        partsUser: "",
        parts: summarisePartsItems(job.parts_job_items),
        spend: Number.isFinite(spend) ? spend : null,
        requests,
        approvedVhcRequests,
        combinedRequests,
        invoiceNumber: invoiceRecord?.invoice_number || null,
        invoiceUrl: invoiceFile?.file_url || "",
        invoiceName: invoiceFile?.file_name || "",
        invoiceAvailable: Boolean(invoiceFile),
        invoicePaymentStatus: invoiceRecord?.payment_status || "",
        notes: Array.isArray(job.job_notes)
          ? job.job_notes.map(mapHistoryNote)
          : Array.isArray(job.notes)
          ? job.notes.map(mapHistoryNote)
          : [],
      };
    });
};

// ---------------------------------------------------------------------------
// Board ordering — shared between nextjobs.js and myjobs/index.js so that
// the row order a technician sees in their My Jobs list always matches the
// order their cards appear in the board panel on Next Jobs.
// ---------------------------------------------------------------------------

const getSortablePosition = (job) => {
  const numeric = Number(job?.position);
  return Number.isFinite(numeric) ? numeric : null;
};

const getComparableTimestamp = (value) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

/**
 * Comparator for Array.prototype.sort that reproduces the ordering used on
 * the Next Jobs board:
 *   1. Explicit drag-drop position (ascending, nulls last)
 *   2. checkedInAt timestamp (newest first)
 *   3. createdAt timestamp (newest first)
 */
const compareJobsForBoard = (left, right) => {
  const leftPosition = getSortablePosition(left);
  const rightPosition = getSortablePosition(right);

  if (leftPosition !== null && rightPosition !== null && leftPosition !== rightPosition) {
    return leftPosition - rightPosition;
  }
  if (leftPosition !== null && rightPosition === null) return -1;
  if (leftPosition === null && rightPosition !== null) return 1;

  const checkedInDifference =
    getComparableTimestamp(right?.checkedInAt) - getComparableTimestamp(left?.checkedInAt);
  if (checkedInDifference !== 0) return checkedInDifference;

  return getComparableTimestamp(right?.createdAt) - getComparableTimestamp(left?.createdAt);
};

export { normalizeRequests, mapCustomerJobsToHistory, compareJobsForBoard };

export default {
  normalizeRequests,
  mapCustomerJobsToHistory,
  compareJobsForBoard,
};
