// file location: src/customers/components/OutstandingInvoicesCard.js
import React from "react";

export default function OutstandingInvoicesCard({ invoices = [] }) {
  const handlePayInvoice = (invoice) => {
    if (!invoice.paymentLink) return;
    window.open(invoice.paymentLink, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="rounded-3xl border border-[var(--surface-light)] bg-white p-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--primary)]">Outstanding invoices</p>
          <h3 className="text-xl font-semibold text-slate-900">Pay securely online</h3>
        </div>
      </header>

      <div className="mt-4 space-y-3 text-sm">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="rounded-2xl border border-[var(--surface-light)] bg-[var(--background)] px-4 py-4 text-slate-700 "
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Invoice #{invoice.id.slice(0, 8)}</p>
                <p className="text-xs text-slate-500">
                  Job: {invoice.jobId || "N/A"} · Issued {invoice.createdAt}
                </p>
              </div>
              <span className="text-base font-semibold text-slate-900">
                £{invoice.total.toFixed(2)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
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
              <p className="mt-2 text-[11px] text-slate-400">
                Please contact the service team to request a new payment link.
              </p>
            )}
          </div>
        ))}
        {invoices.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--surface-light)] px-4 py-8 text-center text-sm text-slate-500">
            Great news! You have no outstanding invoices.
          </p>
        )}
      </div>
    </section>
  );
}
