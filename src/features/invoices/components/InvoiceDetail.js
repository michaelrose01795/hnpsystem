// file location: src/features/invoices/components/InvoiceDetail.js
import React from "react";
import styles from "@/features/invoices/styles/invoice.module.css";

const formatCurrency = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(number);
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const isAuthorisedRequest = (request = {}) => {
  const explicitKind = String(request?.request_kind || "").toLowerCase().trim();
  if (explicitKind === "authorised" || explicitKind === "authorized") return true;
  if (explicitKind === "request") return false;
  const explicitJobType = String(request?.job_type || "").toLowerCase().trim();
  if (explicitJobType === "authorised" || explicitJobType === "authorized") return true;
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

const isAuthorisedSource = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "vhc_authorised" || normalized === "vhc_authorized";
};

const isAuthorizedVhcDecision = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "authorized" || normalized === "authorised" || normalized === "completed";
};

const AddressBlock = ({ title, address }) => {
  return (
    <div className={styles.headerBox}>
      <h3>{title}</h3>
      <ul className={styles.headerList}>
        <li><strong>{address?.name || "N/A"}</strong></li>
        {(address?.lines || []).map((line) => (
          <li key={line}>{line}</li>
        ))}
        {address?.postcode && <li>{address.postcode}</li>}
      </ul>
    </div>
  );
};

const JobMetaBlock = ({ invoice }) => {
  return (
    <div className={styles.headerBox}>
      <h3>Job & Invoice</h3>
      <ul className={styles.headerList}>
        <li>Invoice No: <strong>{invoice.invoice_number || "—"}</strong></li>
        <li>Date: <strong>{formatDate(invoice.invoice_date)}</strong></li>
        <li>A/C No: <strong>{invoice.account_number || "—"}</strong></li>
        <li>Job No: <strong>{invoice.job_number || "—"}</strong></li>
        <li>Order No: <strong>{invoice.order_number || "—"}</strong></li>
        <li>Page: <strong>{invoice.page_count || 1}</strong></li>
      </ul>
    </div>
  );
};

const VehicleRow = ({ vehicle }) => {
  const entries = [
    { label: "Reg", value: vehicle?.reg || "—" },
    { label: "Vehicle", value: vehicle?.vehicle || "—" },
    { label: "Chassis No", value: vehicle?.chassis || "—" },
    { label: "Engine No", value: vehicle?.engine || vehicle?.engine_no || "—" },
    { label: "Reg Date", value: vehicle?.reg_date ? formatDate(vehicle.reg_date) : "—" },
    { label: "Del Date", value: vehicle?.delivery_date ? formatDate(vehicle.delivery_date) : "—" },
    { label: "Mileage", value: vehicle?.mileage ? `${vehicle.mileage} mi` : "—" }
  ];
  return (
    <div className={styles.vehicleRow}>
      {entries.map((entry) => (
        <div key={entry.label} className={styles.vehicleItem}>
          <span>{entry.label}</span>
          <strong>{entry.value}</strong>
        </div>
      ))}
    </div>
  );
};

const RequestBlock = ({ request, linkedParts }) => {
  const displayParts = Array.isArray(linkedParts) ? linkedParts : request.parts;
  const partsNet = (request.totals?.request_total_net || 0) - (request.labour?.net || 0);
  return (
    <section className={styles.requestBlock}>
      <div className={styles.requestHeader}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>{`${request.request_label || `Request ${request.request_number}`}: ${request.title}`}</h3>
          {request.summary && <p style={{ margin: "4px 0 0", color: "var(--text-secondary)" }}>{request.summary}</p>}
          {(request?.writeup?.fault || request?.writeup?.rectification) && (
            <div style={{ marginTop: "8px", display: "grid", gap: "4px" }}>
              {request?.writeup?.fault && (
                <p style={{ margin: 0, color: "var(--text-primary)" }}>
                  <strong>Fault:</strong> {request.writeup.fault}
                </p>
              )}
              {request?.writeup?.rectification && (
                <p style={{ margin: 0, color: "var(--text-primary)" }}>
                  <strong>Rectification:</strong> {request.writeup.rectification}
                </p>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "20px", textAlign: "right", flexShrink: 0 }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Parts Total</p>
            <strong>{formatCurrency(partsNet)}</strong>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Labour Total</p>
            <strong>{formatCurrency(request.labour?.net || 0)}</strong>
            <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-secondary)" }}>{request.labour?.hours || 0}h</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Tax @20%</p>
            <strong>{formatCurrency(request.totals?.request_total_vat || 0)}</strong>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Total inc. Tax</p>
            <strong style={{ fontSize: "1.05rem" }}>{formatCurrency(request.totals?.request_total_gross || 0)}</strong>
          </div>
        </div>
      </div>

      {Array.isArray(displayParts) && displayParts.length > 0 && (
        <div className={styles.partsTableWrapper}>
          <table className={styles.partsTable}>
            <thead>
              <tr>
                <th>Part No</th>
                <th>Description</th>
                <th>Retail</th>
                <th>Qty</th>
                <th>Price</th>
                <th>VAT</th>
                <th>Rate %</th>
              </tr>
            </thead>
            <tbody>
              {displayParts.map((item, index) => (
                <tr key={`${item.part_number}-${index}`}>
                  <td>{item.part_number || "—"}</td>
                  <td>{item.description || "—"}</td>
                  <td>{item.retail ? formatCurrency(item.retail) : "—"}</td>
                  <td>{item.qty ?? 0}</td>
                  <td>{formatCurrency(item.price || 0)}</td>
                  <td>{formatCurrency(item.vat || 0)}</td>
                  <td>{item.rate ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const TotalsFooter = ({ totals }) => {
  const cards = [
    { label: "Service Total", value: formatCurrency(totals.service_total || 0) },
    { label: "VAT Total", value: formatCurrency(totals.vat_total || 0) },
    { label: "Invoice Total", value: formatCurrency(totals.invoice_total || 0) }
  ];
  return (
    <div className={styles.totalsFooter}>
      {cards.map((card) => (
        <div key={card.label} className={styles.totalCard}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </div>
      ))}
    </div>
  );
};

const PaymentBlock = ({ payment }) => {
  const entries = [
    { label: "Bank Name", value: payment.bank_name || "—" },
    { label: "Sort Code", value: payment.sort_code || "—" },
    { label: "Account Number", value: payment.account_number || "—" },
    { label: "Account Name", value: payment.account_name || "—" }
  ];
  return (
    <div className={styles.paymentDetails}>
      <h3>Payment Details</h3>
      <div className={styles.paymentGrid}>
        {entries.map((entry) => (
          <div key={entry.label}>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
              {entry.label}
            </p>
            <strong>{entry.value}</strong>
          </div>
        ))}
      </div>
      <p style={{ marginTop: "12px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
        {payment.payment_reference_hint || "Use invoice number as reference"}
      </p>
    </div>
  );
};

export default function InvoiceDetail({ data, onPrint, onEmail, emailStatus, customerEmail, jobData = null }) {
  if (!data) {
    return null;
  }
  const { company, invoice, requests = [], payment } = data;
  const requestRowsSource = Array.isArray(jobData?.jobRequests)
    ? jobData.jobRequests
    : Array.isArray(jobData?.job_requests)
    ? jobData.job_requests
    : [];
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
    partsByRequestId[key].push({
      part_number: item?.part?.partNumber || item?.part?.part_number || item?.part_number || "",
      description: item?.part?.name || item?.part?.description || item?.description || "Part",
      retail: item?.retail ?? item?.part?.retail ?? item?.part?.unitPrice ?? item?.part?.unit_price ?? null,
      qty,
      price,
      vat,
      rate,
    });
  });

  const authorisedMetaByRequestId = {};
  const pushAuthorisedMeta = (row) => {
    if (!row) return;
    const requestId = row?.request_id ?? row?.requestId ?? null;
    if (requestId === null || requestId === undefined) return;
    const key = String(requestId);
    const issueTitle =
      row?.issue_title ??
      row?.issueTitle ??
      row?.label ??
      row?.description ??
      row?.text ??
      "";
    const label = row?.label ?? "";
    const issueDescription =
      row?.issue_description ??
      row?.issueDescription ??
      row?.detail ??
      "";
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

  const activeAuthorisedRequestIdSet = new Set(Object.keys(authorisedMetaByRequestId));
  const visibleRequests = requests.filter((request) => {
    const requestId = request?.request_id ?? null;
    if (requestId === null || requestId === undefined) return true;
    const source = requestSourceById[String(requestId)] || "";
    if (!isAuthorisedSource(source)) return true;
    return activeAuthorisedRequestIdSet.has(String(requestId));
  });

  let customerRowIndex = 0;
  let authorisedRowIndex = 0;
  const orderedRequests = [...visibleRequests].sort((a, b) => {
    const aAuthorised = resolveIsAuthorised(a);
    const bAuthorised = resolveIsAuthorised(b);
    if (aAuthorised === bAuthorised) {
      return (a.request_number || 0) - (b.request_number || 0);
    }
    return aAuthorised ? 1 : -1;
  });
  return (
    <article className={styles.invoiceShell}>
      <header className={styles.companyHeader}>
        <div className={styles.companyInfo}>
          <h1>{company?.name || "Company"}</h1>
          {(company?.address || []).map((line) => (
            <p key={line}>{line}</p>
          ))}
          {company?.postcode && <p>{company.postcode}</p>}
          {company?.phone_service && <p>Service: {company.phone_service}</p>}
          {company?.phone_parts && <p>Parts: {company.phone_parts}</p>}
          {company?.website && (
            <p>
              <a href={company.website} target="_blank" rel="noreferrer">
                {company.website}
              </a>
            </p>
          )}
        </div>
        <div className="invoice-action-buttons" style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className={styles.printButton} onClick={onPrint}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px", verticalAlign: "middle" }}>
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print Invoice
            </button>
            <button
              type="button"
              className={styles.printButton}
              onClick={onEmail}
              disabled={emailStatus === "Sending..."}
              style={{
                background: customerEmail ? "var(--primary-dark)" : "var(--grey-accent-light)",
                borderColor: customerEmail ? "var(--primary-dark)" : "var(--grey-accent-light)",
                cursor: customerEmail ? "pointer" : "not-allowed",
                opacity: emailStatus === "Sending..." ? 0.7 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px", verticalAlign: "middle" }}>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 7l-10 7L2 7" />
              </svg>
              {emailStatus === "Sending..." ? "Sending..." : "Email Invoice"}
            </button>
          </div>
          {emailStatus && emailStatus !== "Sending..." && (
            <div style={{
              fontSize: "12px",
              padding: "4px 10px",
              borderRadius: "6px",
              backgroundColor: emailStatus.includes("success") ? "var(--success-surface)" : "var(--danger-surface)",
              color: emailStatus.includes("success") ? "var(--success-dark)" : "var(--danger-dark)",
            }}>
              {emailStatus}
            </div>
          )}
        </div>
      </header>

      <section className={styles.headerGrid}>
        <AddressBlock title="Invoice To" address={invoice.invoice_to} />
        <AddressBlock title="Deliver To" address={invoice.deliver_to} />
        <JobMetaBlock invoice={invoice} />
      </section>

      <VehicleRow vehicle={invoice.vehicle_details} />

      {orderedRequests.length === 0 ? (
        <div className={`${styles.statusMessage}`}>
          No detailed requests recorded for this invoice yet.
        </div>
      ) : (
        orderedRequests.map((request) => {
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
              ? partsByRequestId[String(linkedRequestId)] || []
              : undefined;
          const authorisedMeta = linkedRequestId ? authorisedMetaByRequestId[String(linkedRequestId)] : null;

          let requestForDisplay = request;
          if (isAuthorised) {
            const issueTitle = authorisedMeta?.issueTitle || request.title;
            const issueDescription = authorisedMeta?.issueDescription || "";
            const displayTitle =
              authorisedMeta?.label ||
              (issueDescription ? `${issueTitle} - ${issueDescription}` : issueTitle);
            requestForDisplay = {
              ...request,
              request_label: `Authorised ${currentAuthorisedNumber}`,
              title: displayTitle || request.title,
              summary: "",
            };
          } else if (!request.request_label) {
            requestForDisplay = {
              ...request,
              request_label: `Request ${currentCustomerNumber}`,
            };
          }

          return (
            <RequestBlock
              key={`${request.request_number}-${linkedRequestId || "no-link"}`}
              request={requestForDisplay}
              linkedParts={linkedParts}
            />
          );
        })
      )}

      <TotalsFooter totals={invoice.totals} />

      <PaymentBlock payment={payment} />
    </article>
  );
}
