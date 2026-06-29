// file location: src/lib/reporting/kpiDefinitions/service.js
//
// Service Advisor KPI definitions (Phase-3 §7, promoted for the Phase-9 Service
// Advisor report package — the FOURTH package on the shared reporting platform
// after Workshop, Parts and Accounts). Every formula here is taken VERBATIM from
// the KPI catalogue (docs/Report System/reporting-kpi-catalogue-architecture.md
// §7) — no metric is invented and no calculation is bypassed.
//
// Readiness gating (Phase-3 §0.3 — the catalogue's tag is the authority, never a
// guess here):
//   - R1 = all sources exist today (appointments, vhc_send_history, jobs VHC
//     milestone columns, job_customer_statuses) → carries a `resolver`.
//   - R2 = blocked by missing per-entity status-history / view events / the
//     advisor actor stamped on VHC_SENT (data exists but the transition / the
//     sending-advisor attribution is not captured yet) → DECLARED (catalogue
//     entry, no resolver).
//   - R3 = blocked by a missing entity (no follow-up/recall task entity, no
//     CSAT/NPS capture) → DECLARED.
//
// All counting goes through queryBuilder (exact counts, paginated sums,
// distribution via groupCount — never `.limit()` as a total) so the figures
// cannot regress to the D8 truncation / fragmented-GROUP-BY bugs the audit found.
// No figure is computed in the UI.
//
// PERMISSION: Service Advisor KPIs are OPERATIONAL (not financial/PII), so — like
// the Workshop / Parts / VHC seed KPIs — `permission` is left empty (any
// authenticated reporting user the page admits). Navigation is gated to
// Service + Management + Admin roles on the page; the engine still applies
// permissionScope (department/self) server-side. Authorised/declined VHC value is
// commercial-but-not-financial-sensitive, exactly as the existing open vhc.* KPIs
// treat it — so it is NOT financial-gated.
//
// DEPARTMENT-LEVEL VHC VALUE IS SURFACED VIA THE EXISTING R1 vhc.* KPIs (not
// duplicated here): authorised value = `vhc.upsell_revenue`, authorisation rate =
// `vhc.authorisation_rate`, completion = `vhc.completion_rate`, red items =
// `vhc.red_items`. The catalogue's ADVISOR-attributed svc.authorised_value /
// svc.declined_value / svc.vhc_conversion stay DECLARED (R2) because the sending
// advisor is not yet stamped on VHC_SENT — see futureNotes. Workshop/VHC reporting
// is NOT modified (no new vhc.* resolver is added).

import { defineKpi } from "../kpiCatalog";
import { applyDateRange, countRows, fetchRows, groupCount } from "../queryBuilder";

// Round a ratio to one decimal place (percentage points). One place so every
// ratio KPI rounds identically (Principle 2 — single source of truth per metric).
const pct1 = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

export const serviceKpis = [
  // =========================================================================
  // APPOINTMENT & BOOKING ACTIVITY (R1, buildable now)
  // =========================================================================
  defineKpi({
    id: "svc.booking_volume",
    label: "Booking Volume",
    department: "service",
    relatedDepartments: ["workshop"],
    description:
      "Appointments booked in the period (with the service booking-request count alongside) — the advisor booking-activity base.",
    purpose: "Front-of-house demand and advisor booking throughput; the appointment & booking volume base.",
    formula: "COUNT(appointments booked)",
    sourceTables: ["appointments", "job_booking_requests"],
    sourceEvents: ["APPOINTMENT_BOOKED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    format: "0,0",
    targetType: "higher_is_better",
    example: "24/day",
    futureNotes:
      "`value`/`count` carry appointment volume (appointments booked in period); `breakdown.booking_requests` carries the service booking-request volume so 'appointment volume' and 'booking volume' surface as facets of one catalogue KPI rather than an invented second metric. Drill-down lists the appointments with their booking advisor (`created_by`) — advisor-level inspection wherever attribution exists.",
    drilldown: async ({ filter }) =>
      fetchRows(
        "appointments",
        "appointment_id,job_id,customer_id,scheduled_time,status,created_at,created_by",
        (q) => applyDateRange(q, "created_at", filter),
        { orderBy: "created_at" }
      ),
    resolver: async ({ filter }) => {
      const [appointments, bookingRequests] = await Promise.all([
        countRows("appointments", (q) => applyDateRange(q, "created_at", filter)),
        countRows("job_booking_requests", (q) => applyDateRange(q, "submitted_at", filter)),
      ]);
      return {
        value: appointments,
        count: appointments,
        breakdown: { appointments, booking_requests: bookingRequests },
      };
    },
  }),

  defineKpi({
    id: "svc.waiting_mix",
    label: "Waiting / Loan / Collection Mix",
    department: "service",
    description: "Distribution of customer statuses (waiting / loan car / collection / neither) set in the period.",
    purpose: "Customer-engagement mix and front-of-house workload shape.",
    formula: "distribution of job_customer_statuses.customer_status",
    sourceTables: ["job_customer_statuses"],
    sourceEvents: ["CUSTOMER_STATUS_SET"],
    tier: "operational",
    readiness: "R1",
    aggregation: "distinct",
    unit: "count",
    format: "0,0",
    targetType: "informational",
    futureNotes:
      "Groups customer-status records set in the period (date-filtered on created_at). `breakdown` carries the per-status mix; `value` is the total. A precise current mix (latest-per-job) arrives with appointment/customer status-history (R2).",
    drilldown: async ({ filter }) =>
      fetchRows(
        "job_customer_statuses",
        "id,job_id,customer_status,created_at,updated_at",
        (q) => applyDateRange(q, "created_at", filter),
        { orderBy: "created_at" }
      ),
    resolver: async ({ filter }) => {
      const dist = await groupCount("job_customer_statuses", "customer_status", (q) =>
        applyDateRange(q, "created_at", filter)
      );
      const total = Object.values(dist).reduce((a, b) => a + b, 0);
      return { value: total, count: total, breakdown: dist };
    },
  }),

  // =========================================================================
  // VHC PERFORMANCE — advisor-side (R1)
  // =========================================================================
  defineKpi({
    id: "svc.vhc_send_rate",
    label: "VHC Send Rate",
    department: "service",
    relatedDepartments: ["workshop"],
    description: "Share of VHC-required jobs that had a VHC sent to the customer in the period.",
    purpose: "Customer-communication compliance — are required VHCs actually sent?",
    formula: "COUNT(VHC sent) ÷ COUNT(jobs requiring VHC) × 100",
    numerator: "COUNT(jobs.vhc_sent_at not null)",
    denominator: "COUNT(jobs.vhc_required = true)",
    sourceTables: ["jobs", "vhc_send_history"],
    sourceEvents: ["VHC_SENT"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    example: "30 sent ÷ 34 required = 88%",
    futureNotes:
      "Numerator counts jobs with vhc_sent_at in the period; denominator counts VHC-required jobs created in the period. vhc_send_history (sent_by) backs the drill and the future per-advisor send attribution (R2).",
    drilldown: async ({ filter }) =>
      fetchRows(
        "jobs",
        "id,job_number,customer,vehicle_reg,vehicle_make_model,status,vhc_required,vhc_sent_at,vhc_completed_at,checked_in_at,booked_by",
        (q) => applyDateRange(q.not("vhc_sent_at", "is", null), "vhc_sent_at", filter),
        { orderBy: "vhc_sent_at" }
      ),
    resolver: async ({ filter }) => {
      const [sent, required] = await Promise.all([
        countRows("jobs", (q) => applyDateRange(q.not("vhc_sent_at", "is", null), "vhc_sent_at", filter)),
        countRows("jobs", (q) => applyDateRange(q.eq("vhc_required", true), "created_at", filter)),
      ]);
      return { value: pct1(sent, required), numerator: sent, denominator: required };
    },
  }),

  // =========================================================================
  // DECLARED — not yet implemented (R2/R3 blockers documented). NO resolver:
  // the engine reports them as "declared, readiness Rn" so the UI / catalogue
  // lists the metric and its exact blocker honestly, lighting up in a later phase
  // once the prerequisite (status-history accrual / advisor actor stamp / a new
  // entity) lands. This is the same discipline the Workshop / Parts / Accounts
  // packages established.
  // =========================================================================

  // ---- R2: customer-communication modelling + advisor attribution ----------
  defineKpi({
    id: "svc.appointment_conversion",
    label: "Appointment Conversion",
    department: "service",
    relatedDepartments: ["workshop"],
    description: "Share of booked appointments that became arrived/job-created.",
    formula: "COUNT(appointments → arrived/job created) ÷ COUNT(booked) × 100",
    numerator: "COUNT(appointments that became jobs)",
    denominator: "COUNT(appointments booked)",
    sourceTables: ["appointments", "jobs"],
    sourceEvents: ["APPOINTMENT_STATUS_CHANGED", "JOB_CREATED"],
    sourceHistories: ["appointment_status_history"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    futureNotes:
      "R2 — the booked→arrived/job-created transition needs appointment_status_history (appointment is P4 priority 5 in the status-history rollout). The current appointments.status snapshot loses the transition path.",
  }),
  defineKpi({
    id: "svc.contact_rate",
    label: "Customer Contact Rate",
    department: "service",
    description: "Share of jobs with at least one logged customer contact.",
    formula: "COUNT(jobs with ≥1 logged customer contact) ÷ COUNT(jobs) × 100",
    sourceTables: ["jobs"],
    sourceEvents: ["CUSTOMER_CONTACTED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    futureNotes:
      "R2 — needs a CUSTOMER_CONTACTED event captured per job (the event spine emit). There is no per-job customer-contact log today; the JSON-collapsed messaging store (D11) cannot supply it reliably.",
  }),
  defineKpi({
    id: "svc.response_time",
    label: "Customer Response Time",
    department: "service",
    relatedDepartments: ["workshop"],
    description: "Mean time from customer message / VHC send to the first staff reply / decision.",
    formula: "mean(first staff reply − customer message) / mean(VHC decision − VHC sent)",
    sourceTables: ["vhc_send_history", "vhc_checks", "message_thread_members"],
    sourceEvents: ["CUSTOMER_CONTACTED", "VHC_SENT", "VHC_AUTHORISED", "VHC_DECLINED"],
    sourceHistories: ["vhc_item_status_history"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "duration",
    unit: "duration",
    format: "0.0",
    targetType: "lower_is_better",
    futureNotes:
      "R2 — message-level precision is blocked by JSON-collapsed message storage (D11); an event-level proxy (VHC sent→decision latency) needs vhc_item_status_history. Declared until the history accrues.",
  }),
  defineKpi({
    id: "svc.vhc_view_rate",
    label: "VHC View Rate",
    department: "service",
    description: "Share of sent VHCs that the customer viewed.",
    formula: "COUNT(VHC viewed) ÷ COUNT(VHC sent) × 100",
    numerator: "COUNT(VHC viewed)",
    denominator: "COUNT(VHC sent)",
    sourceTables: ["job_share_links", "vhc_send_history"],
    sourceEvents: ["VHC_VIEWED", "VHC_SENT"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    futureNotes:
      "R2 — needs the VHC_VIEWED event captured (the customer share-link viewed_at). The send side is R1 (vhc_send_history); the view side is not yet recorded as an event.",
  }),
  defineKpi({
    id: "svc.vhc_conversion",
    label: "VHC Conversion (advisor)",
    department: "service",
    relatedDepartments: ["workshop"],
    description: "Authorised value as a share of identified value, attributed to the sending advisor.",
    formula: "authorised_value ÷ (authorised_value + declined_value) × 100, by advisor",
    sourceTables: ["vhc_checks", "vhc_send_history"],
    sourceEvents: ["VHC_AUTHORISED", "VHC_DECLINED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    relatedReports: ["vhc.authorisation_rate"],
    futureNotes:
      "R2 — the DEPARTMENT-level conversion is available now via vhc.authorisation_rate (R1, shown in the VHC tab). The BY-ADVISOR split needs the sending advisor stamped on VHC_SENT (actor-attribution remediation, D4) — declared until then.",
  }),
  defineKpi({
    id: "svc.authorised_value",
    label: "Authorised Value per Advisor",
    department: "service",
    relatedDepartments: ["workshop", "accounts"],
    description: "Σ authorised VHC value, attributed to the sending advisor.",
    formula: "Σ vhc_checks.authorized_total_gbp by advisor",
    sourceTables: ["vhc_checks", "vhc_send_history"],
    sourceEvents: ["VHC_AUTHORISED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    relatedReports: ["vhc.upsell_revenue"],
    futureNotes:
      "R2 — the DEPARTMENT-level authorised value is available now via vhc.upsell_revenue (R1, shown in the VHC tab). The PER-ADVISOR split needs the sending advisor stamped on VHC_SENT (D4). Declared until then.",
  }),
  defineKpi({
    id: "svc.declined_value",
    label: "Declined Value per Advisor",
    department: "service",
    relatedDepartments: ["workshop"],
    description: "Σ declined VHC value (lost £), attributed to the sending advisor.",
    formula: "Σ declined_total_gbp by advisor",
    sourceTables: ["vhc_checks", "vhc_declinations"],
    sourceEvents: ["VHC_DECLINED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "sum",
    unit: "currency",
    format: "£0,0.00",
    targetType: "lower_is_better",
    relatedReports: ["vhc.authorisation_rate"],
    futureNotes:
      "R2 — the DEPARTMENT-level declined value is visible now through vhc.authorisation_rate (its denominator − numerator = declined identified value). The PER-ADVISOR split needs the sending advisor stamped on VHC_SENT (D4). Declared until then.",
  }),

  // ---- R3: need a missing entity / external capture ------------------------
  defineKpi({
    id: "svc.followup_completion",
    label: "Follow-up Completion",
    department: "service",
    description: "Share of declined VHC items that were followed up later.",
    formula: "COUNT(declined items followed up) ÷ COUNT(declined items) × 100",
    sourceTables: ["vhc_declinations"],
    tier: "tactical",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    futureNotes:
      "R3 — there is no follow-up / recall task entity to record that a declined item was chased. Needs a new entity (follow-up tasks) before completion can be measured.",
  }),
  defineKpi({
    id: "svc.csat",
    label: "Customer Satisfaction",
    department: "service",
    description: "Customer satisfaction / NPS for service interactions.",
    formula: "mean(survey score) / NPS",
    sourceTables: [],
    tier: "strategic",
    readiness: "R3",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    futureNotes:
      "R3 — no CSAT/NPS capture exists (needs a survey integration). An interim proxy (response-time + conversion composite) is possible once those R2 inputs land.",
  }),
];

export default serviceKpis;
