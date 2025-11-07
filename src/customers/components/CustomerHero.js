// file location: src/customers/components/CustomerHero.js
import React from "react";

export default function CustomerHero({ nextVisit, lastUpdated }) {
  return (
    <section className="rounded-3xl border border-[#ffe0e0] bg-gradient-to-r from-[#d10000] via-[#ff4d4d] to-[#ff9966] p-6 text-white shadow-[0_18px_45px_rgba(209,0,0,0.25)]">
      <div className="flex flex-wrap justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.4em] text-white/70">Vehicle Health</p>
          <h2 className="mt-2 text-3xl font-semibold">Stay close to your vehicle&apos;s progress</h2>
          <p className="mt-3 text-sm text-white/85 leading-relaxed">
            Approve work, review media, and talk to the workshop without leaving this tab. Every VHC
            update is synced with your booking so you know what happens next.
          </p>
        </div>
        <div className="flex flex-col gap-4 min-w-[220px]">
          <div className="rounded-2xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur text-sm">
            <p className="text-white/80 text-xs uppercase tracking-[0.35em]">Next visit</p>
            <p className="text-lg font-semibold">{nextVisit || "Waiting to be scheduled"}</p>
          </div>
          <div className="rounded-2xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur text-sm">
            <p className="text-white/80 text-xs uppercase tracking-[0.35em]">Last update</p>
            <p className="text-lg font-semibold">{lastUpdated || "Just now"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
