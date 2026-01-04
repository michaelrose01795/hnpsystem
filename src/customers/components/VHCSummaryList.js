// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/components/VHCSummaryList.js
import React from "react";

export default function VHCSummaryList({ summaries = [], vehicles = [] }) {
  const vehicleLookup = React.useMemo(
    () => Object.fromEntries(vehicles.map((vehicle) => [vehicle.id || vehicle.reg, vehicle])),
    [vehicles]
  );
  return (
    <section className="rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] p-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--primary)] px-4 py-3 text-white">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white">VHC status</p>
          <h3 className="text-xl font-semibold text-white">Vehicle health checks</h3>
        </div>
        <span className="rounded-full border border-white/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
          Connected to workshop
        </span>
      </header>

      <div className="mt-4 space-y-3">
        {summaries.map((summary) => {
          const vehicle = vehicleLookup[summary.vehicleId];
          return (
            <div
              key={summary.id}
              className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-4 text-sm text-[var(--text-secondary)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {vehicle?.makeModel || "Vehicle"} • {vehicle?.reg}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Shared on {summary.createdAt} · {summary.status}
                  </p>
                </div>
                <button className="rounded-full border border-[var(--surface-light)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--surface-muted)]">
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
          <p className="rounded-2xl border border-dashed border-[var(--surface-light)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
            Your vehicle health checks will appear here once the workshop sends them to you.
          </p>
        )}
      </div>
    </section>
  );
}
