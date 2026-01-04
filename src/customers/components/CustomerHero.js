// file location: src/customers/components/CustomerHero.js
import React from "react";

export default function CustomerHero({ nextVisit, lastUpdated }) {
  return (
    <section className="rounded-3xl border border-[var(--surface-light)] bg-[var(--primary)] p-6 text-white">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white">Vehicle Health</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">
            Stay close to your vehicle&apos;s progress
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white">
            Approve work, review media, and keep in touch with the workshop. Every VHC update is
            synced with your booking so you know what happens next.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-2xl border border-white/40 bg-white/10 px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-[0.35em] text-white">Next visit</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {nextVisit || "No visit scheduled"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/40 bg-white/10 px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-[0.35em] text-white">Last update</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {lastUpdated || "No recent updates"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
