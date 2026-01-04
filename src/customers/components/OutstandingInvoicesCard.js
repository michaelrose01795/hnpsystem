// file location: src/customers/components/OutstandingInvoicesCard.js
import React from "react";

export default function OutstandingInvoicesCard({ invoices = [] }) {
  const handlePayInvoice = (invoice) => {
    if (!invoice.paymentLink) return;
    window.open(invoice.paymentLink, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] p-5">
      <header className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-white">
        <p className="text-xs uppercase tracking-[0.35em] text-white">Outstanding invoices</p>
        <h3 className="text-xl font-semibold text-white">Pay securely online</h3>
      </header>

      <div className="mt-4 space-y-3 text-sm">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-4 text-[var(--text-secondary)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Invoice #{invoice.id.slice(0, 8)}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Job: {invoice.jobId || "N/A"} · Issued {invoice.createdAt}
                </p>
              </div>
              <span className="text-base font-semibold text-[var(--text-primary)]">
                £{invoice.total.toFixed(2)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
              <p>VAT included: £{invoice.vat.toFixed(2)}</p>
              <button
                onClick={() => handlePayInvoice(invoice)}
                disabled={!invoice.paymentLink}
                className="rounded-full border border-[var(--surface-light)] bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--danger)] disabled:text-white/70"
              >
                {invoice.paymentLink ? "Pay now" : "Payment link unavailable"}
              </button>
            </div>
            {!invoice.paymentLink && (
              <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                Please contact the service team to request a new payment link.
              </p>
            )}
          </div>
        ))}
        {invoices.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--surface-light)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
            Great news! You have no outstanding invoices.
          </p>
        )}
      </div>
    </section>
  );
}
