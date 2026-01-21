# VHC Status Audit

This folder documents how VHC row statuses work across the app based on current code and queries. It does not change behavior or schema.

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
