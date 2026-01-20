## Status Action Inventory

Scope: every function, button, API route, and server action that changes job status or a job-linked workflow status. Statuses include `jobs.status`, `jobs.waiting_status`, job sub-status timeline entries, VHC item approval states, parts request/line statuses, appointment/booking request status, and vehicle/key tracking status.

---

## Job Status: Main Status (`jobs.status`)

### Create job card (Open)
- Feature area: Job creation
- Page or component file path: `src/api/jobcards/index.js`, `src/lib/database/jobs.js`
- Trigger type: API route (POST `/api/jobcards`)
- UI label or function name: `addJobToDatabase`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.status`
- Intended from → to transitions: `null` → `Open`
- Preconditions required: `jobNumber`, `reg` required
- Side effects: Sets `waiting_status`, `job_source`, `job_division`, `job_categories`
- Missing, inconsistent, or buggy behaviour: Status set to `Open` here but other job creation paths use `pending` or `Booked`

### Create job card (pending)
- Feature area: Job creation (alternate path)
- Page or component file path: `src/pages/api/jobcards/create.js`
- Trigger type: API route (POST `/api/jobcards/create`)
- UI label or function name: `handler`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.status`
- Intended from → to transitions: `null` → `pending`
- Preconditions required: vehicle registration, customer, requests
- Side effects: Creates/updates customer and vehicle
- Missing, inconsistent, or buggy behaviour: Uses `pending` which is not in the main status flow and conflicts with `Open/Booked`

### Update job status (shared data layer)
- Feature area: Job status core update
- Page or component file path: `src/lib/database/jobs.js`
- Trigger type: Server helper function
- UI label or function name: `updateJob`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.status`, `jobs.status_updated_at`, `jobs.status_updated_by`
- Intended from → to transitions: Any main status in `statusFlow` (validated)
- Preconditions required: `status` must resolve to a main status; invoiced requires sub-statuses; complete requires invoice
- Side effects: Inserts into `job_status_history`; fires `notifyJobStatusChange`
- Missing, inconsistent, or buggy behaviour: No mandatory UI refresh hook; status history insert is best-effort only

### Update job status (simple wrapper)
- Feature area: Job status helper
- Page or component file path: `src/lib/database/jobs.js`
- Trigger type: Server helper function
- UI label or function name: `updateJobStatus`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.status`
- Intended from → to transitions: Delegates to `updateJob`
- Preconditions required: None beyond `updateJob` validation
- Side effects: Uses `updateJob` side effects
- Missing, inconsistent, or buggy behaviour: None (thin wrapper)

### Update job status (service-role endpoint)
- Feature area: Job status API
- Page or component file path: `src/pages/api/status/update.js`
- Trigger type: API route (POST `/api/status/update`)
- UI label or function name: `handler`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.status`, `jobs.status_updated_at`, `jobs.status_updated_by`
- Intended from → to transitions: Validated against `SERVICE_STATUS_FLOW`
- Preconditions required: `jobId`, `newStatus`, `userId`; invoiced requires sub-statuses; complete requires invoice
- Side effects: Inserts `job_status_history` entry; logs notification placeholders
- Missing, inconsistent, or buggy behaviour: Bypasses shared `updateJob` and duplicates validation logic

### Update job status (jobcard API)
- Feature area: Job status API
- Page or component file path: `src/api/jobcards/[jobNumber].js`
- Trigger type: API route (PUT `/api/jobcards/[jobNumber]`)
- UI label or function name: `handler`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.status`
- Intended from → to transitions: Any
- Preconditions required: `status` required; job exists
- Side effects: Delegates to `updateJobStatus`
- Missing, inconsistent, or buggy behaviour: No explicit transition validation at route level

### Manual status change (job card detail)
- Feature area: Job card detail (admin/service)
- Page or component file path: `src/pages/job-cards/[jobNumber].js`
- Trigger type: UI dropdown/select change
- UI label or function name: `handleStatusChange`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.status`
- Intended from → to transitions: Any selected status
- Preconditions required: `canEdit`, `jobData.id`
- Side effects: Refreshes job data; does not explicitly refresh status sidebar
- Missing, inconsistent, or buggy behaviour: No shared audit function call in UI; relies on `updateJobStatus`

### Manual status change (technician job card)
- Feature area: Tech job card
- Page or component file path: `src/pages/job-cards/myjobs/[jobNumber].js`
- Trigger type: UI action
- UI label or function name: `handleUpdateStatus`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.status`
- Intended from → to transitions: User-selected status
- Preconditions required: job exists, confirmation modal
- Side effects: `triggerNextAction` may log vehicle/key tracking; local state update
- Missing, inconsistent, or buggy behaviour: No enforced sidebar refresh; status validation handled in `updateJob`

### Auto status sync on clock-in
- Feature area: Tech job card
- Page or component file path: `src/pages/job-cards/myjobs/[jobNumber].js`
- Trigger type: Auto logic (effect)
- UI label or function name: `syncJobStatus` effect
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.status` (to "In Progress")
- Intended from → to transitions: Non-`In Progress` → `In Progress`
- Preconditions required: active job clocking record
- Side effects: Uses `updateJob` or `updateJobStatus`; may log sub-status
- Missing, inconsistent, or buggy behaviour: No explicit prerequisite checks beyond `updateJob`

### Manual status change (job cards list view)
- Feature area: Job cards list
- Page or component file path: `src/pages/job-cards/view/index.js`
- Trigger type: UI action (status dropdown)
- UI label or function name: `handleStatusChange`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.status`
- Intended from → to transitions: Any selected status
- Preconditions required: Job exists
- Side effects: Refreshes list; may trigger `triggerNextAction` tracking
- Missing, inconsistent, or buggy behaviour: UI does not request status snapshot refresh explicitly

### Jobs context update
- Feature area: Jobs context
- Page or component file path: `src/context/JobsContext.js`
- Trigger type: Context helper
- UI label or function name: `updateJob`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.status`
- Intended from → to transitions: Any
- Preconditions required: `updatedJob.id`, `updatedJob.status`
- Side effects: Updates in-memory jobs list
- Missing, inconsistent, or buggy behaviour: No explicit audit metadata passed

### Invoice creation updates status
- Feature area: Job card invoice flow
- Page or component file path: `src/pages/job-cards/[jobNumber].js`
- Trigger type: Modal submit (invoice builder)
- UI label or function name: `handleInvoiceBuilderConfirm`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.status`
- Intended from → to transitions: `In Progress` → `Invoiced`
- Preconditions required: Invoice created successfully
- Side effects: Logs sub-statuses (`Pricing Completed`, `Ready for Invoice`); updates job status; redirects to invoice tab
- Missing, inconsistent, or buggy behaviour: Status update may fail after invoice creation (warn only)

### Auto status set: Booked
- Feature area: Status service
- Page or component file path: `src/lib/services/jobStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `autoSetBookedStatus`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.status`, `jobs.status_updated_at`, `jobs.status_updated_by`
- Intended from → to transitions: Any → `Booked`
- Preconditions required: job exists
- Side effects: Logs status history entry
- Missing, inconsistent, or buggy behaviour: Allows non-standard transitions; no sidebar refresh

### Auto status set: Checked In
- Feature area: Status service
- Page or component file path: `src/lib/services/jobStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `autoSetCheckedInStatus`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.status`, `jobs.checked_in_at`, `jobs.status_updated_at`, `jobs.status_updated_by`
- Intended from → to transitions: `Booked` → `Checked In`
- Preconditions required: job exists
- Side effects: Logs status history entry
- Missing, inconsistent, or buggy behaviour: Transition validation only warns; no sidebar refresh

### Auto status set: In Progress
- Feature area: Status service
- Page or component file path: `src/lib/services/jobStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `autoSetWorkshopStatus`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.status`, `jobs.workshop_started_at`, `jobs.status_updated_at`, `jobs.status_updated_by`
- Intended from → to transitions: `Checked In`/`Booked` → `In Progress`
- Preconditions required: Not invoiced or complete
- Side effects: Logs sub-status `Technician Started`
- Missing, inconsistent, or buggy behaviour: Does not enforce sidebar refresh

### Auto status set: Complete
- Feature area: Status service
- Page or component file path: `src/lib/services/jobStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `autoSetCompleteStatus`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.status`, `jobs.completed_at`, `jobs.status_updated_at`, `jobs.status_updated_by`
- Intended from → to transitions: `Invoiced` → `Complete`
- Preconditions required: VHC completed if required; warranty write-up present; invoice exists
- Side effects: Logs status history entry
- Missing, inconsistent, or buggy behaviour: No shared status snapshot refresh; multiple prerequisite checks duplicated with `updateJob`

### Manual status update (service function)
- Feature area: Status service
- Page or component file path: `src/lib/services/jobStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `manualStatusUpdate`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.status`, `jobs.status_updated_at`, `jobs.status_updated_by`
- Intended from → to transitions: Any main status
- Preconditions required: Transition validation; invoiced requires sub-statuses; complete requires invoice
- Side effects: Logs status history entry
- Missing, inconsistent, or buggy behaviour: Not called by UI today (unused)

### Appointment booking sets job to Booked
- Feature area: Appointments
- Page or component file path: `src/pages/appointments/index.js`, `src/lib/database/jobs.js`
- Trigger type: UI form submit
- UI label or function name: Appointment booking flow (`createOrUpdateAppointment`)
- Database row affected: `appointments.appointment_id`, `jobs.id`
- Status field(s) changed: `appointments.status`, `jobs.status`
- Intended from → to transitions: `null` → `Scheduled` (appointment); job to `Booked`
- Preconditions required: job exists, date/time required
- Side effects: Updates local UI state, highlights job
- Missing, inconsistent, or buggy behaviour: Job status updated without shared audit helper

### Check-in flow sets job to Checked In
- Feature area: Appointments / Job card
- Page or component file path: `src/pages/appointments/index.js`, `src/pages/job-cards/[jobNumber].js`
- Trigger type: UI confirmation button
- UI label or function name: `handleCheckIn`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.status`, `jobs.checked_in_at`
- Intended from → to transitions: `Booked` → `Checked In`
- Preconditions required: confirmation prompt, job exists
- Side effects: `triggerNextAction` may log tracking events; local state update
- Missing, inconsistent, or buggy behaviour: Does not refresh status sidebar explicitly

### Job flow automation (background)
- Feature area: Automation
- Page or component file path: `codex/jobFlowAutomation.js`
- Trigger type: Background logic
- UI label or function name: `autoUpdateJobStatus`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.status`
- Intended from → to transitions: `In Progress` → `Waiting for VHC`, `Ready for Workshop`, `Ready for Release`
- Preconditions required: `job.clock_off_time`, `job.vhc_complete`, `job.parts_pending`, `job.vhc_approved`
- Side effects: None beyond status update
- Missing, inconsistent, or buggy behaviour: Uses non-canonical statuses not in `statusFlow`

---

## Job Queue / Waiting Status (`jobs.waiting_status`)

### Update waiting status (job booking flow)
- Feature area: Booking request
- Page or component file path: `src/pages/job-cards/[jobNumber].js`
- Trigger type: UI form submit
- UI label or function name: `handleBookingFlowSave`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.waiting_status`
- Intended from → to transitions: Any → `waitingStatus` value
- Preconditions required: `canEdit`, job exists
- Side effects: Also creates/updates `job_booking_requests` (status `pending`)
- Missing, inconsistent, or buggy behaviour: No audit entry for waiting status changes

### Update waiting status (drag/drop board)
- Feature area: Job waiting board
- Page or component file path: `src/pages/job-cards/waiting/nextjobs.js`, `src/lib/database/jobs.js`
- Trigger type: Drag/drop UI
- UI label or function name: `updateJobPosition`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.waiting_status`
- Intended from → to transitions: Any → new position value
- Preconditions required: Access check on board
- Side effects: Re-indexes positions for multiple jobs
- Missing, inconsistent, or buggy behaviour: No audit/history for queue position changes

---

## Job Sub-Status / History (`job_status_history`)

### Log sub-status event
- Feature area: Status history
- Page or component file path: `src/lib/services/jobStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `logJobSubStatus`
- Database row affected: `job_status_history`
- Status field(s) changed: `job_status_history.to_status`, `job_status_history.from_status`
- Intended from → to transitions: `null` → sub-status label
- Preconditions required: `jobId`, `subStatus`
- Side effects: Ensures job is `In Progress` if not already
- Missing, inconsistent, or buggy behaviour: Sub-status history uses labels; not enforced against canonical set

### Clock-in logs sub-status
- Feature area: Workshop clocking
- Page or component file path: `src/lib/database/jobClocking.js`
- Trigger type: Server helper function
- UI label or function name: `clockInToJob`
- Database row affected: `job_clocking.id`, `job_status_history`
- Status field(s) changed: `job_status_history.to_status`
- Intended from → to transitions: Adds `Technician Started`
- Preconditions required: Valid job and user IDs
- Side effects: Dispatches `statusFlowRefresh` event in browser
- Missing, inconsistent, or buggy behaviour: Does not update main `jobs.status`

### Write-up save logs sub-status or status
- Feature area: Write-up
- Page or component file path: `src/components/JobCards/WriteUpForm.js`
- Trigger type: UI form submit
- UI label or function name: `performWriteUpSave`
- Database row affected: `job_status_history` or `jobs.id`
- Status field(s) changed: Sub-statuses or `jobs.status`
- Intended from → to transitions: Depends on `determineJobStatusFromTasks`
- Preconditions required: write-up saved successfully
- Side effects: Updates job status based on task completion
- Missing, inconsistent, or buggy behaviour: Status decision logic is local to UI; not centralized

---

## VHC Workflow

### VHC item approval status update
- Feature area: VHC checks
- Page or component file path: `src/pages/api/vhc/update-item-status.js`, `src/components/VHC/VhcDetailsPanel.js`
- Trigger type: API route (PATCH/POST `/api/vhc/update-item-status`), UI buttons
- UI label or function name: `handleUpdateItemStatus` (various UI actions)
- Database row affected: `vhc_checks.vhc_id`
- Status field(s) changed: `vhc_checks.approval_status`, `vhc_checks.display_status`, `vhc_checks.labour_complete`, `vhc_checks.parts_complete`
- Intended from → to transitions: `pending` → `authorized`/`declined`/`completed` (or back to pending)
- Preconditions required: `vhcItemId`; approvalStatus must be in allowed set
- Side effects: Sets `approved_at`, `approved_by` when applicable
- Missing, inconsistent, or buggy behaviour: No automatic job sub-status update triggered here

### VHC completion check
- Feature area: VHC workflow
- Page or component file path: `src/lib/services/vhcStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `checkAndUpdateVHCStatus`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.vhc_completed_at`; sub-status `VHC Completed`
- Intended from → to transitions: Adds sub-status when all checks complete
- Preconditions required: VHC required; checks exist; critical measurements complete
- Side effects: Calls `autoSetVHCCompleteStatus`
- Missing, inconsistent, or buggy behaviour: Not wired to UI flows; relies on measurement logic only

### Additional work started (timestamp + sub-status)
- Feature area: VHC workflow
- Page or component file path: `src/lib/services/jobStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `autoSetAdditionalWorkInProgressStatus`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.additional_work_started_at`; sub-status `Technician Started`
- Intended from → to transitions: Adds sub-status when additional work begins
- Preconditions required: job exists
- Side effects: Logs sub-status entry
- Missing, inconsistent, or buggy behaviour: Not wired to UI flows

### Being washed (timestamp only)
- Feature area: Valet workflow
- Page or component file path: `src/lib/services/jobStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `autoSetBeingWashedStatus`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.wash_started_at`
- Intended from → to transitions: N/A (timestamp only)
- Preconditions required: job exists
- Side effects: None
- Missing, inconsistent, or buggy behaviour: No sub-status history entry; no UI wiring

### Warranty QC started (timestamp only)
- Feature area: Warranty workflow
- Page or component file path: `src/lib/services/jobStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `autoSetWarrantyQualityControlStatus`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.warranty_qc_started_at`
- Intended from → to transitions: N/A (timestamp only)
- Preconditions required: job exists
- Side effects: None
- Missing, inconsistent, or buggy behaviour: Not logged in status history; not wired to UI

### Warranty ready to claim (timestamp only)
- Feature area: Warranty workflow
- Page or component file path: `src/lib/services/jobStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `autoSetWarrantyReadyToClaimStatus`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.warranty_ready_at`
- Intended from → to transitions: N/A (timestamp only)
- Preconditions required: job exists
- Side effects: None
- Missing, inconsistent, or buggy behaviour: Not logged in status history; not wired to UI

### VHC sent to customer
- Feature area: VHC workflow
- Page or component file path: `src/lib/services/vhcStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `markVHCAsSent`
- Database row affected: `vhc_send_history`, `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.vhc_sent_at`; sub-status `Sent to Customer`
- Intended from → to transitions: Adds sub-status when VHC sent
- Preconditions required: VHC checks exist and VHC completed
- Side effects: Inserts send history row
- Missing, inconsistent, or buggy behaviour: Not connected to UI; no sidebar refresh

### VHC additional work authorized
- Feature area: VHC workflow
- Page or component file path: `src/lib/services/vhcStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `authorizeAdditionalWork`
- Database row affected: `vhc_authorizations`, `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.additional_work_authorized_at`; sub-status `Customer Authorised`
- Intended from → to transitions: Adds authorization sub-status
- Preconditions required: VHC sent
- Side effects: Inserts authorization record
- Missing, inconsistent, or buggy behaviour: Not connected to UI; no sidebar refresh

### VHC additional work declined
- Feature area: VHC workflow
- Page or component file path: `src/lib/services/vhcStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `declineAdditionalWork`
- Database row affected: `vhc_declinations`, `job_notes`, `job_status_history`
- Status field(s) changed: Sub-status `Customer Declined`
- Intended from → to transitions: Adds declination sub-status
- Preconditions required: VHC sent
- Side effects: Inserts declination record and job note; no main status change
- Missing, inconsistent, or buggy behaviour: Requires manual follow-up to set job status

### VHC declination API
- Feature area: VHC workflow
- Page or component file path: `src/pages/api/vhc/declinations/index.js`, `src/lib/database/vhc.js`
- Trigger type: API route (POST `/api/vhc/declinations`)
- UI label or function name: `createDeclination`
- Database row affected: `vhc_declinations.id`
- Status field(s) changed: None (records declination event only)
- Intended from → to transitions: N/A
- Preconditions required: `job_id` numeric; `declined_by` string; role check
- Side effects: Records declination event only
- Missing, inconsistent, or buggy behaviour: No job status/sub-status update is triggered

### Warranty QC workflow
- Feature area: Warranty workflow
- Page or component file path: `src/lib/services/vhcStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `checkWarrantyJobCompletion`, `completeWarrantyQC`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.warranty_qc_started_at`, `jobs.warranty_ready_at`; sub-statuses
- Intended from → to transitions: QC started → Ready to claim
- Preconditions required: Warranty job; write-up completeness
- Side effects: None beyond timestamps and sub-status
- Missing, inconsistent, or buggy behaviour: Not wired to UI; no status snapshot refresh

---

## Parts Workflow

### Parts job item status updates
- Feature area: Parts lines
- Page or component file path: `src/pages/api/parts/update-status.js`, `src/components/PartsTab_New.js`, `src/components/VHC/VhcDetailsPanel.js`
- Trigger type: API route (PATCH `/api/parts/update-status`), UI buttons and dropdowns
- UI label or function name: `handlePartArrived`, `handleUpdateETA`, `handleUpdatePrePickLocation`, `handlePartStatusUpdate`
- Database row affected: `parts_job_items.id`
- Status field(s) changed: `parts_job_items.status`, `parts_job_items.stock_status`, `parts_job_items.pre_pick_location`, `parts_job_items.eta_date`, `parts_job_items.eta_time`, `parts_job_items.authorised`
- Intended from → to transitions: `on_order` → `stock`; `pending` → `on_order`/`pre_picked`/etc.
- Preconditions required: `partItemId`
- Side effects: UI refresh of parts lists and job data
- Missing, inconsistent, or buggy behaviour: No audit trail or job status synchronization

### Parts request creation
- Feature area: Parts requests (tech)
- Page or component file path: `src/pages/job-cards/myjobs/[jobNumber].js`
- Trigger type: UI submit button
- UI label or function name: `handlePartsRequestSubmit`
- Database row affected: `parts_requests.request_id`
- Status field(s) changed: `parts_requests.status`
- Intended from → to transitions: `null` → `waiting_authorisation`
- Preconditions required: job loaded, requester resolved, description present
- Side effects: Refreshes job data
- Missing, inconsistent, or buggy behaviour: No centralized status/audit handler; no sidebar refresh

### Parts on order (retail/warranty)
- Feature area: Status service
- Page or component file path: `src/lib/services/jobStatusService.js`
- Trigger type: Server helper function
- UI label or function name: `autoSetRetailPartsOnOrderStatus`, `autoSetWarrantyPartsOnOrderStatus`
- Database row affected: `jobs.id`, `job_status_history`
- Status field(s) changed: `jobs.parts_ordered_at`, `jobs.warranty_parts_ordered_at`; sub-status `Waiting for Parts`
- Intended from → to transitions: Adds sub-status
- Preconditions required: job exists
- Side effects: Logs sub-status entry
- Missing, inconsistent, or buggy behaviour: Not wired to UI flows

---

## Tracking Workflow (Vehicle + Key Status)

### Next action prompt submission
- Feature area: Tracking / Next action
- Page or component file path: `src/components/popups/NextActionPrompt.js`, `src/pages/api/tracking/next-action.js`
- Trigger type: Modal submit button
- UI label or function name: `handleSubmit` (Next Action Prompt)
- Database row affected: `key_tracking_events.key_event_id`, `vehicle_tracking_events.event_id`
- Status field(s) changed: `vehicle_tracking_events.status` (e.g., "Awaiting Workshop", "Ready For Collection")
- Intended from → to transitions: Based on `actionType` (`job_checked_in`, `vhc_complete`, `job_complete`)
- Preconditions required: `actionType` supplied
- Side effects: Updates tracking feed
- Missing, inconsistent, or buggy behaviour: No validation against job status; no audit/history link to status sidebar

### Tracking page log/update actions
- Feature area: Tracking dashboard
- Page or component file path: `src/pages/tracking/index.js`, `src/pages/api/tracking/next-action.js`
- Trigger type: Form submit buttons ("Save update", "Update")
- UI label or function name: `handleSave`, `SimplifiedTrackingModal`, `LocationEntryModal`
- Database row affected: `key_tracking_events`, `vehicle_tracking_events`
- Status field(s) changed: `vehicle_tracking_events.status`
- Intended from → to transitions: `job_checked_in`, `job_complete`, `location_update`
- Preconditions required: At least one of job number, reg, or customer
- Side effects: Reloads tracking entries
- Missing, inconsistent, or buggy behaviour: No server-side validation that job exists; no audit/history entry

### Auto movement on job status updates
- Feature area: Tracking automation
- Page or component file path: `src/pages/tracking/index.js`
- Trigger type: Realtime subscription + auto logic
- UI label or function name: `handleAutoMovement`
- Database row affected: `key_tracking_events`, `vehicle_tracking_events`
- Status field(s) changed: `vehicle_tracking_events.status`
- Intended from → to transitions: Based on `AUTO_MOVEMENT_RULES` mapping from job status
- Preconditions required: Supabase realtime update event with changed job status
- Side effects: Inserts tracking events with notes `Auto-sync from status`
- Missing, inconsistent, or buggy behaviour: Duplicate logic relative to `NextActionPrompt`; no status audit linkage

---

## Booking Request Workflow

### Booking request submission (pending)
- Feature area: Booking request
- Page or component file path: `src/pages/job-cards/[jobNumber].js`, `src/pages/api/job-cards/[jobNumber]/booking-request.js`
- Trigger type: UI form submit
- UI label or function name: `handleBookingFlowSave`
- Database row affected: `job_booking_requests.job_id`
- Status field(s) changed: `job_booking_requests.status`
- Intended from → to transitions: `null` → `pending`
- Preconditions required: Description required
- Side effects: Sends system notification and customer notification
- Missing, inconsistent, or buggy behaviour: Separate status store from job status; no unified audit table

### Booking request approval
- Feature area: Booking request
- Page or component file path: `src/pages/job-cards/[jobNumber].js`, `src/pages/api/job-cards/[jobNumber]/booking-request.js`
- Trigger type: UI form submit
- UI label or function name: `handleBookingApproval` (approval form)
- Database row affected: `job_booking_requests.job_id`
- Status field(s) changed: `job_booking_requests.status` (`approved`)
- Intended from → to transitions: `pending` → `approved`
- Preconditions required: Price estimate and ETA required
- Side effects: Sends approval notifications
- Missing, inconsistent, or buggy behaviour: No linkage to job status transitions

---

## Other Job-Linked Statuses

### Assign technician to job
- Feature area: Job waiting board
- Page or component file path: `src/lib/database/jobs.js`, `src/pages/job-cards/waiting/nextjobs.js`
- Trigger type: Drag/drop UI
- UI label or function name: `assignTechnicianToJob`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.status`
- Intended from → to transitions: Any → `Assigned`
- Preconditions required: Valid technician resolved
- Side effects: None
- Missing, inconsistent, or buggy behaviour: Status `Assigned` not in main status flow

### Unassign technician from job
- Feature area: Job waiting board
- Page or component file path: `src/lib/database/jobs.js`, `src/pages/job-cards/waiting/nextjobs.js`
- Trigger type: Drag/drop UI
- UI label or function name: `unassignTechnicianFromJob`
- Database row affected: `jobs.id`
- Status field(s) changed: `jobs.status`
- Intended from → to transitions: `Assigned` → `Open`
- Preconditions required: Job exists
- Side effects: None
- Missing, inconsistent, or buggy behaviour: No audit entry for assignment changes
