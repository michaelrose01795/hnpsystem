// file location: src/customers/components/PaymentPlansCard.js
import React from "react";

export default function PaymentPlansCard({ paymentPlans = [] }) {
  return (
    <section className="rounded-3xl border border-[#ffe0e0] bg-white p-5 shadow-[0_12px_34px_rgba(209,0,0,0.08)]">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">Payment plans</p>
          <h3 className="text-xl font-semibold text-slate-900">Manage ongoing agreements</h3>
        </div>
      </header>

      <div className="mt-4 space-y-3 text-sm">
        {paymentPlans.map((plan) => (
          <div
            key={plan.id}
            className="rounded-2xl border border-[#ffe5e5] bg-[#fffafa] px-4 py-4 text-slate-700 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                <p className="text-xs text-slate-500">{plan.description}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  plan.status === "active"
                    ? "bg-[#ecfeff] text-[#0f766e]"
                    : "bg-[#ffe9e9] text-[#b91c1c]"
                }`}
              >
                {plan.status}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
              <p>
                <span className="text-slate-500">Total:</span> £{plan.totalAmount.toFixed(2)}
              </p>
              <p>
                <span className="text-slate-500">Balance due:</span> £{plan.balanceDue.toFixed(2)}
              </p>
              <p>
                <span className="text-slate-500">Next payment:</span>{" "}
                {plan.nextPaymentDate} ({plan.frequency})
              </p>
            </div>
          </div>
        ))}
        {paymentPlans.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#ffd0d0] px-4 py-8 text-center text-sm text-slate-500">
            No payment plans are active on your account.
          </p>
        )}
      </div>
    </section>
  );
}
