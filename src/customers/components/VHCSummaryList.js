// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/components/VHCSummaryList.js
import React from "react";

export default function VHCSummaryList({ summaries = [], vehicles = [] }) {
  const vehicleLookup = React.useMemo(
    () => Object.fromEntries(vehicles.map((vehicle) => [vehicle.id || vehicle.reg, vehicle])),
    [vehicles]
  );
  return (
    <section className="rounded-3xl border border-[var(--surface-light)] bg-white p-5 shadow-[0_12px_34px_rgba(var(--primary-rgb),0.08)]">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--primary)]">VHC status</p>
          <h3 className="text-xl font-semibold text-slate-900">Vehicle health checks</h3>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
          Connected to workshop
        </span>
      </header>

      <div className="mt-4 space-y-3">
        {summaries.map((summary) => {
          const vehicle = vehicleLookup[summary.vehicleId];
          return (
            <div
              key={summary.id}
              className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] px-4 py-4 text-sm text-slate-700 shadow-[0_6px_20px_rgba(var(--primary-rgb),0.06)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {vehicle?.makeModel || "Vehicle"} • {vehicle?.reg}
                  </p>
                  <p className="text-xs text-slate-500">
                    Shared on {summary.createdAt} · {summary.status}
                  </p>
                </div>
                <button className="rounded-full border border-[var(--surface-light)] px-4 py-2 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--surface-light)]">
                  View VHC
                </button>
              </div>
              <div className="mt-3 grid gap-3 text-xs md:grid-cols-3">
                <p>
                  <span className="text-rose-600 font-semibold">{summary.redItems}</span> critical
                  red items
                </p>
                <p>
                  <span className="text-amber-500 font-semibold">{summary.amberItems}</span> amber
                  advisories
                </p>
                <p>{summary.media} photos &amp; videos attached</p>
              </div>
            </div>
          );
        })}
        {summaries.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--surface-light)] px-4 py-8 text-center text-sm text-slate-500">
            Your vehicle health checks will appear here once the workshop sends them to you.
          </p>
        )}
      </div>
    </section>
  );
}
