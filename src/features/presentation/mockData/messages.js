const rawRows = [
  { id: "demo-msg-001", thread_id: "demo-thread-001", from_user: "demo-user-002", to_user: "demo-user-001", subject: "Job DEMO-1042 update",       body: "Suspension arm fitted, road-tested fine.",       sent_at: "2026-04-22T11:25:00.000Z", read: false },
  { id: "demo-msg-002", thread_id: "demo-thread-002", from_user: "demo-user-004", to_user: "demo-user-001", subject: "Customer arrival",            body: "Mr Reynolds is in reception for DEMO-1044.",     sent_at: "2026-04-22T11:55:00.000Z", read: false },
  { id: "demo-msg-003", thread_id: "demo-thread-001", from_user: "demo-user-001", to_user: "demo-user-002", subject: "Re: Job DEMO-1042 update",    body: "Great — please invoice and book a follow-up.",   sent_at: "2026-04-22T11:30:00.000Z", read: true  },
  { id: "demo-msg-004", thread_id: "demo-thread-003", from_user: "demo-user-003", to_user: "demo-user-002", subject: "Parts ordered for 1043",      body: "CKP sensor ETA tomorrow AM.",                    sent_at: "2026-04-22T10:10:00.000Z", read: true  },
  { id: "demo-msg-005", thread_id: "demo-thread-004", from_user: "demo-user-005", to_user: "demo-user-001", subject: "Invoice INV-0009 overdue",     body: "James Holt overdue 18 days, call required.",    sent_at: "2026-04-22T08:00:00.000Z", read: false },
  { id: "demo-msg-006", thread_id: "demo-thread-005", from_user: "demo-user-006", to_user: "demo-user-002", subject: "MOT failure DEMO-1052",       body: "Front nearside tyre below limit, advised customer.", sent_at: "2026-04-22T12:20:00.000Z", read: false },
  { id: "demo-msg-007", thread_id: "demo-thread-006", from_user: "demo-user-009", to_user: "demo-user-001", subject: "Mobile job complete",         body: "DEMO-1050 EV battery swap done on-site.",        sent_at: "2026-04-22T15:35:00.000Z", read: true  },
  { id: "demo-msg-008", thread_id: "demo-thread-007", from_user: "demo-user-011", to_user: "demo-user-010", subject: "Leave approvals pending",     body: "Three leave requests awaiting decision.",        sent_at: "2026-04-22T09:30:00.000Z", read: false },
];

export const rows = rawRows.map((row) => ({
  notification_id: row.id,
  message: row.body || row.subject,
  target_role: "manager",
  created_at: row.sent_at,
  updated_at: row.sent_at,
  ...row,
}));
