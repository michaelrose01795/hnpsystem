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

const RequestBlock = ({ request }) => {
  const partsNet = (request.totals?.request_total_net || 0) - (request.labour?.net || 0);
  return (
    <section className={styles.requestBlock}>
      <div className={styles.requestHeader}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>{`${request.request_label || `Request ${request.request_number}`}: ${request.title}`}</h3>
          {request.summary && <p style={{ margin: "4px 0 0", color: "var(--text-secondary)" }}>{request.summary}</p>}
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
            {request.parts && request.parts.length > 0 ? (
              request.parts.map((item, index) => (
                <tr key={`${item.part_number}-${index}`}>
                  <td>{item.part_number || "—"}</td>
                  <td>{item.description || "—"}</td>
                  <td>{item.retail ? formatCurrency(item.retail) : "—"}</td>
                  <td>{item.qty ?? 0}</td>
                  <td>{formatCurrency(item.price || 0)}</td>
                  <td>{formatCurrency(item.vat || 0)}</td>
                  <td>{item.rate ?? 0}%</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                  No parts recorded for this request.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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

export default function InvoiceDetail({ data, onPrint, onEmail, emailStatus, customerEmail }) {
  if (!data) {
    return null;
  }
  const { company, invoice, requests = [], payment } = data;
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

      {requests.length === 0 ? (
        <div className={`${styles.statusMessage}`}>
          No detailed requests recorded for this invoice yet.
        </div>
      ) : (
        requests.map((request) => <RequestBlock key={request.request_number} request={request} />)
      )}

      <TotalsFooter totals={invoice.totals} />

      <PaymentBlock payment={payment} />
    </article>
  );
}
