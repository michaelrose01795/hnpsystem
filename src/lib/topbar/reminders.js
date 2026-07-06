// file location: src/lib/topbar/reminders.js
//
// Personal reminders (Phase 3.6) — PURE helpers for the lightweight per-user
// reminder list surfaced in the productivity panel. No React/storage/window.
//
// A reminder: { id, text, done, ts }.

// Build a reminder from raw text. `ts`/`seq` are injected by the caller (pure
// module — no clock/random) so ids are deterministic in tests.
export function buildReminder(text, ts = 0, seq = 0) {
  const clean = String(text || "").trim();
  if (!clean) return null;
  return { id: `r${ts}-${seq}`, text: clean.slice(0, 200), done: false, ts };
}

export function normaliseReminders(value) {
  return Array.isArray(value)
    ? value.filter((r) => r && r.id && typeof r.text === "string")
    : [];
}

// Sort: outstanding first (newest first), then done (newest first).
export function sortReminders(list) {
  return [...normaliseReminders(list)].sort((a, b) => {
    if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1;
    return (b.ts || 0) - (a.ts || 0);
  });
}

export function countOutstanding(list) {
  return normaliseReminders(list).filter((r) => !r.done).length;
}
