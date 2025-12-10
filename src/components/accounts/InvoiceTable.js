// file location: src/components/accounts/InvoiceTable.js // header for clarity
import React from "react"; // import React for JSX
import PropTypes from "prop-types"; // import PropTypes for runtime safety
import { INVOICE_STATUSES } from "@/config/accounts"; // reuse shared invoice constants
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }); // format money consistently
const isInvoiceOverdue = (invoice) => { // helper to determine overdue badge state
  if (!invoice) return false; // guard when invoice missing
  const status = (invoice.payment_status || invoice.status || "").toLowerCase(); // normalize status string
  if (status === "paid" || status === "cancelled") return false; // paid or cancelled invoices are never overdue
  if (!invoice.due_date) return false; // no due date means we cannot show badge
  const due = new Date(invoice.due_date); // parse due date
  if (Number.isNaN(due.getTime())) return false; // invalid dates are ignored
  return due.getTime() < Date.now(); // overdue when due date is in the past
}; // close isInvoiceOverdue helper
export default function InvoiceTable({ invoices, filters, onFilterChange, pagination, onPageChange, onExport, loading }) { // component definition
  const handleFilterChange = (event) => { // update filters when inputs change
    const { name, value } = event.target; // destructure input name/value
    onFilterChange({ ...filters, [name]: value }); // propagate updated filter object to parent component
  }; // close handleFilterChange
  return ( // render invoice table structure
    <section style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--surface-light)", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}> // card container replicating DMS styling
      <header style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}> // filter header row
        <h3 style={{ margin: 0, color: "var(--primary)" }}>Invoices</h3> // section title
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}> // group filters inline
          <input type="text" name="search" value={filters.search} placeholder="Search invoice or job" onChange={handleFilterChange} style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} /> // text input for search
          <select name="status" value={filters.status} onChange={handleFilterChange} style={{ padding: "8px 12px", borderRadius: "999px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }}> // status dropdown
            <option value="">All Statuses</option> // default to all statuses
            {INVOICE_STATUSES.map((status) => ( // map statuses to options
              <option value={status} key={status}>{status}</option> // render option element
            ))}
          </select>
          <input type="date" name="from" value={filters.from} onChange={handleFilterChange} style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} /> // from date field
          <input type="date" name="to" value={filters.to} onChange={handleFilterChange} style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} /> // to date field
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}> // actions cluster aligned to right
          <button type="button" onClick={() => onFilterChange({ search: "", status: "", from: "", to: "" })} style={{ padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", color: "var(--text-secondary)" }}>Clear</button> // clear filters button
          <button type="button" onClick={onExport} style={{ padding: "8px 18px", borderRadius: "10px", border: "none", background: "var(--primary)", color: "white", fontWeight: 600 }}>Export CSV</button> // export button
        </div>
      </header>
      <div style={{ overflowX: "auto" }}> // wrapper for horizontal scrolling on small devices
        <table style={{ width: "100%", borderCollapse: "collapse" }}> // invoice table element
          <thead style={{ background: "var(--primary)", color: "white" }}> // header styling consistent with other tables
            <tr>
              <th style={{ textAlign: "left", padding: "12px" }}>Invoice</th> // invoice identifier column
              <th style={{ textAlign: "left", padding: "12px" }}>Customer</th> // customer column
              <th style={{ textAlign: "left", padding: "12px" }}>Account</th> // account column
              <th style={{ textAlign: "left", padding: "12px" }}>Job</th> // job column
              <th style={{ textAlign: "left", padding: "12px" }}>Grand Total</th> // total column
              <th style={{ textAlign: "left", padding: "12px" }}>Status</th> // status column
              <th style={{ textAlign: "left", padding: "12px" }}>Due</th> // due date column
            </tr>
          </thead>
          <tbody>
            {loading && ( // show loading row when fetching data
              <tr>
                <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>Loading invoices…</td> // loading message cell
              </tr>
            )}
            {!loading && invoices.length === 0 && ( // render empty state when dataset empty
              <tr>
                <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>No invoices found.</td> // empty message cell
              </tr>
            )}
            {!loading && invoices.map((invoice) => { // map through invoices once loaded
              const overdue = isInvoiceOverdue(invoice); // check overdue state for badge
              return ( // return row for invoice
                <tr key={invoice.invoice_id} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}> // add divider between rows
                  <td style={{ padding: "12px", fontWeight: 600 }}>{invoice.invoice_id}</td> // invoice id cell
                  <td style={{ padding: "12px" }}>{invoice.customer_id}</td> // display customer identifier
                  <td style={{ padding: "12px" }}>{invoice.account_id || "—"}</td> // display account id
                  <td style={{ padding: "12px" }}>{invoice.job_number || "—"}</td> // display job number
                  <td style={{ padding: "12px", fontWeight: 600 }}>{currencyFormatter.format(Number(invoice.grand_total || 0))}</td> // display total with currency format
                  <td style={{ padding: "12px" }}>
                    <span style={{ padding: "4px 12px", borderRadius: "999px", background: "rgba(99,102,241,0.15)", color: "#3730a3", fontWeight: 600 }}>{invoice.payment_status || invoice.status || "Draft"}</span> // status badge element
                  </td>
                  <td style={{ padding: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-GB") : "—"} // show due date text
                    {overdue && <span style={{ background: "#fcd34d", color: "#92400e", borderRadius: "999px", padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700 }}>Overdue</span>} // yellow overdue badge when necessary
                  </td>
                </tr>
              ); // end row return
            })}
          </tbody>
        </table>
      </div>
      <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}> // pagination footer
        <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Page {pagination.page} of {Math.max(1, Math.ceil((pagination.total || 0) / pagination.pageSize))}</span> // pagination text
        <div style={{ display: "flex", gap: "10px" }}> // pagination buttons container
          <button type="button" onClick={() => onPageChange(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1} style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid var(--surface-light)", background: pagination.page <= 1 ? "var(--surface-light)" : "var(--surface)", cursor: pagination.page <= 1 ? "not-allowed" : "pointer" }}>Prev</button> // previous button
          <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize)} style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid var(--surface-light)", background: pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize) ? "var(--surface-light)" : "var(--surface)", cursor: pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize) ? "not-allowed" : "pointer" }}>Next</button> // next button
        </div>
      </footer>
    </section>
  ); // close component render
} // close InvoiceTable component definition
InvoiceTable.propTypes = { // prop validation block
  invoices: PropTypes.arrayOf(PropTypes.object), // invoices array data
  filters: PropTypes.shape({ search: PropTypes.string, status: PropTypes.string, from: PropTypes.string, to: PropTypes.string }), // filters object shape
  onFilterChange: PropTypes.func.isRequired, // filter change callback
  pagination: PropTypes.shape({ page: PropTypes.number, pageSize: PropTypes.number, total: PropTypes.number }), // pagination metadata object
  onPageChange: PropTypes.func.isRequired, // page change handler
  onExport: PropTypes.func.isRequired, // export handler
  loading: PropTypes.bool, // loading state flag
}; // close propTypes assignment
InvoiceTable.defaultProps = { // fallback prop values
  invoices: [], // default to empty list of invoices
  filters: { search: "", status: "", from: "", to: "" }, // default filter state
  pagination: { page: 1, pageSize: 20, total: 0 }, // default pagination numbers
  loading: false, // default to not loading
}; // close defaultProps block
