// file location: src/features/invoices/components/InvoiceDetail.js // identify component path
import React from "react"; // import React for JSX rendering
import styles from "@/features/invoices/styles/invoice.module.css"; // import scoped styles for invoice layout

const formatCurrency = (value) => { // helper to format numbers as GBP currency
  const number = Number(value || 0); // coerce value to number
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(number); // format as GBP string
}; // end formatCurrency

const formatDate = (value) => { // helper to format ISO dates into UK format
  if (!value) return ""; // handle missing value
  const date = new Date(value); // create Date object
  if (Number.isNaN(date.getTime())) return value; // return raw value on invalid date
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); // format to UK style
}; // end formatDate

const AddressBlock = ({ title, address }) => { // reusable component to show invoice/delivery address
  return ( // render block
    <div className={styles.headerBox}> {/* // wrap with header box styling */}
      <h3>{title}</h3> {/* // show block title */}
      <ul className={styles.headerList}> {/* // list of address lines */}
        <li><strong>{address?.name || "N/A"}</strong></li> {/* // contact name */}
        {(address?.lines || []).map((line) => ( // iterate address lines
          <li key={line}>{line}</li> // render each line as list item
        ))} {/* // end lines */}
        {address?.postcode && <li>{address.postcode}</li>} {/* // show postcode if present */}
      </ul> {/* // end list */}
    </div> // end container
  ); // end return
}; // end AddressBlock

const JobMetaBlock = ({ invoice }) => { // component showing job/invoice metadata box
  return ( // render block
    <div className={styles.headerBox}> {/* // wrap in header box */}
      <h3>Job & Invoice</h3> {/* // heading */}
      <ul className={styles.headerList}> {/* // metadata list */}
        <li>Invoice No: <strong>{invoice.invoice_number || "—"}</strong></li> {/* // invoice number */}
        <li>Date: <strong>{formatDate(invoice.invoice_date)}</strong></li> {/* // invoice date */}
        <li>A/C No: <strong>{invoice.account_number || "—"}</strong></li> {/* // account reference */}
        <li>Job No: <strong>{invoice.job_number || "—"}</strong></li> {/* // job number */}
        <li>Order No: <strong>{invoice.order_number || "—"}</strong></li> {/* // order reference */}
        <li>Page: <strong>{invoice.page_count || 1}</strong></li> {/* // page count */}
      </ul> {/* // end list */}
    </div> // end box
  ); // end return
}; // end JobMetaBlock

const VehicleRow = ({ vehicle }) => { // render vehicle details row
  const entries = [ // define label/value entries
    { label: "Reg", value: vehicle?.reg || "—" }, // registration
    { label: "Vehicle", value: vehicle?.vehicle || "—" }, // vehicle description
    { label: "Chassis No", value: vehicle?.chassis || "—" }, // chassis number
    { label: "Engine No", value: vehicle?.engine || vehicle?.engine_no || "—" }, // engine number
    { label: "Reg Date", value: vehicle?.reg_date ? formatDate(vehicle.reg_date) : "—" }, // registration date
    { label: "Del Date", value: vehicle?.delivery_date ? formatDate(vehicle.delivery_date) : "—" }, // delivery date optional
    { label: "Mileage", value: vehicle?.mileage ? `${vehicle.mileage} mi` : "—" } // mileage
  ]; // end entries
  return ( // render grid
    <div className={styles.vehicleRow}> {/* // container grid */}
      {entries.map((entry) => ( // iterate entries
        <div key={entry.label} className={styles.vehicleItem}> {/* // column */}
          <span>{entry.label}</span> {/* // label text */}
          <strong>{entry.value}</strong> {/* // value */}
        </div> // end column
      ))} {/* // end map */}
    </div> // end grid
  ); // end return
}; // end VehicleRow

const RequestBlock = ({ request }) => { // render each request body block
  const partsNet = (request.totals?.request_total_net || 0) - (request.labour?.net || 0); // parts-only net total
  return ( // render section
    <section className={styles.requestBlock}> {/* // wrapper */}
      <div className={styles.requestHeader}> {/* // header row */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>{`${request.request_label || `Request ${request.request_number}`}: ${request.title}`}</h3> {/* // request title */}
          {request.summary && <p style={{ margin: "4px 0 0", color: "var(--text-secondary)" }}>{request.summary}</p>} {/* // optional summary */}
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
      </div> {/* // end header row */}

      <div className={styles.partsTableWrapper}> {/* // enable scroll */}
        <table className={styles.partsTable}> {/* // parts table */}
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
      </div> {/* // end table wrapper */}
    </section>
  );
}; // end RequestBlock

const TotalsFooter = ({ totals }) => { // render service/VAT/invoice totals
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
}; // end TotalsFooter

const PaymentBlock = ({ payment }) => { // render bank/payment details
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
}; // end PaymentBlock

export default function InvoiceDetail({ data, onPrint }) { // parent component rendering full layout
  if (!data) {
    return null; // guard against missing data
  }
  const { company, invoice, requests = [], payment } = data; // destructure payload
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
        <button type="button" className={styles.printButton} onClick={onPrint}>
          Print Invoice
        </button>
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
} // end InvoiceDetail
