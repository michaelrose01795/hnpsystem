// file location: src/customers/components/PartsAccessCard.js
import React from "react";

export default function PartsAccessCard({ parts = [] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-indigo-500">Parts & accessories</p>
          <h3 className="text-xl font-semibold text-slate-900">Compatible with my cars</h3>
        </div>
        <button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
          Browse catalogue
        </button>
      </header>
      <div className="mt-4 space-y-3">
        {parts.map((part) => (
          <div
            key={part.id}
            className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm text-slate-700"
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
              <button className="rounded-full bg-white px-3 py-1 font-semibold text-slate-600 shadow-sm">
                Request quote
              </button>
            </div>
          </div>
        ))}
        {parts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            We will load compatible parts once your vehicle is connected to the portal.
          </p>
        )}
      </div>
    </section>
  );
}
