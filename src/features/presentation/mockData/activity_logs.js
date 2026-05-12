export const rows = [
  { id: "demo-log-001", actor: "Demo Manager",   action: "approved_invoice",  entity_type: "invoice",  entity_id: "demo-inv-003", occurred_at: "2026-04-22T12:35:00.000Z", details: "Marked INV-0003 as Paid (cash)" },
  { id: "demo-log-002", actor: "Demo Reception", action: "created_job",       entity_type: "job",      entity_id: "demo-job-003", occurred_at: "2026-04-22T07:45:00.000Z", details: "Created job DEMO-1044" },
  { id: "demo-log-003", actor: "Demo Tech",      action: "clocked_off",       entity_type: "job",      entity_id: "demo-job-001", occurred_at: "2026-04-22T11:30:00.000Z", details: "Clocked off DEMO-1042" },
  { id: "demo-log-004", actor: "Demo Parts",     action: "booked_in_goods",   entity_type: "goods_in", entity_id: "demo-gi-001",  occurred_at: "2026-04-22T10:18:00.000Z", details: "Booked in GI-5001 (Ford Direct)" },
  { id: "demo-log-005", actor: "Demo MOT",       action: "mot_failed",        entity_type: "job",      entity_id: "demo-job-011", occurred_at: "2026-04-22T12:15:00.000Z", details: "MOT failed DEMO-1052 — front NS tyre" },
  { id: "demo-log-006", actor: "Demo Mobile",    action: "completed_job",     entity_type: "job",      entity_id: "demo-job-009", occurred_at: "2026-04-22T15:30:00.000Z", details: "Completed mobile job DEMO-1050" },
  { id: "demo-log-007", actor: "Demo HR",        action: "approved_leave",    entity_type: "hr_leave", entity_id: "demo-lv-004",  occurred_at: "2026-04-22T11:00:00.000Z", details: "Approved leave for Demo MOT" },
  { id: "demo-log-008", actor: "Demo Accounts",  action: "raised_invoice",    entity_type: "invoice",  entity_id: "demo-inv-007", occurred_at: "2026-04-22T16:00:00.000Z", details: "Raised INV-0007 for DEMO-1050" },
];
