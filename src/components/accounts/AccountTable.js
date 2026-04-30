// file location: src/components/accounts/AccountTable.js // file path header
import React from "react"; // import React to define component
import PropTypes from "prop-types";
import Button from "@/components/ui/Button";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

const columnDefinitions = [
  { key: "account_id", label: "Account ID" },
  { key: "customer_id", label: "Customer" },
  { key: "account_type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "balance", label: "Balance" },
  { key: "credit_limit", label: "Credit Limit" },
  { key: "billing_name", label: "Billing Name" },
  { key: "updated_at", label: "Updated" },
];
const formatCurrency = (value) => {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value || 0));
};
const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const statusStyles = {
  active: { background: "rgba(var(--success-rgb), 0.15)", color: "#047857" },
  frozen: { background: "rgba(var(--warning-rgb), 0.18)", color: "var(--warning-text)" },
  closed: { background: "rgba(var(--danger-rgb), 0.15)", color: "var(--danger-dark)" },
};
const renderStatusBadge = (status) => {
  const normalized = (status || "").toLowerCase();
  const palette = statusStyles[normalized] || statusStyles.active;
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        fontSize: "0.75rem",
        fontWeight: 700,
        textTransform: "uppercase",
        ...palette,
      }}
    >
      {status || "Unknown"}
    </span>
  );
};
export default function AccountTable({
  accounts,
  loading,
  pagination,
  onPageChange,
  onSortChange,
  sortState,
  onSelectAccount,
  selectedAccountId,
  canExport,
  canCreateAccount,
  onExport,
  onCreateAccount,
}) {
  const [hoveredAccountId, setHoveredAccountId] = React.useState(null);

  const sortedIcon = (columnKey) => {
    if (!sortState || sortState.field !== columnKey) return "";
    return sortState.direction === "asc" ? "▲" : "▼";
  };

  const handleSort = (columnKey) => {
    if (typeof onSortChange !== "function") return;
    if (sortState && sortState.field === columnKey) {
      const toggledDir = sortState.direction === "asc" ? "desc" : "asc";
      onSortChange({ field: columnKey, direction: toggledDir });
      return;
    }
    onSortChange({ field: columnKey, direction: "asc" });
  };

  return (
    <DevLayoutSection as="section" sectionKey="accounts-ledger-table-card" sectionType="content-card" parentKey="accounts-ledger-table" className="app-section-card" style={{ display: "flex", flexDirection: "column", gap: "16px", background: "var(--theme)", border: "1px solid rgba(var(--primary-rgb), 0.16)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-1)" }}>Customer Accounts</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={{ color: "var(--text-1)", fontSize: "0.92rem" }}>
            {pagination.total || 0} records
          </span>
          {canExport && (
            <Button type="button" variant="secondary" onClick={onExport}>
              Export
            </Button>
          )}
          {canCreateAccount && (
            <Button type="button" onClick={onCreateAccount}>
              New Account
            </Button>
          )}
        </div>
      </div>
      <div style={{ overflowX: "auto", overflowY: accounts.length > 10 ? "auto" : "visible", maxHeight: accounts.length > 10 ? "640px" : "none" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(var(--primary-rgb), 0.08)", color: "var(--text-1)" }}>
          <tr>
            {columnDefinitions.map((column) => (
              <th
                key={column.key}
                onClick={() => handleSort(column.key)}
                style={{
                  padding: "13px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.85rem",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {column.label} {sortedIcon(column.key)}
              </th>
            ))}
            <th
              style={{
                padding: "13px 12px",
                textAlign: "right",
                fontSize: "0.85rem",
                whiteSpace: "nowrap",
              }}
            >
              Actions
            </th>
          </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={columnDefinitions.length + 1}
                  style={{
                    padding: "28px",
                    textAlign: "center",
                    color: "var(--text-1)",
                  }}
                >
                  Loading accounts…
                </td>
              </tr>
            )}
            {!loading && accounts.length === 0 && (
              <tr>
                <td
                  colSpan={columnDefinitions.length + 1}
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    color: "var(--text-1)",
                  }}
                >
                  No accounts match your filters.
                </td>
              </tr>
            )}
            {!loading && accounts.map((account) => {
              const isSelected = selectedAccountId && selectedAccountId === account.account_id;
              const isHovered = hoveredAccountId === account.account_id;
              return (
                <tr
                  key={account.account_id}
                  onMouseEnter={() => setHoveredAccountId(account.account_id)}
                  onMouseLeave={() => setHoveredAccountId((current) => (current === account.account_id ? null : current))}
                  style={{
                    background: isSelected ? "rgba(var(--primary-rgb), 0.16)" : isHovered ? "rgba(var(--primary-rgb), 0.12)" : "var(--surface)",
                    borderTop: "1px solid rgba(var(--primary-rgb), 0.08)",
                    transition: "background-color 0.18s ease",
                  }}
                >
                  {columnDefinitions.map((column) => {
                    const value = account[column.key];
                    let content = value;
                    if (column.key === "status") {
                      content = renderStatusBadge(value);
                    } else if (column.key === "balance" || column.key === "credit_limit") {
                      content = formatCurrency(value);
                    } else if (column.key === "updated_at") {
                      content = formatDate(value);
                    }

                    return (
                      <td
                        key={column.key}
                        style={{
                          padding: "14px 12px",
                          fontWeight: column.key === "account_id" ? 600 : 400,
                          whiteSpace: column.key === "billing_name" ? "normal" : "nowrap",
                        }}
                      >
                        {content || "—"}
                      </td>
                    );
                  })}
                  <td style={{ padding: "14px 12px", textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
                      <Button type="button" variant="ghost" size="xs" onClick={() => onSelectAccount && onSelectAccount(account, "view")}>
                        View
                      </Button>
                      <Button type="button" variant="secondary" size="xs" onClick={() => onSelectAccount && onSelectAccount(account, "edit")}>
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DevLayoutSection>
  );
}
AccountTable.propTypes = {
  accounts: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  pagination: PropTypes.shape({
    page: PropTypes.number,
    pageSize: PropTypes.number,
    total: PropTypes.number,
  }),
  onPageChange: PropTypes.func,
  onSortChange: PropTypes.func,
  sortState: PropTypes.shape({
    field: PropTypes.string,
    direction: PropTypes.oneOf(["asc", "desc"]),
  }),
  onSelectAccount: PropTypes.func,
  selectedAccountId: PropTypes.string,
  canExport: PropTypes.bool,
  canCreateAccount: PropTypes.bool,
  onExport: PropTypes.func,
  onCreateAccount: PropTypes.func,
};
AccountTable.defaultProps = {
  accounts: [],
  loading: false,
  pagination: { page: 1, pageSize: 20, total: 0 },
  onPageChange: () => {},
  onSortChange: () => {},
  sortState: { field: "updated_at", direction: "desc" },
  onSelectAccount: () => {},
  selectedAccountId: null,
  canExport: false,
  canCreateAccount: false,
  onExport: () => {},
  onCreateAccount: () => {},
};
