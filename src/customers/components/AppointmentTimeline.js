// file location: src/customers/components/AppointmentTimeline.js
import React from "react";

export default function AppointmentTimeline({ events = [] }) {
  return (
    <section className="rounded-3xl border border-[var(--surface-light)] bg-white p-5">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--primary)]">Booking timeline</p>
        <h3 className="text-xl font-semibold text-slate-900">What&apos;s happened so far</h3>
      </header>
      <div className="mt-6 border-l-2 border-dashed border-[var(--surface-light)] pl-6 space-y-6">
        {events.map((event) => (
          <div key={event.id} className="relative">
            <div className="absolute -left-8 top-1 h-4 w-4 rounded-full border-4 border-white bg-[var(--primary)]"  />
            <p className="text-xs uppercase tracking-wide text-slate-400">{event.timestamp}</p>
            <p className="text-base font-semibold text-slate-900">{event.label}</p>
            <p className="text-sm text-slate-600">{event.description}</p>
          </div>
        ))}
        {events.length === 0 && (
          <p className="text-sm text-slate-500">
            Your booking history will appear here once we start working on your car.
          </p>
        )}
      </div>
    </section>
  );
}
