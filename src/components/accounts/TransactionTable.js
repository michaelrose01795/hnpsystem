// file location: src/components/accounts/TransactionTable.js // header comment for file traceability
import React from "react"; // import React to render JSX
import PropTypes from "prop-types";
import { TRANSACTION_TYPES, PAYMENT_METHODS } from "@/config/accounts";
import { CalendarField } from "@/components/ui/calendarAPI";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { SearchBar } from "@/components/ui/searchBarAPI";
import ToolbarRow from "@/components/ui/ToolbarRow";
import Button from "@/components/ui/Button";

const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
export default function TransactionTable({ transactions, loading, filters, onFilterChange, pagination, onPageChange, onExport, accentSurface = false }) {
  const [hoveredTransactionId, setHoveredTransactionId] = React.useState(null);
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    onFilterChange({ ...filters, [name]: value });
  };

  const filteredTransactions = React.useMemo(() => {
    return (transactions || []).filter((txn) => {
      const search = String(filters.search || "").trim().toLowerCase();
      const transactionDate = txn.transaction_date ? new Date(txn.transaction_date) : null;
      const fromDate = filters.from ? new Date(filters.from) : null;
      const toDate = filters.to ? new Date(filters.to) : null;

      if (filters.type && txn.type !== filters.type) return false;
      if (filters.payment_method && txn.payment_method !== filters.payment_method) return false;
      if (fromDate && transactionDate && transactionDate < fromDate) return false;
      if (toDate && transactionDate && transactionDate > toDate) return false;
      if (search) {
        const haystack = [
          txn.transaction_id,
          txn.job_number,
          txn.created_by,
          txn.payment_method,
          txn.type,
          txn.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [transactions, filters]);

  return (
    <section className="app-section-card" style={{ display: "flex", flexDirection: "column", gap: "16px", ...(accentSurface ? { background: "rgba(var(--primary-rgb), 0.08)", border: "1px solid rgba(var(--primary-rgb), 0.16)" } : {}) }}>
      <header style={{ display: "grid", gridTemplateColumns: "auto minmax(280px, 1fr) auto", alignItems: "center", gap: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>Transactions</h3>
        <ToolbarRow style={{ minWidth: 0 }}>
          <SearchBar
            name="search"
            value={filters.search || ""}
            placeholder="Search transaction, job, or user"
            onChange={handleFilterChange}
            onClear={() => onFilterChange({ ...filters, search: "" })}
            style={{ flex: "1 1 240px" }}
          />
          <DropdownField
            name="type"
            value={filters.type}
            onChange={handleFilterChange}
            placeholder="All types"
            options={[{ label: "All Types", value: "", placeholder: true }, ...TRANSACTION_TYPES.map((option) => ({ label: option, value: option }))]}
            style={{ flex: "0 0 180px" }}
          />
          <DropdownField
            name="payment_method"
            value={filters.payment_method}
            onChange={handleFilterChange}
            placeholder="All methods"
            options={[{ label: "All Methods", value: "", placeholder: true }, ...PAYMENT_METHODS.map((method) => ({ label: method, value: method }))]}
            style={{ flex: "0 0 180px" }}
          />
          <div style={{ flex: "0 0 160px" }}>
            <CalendarField name="from" placeholder="From date" value={filters.from} onChange={handleFilterChange} size="sm" />
          </div>
          <div style={{ flex: "0 0 160px" }}>
            <CalendarField name="to" placeholder="To date" value={filters.to} onChange={handleFilterChange} size="sm" />
          </div>
        </ToolbarRow>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Button type="button" variant="secondary" size="sm" onClick={() => onFilterChange({ search: "", type: "", payment_method: "", from: "", to: "" })}>Clear Filters</Button>
          <Button type="button" size="sm" onClick={onExport}>Export CSV</Button>
        </div>
      </header>
      <div style={{ overflowX: "auto", overflowY: filteredTransactions.length > 10 ? "auto" : "visible", maxHeight: filteredTransactions.length > 10 ? "640px" : "none" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(var(--primary-rgb), 0.08)", color: "var(--text-primary)" }}>
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
            {!loading && filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>No transactions found for this period.</td>
              </tr>
            )}
            {!loading && filteredTransactions.map((txn) => (
              <tr
                key={txn.transaction_id}
                onMouseEnter={() => setHoveredTransactionId(txn.transaction_id)}
                onMouseLeave={() => setHoveredTransactionId((current) => (current === txn.transaction_id ? null : current))}
                style={{ borderTop: "1px solid rgba(var(--primary-rgb), 0.08)", background: hoveredTransactionId === txn.transaction_id ? "rgba(var(--primary-rgb), 0.12)" : "var(--surface)", transition: "background-color 0.18s ease" }}
              >
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
    </section>
  );
}
TransactionTable.propTypes = {
  transactions: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  filters: PropTypes.shape({ search: PropTypes.string, type: PropTypes.string, payment_method: PropTypes.string, from: PropTypes.string, to: PropTypes.string }),
  onFilterChange: PropTypes.func.isRequired,
  pagination: PropTypes.shape({ page: PropTypes.number, pageSize: PropTypes.number, total: PropTypes.number }),
  onPageChange: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  accentSurface: PropTypes.bool,
};
TransactionTable.defaultProps = {
  transactions: [],
  loading: false,
  filters: { search: "", type: "", payment_method: "", from: "", to: "" },
  pagination: { page: 1, pageSize: 20, total: 0 },
  accentSurface: false,
};
