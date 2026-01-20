// Workflow-derived status catalog (VHC, parts, invoice) used in job status snapshot.
import { normalizeStatusId } from "./utils";

export const DOMAIN = "workflows";

export const STATUSES = {
  VHC_NOT_REQUIRED: "not_required",
  VHC_PENDING: "pending",
  VHC_IN_PROGRESS: "in_progress",
  VHC_COMPLETED: "completed",
  VHC_SENT: "sent",
  VHC_AUTHORISED: "authorised",
  VHC_DECLINED: "declined",
  PARTS_NONE: "none",
  PARTS_BLOCKED: "blocked",
  PARTS_PRE_PICKED: "pre_picked",
  PARTS_READY: "ready",
  PARTS_IN_PROGRESS: "in_progress",
  INVOICE_MISSING: "missing",
  INVOICE_DRAFT: "Draft",
  INVOICE_SENT: "Sent",
  INVOICE_PAID: "Paid",
  INVOICE_OVERDUE: "Overdue",
  INVOICE_CANCELLED: "Cancelled",
};

export const DISPLAY = {
  [STATUSES.VHC_NOT_REQUIRED]: "not_required",
  [STATUSES.VHC_PENDING]: "pending",
  [STATUSES.VHC_IN_PROGRESS]: "in_progress",
  [STATUSES.VHC_COMPLETED]: "completed",
  [STATUSES.VHC_SENT]: "sent",
  [STATUSES.VHC_AUTHORISED]: "authorised",
  [STATUSES.VHC_DECLINED]: "declined",
  [STATUSES.PARTS_NONE]: "none",
  [STATUSES.PARTS_BLOCKED]: "blocked",
  [STATUSES.PARTS_PRE_PICKED]: "pre_picked",
  [STATUSES.PARTS_READY]: "ready",
  [STATUSES.PARTS_IN_PROGRESS]: "in_progress",
  [STATUSES.INVOICE_MISSING]: "missing",
  [STATUSES.INVOICE_DRAFT]: "Draft",
  [STATUSES.INVOICE_SENT]: "Sent",
  [STATUSES.INVOICE_PAID]: "Paid",
  [STATUSES.INVOICE_OVERDUE]: "Overdue",
  [STATUSES.INVOICE_CANCELLED]: "Cancelled",
};

const ALIASES = {
  not_required: STATUSES.VHC_NOT_REQUIRED,
  pending: STATUSES.VHC_PENDING,
  in_progress: STATUSES.VHC_IN_PROGRESS,
  completed: STATUSES.VHC_COMPLETED,
  sent: STATUSES.VHC_SENT,
  authorised: STATUSES.VHC_AUTHORISED,
  authorized: STATUSES.VHC_AUTHORISED,
  declined: STATUSES.VHC_DECLINED,
  none: STATUSES.PARTS_NONE,
  blocked: STATUSES.PARTS_BLOCKED,
  pre_picked: STATUSES.PARTS_PRE_PICKED,
  pre_picked_parts: STATUSES.PARTS_PRE_PICKED,
  ready: STATUSES.PARTS_READY,
  missing: STATUSES.INVOICE_MISSING,
  draft: STATUSES.INVOICE_DRAFT,
  sent_invoice: STATUSES.INVOICE_SENT,
  paid: STATUSES.INVOICE_PAID,
  overdue: STATUSES.INVOICE_OVERDUE,
  cancelled: STATUSES.INVOICE_CANCELLED,
  canceled: STATUSES.INVOICE_CANCELLED,
};

export const NORMALIZE = (value) => {
  if (value === null || value === undefined) return null;
  if (value === STATUSES.INVOICE_DRAFT) return STATUSES.INVOICE_DRAFT;
  if (value === STATUSES.INVOICE_SENT) return STATUSES.INVOICE_SENT;
  if (value === STATUSES.INVOICE_PAID) return STATUSES.INVOICE_PAID;
  if (value === STATUSES.INVOICE_OVERDUE) return STATUSES.INVOICE_OVERDUE;
  if (value === STATUSES.INVOICE_CANCELLED) return STATUSES.INVOICE_CANCELLED;
  const normalized = normalizeStatusId(value);
  if (!normalized) return null;
  return ALIASES[normalized] || null;
};
