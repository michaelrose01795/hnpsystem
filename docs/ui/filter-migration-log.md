# Filter button migration log

**Date:** 2026-09-23

Every staff page and popup that had filter dropdowns in a toolbar now puts those dropdowns inside the shared filter button (`FilterButton` in `src/components/ui/filterAPI/`, styled by the `.app-filter` block in `src/styles/staffglobal.css`). Search bars stay in the toolbar and are capped at the width of "Search.." followed by 25 spaces (`33ch` plus room for the clear button). The rule is in `staffglobal.css` next to the other `.searchbar-api` rules.

This log covers every file that renders a dropdown (`DropdownField`, `Dropdown`, `MultiSelectDropdown` or a native `<select>`), except the shared primitives in `src/components/ui/` and the customer website (`/website`, which does not use the staff design system).

- **Moved:** 67 dropdowns
- **Considered but not moved:** 82 controls
- **Files with no filters at all (form fields only):** 54

## What counts as a filter

A dropdown that narrows, sorts or scopes a list, table, feed, board, map or report on the same screen. These are **not** filters and stay where they are:

- data-entry form fields
- a dropdown that picks the record the whole page is about
- view-mode switches
- the topbar
- date and month pickers: their menus are not portalled, so they would be clipped inside the floating card

## Follow-ups still open

1. **Dead CSS left in place.** These rules are no longer used by anything. They were left alone so this sweep only changed layout, not styling, and can be removed in a cleanup pass:
   - `staffglobal.css`:
     - `.job-cards-view-filter-controls`, `.job-cards-view-filter-slot` and `.job-cards-view-filter-control` (including its `.dropdown-api` sub-rules)
     - `.job-cards-filter.dropdown-api`
     - the base `.job-cards-view-search-shell` 4-column grid. The `:not(:has(.job-cards-view-filter-controls))` variant now always applies.
     - `.efficiency-tech-filter-dropdown`
   - `src/features/stockControl/stockControl.css`: `.stock-toolbar__filter`
   - `equipmentTracker.css`: `.equipment-toolbar__field`
2. **Stock catalogue Location filter.** It is a hand-built input with its own menu that is not portalled. Inside the card, its menu scrolls within the card instead of floating over it. It should be migrated to `DropdownField`.

## Moved

| File | Control | Reason |
|---|---|---|
| src/components/accounts/InvoiceTable.js | Status DropdownField | Narrows the invoice table; FilterButton sits after the search bar. activeCount = status set; Clear all resets status to "" |
| src/components/accounts/InvoiceTableToolbar.js | Status DropdownField | Narrows the /accounts/invoices table; FilterButton placed after the search bar. Clear all resets status |
| src/components/accounts/TransactionTable.js | Type DropdownField | Narrows the transactions table (header toolbar, non-headerless mode) |
| src/components/accounts/TransactionTable.js | Payment Method DropdownField | Narrows the transactions table; same FilterButton as Type. Clear all resets type + payment_method |
| src/components/activity/ActivityLogView.js | User, Role, Department, Session, Device, Browser, Action, Status DropdownFields | Narrow the activity log. They edit the existing draft filters, so FilterButton gets onApply={applyFilters} ("Show results" applies the draft) and Clear all resets those eight draft keys to EMPTY_FILTERS. FilterButton sits in the Apply/Reset action row |
| src/components/Clocking/EfficiencyTab.js | Technician DropdownField (`efficiencyOverviewTech`, overall tab) | Scopes the efficiency list/summaries; now in a FilterButton after the search bar (only rendered on the Overall tab, as before). Dropped the fixed-width wrapper, inline width and the `compact-picker efficiency-tech-filter-dropdown` sizing classes (fit-content width). |
| src/components/HR/tabs/EmployeesTab.js | Department DropdownField (DirectoryFilters) | Filters the employee directory; FilterButton sits where the filters were, before Add Employee. |
| src/components/HR/tabs/EmployeesTab.js | Status DropdownField (DirectoryFilters) | Directory filter. |
| src/components/HR/tabs/EmployeesTab.js | Employment Type DropdownField (DirectoryFilters) | Directory filter. |
| src/components/NotesTab.js | Notes type DropdownField (`notes-filter-type`) | Filters the notes list (pinned / internal / customer / role); now in a FilterButton after the search bar. Removed its inline width. |
| src/components/page-ui/accounts/payslips/payslips-ui.js | User DropdownField | Narrows the payslips table; FilterButton after the search bar |
| src/components/page-ui/accounts/payslips/payslips-ui.js | Department DropdownField | Narrows the payslips table |
| src/components/page-ui/accounts/payslips/payslips-ui.js | Status DropdownField | Narrows the payslips table. Clear all resets userId/department/status via handleFilterChange (functional setter) |
| src/components/page-ui/accounts/transactions/accounts-transactions-account-id-ui.js | Type DropdownField | Narrows the account's transactions table; FilterButton sits where the dropdowns were in the page toolbar |
| src/components/page-ui/accounts/transactions/accounts-transactions-account-id-ui.js | Payment Method DropdownField | Same FilterButton; Clear all resets type + payment_method |
| src/components/page-ui/customers/customers-ui.js | Sort DropdownField | Sort-by for the customer list; FilterButton after the search bar. Default taken as sortOptions[0] ("recent", defined in src/pages/customers/index.js); activeCount = 1 when sort differs from it. Option labels still read "Sort: …" (owned by the page file, outside batch) |
| src/components/page-ui/job-cards/archive/job-cards-archive-ui.js | Status DropdownField (statusFilter) | Label "Status", id job-cards-archive-filter-status; default "all" |
| src/components/page-ui/job-cards/archive/job-cards-archive-ui.js | Sort DropdownField (sortOrder) | Label "Sort", id job-cards-archive-filter-sort; default "updated-desc" |
| src/components/page-ui/job-cards/view/job-cards-view-ui.js | Division DropdownField (divisionFilter) | Label "Division", id job-cards-view-filter-division; default "All". Option labels simplified from "Division filter: X" to "All divisions" / "Retail" / "Sales" as the field label now names it. size="sm" and .job-cards-filter class dropped; the three DevLayoutSection width/slot wrappers removed |
| src/components/page-ui/job-cards/view/job-cards-view-ui.js | Status DropdownField (activeStatusFilter) | Label "Status", id job-cards-view-filter-status; default "All". Option labels "Status filter: X" -> "All statuses" / X; descriptions (counts) kept |
| src/components/page-ui/parts/orders/orders-view-ui.js | Fulfilment DropdownField (fulfilmentFilter) | Label "Fulfilment", id orders-view-filter-fulfilment; default "all". Inline flex/min-width sizing removed. SearchBar uses `.job-cards-view-searchbar`, so the global cap is defeated here too (see above) |
| src/components/page-ui/parts/parts-deliveries-ui.js | Status DropdownField (statusFilter) | Label "Status", id parts-deliveries-filter-status; default "all" |
| src/components/page-ui/parts/parts-deliveries-ui.js | Driver DropdownField (driverFilter) | Label "Driver", id parts-deliveries-filter-driver; default "all" |
| src/components/page-ui/parts/parts-deliveries-ui.js | Vehicle DropdownField (vehicleFilter) | Label "Vehicle", id parts-deliveries-filter-vehicle; default "all". onClear resets only the three dropdowns (the page's clearFilters also clears search, so it was not reused) |
| src/components/page-ui/parts/parts-delivery-planner-ui.js | Day DropdownField (selectedDate, "Filter by day") | Label "Day", id parts-delivery-planner-filter-day; default "". The inline-styled label/span wrapper was removed. The existing "Clear day filter" button was left in place |
| src/components/page-ui/stock-catalogue-ui.js | Filter Type DropdownField (filterType) | Label "Filter Type", id stock-catalogue-filter-type. Two-step selector kept intact inside the card; not counted in activeCount (it only picks which field shows); onClear resets it to "status" |
| src/components/page-ui/stock-catalogue-ui.js | Status DropdownField (statusFilter) | Label "Status", id stock-catalogue-filter-status; default "all" |
| src/components/page-ui/stock-catalogue-ui.js | Location custom search input + hand-rolled menu (locationFilter) | Label "Location", id stock-catalogue-filter-location. Moved with its set, since the Filter Type selector shows it. Its inline `minWidth: 140px / width: auto` removed. RISK: its menu is absolutely positioned (not portalled) and the card body is `overflow-y: auto`, so the 300px menu scrolls within the card instead of floating. It is a raw input + DOM-manipulated menu (`document.getElementById('location-dropdown')`); it should be migrated to DropdownField (searchable) |
| src/components/page-ui/stock-catalogue-ui.js | Category DropdownField (categoryFilter) | Label "Category", id stock-catalogue-filter-category; default "all" |
| src/components/page-ui/stock-catalogue-ui.js | Supplier DropdownField (supplierFilter) | Label "Supplier", id stock-catalogue-filter-supplier; default "all". activeCount counts status/location/category/supplier (all four apply at once in the filtering logic); onClear also clears locationSearchTerm and resets displayLimit to 20 as the existing handlers do |
| src/components/page-ui/tracking/tracking-ui.js | Location DropdownField (trackerLocationFilter, Key/Parking) | Label "Location", id tracking-filter-location; default "all". Inline flex/min/max width sizing and size="sm" removed |
| src/components/page-ui/tracking/tracking-ui.js | Status DropdownField (trackerQuickFilter, Key/Parking) | Label "Status", id tracking-filter-status; default "all". Same FilterButton as Location |
| src/components/page-ui/tracking/tracking-ui.js | Type DropdownField (equipmentTypeFilter, Equipment/Tools) | Moved into the equipment panel's filter card as its first field (`EquipmentTrackerPanel` `categoryOptions` / `onCategoryChange`), so the Equipment/Tools tab has one filter button, not two. Default "all"; cleared by the panel's Clear all. |
| src/components/reporting/ReportFilterBar.js | DropdownField "Date range" | date-preset scoping every report; now "Date Range" in the card; default `last_30d`, Clear resets range + from/to |
| src/components/reporting/ReportFilterBar.js | DropdownField "Trend granularity" | scopes the report trend; now "Granularity"; default `day`. Removed the now-unused `pickerStyle` fixed widths and the search bar's inline `maxWidth` (it only existed to keep it even with the pickers); controls basis lowered to 240px |
| src/components/StatusTracking/JobProgressTracker.js | User DropdownField (`timeline-filter-user`) | Filters the timeline; FilterButton replaces the filter row next to the "Timeline" heading. Removed `usePortal={false}`, the absolute menuStyle, fit-content width and `app-autowidth`. |
| src/components/StatusTracking/JobProgressTracker.js | Action DropdownField (`timeline-filter-action`) | Timeline filter, same card. |
| src/components/support/dev/SupportWorkspace.js | DropdownField status | filters the report queue; "Status", default "" |
| src/components/support/dev/SupportWorkspace.js | DropdownField severity | "Severity", default "" |
| src/components/support/dev/SupportWorkspace.js | DropdownField category | "Category", default "" |
| src/components/support/dev/SupportWorkspace.js | DropdownField sort | "Sort", default `impact`. Search input stays in the row (grid changed to a flex row so the search fills it and the button sits at the end) |
| src/features/customers/hub/CustomerActivityTab.js | DropdownField "Show" | filters the activity timeline by source; label "Source", default `all`; button placed in `app-filter-bar__actions` beside the existing Clear button |
| src/features/customers/hub/CustomerFilesSection.js | DropdownField "File type" | "File Type", default `all` |
| src/features/customers/hub/CustomerFilesSection.js | DropdownField "Job" | "Job", default `all` |
| src/features/customers/hub/CustomerFilesSection.js | DropdownField "Sort" | "Sort", default `newest`; button in a new `app-filter-bar__actions` div (existing class) |
| src/features/customers/hub/CustomerHistoryTab.js | DropdownField "Event type" | "Event Type", default `all`; button beside the existing Clear button |
| src/features/staffStyleReview/StaffStyleReviewPage.js | SelectFilter Category | "Category", default "" |
| src/features/staffStyleReview/StaffStyleReviewPage.js | SelectFilter Route | "Route" |
| src/features/staffStyleReview/StaffStyleReviewPage.js | SelectFilter Source file | "Source File" |
| src/features/staffStyleReview/StaffStyleReviewPage.js | SelectFilter Feature area | "Feature Area" |
| src/features/staffStyleReview/StaffStyleReviewPage.js | SelectFilter Review status | "Review Status" |
| src/features/staffStyleReview/StaffStyleReviewPage.js | SelectFilter Partial adoption | "Partial Adoption". All six in one FilterButton in the StaffFilterBar actions slot, before "Reset filters" (which still also clears search). `SelectFilter` now wraps itself in FilterField and takes an `id` |
| src/features/stockControl/StockControlPanel.js | DropdownField category | "Category", default `all` |
| src/features/stockControl/StockControlPanel.js | DropdownField location | "Location", default `all` |
| src/features/stockControl/StockControlPanel.js | DropdownField status | "Status", default `all` |
| src/features/stockControl/StockControlPanel.js | DropdownField supplier | "Supplier", default `all` (still only rendered when suppliers exist) |
| src/features/stockControl/StockControlPanel.js | DropdownField sort | "Sort", default `action`. The FilterButton is still portalled into `filterSlot` (tracking header) or the toolbar, as the dropdowns were. Dropped `stock-toolbar__filter` / `size="sm"` from the moved dropdowns |
| src/features/tracking/equipment/EquipmentTrackerPanel.js | Area (department) DropdownField | Filters the equipment register; default "all" |
| src/features/tracking/equipment/EquipmentTrackerPanel.js | Location DropdownField | Filters the equipment register; default "all" |
| src/features/tracking/equipment/EquipmentTrackerPanel.js | Status (quickFilter) DropdownField | Filters the equipment register; default "active" |
| src/features/tracking/equipment/EquipmentTrackerPanel.js | Sort DropdownField | Sorts the equipment register; default "urgency" |
| src/features/websiteManager/panels/ActivityPanel.js | Page DropdownField | Filters the activity log; default "all". Dropped the `website-manager__toolbar-filter` sizing class. Search input stays in the toolbar |
| src/features/websiteManager/panels/OverviewPanel.js | Status DropdownField | Filters the website pages list; default "all". Dropped the `website-manager__toolbar-filter` sizing class. Search input stays in the toolbar |
| src/pages/accounts/index.js | Status DropdownField | Filters the accounts ledger; default "" |
| src/pages/accounts/index.js | Account Type DropdownField | Filters the accounts ledger; default "". Not counted or cleared when locked by restrictedAccountTypes (permissions pin it) |
| src/pages/clocking/index.js | Status DropdownField | Filters the technician board; default "all" |
| src/pages/clocking/index.js | Sort DropdownField | Sorts the technician board; default "workshop" |

## Considered but not moved

| File | Control | Reason |
|---|---|---|
| src/components/accounts/InvoiceTable.js | From / To CalendarField | Calendar picker, not a dropdown; its menu is not portalled so it would be clipped inside the floating card. Left in the toolbar |
| src/components/accounts/InvoiceTableToolbar.js | From / To CalendarField | Calendar picker, not a dropdown; menu not portalled, would be clipped in the card |
| src/components/accounts/TransactionTable.js | From / To CalendarField | Calendar picker, not a dropdown; menu not portalled |
| src/components/activity/ActivityLogView.js | From / To, Page or route, Record type, Record ID, Search (InputField) | Not dropdowns (datetime/text inputs); left in the filter grid |
| src/components/Clocking/EfficiencyTab.js | Date CalendarField (`efficiencyFilterDate`) | Calendar picker, not a dropdown; left in the toolbar. |
| src/components/Clocking/EfficiencyTab.js | Day / Week / Month TabGroup | Tab/toggle control, not a dropdown. |
| src/components/Clocking/EfficiencyTab.js | MonthPickerField (topbar month nav) | Month picker / navigation, not a dropdown. |
| src/components/Clocking/EfficiencyTab.js | Day Type DropdownField, Job Clocking On DropdownField | Data-entry fields in the add/edit efficiency entry modal. |
| src/components/dev-platform/DeveloperPicker.js | Assign to DropdownField | Data-entry: chooses an assignee for bulk triage, not a list filter |
| src/components/dev-platform/sections/DevSidebarAccess.js | Copy another role default DropdownField | Data-entry: picks a role template to copy into the draft layout |
| src/components/dev-platform/sections/DevSidebarAccess.js | Copy layout to MultiSelectDropdown | Data-entry in a modal: picks target staff to copy a layout to |
| src/components/dev-platform/sections/InvestigationsSection.js | Set status DropdownField | Data-entry: bulk-triage action value, not a filter |
| src/components/HR/tabs/EmployeesTab.js | Employment Type / Employment Status DropdownFields (employee form) | Data-entry fields in the add/edit employee form. |
| src/components/HR/tabs/EmployeesTab.js | Directory search input | Search stays in the toolbar (raw `<input>`, outside the brief's scope). |
| src/components/layout/StaffTopbar.js | Clocking status DropdownField | Topbar/global control (sets technician clocking status) |
| src/components/layout/StaffTopbar.js | View bar as user DropdownField | Topbar/global control (demo user preview) |
| src/components/LoginDropdown.js | Area / Department / User Dropdowns | Login user selection, chooses the account to sign in as; not a filter of a list. |
| src/components/NotesTab.js | Staff member DropdownField (add viewer) | Data-entry: chooses a staff member to grant note access. |
| src/components/page-ui/accounts/payslips/payslips-ui.js | Paid month MonthPickerField | Month picker, not a dropdown; its menu is not portalled so it would be clipped in the card |
| src/components/page-ui/accounts/reports/accounts-reports-ui.js | Report period Dropdown | View-mode switcher: the period (weekly/monthly/quarterly/yearly) decides which companion control (month picker / quarter tabs / year tabs) renders beside it in the toolbar; no "all" default. Moving it alone would split it from those controls |
| src/components/page-ui/accounts/reports/accounts-reports-ui.js | MonthPicker, Quarter / Year segmented tabs | Not dropdowns (month picker / tab buttons) |
| src/components/page-ui/accounts/transactions/accounts-transactions-account-id-ui.js | From / To CalendarField | Calendar picker, not a dropdown; menu not portalled |
| src/components/page-ui/appointments/appointments-ui.js | Scheduler view DropdownField (Month/Day view) | View-mode switcher |
| src/components/page-ui/appointments/appointments-ui.js | Time DropdownField | Data-entry: booking time for the new appointment |
| src/components/page-ui/appointments/appointments-ui.js | Appointment date CalendarField | Calendar picker that selects the day for both booking and the scheduler; not a dropdown |
| src/components/page-ui/job-cards/archive/job-cards-archive-ui.js | "Registration Only" toggle button | Toggle button, not a dropdown; left in the toolbar |
| src/components/page-ui/job-cards/archive/job-cards-archive-ui.js | "Clear filtes" button | Existing button also clears search + reg-only + reruns search, so kept. Note: its label is misspelt ("filtes") — pre-existing, left unchanged |
| src/components/page-ui/job-cards/SchedulingTab.js | "Assigned technician" DropdownField | Record field (assigns the job's technician), not a filter |
| src/components/page-ui/job-cards/SchedulingTab.js | "Next update due" CalendarField + TimePickerField | Record fields (date/time entry), not filters; not dropdowns |
| src/components/page-ui/job-cards/ServiceHistoryTab.js | ComparePicker DropdownField (x2, compare modal) | Chooses which two jobs to compare side by side in a modal; selects records, not a list filter |
| src/components/page-ui/job-cards/view/job-cards-view-ui.js | Popup "Update Status" DropdownField | Record field (changes the job's status in the job popup) |
| src/components/page-ui/job-cards/view/job-cards-view-ui.js | LEAD: staffglobal.css dead rules | `.job-cards-view-filter-controls`, `.job-cards-view-filter-slot`, `.job-cards-view-filter-control` (+ `.job-cards-view-filter-control .dropdown-api`, `.dropdown-api__control`, `.dropdown-api__value`) and `.job-cards-filter.dropdown-api` are now dead (~lines 376-417). `.job-cards-view-search-shell:not(:has(.job-cards-view-filter-controls))` now always matches, so the base 4-column `grid-template-columns` in `.job-cards-view-search-shell` (and its `min-width: 36rem` / `flex: 1 0 36rem`) is dead; the 2-column variant (`minmax(10rem, 1fr) auto`) is what renders — search + filter button |
| src/components/page-ui/job-cards/view/job-cards-view-ui.js | LEAD: search bar cap defeated | `html.staff-scope .job-cards-view-searchbar.searchbar-api { max-width: none; }` (staffglobal.css ~line 383, specificity 0,3,1) beats the global cap `html.staff-scope .searchbar-api:not(.dropdown-api__control) { max-width: calc(33ch + var(--control-height)) }` (0,2,1+). Also `.job-cards-view-searchbar.searchbar-api { width: 100% }` at ~377. The same class is used by orders-view-ui.js, so /order is affected too |
| src/components/page-ui/job-cards/view/job-cards-view-ui.js | LEAD: presentation anchors | `src/features/presentation/slides/definitions/jobCardsList.js` anchors tooltips to `[data-presentation="job-cards-division-filter"]` and `job-cards-status-filter`. Those attributes are kept on the DropdownFields, but they now render only while the filter card is open, so the slides will not find them. Re-anchor to the filter button (FilterButton does not forward data-* props) |
| src/components/page-ui/job-cards/view/job-cards-view-ui.js | LEAD: generated source map | `src/lib/dev-layout/sectionSourceMap.generated.js` still lists removed keys `job-cards-view-filter-controls`, `job-cards-view-filter-controls-division-slot`, `job-cards-view-filter-controls-status-slot`, `job-cards-view-division-filter`, `job-cards-view-status-filter`; line numbers for archive/view/other edited files have shifted. Needs regeneration |
| src/components/page-ui/parts/deliveries/parts-deliveries-delivery-id-ui.js | Stop "Update status" DropdownField | Record field (updates a delivery stop's status) |
| src/components/page-ui/parts/parts-deliveries-ui.js | Existing "Clear" ghost button | Kept: clears search as well as the filters |
| src/components/page-ui/parts/parts-deliveries-ui.js | Day CalendarField (selectedDate) | Date picker drives the day view; not a dropdown and its menu is not portalled, so it would be clipped inside the floating card |
| src/components/page-ui/parts/parts-deliveries-ui.js | LEAD: deliveryStyles.filterRow | `src/components/Deliveries/deliveryStyles.js` `filterRow.gridTemplateColumns` still reserves three dropdown columns (`minmax(200px, 2fr) repeat(3, minmax(150px, 1fr)) auto auto`). I overrode it locally with a layout-only spread (`minmax(200px, 1fr) auto auto auto`); the lead should update the shared style and drop the override |
| src/components/page-ui/stock-catalogue-ui.js | Job part status / Pre-pick location DropdownFields (table cells) | Record fields (update a job part row) |
| src/components/page-ui/stock-catalogue-ui.js | Quick-filter buttons above the inventory table | Chip/button group, not a dropdown |
| src/components/page-ui/tracking/tracking-ui.js | Loan cars month picker (`loanCarMonthPicker`) | Supplied by the Loan-car page (outside batch); a calendar/month picker, not a dropdown |
| src/components/page-ui/tracking/tracking-ui.js | Grid/Map view switch | View-mode switcher, not a filter |
| src/components/page-ui/tracking/tracking-ui.js | Shared SearchBar inline `maxWidth` (520px / 360px) | Pre-existing inline maxWidth on the search bar overrides the new global cap. Left as-is (not a dropdown). Lead may want to drop it |
| src/components/profile/personal/WidgetSettingsModal.js | CalendarField (savings deadline, overtime date, date value, goal date) | not a filter; data-entry date pickers in the settings form |
| src/components/profile/ProfileThemeControls.js | Accent DropdownField | Settings control (theme accent), not a filter |
| src/components/sidebar-access/SidebarGroupAccessModal.js | DropdownField "Select a staff user" | data-entry: picks a user to add to the group |
| src/components/support/dev/SupportTriagePanel.js | DropdownField Status | record field: sets the report's status (triage mutation), not a list filter |
| src/components/support/dev/SupportTriagePanel.js | DropdownField Severity | record field: sets the report's severity |
| src/components/support/dev/SupportWorkspace.js | Saved-view preset buttons | not a dropdown (buttons) |
| src/components/support/SupportReportModal.js | DropdownField problem category | data-entry field in the report-a-problem form |
| src/components/VHC/VhcDetailsPanel.js | Native `<select>` (media relink) | Data-entry: links a photo/video to a concern or location; not a filter. (Raw select is pre-existing, left as-is.) |
| src/features/customers/hub/CustomerContactLog.js | DropdownField "Contact type" | data-entry field in the add-contact-log form (despite sitting in an `app-filter-bar` wrapper) |
| src/features/customers/hub/CustomerContactLog.js | DropdownField "Related job" | data-entry field in the add-contact-log form |
| src/features/customers/hub/CustomerFilesSection.js | "Group by job" toggle button | view-mode toggle, not a dropdown |
| src/features/invoices/components/ProformaOverrideModal.js | DropdownField "Billing To" | data-entry field in the proforma override form |
| src/features/staffStyleReview/StaffStyleReviewPage.js | DropdownField "Review status" (review modal) | data-entry: sets a finding's review status |
| src/features/stockControl/stockControl.css (outside batch) | `.stock-toolbar__filter` rules and `.stock-header-filters .stock-toolbar__filter` | now unused (dead CSS); `.stock-header-filters` keeps `flex: 1 1 auto`, so the header slot may leave space around the single button — needs a follow-up in stockControl.css |
| src/features/stockControl/StockControlPanel.js | Summary tiles (filter by summary) | not a dropdown (tile buttons); "Clear filters" button left as-is |
| src/features/stockControl/StockControlPanel.js | Cards/Compact view switch | view-mode switcher |
| src/features/stockControl/StocktakeModal.js | DropdownField Location/Category | stocktake setup form: chooses the scope of the count to run, not a list filter |
| src/features/tracking/equipment/EquipmentTrackerPanel.js | Category dropdown (categoryFilter prop) | Lives in the /tracking page header, outside this batch; arrives as a prop |
| src/features/tracking/equipment/EquipmentTrackerPanel.js | EquipmentSummaryBar quick-filter tiles | Not a dropdown (summary tiles, also drive quickFilter) |
| src/features/tracking/equipment/EquipmentTrackerPanel.js | Cards / Compact view switch | View-mode switcher, not a dropdown |
| src/features/tracking/equipment/EquipmentTrackerPanel.js | .equipment-toolbar__field CSS | Rule in equipmentTracker.css is now unused by this panel; CSS file is outside the batch, left as is |
| src/features/tracking/map/SectionPanel.js | "Move to…" DropdownField (per vehicle row) | Action control choosing a destination for a move, not a filter |
| src/features/websiteManager/panels/PageContentPanel.js | Website page DropdownField | Chooses the page being edited (the record the panel is about), not a filter |
| src/features/websiteManager/panels/SeoPanel.js | Website page DropdownField | Chooses the page whose SEO is being edited, not a filter |
| src/features/websiteManager/panels/ShopPanel.js | Order status DropdownField (per row) | Edits each order's status (record field), not a filter |
| src/lib/ui/nonGlobalUsage.generated.js | — | Generated file (skipped) |
| src/pages/accounts/index.js | From / To date CalendarFields | Calendar pickers; menu is not portalled, so it would be clipped inside the floating card |
| src/pages/accounts/index.js | Min / Max balance number inputs | Not dropdowns |
| src/pages/accounts/index.js | "Clear filters" button | Existing reset-all button (also clears search, dates and balances), left in place |
| src/pages/admin/compliance/breaches.js | Severity (create form) | Form field in the new-breach form |
| src/pages/admin/compliance/breaches.js | Severity / Status (per row) | Inline record edits in the table rows |
| src/pages/admin/compliance/dpias.js | Risk level (create form) | Form field in the new-DPIA form |
| src/pages/admin/compliance/dpias.js | Status / Risk level (per row) | Inline record edits in the table rows |
| src/pages/admin/compliance/sars.js | Status (per row) | Inline record edit in the SAR table rows |
| src/pages/clocking/index.js | Today's board section DropdownField | Form field in the technician details modal (assignment) |
| src/pages/dev/staff-ui-showcase.js | — | Design showcase (skipped) |
| src/pages/dev/user-diagnostic.js | — | Design showcase (skipped) |
| src/singlescroll/components/WebsiteNativeSelect.js | — | Customer website control (out of scope) |

## Files with no filters (form fields only)

| File | Control | Reason |
|---|---|---|
| src/components/accounts/AccountForm.js | — | form fields only (account create/edit form: account type, status and similar record fields) |
| src/components/accounts/AccountsSettingsPanel.js | — | form fields only (accounts settings panel, "Export Format" default setting) |
| src/components/Deliveries/DeliveryDetailPanel.js | — | form fields only (driver / delivery vehicle assignment on a delivery record) |
| src/components/Deliveries/DeliveryFailureModal.js | — | form fields only (failed-delivery reason) |
| src/components/dev-platform/sections/NotificationsSection.js | — | form fields only (new notification rule form: event, minimum severity) |
| src/components/dev-platform/sections/PreferencesSection.js | — | form fields only (developer preferences form: density, default queue sort) |
| src/components/HR/StaffVehiclesCard.js | — | form fields only (vehicle picker in the "Log new repair" form) |
| src/components/JobCards/CustomerRequestsTab.js | — | form fields only (payment type per request row / request details editor) |
| src/components/JobCards/JobCardModal.js | — | form fields only (work/request selector for clocking on) |
| src/components/JobCards/LocationUpdateModal.js | — | form fields only (key and vehicle location update) |
| src/components/JobCards/WriteUpForm.js | — | form fields only (request selector per cause entry) |
| src/components/JobCards/WriteUpWorkspace.js | — | form fields only (payment type per request row / request details editor) |
| src/components/LoanCars/LoanCarBookingForm.js | — | form fields only (loan car booking) |
| src/components/LoanCars/LoanCarFleetDrawer.js | — | form fields only (unavailable reason, transmission, fuel type on a fleet car) |
| src/components/NewsFeed/NewsComposerModal.js | — | form fields only (announcement composer: departments, category, priority, record link type) |
| src/components/page-ui/clocking/clocking-technician-slug-ui.js | — | form fields only (manual clocking entry form: job/request selector, dates, times) |
| src/components/page-ui/job-cards/ContactTab.js | — | form fields only (customer contact edit form: contact preference; notes & preferences multiselect) |
| src/components/page-ui/job-cards/create/job-cards-create-ui.js | — | form fields only (job request "Account Type" payment dropdown in the create-job modal) |
| src/components/page-ui/job-cards/ServiceHistoryTab.test.js | — | Test file (asserts ComparePicker uses DropdownField) |
| src/components/page-ui/job-cards/WarrantyTab.js | — | form fields only (link warranty job picker, warranty authorisation status, claim line type) |
| src/components/page-ui/parts/create-order/parts-create-order-ui.js | — | form fields only (create parts order: pricing level, payment status, order source, priority, customer type, delivery date/time, stock resolution arrival date) |
| src/components/page-ui/parts/parts-goods-in-ui.js | — | form fields only (goods-in invoice: price level, franchise, VAT rate, receiving discrepancy, invoice date). The history SearchBar has no dropdowns next to it |
| src/components/Parts/AddNewJobPartPopup.js | — | form fields only (new job part: VAT rate, discrepancy, price level, franchise) |
| src/components/Parts/DeliverySchedulerModal.js | — | form fields only (pick existing delivery route) |
| src/components/PartsTab.js | — | form fields only (pre-pick popup part/location; part details status/request/pre-pick location) |
| src/components/popups/InvoiceBuilderPopup.js | — | form fields only (invoice VAT rate) |
| src/components/popups/NextActionPrompt.js | — | form fields only (key location / vehicle location for the next-action prompt) |
| src/components/profile/personal/PersonalSettingsPopup.js | — | form fields only (recurring overtime rules, fixed outgoing category, credit card account, overtime entry date) |
| src/components/profile/personal/WidgetSettingsModal.js | — | form fields only (personal widget settings modal: linked savings/payment source, categories, rota rules, leave links, payment plan months, account types, date display mode, chart source) |
| src/components/profile/ProfileWorkTab.js | — | form fields only (leave request type/day type, start/finish dates, manual overtime date) |
| src/components/VHC/BrakesHubsDetailsModal.js | — | form fields only (pad / disc / visual RAG status) |
| src/components/VHC/IssueReportPopup.js | — | form fields only (issue severity per row) |
| src/components/VHC/PrePickLocationModal.js | — | form fields only (picked location) |
| src/components/VHC/WheelsTyresDetailsModal.js | — | form fields only (tyre make, repair kit month/year) |
| src/components/Workshop/JobClockingCard.js | — | form fields only (work type when clocking in) |
| src/components/Workshop/QueuePlanner/WorkshopQueuePlanner.js | — | form fields only (assign technician modal) |
| src/features/customers/hub/CustomerContactPreference.js | — | form fields only (customer's preferred contact method record field) |
| src/features/payslips/PayslipUpsertModal.js | — | form fields only (payslip create/edit: user, status; CalendarFields are payslip dates) |
| src/features/stockControl/StockActionModal.js | — | form fields only (stock in/out/adjust reason) |
| src/features/stockControl/StockItemEditor.js | — | form fields only (stock item create/edit: category, location, measurement, unit, levels, check interval) |
| src/features/stockControl/StockOrderModal.js | — | form fields only (stock order status; CalendarField is the expected date) |
| src/features/tracking/equipment/EquipmentChecklistDrawer.js | — | form fields only (checklist editor "Applies to") |
| src/features/tracking/equipment/EquipmentDetailDrawer.js | — | form fields only (set status, document type; CalendarField is document expiry) |
| src/features/tracking/equipment/EquipmentEditorDrawer.js | — | form fields only (equipment create/edit drawer: category, department, location, checklist, service interval, calibration, plus CalendarFields) |
| src/features/websiteManager/editors/fields.js | — | form fields only (website content editor: select / status / media-picker fields) |
| src/pages/admin/compliance/ropa.js | — | form fields only (new ROPA entry: lawful basis) |
| src/pages/dev/knowledge.js | — | form fields only (knowledge article editor: status) |
| src/pages/hr/disciplinary.js | — | form fields only (new incident form: warning level, incident date) |
| src/pages/hr/performance.js | — | form fields only (new review form: employee) |
| src/pages/hr/settings.js | — | form fields only (policy upload form: category) |
| src/pages/hr/training.js | — | form fields only (assign training form: employee, course, due date) |
| src/pages/job-cards/[jobNumber].js | — | form fields only (vehicle/key location popup, appointment time/status/collection type, stored vehicle picker, clocking job/technician selectors, CalendarFields) |
| src/pages/profile/privacy.js | — | form fields only (subject access request form: request type) |
| src/pages/tracking/Key-Parking.js | — | form fields only (add/update/edit location popups: vehicle and key location) |
