// file location: src/customers/components/MessagingHub.js
import React from "react";

export default function MessagingHub({ contacts = [] }) {
  return (
    <section className="rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] p-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--primary)] px-4 py-3 text-white">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white">Message centre</p>
          <h3 className="text-xl font-semibold text-white">Talk to the right team</h3>
        </div>
        <span className="rounded-full border border-white/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
          All chats stay attached to your job
        </span>
      </header>

      <div className="mt-4 space-y-3">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] px-4 py-4 text-sm"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{contact.label}</p>
              <p className="text-xs text-[var(--text-secondary)]">{contact.name}</p>
            </div>
            <button className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--primary-dark)]">
              Message
            </button>
          </div>
        ))}
        {contacts.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--surface-light)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
            Select a job card or VHC to start a conversation with the team.
          </p>
        )}
      </div>
    </section>
  );
}
