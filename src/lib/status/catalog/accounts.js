// Accounts status catalog used for account and invoice states.
import { normalizeStatusId } from "./utils";

export const DOMAIN = "accounts";

export const STATUSES = {
  ACCOUNT_ACTIVE: "Active",
  ACCOUNT_FROZEN: "Frozen",
  ACCOUNT_CLOSED: "Closed",
  INVOICE_DRAFT: "Draft",
  INVOICE_SENT: "Sent",
  INVOICE_PAID: "Paid",
  INVOICE_OVERDUE: "Overdue",
  INVOICE_CANCELLED: "Cancelled",
};

export const DISPLAY = {
  [STATUSES.ACCOUNT_ACTIVE]: "Active",
  [STATUSES.ACCOUNT_FROZEN]: "Frozen",
  [STATUSES.ACCOUNT_CLOSED]: "Closed",
  [STATUSES.INVOICE_DRAFT]: "Draft",
  [STATUSES.INVOICE_SENT]: "Sent",
  [STATUSES.INVOICE_PAID]: "Paid",
  [STATUSES.INVOICE_OVERDUE]: "Overdue",
  [STATUSES.INVOICE_CANCELLED]: "Cancelled",
};

const ALIASES = {
  active: STATUSES.ACCOUNT_ACTIVE,
  frozen: STATUSES.ACCOUNT_FROZEN,
  closed: STATUSES.ACCOUNT_CLOSED,
  draft: STATUSES.INVOICE_DRAFT,
  sent: STATUSES.INVOICE_SENT,
  paid: STATUSES.INVOICE_PAID,
  overdue: STATUSES.INVOICE_OVERDUE,
  cancelled: STATUSES.INVOICE_CANCELLED,
  canceled: STATUSES.INVOICE_CANCELLED,
};

export const NORMALIZE = (value) => {
  if (value === null || value === undefined) return null;
  if (Object.values(STATUSES).includes(value)) return value;
  const normalized = normalizeStatusId(value);
  if (!normalized) return null;
  return ALIASES[normalized] || null;
};
