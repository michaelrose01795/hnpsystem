// file location: src/components/reporting/service/serviceReportConfig.js
//
// Presentation grouping for the Service Advisor report package (Phase 9): which
// catalogue KPIs appear in which tab, and the display metadata
// (unit/format/readiness/drilldown) that mirrors the KPI definitions in
// src/lib/reporting/kpiDefinitions/service.js (and the cross-listed R1 vhc.*
// definitions). This is LAYOUT ONLY — every value, formula and calculation still
// comes from the engine via /api/reports/*. The ids here are the contract;
// nothing is recomputed and no KPI card is duplicated.
//
// Structure mirrors the Workshop / Parts / Accounts packages, mapped onto the
// Service Advisor brief: Service Overview · Customer Communications · Appointment
// & Booking Activity · VHC Performance · Reporting Utilities.
//
// Department-level VHC value/rate is surfaced through the EXISTING R1 vhc.* KPIs
// (vhc.upsell_revenue / vhc.authorisation_rate / vhc.completion_rate /
// vhc.red_items) — referenced by id, NOT re-implemented — so there is exactly one
// definition per metric. The advisor-attributed svc.* equivalents are shown as
// declared (R2) readiness indicators alongside, so the gap is explicit.

export const SERVICE_DEPARTMENT = { code: "service", label: "Service Advisors" };
export const SERVICE_VIEW_TARGET = "reports:service";

// Each descriptor: { id, label, unit, format, readiness, hasDrilldown, description }
const K = (id, label, unit, format, readiness, hasDrilldown, description) => ({
  id,
  label,
  unit,
  format,
  readiness,
  hasDrilldown,
  description,
});

// --- Tab 1: Service Overview — department scorecard ------------------------
// Headline operational KPIs (R1, live-correct). Department-level VHC value/rate
// come from the existing vhc.* catalogue entries (one definition per metric).
export const OVERVIEW_SCORECARD = [
  K("svc.booking_volume", "Booking Volume", "count", "0,0", "R1", true, "Appointments booked in the period."),
  K("svc.vhc_send_rate", "VHC Send Rate", "percent", "0.0%", "R1", true, "VHC sent ÷ VHC-required jobs."),
  K("vhc.authorisation_rate", "VHC Authorisation Rate", "percent", "0.0%", "R1", false, "Authorised ÷ identified value."),
  K("vhc.upsell_revenue", "Authorised Value", "currency", "£0,0.00", "R1", false, "Σ authorised VHC work (£)."),
  K("vhc.completion_rate", "VHC Completion", "percent", "0.0%", "R1", false, "Completed ÷ required VHC jobs."),
  K("svc.waiting_mix", "Waiting / Loan / Collection", "count", "0,0", "R1", true, "Customer-status mix."),
  K("vhc.red_items", "Red Items Found", "count", "0,0", "R1", true, "Safety-critical findings volume."),
];

// --- Tab 2: Customer Communications ----------------------------------------
// Contact activity, customer responses, follow-up activity. The customer-comms
// metrics are R2/R3 (blocked on the event spine / a follow-up entity) — shown as
// declared readiness indicators so the gap is explicit. VHC send rate is the one
// R1 customer-communication signal available today.
export const COMMUNICATIONS_R1 = [
  K("svc.vhc_send_rate", "VHC Send Rate", "percent", "0.0%", "R1", true, "Customer-communication compliance: VHCs sent to customers."),
];
export const COMMUNICATIONS_READINESS = [
  K("svc.contact_rate", "Customer Contact Activity", "percent", "0.0%", "R2", false, "Jobs with a logged customer contact."),
  K("svc.response_time", "Customer Responses", "duration", "0.0", "R2", false, "Mean time to reply / VHC decision."),
  K("svc.followup_completion", "Follow-up Activity", "percent", "0.0%", "R3", false, "Declined items followed up later."),
];

// --- Tab 3: Appointment & Booking Activity ---------------------------------
// Appointment volume, booking volume, booking performance, customer engagement.
export const BOOKING_R1 = [
  K("svc.booking_volume", "Appointment & Booking Volume", "count", "0,0", "R1", true, "Appointments booked (booking-request count in the drill/breakdown)."),
  K("svc.waiting_mix", "Customer Engagement Mix", "count", "0,0", "R1", true, "Waiting / loan / collection distribution."),
];
export const BOOKING_READINESS = [
  K("svc.appointment_conversion", "Booking Performance (conversion)", "percent", "0.0%", "R2", false, "Booked → arrived / job-created."),
];

// --- Tab 4: VHC Performance ------------------------------------------------
// VHC sent (R1), viewed (R2), authorised (R1), authorised value (R1), declined
// value (R2 advisor), advisor conversion performance (R2 advisor).
export const VHC_R1 = [
  K("svc.vhc_send_rate", "VHC Sent (send rate)", "percent", "0.0%", "R1", true, "VHC sent ÷ VHC-required jobs."),
  K("vhc.authorisation_rate", "VHC Authorised (auth rate)", "percent", "0.0%", "R1", false, "Authorised ÷ identified value."),
  K("vhc.upsell_revenue", "Authorised Value", "currency", "£0,0.00", "R1", false, "Σ authorised VHC work (£)."),
  K("vhc.completion_rate", "VHC Completion", "percent", "0.0%", "R1", false, "Completed ÷ required VHC jobs."),
];
export const VHC_READINESS = [
  K("svc.vhc_view_rate", "VHC Viewed (view rate)", "percent", "0.0%", "R2", false, "Viewed ÷ sent — needs the view event."),
  K("svc.declined_value", "Declined Value (per advisor)", "currency", "£0,0.00", "R2", false, "Σ declined £ by advisor — dept-level via auth-rate."),
  K("svc.vhc_conversion", "Advisor Conversion Performance", "percent", "0.0%", "R2", false, "Per-advisor conversion — needs send-advisor attribution."),
  K("svc.authorised_value", "Authorised Value (per advisor)", "currency", "£0,0.00", "R2", false, "Σ authorised £ by advisor — dept-level via vhc.upsell_revenue."),
];

// --- Tab 5: Reporting Utilities — every drillable/exportable Service KPI ----
export const ALL_EXPORTABLE = [
  K("svc.booking_volume", "Booking Volume", "count", "0,0", "R1", true, ""),
  K("svc.vhc_send_rate", "VHC Send Rate", "percent", "0.0%", "R1", true, ""),
  K("svc.waiting_mix", "Waiting / Loan / Collection Mix", "count", "0,0", "R1", true, ""),
  K("vhc.red_items", "Red Items Found", "count", "0,0", "R1", true, ""),
].filter((k, i, arr) => k.hasDrilldown && arr.findIndex((x) => x.id === k.id) === i);

export const SERVICE_TABS = [
  { value: "overview", label: "Service Overview" },
  { value: "communications", label: "Customer Communications" },
  { value: "booking", label: "Appointment & Booking" },
  { value: "vhc", label: "VHC Performance" },
  { value: "utilities", label: "Reporting Utilities" },
];
