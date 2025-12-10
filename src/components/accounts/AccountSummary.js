// file location: src/components/accounts/AccountSummary.js // identify module origin
import React from "react"; // import React to render JSX
import PropTypes from "prop-types";
const currencyFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const summaryBlueprint = [
  { key: "openCount", label: "Open Accounts", emphasize: true },
  { key: "frozenCount", label: "Frozen Accounts", emphasize: false },
  { key: "totalBalance", label: "Total Balance", emphasize: true, isCurrency: true },
  { key: "overdueInvoices", label: "Overdue Invoices", emphasize: false },
  { key: "creditExposure", label: "Credit Exposure", emphasize: false, isCurrency: true },
];
const resolveValue = (key, value) => {
  if (key.toLowerCase().includes("count")) {
    return Number(value || 0).toLocaleString();
  }
  return currencyFormatter.format(Number(value || 0));
};
export default function AccountSummary({ summary, onRefresh, showRefreshButton = true }) {
  const safeSummary = summary || {};
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--surface-light)",
        borderRadius: "16px",
        padding: "20px",
        display: "flex",
        flexWrap: "wrap",
        gap: "16px",
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          flexBasis: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "4px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.25rem",
              color: "var(--text-primary)",
            }}
          >
            Accounts Snapshot
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.9rem",
              color: "var(--text-secondary)",
            }}
          >
            Live balance and status metrics
          </p>
        </div>
        {showRefreshButton && (
          <button
            type="button"
            onClick={onRefresh}
            style={{
              padding: "10px 16px",
              borderRadius: "999px",
              border: "1px solid var(--primary)",
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        )}
      </div>
      {summaryBlueprint.map((card) => {
        const rawValue = safeSummary[card.key];
        const displayValue = card.isCurrency ? currencyFormatter.format(Number(rawValue || 0)) : resolveValue(card.key, rawValue);
        return (
          <article
            key={card.key}
            style={{
              flex: "1 1 180px",
              borderRadius: "14px",
              border: "1px solid rgba(0,0,0,0.05)",
              padding: "16px",
              background: "var(--surface-light)",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "var(--text-secondary)",
                fontSize: "0.8rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {card.label}
            </p>
            <strong
              style={{
                marginTop: "8px",
                display: "block",
                fontSize: card.emphasize ? "1.8rem" : "1.4rem",
                color: card.emphasize ? "var(--primary)" : "var(--text-primary)",
                fontWeight: card.emphasize ? 800 : 600,
              }}
            >
              {displayValue}
            </strong>
          </article>
        );
      })}
    </section>
  );
}
AccountSummary.propTypes = {
  summary: PropTypes.object,
  onRefresh: PropTypes.func,
  showRefreshButton: PropTypes.bool,
};
AccountSummary.defaultProps = {
  summary: {},
  onRefresh: undefined,
  showRefreshButton: true,
};
