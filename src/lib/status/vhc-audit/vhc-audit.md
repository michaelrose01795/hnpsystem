# VHC Status Audit

This file consolidates the VHC status audit documentation into a single reference.

---

## What status fields exist

### VHC item (vhc_checks) status fields
- `vhc_checks.approval_status` (pending/authorized/declined/completed) controls the approval workflow state for a VHC item.
- `vhc_checks.display_status` (red/amber/green/authorized/declined/completed) controls how the item is grouped in the VHC summary list and overrides the original severity when present.
- `vhc_checks.labour_complete` and `vhc_checks.parts_complete` are completion flags used in the summary table status dot (awaiting parts/labour vs ready for decision).
- `vhc_checks.approved_at` and `vhc_checks.approved_by` are timestamps/actors set when approval moves to authorized/declined/completed.

### VHC builder payload status fields (stored in vhc_checks.issue_description for section VHC_CHECKSHEET)
These are severity and condition inputs captured in the section modals and used to derive summary severity:
- Wheels & Tyres: concern statuses (Red/Amber/Green) plus tread-depth-derived severity (Red/Amber/Green) using thresholds in `src/lib/vhc/summary.js`.
- Brakes & Hubs: pad status (Red/Amber/Green), disc measurement status (Red/Amber/Green), disc visual status (Red/Amber/Green), rear drum status (Good/Monitor/Replace), and concern statuses (Red/Amber/Green).
- Service Indicator & Under Bonnet: service choice (reset/not_required/no_reminder/indicator_on), oil status (Good/Bad/EV), and concern statuses (Red/Amber/Green).
- External/Internal/Underside: concern statuses (Red/Amber/Green).
- Diagram-only statuses (not persisted as VHC item statuses): tyre diagram uses danger/advisory/good/unknown; brake diagram uses critical/advisory/good/unknown.

### VHC workflow/status fields (job + workflow tables)
- `jobs.vhc_required` gates whether VHC is required in workflow snapshots.
- `jobs.vhc_completed_at` marks VHC completion for workflow snapshots and status blockers.
- `jobs.vhc_sent_at` marks VHC sent to customer for workflow snapshots.
- `jobs.additional_work_authorized_at` marks additional work authorized for workflow snapshots.
- `vhc_send_history.sent_at`, `vhc_authorizations.authorized_at`, and `vhc_declinations.declined_at` are logged events that feed workflow status snapshots.
- `vhc_workflow_status.status` (free-text in `vhc_workflow_status`) is read by the customer portal but no write path is present in this repo.

## Severity vs approval vs workflow
- Severity is derived from the VHC builder payload (see `src/lib/vhc/summary.js`) and is normalized to `red/amber/green/grey` in `src/components/VHC/VhcDetailsPanel.js` for display.
- Approval is tracked on `vhc_checks.approval_status` and is the source of the decision state (pending/authorized/declined/completed).
- Workflow status is derived from job-level timestamps and authorization/declination tables (see `src/lib/status/jobStatusSnapshot.js`).

## How section rules affect status display
- Health Check cards (`VhcDetailsPanel` health-check tab) derive section severity using metrics first, then item/concern statuses (red > amber > grey > green).
- Summary tab rows are generated from VHC builder payload items that normalize to red/amber, then grouped by `display_status` when present; otherwise they stay in their original severity list.
- A `display_status` of `completed` keeps the item in the Authorized list but shows a Completed status label.

## Where VHC statuses affect job/workflow status
- `vhc_completed_at` and `vhc_sent_at` are used in workflow snapshots and job blocking reasons (`src/lib/status/jobStatusSnapshot.js`).
- Sub-status timeline updates for VHC events use `logJobSubStatus` in `src/lib/services/jobStatusService.js`.

## Findings (inconsistencies/risks)
- `workflows.vhc.status` uses `authorised` (UK spelling) while `vhc_checks.approval_status` uses `authorized` (US spelling). `src/lib/status/catalog/vhc.js` normalizes both, but `buildVhcStatus` returns `authorised` directly.
- Single-item approval updates in `VhcDetailsPanel` do not pass `displayStatus` on reset to pending, so `display_status` may remain `authorized`/`declined` instead of restoring the original severity. Bulk reset does pass the raw severity.
- `vhc_workflow_status.status` is read (customer portal + VHC panel) but no write path exists in this repo.
- `parse-checksheet` passes a `status` field to `createVHCCheck`, but `vhc_checks` schema does not include a `status` column, so this value appears unused.
- Job card severity helper treats any "green" value as `grey` (`src/pages/job-cards/[jobNumber].js`), which may be intentional but is inconsistent with other places that treat green as a positive severity.

---

# VHC Status Matrix

## Field status matrix

| Field name | Possible values (code) | Meaning in UI | Where set | Where read | Section-specific rules | Related UI surfaces |
| --- | --- | --- | --- | --- | --- | --- |
| `vhc_checks.approval_status` | `pending`, `authorized`, `declined`, `completed` | Approval decision for a VHC item; drives status dot and sections in VHC summary. | `src/pages/api/vhc/update-item-status.js` called from `src/components/VHC/VhcDetailsPanel.js` (single + bulk updates). | `src/components/VHC/VhcDetailsPanel.js`, `src/lib/vhc/calculateVhcTotals.js` | Pending uses parts/labour completeness to show "Add labour", "Add parts", or "Awaiting decision". | VHC Summary tab in `src/components/VHC/VhcDetailsPanel.js` |
| `vhc_checks.display_status` | `red`, `amber`, `green`, `authorized`, `declined`, `completed` | Overrides which summary list a row appears in; `completed` keeps row in Authorized list but shows Completed status. | `src/pages/api/vhc/update-item-status.js` (implicit for authorized/declined/completed; can be explicitly passed for reset). | `src/components/VHC/VhcDetailsPanel.js`, `src/lib/vhc/calculateVhcTotals.js` | When present, replaces original severity; completed -> authorized list. | VHC Summary tab in `src/components/VHC/VhcDetailsPanel.js` |
| `vhc_checks.labour_complete` | `true`, `false` | Checkbox state in summary table for labour completeness. | `src/pages/api/vhc/update-item-status.js` (from VHC summary interactions). | `src/components/VHC/VhcDetailsPanel.js` | Used by `resolveRowStatusState` to show "Add labour" vs "Awaiting decision". | VHC Summary tab |
| `vhc_checks.parts_complete` | `true`, `false` | Auto-complete flag when parts cost exists or parts marked not required. | `src/components/VHC/VhcDetailsPanel.js` (auto-sync to API via `/api/vhc/update-item-status`). | `src/components/VHC/VhcDetailsPanel.js` | Used by `resolveRowStatusState` to show "Add parts" vs "Awaiting decision". | VHC Summary tab |
| `vhc_checks.approved_at`, `vhc_checks.approved_by` | timestamps / user identifiers | Timestamp + actor when approval moves to authorized/declined/completed. | `src/pages/api/vhc/update-item-status.js` | `src/components/VHC/VhcDetailsPanel.js` | None. | VHC Summary tab (status hover details via local state) |
| `jobs.vhc_required` | `true`, `false` | Whether VHC is required for the job. | Job update flows in `src/lib/database/jobs.js` and external data entry (no direct VHC UI set). | `src/lib/services/vhcStatusService.js`, `src/lib/status/jobStatusSnapshot.js` | Determines whether workflow status can be `not_required` vs `pending`. | Status sidebar snapshot, dashboards |
| `jobs.vhc_completed_at` | timestamp or null | VHC completed marker for workflow status and blockers. | `src/lib/services/jobStatusService.js` via `autoSetVHCCompleteStatus`. | `src/lib/status/jobStatusSnapshot.js`, `src/lib/services/vhcStatusService.js` | Used for workflow status (`completed`) and blocking reasons. | Status sidebar snapshot, dashboards |
| `jobs.vhc_sent_at` | timestamp or null | VHC sent marker for workflow status. | `src/lib/services/jobStatusService.js` via `autoSetVHCSentStatus`; `src/lib/services/vhcStatusService.js` | `src/lib/status/jobStatusSnapshot.js`, `src/lib/services/vhcStatusService.js` | Used for workflow status (`sent`) and gating authorize/decline actions. | Status sidebar snapshot, dashboards |
| `jobs.additional_work_authorized_at` | timestamp or null | Additional work authorized marker for workflow status. | `src/lib/services/jobStatusService.js` via `autoSetAdditionalWorkRequiredStatus`. | `src/lib/status/jobStatusSnapshot.js` | Used for workflow status (`authorised`). | Status sidebar snapshot |
| `vhc_workflow_status.status` | free text; typical values in `src/lib/vhc/summary.js`: "VHC not started", "In progress", "Waiting for parts", "Sent to customer", "Awaiting approval", "Approved", "Declined", "Completed" | Display status for customer portal summaries. | No write path found in this repo. | `src/customers/hooks/useCustomerPortalData.js`, `src/components/VHC/VhcDetailsPanel.js` (workflow data load) | Not applied to VHC summary table; only high-level portal labels. | Customer portal summaries |
| `vhc_send_history.sent_at` | timestamp | Logged when VHC is sent to customer. | `src/lib/services/vhcStatusService.js` | `src/lib/status/jobStatusSnapshot.js` (via `vhc_sent_at`) | Contributes to workflow status and history. | Status sidebar snapshot |
| `vhc_authorizations.authorized_at` | timestamp | Logged when customer authorizes additional work. | `src/lib/services/vhcStatusService.js` | `src/lib/status/jobStatusSnapshot.js` | Contributes to workflow status (`authorised`). | Status sidebar snapshot |
| `vhc_declinations.declined_at` | timestamp | Logged when customer declines additional work. | `src/lib/services/vhcStatusService.js`, `src/pages/api/vhc/declinations/index.js` | `src/lib/status/jobStatusSnapshot.js` | Contributes to workflow status (`declined`). | Status sidebar snapshot |
| VHC builder payload `concerns[].status` | `Red`, `Amber`, `Green` | Severity per concern; rolled up to item + section severity. | VHC section modals (External/Internal/Underside/Service/Wheels/Brakes). | `src/lib/vhc/summary.js`, `src/components/VHC/VhcDetailsPanel.js` | Red/amber items become summary rows; green only appears in Green Checks section. | VHC Summary + Health Check tabs |
| VHC builder payload `brakesHubs.*.status` | `Red`, `Amber`, `Green` (pads/discs), `Good`/`Monitor`/`Replace` (drums) | Severity for brake pad/disc/drum sections; normalized in summary. | `src/components/VHC/BrakesHubsDetailsModal.js` | `src/lib/vhc/summary.js`, `src/components/VHC/VhcDetailsPanel.js` | Drum status normalized by `normaliseStatus` (Good->Green, Monitor->Amber, Replace->Red). | VHC Summary + Health Check tabs |
| VHC builder payload `serviceIndicator.serviceChoice`, `serviceIndicator.oilStatus` | `reset`, `not_required`, `no_reminder`, `indicator_on`; `Good`, `Bad`, `EV` | Service indicator and oil status influence severity in summary. | `src/components/VHC/ServiceIndicatorDetailsModal.js` | `src/lib/vhc/summary.js` | Oil status: Bad->Red; Good/EV->Green. | VHC Summary + Health Check tabs |

## Summary row logic by section (VHC summary/health check)

| Section name | Row type | Fields used | Logic (exact conditions in code) | UI label or badge shown | Color mapping | Where the row status is rendered |
| --- | --- | --- | --- | --- | --- | --- |
| Wheels & Tyres | Wheel rows (NSF/OSF/NSR/OSR) and Spare/Kit | VHC builder payload: `wheelsTyres.*.tread`, `wheelsTyres.*.concerns[].status` | `determineTreadSeverity` uses average tread depth: <=2.5 -> Red, <=3.5 -> Amber, else Green. Row status is dominant of tread severity + concern statuses (`determineDominantStatus`). | Badge uses normalized Red/Amber/Green label. | `SEVERITY_THEME` in `VhcDetailsPanel`; tyre diagram uses danger/advisory/good. | `src/lib/vhc/summary.js` + `src/components/VHC/VhcDetailsPanel.js` (Summary + Health Check tabs) |
| Brakes & Hubs | Front/Rear Pads | `frontPads.measurement`, `frontPads.status`, `frontPads.concerns[].status` (same for rear) | Row status = `normaliseStatus(pad.status)` or dominant concern status. Measurement displayed but not used to set status in summary. | Badge shows normalized status (Red/Amber/Green). | `SEVERITY_THEME` in `VhcDetailsPanel`; brake diagram uses critical/advisory/good. | `src/lib/vhc/summary.js` + `src/components/VHC/VhcDetailsPanel.js` |
| Brakes & Hubs | Front/Rear Discs | `disc.measurements.status`, `disc.visual.status`, `disc.concerns[].status` | Row status = dominant of measurement status + visual status + concern statuses. | Badge shows normalized status (Red/Amber/Green). | `SEVERITY_THEME` in `VhcDetailsPanel`. | `src/lib/vhc/summary.js` + `src/components/VHC/VhcDetailsPanel.js` |
| Brakes & Hubs | Rear Drums | `rearDrums.status`, `rearDrums.concerns[].status` | Status normalized by `normaliseStatus` (Good->Green, Monitor->Amber, Replace->Red) or concern status. | Badge shows normalized status. | `SEVERITY_THEME` in `VhcDetailsPanel`. | `src/lib/vhc/summary.js` + `src/components/VHC/VhcDetailsPanel.js` |
| Service Indicator & Under Bonnet | Service reminder/oil item | `serviceChoice`, `oilStatus`, `concerns[].status` | `derivedOilStatus` maps Bad->Red, Good/EV->Green; row status is `normaliseStatus(service.status)` or dominant of serviceChoice + derivedOilStatus. Concerns add Red/Amber/Green counts. | Badge shows normalized status; concern pills show Red/Amber/Green counts. | `SEVERITY_THEME` in `VhcDetailsPanel`; pill styles in modal. | `src/lib/vhc/summary.js` + `src/components/VHC/VhcDetailsPanel.js` |
| External | Concern rows per category | `externalInspection.*.concerns[].status` | Each concern becomes its own row; status comes from concern status. If no concerns, entry status can be used but modal does not set it. | Concern status text (Red/Amber/Green). | `SEVERITY_THEME` in `VhcDetailsPanel`. | `src/lib/vhc/summary.js` + `src/components/VHC/VhcDetailsPanel.js` |
| Internal | Concern rows per category | `internalElectrics.*.concerns[].status` | Same as External: one row per concern with its status. | Concern status text (Red/Amber/Green). | `SEVERITY_THEME` in `VhcDetailsPanel`. | `src/lib/vhc/summary.js` + `src/components/VHC/VhcDetailsPanel.js` |
| Underside | Concern rows per category | `underside.*.concerns[].status` | Same as External: one row per concern with its status. | Concern status text (Red/Amber/Green). | `SEVERITY_THEME` in `VhcDetailsPanel`. | `src/lib/vhc/summary.js` + `src/components/VHC/VhcDetailsPanel.js` |
| Summary table (all sections) | Summary row status dot | `vhc_checks.approval_status`, `vhc_checks.labour_complete`, `vhc_checks.parts_complete`, parts costs, labour hours, parts-not-required | `resolveRowStatusState` order: if approval status is completed -> Completed (green tick). If authorized -> Approved (green). If declined -> Declined (red cross). Else (pending): if missing labour and parts -> "Add labour & parts"; missing labour -> "Add labour"; missing parts -> "Add parts"; otherwise "Awaiting decision". | Status dot tooltip shows label; status column uses colored dot. | Colors: success for approved/completed, danger for declined, warning for missing/awaiting. | `src/components/VHC/VhcDetailsPanel.js` in Summary tab tables |

---

# VHC Status Surfaces

## VHC summary + health check UI
- `src/components/VHC/VhcDetailsPanel.js` - summary tables and health check cards; uses `vhc_checks.approval_status`, `display_status`, `labour_complete`, `parts_complete`, plus VHC builder payload severity.
- `src/components/VHC/VhcSharedComponents.js` - severity badge styling for red/amber/green/authorized/declined.

## Section modals (status capture)
- `src/components/VHC/WheelsTyresDetailsModal.js` - concern statuses (Red/Amber/Green) and tread-derived severity for tyres; provides diagram severity.
- `src/components/VHC/BrakesHubsDetailsModal.js` - pad/disc/drum statuses and concerns; maps to diagram severity and builder payload values.
- `src/components/VHC/ServiceIndicatorDetailsModal.js` - service choice, oil status, and concern statuses (Red/Amber/Green).
- `src/components/VHC/ExternalDetailsModal.js` - concern statuses (Red/Amber/Green).
- `src/components/VHC/InternalElectricsDetailsModal.js` - concern statuses (Red/Amber/Green).
- `src/components/VHC/UndersideDetailsModal.js` - concern statuses (Red/Amber/Green).

## Diagram status rendering
- `src/components/VHC/TyreDiagram.js` - converts tread depth into `danger/advisory/good/unknown` statuses for diagram fill.
- `src/components/VHC/BrakeDiagram.js` - converts pad thickness into `critical/advisory/good/unknown` statuses for diagram fill.

## Job card + parts surfaces
- `src/pages/job-cards/[jobNumber].js` - resolves VHC severity from checks; shows highlighted red/amber items.
- `src/components/PartsTab_New.js` - pulls VHC check titles/descriptions when building job parts descriptions.
- `src/components/popups/InvoiceBuilderPopup.js` - labels parts/VHC items by origin (VHC link).
- `src/pages/stock-catalogue.js` - displays VHC item ID badge when parts are linked to VHC.

## Status snapshot + workflow views
- `src/lib/status/jobStatusSnapshot.js` - derives `workflows.vhc.status` from job timestamps and authorization/declination history.
- `src/components/StatusTracking/StatusSidebar.js` - renders workflow snapshot status data from `/api/status/snapshot`.
- `src/lib/status/catalog/timeline.js` - maps VHC sub-status labels to timeline events.
- `src/lib/status/catalog/job.js` - includes `vhc_*` sub-status ids in job status catalog.

## VHC totals + summary logic
- `src/lib/vhc/summary.js` - builds section-level status/metrics from VHC builder payload.
- `src/lib/vhc/calculateVhcTotals.js` - reads `approval_status` and `display_status` for totals.

## Customer portal
- `src/customers/hooks/useCustomerPortalData.js` - reads `vhc_workflow_status.status`, counts, and timestamps for customer-facing VHC summary.

## Dashboards
- `src/lib/database/dashboard/service.js` - uses `vhc_checks` to build weekly severity trends.
- `src/components/dashboards/AfterSalesManagerDashboard.js` - counts VHC sent events by `vhc_sent_at` / send history.

---

# VHC Status Write Paths

## VHC item approval/display status
- `src/pages/api/vhc/update-item-status.js`
  - Method: PATCH/POST
  - Payload: `{ vhcItemId, approvalStatus, displayStatus, labourHours, partsCost, totalOverride, labourComplete, partsComplete, approvedBy }`
  - Writes: `vhc_checks.approval_status`, `display_status`, `labour_hours`, `parts_cost`, `total_override`, `labour_complete`, `parts_complete`, `approved_at`, `approved_by`, `updated_at`.
  - Notes: if `approvalStatus` is authorized/declined/completed and `displayStatus` not provided, API sets `display_status` to the approval status; for pending resets, UI must pass `displayStatus` to restore severity.

- `src/components/VHC/VhcDetailsPanel.js`
  - `updateEntryStatus` and `handleBulkStatus` call `/api/vhc/update-item-status` to set approval state (single + bulk).
  - Auto-syncs `partsComplete` based on parts/not-required and calls `/api/vhc/update-item-status`.
  - `persistLabourHours` calls `/api/vhc/update-item-status` to set `labourHours` + `labourComplete`.

## VHC item creation (vhc_checks rows)
- `src/pages/api/jobcards/create-vhc-item.js`
  - Method: POST
  - Payload: `{ jobId, jobNumber, section, issueTitle, issueDescription, measurement, labourHours }`
  - Writes: new `vhc_checks` row with `labour_hours` (and timestamps).

- `src/pages/api/jobcards/[jobNumber]/parse-checksheet.js`
  - When `saveToDatabase=true`, calls `createVHCCheck` per parsed field.
  - Writes: `vhc_checks` rows with `section`, `issue_title`, `issue_description` (note: includes a `status` field in payload, but schema does not include a `status` column).

## VHC workflow timestamps on jobs
- `src/lib/services/jobStatusService.js`
  - `autoSetVHCCompleteStatus` -> updates `jobs.vhc_completed_at` and logs sub-status `VHC Completed`.
  - `autoSetVHCSentStatus` -> updates `jobs.vhc_sent_at` and logs sub-status `Sent to Customer`.
  - `autoSetAdditionalWorkRequiredStatus` -> updates `jobs.additional_work_authorized_at` and logs sub-status `Customer Authorised`.

- `src/lib/services/vhcStatusService.js`
  - `markVHCAsSent` -> inserts `vhc_send_history` and calls `autoSetVHCSentStatus`.
  - `authorizeAdditionalWork` -> inserts `vhc_authorizations` and calls `autoSetAdditionalWorkRequiredStatus`.
  - `declineAdditionalWork` -> inserts `vhc_declinations`, adds job note, logs sub-status `Customer Declined`.

## Declinations API
- `src/pages/api/vhc/declinations/index.js`
  - Method: POST
  - Payload: `{ job_id | jobId, declined_by | declinedBy, customer_notes | customerNotes }`
  - Writes: `vhc_declinations` via `createDeclination`.

## VHC workflow table (not wired in UI)
- `src/lib/database/vhc.js`
  - `upsertVhcWorkflowStatus` can write `vhc_workflow_status`, but no call sites were found in this repo.

## Supporting write paths
- `src/pages/api/parts/vhc-labour.js`
  - Updates `parts_job_items.labour_hours` for items linked to `vhc_item_id` (affects labour completeness logic in summary).
- `src/pages/api/vhc/item-aliases.js`
  - Upserts `vhc_item_aliases` for mapping display IDs to `vhc_checks.vhc_id`.
