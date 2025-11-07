// file location: src/customers/components/CustomerHero.js
import React from "react";

export default function CustomerHero({ nextVisit, lastUpdated }) {
  return (
    <section className="mb-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-500 to-orange-400 p-6 text-white shadow-lg">
      <p className="text-xs uppercase tracking-[0.4em] text-white/70">Customer Portal</p>
      <h2 className="mt-2 text-3xl font-semibold">Stay close to your vehicle&apos;s health</h2>
      <p className="mt-3 max-w-2xl text-sm text-white/90">
        Review vehicle health checks, message the team, and approve parts from a single place. We
        keep everything tied to your booking so you always know what happens next.
      </p>
      <div className="mt-6 flex flex-wrap gap-6 text-sm font-semibold">
        <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
          <p className="text-white/70">Next visit</p>
          <p className="text-lg">{nextVisit || "Waiting to be scheduled"}</p>
        </div>
        <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
          <p className="text-white/70">Last update</p>
          <p className="text-lg">{lastUpdated || "Just now"}</p>
        </div>
      </div>
    </section>
  );
}
