// file location: src/features/customerPortal/components/PaymentPlansCard.js
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

function PlanFact({ label, value }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: 0,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.65rem",
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: "var(--text-1)",
          opacity: 0.7,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--text-1)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

export default function PaymentPlansCard({ paymentPlans = [] }) {
  return (
    <LayerSurface
      as="section"
      sectionKey="customer-payment-plans"
      sectionType="content-card"
      radius="var(--page-card-radius)"
      padding="var(--section-card-padding)"
      gap="var(--space-4)"
    >
      <header
        style={{
          background: "var(--primary)",
          color: "var(--text-2)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.3em",
            color: "var(--text-2)",
            opacity: 0.9,
          }}
        >
          Payment plans
        </p>
        <h3
          style={{
            margin: 0,
            fontSize: "1.15rem",
            fontWeight: 600,
            color: "var(--text-2)",
          }}
        >
          Manage ongoing agreements
        </h3>
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        {paymentPlans.map((plan) => (
          <LayerTheme
            key={plan.id}
            radius="var(--radius-md)"
            padding="var(--space-4)"
            gap="var(--space-3)"
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "var(--text-1)",
                  }}
                >
                  {plan.name}
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "0.75rem",
                    color: "var(--text-1)",
                    opacity: 0.75,
                  }}
                >
                  {plan.description}
                </p>
              </div>
              <span
                className={
                  plan.status === "active"
                    ? "app-badge app-badge--accent-soft"
                    : "app-badge app-badge--danger-soft"
                }
              >
                {plan.status}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gap: "var(--space-2)",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
              }}
            >
              <PlanFact label="Total" value={`£${plan.totalAmount.toFixed(2)}`} />
              <PlanFact label="Balance due" value={`£${plan.balanceDue.toFixed(2)}`} />
              <PlanFact
                label="Next payment"
                value={`${plan.nextPaymentDate} (${plan.frequency})`}
              />
            </div>
          </LayerTheme>
        ))}
        {paymentPlans.length === 0 && (
          <p
            style={{
              margin: 0,
              padding: "var(--space-4) var(--space-3)",
              textAlign: "center",
              fontSize: "0.875rem",
              color: "var(--text-1)",
              background: "var(--theme)",
              borderRadius: "var(--radius-md)",
            }}
          >
            No payment plans are active on your account.
          </p>
        )}
      </div>
    </LayerSurface>
  );
}
