// file location: src/components/accounts/AccountTable.js // file path header
import React from "react"; // import React to define component
import PropTypes from "prop-types";
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
        borderRadius: "999px",
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
export default function AccountTable({ accounts, loading, pagination, onPageChange, onSortChange, sortState, onSelectAccount, selectedAccountId }) {
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
    <div
      style={{
        borderRadius: "16px",
        border: "1px solid var(--surface-light)",
        background: "var(--surface)",
        boxShadow: "none",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead
          style={{
            background: "var(--primary)",
            color: "white",
          }}
        >
          <tr>
            {columnDefinitions.map((column) => (
              <th
                key={column.key}
                onClick={() => handleSort(column.key)}
                style={{
                  padding: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.85rem",
                  userSelect: "none",
                }}
              >
                {column.label} {sortedIcon(column.key)}
              </th>
            ))}
            <th
              style={{
                padding: "12px",
                textAlign: "right",
                fontSize: "0.85rem",
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
                  padding: "20px",
                  textAlign: "center",
                  color: "var(--text-secondary)",
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
                  color: "var(--text-secondary)",
                }}
              >
                No accounts match your filters.
              </td>
            </tr>
          )}
          {!loading && accounts.map((account) => {
            const isSelected = selectedAccountId && selectedAccountId === account.account_id;
            return (
              <tr
                key={account.account_id}
                style={{
                  background: isSelected ? "rgba(var(--primary-rgb),0.05)" : "transparent",
                  borderTop: "1px solid rgba(0,0,0,0.04)",
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
                      }}
                    >
                      {content || "—"}
                    </td>
                  );
                })}
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectAccount && onSelectAccount(account, "view")}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--primary)",
                      fontWeight: 600,
                      marginRight: "12px",
                      cursor: "pointer",
                    }}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectAccount && onSelectAccount(account, "edit")}
                    style={{
                      border: "1px solid var(--primary)",
                      background: "rgba(var(--primary-rgb),0.08)",
                      color: "var(--primary)",
                      fontWeight: 600,
                      borderRadius: "8px",
                      padding: "6px 12px",
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px",
        }}
      >
        <span
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.9rem",
          }}
        >
          Page {pagination.page} of {Math.max(1, Math.ceil((pagination.total || 0) / pagination.pageSize))}
        </span>
        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
            disabled={pagination.page <= 1}
            style={{
              padding: "8px 14px",
              borderRadius: "999px",
              border: "1px solid var(--surface-light)",
              background: pagination.page <= 1 ? "var(--surface-light)" : "var(--surface)",
              color: "var(--text-secondary)",
              cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
            }}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize)}
            style={{
              padding: "8px 14px",
              borderRadius: "999px",
              border: "1px solid var(--surface-light)",
              background: pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize) ? "var(--surface-light)" : "var(--surface)",
              color: "var(--text-secondary)",
              cursor: pagination.page >= Math.ceil((pagination.total || 0) / pagination.pageSize) ? "not-allowed" : "pointer",
            }}
          >
            Next
          </button>
        </div>
      </footer>
    </div>
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
};
