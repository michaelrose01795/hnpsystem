// file location: src/features/invoices/lib/buildInvoiceRequestRows.js
// Shared, pure resolver that turns an invoice payload (`data`) + live `jobData`
// into the ordered, display-ready request rows rendered by both the document
// layout (InvoiceDetail) and the job-card workspace layout (InvoiceWorkspace).
//
// Each returned row carries:
//   - displayRequest: the request object with resolved label/title/summary
//     (still spreads the original request, so it retains proforma_override,
//     totals, labour, request_id, proforma_key, request_kind for the editor)
//   - linkedParts: parts resolved for this request (request-linked + VHC-linked)
//   - isAuthorised: whether this is an authorised VHC row vs a customer request
//   - key: stable React key
import { getJobRequests } from "@/lib/canonical/fields";
import { isAuthorisedDecision, isVhcAuthorisedSource } from "@/lib/status/statusHelpers";

const isAuthorisedRequest = (request = {}) => {
  const explicitKind = String(request?.request_kind || "").toLowerCase().trim();
  if (isAuthorisedDecision(explicitKind)) return true;
  if (explicitKind === "request") return false;
  if (isAuthorisedDecision(request?.job_type)) return true;
  const label = String(request?.request_label || "").toLowerCase();
  const title = String(request?.title || "").toLowerCase();
  const summary = String(request?.summary || "").toLowerCase();
  return (
    label.includes("authorised") ||
    label.includes("authorized") ||
    title.includes("authorised") ||
    title.includes("authorized") ||
    summary.includes("authorised") ||
    summary.includes("authorized")
  );
};

const isAuthorisedSource = (value) => isVhcAuthorisedSource(value);
const isAuthorizedVhcDecision = (value) => isAuthorisedDecision(value);

const parseChecklistPayload = (raw) => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
};

const cleanChecklistTaskLabel = (value = "") =>
  String(value || "").replace(/^request\s*\d+\s*:\s*/i, "").trim();

const parseWriteUpRequestKey = (value = "") => {
  const key = String(value || "").trim().toLowerCase();
  const reqId = key.match(/^reqid-(\d+)$/);
  if (reqId) return { requestId: String(reqId[1]), sortOrder: null };
  const sortOrder = key.match(/^req-(\d+)$/);
  if (sortOrder) return { requestId: null, sortOrder: Number(sortOrder[1]) };
  return { requestId: null, sortOrder: null };
};

/**
 * @param {object} data - invoice detail payload ({ requests, meta, ... })
 * @param {object|null} jobData - live job data (partsAllocations, vhcChecks, etc.)
 * @returns {{ rows: Array, hasRequestLinking: boolean, isProforma: boolean }}
 */
export function buildInvoiceRequestRows(data, jobData = null) {
  const requests = Array.isArray(data?.requests) ? data.requests : [];
  const isProforma = Boolean(data?.meta?.isProforma);

  const requestRowsSource = getJobRequests(jobData);
  const customerRequestIds = [];
  const authorisedRequestIds = [];
  const requestSourceById = {};
  requestRowsSource.forEach((row) => {
    const requestId = row?.requestId ?? row?.request_id ?? null;
    if (requestId === null || requestId === undefined) return;
    const source = String(row?.requestSource ?? row?.request_source ?? "").toLowerCase().trim();
    requestSourceById[String(requestId)] = source;
    const jobType = String(row?.jobType ?? row?.job_type ?? "").toLowerCase().trim();
    const isAuthorisedRow =
      source === "vhc_authorised" ||
      source === "vhc_authorized" ||
      jobType === "authorised" ||
      jobType === "authorized";
    if (isAuthorisedRow) {
      authorisedRequestIds.push(String(requestId));
    } else {
      customerRequestIds.push(String(requestId));
    }
  });
  const hasRequestLinking = customerRequestIds.length > 0 || authorisedRequestIds.length > 0;
  const authorisedRequestIdSet = new Set(authorisedRequestIds);
  const customerRequestIdSet = new Set(customerRequestIds);
  const resolveIsAuthorised = (request = {}) => {
    const explicitKind = String(request?.request_kind || "").trim().toLowerCase();
    if (explicitKind === "authorised" || explicitKind === "authorized") return true;
    if (explicitKind === "request") return false;

    const requestId = request?.request_id;
    if (requestId !== null && requestId !== undefined) {
      const key = String(requestId);
      if (authorisedRequestIdSet.has(key)) return true;
      if (customerRequestIdSet.has(key)) return false;
    }

    const source = String(request?.request_source || request?.requestSource || "").trim().toLowerCase();
    if (isAuthorisedSource(source)) return true;

    return isAuthorisedRequest(request);
  };

  const partsByRequestId = {};
  const partsByVhcItemId = {};
  const allocations = Array.isArray(jobData?.partsAllocations) ? jobData.partsAllocations : [];
  allocations.forEach((item) => {
    const status = String(item?.status || "").toLowerCase().trim();
    if (status === "removed" || status === "cancelled") return;
    const requestId = item?.allocatedToRequestId ?? item?.allocated_to_request_id ?? null;
    if (requestId === null || requestId === undefined) return;
    const key = String(requestId);
    if (!partsByRequestId[key]) {
      partsByRequestId[key] = [];
    }
    const qty = Number(
      item?.quantityAllocated ??
        item?.quantity_allocated ??
        item?.qty ??
        item?.quantityRequested ??
        item?.quantity_requested ??
        0
    ) || 0;
    const priceGross = Number(
      item?.unitPrice ??
        item?.unit_price ??
        item?.price ??
        item?.part?.unitPrice ??
        item?.part?.unit_price ??
        0
    ) || 0;
    const rateValue = Number(item?.rate ?? item?.vatRate ?? item?.vat_rate ?? 20);
    const rate = Number.isFinite(rateValue) ? rateValue : 20;
    const vatFactor = 1 + rate / 100;
    const price = vatFactor > 0 ? priceGross / vatFactor : priceGross; // net unit price
    const net = qty * price;
    const gross = qty * priceGross;
    const vat = gross - net; // VAT extracted from VAT-inclusive amount
    const partRow = {
      part_number: item?.part?.partNumber || item?.part?.part_number || item?.part_number || "",
      description: item?.part?.name || item?.part?.description || item?.description || "Part",
      retail: item?.retail ?? item?.part?.retail ?? item?.part?.unitPrice ?? item?.part?.unit_price ?? null,
      qty,
      price,
      vat,
      rate,
    };
    partsByRequestId[key].push(partRow);

    const vhcItemId = item?.vhcItemId ?? item?.vhc_item_id ?? null;
    if (vhcItemId !== null && vhcItemId !== undefined) {
      const vhcKey = String(vhcItemId);
      if (!partsByVhcItemId[vhcKey]) {
        partsByVhcItemId[vhcKey] = [];
      }
      partsByVhcItemId[vhcKey].push({ ...partRow });
    }
  });

  const authorisedMetaByRequestId = {};
  const pushAuthorisedMeta = (row) => {
    if (!row) return;
    const requestId = row?.request_id ?? row?.requestId ?? null;
    if (requestId === null || requestId === undefined) return;
    const key = String(requestId);
    const issueTitle =
      row?.issue_title ?? row?.issueTitle ?? row?.label ?? row?.description ?? row?.text ?? "";
    const label = row?.label ?? "";
    const issueDescription =
      row?.issue_description ?? row?.issueDescription ?? row?.detail ?? "";
    const labourHoursRaw = row?.labour_hours ?? row?.labourHours ?? row?.hours ?? null;
    const labourHours =
      labourHoursRaw !== null && labourHoursRaw !== undefined && labourHoursRaw !== ""
        ? Number(labourHoursRaw)
        : null;
    const partsCostRaw = row?.parts_cost ?? row?.partsCost ?? null;
    const partsCost =
      partsCostRaw !== null && partsCostRaw !== undefined && partsCostRaw !== ""
        ? Number(partsCostRaw)
        : null;

    const existing = authorisedMetaByRequestId[key];
    const next = {
      label: String(label || "").trim(),
      issueTitle: String(issueTitle || "").trim(),
      issueDescription: String(issueDescription || "").trim(),
      labourHours: Number.isFinite(labourHours) ? labourHours : null,
      partsCost: Number.isFinite(partsCost) ? partsCost : null,
      vhcItemId: row?.vhcItemId ?? row?.vhc_item_id ?? row?.vhc_id ?? null,
    };

    if (!existing) {
      authorisedMetaByRequestId[key] = next;
      return;
    }

    const existingScore =
      (existing.label ? 1 : 0) +
      (existing.issueTitle ? 1 : 0) +
      (existing.issueDescription ? 1 : 0) +
      (existing.labourHours !== null ? 1 : 0) +
      (existing.partsCost !== null ? 1 : 0);
    const nextScore =
      (next.label ? 1 : 0) +
      (next.issueTitle ? 1 : 0) +
      (next.issueDescription ? 1 : 0) +
      (next.labourHours !== null ? 1 : 0) +
      (next.partsCost !== null ? 1 : 0);
    if (nextScore >= existingScore) {
      authorisedMetaByRequestId[key] = next;
    }
  };

  const authorizedVhcRows = Array.isArray(jobData?.authorizedVhcItems) ? jobData.authorizedVhcItems : [];
  authorizedVhcRows.forEach(pushAuthorisedMeta);

  const vhcChecks = Array.isArray(jobData?.vhcChecks) ? jobData.vhcChecks : [];
  vhcChecks
    .filter((row) => {
      const section = String(row?.section || "").trim();
      if (section === "VHC_CHECKSHEET" || section === "VHC Checksheet") return false;
      const state = row?.authorization_state ?? row?.approval_status ?? row?.status ?? null;
      return isAuthorizedVhcDecision(state) || row?.Complete === true || row?.complete === true;
    })
    .forEach(pushAuthorisedMeta);

  const writeUpChecklist = parseChecklistPayload(jobData?.writeUp?.task_checklist);
  const writeUpTasks = Array.isArray(writeUpChecklist?.tasks) ? writeUpChecklist.tasks : [];
  const writeUpRequestTitleByRequestId = {};
  const writeUpRequestTitleBySortOrder = {};
  const writeUpVhcTitleByVhcId = {};

  writeUpTasks.forEach((task) => {
    const source = String(task?.source || "").trim().toLowerCase();
    const label = cleanChecklistTaskLabel(task?.label || "");
    if (!label) return;
    if (source === "request") {
      const { requestId, sortOrder } = parseWriteUpRequestKey(task?.sourceKey || task?.source_key || "");
      if (requestId) {
        writeUpRequestTitleByRequestId[requestId] = label;
      } else if (sortOrder) {
        writeUpRequestTitleBySortOrder[String(sortOrder)] = label;
      }
      return;
    }
    if (source === "vhc") {
      const key = String(task?.sourceKey || task?.source_key || "");
      const vhcMatch = key.match(/vhc-[^-]+-(\d+)$/i);
      if (vhcMatch && vhcMatch[1]) {
        writeUpVhcTitleByVhcId[String(vhcMatch[1])] = label;
      }
    }
  });

  const activeAuthorisedRequestIdSet = new Set(Object.keys(authorisedMetaByRequestId));
  const visibleRequests = requests.filter((request) => {
    const requestId = request?.request_id ?? null;
    if (requestId === null || requestId === undefined) return true;
    const source = requestSourceById[String(requestId)] || "";
    if (!isAuthorisedSource(source)) return true;
    if (activeAuthorisedRequestIdSet.has(String(requestId))) return true;
    return resolveIsAuthorised(request);
  });

  const orderedRequests = [...visibleRequests].sort((a, b) => {
    const aAuthorised = resolveIsAuthorised(a);
    const bAuthorised = resolveIsAuthorised(b);
    if (aAuthorised === bAuthorised) {
      return (a.request_number || 0) - (b.request_number || 0);
    }
    return aAuthorised ? 1 : -1;
  });

  let customerRowIndex = 0;
  let authorisedRowIndex = 0;
  const rows = orderedRequests.map((request) => {
    const isAuthorised = resolveIsAuthorised(request);
    const currentAuthorisedNumber = authorisedRowIndex + 1;
    const currentCustomerNumber = customerRowIndex + 1;
    const explicitRequestId = request?.request_id ?? null;
    const linkedRequestId = explicitRequestId
      ? String(explicitRequestId)
      : isAuthorised
      ? authorisedRequestIds[authorisedRowIndex]
      : customerRequestIds[customerRowIndex];
    if (isAuthorised) {
      authorisedRowIndex += 1;
    } else {
      customerRowIndex += 1;
    }

    const linkedParts =
      hasRequestLinking && linkedRequestId
        ? (() => {
            const byRequest = partsByRequestId[String(linkedRequestId)] || [];
            if (!isAuthorised) return byRequest;
            const vhcItemId = authorisedMetaByRequestId[String(linkedRequestId)]?.vhcItemId ?? null;
            if (vhcItemId === null || vhcItemId === undefined) return byRequest;
            const byVhc = partsByVhcItemId[String(vhcItemId)] || [];
            const merged = [...byRequest];
            const seen = new Set(
              merged.map((row) => `${row.part_number}:${row.description}:${row.qty}:${row.price}`)
            );
            byVhc.forEach((row) => {
              const key = `${row.part_number}:${row.description}:${row.qty}:${row.price}`;
              if (seen.has(key)) return;
              seen.add(key);
              merged.push(row);
            });
            return merged;
          })()
        : undefined;
    const authorisedMeta = linkedRequestId ? authorisedMetaByRequestId[String(linkedRequestId)] : null;

    let displayRequest = request;
    if (isAuthorised) {
      const overriddenTitle = String(request?.proforma_override?.title_override || "").trim();
      const overriddenSummary = String(request?.proforma_override?.summary_override || "").trim();
      const writeUpVhcTitle =
        authorisedMeta?.vhcItemId !== null && authorisedMeta?.vhcItemId !== undefined
          ? writeUpVhcTitleByVhcId[String(authorisedMeta.vhcItemId)] || ""
          : "";
      const issueTitle = authorisedMeta?.issueTitle || request.title;
      const issueDescription = authorisedMeta?.issueDescription || "";
      const displayTitle =
        overriddenTitle ||
        writeUpVhcTitle ||
        authorisedMeta?.label ||
        (issueDescription ? `${issueTitle} - ${issueDescription}` : issueTitle);
      displayRequest = {
        ...request,
        request_label: `Authorised ${currentAuthorisedNumber}`,
        title: displayTitle || request.title,
        summary: overriddenSummary || "",
      };
    } else {
      const overriddenTitle = String(request?.proforma_override?.title_override || "").trim();
      const overriddenSummary = String(request?.proforma_override?.summary_override || "").trim();
      const writeUpRequestTitle =
        (linkedRequestId ? writeUpRequestTitleByRequestId[String(linkedRequestId)] : "") ||
        writeUpRequestTitleBySortOrder[String(currentCustomerNumber)] ||
        "";
      displayRequest = {
        ...request,
        request_label: `Request ${currentCustomerNumber}`,
        title: overriddenTitle || writeUpRequestTitle || request.title,
        summary: overriddenSummary || request.summary,
      };
    }

    return {
      key: `${request.request_number}-${linkedRequestId || "no-link"}`,
      displayRequest,
      linkedParts,
      isAuthorised,
    };
  });

  return { rows, hasRequestLinking, isProforma };
}

export default buildInvoiceRequestRows;
