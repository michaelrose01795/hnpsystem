# Phase 1 — Frontend Feedback & Error Audit (Checklist)

**Deliverable of Phase 1** in [frontend-feedback-system-rollout.md](frontend-feedback-system-rollout.md).
**Type:** Read-only audit. **No app behaviour was changed.**
**Method:** Three parallel sweeps (error/alert/toast · loading/empty · validation/support-reporting) across `src/pages/**`, `src/components/**`, `src/features/**`, `src/lib/**`, sampling all major feature areas.
**Last updated:** 2026-07-03

> This is a working checklist. Tick items as they are resolved in later phases. Each item is tagged **[severity] · category · [rec. phase]** with the user impact stated inline.

---

## Legend

**Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low
**Phases** (see rollout doc): **P2** toast styling+a11y · **P3** helper layer + message catalogue · **P4** role-aware dev gating · **P5** API/DB typed errors · **P6** loading-state standard · **P7** empty-state standard · **P8** validation standard · **P9** boundaries + support-reporting · **P10** feature migration sweep.

---

## A. Executive summary & assumption corrections

The app has **more infrastructure than expected** but **near-zero consistent adoption**. Three assumptions from the source plan were corrected by the audit:

1. **`window.alert` is globally overridden** ([alertBus.js:42](src/lib/notifications/alertBus.js#L42)) — a bare `alert(...)` renders as a top-bar toast, *not* a native popup. So most of the ~687 `alert()` sites are already toasts. The real problems are: (a) genuinely **silent** `catch { console.error }` on user actions (~108 frontend sites), (b) **raw `error.message`** piped into those toasts, and (c) a handful of **true native** `window.alert`/`window.confirm` calls (website-manager, TrackingMap, usePdfExport, WheelsHubsModal). `confirm(...)` is **not** overridden.
2. **`SupportErrorBoundary` is app-wide**, not support-only — mounted at [_app.js:561](src/pages/_app.js#L561) wrapping the whole app. White-screen risk is low; the gap is **granularity** (only `job-cards` has a nested boundary) and that async failures never reach the report pipeline.
3. **Shared primitives exist but are barely/never adopted:** `buildErrorAlert`+`devInfo` (~4-5 files), `StaffEmptyState` (**0 feature files** — dev showcase only), skeletons (good in refactored screens, absent on dashboards).

**Sharpest single issue:** `devInfo` (stack traces, endpoints, file names) is rendered to **every** user by [TopbarAlerts.js:157-173](src/components/TopbarAlerts.js#L157-L173) with no role gate → **P4, 🟠 High**.

**Highest data-loss risks** (user thinks it worked): new-job customer/job save, accounts status toggle, VHC labour-hours/alias persists, messages group/member actions, deliveries status/confirm.

---

## B. Shared-primitive inventory (what to build on, not rebuild)

- [ ] **Alerts/toasts** — [alertBus.js](src/lib/notifications/alertBus.js) · [AlertContext.js](src/context/AlertContext.js) · [TopbarAlerts.js](src/components/TopbarAlerts.js). *Gap: inline styles, string-based type inference, dev row ungated.*
- [ ] **Friendly error builder** — [buildErrorAlert.js](src/lib/notifications/buildErrorAlert.js). *Gap: adopted in ~4-5 files only.*
- [ ] **Loading** — [LoadingSkeleton.js](src/components/ui/LoadingSkeleton.js) (`PageSkeleton`, `SectionSkeleton`, `InlineLoading`, `SkeletonTableRow`…), [RouteSkeletons.js](src/components/ui/RouteSkeletons.js), [JobCardShellSkeleton.js](src/components/ui/JobCardShellSkeleton.js), [HrTabLoadingSkeleton.js](src/components/HR/HrTabLoadingSkeleton.js). *Gap: dashboards use ad-hoc "Loading…" text.*
- [ ] **Empty state** — `StaffEmptyState` in [StaffShowcasePrimitives.js](src/components/ui/StaffShowcasePrimitives.js) + `.app-empty-state` CSS ([empty-states.css](src/styles/families/empty-states.css)). *Gap: **zero feature adoption** — every empty state is ad-hoc.*
- [ ] **Error boundary** — [SupportErrorBoundary.js](src/components/support/SupportErrorBoundary.js) (app-wide) + `JobCardErrorBoundary`. *Gap: no per-route granularity.*
- [ ] **Support reporting** — `SupportControl` in [StaffTopbar.js:376](src/components/layout/StaffTopbar.js#L376) · [SupportReportContext.js](src/context/SupportReportContext.js) · [api/support/reports.js](src/pages/api/support/reports.js) · [src/lib/support/](src/lib/support/). *Gap: async `alert()` failures don't feed it; no report path on customer/website/tech surfaces.*
- [ ] **Validation** — *none.* No `useForm`, no schema, no shared `validate()`. `aria-invalid`/`aria-describedby` appear in **0 files**.

---

## C. Findings by feature area

### C1. New Job / New Order
- [ ] 🔴 **New customer save fails silently** — [new-job/index.js:1251](src/pages/new-job/index.js#L1251) `console.error` only. *Customer not saved; user believes it was.* · silent-catch · **P10**
- [ ] 🔴 **Customer update fails silently** — [new-job/index.js:975](src/pages/new-job/index.js#L975). *Edit lost, no feedback.* · silent-catch · **P10**
- [ ] 🔴 **Job save fails silently** — [new-job/index.js:1522](src/pages/new-job/index.js#L1522). *Job creation may fail → lost/duplicate job.* · silent-catch · **P10**
- [ ] 🔴 **Job-card creation guarded only by native-style `alert`** — [new-job/index.js:1366-1395](src/pages/new-job/index.js#L1366-L1395). *Record-creating submit; no inline field marking.* · adhoc-validation · **P8**
- [ ] 🟡 DVLA lookup / contact-preference / signature failures silent or `alert` — [new-job/index.js:1352](src/pages/new-job/index.js#L1352), [:889](src/pages/new-job/index.js#L889), [:1068](src/pages/new-job/index.js#L1068). · silent-catch / adhoc-validation · **P8/P10**
- [ ] 🟠 **New-order save fails silently** — [new-order/index.js](src/pages/new-order/index.js). *Order save failure, no feedback.* · silent-catch · **P10**
- [ ] ⚪ Good example: new-order uses a `setErrorMessage` banner + disabled submit — [new-order/index.js:464-472](src/pages/new-order/index.js#L464-L472) (banner-level, no field aria). · good-example · **P8**

### C2. Job Cards (detail, write-up, tabs)
- [ ] 🟠 **Tracking entry save fails silently** — [job-cards/[jobNumber].js:1886](src/pages/job-cards/[jobNumber].js#L1886). · silent-catch · **P10**
- [ ] 🟠 **Write-up saved but status silently not advanced** — [WriteUpForm.js:1257](src/components/JobCards/WriteUpForm.js#L1257); also request/VHC status desync [:2013,2032](src/components/JobCards/WriteUpForm.js#L2013). · silent-catch · **P10**
- [ ] 🟠 **Mileage guard via native `alert`** on an important write — [job-cards/[jobNumber].js:2724](src/pages/job-cards/[jobNumber].js#L2724). · adhoc-validation · **P8**
- [ ] 🟠 Appointment/rebook date-time guards via `alert` — [job-cards/[jobNumber].js:2209,2338](src/pages/job-cards/[jobNumber].js#L2209). · adhoc-validation · **P8**
- [ ] 🟡 Booking-request notifications / status snapshot fail silently — [:2519](src/pages/job-cards/[jobNumber].js#L2519), [:1633](src/pages/job-cards/[jobNumber].js#L1633). · silent-catch · **P10**
- [ ] 🟡 Raw `err.message` shown on document replace + write-up save — [:1567](src/pages/job-cards/[jobNumber].js#L1567), [WriteUpForm.js:1284](src/components/JobCards/WriteUpForm.js#L1284). · raw-tech-msg · **P5**
- [ ] 🟡 One-off inline error banner (not shared system) — [job-cards/[jobNumber].js:1761](src/pages/job-cards/[jobNumber].js#L1761). · ad-hoc-ui · **P3/P10**
- [ ] 🟡 Raw `result.error` on clock actions — [JobClockingCard.js:108,144,193](src/components/Workshop/JobClockingCard.js#L108). · raw-tech-msg · **P5**
- [ ] 🟡 Warranty tab injects `window.alert` default + raw API errors — [WarrantyTab.js:37](src/components/page-ui/job-cards/WarrantyTab.js#L37), [:1096,1228,1246](src/components/page-ui/job-cards/WarrantyTab.js#L1096). · raw-alert / raw-tech-msg · **P5/P8**
- [ ] 🟡 Contact tab raw send error — [ContactTab.js:1122](src/components/page-ui/job-cards/ContactTab.js#L1122). · raw-tech-msg / no-report-path · **P5/P9**
- [ ] ⚪ Success + failure both via `alert` (inconsistent) — [job-cards/[jobNumber].js:3264-3358](src/pages/job-cards/[jobNumber].js#L3264). · poor-feedback · **P10**
- [ ] ✅ Good example: `JobCardErrorBoundary` nested on the page. · good-example · **P9**
- [ ] ⚪ Empty copy one-offs on jobs list — [jobs/index.js:471-475](src/pages/jobs/index.js#L471); status-change failure generic alert [:320](src/pages/jobs/index.js#L320). · adhoc-empty / poor-feedback · **P7/P10**

### C3. VHC
- [ ] 🔴 **Labour-hours edit lost silently** — [VhcDetailsPanel.js:6591](src/components/VHC/VhcDetailsPanel.js#L6591). *Persist fails, no feedback.* · silent-catch · **P10**
- [ ] 🟠 Alias persist/remove fail silently — [:1844](src/components/VHC/VhcDetailsPanel.js#L1844), [:1879](src/components/VHC/VhcDetailsPanel.js#L1879). · silent-catch · **P10**
- [ ] 🟠 Part metadata persist / item move fail silently — [:7010](src/components/VHC/VhcDetailsPanel.js#L7010), [:4451](src/components/VHC/VhcDetailsPanel.js#L4451). · silent-catch · **P10**
- [ ] 🟠 **Raw Supabase text on "add to job"** (key action) — [:7470](src/components/VHC/VhcDetailsPanel.js#L7470); also update/remove part [:7390,8169](src/components/VHC/VhcDetailsPanel.js#L7390). · raw-tech-msg / no-report-path · **P5/P9**
- [ ] 🟡 Blocking "cannot be completed" reason only in toast/dialog — [:4238](src/components/VHC/VhcDetailsPanel.js#L4238). · poor-feedback · **P8**
- [ ] 🟡 Native `window.alert` placeholders shipped — [WheelsHubsModal.js:39,48](src/components/VHC/WheelsHubsModal.js#L39). · raw-alert · **P10**
- [ ] ⚪ Ad-hoc empty "No technician entries…" — [:1472](src/components/VHC/VhcDetailsPanel.js#L1472). · adhoc-empty · **P7**
- [ ] ✅ **Good examples** — correct `showAlert(buildErrorAlert(...))` in [MediaUploadConfirmModal.js:85](src/components/VHC/MediaUploadConfirmModal.js#L85), [FullScreenCapture.js:1360](src/components/VHC/mediaCapture/FullScreenCapture.js#L1360), [CustomerVideoButton.js:123](src/components/VHC/CustomerVideoButton.js#L123). *Reference pattern for the migration.* · good-example · —

### C4. Parts / Goods-In / Consumables / Stock
- [ ] 🟠 **All parts actions surface raw `Error: ${message}`** (7×) — [PartsTab.js:583,617,1033,1421,1500,1561,1711](src/components/PartsTab.js#L583). · raw-tech-msg / no-report-path · **P5/P9**
- [ ] 🟠 **Goods-in uses a bespoke local `setToast` + raw error strings** (bypasses shared system) — [goods-in/index.js:355,483,564,585,631](src/pages/goods-in/index.js#L355); inline error banners [:1685,1868](src/pages/goods-in/index.js#L1685). · ad-hoc-ui / raw-tech-msg · **P3/P5/P10**
- [ ] 🟡 Parts selection guards via native-style `alert` — [PartsTab.js:1456,1460](src/components/PartsTab.js#L1456). · adhoc-validation · **P8**
- [ ] 🟡 Stock-catalogue writes concat raw `err.message`; dead-end — [stock-catalogue.js:708,817,871](src/pages/stock-catalogue.js#L708). · raw-tech-msg / no-report-path · **P5/P9**
- [ ] 🟡 Consumables request guard via `alert` — [consumables-request.js:311-312](src/pages/consumables-request.js#L311). · adhoc-validation · **P8**
- [ ] 🟡 Stock-check popup failures silent (5 catches) — [StockCheckPopup.js](src/components/Consumables/StockCheckPopup.js). · silent-catch · **P10**
- [ ] 🟡 **Background parts fetch shows no loading indicator** — [PartsTab.js:525](src/components/PartsTab.js#L525). · missing-loading · **P6**
- [ ] 🟡 Parts-manager panels + goods-in detail render ad-hoc empties — [parts-manager-ui.js:338,422](src/components/page-ui/parts/parts-manager-ui.js#L338), [parts-goods-in-goods-in-number-ui.js:117,198,222](src/components/page-ui/parts/goods-in/parts-goods-in-goods-in-number-ui.js#L117). · adhoc-empty · **P7**
- [ ] 🟡 Supplier search: raw "Loading suppliers…" text + ad-hoc empty — [goods-in/index.js:1866-1877](src/pages/goods-in/index.js#L1866). · adhoc-loading / adhoc-empty · **P6/P7**
- [ ] 🟡 Consumables tracker: raw "Loading logs…" in table cell + ad-hoc empties — [workshop-consumables-tracker-ui.js:621-633](src/components/page-ui/workshop/workshop-consumables-tracker-ui.js#L621). · adhoc-loading/empty · **P6/P7**
- [ ] ⚪ Delivery planner: several one-off error/empty blocks — [parts-delivery-planner-ui.js:208,356,701](src/components/page-ui/parts/parts-delivery-planner-ui.js#L208). · adhoc-empty · **P7**
- [ ] ✅ Good examples: `InlineLoading` on catalogue/KPI tiles ([PartsTab.js:2185](src/components/PartsTab.js#L2185), [workshop-consumables-tracker-ui.js:525](src/components/page-ui/workshop/workshop-consumables-tracker-ui.js#L525)); skeleton rows on deliveries ([parts-deliveries-ui.js:116](src/components/page-ui/parts/parts-deliveries-ui.js#L116)); `DeliverySchedulerModal` inline banner ([:84](src/components/Parts/DeliverySchedulerModal.js#L84)). · good-example · —

### C5. Notes
- [ ] 🟡 Whole tab replaced by ad-hoc "Loading notes..." text (layout jump) — [NotesTab.js:718-720](src/components/NotesTab.js#L718). · adhoc-loading · **P6**
- [ ] ⚪ Multiple ad-hoc empty blocks ("No notes yet", history, requests) — [NotesTab.js:934-944,1482-1484,1686,1729,1771](src/components/NotesTab.js#L934). · adhoc-empty · **P7**
- [ ] ⚪ Inline "Loading viewers…" not using `InlineLoading` — [NotesTab.js:1417](src/components/NotesTab.js#L1417). · adhoc-loading · **P6**
- [ ] ✅ Good example: `NotesLoadingSkeleton` composed from primitives — [GlobalNotesWidget.js:186-200](src/components/GlobalNotesWidget.js#L186). · good-example · —

### C6. Clocking / Tech (mobile)
- [ ] 🟠 Load history/active-jobs/requests fail silently — [clocking/[technicianSlug].js:263,321,387](src/pages/clocking/[technicianSlug].js#L263). · silent-catch · **P10**
- [ ] 🟠 Part-request / clock / note failures dead-end at raw `alert(err.message)` — [tech/[jobNumber].js:1219,1292,2028](src/pages/tech/[jobNumber].js#L1219). · no-report-path / raw-tech-msg · **P5/P9**
- [ ] 🟠 Part-request & note guards via native-style `alert` — [tech/[jobNumber].js:1257](src/pages/tech/[jobNumber].js#L1257), [:2001](src/pages/tech/[jobNumber].js#L2001). · adhoc-validation · **P8**
- [ ] 🟡 Manual clocking entry shows raw `err.message` — [clocking/[technicianSlug].js:629](src/pages/clocking/[technicianSlug].js#L629). · raw-tech-msg · **P5**
- [ ] 🟡 Clocking validation via emoji native-style `alert` — [JobClockingCard.js:76,94,108](src/components/Workshop/JobClockingCard.js#L76). · adhoc-validation · **P8**
- [ ] 🟡 "Failed to load job" blocks with no retry — [tech/[jobNumber].js:1010](src/pages/tech/[jobNumber].js#L1010). · no-boundary/retry · **P9**
- [ ] ✅ Good examples: `ClockingList` skeleton rows ([ClockingList.js:16](src/components/Clocking/ClockingList.js#L16)); tech dashboard `InlineLoading`+`PageSkeleton` ([tech-dashboard-ui.js:40](src/components/page-ui/tech/tech-dashboard-ui.js#L40)). · good-example · —

### C7. Messages
- [ ] 🟠 Group create / add-member / remove / delete-thread fail silently — [messages/index.js:1739,2456,2479,2553](src/pages/messages/index.js#L1739). · silent-catch · **P10**
- [ ] 🟠 Message-send shows raw `error.message` — [messages/index.js:1939](src/pages/messages/index.js#L1939); send-failure not reportable [ContactTab.js:1122](src/components/page-ui/job-cards/ContactTab.js#L1122). · raw-tech-msg / no-report-path · **P5/P9**
- [ ] 🟡 Load threads/conversation fail silently (blank conversation) — [messages/index.js:1404,1471](src/pages/messages/index.js#L1404). · silent-catch · **P10**
- [ ] ⚪ Ad-hoc empties (messages, system notifications, directory) — [messages-ui.js:804,551,1254,1339](src/components/page-ui/messages/messages-ui.js#L804). · adhoc-empty · **P7**
- [ ] ✅ Good example: layout-matched skeletons (`ThreadRowsSkeleton`, `MessageBubblesSkeleton`) — [messages/index.js:32-93](src/pages/messages/index.js#L32). · good-example · —

### C8. Deliveries
- [ ] 🟠 Status update / confirm-delivery / send-notification fail silently — [deliveries/[deliveryId].js:332,396,511](src/pages/deliveries/[deliveryId].js#L332). *Delivery may not confirm; user unaware.* · silent-catch · **P10**
- [ ] 🟡 Save-note / add-stop / delete show raw Supabase error in banners — [deliveries/[deliveryId].js:480,596,680](src/pages/deliveries/[deliveryId].js#L480). · raw-tech-msg · **P5**
- [ ] ⚪ Ad-hoc empty for stop list — [parts-deliveries-delivery-id-ui.js:487-491](src/components/page-ui/parts/deliveries/parts-deliveries-delivery-id-ui.js#L487). · adhoc-empty · **P7**

### C9. Appointments
- [ ] 🟠 **Booking guarded only by native-style `alert`** (job number required ×3) — [appointments/index.js:782-792](src/pages/appointments/index.js#L782). · adhoc-validation · **P8**
- [ ] 🟠 Raw `error.message` in booking flow — [appointments/index.js:899](src/pages/appointments/index.js#L899). · raw-tech-msg · **P5**
- [ ] 🟡 Load hours/availability fail silently — [appointments/index.js:481,516,553,607](src/pages/appointments/index.js#L481). · silent-catch · **P10**
- [ ] ⚪ Multi-line native-style success text; ad-hoc empties — [:881](src/pages/appointments/index.js#L881), [appointments-ui.js:1692,1903](src/components/page-ui/appointments/appointments-ui.js#L1692). · poor-feedback / adhoc-empty · **P2/P7**
- [ ] ✅ Good examples: table skeleton + `disabled={isLoading}` "Booking…" button — [appointments-ui.js:1488,1336](src/components/page-ui/appointments/appointments-ui.js#L1336). · good-example · —

### C10. Accounts / Company Accounts / Payslips / Invoices
- [ ] 🔴 **Account status toggle fails silently** — [accounts/view/[accountId].js:89](src/pages/accounts/view/[accountId].js#L89). *User believes status changed; it did not.* · silent-catch · **P10**
- [ ] 🟠 **Payslip (money) can save with empty/zero rows** — no guard visible — [PayslipUpsertModal.js:50-75](src/features/payslips/PayslipUpsertModal.js#L50). · no-validation · **P8**
- [ ] 🟡 Load accounts / financial records / transactions fail silently (blank tables) — [accounts/index.js:96,124](src/pages/accounts/index.js#L96), [transactions/[accountId].js:40](src/pages/accounts/transactions/[accountId].js#L40). · silent-catch · **P10**
- [ ] 🟡 Empty account → blank transaction/invoice tables, no empty message — [accounts-view-account-id-ui.js:230-238](src/components/page-ui/accounts/view/accounts-view-account-id-ui.js#L230). · missing-empty · **P7**
- [ ] 🟡 `AccountForm` relies on HTML5 `required` only (no JS guard/inline error) — [AccountForm.js](src/components/accounts/AccountForm.js). · no-validation · **P8**
- [ ] 🟡 Invoice proforma override: silent no-op save + dead-end `alert` — [ProformaOverrideModal.js:79,178](src/features/invoices/components/ProformaOverrideModal.js#L79). · poor-feedback / no-report-path · **P8/P9**
- [ ] ⚪ Ad-hoc empties (payslips, payments, company accounts status-message) — [payslips-ui.js:167](src/components/page-ui/accounts/payslips/payslips-ui.js#L167), [accounts-invoices-invoice-id-ui.js:257](src/components/page-ui/accounts/invoices/accounts-invoices-invoice-id-ui.js#L257), [company-accounts-ui.js:91](src/components/page-ui/company-accounts/company-accounts-ui.js#L91). · adhoc-empty · **P7**
- [ ] ✅ Good examples: `CompanyAccountForm` native `required` + banner + disabled submit ([:109-126](src/components/companyAccounts/CompanyAccountForm.js#L109)); payslips uses `ConfirmationDialog` not native confirm ([accounts/payslips/index.js:140](src/pages/accounts/payslips/index.js#L140)). · good-example · **P8**

### C11. HR / Profile
- [ ] 🟡 Leave form: inline errors but **success via `window.alert`** (inconsistent) — [ProfileWorkTab.js:285-298](src/components/profile/ProfileWorkTab.js#L285) vs [:1754,1793](src/components/profile/ProfileWorkTab.js#L1754). · poor-feedback / adhoc-validation · **P8**
- [ ] 🟡 Raw `error.message` on leave-request delete — [ProfileWorkTab.js:1796](src/components/profile/ProfileWorkTab.js#L1796). · raw-tech-msg · **P5**
- [ ] ⚪ Clipboard copy fails silently — [EmployeeProfilePanel.js:84](src/components/HR/EmployeeProfilePanel.js#L84). · silent-catch · **P10**
- [ ] ✅ Good examples: `HrTabLoadingSkeleton` used correctly — [HRDashboardTab.js:52](src/components/HR/tabs/HRDashboardTab.js#L52), [hr-ui.js:25](src/components/page-ui/hr/hr-ui.js#L25). · good-example · —

### C12. Admin / Users
- [ ] 🟠 **Empty arrays silently replaced by MOCK data** — [admin-users-ui.js:177-183](src/components/page-ui/admin/users/admin-users-ui.js#L177). *Shows plausible fake rows; masks empty state AND fetch failure.* · missing-empty · **P7**
- [ ] 🟡 User provisioning relies on HTML5 `required` only; role/department selects unguarded — [AdminUserForm.js:106-142](src/components/Admin/AdminUserForm.js#L106). · adhoc-validation · **P8**
- [ ] 🟡 Deactivate failure dead-ends at `alert(err.message)` (destructive) — [admin/users/index.js:176](src/pages/admin/users/index.js#L176). · no-report-path · **P9**
- [ ] ✅ Good examples: strong per-section skeletons (`SkeletonBlock`, `SkeletonTableRow`, `InlineLoading`) — [admin-users-ui.js:230-243](src/components/page-ui/admin/users/admin-users-ui.js#L230). · good-example · —

### C13. Tracking
- [ ] 🟡 Equipment/oil-check saves show raw `error.message` — [tracking/index.js:2064,2101,2153,2207,2226,2245](src/pages/tracking/index.js#L2064). · raw-tech-msg · **P5**
- [ ] 🟡 Equipment/check form guards via native-style `alert` — [tracking/index.js:921,1145,1417](src/pages/tracking/index.js#L921). · adhoc-validation · **P8**
- [ ] 🟡 **Native `window.confirm`** "Clear the whole map?" (blocking) — [TrackingMap.js:137](src/features/tracking/map/TrackingMap.js#L137). · raw-alert · **P2**
- [ ] ✅ Good example: `TrackingRouteSkeleton` layout-matched — [RouteSkeletons.js:5-95](src/components/ui/RouteSkeletons.js#L5). · good-example · —

### C14. Website Manager / Customer-facing surfaces
- [ ] 🟡 **Native `window.confirm` on destructive deletes** (bypass shared UX) — [ShopPanel.js:105,208](src/features/websiteManager/panels/ShopPanel.js#L105), [MediaPanel.js:89](src/features/websiteManager/panels/MediaPanel.js#L89), [LivePreviewPanel.js:173](src/features/websiteManager/panels/LivePreviewPanel.js#L173), [PageContentPanel.js:202](src/features/websiteManager/panels/PageContentPanel.js#L202), [website/profile.js:3384](src/pages/website/profile.js#L3384). · raw-alert · **P2/P10**
- [ ] 🟡 Website panels manage loading inconsistently (no shared skeleton) — [ShopPanel.js](src/features/websiteManager/panels/ShopPanel.js), [PageContentPanel.js](src/features/websiteManager/panels/PageContentPanel.js). · adhoc-loading · **P10**
- [ ] 🟠 **Customer VHC page: raw fallback `alert` + no report path** (renders outside StaffTopbar) — [vhc/customer/[jobNumber]/[linkCode].js:234,241](src/pages/vhc/customer/[jobNumber]/[linkCode].js#L234). *Least-supported users, least reporting reach.* · raw-tech-msg / no-report-path · **P5/P9**
- [ ] 🟡 **Native `window.alert` "PDF export failed"** (bypasses toast) — [usePdfExport.js:104](src/features/presentation/usePdfExport.js#L104). · raw-alert · **P2**

### C15. Dashboards
- [ ] 🟠 **Ad-hoc "Loading …" paragraph text everywhere** (layout shift, feels broken vs skeleton screens) — [dashboard-workshop-ui.js:79-147](src/components/page-ui/dashboard/workshop/dashboard-workshop-ui.js#L79), [dashboard-managers-ui.js:46-47](src/components/page-ui/dashboard/managers/dashboard-managers-ui.js#L46), [dashboard-parts-ui.js:76,80,106](src/components/page-ui/dashboard/parts/dashboard-parts-ui.js#L76). · adhoc-loading · **P6**
- [ ] ⚪ Ad-hoc per-card empty branches — [dashboard-service-ui.js:141,199,216](src/components/page-ui/dashboard/service/dashboard-service-ui.js#L141), [dashboard-parts-ui.js:76](src/components/page-ui/dashboard/parts/dashboard-parts-ui.js#L76). · adhoc-empty · **P7**

### C16. Login / Auth
- [ ] 🟠 Auth error caught, `console.error` only (login may show nothing) — [login.js](src/pages/login.js). · silent-catch · **P9/P10**
- [ ] 🟡 Login selection guard via native-style `alert` — [login.js:332](src/pages/login.js#L332). · adhoc-validation · **P8**

### C17. Newsfeed
- [ ] 🟡 Key feed empty state is a one-off `text-center py-16` block — [newsfeed-ui.js:75](src/components/page-ui/newsfeed-ui.js#L75). · adhoc-empty · **P7**

---

## D. Cross-cutting / systemic (infrastructure)

- [ ] 🟠 **`devInfo` shown to all users** — gate the "Copy for Dev" row on a developer/admin role — [TopbarAlerts.js:157-173](src/components/TopbarAlerts.js#L157-L173), [buildErrorAlert.js:31-39](src/lib/notifications/buildErrorAlert.js#L31). · devinfo-exposed · **P4**
- [ ] 🟡 **Brittle string/emoji type inference** — messages must be prefixed with ✅/❌/⚠ to get the right tone; replace with explicit `type` — [alertBus.js:4-18](src/lib/notifications/alertBus.js#L4-L18). · adhoc-ui · **P2/P3**
- [ ] 🟡 **`TopbarAlerts` uses inline styles**, not `.app-alert` CSS; move to `staffglobal.css`, add a11y (live region, icons, keyboard, reduced-motion) — [TopbarAlerts.js](src/components/TopbarAlerts.js). · adhoc-ui · **P2**
- [ ] 🟠 **`buildErrorAlert` adopted in ~4-5 files only** — everywhere else pipes raw `error.message`; this is the core P3/P5 migration. · adhoc-ui · **P3/P5**
- [ ] 🟡 **DB helpers log-and-rethrow pervasively** ([jobs.js](src/lib/database/jobs.js) ~31, [notes.js](src/lib/database/notes.js) ~13, [clocking.js](src/lib/database/clocking.js) ~10, warranty/customers/vehicles…) — correct at the DB layer; silence is a **frontend** call-site problem → fix via P5 typed errors + P10 call-site sweep. · systemic · **P5/P10**
- [ ] 🟠 **~150 async `alert(err.message)` sinks connect to nothing** — no reference code, no "report" affordance; wire into the existing report pipeline. · no-report-path · **P9/P10**
- [ ] 🟡 **No per-route error boundaries** (only app-wide + `job-cards`) — a leaf crash unmounts the whole shell. · no-boundary · **P9**
- [ ] 🟡 **No report path on customer/website/tech surfaces** (render outside `StaffTopbar`). · no-report-path · **P9**
- [ ] 🟠 **No shared form-validation helper; `aria-invalid`/`aria-describedby` in 0 files** — build one accessible reference pattern. · no-validation · **P8**
- [ ] 🟠 **`StaffEmptyState` has zero feature adoption** — every empty state is ad-hoc (~30+ blocks). · adhoc-empty · **P7/P10**
- [ ] 🟡 **Native `window.confirm` not overridden** — several panels use it directly vs the `useConfirmation()` context; standardise. · raw-alert · **P2/P10**
- [ ] ⚪ **`alertBus` import-order fragility** — if `alertBus.js` isn't imported early, overridden `window.alert` calls silently no-op; add a guardrail. · systemic · **P9**

---

## E. Phase rollup (where the work lands)

| Phase | Theme | Approx. finding count | Headline items |
|---|---|---|---|
| **P2** | Toast styling + a11y | ~8 | Move `TopbarAlerts` to CSS; kill native `window.alert`/`confirm` (TrackingMap, usePdfExport, website panels, WheelsHubs) |
| **P3** | Helper layer + catalogue | ~6 | `reportError`/catalogue; migrate goods-in bespoke toast; explicit `type` |
| **P4** | Role-aware dev gating | 2 | **Gate `devInfo` behind dev role** (High) |
| **P5** | API/DB typed errors | ~20 | Stop piping raw `error.message` (PartsTab, VHC, tracking, deliveries, appointments, messages) |
| **P6** | Loading standard | ~10 | Dashboard "Loading…" → skeletons; background-fetch indicators |
| **P7** | Empty-state standard | ~20 | Adopt `StaffEmptyState`; fix admin/users MOCK-data masking |
| **P8** | Validation standard | ~25 | One accessible inline-error pattern; new-job/appointments/tech/payslip guards |
| **P9** | Boundaries + reporting | ~12 | Per-route boundaries; wire `alert()` sinks + reference codes to report hub; customer surfaces |
| **P10** | Feature migration sweep | ~40 | Silent-catch → `reportError`; success toasts; per-feature cleanup |

## F. Priority backlog (do these first)

**🔴 Critical (data-loss / user-misled):**
1. [ ] new-job customer/job save silent failures — C1
2. [ ] accounts status toggle silent failure — C10
3. [ ] VHC labour-hours persist silent failure — C3
4. [ ] payslip saves with empty/zero rows — C10

**🟠 High (broad impact / exposure):**
5. [ ] `devInfo` exposed to all users — D / **P4**
6. [ ] admin/users MOCK-data masking — C12 / **P7**
7. [ ] messages group/member actions silent — C7
8. [ ] deliveries status/confirm silent — C8
9. [ ] appointments booking validation native-only — C9 / **P8**
10. [ ] ~150 `alert()` sinks → report pipeline — D / **P9**
11. [ ] dashboards ad-hoc loading text — C15 / **P6**
12. [ ] parts raw-error toasts (PartsTab ×7, goods-in) — C4 / **P5**

---

## G. Ready for Phase 2?

Phase 1 exit criteria (per rollout doc):
- [x] Seven pattern types swept across all major feature areas.
- [x] Findings classified by feature area, category, severity, user impact, recommended phase.
- [x] Shared-primitive inventory + adoption level confirmed.
- [ ] **Decision needed:** confirm the developer/diagnostic **role group** in [roles.js](src/lib/auth/roles.js) for P4 gating (do not hardcode).
- [ ] **Decision needed:** confirm tone-token **WCAG AA contrast** before P2 exit.
- [ ] **Decision needed:** approve the message-key catalogue targets (rollout §Phase 3).

*Audit only — no application behaviour was changed. Later phases require `CLAUDE.md` pre-flight + stop-and-confirm on any global change (P6/P7 shared components, P9 layout/`AlertContext`).*
