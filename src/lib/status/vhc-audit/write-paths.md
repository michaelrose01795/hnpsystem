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
