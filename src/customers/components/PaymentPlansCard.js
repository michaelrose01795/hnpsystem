// file location: src/customers/components/PaymentPlansCard.js
import React from "react";

export default function PaymentPlansCard({ paymentPlans = [] }) {
  return (
    <section className="rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] p-5">
      <header className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-white">
        <p className="text-xs uppercase tracking-[0.35em] text-white">Payment plans</p>
        <h3 className="text-xl font-semibold text-white">Manage ongoing agreements</h3>
      </header>

      <div className="mt-4 space-y-3 text-sm">
        {paymentPlans.map((plan) => (
          <div
            key={plan.id}
            className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-4 text-[var(--text-secondary)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{plan.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">{plan.description}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  plan.status === "active"
                    ? "bg-[var(--info-surface)] text-[var(--info-dark)]"
                    : "bg-[var(--danger-surface)] text-[var(--danger)]"
                }`}
              >
                {plan.status}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
              <p>
                <span className="text-[var(--text-secondary)]">Total:</span> £{plan.totalAmount.toFixed(2)}
              </p>
              <p>
                <span className="text-[var(--text-secondary)]">Balance due:</span> £{plan.balanceDue.toFixed(2)}
              </p>
              <p>
                <span className="text-[var(--text-secondary)]">Next payment:</span>{" "}
                {plan.nextPaymentDate} ({plan.frequency})
              </p>
            </div>
          </div>
        ))}
        {paymentPlans.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--surface-light)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
            No payment plans are active on your account.
          </p>
        )}
      </div>
    </section>
  );
}
