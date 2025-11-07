// file location: src/customers/components/PartsAccessCard.js
import React from "react";

export default function PartsAccessCard({ parts = [] }) {
  return (
    <section className="rounded-3xl border border-[#ffe0e0] bg-white p-5 shadow-[0_12px_34px_rgba(209,0,0,0.08)]">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">Parts & accessories</p>
          <h3 className="text-xl font-semibold text-slate-900">Compatible with my cars</h3>
        </div>
        <button className="rounded-full border border-[#ffd0d0] px-4 py-2 text-xs font-semibold text-[#a00000] hover:bg-[#fff5f5]">
          Browse catalogue
        </button>
      </header>
      <div className="mt-4 space-y-3">
        {parts.map((part) => (
          <div
            key={part.id}
            className="rounded-2xl border border-[#ffe5e5] bg-[#fffafa] px-4 py-4 text-sm text-slate-700 shadow-[0_6px_20px_rgba(209,0,0,0.06)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{part.title}</p>
                <p className="text-xs text-slate-500">Applies to: {part.appliesTo.join(", ")}</p>
              </div>
              <span className="text-base font-semibold text-slate-900">{part.price}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>{part.availability}</span>
              <button className="rounded-full bg-white px-3 py-1 font-semibold text-[#a00000] shadow-sm">
                Request quote
              </button>
            </div>
          </div>
        ))}
        {parts.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#ffd0d0] px-4 py-8 text-center text-sm text-slate-500">
            We will load compatible parts once your vehicle is connected to the portal.
          </p>
        )}
      </div>
    </section>
  );
}
