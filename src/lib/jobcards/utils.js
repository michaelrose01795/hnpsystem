// file location: src/lib/jobcards/utils.js
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

      return {
        id: job.id,
        jobNumber: job.job_number || job.jobNumber,
        serviceDate: requestedAt,
        serviceDateFormatted,
        mileage: pickMileageValue(job.mileage, job.milage),
        requests,
        approvedVhcRequests,
        combinedRequests,
        invoiceNumber: invoiceRecord?.invoice_number || null,
        invoiceUrl: invoiceFile?.file_url || "",
        invoiceName: invoiceFile?.file_name || "",
        invoiceAvailable: Boolean(invoiceFile),
        invoicePaymentStatus: invoiceRecord?.payment_status || "",
      };
    });
};

export { normalizeRequests, mapCustomerJobsToHistory };

export default {
  normalizeRequests,
  mapCustomerJobsToHistory
};
