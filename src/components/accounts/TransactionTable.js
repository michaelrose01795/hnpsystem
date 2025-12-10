// file location: src/components/accounts/TransactionTable.js // header comment for file traceability
import React from "react"; // import React to render JSX
import PropTypes from "prop-types"; // import PropTypes for validation
import { TRANSACTION_TYPES, PAYMENT_METHODS } from "@/config/accounts"; // reuse shared constants for dropdowns
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }); // configure formatter for monetary values
export default function TransactionTable({ transactions, loading, filters, onFilterChange, pagination, onPageChange, onExport }) { // table component signature
  const handleFilterChange = (event) => { // update filter state when inputs change
    const { name, value } = event.target; // extract name/value pair from input
    onFilterChange({ ...filters, [name]: value }); // propagate updated filter object to parent
  }; // close handleFilterChange helper
  return ( // render encompassing card for table and filters
    <section // section wrapper used on transactions page
      style={{ // replicate card aesthetic from other modules
        background: "var(--surface)", // white card background
        borderRadius: "16px", // rounded corners
        border: "1px solid var(--surface-light)", // thin border for separation
        padding: "20px", // interior spacing
        display: "flex", // use column layout
        flexDirection: "column", // stack filter bar over table
        gap: "20px", // spacing between filter row and table
      }} // close section style
    >
      <header // filter header row
        style={{ // style header to align filters and actions
          display: "flex", // align children horizontally
          flexWrap: "wrap", // allow wrapping for smaller screens
          gap: "12px", // spacing between controls
          alignItems: "center", // center vertically
        }} // close header style
      >
        <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--primary)" }}>Transactions</h3> // header label text
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}> // wrap filters into inline cluster
          <select name="type" value={filters.type} onChange={handleFilterChange} style={{ padding: "8px 12px", borderRadius: "999px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }}> // transaction type filter select
            <option value="">All Types</option> // default option showing all transactions
            {TRANSACTION_TYPES.map((option) => ( // map through transaction type constants
              <option key={option} value={option}>{option}</option> // option element for each type
            ))}
          </select>
          <select name="payment_method" value={filters.payment_method} onChange={handleFilterChange} style={{ padding: "8px 12px", borderRadius: "999px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }}> // payment method select control
            <option value="">All Methods</option> // default option for all payment methods
            {PAYMENT_METHODS.map((method) => ( // map payment method constants
              <option key={method} value={method}>{method}</option> // option representing payment method
            ))}
          </select>
          <input type="date" name="from" value={filters.from} onChange={handleFilterChange} style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} /> // from date filter input
          <input type="date" name="to" value={filters.to} onChange={handleFilterChange} style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} /> // to date filter input
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}> // action button cluster aligned to right
          <button type="button" onClick={() => onFilterChange({ type: "", payment_method: "", from: "", to: "" })} style={{ padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", color: "var(--text-secondary)" }}> // reset filters button
            Clear Filters // label text for reset action
          </button>
          <button type="button" onClick={onExport} style={{ padding: "8px 18px", borderRadius: "10px", border: "none", background: "var(--primary)", color: "white", fontWeight: 600 }}> // export button for CSV download
            Export CSV // label for export action
          </button>
        </div>
      </header>
      <div style={{ overflowX: "auto" }}> // allow table to scroll horizontally on narrow screens
        <table style={{ width: "100%", borderCollapse: "collapse" }}> // table element for transaction grid
          <thead style={{ background: "var(--primary)", color: "white" }}> // colored header row
            <tr>
              <th style={{ textAlign: "left", padding: "12px" }}>Date</th> // column heading for date
              <th style={{ textAlign: "left", padding: "12px" }}>Transaction ID</th> // column heading for id
              <th style={{ textAlign: "left", padding: "12px" }}>Type</th> // heading for type column
              <th style={{ textAlign: "left", padding: "12px" }}>Amount</th> // heading for amount column
              <th style={{ textAlign: "left", padding: "12px" }}>Method</th> // heading for payment method
              <th style={{ textAlign: "left", padding: "12px" }}>Job Number</th> // heading for job association
              <th style={{ textAlign: "left", padding: "12px" }}>Created By</th> // heading for creator column
            </tr>
          </thead>
          <tbody>
            {loading && ( // show skeleton row while loading data
              <tr>
                <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>Loading transactions…</td> // single cell with message
              </tr>
            )}
            {!loading && transactions.length === 0 && ( // empty state when no records
              <tr>
                <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>No transactions found for this period.</td> // empty state message
              </tr>
            )}
            {!loading && transactions.map((txn) => ( // map through transactions when data ready
              <tr key={txn.transaction_id} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}> // row for each transaction
                <td style={{ padding: "12px" }}>{txn.transaction_date ? new Date(txn.transaction_date).toLocaleDateString("en-GB") : "—"}</td> // formatted transaction date
                <td style={{ padding: "12px", fontWeight: 600 }}>{txn.transaction_id || "—"}</td> // transaction id cell
                <td style={{ padding: "12px" }}>{txn.type}</td> // type cell
                <td style={{ padding: "12px", color: txn.type === "Debit" ? "#b91c1c" : "#065f46", fontWeight: 600 }}>{currencyFormatter.format(Number(txn.amount || 0))}</td> // amount cell with color coding
                <td style={{ padding: "12px" }}>{txn.payment_method || "—"}</td> // payment method cell
                <td style={{ padding: "12px" }}>{txn.job_number || "—"}</td> // job number cell
                <td style={{ padding: "12px" }}>{txn.created_by || "—"}</td> // created by cell
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}> // pagination footer similar to account table
        <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Page {pagination.page} of {Math.max(1, Math.ceil((pagination.total || 0) / pagination.pageSize))}</span> // page indicator text
        <div style={{ display: "flex", gap: "10px" }}> // button container
          <button type="button" onClick={() => onPageChange(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1} style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid var(--surface-light)", background: pagination.page <= 1 ? "var(--surface-light)" : "var(--surface)", cursor: pagination.page <= 1 ? "not-allowed" : "pointer" }}>Prev</button> // prev button
          <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize)} style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid var(--surface-light)", background: pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize) ? "var(--surface-light)" : "var(--surface)", cursor: pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize) ? "not-allowed" : "pointer" }}>Next</button> // next button
        </div>
      </footer>
    </section>
  ); // end render
} // close component definition
TransactionTable.propTypes = { // prop validation metadata
  transactions: PropTypes.arrayOf(PropTypes.object), // array of transaction objects
  loading: PropTypes.bool, // loading spinner flag
  filters: PropTypes.shape({ type: PropTypes.string, payment_method: PropTypes.string, from: PropTypes.string, to: PropTypes.string }), // filter object shape
  onFilterChange: PropTypes.func.isRequired, // callback invoked when filters change
  pagination: PropTypes.shape({ page: PropTypes.number, pageSize: PropTypes.number, total: PropTypes.number }), // pagination metadata
  onPageChange: PropTypes.func.isRequired, // callback invoked on page change
  onExport: PropTypes.func.isRequired, // callback invoked when export button clicked
}; // close propTypes assignment
TransactionTable.defaultProps = { // fallback props to keep component safe when not configured
  transactions: [], // empty transactions array by default
  loading: false, // assume not loading by default
  filters: { type: "", payment_method: "", from: "", to: "" }, // default filters
  pagination: { page: 1, pageSize: 20, total: 0 }, // default pagination
}; // close defaultProps definition
