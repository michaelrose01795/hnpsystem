// file location: src/features/customerPortal/components/OutstandingInvoicesCard.js
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

export default function OutstandingInvoicesCard({ invoices = [] }) {
  const handlePayInvoice = (invoice) => {
    if (!invoice.paymentLink) return;
    window.open(invoice.paymentLink, "_blank", "noopener,noreferrer");
  };

  const total = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

  return (
    <LayerSurface
      as="section"
      sectionKey="customer-outstanding-invoices"
      sectionType="content-card"
      radius="var(--page-card-radius)"
      padding="var(--section-card-padding)"
      gap="var(--space-4)"
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          background: "var(--primary)",
          color: "var(--text-2)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
        }}
      >
        <div>
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
            Outstanding invoices
          </p>
          <h3
            style={{
              margin: 0,
              fontSize: "1.15rem",
              fontWeight: 600,
              color: "var(--text-2)",
            }}
          >
            Pay securely online
          </h3>
        </div>
        {invoices.length > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 10px",
              borderRadius: "var(--radius-pill)",
              background: "rgba(var(--text-2-rgb), 0.18)",
              color: "var(--text-2)",
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
            }}
          >
            Total £{total.toFixed(2)}
          </span>
        )}
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        {invoices.map((invoice) => (
          <LayerTheme
            key={invoice.id}
            radius="var(--radius-md)"
            padding="var(--space-4)"
            gap="var(--space-3)"
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
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
                  Invoice #{String(invoice.id).slice(0, 8)}
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "0.75rem",
                    color: "var(--text-1)",
                    opacity: 0.75,
                  }}
                >
                  Job: {invoice.jobId || "N/A"} · Issued {invoice.createdAt}
                </p>
              </div>
              <span
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "var(--text-accent)",
                }}
              >
                £{invoice.total.toFixed(2)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.75rem",
                  color: "var(--text-1)",
                  opacity: 0.75,
                }}
              >
                VAT included: £{invoice.vat.toFixed(2)}
              </p>
              <button
                type="button"
                onClick={() => handlePayInvoice(invoice)}
                disabled={!invoice.paymentLink}
                className="app-btn app-btn--primary"
              >
                {invoice.paymentLink ? "Pay now" : "Payment link unavailable"}
              </button>
            </div>
            {!invoice.paymentLink && (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.7rem",
                  color: "var(--text-1)",
                  opacity: 0.7,
                }}
              >
                Please contact the service team to request a new payment link.
              </p>
            )}
          </LayerTheme>
        ))}
        {invoices.length === 0 && (
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
            Great news! You have no outstanding invoices.
          </p>
        )}
      </div>
    </LayerSurface>
  );
}
