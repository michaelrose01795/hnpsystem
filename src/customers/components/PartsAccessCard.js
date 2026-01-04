// file location: src/customers/components/PartsAccessCard.js
import React from "react";

export default function PartsAccessCard({ parts = [] }) {
  return (
    <section className="rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] p-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--primary)] px-4 py-3 text-white">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white">Parts & accessories</p>
          <h3 className="text-xl font-semibold text-white">Compatible with my cars</h3>
        </div>
        <button className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20">
          Browse catalogue
        </button>
      </header>
      <div className="mt-4 space-y-3">
        {parts.map((part) => (
          <div
            key={part.id}
            className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-4 text-sm text-[var(--text-secondary)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{part.title}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Applies to: {part.appliesTo.join(", ")}
                </p>
              </div>
              <span className="text-base font-semibold text-[var(--text-primary)]">
                {part.price}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
              <span>{part.availability}</span>
              <button className="rounded-full border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-1 font-semibold text-[var(--primary-dark)]">
                Request quote
              </button>
            </div>
          </div>
        ))}
        {parts.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--surface-light)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
            We will load compatible parts once your vehicle is connected to the portal.
          </p>
        )}
      </div>
    </section>
  );
}
