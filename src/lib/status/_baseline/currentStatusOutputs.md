# Current Status Outputs (Baseline)

Purpose: document current status strings, mappings, and UI outputs before refactor. This is a no-visual-change contract.

## Inventory Scope (source files)
- Jobs + status flow: `src/lib/status/statusFlow.js`, `src/lib/database/jobs.js`, `src/lib/status/jobStatusSnapshot.js`
- Status UI: `src/components/StatusTracking/StatusSidebar.js`, `src/components/StatusTracking/JobProgressTracker.js`, `src/components/StatusTracking/StatusTimeline.js`
- Job pages: `src/pages/job-cards/[jobNumber].js`, `src/pages/job-cards/view/index.js`, `src/pages/job-cards/myjobs/[jobNumber].js`
- Parts pipeline: `src/lib/partsPipeline.js`
- VHC: `src/components/VHC/*`, `src/pages/api/vhc/update-item-status.js`
- Tracking: `src/lib/database/tracking.js`, `src/pages/tracking/index.js`
- Clocking: `src/context/UserContext.js`, `src/components/Layout.js`, `src/pages/clocking/*`
- Accounts: `src/config/accounts.js`, `src/components/accounts/*`
- HR: `src/pages/hr/employees/index.js`, `src/lib/database/hr.js`
- Consumables: `src/pages/workshop/consumables-tracker.js`, `src/pages/api/workshop/consumables/requests.js`
- MOT: `src/lib/database/dashboard/mot.js`, `src/pages/dashboard/mot/index.js`

## Manager Job Page (overall job status)
Source of truth:
- `jobs.status` from Supabase, normalized in `formatJobData()` in `src/lib/database/jobs.js` via `getMainStatusMetadata()`.
- If status matches a main status or legacy mapping, the UI displays the main status label.
- If status is unknown to `statusFlow`, the UI displays the raw database value.

Where it renders:
- `src/pages/job-cards/[jobNumber].js`: header badge uses `jobData.status`.
- `src/pages/job-cards/view/index.js`: list view uses `job.status` for filters and display.

Current labels shown (main status flow):
- `booked` -> "Booked"
- `checked_in` -> "Checked In"
- `in_progress` -> "In Progress"
- `invoiced` -> "Invoiced"
- `complete` -> "Complete"

Examples:
- DB `jobs.status = "checked_in"` -> header badge shows "Checked In".
- DB `jobs.status = "Open"` -> header badge shows "Open" (raw string, not normalized).

Color rules (manager header badge):
- If `jobData.status === "Open"`: success surface colors.
- Else if `jobData.status === "Complete"`: info surface colors.
- Else: warning surface colors.

Other status-dependent behaviour:
- Check-in button shows only when `jobData.status` lowercases to `booked`.
- Invoice readiness uses `normalizeStatusId(jobData.status) === "in_progress"`.

## Tech Job Page (tech-side status)
Source of truth:
- Derived in `resolveTechStatusLabel()` in `src/pages/job-cards/myjobs/[jobNumber].js`.
- Uses `jobCard.rawStatus` / `jobCard.status` plus `jobCard.techCompletionStatus`.

Displayed labels:
- "Complete" when raw status includes `tech_complete`, `technician_work_completed`, `invoiced`, or `complete`/`completed`, or tech completion status is `tech_complete`/`complete`.
- "Waiting" when raw status includes `booked`, `checked_in`, `waiting`, or `pending`.
- "In Progress" when raw status includes `in_progress`.
- Fallback: "In Progress".

Badge styling uses `STATUS_COLORS` and `STATUS_BADGE_STYLES` in `src/pages/job-cards/myjobs/[jobNumber].js`.

## Status Sidebar / Timeline UI
Source of truth:
- `src/lib/status/jobStatusSnapshot.js` builds `snapshot`.
- `src/components/StatusTracking/StatusSidebar.js` renders the snapshot timeline via `JobProgressTracker`.

Current status display:
- `currentStatusForDisplay = snapshot.job.status` (raw DB value).
- `currentStatusMeta = snapshot.job.statusMeta` (label, color, department).
- Header shows "Current Status" with `currentStatusMeta.label` if present, else raw status.

Timeline entries (labels and types):
- Status history (`job_status_history`) uses `buildStatusPayload()`:
  - Main statuses map to labels in `SERVICE_STATUS_FLOW`.
  - Sub-statuses map to labels in `JOB_SUB_STATUS_FLOW`.
  - Unknown status values render the raw value as label (event type `status_update`).
- Key tracking entries:
  - First key event label: "Added to parking & key tracking".
  - Later labels use `key_tracking_events.action` or "Keys updated".
- Vehicle tracking entries:
  - Label `Parking updated: {location}` when location exists.
  - Otherwise `Vehicle status: {status}`.
- Clocking entries:
  - Label is `work_type` (underscores replaced by spaces) or "Technician clocked on".

## Workflow Statuses (snapshot domains)
These are produced by `src/lib/status/jobStatusSnapshot.js`. The sidebar UI currently only renders the timeline, but these fields are part of the snapshot output contract.

VHC workflow (`snapshot.workflows.vhc.status`):
- `not_required` when `vhc_required` is false.
- `declined` when `vhc_declined_at` exists.
- `authorised` when `additional_work_authorized_at` or latest authorization exists.
- `sent` when `vhc_sent_at` exists.
- `completed` when `vhc_completed_at` exists.
- `in_progress` when VHC checks exist.
- `pending` fallback.

Parts workflow (`snapshot.workflows.parts.status`):
- `none` when no parts.
- `blocked` when any items are `waiting_authorisation`, `pending`, `awaiting_stock`, or `on_order`.
- `pre_picked` when any items are `pre_picked` or `picked`.
- `ready` when any items are `stock`, `allocated`, or `fitted`.
- `in_progress` fallback.

Invoice workflow (`snapshot.workflows.invoice.status`):
- Uses `invoices.payment_status` when an invoice exists (ex: "Draft", "Sent", "Paid", "Overdue", "Cancelled").
- "Draft" when invoice row exists without payment_status.
- "missing" when no invoice exists.

## Legacy Job Status Mappings (display label)
From `src/lib/status/statusFlow.js`.

Legacy -> main display label:
- `appointment_booked`, `customer_checkin_pending` -> "Booked"
- `customer_arrived`, `job_accepted`, `assigned_to_tech` -> "Checked In"
- `in_progress`, `in_mot`, `waiting_for_parts`, `tea_break`, `parts_arrived`, `vhc_waiting`, `vhc_in_progress`, `vhc_complete`, `vhc_reopened`, `vhc_sent_to_service`, `waiting_for_pricing`, `vhc_priced`, `vhc_sent_to_customer`, `vhc_approved`, `vhc_declined`, `work_complete`, `ready_for_valet`, `being_valeted`, `valet_complete`, `ready_for_release`, `delivered_to_customer`, `workshop_mot`, `vhc_sent`, `additional_work_required`, `additional_work_being_carried_out`, `retail_parts_on_order`, `warranty_parts_on_order`, `raise_tsr`, `waiting_for_tsr_response`, `warranty_quality_control`, `warranty_ready_to_claim`, `being_washed`, `tech_done`, `tech_complete` -> "In Progress"
- `invoicing`, `invoiced` -> "Invoiced"
- `released`, `completed`, `complete`, `collected`, `cancelled` -> "Complete"

Legacy -> sub-status label:
- `workshop_mot`, `assigned_to_tech`, `in_progress` -> "Technician Started"
- `vhc_in_progress` -> "VHC Started"
- `vhc_reopened` -> "VHC Reopened"
- `vhc_complete` -> "VHC Completed"
- `vhc_sent`, `vhc_sent_to_customer` -> "Sent to Customer"
- `waiting_for_pricing` -> "Waiting for Pricing"
- `vhc_priced` -> "Pricing Completed"
- `vhc_approved` -> "Customer Authorised"
- `vhc_declined` -> "Customer Declined"
- `work_complete`, `tech_done`, `tech_complete` -> "Technician Work Completed"
- `waiting_for_parts`, `retail_parts_on_order`, `warranty_parts_on_order` -> "Waiting for Parts"
- `parts_arrived` -> "Parts Ready"

## Domain Inventory (non-job status domains)

### Parts Pipeline
Source: `src/lib/partsPipeline.js`
- `waiting_authorisation` -> "Waiting Authorisation"
- `pending`, `awaiting_stock` -> "Waiting to Order"
- `on_order` -> "On Order"
- `pre_picked`, `picked` -> "Pre Picked"
- `stock`, `allocated`, `fitted` -> "In Stock"

### VHC Item States
Sources: `src/components/VHC/*`, `src/pages/api/vhc/update-item-status.js`
- Approval status values: `pending`, `authorized`, `declined`, `completed`.
- Display severity values used in UI: `red`, `amber`, `green`, `grey` (also capitalized variants in some modals).
- UI labels shown: "Authorised", "Declined", "Red Items", "Amber Items", "Green Items", "Authorized" (US spelling used in data/fields).

### Tracking
Sources: `src/lib/database/tracking.js`, `src/pages/tracking/index.js`
- Vehicle status labels (tracking page options): "Awaiting Authorization", "Waiting For Collection", "Ready For Collection", "Complete", "Valet Hold", "In Transit".
- Next-action derived labels: "Awaiting Workshop", "Awaiting Advisor", "Ready For Collection".
- Key tracking action labels: "Keys received – {location}", "Keys updated – {location}", "Keys hung – {location}".

### Clocking
Sources: `src/context/UserContext.js`, `src/components/Layout.js`, `src/pages/clocking/*`
- Tech status labels: "Waiting for Job", "In Progress", "Tea Break", "On MOT", "Not Clocked In".

### Accounts
Sources: `src/config/accounts.js`, `src/components/accounts/*`
- Account statuses: "Active", "Frozen", "Closed".
- Invoice statuses (payment_status): "Draft", "Sent", "Paid", "Overdue", "Cancelled".

### HR
Sources: `src/pages/hr/employees/index.js`, `src/lib/database/hr.js`
- Employee status labels (directory filters): "Active", "On leave", "Resigned", "Terminated".
- Other HR statuses in data helpers include: "Clocked In", "Overtime", "On Time", "In Progress", "Ready", "Scheduled", "Overdue", "Due Soon", "Completed", "Pending", "Approved".

### Consumables
Sources: `src/pages/workshop/consumables-tracker.js`, `src/pages/api/workshop/consumables/requests.js`
- Tracker status labels (derived): "Overdue", "Coming Up", "Not Required".
- Request status values: `pending`, `urgent`, `ordered`, `rejected` (displayed capitalized).

### MOT
Sources: `src/lib/database/dashboard/mot.js`, `src/pages/dashboard/mot/index.js`
- Uses `jobs.completion_status` strings that include `pass`, `fail`, `retest` for counts.
- UI shows raw `completion_status` or "Pending" fallback.

## Checklist: Same Behaviour Means
- All pages render the same status text for the same underlying data (no label changes).
- Status colors and badges remain unchanged.
- Legacy job status values still resolve to the same visible label as before.
- Timeline entries keep the same labels, ordering, and event types.
- Workflow-derived statuses (VHC, parts, invoice) remain the same strings in the snapshot.
- Any unknown status strings still display as raw values (no new normalization side effects).
