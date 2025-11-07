// file location: src/customers/components/MessagingHub.js
import React from "react";

export default function MessagingHub({ contacts = [] }) {
  return (
    <section className="rounded-3xl border border-[#ffe0e0] bg-white p-5 shadow-[0_12px_34px_rgba(209,0,0,0.08)]">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">Message centre</p>
          <h3 className="text-xl font-semibold text-slate-900">Talk to the right team</h3>
        </div>
        <span className="text-xs font-semibold text-[#d10000]">All chats stay attached to your job</span>
      </header>

      <div className="mt-4 space-y-3">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ffe5e5] bg-[#fffafa] px-4 py-4 text-sm shadow-[0_6px_20px_rgba(209,0,0,0.06)]"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{contact.label}</p>
              <p className="text-xs text-slate-500">{contact.name}</p>
            </div>
            <button className="rounded-full bg-[#d10000] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#b50d0d]">
              Message
            </button>
          </div>
        ))}
        {contacts.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#ffd0d0] px-4 py-8 text-center text-sm text-slate-500">
            Select a job card or VHC to start a conversation with the team.
          </p>
        )}
      </div>
    </section>
  );
}
