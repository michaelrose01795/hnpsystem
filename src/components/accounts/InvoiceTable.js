// file location: src/components/accounts/InvoiceTable.js // header for clarity
import React from "react"; // import React for JSX
import PropTypes from "prop-types";
import { INVOICE_STATUSES } from "@/config/accounts";
import { CalendarField } from "@/components/calendarAPI";
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const isInvoiceOverdue = (invoice) => {
  if (!invoice) return false;
  const status = (invoice.payment_status || invoice.status || "").toLowerCase();
  if (status === "paid" || status === "cancelled") return false;
  if (!invoice.due_date) return false;
  const due = new Date(invoice.due_date);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
};
export default function InvoiceTable({ invoices, filters, onFilterChange, pagination, onPageChange, onExport, loading }) {
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    onFilterChange({ ...filters, [name]: value });
  };
  return (
    <section style={{ background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--surface-light)", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        <h3 style={{ margin: 0, color: "var(--primary)" }}>Invoices</h3>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input type="text" name="search" value={filters.search} placeholder="Search invoice or job" onChange={handleFilterChange} style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }} />
          <select name="status" value={filters.status} onChange={handleFilterChange} style={{ padding: "8px 12px", borderRadius: "999px", border: "1px solid var(--surface-light)", background: "var(--surface-light)" }}>
            <option value="">All Statuses</option>
            {INVOICE_STATUSES.map((status) => (
              <option value={status} key={status}>{status}</option>
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
          <button type="button" onClick={() => onFilterChange({ search: "", status: "", from: "", to: "" })} style={{ padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", color: "var(--text-secondary)" }}>Clear</button>
          <button type="button" onClick={onExport} style={{ padding: "8px 18px", borderRadius: "10px", border: "none", background: "var(--primary)", color: "white", fontWeight: 600 }}>Export CSV</button>
        </div>
      </header>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "var(--primary)", color: "white" }}>
            <tr>
              <th style={{ textAlign: "left", padding: "12px" }}>Invoice</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Customer</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Account</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Job</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Grand Total</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Status</th>
              <th style={{ textAlign: "left", padding: "12px" }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>Loading invoices…</td>
              </tr>
            )}
            {!loading && invoices.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>No invoices found.</td>
              </tr>
            )}
            {!loading && invoices.map((invoice) => {
              const overdue = isInvoiceOverdue(invoice);
              return (
                <tr key={invoice.invoice_id} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                  <td style={{ padding: "12px", fontWeight: 600 }}>{invoice.invoice_id}</td>
                  <td style={{ padding: "12px" }}>{invoice.customer_id}</td>
                  <td style={{ padding: "12px" }}>{invoice.account_id || "—"}</td>
                  <td style={{ padding: "12px" }}>{invoice.job_number || "—"}</td>
                  <td style={{ padding: "12px", fontWeight: 600 }}>{currencyFormatter.format(Number(invoice.grand_total || 0))}</td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ padding: "4px 12px", borderRadius: "999px", background: "rgba(99,102,241,0.15)", color: "#3730a3", fontWeight: 600 }}>{invoice.payment_status || invoice.status || "Draft"}</span>
                  </td>
                  <td style={{ padding: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-GB") : "—"}
                    {overdue && <span style={{ background: "#fcd34d", color: "#92400e", borderRadius: "999px", padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700 }}>Overdue</span>}
                  </td>
                </tr>
              );
            })}
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
InvoiceTable.propTypes = {
  invoices: PropTypes.arrayOf(PropTypes.object),
  filters: PropTypes.shape({ search: PropTypes.string, status: PropTypes.string, from: PropTypes.string, to: PropTypes.string }),
  onFilterChange: PropTypes.func.isRequired,
  pagination: PropTypes.shape({ page: PropTypes.number, pageSize: PropTypes.number, total: PropTypes.number }),
  onPageChange: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};
InvoiceTable.defaultProps = {
  invoices: [],
  filters: { search: "", status: "", from: "", to: "" },
  pagination: { page: 1, pageSize: 20, total: 0 },
  loading: false,
};
