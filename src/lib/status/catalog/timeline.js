// Job sub-status (timeline events) catalog used for status history labeling.
import { normalizeStatusId } from "./utils";

export const DOMAIN = "timeline";

export const STATUSES = {
  TECHNICIAN_STARTED: "technician_started",
  TECHNICIAN_WORK_COMPLETED: "technician_work_completed",
  VHC_STARTED: "vhc_started",
  VHC_REOPENED: "vhc_reopened",
  VHC_COMPLETED: "vhc_completed",
  WAITING_FOR_PRICING: "waiting_for_pricing",
  PRICING_COMPLETED: "pricing_completed",
  SENT_TO_CUSTOMER: "sent_to_customer",
  CUSTOMER_AUTHORISED: "customer_authorised",
  CUSTOMER_DECLINED: "customer_declined",
  WAITING_FOR_PARTS: "waiting_for_parts",
  PARTS_READY: "parts_ready",
  READY_FOR_INVOICE: "ready_for_invoice",
};

export const DISPLAY = {
  [STATUSES.TECHNICIAN_STARTED]: "Technician Started",
  [STATUSES.TECHNICIAN_WORK_COMPLETED]: "Technician Work Completed",
  [STATUSES.VHC_STARTED]: "VHC Started",
  [STATUSES.VHC_REOPENED]: "VHC Reopened",
  [STATUSES.VHC_COMPLETED]: "VHC Completed",
  [STATUSES.WAITING_FOR_PRICING]: "Waiting for Pricing",
  [STATUSES.PRICING_COMPLETED]: "Pricing Completed",
  [STATUSES.SENT_TO_CUSTOMER]: "Sent to Customer",
  [STATUSES.CUSTOMER_AUTHORISED]: "Customer Authorised",
  [STATUSES.CUSTOMER_DECLINED]: "Customer Declined",
  [STATUSES.WAITING_FOR_PARTS]: "Waiting for Parts",
  [STATUSES.PARTS_READY]: "Parts Ready",
  [STATUSES.READY_FOR_INVOICE]: "Ready for Invoice",
};

const LEGACY_TO_SUB = {
  workshop_mot: STATUSES.TECHNICIAN_STARTED,
  assigned_to_tech: STATUSES.TECHNICIAN_STARTED,
  in_progress: STATUSES.TECHNICIAN_STARTED,
  vhc_in_progress: STATUSES.VHC_STARTED,
  vhc_reopened: STATUSES.VHC_REOPENED,
  vhc_complete: STATUSES.VHC_COMPLETED,
  vhc_sent: STATUSES.SENT_TO_CUSTOMER,
  vhc_sent_to_customer: STATUSES.SENT_TO_CUSTOMER,
  waiting_for_pricing: STATUSES.WAITING_FOR_PRICING,
  vhc_priced: STATUSES.PRICING_COMPLETED,
  vhc_approved: STATUSES.CUSTOMER_AUTHORISED,
  vhc_declined: STATUSES.CUSTOMER_DECLINED,
  work_complete: STATUSES.TECHNICIAN_WORK_COMPLETED,
  tech_done: STATUSES.TECHNICIAN_WORK_COMPLETED,
  tech_complete: STATUSES.TECHNICIAN_WORK_COMPLETED,
  waiting_for_parts: STATUSES.WAITING_FOR_PARTS,
  parts_arrived: STATUSES.PARTS_READY,
  retail_parts_on_order: STATUSES.WAITING_FOR_PARTS,
  warranty_parts_on_order: STATUSES.WAITING_FOR_PARTS,
  customer_authorized: STATUSES.CUSTOMER_AUTHORISED,
};

export const NORMALIZE = (value) => {
  const normalized = normalizeStatusId(value);
  if (!normalized) return null;
  if (Object.values(STATUSES).includes(normalized)) return normalized;
  return LEGACY_TO_SUB[normalized] || null;
};
