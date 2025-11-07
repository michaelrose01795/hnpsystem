// file location: src/customers/components/MessagingHub.js
import React from "react";

export default function MessagingHub({ contacts = [] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-sky-500">Message centre</p>
          <h3 className="text-xl font-semibold text-slate-900">Talk to the right team</h3>
        </div>
        <span className="text-xs font-semibold text-slate-400">All chats stay attached to your job</span>
      </header>

      <div className="mt-4 space-y-3">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{contact.label}</p>
              <p className="text-xs text-slate-500">{contact.name}</p>
            </div>
            <button className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-red-700">
              Message
            </button>
          </div>
        ))}
        {contacts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Select a job card or VHC to start a conversation with the team.
          </p>
        )}
      </div>
    </section>
  );
}
