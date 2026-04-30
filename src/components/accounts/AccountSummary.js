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

export default function AccountSummary({ summary }) {
  const safeSummary = summary || {};

  return (
    <section className="app-section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Overview
          </p>
          <h2 style={{ margin: "6px 0 0", fontSize: "1.2rem", color: "var(--text-1)" }}>Account Snapshot</h2>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
      {summaryBlueprint.map((card) => {
        const rawValue = safeSummary[card.key];
        const displayValue = card.isCurrency ? currencyFormatter.format(Number(rawValue || 0)) : resolveValue(card.key, rawValue);
        return (
          <article
            key={card.key}
            style={{
              borderRadius: "var(--control-radius)",
              border: "1px solid rgba(var(--primary-rgb), 0.08)",
              padding: "16px",
              background: card.emphasize ? "var(--theme)" : "var(--surface-2, var(--surface))",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "var(--text-1)",
                fontSize: "0.8rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {card.label}
            </p>
            <strong
              style={{
                marginTop: "10px",
                display: "block",
                fontSize: card.emphasize ? "1.8rem" : "1.4rem",
                color: card.emphasize ? "var(--primary)" : "var(--text-1)",
                fontWeight: card.emphasize ? 800 : 600,
              }}
            >
              {displayValue}
            </strong>
          </article>
        );
      })}
      </div>
    </section>
  );
}

AccountSummary.propTypes = {
  summary: PropTypes.object,
};

AccountSummary.defaultProps = {
  summary: {},
};
