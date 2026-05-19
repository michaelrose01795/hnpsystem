// file location: src/components/accounts/AccountTable.js // file path header
import React from "react"; // import React to define component
import LayerTheme from "@/components/ui/LayerTheme";
import PropTypes from "prop-types";

const columnDefinitions = [
{ key: "account_id", label: "Account ID" },
{ key: "customer_id", label: "Customer" },
{ key: "account_type", label: "Type" },
{ key: "status", label: "Status" },
{ key: "balance", label: "Balance" },
{ key: "credit_limit", label: "Credit Limit" },
{ key: "billing_name", label: "Billing Name" },
{ key: "updated_at", label: "Updated" }];

const formatCurrency = (value) => {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value || 0));
};
const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
// Status renders as a staffglobal .app-badge bubble at control (button) size.
const statusToneClass = {
  active: "app-badge--success",
  frozen: "app-badge--warning",
  closed: "app-badge--danger"
};
const renderStatusBadge = (status) => {
  const normalized = (status || "").toLowerCase();
  const tone = statusToneClass[normalized] || "app-badge--neutral";
  return (
    <span className={`app-badge app-badge--uppercase ${tone}`}>
      {status || "Unknown"}
    </span>);

};
export default function AccountTable({
  accounts,
  loading,
  onSortChange,
  sortState,
  onSelectAccount,
  selectedAccountId,
  toolbar
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
    <LayerTheme as="section" sectionKey="accounts-ledger-table-card" sectionType="content-card" parentKey="accounts-ledger-table" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Filter toolbar (when supplied by the consumer) sits at the top of the card. */}
      {toolbar}
      <div
        className="app-table-shell-scroll"
        style={{ overflowX: "auto", overflowY: accounts.length > 10 ? "auto" : "visible", maxHeight: accounts.length > 10 ? "640px" : "none" }}>
        <table className="app-data-table app-table-shell app-table-shell--with-headings" style={{ minWidth: "720px" }}>
          <thead>
          <tr>
            {columnDefinitions.map((column) =>
              <th
                key={column.key}
                onClick={() => handleSort(column.key)}
                style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>

                {column.label} {sortedIcon(column.key)}
              </th>
              )}
            <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              Actions
            </th>
          </tr>
          </thead>
          <tbody>
            {loading &&
            <tr>
                <td
                colSpan={columnDefinitions.length + 1}
                style={{
                  padding: "28px",
                  textAlign: "center",
                  color: "var(--text-1)"
                }}>

                  Loading accounts…
                </td>
              </tr>
            }
            {!loading && accounts.length === 0 &&
            <tr>
                <td
                colSpan={columnDefinitions.length + 1}
                style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "var(--text-1)"
                }}>

                  No accounts match your filters.
                </td>
              </tr>
            }
            {!loading && accounts.map((account) => {
              const isSelected = selectedAccountId && selectedAccountId === account.account_id;
              const isHovered = hoveredAccountId === account.account_id;
              return (
                <tr
                  key={account.account_id}
                  onMouseEnter={() => setHoveredAccountId(account.account_id)}
                  onMouseLeave={() => setHoveredAccountId((current) => current === account.account_id ? null : current)}
                  style={{
                    background: isSelected ? "rgba(var(--primary-rgb), 0.16)" : isHovered ? "rgba(var(--primary-rgb), 0.12)" : "transparent",
                    transition: "background-color 0.18s ease"
                  }}>

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
                          fontWeight: column.key === "account_id" ? 600 : 400,
                          whiteSpace: column.key === "billing_name" ? "normal" : "nowrap"
                        }}>

                        {content || "—"}
                      </td>);

                  })}
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
                      {/* In-row action buttons — .app-table-action-btn locks height to
                          --table-action-btn-height (32px) per the staffglobal table style. */}
                      <button
                        type="button"
                        className="app-table-action-btn app-table-action-btn--ghost"
                        onClick={() => onSelectAccount && onSelectAccount(account, "view")}>
                        View
                      </button>
                      <button
                        type="button"
                        className="app-table-action-btn"
                        onClick={() => onSelectAccount && onSelectAccount(account, "edit")}>
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>);

            })}
          </tbody>
        </table>
      </div>
    </LayerTheme>);

}
AccountTable.propTypes = {
  accounts: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  pagination: PropTypes.shape({
    page: PropTypes.number,
    pageSize: PropTypes.number,
    total: PropTypes.number
  }),
  onPageChange: PropTypes.func,
  onSortChange: PropTypes.func,
  sortState: PropTypes.shape({
    field: PropTypes.string,
    direction: PropTypes.oneOf(["asc", "desc"])
  }),
  onSelectAccount: PropTypes.func,
  selectedAccountId: PropTypes.string,
  toolbar: PropTypes.node
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
  toolbar: null
};
