# Manual Test Checklist, Changes Since 28df7b1

> Source of truth: `git diff 28df7b1..HEAD` (commits `75dfce6` → `f6aabb5`).
> Working tree at the time of writing this checklist: clean.
> All items below were derived from real diffs of changed files, not from filenames.

---

## 1. Change Impact Summary

### Changed routes (page-level)
- `src/pages/login.js` — passes new `allUsers` prop, default dev department changed `techs` → `workshop`.
- `src/pages/job-cards/[jobNumber].js` — VHC decision/badge logic now driven by `resolveVhcItemState`.
- `src/pages/job-cards/myjobs/[jobNumber].js` — tech parts-request form now allows linking a request to a VHC item via new `parts_requests.vhc_item_id`.
- `src/pages/job-cards/waiting/nextjobs.js` — comment-only change (clarifying note about uppercase status labels).
- `src/pages/customers/[customerSlug].js` — switched to `isInactiveJobStatus` from `statusHelpers`.

### Changed APIs (~130 endpoints touched)
- **Auth wrap (security regression risk).** `withRoleGuard(handler)` was added to *every* API route under:
  - `src/pages/api/parts/**`, `src/pages/api/vhc/**`, `src/pages/api/jobcards/**`, `src/pages/api/job-cards/**`, `src/pages/api/job-requests/**`, `src/pages/api/jobs/**`, `src/pages/api/invoices/**`, `src/pages/api/messages/**`, `src/pages/api/personal/**`, `src/pages/api/hr/**`, `src/pages/api/customers/**`, `src/pages/api/customer/**`, `src/pages/api/staff/**`, `src/pages/api/status/**`, `src/pages/api/tracking/**`, `src/pages/api/users/**`, `src/pages/api/vehicles/**`, `src/pages/api/workshop/consumables/**`, `src/pages/api/search/global.js`, `src/pages/api/email-api.js`, `src/pages/api/ai/enhance-summary.js`, `src/pages/api/settings/company.js`.
  - The signature also changed: handlers now receive `(req, res, session)`.
  - **Highest-risk regression:** any unauthenticated session, missing role mapping, or stale browser tab will start receiving 401/403 from every API. Customer portal/public share routes need a closer look.
- **Material logic changes inside otherwise-wrapped routes:**
  - `src/pages/api/invoices/create.js` — full snapshot persistence + structured-totals summarisation + missing-column fallback. Restricted via `withRoleGuard(handler, { allow: [...HR_CORE_ROLES, ...MANAGER_SCOPED_ROLES] })`.
  - `src/pages/api/jobcards/upload-document.js`, `src/pages/api/jobcards/[jobNumber]/upload-dealer-file.js`, `src/pages/api/vhc/upload-media.js` — all rewritten to use Supabase Storage via `uploadAndRecord`. Local-disk fallback removed for the live path.
  - `src/pages/api/jobcards/link-uploaded-files.js` — now moves Supabase Storage objects from `temp-{id}/` to `{jobId}/` paths; legacy local-disk path retained as a compatibility branch.
  - `src/pages/api/parts/jobs/index.js`, `src/pages/api/parts/job-items/index.js`, `src/pages/api/parts/update-status.js` — now read/write `source_request_id` and call `linkRequestToJobItem` / `syncRequestStatus`.
  - `src/pages/api/vhc/update-item-status.js` — uses canonical `normalizeDecision` / `normalizeSeverity` / `isSeverityColor` / `buildDecisionUpdatePayload`.
  - `src/pages/api/messages/connect-customer.js` — now provisions a `users` row for a customer via `ensureUserForCustomer` instead of 409-erroring.
  - `src/pages/api/search/global.js` — uses `INACTIVE_JOB_IDS` from `statusHelpers`.

### Changed helpers / services (high blast radius)
- **NEW** `src/lib/vhc/vhcItemState.js` — canonical VHC state model (`DECISION`, `SEVERITY`, `WORKFLOW`, `normalizeDecision`, `normalizeSeverity`, `resolveVhcItemState`, `buildDecisionUpdatePayload`).
- **NEW** `src/lib/status/statusHelpers.js` — `isInactiveJobStatus`, `isCompletedJobStatus`, `isClockOffExcluded`, `isInvoicePaid/Cancelled/Settled/RowPaid`, `isAuthorisedDecision`, `isVhcAuthorisedSource`, `INACTIVE_JOB_IDS`, `INVOICE_STATUSES`.
- **NEW** `src/lib/storage/storageService.js` — `uploadFile`, `deleteFile`, `saveFileRecord`, `uploadAndRecord`, `sanitiseFileName`, `buildStoragePath`. Single Supabase bucket: `job-files`.
- **NEW** `src/lib/storage/parseMultipartForm.js` — shared multipart parser replacing four duplicate copies.
- **NEW** `src/lib/invoices/persistence.js` — `persistStructuredInvoiceRequests`, `loadStructuredInvoiceRequests`, `SNAPSHOT_VERSION = 1`. Snapshot-aware read collapses live data merging.
- **NEW** `src/lib/parts/partsRequestAdapter.js` — `linkRequestToJobItem`, `syncRequestStatus`, `getMergedPartsForJob`, `getPartsStatusCounts`, `buildVhcRowDescription`.
- `src/lib/status/catalog/parts.js` — added `ITEM_STATUSES` + `NORMALIZE_ITEM`. Used in `WriteUpForm.js`, `PartsTab_New.js`.
- `src/lib/services/jobStatusService.js` — `STATUS_FLOW` map now built from canonical `JOB_DISPLAY` constants.
- `src/lib/services/vhcStatusService.js` — `getVHCAuthorizationHistory` and `calculateVHCTotals` now use `resolveVhcItemState(...).isAuthorizedLike`.
- `src/lib/vhc/calculateVhcTotals.js`, `quoteLines.js`, `shared.js`, `summaryStatus.js` — all four delegate to `vhcItemState` normalizers.
- `src/lib/database/jobs.js` — `hasPaidInvoiceForJob` uses `isInvoiceRowPaid`; `getAuthorizedVhcItemsWithDetails` and `normalizeAuthorizationDecision` use `normalizeDecision`; `addJobFile` signature extended with `{ fileSize, storageType, storagePath }`.
- `src/lib/database/messages.js` — new `ensureUserForCustomer` (race-safe, email-keyed).
- `src/lib/database/dashboard/parts.js` — dashboard counts now merge `parts_job_items` and unfulfilled `parts_requests` (filtered by `fulfilled_by IS NULL`).
- `src/lib/database/vhcPartsSync.js` — `normaliseApprovalStatus` delegates to `normalizeDecision`.
- `src/lib/jobcards/utils.js` — `normalizeApprovalStatus` delegates to `normalizeDecision`.
- `src/lib/invoices/detailService.js` — snapshot-aware read path: `snapshot_version >= 1` ⇒ pure stored read; legacy ⇒ existing rebuild path with centralized authorisation helpers.

### Changed hooks / components
- `src/components/Clocking/ClockingCard.js` — orphan; rewritten to use `useClockingContext` directly; toFixed crash fix; semantic theme tokens.
- `src/components/dashboards/DashboardClocking.js` — orphan; broken import path fixed; theme tokens.
- `src/components/Workshop/JobClockingCard.js` — uses `isInactiveJobStatus`.
- `src/components/dashboards/RetailManagersDashboard.js` — uses `isInactiveJobStatus`.
- `src/components/accounts/InvoiceTable.js` — `isInvoiceOverdue` uses `isInvoiceSettled`.
- `src/components/JobCards/WriteUpForm.js` — `hasPartsOnOrder` uses `NORMALIZE_ITEM`.
- `src/components/PartsTab_New.js` — `normalizePartStatus` replaced by `NORMALIZE_ITEM`.
- `src/components/LoginDropdown.js` — major rewrite; uses new `allUsers` array to dynamically derive department groups.
- `src/features/invoices/components/InvoiceDetail.js` — uses `isAuthorisedDecision`, `isVhcAuthorisedSource`, `isInvoiceRowPaid`.
- `src/features/invoices/components/InvoicePaymentModal.js` — uses `isInvoiceRowPaid`.

### Changed data / storage / status / permission areas
- **DB schema (`schemaReference.sql`):**
  - `job_files` gained `visible_to_customer`, `file_size`, `storage_type`, `storage_path`.
  - `parts_job_items` gained `source_request_id` FK → `parts_requests.request_id` `ON DELETE SET NULL`.
  - `parts_requests` gained `vhc_item_id` FK → `vhc_checks.vhc_id` and `fulfilled_by` FK → `parts_job_items.id`.
  - **NEW** table `staff_vehicle_payroll_deductions` (deduction_id, history_id UNIQUE, vehicle_id, user_id, month_key, label, amount).
  - Implied (from code): `invoices` is expected to have `snapshot_version` + `meta` columns and `invoice_requests` / `invoice_request_items` to have a `metadata` jsonb column. The code is resilient when these are missing (Postgres `42703` fallback) but full snapshotting will not work until migration `20260410120000_invoice_snapshot_v1.sql` is applied.
- **Storage:** uploads moved from `public/uploads/{vhc-media,job-documents,dealer-files}/` to the Supabase `job-files` bucket. Legacy local files remain readable through the existing static serve route.
- **Permissions:** every API route now goes through `withRoleGuard`. `pages/api/invoices/create.js` is restricted to `HR_CORE_ROLES + MANAGER_SCOPED_ROLES`.

### Highest-risk changed areas
1. Universal `withRoleGuard` wrap on every API endpoint (auth/permission regression).
2. Snapshot v1 invoice persistence — read-path now ignores live job state for snapshotted invoices.
3. File upload pipeline rewrite (Supabase Storage replacing local disk).
4. parts_requests ⇄ parts_job_items bidirectional linking.
5. Canonical VHC state resolver replacing ~9 duplicated normalisers.
6. LoginDropdown department/category derivation rewrite + default dev department change.

---

## 2. Pre-Test Setup

### Required users / roles
- 1 × Admin / HR Manager (full access).
- 1 × Service Advisor / Retail Manager (HR_CORE_ROLES + MANAGER_SCOPED_ROLES — needed for invoice creation).
- 1 × Workshop Technician (clock-on, parts requests, VHC).
- 1 × Parts user.
- 1 × Accounts user.
- 1 × Customer-portal user mapped to a real `customers` row that has an email address.
- 1 × `customers` row **without** an email (for the negative `connect-customer` test).
- 1 × user that is NOT in any role mapping (for `withRoleGuard` 403 test).

### Required test data
- 1 × open job in `Booked` status with a vehicle and customer.
- 1 × open job already `In Progress` with at least 1 VHC item per severity (red, amber, green).
- 1 × VHC item that is `pending` and another that is `authorised`.
- 1 × `parts_requests` row with no `fulfilled_by` (unfulfilled).
- 1 × existing legacy invoice (created **before** this checklist's diff range, so `snapshot_version = 0`).
- 1 × already-paid invoice for paid-state regression checks.
- 1 × existing message thread with at least 2 internal members (for `connect-customer`).

### Required uploads / media
- 1 × small JPG (< 1 MB).
- 1 × ~9 MB JPG (just under VHC media image limit).
- 1 × ~12 MB JPG (over the VHC image limit, for failure test).
- 1 × MP4 < 50 MB.
- 1 × MP4 > 50 MB (failure test).
- 1 × PDF (dealer file / job document).

### Required environment
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set.
- Supabase Storage bucket `job-files` exists with subfolders allowed (`vhc-media/`, `documents/`, `dealer-files/`).
- Migration `20260410120000_invoice_snapshot_v1.sql` should be applied; if not, run the snapshot tests both ways (with and without the migration applied) and confirm the `[invoices] ... falling back to legacy` warnings appear in server logs.

### Assumptions
- DEV login with `selectedDepartment = "workshop"` resolves to a real department in the live roster — if it does not, the LoginDropdown default change is a regression.
- `withRoleGuard` knows about every role mapping needed by the routes it now wraps. If any route was previously hit anonymously (e.g. cron jobs, server-to-server callers), that caller will need an authenticated session.

---

## 3. Flow-Ordered Manual Test Checklist

### Access and Entry

#### TC-AE-001 — Login dropdown defaults to Workshop department
- **Type:** Directly changed
- **Route/Area:** `/login` (dev mode)
- **Role:** Any
- **Action:** Open `/login`, click into the dev login dropdown, observe the pre-selected category/department.
- **Expected:** Category = `retail`, Department = `workshop` (not `techs`). User dropdown is populated.
- **Covers changed code in:** `src/pages/login.js`, `src/components/LoginDropdown.js`.
- **Notes/Risks:** If `workshop` is not a real department label in `roleCategories.retail`, user dropdown will be empty and dev login will be unusable.

#### TC-AE-002 — LoginDropdown derives departments from `allUsers`
- **Type:** Directly changed
- **Route/Area:** `/login`
- **Role:** Any
- **Action:** Switch the category dropdown between Retail / Workshop / etc. Watch the department dropdown.
- **Expected:** Departments are dynamically built from the users in that category, and each option shows `"{n} users"` description text. Switching category clears the user list.
- **Covers changed code in:** `src/components/LoginDropdown.js` (`departmentGroups`, `userOptions`, `departmentOptions`).
- **Notes/Risks:** Previously the department list came from `roleCategories[category]` only — now it comes from real user data. Empty departments will silently disappear.

#### TC-AE-003 — `withRoleGuard` blocks anonymous API calls
- **Type:** Permission-security regression
- **Route/Area:** `/api/parts/jobs`, `/api/vhc/upload-media`, `/api/jobcards/upload-document` (or any wrapped route)
- **Role:** Anonymous (no session cookie)
- **Action:** Hit each route directly via curl with no auth.
- **Expected:** 401 / 403, not 200. No data leaked.
- **Covers changed code in:** every file that gained `import { withRoleGuard } ... export default withRoleGuard(handler)` in this diff.
- **Notes/Risks:** If a route silently allows the call through, the role-guard wrap is not actually enforcing.

#### TC-AE-004 — `withRoleGuard` allows the correct role
- **Type:** Permission-security regression
- **Route/Area:** `/api/parts/jobs/index` (POST)
- **Role:** Parts user
- **Action:** Submit a valid POST as a parts user.
- **Expected:** 201 Created. Handler receives `session` as third arg (no crash).
- **Covers changed code in:** all wrapped API handlers (signature changed to `(req, res, session)`).

---

### Job Creation and Intake

#### TC-JC-001 — Create a new job (happy path)
- **Type:** Downstream regression
- **Route/Area:** `/api/jobcards/create` → `/job-cards/[jobNumber]`
- **Role:** Service Advisor
- **Action:** Create a new job from the booking flow.
- **Expected:** Job created, redirect to detail page works, status visible as `Booked`.
- **Covers changed code in:** `src/pages/api/jobcards/create.js` (auth wrap), downstream `jobs.js`.
- **Notes/Risks:** Watch network panel for any 401 from the flood of new wrapped APIs called during page hydration.

#### TC-JC-002 — Upload a document during temp-job creation
- **Type:** Directly changed
- **Route/Area:** `/api/jobcards/upload-document` (with `jobId=temp-...`)
- **Role:** Service Advisor
- **Action:** While creating a new job that has not yet been saved, upload a PDF.
- **Expected:** File is uploaded to Supabase Storage under `documents/temp-{id}/...`. **No** `job_files` row inserted yet. Response includes `storage_path`.
- **Covers changed code in:** `src/pages/api/jobcards/upload-document.js`, `src/lib/storage/storageService.js`.

#### TC-JC-003 — Upload a document directly to a real job
- **Type:** Directly changed
- **Route/Area:** `/api/jobcards/upload-document` (with real `jobId`)
- **Role:** Service Advisor
- **Action:** Upload a PDF to a saved job.
- **Expected:** Storage object exists at `documents/{jobId}/...`. A new `job_files` row exists with `storage_type='supabase'`, `storage_path` set, `file_size` populated, `visible_to_customer=true` by default.
- **Covers changed code in:** `src/pages/api/jobcards/upload-document.js`, `src/lib/storage/storageService.js#uploadAndRecord`, `src/lib/database/jobs.js#addJobFile`.

#### TC-JC-004 — Document upload failure path
- **Type:** Directly changed
- **Route/Area:** `/api/jobcards/upload-document`
- **Role:** Service Advisor
- **Action:** Force a Supabase Storage failure (e.g. invalid bucket) and POST a file.
- **Expected:** 500 with `Upload failed` message. Storage cleanup runs (`deleteFile` on the orphan). No `job_files` row left behind.
- **Covers changed code in:** `uploadAndRecord` cleanup branch in `storageService.js`.

---

### Save Pipeline and Redirects

#### TC-SP-001 — Link uploaded files to finalised job (Supabase Storage path)
- **Type:** Directly changed
- **Route/Area:** `/api/jobcards/link-uploaded-files`
- **Role:** Service Advisor
- **Action:** Upload one or more documents during temp-job creation (TC-JC-002), then save the job.
- **Expected:** Each storage object is **copied** from `documents/temp-{id}/...` to `documents/{jobId}/...`, the source object is **removed**, and a new `job_files` row is inserted with the new `storage_path`. Response lists the linked files.
- **Covers changed code in:** `src/pages/api/jobcards/link-uploaded-files.js` (Supabase branch).
- **Notes/Risks:** Supabase Storage has no rename — this uses download → upload → remove. Watch for partial states if download succeeds but upload fails.

#### TC-SP-002 — Link uploaded files (legacy local-disk path)
- **Type:** Legacy compatibility regression
- **Route/Area:** `/api/jobcards/link-uploaded-files`
- **Role:** Service Advisor
- **Action:** Place a temp file in `public/uploads/job-documents/` and POST `files: [{ fileName, contentType }]` (no `storage_path`).
- **Expected:** File is renamed on local disk, a `job_files` row is inserted with `storage_type='local'`, `storage_path=null`.
- **Covers changed code in:** `src/pages/api/jobcards/link-uploaded-files.js` (legacy branch).

#### TC-SP-003 — link-uploaded-files is auth-guarded
- **Type:** Permission-security regression
- **Route/Area:** `/api/jobcards/link-uploaded-files`
- **Role:** Anonymous
- **Action:** POST with no session.
- **Expected:** 401/403.

---

### Job Detail Initial Load

#### TC-JD-001 — Job detail page loads with all wrapped APIs returning 200
- **Type:** Permission-security regression
- **Route/Area:** `/job-cards/[jobNumber]`
- **Role:** Service Advisor
- **Action:** Open a known job, watch the network tab.
- **Expected:** Every supporting fetch (`/api/jobcards/[jobNumber]`, `/api/parts/...`, `/api/vhc/...`, `/api/jobs/[jobNumber]/timeline`) returns 200. No 401/403 cascade.
- **Covers changed code in:** every API wrapped with `withRoleGuard` in this diff.

#### TC-JD-002 — VHC decision badges resolve via `resolveVhcItemState`
- **Type:** Directly changed
- **Route/Area:** `/job-cards/[jobNumber]`
- **Role:** Service Advisor
- **Action:** Open a job that has VHC items in: `pending`, `authorised`, `declined`, `completed`, and a row using legacy `authorization_state="approved"` / `"authorised"`.
- **Expected:** Each row resolves to the correct decision badge — including legacy spellings — and the "all decided" / "decided count" indicators update correctly.
- **Covers changed code in:** `src/pages/job-cards/[jobNumber].js` (`vhcDecisionStats`, `allRedAmberDecided`), `src/lib/vhc/vhcItemState.js`.

---

### Job Card Tabs

#### TC-JT-001 — Notes tab loads
- **Type:** Downstream regression
- **Route/Area:** Notes tab on `/job-cards/[jobNumber]`
- **Role:** Service Advisor
- **Action:** Open Notes tab.
- **Expected:** Loads (no 401/403). Adding a note still works.
- **Covers changed code in:** wrapped notes/messages routes.

#### TC-JT-002 — VHC tab decision flow
- **Type:** Directly changed
- **Route/Area:** VHC tab → PATCH `/api/vhc/update-item-status`
- **Role:** Service Advisor
- **Action:** Toggle a VHC item from pending → authorised → declined → completed.
- **Expected:** `approval_status`, `authorization_state`, and `display_status` are written via `buildDecisionUpdatePayload` semantics. UI badge follows.
- **Covers changed code in:** `src/pages/api/vhc/update-item-status.js`, `src/lib/vhc/vhcItemState.js#buildDecisionUpdatePayload`.

---

### Technician and Workshop Flow

#### TC-TW-001 — Technician clock-on excludes inactive jobs
- **Type:** Directly changed
- **Route/Area:** Workshop clocking widget (`JobClockingCard`)
- **Role:** Technician
- **Action:** Open the workshop clock-on selector with a mix of `Released`/`Invoiced`/`In Progress` jobs in the system.
- **Expected:** Inactive jobs (released, invoiced, complete, collected, cancelled, finished, closed) are filtered out. Active jobs are listed.
- **Covers changed code in:** `src/components/Workshop/JobClockingCard.js`, `src/lib/status/statusHelpers.js#isInactiveJobStatus`.

#### TC-TW-002 — Technician parts request with no VHC link
- **Type:** Directly changed
- **Route/Area:** `/job-cards/myjobs/[jobNumber]` Parts request form
- **Role:** Technician
- **Action:** Submit a parts request, leave the VHC item dropdown set to "None".
- **Expected:** Insert into `parts_requests` succeeds, `vhc_item_id IS NULL`, form clears.
- **Covers changed code in:** `src/pages/job-cards/myjobs/[jobNumber].js`.

#### TC-TW-003 — Technician parts request linked to a VHC item
- **Type:** Directly changed
- **Route/Area:** `/job-cards/myjobs/[jobNumber]` Parts request form
- **Role:** Technician
- **Action:** Pick a VHC item in the dropdown, submit.
- **Expected:** New `parts_requests` row has `vhc_item_id = <selected vhc_id>`. Dropdown only appears when VHC items exist for the job. State resets after submit.
- **Covers changed code in:** `src/pages/job-cards/myjobs/[jobNumber].js`, schema FK `parts_requests_vhc_item_id_fkey`.

#### TC-TW-004 — Technician parts request with no eligible VHC items
- **Type:** Directly changed
- **Route/Area:** `/job-cards/myjobs/[jobNumber]`
- **Role:** Technician
- **Action:** Open a job with **only** `VHC_CHECKSHEET` rows.
- **Expected:** The "Link to VHC item" dropdown is **not** rendered.
- **Covers changed code in:** conditional `vhcChecks.filter(...).length > 0` in `myjobs/[jobNumber].js`.

---

### VHC Flow

#### TC-VHC-001 — Authorisation history filtering uses canonical resolver
- **Type:** Downstream regression
- **Route/Area:** VHC authorisation history view → `getVHCAuthorizationHistory`
- **Role:** Service Advisor
- **Action:** Load the VHC auth history for a job that has rows in mixed legacy spellings (`authorised`, `authorized`, `approved`, `completed`).
- **Expected:** All authorised-like rows show up in history. No row missed because of casing or legacy spelling.
- **Covers changed code in:** `src/lib/services/vhcStatusService.js` (uses `resolveVhcItemState(...).isAuthorizedLike`).

#### TC-VHC-002 — VHC totals calculation
- **Type:** Downstream regression
- **Route/Area:** `calculateVHCTotals` (called by job detail / VHC summary)
- **Role:** Service Advisor
- **Action:** Trigger a totals recalculation on a job with mixed-decision VHC items.
- **Expected:** Only authorised-like items (`authorized`, `authorised`, `approved`, `completed`) contribute. Total matches expected from manual sum.
- **Covers changed code in:** `src/lib/services/vhcStatusService.js`, `src/lib/vhc/calculateVhcTotals.js`.

#### TC-VHC-003 — VHC severity normalisation
- **Type:** Downstream regression
- **Route/Area:** VHC summary chips
- **Role:** Service Advisor
- **Action:** Inspect a job whose VHC rows include severity values like `critical`, `high`, `warning`, `medium`, `yellow`, `orange`, `pass`, `gray`, `neutral`.
- **Expected:** Each maps to the correct canonical colour (red/amber/green/grey). Display chips don't show `null`.
- **Covers changed code in:** `src/lib/vhc/vhcItemState.js#normalizeSeverity`, callers in `summaryStatus.js`, `quoteLines.js`, `calculateVhcTotals.js`, `shared.js`.

#### TC-VHC-004 — VHC media upload (image, in-limit)
- **Type:** Directly changed
- **Route/Area:** `/api/vhc/upload-media`
- **Role:** Technician
- **Action:** Upload a 1 MB JPG to a real job with `visibleToCustomer=true`.
- **Expected:** Storage object at `vhc-media/{jobId}/...`, `job_files` row with `folder='vhc-media'`, `visible_to_customer=true`, `file_size` populated. Response includes the saved row.
- **Covers changed code in:** `src/pages/api/vhc/upload-media.js`.

#### TC-VHC-005 — VHC media upload (oversize image)
- **Type:** Directly changed
- **Route/Area:** `/api/vhc/upload-media`
- **Role:** Technician
- **Action:** Upload a 12 MB JPG.
- **Expected:** 400 with `Image file size exceeds 10MB limit`. No storage object created.
- **Covers changed code in:** `validateMediaFile` in `upload-media.js`.

#### TC-VHC-006 — VHC media upload (video)
- **Type:** Directly changed
- **Route/Area:** `/api/vhc/upload-media`
- **Role:** Technician
- **Action:** Upload a 30 MB MP4.
- **Expected:** Success. Storage object created. `mimetype` starts with `video/`.

#### TC-VHC-007 — VHC media upload (oversize video)
- **Type:** Directly changed
- **Route/Area:** `/api/vhc/upload-media`
- **Role:** Technician
- **Action:** Upload a 60 MB MP4.
- **Expected:** 400 with `Video file size exceeds 50MB limit`.

#### TC-VHC-008 — VHC media upload for temp job
- **Type:** Directly changed
- **Route/Area:** `/api/vhc/upload-media` with `jobId=temp-...`
- **Role:** Technician
- **Action:** Upload a JPG against a temp job id.
- **Expected:** Storage object created under `vhc-media/temp-{id}/...`. No `job_files` row inserted yet. Response includes `storage_path`.
- **Covers changed code in:** temp-job branch of `upload-media.js`, dynamic import of `uploadFile`.

#### TC-VHC-009 — VHC item create still works under role guard
- **Type:** Permission-security regression
- **Route/Area:** `/api/jobcards/create-vhc-item`
- **Role:** Service Advisor / Technician (whoever holds the create role)
- **Action:** Create a new VHC item.
- **Expected:** 200 with the upserted row.
- **Covers changed code in:** `src/pages/api/jobcards/create-vhc-item.js`.

---

### Parts Flow

#### TC-PA-001 — Create a parts allocation linked to a tech request
- **Type:** Directly changed
- **Route/Area:** `/api/parts/jobs` (POST)
- **Role:** Parts user
- **Action:** POST with `{ ..., sourceRequestId: <existing parts_requests.request_id> }`.
- **Expected:** New `parts_job_items` row has `source_request_id` populated. The matching `parts_requests.fulfilled_by` is set to the new job-item id (verified via `linkRequestToJobItem`). Status syncs both ways.
- **Covers changed code in:** `src/pages/api/parts/jobs/index.js`, `src/lib/parts/partsRequestAdapter.js`.
- **Notes/Risks:** `linkRequestToJobItem` is best-effort and only logs on failure — confirm both columns actually update.

#### TC-PA-002 — Create a parts allocation not linked to a request
- **Type:** Downstream regression
- **Route/Area:** `/api/parts/jobs` (POST)
- **Role:** Parts user
- **Action:** POST without `sourceRequestId`.
- **Expected:** Insert succeeds, `source_request_id` is NULL. No FK violation.

#### TC-PA-003 — Update parts job-item status syncs the linked request
- **Type:** Directly changed
- **Route/Area:** `/api/parts/update-status` (PATCH)
- **Role:** Parts user
- **Action:** PATCH a `parts_job_items` row that has `source_request_id` set, transitioning through `awaiting_stock` → `on_order` → `booked` → `picked` → `fitted`.
- **Expected:** Linked `parts_requests.status` follows the JOB_ITEM_TO_REQUEST_STATUS map (`ordered` → `allocated` → `allocated` → `fulfilled`).
- **Covers changed code in:** `src/lib/parts/partsRequestAdapter.js#syncRequestStatus`, `src/pages/api/parts/update-status.js`.

#### TC-PA-004 — Update parts status when no link exists
- **Type:** Downstream regression
- **Route/Area:** `/api/parts/update-status`
- **Role:** Parts user
- **Action:** Update a `parts_job_items` row with `source_request_id IS NULL`.
- **Expected:** Update succeeds. `syncRequestStatus` returns `{ updated: false }` and does not error.

#### TC-PA-005 — Parts dashboard merges both tables
- **Type:** Downstream regression
- **Route/Area:** Parts dashboard (consumer of `getPartsDashboardData`)
- **Role:** Parts / Manager
- **Action:** With seed data containing both `parts_job_items` allocations and unfulfilled `parts_requests`, open the dashboard.
- **Expected:** `totalRequests = jobItems + unfulfilledRequests`. `prePicked` count comes from `parts_job_items.pre_pick_location`. Status chart merges both tables. Trend chart includes points from both.
- **Covers changed code in:** `src/lib/database/dashboard/parts.js`.

#### TC-PA-006 — Parts WriteUpForm "on order" detection
- **Type:** Downstream regression
- **Route/Area:** WriteUpForm save flow
- **Role:** Service Advisor
- **Action:** Save a write-up against a job whose parts include statuses written as `on-order`, `on_order`, `awaiting-stock`, `awaiting_stock`, `order`, `ordered`.
- **Expected:** All six are detected as "on order" via `NORMALIZE_ITEM`. Job status transition still respects parts-on-order branching.
- **Covers changed code in:** `src/components/JobCards/WriteUpForm.js`, `src/lib/status/catalog/parts.js`.

#### TC-PA-007 — Parts tab status normalisation
- **Type:** Downstream regression
- **Route/Area:** Parts tab on the job card
- **Role:** Service Advisor
- **Action:** View a job whose parts have varied statuses (`pre-pick`, `picked`, `awaiting_stock`, `allocated`, `fitted`, etc.).
- **Expected:** Each is bucketed exactly as before — visually no regression vs the deleted local `normalizePartStatus`.
- **Covers changed code in:** `src/components/PartsTab_New.js`.

---

### Notes, Messages, and Tracking

#### TC-NM-001 — Connect a customer to an existing thread (happy path)
- **Type:** Directly changed
- **Route/Area:** `/api/messages/connect-customer`
- **Role:** Internal user already in the thread
- **Action:** POST `{ threadId, actorId, customerQuery }` for a customer that has an email but **no** existing `users` row.
- **Expected:** A `users` row is provisioned with `role='Customer'`, `password_hash='external_auth'`, derived first/last name. A new group thread is created containing the actor + the customer + everyone else.
- **Covers changed code in:** `src/lib/database/messages.js#ensureUserForCustomer`, `src/pages/api/messages/connect-customer.js`.

#### TC-NM-002 — Reuse existing users row when emails match
- **Type:** Directly changed
- **Route/Area:** `/api/messages/connect-customer`
- **Role:** Internal user
- **Action:** Connect a customer whose email already exists in `users` (e.g. they are also an employee).
- **Expected:** No duplicate user. Existing `user_id` is reused.
- **Covers changed code in:** `ensureUserForCustomer` lookup branch.

#### TC-NM-003 — Customer with no email returns a friendly 400
- **Type:** Directly changed
- **Route/Area:** `/api/messages/connect-customer`
- **Role:** Internal user
- **Action:** Connect a customer whose `customers.email` is NULL.
- **Expected:** 400 with message starting `"Customer is missing an email address"`. No `users` row created.
- **Covers changed code in:** `ensureUserForCustomer` and `connect-customer` error mapping.

#### TC-NM-004 — Race-safe provisioning
- **Type:** Data integrity regression
- **Route/Area:** `/api/messages/connect-customer`
- **Role:** Internal user
- **Action:** Fire two concurrent connect requests for the same customer email.
- **Expected:** Exactly one `users` row exists at the end. PG `23505` is caught and the row is re-fetched.
- **Covers changed code in:** `ensureUserForCustomer` race branch.
- **Notes/Risks:** Hard to reproduce manually — at minimum, run the action twice in quick succession and assert no duplicate.

#### TC-NM-005 — Actor must already be in the thread
- **Type:** Permission-security regression
- **Route/Area:** `/api/messages/connect-customer`
- **Role:** Internal user not in the thread
- **Action:** Try to connect a customer to a thread the actor is not part of.
- **Expected:** 403 with the original message ("invite a customer into a conversation they are part of").

#### TC-NM-006 — Tracking equipment / oil-stock under role guard
- **Type:** Permission-security regression
- **Route/Area:** `/api/tracking/equipment`, `/api/tracking/oil-stock`
- **Role:** Workshop user
- **Action:** GET both endpoints.
- **Expected:** 200 (or the previous expected response). Anonymous request returns 401/403.
- **Covers changed code in:** `src/pages/api/tracking/equipment.js`, `oil-stock.js`.

---

### Invoice and Release Flow

#### TC-IR-001 — Create invoice writes structured snapshot v1 (migration applied)
- **Type:** Directly changed / Data integrity regression
- **Route/Area:** `/api/invoices/create`
- **Role:** HR_CORE_ROLES / MANAGER_SCOPED_ROLES
- **Action:** POST with a populated `structuredRequests` payload (1+ requests, each with labour and parts).
- **Expected:** New `invoices` row has `snapshot_version = 1`, `meta.totals_breakdown` matches sums of the structured payload, `meta.created_from = "structuredRequests"`. New `invoice_requests` rows have `metadata` jsonb populated. New `invoice_request_items` rows have `metadata.line_net_total` etc. populated. Legacy `invoice_items` is also populated.
- **Covers changed code in:** `src/pages/api/invoices/create.js`, `src/lib/invoices/persistence.js`.

#### TC-IR-002 — Create invoice when migration is NOT applied (fallback)
- **Type:** Legacy compatibility regression
- **Route/Area:** `/api/invoices/create`
- **Role:** HR_CORE_ROLES
- **Action:** With the snapshot migration not applied, POST a structured payload.
- **Expected:** Header insert retried without `snapshot_version`/`meta`. `invoice_requests` and `invoice_request_items` retried without `metadata`. Server logs once: `[invoices] ... falling back to legacy ... 20260410120000_invoice_snapshot_v1.sql`. Invoice still created.
- **Covers changed code in:** `looksLikeMissingColumn` retry branches in `create.js` and `persistence.js`.
- **Notes/Risks:** **Uncertain:** if the warning text or error code differs across PG versions, the fallback may not trigger.

#### TC-IR-003 — Create invoice rolls back header on items failure
- **Type:** Data integrity regression
- **Route/Area:** `/api/invoices/create`
- **Role:** HR_CORE_ROLES
- **Action:** Force `persistStructuredInvoiceRequests` to throw (e.g. invalid `request_id` data) and submit.
- **Expected:** No orphan `invoices` row remains — explicit `dbClient.from("invoices").delete()` on failure.
- **Covers changed code in:** `create.js` rollback branch.

#### TC-IR-004 — Invoice creation restricted by role
- **Type:** Permission-security regression
- **Route/Area:** `/api/invoices/create`
- **Role:** Anonymous; non-HR/non-Manager user
- **Action:** Hit the endpoint.
- **Expected:** 401/403. Body never parsed.
- **Covers changed code in:** `withRoleGuard(handler, { allow: [...HR_CORE_ROLES, ...MANAGER_SCOPED_ROLES] })`.

#### TC-IR-005 — Snapshot v1 invoice read path is pure
- **Type:** Data integrity regression / source-of-truth
- **Route/Area:** `getInvoiceDetailPayload` (`/api/invoices/by-job/[jobNumber]` or `/by-order/[orderNumber]`)
- **Role:** Accounts user
- **Action:** Open a snapshot-v1 invoice. Then mutate the live job (change a part status, edit a write-up, change a VHC decision). Reload the invoice.
- **Expected:** Invoice **does not change** — no live merging. `payload.meta.isFullSnapshot=true`, `snapshotVersion=1`. `headerMeta` is exposed.
- **Covers changed code in:** `src/lib/invoices/detailService.js#getInvoiceDetailPayload` (snapshot branch), `src/lib/invoices/persistence.js#loadStructuredInvoiceRequests`.
- **Notes/Risks:** Critical — this is a deliberate behaviour change. If write-ups or proforma overrides were expected to refresh after the invoice was issued, that no longer happens for snapshotted invoices.

#### TC-IR-006 — Legacy invoice (snapshot_version = 0) still merges live data
- **Type:** Legacy compatibility regression
- **Route/Area:** Same as TC-IR-005
- **Role:** Accounts user
- **Action:** Open an invoice created **before** the snapshot rollout.
- **Expected:** `isFullSnapshot=false`. Live job_requests, parts_job_items, vhc_checks, job writeups, and proforma overrides ARE merged in. Display matches the pre-change behaviour exactly.
- **Covers changed code in:** legacy branch of `getInvoiceDetailPayload`.

#### TC-IR-007 — Invoice payment modal "already paid" detection
- **Type:** Downstream regression
- **Route/Area:** Invoice detail → Take payment modal
- **Role:** Accounts user
- **Action:** Open the payment modal for an invoice with `paid=true`. Then for an invoice with `payment_status='Paid'`. Then for a `payment_status='paid'` (lowercase).
- **Expected:** All three are detected as paid via `isInvoiceRowPaid`. Modal shows the "already paid" state in each case.
- **Covers changed code in:** `src/features/invoices/components/InvoicePaymentModal.js`, `src/features/invoices/components/InvoiceDetail.js`, `src/lib/status/statusHelpers.js#isInvoiceRowPaid`.

#### TC-IR-008 — Invoice table overdue logic excludes settled invoices
- **Type:** Downstream regression
- **Route/Area:** Accounts → Invoices table
- **Role:** Accounts user
- **Action:** Sort by overdue. Confirm a Cancelled invoice with a past due date is NOT shown as overdue. Confirm a Paid invoice is NOT shown as overdue. Confirm a Sent invoice past due IS shown as overdue.
- **Covers changed code in:** `src/components/accounts/InvoiceTable.js#isInvoiceOverdue`, `statusHelpers.isInvoiceSettled`.

#### TC-IR-009 — Invoice authorisation request sorting
- **Type:** Downstream regression
- **Route/Area:** Invoice detail (renders authorised vs customer requests)
- **Role:** Accounts user
- **Action:** Render an invoice with mixed `request_kind` values (`authorised`, `authorized`, `request`, `vhc_authorised`, `vhc_authorized`).
- **Expected:** Authorised requests bucket together at the bottom of the list (existing behaviour). Centralized helpers route through `isAuthorisedDecision` and `isVhcAuthorisedSource`.
- **Covers changed code in:** `src/lib/invoices/detailService.js`, `src/features/invoices/components/InvoiceDetail.js`.

#### TC-IR-010 — Job status "Released" excludes from clock-on
- **Type:** Downstream regression
- **Route/Area:** `JobClockingCard`
- **Role:** Technician
- **Action:** Move a job to `Released`, then check the workshop clock-on selector.
- **Expected:** That job no longer appears.
- **Covers changed code in:** `JobClockingCard.js`, `statusHelpers.isInactiveJobStatus`.

#### TC-IR-011 — Has-paid-invoice gate uses centralized check
- **Type:** Downstream regression
- **Route/Area:** Anywhere `hasPaidInvoiceForJob` is called from `jobs.js` (e.g. release/invalidate flows).
- **Role:** Service Advisor
- **Action:** Trigger the gate with an invoice that uses `paid=true`, then with `payment_status='Paid'`.
- **Expected:** Both paths return true. Behaviour matches the pre-change inline check.

---

### Customer Portal and Public Share Flow

#### TC-CP-001 — Customer detail page lists active vs total jobs
- **Type:** Downstream regression
- **Route/Area:** `/customers/[customerSlug]`
- **Role:** Service Advisor
- **Action:** Open a customer with a mix of `complete`, `collected`, `cancelled`, `invoiced`, `Booked`, `In Progress` jobs.
- **Expected:** Active count = jobs not in `isInactiveJobStatus`. Total count = all jobs. Display matches the previous inline `INACTIVE_JOB_STATUSES` Set behaviour.
- **Covers changed code in:** `src/pages/customers/[customerSlug].js`.

#### TC-CP-002 — Customer portal APIs still callable
- **Type:** Permission-security regression
- **Route/Area:** `/api/customer/profile`, `/api/customer/widgets`, `/api/customer/payment-methods`, `/api/customers/bookings/calendar`, `/api/customers/deliveries`
- **Role:** Customer-portal user
- **Action:** Hit each from the customer portal.
- **Expected:** 200. **Failure mode to watch:** `withRoleGuard` may not recognise the customer session — if it 401s, customer portal is broken.
- **Notes/Risks:** Critical — confirm `withRoleGuard` accepts the customer session shape.

#### TC-CP-003 — Public share link still resolves
- **Type:** Permission-security regression
- **Route/Area:** `/api/job-cards/[jobNumber]/share-link`, `/api/invoices/share`
- **Role:** Anonymous (link recipient)
- **Action:** Hit the share endpoint with a valid token.
- **Expected:** 200 (must bypass `withRoleGuard` for token-based callers, **or** the role guard must explicitly allow share-link reads). Confirm this works — otherwise external customers cannot view shares.
- **Notes/Risks:** **Uncertain.** Mark as a P0 if 401.

#### TC-CP-004 — Customer video upload
- **Type:** Directly changed
- **Route/Area:** `/api/vhc/customer-video-upload`
- **Role:** Customer-portal user
- **Action:** Upload a video as a customer.
- **Expected:** 200. **Failure mode:** role guard rejects customer session.

---

### Role and Permission Regression

#### TC-RP-001 — Inventory of every wrapped endpoint
- **Type:** Permission-security regression
- **Route/Area:** All routes listed in §1 above
- **Role:** Each role with a known reason to call each route
- **Action:** Smoke each one (GET if listing, POST if create) from a logged-in session of the expected role.
- **Expected:** 200 for the expected role; 403 for an unrelated role; 401 for anonymous.
- **Notes/Risks:** This is the single largest risk in the diff. Use the network panel during normal use to surface unexpected failures.

#### TC-RP-002 — Personal endpoints still accessible to logged-in users
- **Type:** Permission-security regression
- **Route/Area:** `/api/personal/*` (15 routes wrapped)
- **Role:** Any normal user
- **Action:** Visit personal dashboard; load each personal API.
- **Expected:** All 200.

#### TC-RP-003 — HR endpoints restricted
- **Type:** Permission-security regression
- **Route/Area:** `/api/hr/attendance`, `/api/hr/dashboard`, `/api/hr/training-courses[/...]`
- **Role:** Non-HR user
- **Action:** Hit each.
- **Expected:** 403.

---

### Data Integrity and Source-of-Truth Regression

#### TC-DI-001 — parts_job_items.source_request_id FK behaviour
- **Type:** Data integrity regression
- **Route/Area:** DB-level (via parts pages)
- **Role:** Parts user
- **Action:** Delete the parent `parts_requests` row referenced by a `parts_job_items.source_request_id`.
- **Expected:** `source_request_id` is set to NULL on the job-item row (FK is `ON DELETE SET NULL`). Allocation is preserved.
- **Covers changed code in:** schemaReference.sql, `parts_job_items_source_request_id_fkey`.

#### TC-DI-002 — parts_requests.fulfilled_by FK behaviour
- **Type:** Data integrity regression
- **Route/Area:** DB-level
- **Role:** Parts user
- **Action:** Delete the `parts_job_items` row referenced by `parts_requests.fulfilled_by`.
- **Expected:** `fulfilled_by` is set to NULL on the request row (FK `ON DELETE SET NULL`). Request is preserved.

#### TC-DI-003 — parts_requests.vhc_item_id FK behaviour
- **Type:** Data integrity regression
- **Route/Area:** DB-level
- **Role:** Service Advisor
- **Action:** Delete the linked `vhc_checks` row.
- **Expected:** `parts_requests.vhc_item_id` is set to NULL.

#### TC-DI-004 — Snapshot invoice does not drift after live data changes
- **Type:** Data integrity regression
- **Route/Area:** Invoice detail
- **Role:** Accounts user
- **Action:** See TC-IR-005 above.
- **Expected:** Snapshot invoice's totals, line items, and write-ups are byte-stable across live mutations.

#### TC-DI-005 — Decision normalization handles every legacy spelling
- **Type:** Data integrity regression
- **Route/Area:** `vhcItemState.normalizeDecision`
- **Role:** N/A — covered indirectly via VHC and invoice flows
- **Action:** Confirm each of `authorised`, `authorized`, `approved`, `complete`, `completed`, `decline`, `declined`, `declinded`, `rejected`, `pending`, `na`, `n/a`, `not applicable`, `authorized_added_to_job` resolves to a non-null canonical decision. Strings like `"foo"` resolve to `null`.
- **Notes/Risks:** Best validated via the VHC tab tests (TC-JD-002, TC-VHC-001..003).

---

### File Upload and Storage Regression

#### TC-FS-001 — Filename sanitisation
- **Type:** Directly changed
- **Route/Area:** Any of the three upload routes
- **Role:** Service Advisor
- **Action:** Upload a file with name `../../../evil name.pdf`.
- **Expected:** File is stored as `..___evil_name.pdf` (or similar — sanitised). No path traversal. Storage path stays inside `documents/{jobId}/`.
- **Covers changed code in:** `sanitiseFileName` in `storageService.js`.

#### TC-FS-002 — Visible-to-customer flag is honoured
- **Type:** Data integrity regression
- **Route/Area:** `/api/jobcards/[jobNumber]/upload-dealer-file` vs `/api/vhc/upload-media`
- **Role:** Service Advisor
- **Action:** Upload via dealer-file route → check the row. Upload via VHC media route → check the row.
- **Expected:** Dealer files default `visible_to_customer=false`. VHC media defaults to whatever the form posts (defaulting true unless explicitly set).
- **Covers changed code in:** `upload-dealer-file.js` (`visibleToCustomer: false`), `upload-media.js`, `storageService.saveFileRecord`.

#### TC-FS-003 — Cleanup on DB insert failure
- **Type:** Data integrity regression
- **Route/Area:** `uploadAndRecord`
- **Role:** Service Advisor
- **Action:** Inject a DB failure on `job_files` insert (e.g. drop `file_size` column locally) and retry the upload.
- **Expected:** Storage object is removed (`deleteFile(storagePath)`). No orphaned file in the bucket. Response is 500 with the DB error.

#### TC-FS-004 — Storage type recorded
- **Type:** Data integrity regression
- **Route/Area:** Any upload route on a real job
- **Role:** Service Advisor
- **Action:** Upload via the new pipeline.
- **Expected:** `storage_type='supabase'`. Legacy local-disk inserts (link route's fallback branch) write `storage_type='local'`.

---

### Legacy Compatibility Regression

#### TC-LC-001 — Legacy `addJobFile` callers still work
- **Type:** Legacy compatibility regression
- **Route/Area:** Any code path that calls `addJobFile(...)` without the new options object
- **Role:** Service Advisor
- **Action:** Trigger any flow that still calls `addJobFile(jobId, fileName, ..., uploadedBy)` (no 7th/8th argument).
- **Expected:** Insert succeeds. `file_size`, `storage_type`, `storage_path` default to `null`/`'local'`/`null`.
- **Covers changed code in:** `src/lib/database/jobs.js#addJobFile`.

#### TC-LC-002 — Old `useClocking` consumers
- **Type:** Legacy compatibility regression
- **Route/Area:** N/A — `useClocking` was deleted; only the orphan `ClockingCard` consumed it
- **Role:** N/A
- **Action:** Run the build / dev server.
- **Expected:** No `useClocking` import resolution errors anywhere. (`ClockingCard.js` and `DashboardClocking.js` are both orphans now.)

#### TC-LC-003 — Legacy `vhcStatusService` callers see correct authorisation totals
- **Type:** Legacy compatibility regression
- **Route/Area:** Anything still calling `getVHCAuthorizationHistory` / `calculateVHCTotals`
- **Role:** Service Advisor
- **Action:** Confirm pre-change job that had `approval_status='approved'` rows still appears as authorised.
- **Covers changed code in:** `src/lib/services/vhcStatusService.js`.

#### TC-LC-004 — `nextjobs` waiting page status filters
- **Type:** Legacy compatibility regression
- **Route/Area:** `/job-cards/waiting/nextjobs`
- **Role:** Service Advisor / Tech
- **Action:** Open the page, confirm waiting/parts/QA/in-bay buckets still group correctly.
- **Expected:** No behaviour change — only a comment was added to the file. Verify the comment hasn't accidentally changed any logic.

---

### Final Smoke Pass

#### TC-FP-001 — Build / boot
- **Type:** Downstream regression
- **Action:** `npm run build` (or `next build`). No import-resolution errors.
- **Notes/Risks:** Watch for stale references to `useClocking`, `addJobFile` 6-arg form, deleted docs, or anything else removed in this diff.

#### TC-FP-002 — Full happy-path job
- **Type:** Downstream regression
- **Action:** Create job → upload doc → write VHC → authorise items → tech clocks on → request part with VHC link → parts allocates → tech clocks off → invoice (snapshot v1) → take payment → release → reopen invoice next day after live data has changed (TC-IR-005).
- **Expected:** Every step works, invoice is byte-stable.

#### TC-FP-003 — Browser console clean
- **Type:** Downstream regression
- **Action:** Walk the app with the console open.
- **Expected:** No new warnings, no `useClocking` lookups, no `addJobFile` shape errors, no `vhcItemState` undefined access.

---

## 4. Highest-Risk Test Pack (run first)

1. TC-AE-003 — `withRoleGuard` blocks anonymous API calls
2. TC-AE-004 — `withRoleGuard` allows the correct role
3. TC-CP-002 — Customer portal APIs still callable (auth shape)
4. TC-CP-003 — Public share link still resolves (anonymous tokens)
5. TC-IR-005 — Snapshot v1 invoice read is pure (no drift)
6. TC-IR-006 — Legacy invoice still merges live data
7. TC-IR-001 — Snapshot v1 write path
8. TC-IR-002 — Snapshot fallback when migration is missing
9. TC-IR-003 — Header rollback on items failure
10. TC-IR-004 — Invoice creation role restriction
11. TC-PA-001 — Parts allocation linked to a tech request (bidirectional FK)
12. TC-PA-003 — Status sync `parts_job_items` → `parts_requests`
13. TC-NM-001 — Connect-customer auto-provisions a `users` row
14. TC-NM-003 — Connect-customer fails closed for missing email
15. TC-VHC-001 — VHC authorisation history correct under canonical resolver
16. TC-JC-003 — Document upload stores in Supabase Storage with correct row
17. TC-SP-001 — link-uploaded-files moves Supabase objects from temp to real path
18. TC-FS-001 — Filename sanitisation
19. TC-FS-003 — Cleanup on DB insert failure
20. TC-RP-001 — Endpoint inventory smoke (every wrapped route at least once)

---

## 5. Change-to-Test Coverage Matrix

- `src/lib/auth/roleGuard.js` (consumed by ~130 routes) > every API surface > TC-AE-003, TC-AE-004, TC-CP-002, TC-CP-003, TC-CP-004, TC-RP-001, TC-RP-002, TC-RP-003, TC-IR-004, TC-NM-005
- `src/lib/storage/storageService.js` (NEW) > document/dealer/VHC media uploads > TC-JC-002, TC-JC-003, TC-JC-004, TC-VHC-004..008, TC-FS-001..004
- `src/lib/storage/parseMultipartForm.js` (NEW) > all upload routes > TC-JC-003, TC-VHC-004
- `src/lib/invoices/persistence.js` (NEW) > invoice create + invoice detail read > TC-IR-001, TC-IR-002, TC-IR-003, TC-IR-005
- `src/pages/api/invoices/create.js` > invoice create > TC-IR-001..004
- `src/lib/invoices/detailService.js` > invoice detail read for both snapshot and legacy > TC-IR-005, TC-IR-006, TC-IR-007, TC-IR-009
- `src/lib/parts/partsRequestAdapter.js` (NEW) > parts allocation linking and dashboard > TC-PA-001, TC-PA-002, TC-PA-003, TC-PA-004, TC-PA-005
- `src/pages/api/parts/jobs/index.js`, `parts/job-items/index.js`, `parts/update-status.js` > parts allocation flow > TC-PA-001..004
- `src/lib/database/dashboard/parts.js` > parts dashboard > TC-PA-005
- `src/lib/vhc/vhcItemState.js` (NEW) > all VHC normalisation > TC-JD-002, TC-JT-002, TC-VHC-001, TC-VHC-002, TC-VHC-003, TC-VHC-009, TC-DI-005
- `src/lib/services/vhcStatusService.js` > authorisation history + totals > TC-VHC-001, TC-VHC-002, TC-LC-003
- `src/lib/services/jobStatusService.js` > job status transitions > TC-FP-002 (covered indirectly via release flow)
- `src/lib/vhc/calculateVhcTotals.js`, `quoteLines.js`, `shared.js`, `summaryStatus.js` > VHC summary/quote rendering > TC-VHC-002, TC-VHC-003
- `src/pages/api/vhc/update-item-status.js` > VHC decision PATCH > TC-JT-002
- `src/pages/api/vhc/upload-media.js` > VHC media upload > TC-VHC-004..008
- `src/pages/api/jobcards/upload-document.js` > generic document upload > TC-JC-002, TC-JC-003, TC-JC-004
- `src/pages/api/jobcards/[jobNumber]/upload-dealer-file.js` > dealer file upload > TC-FS-002 (and TC-JC-003 by analogy)
- `src/pages/api/jobcards/link-uploaded-files.js` > finalise temp uploads > TC-SP-001, TC-SP-002, TC-SP-003
- `src/lib/database/jobs.js` (`hasPaidInvoiceForJob`, `addJobFile`, decision normaliser) > release gate, file insert > TC-IR-011, TC-LC-001
- `src/lib/database/messages.js#ensureUserForCustomer` (NEW) > messaging connect-customer > TC-NM-001..005
- `src/pages/api/messages/connect-customer.js` > messaging connect-customer > TC-NM-001..005
- `src/lib/status/statusHelpers.js` (NEW) > job-status filters, invoice paid/overdue, VHC source check > TC-CP-001, TC-IR-007, TC-IR-008, TC-IR-010, TC-TW-001, TC-RP-001
- `src/lib/status/catalog/parts.js` (NORMALIZE_ITEM) > WriteUpForm + PartsTab > TC-PA-006, TC-PA-007
- `src/components/JobCards/WriteUpForm.js` > write-up save with parts on order > TC-PA-006
- `src/components/PartsTab_New.js` > parts tab rendering > TC-PA-007
- `src/components/Workshop/JobClockingCard.js` > workshop clock-on > TC-TW-001, TC-IR-010
- `src/components/dashboards/RetailManagersDashboard.js` > retail dashboard counts > TC-CP-001 (analogous), TC-IR-010
- `src/components/accounts/InvoiceTable.js` > accounts invoice list > TC-IR-008
- `src/features/invoices/components/InvoiceDetail.js` > invoice detail UI > TC-IR-007, TC-IR-009
- `src/features/invoices/components/InvoicePaymentModal.js` > take payment modal > TC-IR-007
- `src/components/Clocking/ClockingCard.js` (orphan) > N/A live > TC-LC-002, TC-FP-001
- `src/components/dashboards/DashboardClocking.js` (orphan) > N/A live > TC-LC-002, TC-FP-001
- `src/pages/login.js` + `src/components/LoginDropdown.js` > dev login > TC-AE-001, TC-AE-002
- `src/pages/job-cards/[jobNumber].js` > VHC decision counters on the job page > TC-JD-002
- `src/pages/job-cards/myjobs/[jobNumber].js` > tech parts request form > TC-TW-002, TC-TW-003, TC-TW-004
- `src/pages/job-cards/waiting/nextjobs.js` > waiting queue page > TC-LC-004
- `src/pages/customers/[customerSlug].js` > customer detail counters > TC-CP-001
- `src/pages/api/search/global.js` > global search > TC-RP-001 (smoke), filtered by `INACTIVE_JOB_IDS`
- `src/lib/database/schema/schemaReference.sql` > schema additions > TC-DI-001, TC-DI-002, TC-DI-003

---

## 6. Gaps or Uncertain Areas

- **`withRoleGuard` and the customer portal.** We have not seen the role guard implementation in this diff. It is **uncertain** whether customer-portal sessions, public share-link tokens, and any server-to-server callers are recognised. If any of TC-CP-002, TC-CP-003, TC-CP-004 fail, the whole customer-facing surface is broken — treat these as P0.
- **Snapshot migration application order.** Running the new code against a database where `20260410120000_invoice_snapshot_v1.sql` has not been applied is supported but only via the `42703` fallback. **Uncertain:** whether every Postgres / Supabase deployment surfaces the missing column with `code === '42703'` and a message containing `metadata` / `snapshot_version` / `meta`. If the message text differs, the fallback may not trigger and invoice creation will hard-fail.
- **`linkRequestToJobItem` is best-effort.** Failures only log to the server console (`console.error`). There is no surfaced telemetry — verify by inspecting both rows in the DB after each parts allocation, not by trusting the API response.
- **Connect-customer race safety.** TC-NM-004 is hard to reproduce manually. Consider scripting two parallel requests (`xargs -P 2 curl ...`) for confidence.
- **LoginDropdown default change to `workshop`.** **Uncertain:** whether `workshop` is a valid `roleCategories.retail` department label in the live config. If not, the dev login dropdown will boot empty.
- **Snapshot read-mode behaviour change.** Snapshot v1 invoices intentionally ignore live job_requests, parts_job_items, vhc_checks, job_writeups, and proforma_request_overrides. If any team still expected post-issue mutations to surface on the invoice (proforma overrides in particular), this is a breaking behaviour change. Confirm with accounts before release.
- **Schema reference vs actual migration.** `schemaReference.sql` was updated to describe the new columns and the `staff_vehicle_payroll_deductions` table, but no migration file is in `supabase/migrations/` (the `.gitkeep` was removed). **Uncertain:** whether the migration is being applied via a separate channel. If it isn't, the new columns and the new table won't exist in any environment.
- **Exploratory:** wander the entire app once with the network tab open looking for any 401/403 — the breadth of the role-guard wrap means there is no substitute for a real walk-through.
- **Exploratory:** delete a `parts_requests` row that has `fulfilled_by` set, and a `parts_job_items` row that has `source_request_id` set, and confirm both `ON DELETE SET NULL` rules are honoured (covered formally by TC-DI-001/002 but worth a manual eyeball).
