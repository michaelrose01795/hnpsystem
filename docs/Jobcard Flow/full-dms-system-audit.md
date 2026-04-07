# Full DMS System Audit

## 1. Executive Summary
- [Observed] H&P System is a Next.js pages-router monolith with a mixed client/server Supabase data layer. UI pages frequently call `src/lib/database/*` helpers directly from the browser, while API routes under `src/pages/api/*` handle privileged writes, email, DVLA lookup, status automation, and some file flows.
- [Observed] The system’s main operational spine is `customers > vehicles > jobs > job_requests / vhc_checks / parts_job_items / invoices`, with additional cross-cutting systems for `messages`, `job_notes`, `job_clocking`, `key_tracking_events`, `vehicle_tracking_events`, and customer-facing portal reads.
- [Observed] Global app state is composed in [src/pages/_app.js](/mnt/d/hnpsystem/src/pages/_app.js), which mounts `UserProvider`, `JobsProvider`, `ClockingProvider`, `RosterProvider`, `ThemeProvider`, SWR, confirmation/alert providers, and dev overlay providers. The main shell is [src/components/Layout.js](/mnt/d/hnpsystem/src/components/Layout.js).
- [Observed] The true workflow center is the job card stack:
```text
/job-cards/create
> src/lib/database/customers.js / vehicles.js / jobs.js writes
> /appointments
> /job-cards/[jobNumber]
> VHC / parts / notes / clocking / invoice / messaging / tracking / customer portal surfaces
```
- [Observed] The main source-of-truth modules are:
  - `src/lib/database/jobs.js`
  - `src/lib/database/customers.js`
  - `src/lib/database/vehicles.js`
  - `src/lib/database/jobClocking.js`
  - `src/lib/database/notes.js`
  - `src/lib/database/messages.js`
  - `src/lib/database/tracking.js`
  - `src/lib/database/vhc.js`
  - `src/lib/invoices/detailService.js`
  - `src/lib/services/jobStatusService.js`
  - `src/lib/services/vhcStatusService.js`
- [Observed] Access control is split across:
  - login/session shaping in [src/pages/api/auth/[...nextauth].js](/mnt/d/hnpsystem/src/pages/api/auth/%5B...nextauth%5D.js) and [src/context/UserContext.js](/mnt/d/hnpsystem/src/context/UserContext.js)
  - sidebar visibility in [src/config/navigation.js](/mnt/d/hnpsystem/src/config/navigation.js)
  - job-card tab permissions in [src/features/jobCards/workflow/permissions.js](/mnt/d/hnpsystem/src/features/jobCards/workflow/permissions.js)
  - selective API wrappers via `withRoleGuard`
  - many inline page-level role checks
- [Observed] The biggest integrity risks are duplicated source-of-truth fields and parallel legacy paths:
  - `vehicles.registration` and `vehicles.reg_number`
  - `jobs.requests` JSON snapshot and normalized `job_requests`
  - `jobs.milage` typo versus vehicle `mileage`
  - `vhc_checks.approval_status` and `vhc_checks.authorization_state`
  - `authorized` and `authorised` spelling variants in parts/VHC flows
  - local filesystem uploads under `public/uploads/*` mixed with Supabase storage buckets
  - stale or partial routes/APIs such as `src/pages/api/jobcards/create.js`, `src/hooks/useClocking.js`, and `src/config/navLinks.js`
- [Observed] Coverage note: data-bearing pages, hooks, selectors, helpers, APIs, and storage flows were traced. Generic presentational atoms under `src/components/ui`, `calendarAPI`, `dropdownAPI`, `searchBarAPI`, `tabAPI`, and `timePickerAPI` are inventoried but not expanded line-by-line when they do not own data reads or writes.

## 2. Full Route Map
- [Observed] Full non-API page inventory from `find src/pages -type f | sort`:
```text
/
/login
/newsfeed
/profile
/messages
/tracking
/appointments
/clocking
/clocking/[technicianSlug]
/dashboard
/dashboard/accounts
/dashboard/admin
/dashboard/after-sales
/dashboard/managers
/dashboard/mot
/dashboard/painting
/dashboard/parts
/dashboard/service
/dashboard/valeting
/dashboard/workshop
/job-cards
/job-cards/create
/job-cards/view
/job-cards/[jobNumber]
/job-cards/myjobs
/job-cards/myjobs/[jobNumber]
/job-cards/waiting/nextjobs
/job-cards/archive
/job-cards/appointments
/job-cards/valet/[jobnumber]
/vhc
/vhc/customer-preview/[jobNumber]
/vhc/customer-view/[jobNumber]
/vhc/share/[jobNumber]/[linkCode]
/parts
/parts/manager
/parts/create-order
/parts/create-order/[orderNumber]
/parts/deliveries
/parts/deliveries/[deliveryId]
/parts/delivery-planner
/parts/goods-in
/parts/goods-in/[goodsInNumber]
/stock-catalogue
/valet
/tech/dashboard
/tech/efficiency
/tech/consumables-request
/workshop
/workshop/consumables-tracker
/accounts
/accounts/create
/accounts/edit/[accountId]
/accounts/view/[accountId]
/accounts/transactions/[accountId]
/accounts/invoices
/accounts/invoices/[invoiceId]
/accounts/reports
/accounts/settings
/company-accounts
/company-accounts/[accountNumber]
/admin/users
/admin/profiles/[user]
/customers
/customers/[customerSlug]
/customer
/customer/messages
/customer/parts
/customer/payments
/customer/vehicles
/customer/vhc
/hr
/hr/attendance
/hr/disciplinary
/hr/employees
/hr/leave
/hr/manager
/hr/payroll
/hr/performance
/hr/recruitment
/hr/reports
/hr/settings
/hr/training
/password-reset/reverted
/dev/status-snapshot
/dev/user-diagnostic
/unauthorized
```
- [Observed] Core shell/auth routes:
  - `/` in [src/pages/index.js](/mnt/d/hnpsystem/src/pages/index.js) redirects unauthenticated users to `/login`, customer-role users to `/customer`, and everyone else to `/newsfeed`.
  - `/login` in [src/pages/login.js](/mnt/d/hnpsystem/src/pages/login.js) supports NextAuth credentials login, dev-user selection from `/api/users/roster`, and password reset via `/api/auth/password-reset`. Tables touched indirectly: `users`.
  - `/unauthorized` is a display route used by [src/components/ProtectedRoute.js](/mnt/d/hnpsystem/src/components/ProtectedRoute.js).
- [Observed] Primary operational routes:
  - `/job-cards/create` in [src/pages/job-cards/create/index.js](/mnt/d/hnpsystem/src/pages/job-cards/create/index.js) is the main intake route. Roles are functionally service/admin/workshop-facing. It loads customers, vehicle lookups, request presets, DVLA lookup, uploads, checksheet state, and writes `customers`, `vehicles`, `jobs`, `job_requests`, `job_request_detections`, `job_cosmetic_damage`, `job_customer_statuses`, `job_files`, `job_check_sheets`, `job_check_sheet_checkboxes`.
  - `/appointments` in [src/pages/appointments/index.js](/mnt/d/hnpsystem/src/pages/appointments/index.js) is the service reception / check-in board. It loads jobs, appointments, tech availability from `job_clocking`, and can check jobs in via `createOrUpdateAppointment` plus `autoSetCheckedInStatus`.
  - `/job-cards/view` in [src/pages/job-cards/view/index.js](/mnt/d/hnpsystem/src/pages/job-cards/view/index.js) is the job list / triage surface. It reads jobs with appointment/VHC/status context and links into detail routes.
  - `/job-cards/[jobNumber]` in [src/pages/job-cards/[jobNumber].js](/mnt/d/hnpsystem/src/pages/job-cards/%5BjobNumber%5D.js) is the main detail workflow route. It loads through `useJob()` and `getJobByNumber()`, then fans into notes, write-up, VHC, parts, tracking, documents, messaging, invoice, warranty, and clocking systems.
- [Observed] Technician/workshop routes:
  - `/job-cards/myjobs` in [src/pages/job-cards/myjobs/index.js](/mnt/d/hnpsystem/src/pages/job-cards/myjobs/index.js) is technician/MOT workload. It filters `getAllJobs()` by assignment/current user and reads open `job_clocking`.
  - `/job-cards/myjobs/[jobNumber]` is the technician-focused detail view of the same job stack.
  - `/job-cards/waiting/nextjobs` in [src/pages/job-cards/waiting/nextjobs.js](/mnt/d/hnpsystem/src/pages/job-cards/waiting/nextjobs.js) is the workshop allocation board. It assigns/unassigns technicians and reads `jobs`, `job_requests`, `vhc_checks`, and `users`.
  - `/clocking` and `/clocking/[technicianSlug]` are clocking dashboards. Attendance source-of-truth is `time_records` via `/api/profile/clock`, while job-level clocking remains `job_clocking`.
  - `/tracking` in [src/pages/tracking/index.js](/mnt/d/hnpsystem/src/pages/tracking/index.js) is the parking/key tracker. It reads `fetchTrackingSnapshot()` and writes via `/api/tracking/next-action`.
  - `/valet` and `/job-cards/valet/[jobnumber]` are valet-facing job and clocking surfaces. They are role-gated inline rather than globally protected.
- [Observed] VHC routes:
  - `/vhc` is the internal VHC overview route.
  - `/vhc/customer-preview/[jobNumber]` in [src/pages/vhc/customer-preview/[jobNumber].js](/mnt/d/hnpsystem/src/pages/vhc/customer-preview/%5BjobNumber%5D.js) is the internal preview used before customer sending. It reads `jobs`, `vhc_checks`, `parts_job_items`, `job_files`.
  - `/vhc/customer-view/[jobNumber]` wraps [src/components/VHC/VhcDetailsPanel.js](/mnt/d/hnpsystem/src/components/VHC/VhcDetailsPanel.js) in customer mode. Internal staff can navigate back to workshop view; customer-role users see a stripped authorisation surface.
  - `/vhc/share/[jobNumber]/[linkCode]` in [src/pages/vhc/share/[jobNumber]/[linkCode].js](/mnt/d/hnpsystem/src/pages/vhc/share/%5BjobNumber%5D/%5BlinkCode%5D.js) is the public no-login share page. It validates `job_share_links`, then reads `jobs`, `vhc_checks`, `parts_job_items`, `job_files`.
- [Observed] Customer portal routes:
  - `/customer`, `/customer/messages`, `/customer/parts`, `/customer/payments`, `/customer/vehicles`, `/customer/vhc` are thin wrappers around `src/customers/pages/*`. The primary data hook is [src/customers/hooks/useCustomerPortalData.js](/mnt/d/hnpsystem/src/customers/hooks/useCustomerPortalData.js).
  - `/customer` reads `customers`, `vehicles`, `jobs`, `job_files`, `vhc_workflow_status`, `parts_catalog`, `customer_payment_methods`, `payment_plans`, `invoices`, `payment_links`, `/api/status/getHistory`, `/api/customer/widgets`.
  - `/customer/messages` depends on the shared messaging system plus customer-linked thread membership.
  - `/customer/vhc` reads customer-visible VHC summaries and customer-visible VHC media from `job_files.visible_to_customer`.
- [Observed] Parts routes:
  - `/parts` in [src/pages/parts/index.js](/mnt/d/hnpsystem/src/pages/parts/index.js) is only a redirect to `/stock-catalogue`.
  - `/stock-catalogue` is the live stock catalogue entry point.
  - `/parts/manager` in [src/pages/parts/manager.js](/mnt/d/hnpsystem/src/pages/parts/manager.js) is the manager dashboard reading `parts_job_items`, `deliveries`, `delivery_stops`, pipeline summary data, and parts APIs.
  - `/parts/create-order` and `/parts/create-order/[orderNumber]` are parts order card flows using `parts_order_cards` and `parts_order_card_items`.
  - `/parts/deliveries` and `/parts/deliveries/[deliveryId]` are delivery workflows backed by `deliveries`, `delivery_stops`, and delivery APIs.
  - `/parts/goods-in` and `/parts/goods-in/[goodsInNumber]` are goods-in receiving routes backed by goods-in APIs and inventory tables.
- [Observed] Accounts/company account routes:
  - `/accounts/*` covers retail accounts, transactions, invoice browsing, and reports.
  - `/company-accounts/*` is separately guarded with [src/components/ProtectedRoute.js](/mnt/d/hnpsystem/src/components/ProtectedRoute.js).
  - These routes use API routes under `/api/accounts/*`, `/api/company-accounts/*`, `/api/invoices/*`, and likely touch `accounts`, `transactions`, `company_accounts`, `invoices`, `invoice_payments`, and settings tables.
- [Observed] HR routes:
  - `/hr/*` pages are dashboard and admin surfaces backed by `/api/hr/*`.
  - Core tables observed through APIs and hooks: `users`, attendance tables, leave request tables, training-course tables, payroll-related tables.
- [Observed] Messaging route:
  - `/messages` in [src/pages/messages/index.js](/mnt/d/hnpsystem/src/pages/messages/index.js) uses `useMessagesApi`, the message thread APIs, realtime Supabase subscriptions, and slash-command style deep links into job cards, tracking, HR, parts, appointments, archive, and invoice routes.
- [Observed] Dashboard routes:
  - `/dashboard` redirects users based on role.
  - `/dashboard/workshop`, `/dashboard/service`, `/dashboard/after-sales`, `/dashboard/managers`, `/dashboard/parts`, and others are role-tailored summary surfaces over the same core job, parts, clocking, and status data.
- [Observed] Hidden/dev routes:
  - `/dev/status-snapshot` and `/dev/user-diagnostic` are explicit development diagnostics.
  - These are not in the standard user navigation and exist to inspect state snapshots and current-user resolution.
- [Inferred] Some routes in `src/pages` are low-logic wrappers or dashboards whose feature logic lives in imported components rather than the route file itself. The inventory above is exact; per-route deep lineage below focuses on the routes that own data mutation or primary workflow transitions.

## 3. Feature Map
- [Observed] Job Cards
  - Entry points: `/job-cards/create`, `/job-cards/view`, `/job-cards/[jobNumber]`, `/job-cards/archive`, `/job-cards/myjobs/[jobNumber]`, `/job-cards/valet/[jobnumber]`.
  - Core components: `Layout`, `NotesTab_New`, `PartsTab_New`, `WriteUpForm`, `VhcDetailsPanel`, `InvoiceSection`, `DocumentsUploadPopup`, `ClockingHistorySection`, `JobWorkflowAssistantCard`, `VhcAssistantPanel`.
  - Hooks: `useJob`, `useJobsList`, `useConfirmation`.
  - Helpers: `addJobToDatabase`, `getJobByNumber`, `updateJob`, `updateJobStatus`, `upsertJobRequestsForJob`, `saveChecksheet`, `resolveJobCardPermissions`, `getInvoiceWorkflowState`, `getNextBestAction`.
  - APIs: `/api/jobcards/[jobNumber]`, `/api/jobcards/link-uploaded-files`, `/api/jobcards/upload-document`, `/api/jobcards/[jobNumber]/send-vhc`, `/api/job-cards/[jobNumber]/share-link`, `/api/status/*`, `/api/invoices/*`.
  - Tables: `jobs`, `job_requests`, `job_request_detections`, `job_notes`, `job_files`, `job_check_sheets`, `job_check_sheet_checkboxes`, `job_writeups`, `job_clocking`, `vhc_checks`, `parts_job_items`, `invoices`, `messages`, `message_threads`, `message_thread_members`.
  - Downstream effects: workshop allocation, technician workload, VHC, parts, messaging, tracking, invoice, customer portal.
- [Observed] Appointments
  - Entry points: `/appointments`, `/job-cards/appointments`.
  - Helpers: `createOrUpdateAppointment`, `getJobsByDate`, `autoSetCheckedInStatus`.
  - Hooks: `useJobsList`, `useNextAction`.
  - Tables: `appointments`, `jobs`, `job_clocking`, `users`, absence tables.
  - Downstream effects: check-in, workshop queue visibility, tracking/logging, status progression.
- [Observed] Workshop / Technician workflow
  - Entry points: `/job-cards/myjobs`, `/job-cards/waiting/nextjobs`, `/dashboard/workshop`, `/clocking`.
  - Helpers: `assignTechnicianToJob`, `unassignTechnicianFromJob`, `updateJobPosition`, `clockInToJob`, `switchJob`, `getUserActiveJobs`, `getWriteUpCompletionState`.
  - Tables: `jobs`, `job_clocking`, `job_writeups`, `job_requests`, `vhc_checks`, `parts_job_items`, `job_status_history`.
  - Downstream effects: tech completion, VHC readiness, invoice blockers, workshop dashboards.
- [Observed] VHC system
  - Entry points: `/job-cards/[jobNumber]?tab=vhc`, `/vhc`, `/vhc/customer-preview/[jobNumber]`, `/vhc/customer-view/[jobNumber]`, `/vhc/share/[jobNumber]/[linkCode]`.
  - Core components: `VhcDetailsPanel`, section detail modals, `VhcAssistantPanel`, shared VHC cells/badges.
  - Helpers: `saveChecksheet`, `upsertVhcIssueRow`, `buildVhcAssistantState`, `buildVhcQuoteLinesModel`, `summariseTechnicianVhc`, `markVHCAsSent`.
  - APIs: `/api/jobcards/create-vhc-item`, `/api/vhc/update-item-status`, `/api/vhc/upload-media`, `/api/vhc/customer-video-upload`, `/api/vhc/pre-pick-location`, `/api/job-cards/[jobNumber]/send-vhc`, `/api/job-cards/[jobNumber]/share-link`.
  - Tables: `vhc_checks`, `vhc_workflow_status`, `vhc_send_history`, `vhc_declinations`, `job_files`, `vhc_customer_media`, `job_share_links`.
  - Downstream effects: parts generation, customer authorisation, invoice totals, customer portal media visibility.
- [Observed] Parts system
  - Entry points: parts manager/dashboard routes, job-card parts tab, create-order routes, delivery/goods-in routes.
  - Core components: `PartsTab_New`, `PartsOpsDashboard`, `DeliverySchedulerModal`, parts delivery log modal.
  - Helpers: `summarizePartsPipeline`, `syncVhcPartsAuthorisation`, VHC quote/part linking helpers.
  - APIs: `/api/parts/job-items`, `/api/parts/allocate-to-request`, `/api/parts/update-status`, `/api/parts/summary`, `/api/parts/deliveries/*`, `/api/parts/goods-in/*`, `/api/parts/orders`.
  - Tables: `parts_job_items`, `parts_requests`, `parts_catalog`, `parts_order_cards`, `parts_order_card_items`, deliveries tables, goods-in tables.
  - Downstream effects: invoice readiness, delivery planning, VHC authorisation completion, manager dashboards.
- [Observed] Messaging system
  - Entry points: `/messages`, job-card `messages` tab, customer portal messaging hub.
  - Hooks: `useMessagesApi`, `useMessagesBadge`.
  - Helpers: `getThreadsForUser`, `getThreadMessages`, `sendThreadMessage`, `createGroupThread`, `ensureDirectThread`, `markThreadRead`.
  - APIs: `/api/messages/threads`, `/api/messages/threads/[threadId]/messages`, `/api/messages/connect-customer`, `/api/messages/users`, `/api/messages/system-notifications`.
  - Tables: `message_threads`, `message_thread_members`, `messages`, `users`.
  - Downstream effects: internal coordination, customer-facing thread creation, message badge counts, slash-command deep links into other features.
- [Observed] Notes system
  - Entry points: job-card notes tab, global notes widget.
  - Helpers: `getNotesByJob`, `createJobNote`, `updateJobNote`, `deleteJobNote`.
  - Tables: `job_notes`.
  - Downstream effects: shared job context, linked request/VHC/part commentary, customer-hidden/internal note separation.
- [Observed] Clocking system
  - Entry points: `/clocking`, `/job-cards/[jobNumber]?tab=clocking`, technician routes, dashboard clocking widgets.
  - Helpers: `clockInToJob`, `clockOutFromJob`, `switchJob`, `getUserActiveJobs`, `/api/profile/clock`.
  - Tables: `job_clocking`, `time_records`, `job_status_history`.
  - Downstream effects: availability, tech job state, workshop history, attendance/payroll.
- [Observed] Tracking system
  - Entry points: `/tracking`, next-action prompts, check-in and job progression triggers.
  - Helpers: `fetchTrackingSnapshot`, `logNextActionEvents`, `updateTrackingLocations`.
  - APIs: `/api/tracking/snapshot`, `/api/tracking/next-action`, `/api/status/getHistory`.
  - Tables: `key_tracking_events`, `vehicle_tracking_events`, plus `jobs` joins.
  - Downstream effects: parking board, key location board, status timeline.
- [Observed] Invoice system
  - Entry points: job-card invoice tab, `/accounts/invoices`, `/accounts/invoices/[invoiceId]`.
  - Helpers: `getInvoiceDetailPayload`, `getInvoiceWorkflowState`, `InvoiceDetailSection`.
  - APIs: `/api/invoices/by-job/[jobNumber]`, `/api/invoices/create`, `/api/invoices/email`, `/api/invoices/share`, `/api/invoices/payments/simulate`.
  - Tables: `invoices`, `invoice_requests`, `invoice_request_items`, `invoice_payments`, `payment_links`, `parts_job_items`, `job_requests`, `job_writeups`, `vhc_checks`.
  - Downstream effects: payment capture, release gating, customer portal outstanding invoices.
- [Observed] Customer portal
  - Entry points: `/customer*`.
  - Core components: `CustomerLayout`, hero/dashboard cards, finance cards, vehicle garage, VHC summary, messaging hub.
  - Hook: `useCustomerPortalData`.
  - APIs: `/api/customer/widgets`, other shared APIs and direct Supabase client reads.
  - Tables: `customers`, `vehicles`, `jobs`, `job_files`, `vhc_workflow_status`, `customer_payment_methods`, `payment_plans`, `invoices`, `payment_links`, `parts_catalog`.
  - Downstream effects: customer self-service visibility into workshop status, VHC, vehicles, payment state, and customer messaging.
- [Observed] User / role system
  - Entry points: `/login`, `/admin/users`, `/api/auth/[...nextauth]`, `/api/users/roster`.
  - Helpers: `getAllUsers`, `getUsersGroupedByRole`, `getUserById`, `ensureDevDbUserAndGetId`, `withRoleGuard`.
  - Tables: `users`.
  - Downstream effects: session shaping, navigation, job-card edit rights, page visibility, attendance, messaging identity.
- [Observed] Dev tools / navigation / theme
  - Entry points: `/dev/status-snapshot`, `/dev/user-diagnostic`, dev overlay providers, sidebar/topbar/global search.
  - Helpers: `sidebarSections`, `navLinksByRole`, theme providers, dev layout overlay registration.
  - Tables: none directly for theme/navigation; dev routes read live app state.

## 4. Smallest-to-Largest Flow Ladder
- [Observed] `Create job card customer form > create page local customer state > addCustomerToDatabase/updateCustomer/createCustomerDisplaySlug > customers.id/firstname/lastname/email/mobile/telephone/address/postcode/contact_preference/slug_key > job create page selected customer > job detail contact tab > customer detail routes > customer portal identity lookup`
- [Observed] `Vehicle registration lookup field > create page reg state > getVehicleByReg / /api/vehicles/dvla / createOrUpdateVehicle > vehicles.vehicle_id/registration/reg_number/make/model/make_model/colour/vin/chassis/engine_number/engine/mileage/customer_id > create page hydrate > appointments > job detail vehicle/service-history sections > staff vehicle history readers > customer portal garage`
- [Observed] `Requests textarea + hours + preset inputs > create page request tabs state > normalizeRequests / request-detection helpers / addJobToDatabase / upsertJobRequestsForJob > jobs.description + jobs.job_categories + jobs.requests + job_requests.description/hours/job_type/sort_order/request_source + job_request_detections.* > job detail customer-requests tab > next jobs board > write-up tasks > invoice builder > parts allocation targets`
- [Observed] `VHC required toggle > create page vhcRequired state > addJobToDatabase(vhc_required) > jobs.vhc_required > permissions.canViewVhcTab / job status helpers / invoice readiness selector > VHC tab visibility > technician blockers > customer preview/send flow`
- [Observed] `Cosmetic damage section > create page cosmetic state > direct supabase insert after job create > job_cosmetic_damage.has_damage/notes > job detail/write-up context and archive snapshot`
- [Observed] `Waiting / collection / loan car status > create page customerStatus and waitingStatus state > addJobToDatabase(waiting_status) + insert job_customer_statuses.customer_status > jobs.waiting_status + job_customer_statuses.customer_status > appointments board > next jobs board > parts delivery scheduling heuristics > tracking/customer handling`
- [Observed] `Documents upload control > /api/jobcards/upload-document temporary file or local public upload > /api/jobcards/link-uploaded-files or addJobFile > job_files.file_name/file_url/file_type/folder/uploaded_by/uploaded_at/visible_to_customer > documents tab > VHC media gallery > customer portal visible VHC media`
- [Observed] `Check sheet PDF/signature UI > create page PDF/checkbox/signature state > Supabase storage buckets user-signatures/job-documents + inserts into job_check_sheets and job_check_sheet_checkboxes > job_check_sheets.* + job_check_sheet_checkboxes.* > job detail/document context > archive snapshot`
- [Observed] `Job detail notes input > local notes state > createJobNote/updateJobNote/deleteJobNote > job_notes.note_text/hidden_from_customer/linked_request_index/linked_vhc_id/linked_part_id and plural link columns > notes tab > shared note card > archive snapshot`
- [Observed] `Technician write-up tasks/checklist > WriteUpForm state > src/lib/database/jobs.js write-up save path > job_writeups.fault/rectification/completion_status/task_checklist/added_fault/added_rectification + jobs.description sync + job_requests.status updates + updateJobStatus('Technician Work Completed') when qualified > write-up tab > invoice blockers/selectors > my jobs completion labels`
- [Observed] `VHC concern rows > VhcDetailsPanel state > saveChecksheet / upsertVhcIssueRow / VHC status APIs > vhc_checks.section/issue_title/issue_description/measurement/approval_status/authorization_state/display_status/labour_hours/parts_cost/request_id/display_id > VHC preview/share/customer view > parts conversion > invoice detail payload`
- [Observed] `VHC media upload > VHC media modal state > /api/vhc/upload-media > addJobFile(..., folder='vhc-media', visible_to_customer) > job_files.visible_to_customer/folder=file metadata > internal VHC photos/videos tabs > customer portal media summaries`
- [Observed] `Customer recorded VHC video > customer video capture UI > /api/vhc/customer-video-upload > Supabase storage bucket vhc-customer-media + vhc_customer_media rows > customer/public VHC media playback`
- [Observed] `Part search/allocate UI > PartsTab_New state > /api/parts/job-items POST and /api/parts/allocate-to-request POST > parts_job_items.part_id/quantity_requested/quantity_allocated/quantity_fitted/status/origin/pre_pick_location/storage_location/unit_cost/unit_price/allocated_to_request_id/vhc_item_id/row_description/authorised > job detail parts tab > parts manager dashboard > invoice detail payload`
- [Observed] `Send VHC action > VHCTab send handler > /api/job-cards/[jobNumber]/send-vhc > job_share_links + vhc_send_history + jobs.vhc_completed_at/vhc_sent_at via markVHCAsSent > public share route + customer email + status timeline`
- [Observed] `Message composer > messages page or job-card messages tab local state > /api/messages/threads/[threadId]/messages > messages.content/thread_id/sender_id/metadata/saved_forever + message_thread_members.last_read_at > messages page thread list > layout unread badge > customer-invited conversations`
- [Observed] `Invite customer to message thread > messages page modal state > /api/messages/connect-customer > customer lookup in customers + user lookup in users + createGroupThread > message_threads/message_thread_members > customer portal messages`
- [Observed] `Check-in / next-action prompt > appointments or tracking UI state > /api/tracking/next-action > key_tracking_events.action/notes/performed_by + vehicle_tracking_events.status/location/notes/created_by > tracking page snapshot > status history merged events`
- [Observed] `Invoice create action > job-card invoice tab state > /api/invoices/create + updateJobStatus('Invoiced') > invoices.* + invoice_items (observed) + notifications row + job_status_history > invoice tab > accounts invoices pages > customer portal outstanding invoices`

## 5. Cross-Feature Workflow Chains
- [Observed] Core retail service flow:
```text
Customer selected or created
> vehicle selected, reused, or DVLA hydrated
> one or more jobs inserted
> normalized job_requests inserted
> appointments/check-in route receives jobNumber
> job card detail loads full context
> workshop allocates or tech clocks on
> write-up and VHC progress update blockers/status
> parts allocations are linked to requests or VHC rows
> invoice detail aggregates requests/VHC/parts/write-up
> job moves to Invoiced
> release is only allowed once invoice exists
```
- [Observed] Technician job chain:
```text
jobs.assigned_to or workshop allocation
> /job-cards/myjobs filters assigned jobs
> job_clocking records active work
> WriteUpForm completion updates job_writeups and request statuses
> VHC completion and write-up readiness can promote job toward Technician Work Completed
> invoice selector sees write-up/VHC/parts blockers
```
- [Observed] VHC chain:
```text
jobs.vhc_required = true
> VHC tab becomes available
> vhc_checks rows created/updated
> customer preview/share route reads vhc_checks and job_files
> send-vhc API creates/refreshes job_share_links and vhc_send_history
> customer/public routes read the same vhc_checks rows
> authorised or completed rows can drive parts requests and invoice lines
```
- [Observed] Parts chain:
```text
job_requests or authorised VHC rows exist
> parts_job_items created manually or from VHC-linked allocation
> allocate-to-request links parts_job_items to request_id or vhc_item_id
> summarizePartsPipeline powers job-card and manager dashboards
> parts pricing/allocation readiness feeds invoice selector
> invoice detail payload reads parts_job_items for pricing
```
- [Observed] Messaging chain:
```text
job card or messages page opens thread
> message_threads define thread
> message_thread_members define participants and unread state
> messages rows carry content and metadata
> Layout badge subscribes to realtime changes
> connect-customer can clone/add customer-facing group thread if customer has a users-table account
```
- [Observed] Tracking chain:
```text
job check-in / movement / next action
> /api/tracking/next-action
> key_tracking_events and vehicle_tracking_events written
> fetchTrackingSnapshot merges latest key and vehicle entries with jobs
> /tracking board and status history surface current state
```
- [Observed] Invoice chain:
```text
job requests + write-up + VHC + parts become consistent
> getInvoiceWorkflowState sees no blockers
> invoice tab enables create
> /api/invoices/create writes invoice header/items and then job status
> /api/invoices/by-job/[jobNumber] rebuilds live/structured payload
> accounts and customer portal read invoice state
```

## 6. Database Lineage Map
- [Observed] `customers`
  - Writers: `addCustomerToDatabase`, `createCustomer`, `updateCustomer`, legacy `/api/jobcards/create`, direct create-page edits.
  - Readers: job create lookup, `getCustomerById`, `getCustomerBySlug`, `getCustomerJobs`, customer routes, customer portal hook, `getJobByNumber`.
  - Key columns: `id`, `firstname`, `lastname`, `email`, `mobile`, `telephone`, `address`, `postcode`, `contact_preference`, `slug_key`.
  - Relationships: `vehicles.customer_id`, `jobs.customer_id`, `accounts.customer_id`, customer portal reads.
- [Observed] `vehicles`
  - Writers: `createOrUpdateVehicle`, `updateVehicle`, legacy `/api/jobcards/create`, staff vehicle flows.
  - Readers: `getVehicleByReg`, `getVehicleById`, `getVehicleMaintenanceHistory`, job detail, appointments, customer portal.
  - Key columns: `vehicle_id`, `registration`, `reg_number`, `make`, `model`, `make_model`, `colour`, `vin`, `chassis`, `engine_number`, `engine`, `mileage`, `customer_id`, `service_history`, `warranty_type`, `warranty_expiry`.
  - Risk: `registration` and `reg_number` are written together for compatibility.
- [Observed] `jobs`
  - Writers: `addJobToDatabase`, `updateJob`, `updateJobStatus`, job create page, status services, legacy `/api/jobcards/create`.
  - Readers: nearly every operational surface through `getJobByNumber`, `getAllJobs`, `getJobsByDate`, `fetchTrackingSnapshot`, customer portal hook, invoice detail service.
  - Key columns used widely: `id`, `job_number`, `customer`, `customer_id`, `vehicle_id`, `vehicle_reg`, `vehicle_make_model`, `waiting_status`, `job_source`, `job_division`, `job_categories`, `requests`, `description`, `type`, `status`, `assigned_to`, `cosmetic_notes`, `vhc_required`, `maintenance_info`, timestamps for workflow progression, prime/sub-job link columns, VHC total columns.
  - Risk: `jobs.requests` remains a legacy JSON snapshot beside normalized `job_requests`.
- [Observed] `appointments`
  - Writers: appointment helpers from `src/lib/database/jobs.js`, appointments page.
  - Readers: appointments board, view jobs, vehicle maintenance history, job detail.
  - Role: scheduled intake/check-in state.
- [Observed] `job_requests`
  - Writers: create page insert path, `upsertJobRequestsForJob`, parts/VHC linking logic.
  - Readers: `getJobByNumber`, invoices detail service, next jobs board, parts allocation API, write-up task sync, customer jobs readers.
  - Key columns: `request_id`, `job_id`, `description`, `hours`, `job_type`, `sort_order`, `status`, `request_source`, `vhc_item_id`, `pre_pick_location`, `note_text`, `job_request_preset_id`.
  - Source-of-truth: current request workflow prefers this table over `jobs.requests`.
- [Observed] `job_request_detections`
  - Writers: create page request-detection insert.
  - Readers: not prominently surfaced in UI; used as persisted job type classification trail.
  - Risk: write path is present, but downstream readers are sparse.
- [Observed] `job_cosmetic_damage`
  - Writers: create page post-job insert.
  - Readers: job detail/archive context.
- [Observed] `job_customer_statuses`
  - Writers: create page post-job insert.
  - Readers: customer handling/waiting/collection/loan logic. Some UIs also rely directly on `jobs.waiting_status`.
  - Risk: `jobs.waiting_status` and `job_customer_statuses.customer_status` are parallel concepts.
- [Observed] `job_files`
  - Writers: `addJobFile`, `/api/jobcards/upload-document`, `/api/jobcards/link-uploaded-files`, `/api/vhc/upload-media`.
  - Readers: `getJobByNumber`, documents tab, VHC preview/share, customer portal hook.
  - Key columns: `file_id`, `job_id`, `file_name`, `file_url`, `file_type`, `uploaded_by`, `folder`, `uploaded_at`, `visible_to_customer`.
  - Risk: schema reference supplied earlier did not show `visible_to_customer`, but active code depends on it.
- [Observed] `job_check_sheets`
  - Writers: create page checksheet upload path.
  - Readers: job detail/archive/document context.
- [Observed] `job_check_sheet_checkboxes`
  - Writers: create page checkbox capture.
  - Readers: check sheet replay/archive context.
- [Observed] `job_writeups`
  - Writers: write-up save path in `src/lib/database/jobs.js`.
  - Readers: job detail, my jobs completion, invoice detail service, vehicle maintenance history.
  - Key columns: `writeup_id`, `job_id`, `technician_id`, `fault`, `rectification`, `completion_status`, `task_checklist`, `added_fault`, `added_rectification`.
- [Observed] `job_notes`
  - Writers: `createJobNote`, `updateJobNote`, dealer-file upload note insertion.
  - Readers: job detail, archive snapshot, shared note display.
  - Key columns: `hidden_from_customer`, link columns for request/VHC/parts traceability.
- [Observed] `job_clocking`
  - Writers: `clockInToJob`, `switchJob`, job detail clocking tab, next jobs/technician flows.
  - Readers: my jobs, appointments availability, status history merge, clocking history section.
  - Key columns: `id`, `user_id`, `job_id`, `job_number`, `clock_in`, `clock_out`, `work_type`, `request_id`.
- [Observed] `time_records`
  - Writers: `/api/profile/clock`.
  - Readers: profile/attendance clocking and likely HR attendance views.
  - Risk: attendance clocking and job clocking are different systems; `src/hooks/useClocking.js` still points at a likely legacy `clocking` table.
- [Observed] `job_status_history`
  - Writers: `/api/status/update`, job status service helpers.
  - Readers: `/api/status/getHistory`, status snapshot builder, timelines, customer portal timeline.
  - Role: audit trail for main and sub-status transitions.
- [Observed] `vhc_checks`
  - Writers: `saveChecksheet`, `upsertVhcIssueRow`, VHC item status APIs, create VHC item API.
  - Readers: job detail VHC tab, customer preview, public share, invoice detail service, next jobs approved-VHC list, customer portal summaries via `vhc_workflow_status`.
  - Key columns: `vhc_id`, `job_id`, `section`, `issue_title`, `issue_description`, `measurement`, `approval_status`, `labour_hours`, `parts_cost`, `total_override`, `labour_complete`, `parts_complete`, `display_status`, `authorization_state`, `severity`, `note_text`, `pre_pick_location`, `request_id`, `display_id`, totals columns.
  - Risk: `approval_status`, `authorization_state`, `display_status`, `Complete`, and spelling variants overlap.
- [Observed] `vhc_workflow_status`
  - Writers: VHC status service / DB helpers.
  - Readers: customer portal hook.
  - Role: summarized customer-facing VHC readiness/sent state.
- [Observed] `vhc_send_history`
  - Writers: `markVHCAsSent`.
  - Readers: VHC status flows and customer-facing summaries.
- [Observed] `vhc_declinations`
  - Writers: declination APIs/helpers.
  - Readers: VHC status service and customer response handling.
- [Observed] `vhc_customer_media`
  - Writers: `/api/vhc/customer-video-upload`.
  - Readers: customer/public VHC media surfaces.
- [Observed] `job_share_links`
  - Writers: `/api/job-cards/[jobNumber]/send-vhc`, `/api/job-cards/[jobNumber]/share-link`.
  - Readers: public VHC share validation.
  - Risk: active table not part of the earlier requested schema list, but it is critical to customer share flow.
- [Observed] `parts_job_items`
  - Writers: `/api/parts/job-items`, `/api/parts/allocate-to-request`, update-status APIs, VHC/parts sync logic.
  - Readers: job detail parts tab, VHC preview/share, parts manager dashboard, invoice detail service, customer portal parts snippets.
  - Key columns: `id`, `job_id`, `part_id`, quantities, `status`, `origin`, `pre_pick_location`, `storage_location`, `unit_cost`, `unit_price`, `request_notes`, `allocated_by`, `vhc_item_id`, `authorised`, `stock_status`, ETA fields, `labour_hours`, `allocated_to_request_id`, snapshots, `row_description`.
  - Risk: allocation can point to either request rows or VHC rows; authorisation spelling is inconsistent.
- [Observed] `parts_requests`
  - Writers: parts/VHC flows outside the direct `parts_job_items` path.
  - Readers: `/api/status/getHistory` merges `parts_requests` into action history.
  - Risk: `parts_requests` and `parts_job_items` appear to overlap conceptually.
- [Observed] `parts_catalog`
  - Writers: inventory APIs.
  - Readers: customer portal featured parts, parts job-item joins, stock catalogue, parts search APIs.
- [Observed] `parts_order_cards`
  - Writers: parts order routes/helpers.
  - Readers: `src/lib/database/partsOrders.js`, create-order routes.
- [Observed] `parts_order_card_items`
  - Writers: parts order routes/helpers.
  - Readers: nested under order cards.
- [Observed] `deliveries` and `delivery_stops`
  - Writers: parts delivery APIs and scheduler modal.
  - Readers: parts manager dashboard, delivery pages.
  - Role: downstream logistics tied to waiting/collection states.
- [Inferred] Goods-in tables
  - Writers/readers: goods-in APIs and routes under `/api/parts/goods-in/*` and `/parts/goods-in*`.
  - Role: receiving and stock update workflow.
- [Observed] `invoices`
  - Writers: `/api/invoices/create`, payment/link systems.
  - Readers: invoice detail service, accounts pages, customer portal outstanding invoices, release gate checks.
  - Key columns: `id`, `job_id`, `customer_id`, `job_number`, `invoice_number`, `payment_status`, totals, `account_id`, `account_number`.
  - Risk: customer portal hook currently reads `total`, `total_vat`, `total_parts`, `total_labour`, `paid`, while schema snippets supplied earlier listed differently named totals; active code may not match reference exactly.
- [Observed] `invoice_requests`
  - Writers: invoice detail/proforma systems.
  - Readers: invoice detail service, realtime invoice section.
  - Risk: `/api/invoices/create` explicitly notes structured request persistence is not fully wired in that path.
- [Observed] `invoice_request_items`
  - Writers: invoice detail/proforma systems.
  - Readers: invoice detail service, realtime invoice section.
- [Observed] `invoice_items`
  - Writers: `/api/invoices/create` observed in API.
  - Readers: invoice views.
  - Risk: this table was not in the original requested list, but the live create API writes it.
- [Observed] `invoice_payments`
  - Readers: invoice detail service.
  - Writers: payment simulation/payment capture flows.
- [Observed] `payment_links`
  - Readers: customer portal outstanding invoices.
  - Writers: invoice payment link/share flows.
- [Observed] `customer_payment_methods`
  - Readers: customer portal payments.
  - Writers: `/api/customer/payment-methods`.
- [Observed] `payment_plans`
  - Readers: customer portal payments.
  - Writers: payment plan APIs/helpers.
- [Observed] `message_threads`
  - Writers: `createGroupThread`, `ensureDirectThread`, customer connect flow.
  - Readers: messages page, job-card messages tab.
- [Observed] `message_thread_members`
  - Writers: thread creation/member APIs.
  - Readers: unread counts, membership checks, customer connect flow.
- [Observed] `messages`
  - Writers: `sendThreadMessage`, message save API.
  - Readers: thread message APIs, realtime badge subscription, job-card messages tab.
  - Risk: `messages.metadata` also stores serialized conversation state, which overlaps with normalized message rows.
- [Observed] `key_tracking_events`
  - Writers: tracking API/helper.
  - Readers: tracking snapshot, status history merge.
- [Observed] `vehicle_tracking_events`
  - Writers: tracking API/helper.
  - Readers: tracking snapshot, status history merge.
- [Observed] `users`
  - Writers: `createUser`, `updateUser`, password reset flow, HR employee flow.
  - Readers: login/auth, roster API, navigation role checks, messages joins, clocking identity, staff dashboards.
  - Risk: user writes are intentionally restricted in `src/lib/database/users.js`, but several features assume a user account already exists for a domain entity.
- [Observed] `company_settings`
  - Writers: `/api/customer/widgets`, company settings APIs.
  - Readers: customer widget configuration, invoice/company profile detail service.
- [Observed] `job_archive`
  - Writers: archive APIs.
  - Readers: `/api/jobcards/[jobNumber]` archive fallback, archive route.
- [Observed] `customer_activity_events`
  - Readers: `getCustomerActivityEvents`.
  - Writers: not traced in the main job/VHC parts flow during this audit.
- [Observed] `accounts`, `transactions`, `company_accounts`
  - Writers/readers: accounts and company-accounts pages/APIs.
  - Role: finance/account management outside the workshop spine.
- [Observed] `staff_vehicle_history` and `staff_vehicles`
  - Writers/readers: `/api/staff/vehicle-history`, sync/payroll deduction helpers.
  - Role: staff vehicle chargeback flow linked optionally to jobs.

## 7. Role and Permission Map
- [Observed] Role categories from [src/config/users.js](/mnt/d/hnpsystem/src/config/users.js):
  - Retail: `Service`, `Service Manager`, `Workshop Manager`, `After Sales Director`, `Techs`, `Parts`, `Parts Manager`, `Parts Driver`, `MOT Tester`, `Valet Service`
  - Sales/admin/finance and company roles: `Sales Director`, `Sales`, `Admin`, `Admin Manager`, `Accounts`, `Accounts Manager`, `Owner`, `General Manager`, and others
  - Customer roles are treated separately for `/customer`
- [Observed] Auth/session enforcement:
  - NextAuth credentials login checks `users.email` and `users.password_hash`.
  - Dev login by `userId` is allowed in non-production and is also supported by `UserContext`.
  - `UserContext` merges session roles and dev roles, writes a dev-role cookie, and resolves `dbUserId`.
- [Observed] Route protection types:
  - Hard redirect protection with [src/components/ProtectedRoute.js](/mnt/d/hnpsystem/src/components/ProtectedRoute.js) is used on selected finance/company account pages.
  - API role guards exist through `withRoleGuard` and `createHandler`, but they are not universal.
  - Many pages use inline `user.roles` checks and simply render “no access” or redirect.
  - Sidebar navigation visibility comes from `sidebarSections`.
- [Observed] Job-card tab permissions:
  - `canEditBase`: service, service manager, workshop manager, admin, admin manager, parts, parts manager
  - `canManageDocumentsBase`: service manager, workshop manager, after-sales manager, admin, admin manager
  - `canViewPartsTab`: workshop manager, service manager, parts, parts manager, after-sales manager
  - `canViewVhcTab`: any role when `vhc_required` is true, or workshop manager regardless
  - `Invoiced`, `Released`, and archive mode lock most tabs read-only
  - `Booked` locks parts/write-up/VHC until check-in/in-progress
- [Observed] Dashboard entry routing:
  - `/dashboard` sends parts manager to `/parts/manager`, parts staff to `/dashboard/parts`, tech/workshop roles to `/dashboard/workshop`, manager roles to `/dashboard/managers`, and service-related roles to specialized dashboards.
- [Observed] Gaps:
  - Some APIs are effectively open or weakly protected, for example `src/pages/api/messages/threads/index.js` and parts job-item creation with placeholder auth.
  - Navigation hiding is not the same as server-side access control.

## 8. Navigation and Entry Map
- [Observed] Main navigation source is [src/config/navigation.js](/mnt/d/hnpsystem/src/config/navigation.js), consumed by [src/components/Layout.js](/mnt/d/hnpsystem/src/components/Layout.js).
- [Observed] Global primary entries:
  - `/newsfeed`
  - `/dashboard`
  - `/messages`
  - `/tracking`
  - `/job-cards/view`
  - `/job-cards/myjobs`
  - `/job-cards/waiting/nextjobs`
  - `/parts/manager`
  - `/stock-catalogue`
  - `/customer`
- [Observed] Secondary/hidden entries:
  - dev routes under `/dev`
  - public VHC share route
  - direct invoice/account detail routes
  - archived job routes
- [Observed] Navigation divergence:
  - `sidebarSections` is the live sidebar model.
  - [src/config/navLinks.js](/mnt/d/hnpsystem/src/config/navLinks.js) is older and references stale or missing paths such as `/jobs`, `/overview`, `/mot`, `/workshop/Clocking`, `/sales`, `/buying`.
  - This makes `navLinks.js` a legacy map, not the reliable route source.
- [Observed] Shell-level navigation helpers:
  - `Layout` injects global search, current-job widget, next-action prompt, messages badge, status sidebar, and mode switcher for role categories.
  - Slash-command links inside the messaging UI can deep-link to jobs, VHC, accounts, orders, tracking, valet, HR, archive, my jobs, and appointments.

## 9. API and Backend Map
- [Observed] Full API inventory from `find src/pages/api -type f | sort`:
```text
/api/accounts/*
/api/admin/users
/api/ai/enhance-summary
/api/auth/[...nextauth]
/api/auth/password-reset
/api/company-accounts/*
/api/cron/auto-clockout
/api/cron/overtime-recurring
/api/customer/payment-methods
/api/customer/profile
/api/customer/widgets
/api/customers/bookings/calendar
/api/customers/deliveries
/api/email-api
/api/hr/*
/api/invoices/*
/api/job-cards/[jobNumber]/booking-request
/api/job-cards/[jobNumber]/send-vhc
/api/job-cards/[jobNumber]/share-link
/api/job-requests/presets/*
/api/jobcards/[jobNumber]
/api/jobcards/[jobNumber]/parse-checksheet
/api/jobcards/[jobNumber]/upload-dealer-file
/api/jobcards/archive/*
/api/jobcards/create
/api/jobcards/create-vhc-item
/api/jobcards/link-uploaded-files
/api/jobcards/upload-document
/api/jobs/[jobNumber]/timeline
/api/messages/*
/api/parts/*
/api/personal/*
/api/postcode-lookup
/api/profile/*
/api/search/global
/api/settings/*
/api/staff/*
/api/status/*
/api/tracking/*
/api/users/roster
/api/vehicles/dvla
/api/vhc/*
/api/welcome-quote
/api/workshop/consumables/*
```
- [Observed] Auth/user APIs:
  - `/api/auth/[...nextauth]`: session creation from `users` or Keycloak tokens.
  - `/api/auth/password-reset`: user password reset path touching `users`.
  - `/api/users/roster`: GET roster and grouped users from `users`.
- [Observed] Job card APIs:
  - `/api/jobcards/[jobNumber]`: GET consolidated job payload through `getJobByNumber`, notes history, customer history.
  - `/api/jobcards/create`: legacy create path writing `customers`, `vehicles`, `jobs`. The live create page does not rely on this as its main save flow.
  - `/api/jobcards/create-vhc-item`: upserts a `vhc_checks` row.
  - `/api/jobcards/link-uploaded-files`: renames locally uploaded temp files and inserts `job_files`.
  - `/api/jobcards/upload-document`: multipart upload to `public/uploads/job-documents`, optional `job_files` insert.
  - `/api/jobcards/[jobNumber]/upload-dealer-file`: multipart upload to `public/uploads/dealer-files`, then inserts a `job_notes` entry instead of `job_files`.
  - `/api/jobcards/archive/create` and `/api/jobcards/archive/search`: archive lifecycle.
- [Observed] Job/VHC send/share APIs:
  - `/api/job-cards/[jobNumber]/send-vhc`: validates job, ensures SMTP, creates or reuses `job_share_links`, sends email, stamps `jobs.vhc_completed_at` if needed, writes `vhc_send_history` via service helper, returns share URL and secondary status.
  - `/api/job-cards/[jobNumber]/share-link`: GET validates public share links and assembles public VHC payload; POST creates/reuses share links.
- [Observed] Status APIs:
  - `/api/status/update`: validates main-status transition, checks invoicing/release prerequisites, updates `jobs.status`, inserts `job_status_history`.
  - `/api/status/getHistory`: merges `job_status_history`, tracking events, `job_clocking`, `parts_requests` into a single timeline/history payload.
  - `/api/status/snapshot`: thin wrapper around `buildJobStatusSnapshot`.
  - `/api/status/getCurrentStatus` and `/api/status/search`: current/snapshot search helpers.
- [Observed] Parts APIs:
  - `/api/parts/job-items`: GET job-linked parts rows; POST inserts `parts_job_items` with placeholder auth that currently returns `{ role: 'admin' }`.
  - `/api/parts/allocate-to-request`: updates `parts_job_items` to link a part to `job_requests` or `vhc_checks`, optionally syncing VHC authorisation.
  - `/api/parts/update-status`, `/api/parts/jobs/*`, `/api/parts/orders`, `/api/parts/on-order`, `/api/parts/summary`: workspace and dashboard support.
  - `/api/parts/deliveries/*` and `/api/parts/goods-in/*`: logistics and receiving.
- [Observed] Messaging APIs:
  - `/api/messages/threads`: GET list threads for a user; POST create direct/group thread.
  - `/api/messages/threads/[threadId]/messages`: GET thread messages and mark read; POST message send.
  - `/api/messages/threads/[threadId]/members`: membership management.
  - `/api/messages/connect-customer`: looks up a `customers` row, ensures a matching `users` account exists, then creates a customer-inclusive group thread.
  - `/api/messages/system-notifications*`: system notification helpers.
- [Observed] Invoice APIs:
  - `/api/invoices/by-job/[jobNumber]`: builds live invoice payload from detail service.
  - `/api/invoices/create`: inserts invoice header and items, then job status moves to invoiced on the page flow.
  - `/api/invoices/email`, `/api/invoices/share`, `/api/invoices/payments/simulate`, `/api/invoices/proforma-overrides`, `/api/invoices/by-order/[orderNumber]`, `/api/invoices/[invoiceId]`: invoice delivery and management.
- [Observed] Tracking APIs:
  - `/api/tracking/next-action`: POST writes key/vehicle tracking events or updates.
  - `/api/tracking/snapshot`: returns merged board state from tracking helper.
  - `/api/tracking/equipment` and `/api/tracking/oil-stock`: equipment/oil tracker state for the tracking page.
- [Observed] Customer portal APIs:
  - `/api/customer/widgets`: GET/PUT widget layout JSON in `company_settings`.
  - `/api/customer/payment-methods`, `/api/customer/profile`: customer financial/profile maintenance.
  - `/api/customers/bookings/calendar`, `/api/customers/deliveries`: customer-facing operational data.
- [Observed] Vehicle/staff utility APIs:
  - `/api/vehicles/dvla`: server-side DVLA proxy, no DB write.
  - `/api/staff/vehicle-history`: POST/PUT/DELETE staff vehicle chargeback rows in `staff_vehicle_history`, optionally linked to a `jobs.id`.
  - `/api/staff/vehicles`, `/api/staff/job-summary`, `/api/staff/vehicle-history/sync`: staff support flows.
- [Observed] Validation/auth quality is uneven:
  - Some APIs do structured validation and role guarding.
  - Some APIs only validate required fields.
  - Some APIs use placeholder auth or no guard.

## 10. File Storage and Upload Flow
- [Observed] Job documents flow:
```text
client upload
> /api/jobcards/upload-document
> write temp/final file under public/uploads/job-documents
> optional addJobFile(job_files, folder='documents')
> /api/jobcards/link-uploaded-files can rename temp-job files after real jobId exists
> job_files rows surface in job detail documents tab
```
- [Observed] Create-page temporary linking:
  - `jobId` may start as `temp-*`.
  - upload-document skips DB insert for temp IDs.
  - after real jobs are created, `/api/jobcards/link-uploaded-files` renames files and inserts `job_files`.
- [Observed] Dealer-file flow:
```text
client upload
> /api/jobcards/[jobNumber]/upload-dealer-file
> write file under public/uploads/dealer-files
> createJobNote note_text='Dealer file uploaded: ...'
> no job_files row created
```
- [Observed] VHC media flow:
```text
client image/video upload
> /api/vhc/upload-media
> write file under public/uploads/vhc-media
> addJobFile(job_files, folder='vhc-media', visible_to_customer flag)
> internal VHC tabs and customer portal media readers use job_files
```
- [Observed] Customer-recorded VHC video flow:
```text
client video upload
> /api/vhc/customer-video-upload
> Supabase storage bucket vhc-customer-media
> vhc_customer_media row inserted with overlays/context metadata
> customer/public VHC media readers consume record
```
- [Observed] Checksheet/signature flow:
  - create page uses Supabase storage buckets `user-signatures` and `job-documents`.
  - metadata is stored in `job_check_sheets` and `job_check_sheet_checkboxes`.
- [Observed] Storage modes in live repo:
  - local public filesystem: `public/uploads/job-documents`, `public/uploads/vhc-media`, `public/uploads/dealer-files`
  - temporary local filesystem: `tmp/uploads`
  - Supabase buckets: `vhc-customer-media`, `user-signatures`, `job-documents`
- [Observed] Risk:
  - file storage is not unified.
  - dealer files are surfaced as notes, not `job_files`.
  - local filesystem uploads on a multi-instance deployment can drift from DB state.

## 11. Status and State Model
- [Observed] Main job statuses from `src/lib/status/statusFlow.js` and `src/lib/services/jobStatusService.js`:
  - `Booked`
  - `Checked In`
  - `In Progress`
  - `Invoiced`
  - `Released`
- [Observed] Status transitions:
  - `/api/status/update` enforces main transition validation.
  - service/job status helpers auto-stamp timestamps such as `checked_in_at`, `workshop_started_at`, `vhc_completed_at`, `vhc_sent_at`, `additional_work_authorized_at`.
  - releasing is blocked unless an invoice exists.
  - invoicing is blocked until required sub-statuses exist.
- [Observed] Sub-status/event model:
  - `job_status_history` stores both main and sub-status changes.
  - `getHistory` and `statusSnapshot` merge these with clocking/tracking/parts events.
- [Observed] Waiting/customer handling:
  - `jobs.waiting_status` is used directly in job lists, parts delivery scheduling, and customer handling logic.
  - `job_customer_statuses.customer_status` stores a related but separate concept.
- [Observed] Technician completion:
  - `job_writeups.completion_status` plus checklist tasks drive derived completion.
  - `jobs.tech_completion_status` is also read in technician pages.
  - `getWriteUpCompletionState` normalizes checklist completion into invoice readiness.
- [Observed] VHC states:
  - row level: `approval_status`, `authorization_state`, `display_status`, `severity`, `Complete`
  - workflow level: `vhc_workflow_status.status`
  - job level: `jobs.vhc_required`, `jobs.vhc_completed_at`, `jobs.vhc_sent_at`, `jobs.additional_work_authorized_at`
- [Observed] Parts statuses:
  - pipeline stages map raw statuses into:
    - `waiting_authorisation`
    - `waiting_to_order`
    - `on_order`
    - `pre_picked`
    - `in_stock`
  - raw row statuses include `pending`, `awaiting_stock`, `on_order`, `pre_picked`, `stock`, `allocated`, `picked`, `fitted`, `cancelled`.
- [Observed] Invoice statuses:
  - job-level main status becomes `Invoiced`.
  - invoice row state includes `payment_status` and `paid`.
  - customer portal shows only unpaid invoices.
- [Observed] Tracking statuses:
  - vehicle tracking uses human-readable `status` and `location`.
  - key tracking uses action labels like `Keys received – ...`, `Keys hung – ...`.
- [Observed] Inconsistencies:
  - some UIs test normalized raw text instead of enumerated constants.
  - some fields are timestamps, others are labels, others are derived selectors.
  - several flows depend on text matching rather than a single enum map.

## 12. Gaps, Duplicates, and Risk Areas
- [Observed] `jobs.requests` and `job_requests` both store request data. Readers increasingly prefer `job_requests`, but fallbacks to the JSON snapshot remain.
- [Observed] `vehicles.registration` and `vehicles.reg_number` are both active and intentionally written together.
- [Observed] `jobs.milage` and `vehicles.mileage` coexist, increasing drift risk between job snapshot mileage and canonical vehicle mileage.
- [Observed] VHC state is split across `approval_status`, `authorization_state`, `display_status`, `Complete`, and job-level timestamps.
- [Observed] `authorised` and `authorized` spellings both appear in active parts/VHC code paths.
- [Observed] [src/hooks/useClocking.js](/mnt/d/hnpsystem/src/hooks/useClocking.js) targets a `clocking` table that does not match the attendance source-of-truth used elsewhere (`time_records`).
- [Observed] [src/config/navLinks.js](/mnt/d/hnpsystem/src/config/navLinks.js) contains stale route mappings and should not be treated as live navigation truth.
- [Observed] [src/pages/api/jobcards/create.js](/mnt/d/hnpsystem/src/pages/api/jobcards/create.js) is a parallel legacy create API and does not match the richer create-page save pipeline.
- [Observed] `/api/invoices/create` writes invoice header/items but explicitly notes structured `invoice_requests` persistence is not fully wired in that path.
- [Observed] customer portal reads `job_files.visible_to_customer`, but that column was not visible in the supplied schema reference snippet; schema docs and live code appear out of sync.
- [Observed] parts job-item POST uses placeholder auth returning `admin`, which is a real security gap if exposed in production.
- [Observed] several APIs and pages depend on inline role checks rather than centralized protection.
- [Observed] tracking updates can `update()` matching rows by `job_id` or `vehicle_id`, which can rewrite multiple historical rows instead of appending immutable events in some branches.
- [Observed] dealer-file uploads create notes rather than `job_files`, so document surfacing is inconsistent.
- [Observed] messaging customer connect requires a `users` table account for the customer email, but there is no observed automated users-table provisioning from customer creation.
- [Observed] local public upload directories and Supabase storage buckets coexist without a single storage abstraction.
- [Observed] invoice detail payload merges structured invoice rows with live job/VHC/parts state, which is useful operationally but means “invoice truth” can be partly reconstructed rather than purely persisted.

## 13. Full End-to-End Lifecycle
- [Observed] End-to-end service lifecycle:
```text
Customer Created or Selected
> Vehicle Created or Reused
> Job Created
> job_requests and request detections created
> optional cosmetic/customer-status/document/checksheet rows linked
> redirect to /appointments
> check-in / appointment scheduling updates
> job appears in /job-cards/view and /job-cards/waiting/nextjobs
> technician allocation and clocking begin
> write-up tasks saved
> VHC rows created and media uploaded
> customer/public VHC share link issued
> authorised VHC work and manual parts requests create parts_job_items
> parts allocated/priced and optionally delivered/goods-in processed
> notes/messages/tracking continue throughout
> invoice payload becomes ready
> invoice created
> job moves to Invoiced
> payment/release flows complete
> archive flow can snapshot job into job_archive
```
- [Observed] How a job becomes a technician job:
```text
jobs.assigned_to or workshop allocation
> /job-cards/myjobs filters by assigned tech / current user
> job_clocking starts
> write-up + VHC + parts blockers become technician-visible
```
- [Observed] How a job becomes a VHC job:
```text
jobs.vhc_required = true or workshop manager view
> VHC tab unlocks
> vhc_checks rows are inserted/updated
> VHC status service stamps send/complete/authorisation milestones
```
- [Observed] How a job becomes a parts job:
```text
job_requests exist or authorised VHC rows exist
> parts_job_items are inserted or linked
> parts manager/dashboard routes pick up row status
> invoice detail service reads priced/allocated parts
```
- [Observed] How a job becomes a messaging thread:
```text
messages page or job-card messages tab
> thread exists in message_threads
> memberships stored in message_thread_members
> messages rows accumulate
> customer can be added if mapped to a users-table account
```
- [Observed] How a job becomes a tracking item:
```text
check-in / next action / movement event
> key_tracking_events and vehicle_tracking_events
> tracking snapshot merges current state
```
- [Observed] How a job becomes an invoice:
```text
write-up complete
> VHC complete or not required
> summary rows resolved
> mileage recorded
> parts allocated and priced
> create invoice action
> invoices + invoice_items written
> jobs.status updated to Invoiced
```

## 14. Suggested Refactor Targets
- [Observed] Collapse all job creation and job update mutations behind a single server-side service layer. Retire `src/pages/api/jobcards/create.js` or rewrite the create page to use it consistently.
- [Observed] Make `job_requests` the only request source-of-truth and demote `jobs.requests` to a generated snapshot or remove it entirely.
- [Observed] Remove `registration` versus `reg_number` duplication with a migration plus compatibility view/helper boundary.
- [Observed] Unify VHC decision state into one canonical enum model and one totals model.
- [Observed] Replace placeholder/open API auth with consistent `withRoleGuard` usage.
- [Observed] Unify file storage behind one abstraction and one metadata table strategy. Dealer files should either be `job_files` or a clearly separate document model, not a note.
- [Observed] Merge attendance clocking and job clocking semantics clearly in docs/code, and delete `src/hooks/useClocking.js` if it is legacy.
- [Observed] Replace text-matching status checks with a single normalized status enum package consumed everywhere.
- [Observed] Reconcile invoice persistence so invoice detail does not need to reconstruct as much live state after creation.
- [Observed] Remove or quarantine stale navigation config in `src/config/navLinks.js`.
- [Observed] Add schema/reference updates for active tables and columns currently missing from docs, especially `job_share_links`, `vhc_customer_media`, `visible_to_customer`, and any delivery/goods-in tables.
- [Observed] Introduce a single customer-account provisioning rule if customer portal messaging is meant to be standard, because `customers` and `users` are currently loosely linked by email.
