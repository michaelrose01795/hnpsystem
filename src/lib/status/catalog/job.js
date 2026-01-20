// Job main status catalog used for overall job status displays and validation.
import { normalizeStatusId } from "./utils";

export const DOMAIN = "job";

export const STATUSES = {
  BOOKED: "booked",
  CHECKED_IN: "checked_in",
  IN_PROGRESS: "in_progress",
  INVOICED: "invoiced",
  COMPLETE: "complete",
};

export const DISPLAY = {
  [STATUSES.BOOKED]: "Booked",
  [STATUSES.CHECKED_IN]: "Checked In",
  [STATUSES.IN_PROGRESS]: "In Progress",
  [STATUSES.INVOICED]: "Invoiced",
  [STATUSES.COMPLETE]: "Complete",
};

const LEGACY_TO_MAIN = {
  appointment_booked: STATUSES.BOOKED,
  customer_checkin_pending: STATUSES.BOOKED,
  customer_arrived: STATUSES.CHECKED_IN,
  job_accepted: STATUSES.CHECKED_IN,
  assigned_to_tech: STATUSES.CHECKED_IN,
  in_progress: STATUSES.IN_PROGRESS,
  in_mot: STATUSES.IN_PROGRESS,
  waiting_for_parts: STATUSES.IN_PROGRESS,
  tea_break: STATUSES.IN_PROGRESS,
  parts_arrived: STATUSES.IN_PROGRESS,
  vhc_waiting: STATUSES.IN_PROGRESS,
  vhc_in_progress: STATUSES.IN_PROGRESS,
  vhc_complete: STATUSES.IN_PROGRESS,
  vhc_reopened: STATUSES.IN_PROGRESS,
  vhc_sent_to_service: STATUSES.IN_PROGRESS,
  waiting_for_pricing: STATUSES.IN_PROGRESS,
  vhc_priced: STATUSES.IN_PROGRESS,
  vhc_sent_to_customer: STATUSES.IN_PROGRESS,
  vhc_approved: STATUSES.IN_PROGRESS,
  vhc_declined: STATUSES.IN_PROGRESS,
  work_complete: STATUSES.IN_PROGRESS,
  ready_for_valet: STATUSES.IN_PROGRESS,
  being_valeted: STATUSES.IN_PROGRESS,
  valet_complete: STATUSES.IN_PROGRESS,
  ready_for_release: STATUSES.IN_PROGRESS,
  delivered_to_customer: STATUSES.IN_PROGRESS,
  invoicing: STATUSES.INVOICED,
  invoiced: STATUSES.INVOICED,
  released: STATUSES.COMPLETE,
  completed: STATUSES.COMPLETE,
  complete: STATUSES.COMPLETE,
  collected: STATUSES.COMPLETE,
  cancelled: STATUSES.COMPLETE,
  workshop_mot: STATUSES.IN_PROGRESS,
  vhc_sent: STATUSES.IN_PROGRESS,
  additional_work_required: STATUSES.IN_PROGRESS,
  additional_work_being_carried_out: STATUSES.IN_PROGRESS,
  retail_parts_on_order: STATUSES.IN_PROGRESS,
  warranty_parts_on_order: STATUSES.IN_PROGRESS,
  raise_tsr: STATUSES.IN_PROGRESS,
  waiting_for_tsr_response: STATUSES.IN_PROGRESS,
  warranty_quality_control: STATUSES.IN_PROGRESS,
  warranty_ready_to_claim: STATUSES.IN_PROGRESS,
  being_washed: STATUSES.IN_PROGRESS,
  tech_done: STATUSES.IN_PROGRESS,
  tech_complete: STATUSES.IN_PROGRESS,
};

export const NORMALIZE = (value) => {
  const normalized = normalizeStatusId(value);
  if (!normalized) return null;
  if (Object.values(STATUSES).includes(normalized)) return normalized;
  return LEGACY_TO_MAIN[normalized] || null;
};
