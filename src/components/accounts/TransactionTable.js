// file location: src/components/accounts/TransactionTable.js // header comment for file traceability
import React from "react"; // import React to render JSX
import PropTypes from "prop-types";
import { TRANSACTION_TYPES, PAYMENT_METHODS } from "@/config/accounts";
import { CalendarField } from "@/components/calendarAPI";
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
export default function TransactionTable({ transactions, loading, filters, onFilterChange, pagination, onPageChange, onExport }) {
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    onFilterChange({ ...filters, [name]: value });
  };
  return (
    <section
      style={{
        background: "var(--surface)",
        borderRadius: "16px",
        border: "1px solid var(--surface-light)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--primary)" }}>Transactions</h3>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <select name="type" value={filters.type} onChange={handleFilterChange} style={{ padding: "8px 12px", borderRadius: "999px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }}>
            <option value="">All Types</option>
            {TRANSACTION_TYPES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select name="payment_method" value={filters.payment_method} onChange={handleFilterChange} style={{ padding: "8px 12px", borderRadius: "999px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }}>
            <option value="">All Methods</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
          <div style={{ flex: "0 0 180px" }}>
            <CalendarField name="from" placeholder="From date" value={filters.from} onChange={handleFilterChange} size="sm" />
          </div>
          <div style={{ flex: "0 0 180px" }}>
            <CalendarField name="to" placeholder="To date" value={filters.to} onChange={handleFilterChange} size="sm" />
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <button type="button" onClick={() => onFilterChange({ type: "", payment_method: "", from: "", to: "" })} style={{ padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", color: "var(--text-secondary)" }}>
            Clear Filters
          </button>
          <button type="button" onClick={onExport} style={{ padding: "8px 18px", borderRadius: "10px", border: "none", background: "var(--primary)", color: "white", fontWeight: 600 }}>
            Export CSV
          </button>
        </div>
      </header>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "var(--primary)", color: "white" }}>
            <tr>
              <th style={{ textAlign: "left", padding: "12px" }}>Date</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Transaction ID</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Type</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Amount</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Method</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Job Number</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Created By</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>Loading transactions…</td>
              </tr>
            )}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>No transactions found for this period.</td>
              </tr>
            )}
            {!loading && transactions.map((txn) => (
              <tr key={txn.transaction_id} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                <td style={{ padding: "12px" }}>{txn.transaction_date ? new Date(txn.transaction_date).toLocaleDateString("en-GB") : "—"}</td>
                <td style={{ padding: "12px", fontWeight: 600 }}>{txn.transaction_id || "—"}</td>
                <td style={{ padding: "12px" }}>{txn.type}</td>
                <td style={{ padding: "12px", color: txn.type === "Debit" ? "var(--danger-dark)" : "var(--success-text)", fontWeight: 600 }}>{currencyFormatter.format(Number(txn.amount || 0))}</td>
                <td style={{ padding: "12px" }}>{txn.payment_method || "—"}</td>
                <td style={{ padding: "12px" }}>{txn.job_number || "—"}</td>
                <td style={{ padding: "12px" }}>{txn.created_by || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Page {pagination.page} of {Math.max(1, Math.ceil((pagination.total || 0) / pagination.pageSize))}</span>
        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={() => onPageChange(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1} style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid var(--surface-light)", background: pagination.page <= 1 ? "var(--surface-light)" : "var(--surface)", cursor: pagination.page <= 1 ? "not-allowed" : "pointer" }}>Prev</button>
          <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize)} style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid var(--surface-light)", background: pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize) ? "var(--surface-light)" : "var(--surface)", cursor: pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize) ? "not-allowed" : "pointer" }}>Next</button>
        </div>
      </footer>
    </section>
  );
}
TransactionTable.propTypes = {
  transactions: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  filters: PropTypes.shape({ type: PropTypes.string, payment_method: PropTypes.string, from: PropTypes.string, to: PropTypes.string }),
  onFilterChange: PropTypes.func.isRequired,
  pagination: PropTypes.shape({ page: PropTypes.number, pageSize: PropTypes.number, total: PropTypes.number }),
  onPageChange: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
};
TransactionTable.defaultProps = {
  transactions: [],
  loading: false,
  filters: { type: "", payment_method: "", from: "", to: "" },
  pagination: { page: 1, pageSize: 20, total: 0 },
};
