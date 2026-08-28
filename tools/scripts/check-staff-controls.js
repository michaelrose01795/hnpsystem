#!/usr/bin/env node
// Staff control guard.
//
// Staff-facing page/section UI must use the shared staffglobal.css component
// families:
//   - Button component / .app-btn for actions
//   - DropdownField / .dropdown-api for choice controls
//   - .app-input (+ modifiers) for native text/number/search/textarea fields
//   - hidden native file input + staff Button trigger for uploads
//
// Existing legacy raw controls are held to a fixed baseline so they can be
// migrated down over time, but new raw/browser-default controls cannot be added.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
// Coverage: every staff-facing component, feature module and page. Widened
// from popups/page-ui during the design-governance foundation pass so shared
// feature UI (VHC, HR, job cards, invoices, support) is governed too.
// tools/scripts/check-design-governance.js asserts these roots stay in place.
const SEARCH_ROOTS = [
  "src/components",
  "src/features",
  "src/pages",
];
const EXCLUDED_PREFIXES = [
  "src/pages/website/",
];
const FILE_EXT_RE = /\.(js|jsx|ts|tsx)$/;

// Transitional ceiling for legacy controls. Lower counts as files are migrated.
// Do not increase this map. New files default to 0. Regenerate with:
//   node tools/scripts/check-staff-controls.js --print-baseline
const MIGRATION_BASELINE = new Map([
  ["src/components/accounts/AccountTable.js", 2],
  ["src/components/Clocking/CapacitySettingsPopup.js", 1],
  ["src/components/Clocking/EfficiencyTab.js", 5],
  ["src/components/companyAccounts/CompanyAccountForm.js", 3],
  ["src/components/Consumables/StockCheckPopup.js", 7],
  ["src/components/CookieBanner.js", 5],
  ["src/components/dev-layout-overlay/DevLayoutOverlay.js", 4],
  ["src/components/dev-platform/DevNotificationBell.js", 2],
  ["src/components/dev-platform/sections/DevSidebarAccess.js", 5],
  ["src/components/dev-platform/sections/InvestigationsSection.js", 1],
  ["src/components/dev-platform/sections/PreferencesSection.js", 2],
  ["src/components/dev-platform/sections/SupportOverviewSection.js", 2],
  ["src/components/GlobalSearch.js", 3],
  ["src/components/HR/EmployeeProfilePanel.js", 2],
  ["src/components/HR/OvertimeEntriesEditor.js", 1],
  ["src/components/HR/SidebarAccessEditor.js", 4],
  ["src/components/HR/StaffVehiclesCard.js", 21],
  ["src/components/HR/tabs/AttendanceTab.js", 1],
  ["src/components/HR/tabs/EmployeesTab.js", 27],
  ["src/components/JobCards/ClockingHistorySection.js", 2],
  ["src/components/JobCards/CustomerRequestsTab.js", 4],
  ["src/components/JobCards/JobCardModal.js", 1],
  ["src/components/JobCards/LocationUpdateModal.js", 0],
  ["src/components/JobCards/RequestPresetAutosuggestInput.js", 2],
  ["src/components/JobCards/WriteUpForm.js", 14],
  ["src/components/JobCards/WriteUpWorkspace.js", 3],
  ["src/components/layout/StaffLayout.js", 2],
  ["src/components/LoanCars/FuelGauge.js", 1],
  ["src/components/LoanCars/LoanCarSchedulePanel.js", 3],
  ["src/components/mobile/RedirectToWorkshopButton.js", 4],
  ["src/components/NotesTab.js", 9],
  ["src/components/page-ui/accounts/payslips/payslips-ui.js", 3],
  ["src/components/page-ui/accounts/reports/accounts-reports-ui.js", 2],
  ["src/components/page-ui/admin/users/admin-users-ui.js", 1],
  ["src/components/page-ui/appointments/appointments-ui.js", 2],
  ["src/components/page-ui/clocking/clocking-technician-slug-ui.js", 3],
  ["src/components/page-ui/dev/dev-status-snapshot-ui.js", 2],
  ["src/components/page-ui/dev/dev-user-diagnostic-ui.js", 4],
  ["src/components/page-ui/job-cards/job-cards-job-number-ui.js", 1],
  ["src/components/page-ui/job-cards/myjobs/job-cards-myjobs-job-number-ui.js", 6],
  ["src/components/page-ui/job-cards/SchedulingTab.js", 1],
  ["src/components/page-ui/job-cards/ServiceHistoryTab.js", 2],
  ["src/components/page-ui/job-cards/ServiceHistoryTab.test.js", 1],
  ["src/components/page-ui/job-cards/view/job-cards-view-ui.js", 4],
  ["src/components/page-ui/job-cards/waiting/job-cards-waiting-nextjobs-ui.js", 0],
  ["src/components/page-ui/job-cards/WarrantyTab.js", 2],
  ["src/components/page-ui/messages/messages-ui.js", 4],
  ["src/components/page-ui/parts/create-order/parts-create-order-order-number-ui.js", 4],
  ["src/components/page-ui/parts/create-order/parts-create-order-ui.js", 30],
  ["src/components/page-ui/parts/deliveries/parts-deliveries-delivery-id-ui.js", 14],
  ["src/components/page-ui/parts/parts-delivery-planner-ui.js", 8],
  ["src/components/page-ui/parts/parts-goods-in-ui.js", 49],
  ["src/components/page-ui/parts/parts-manager-ui.js", 0],
  ["src/components/page-ui/stock-catalogue-ui.js", 10],
  ["src/components/page-ui/tech/tech-consumables-request-ui.js", 3],
  ["src/components/page-ui/valet/valet-ui.js", 2],
  ["src/components/page-ui/vhc/customer-preview/vhc-customer-preview-job-number-ui.js", 3],
  ["src/components/page-ui/vhc/customer-view/vhc-customer-view-job-number-ui.js", 1],
  ["src/components/page-ui/vhc/share/[jobNumber]/vhc-share-job-number-link-code-ui.js", 1],
  ["src/components/Parts/DeliverySchedulerModal.js", 10],
  ["src/components/Parts/PartDeliveryLogModal.js", 9],
  ["src/components/PartsTab.js", 3],
  ["src/components/popups/CheckSheetPopup.js", 3],
  ["src/components/popups/ConfirmationDialog.js", 0],
  ["src/components/popups/ExistingCustomerPopup.js", 1],
  ["src/components/popups/InvoiceBuilderPopup.js", 9],
  ["src/components/popups/NewCustomerPopup.js", 1],
  ["src/components/popups/NextActionPrompt.js", 5],
  ["src/components/popups/Popup.js", 1],
  ["src/components/profile/personal/PersonalSettingsPopup.js", 3],
  ["src/components/profile/personal/widgets/PersonalWidgets.js", 4],
  ["src/components/profile/personal/WidgetSettingsModal.js", 6],
  ["src/components/profile/ProfilePersonalTab.js", 1],
  ["src/components/profile/ProfileWorkTab.js", 18],
  ["src/components/reporting/SavedViewsBar.js", 3],
  ["src/components/sidebar-access/SidebarGroupAccessModal.js", 1],
  ["src/components/StatusTracking/JobProgressTracker.js", 1],
  ["src/components/StatusTracking/StatusSidebar.js", 2],
  ["src/components/support/dev/SupportAssistedPanel.js", 1],
  ["src/components/support/dev/supportDevUi.js", 1],
  ["src/components/support/dev/SupportGithubPanel.js", 1],
  ["src/components/support/dev/SupportTriagePanel.js", 1],
  ["src/components/support/dev/SupportWorkspace.js", 3],
  ["src/components/support/SupportErrorBoundary.js", 1],
  ["src/components/support/SupportReportLauncher.js", 1],
  ["src/components/support/SupportScreenshotField.js", 5],
  ["src/components/topbar/AssistantPanel.js", 3],
  ["src/components/topbar/CommandPalette.js", 2],
  ["src/components/topbar/TeamPanel.js", 5],
  ["src/components/topbar/WorkspaceCustomiseOverlay.js", 4],
  ["src/components/topbar/WorkspacePanel.js", 4],
  ["src/components/TopbarAlerts.js", 3],
  ["src/components/ui/Button.js", 1],
  ["src/components/ui/calendarAPI/Calendar.js", 8],
  ["src/components/ui/calendarAPI/CalendarField.js", 2],
  ["src/components/ui/dropdownAPI/Dropdown.js", 3],
  ["src/components/ui/dropdownAPI/DropdownField.js", 1],
  ["src/components/ui/dropdownAPI/MultiSelectDropdown.js", 4],
  ["src/components/ui/monthPickerAPI/MonthPicker.js", 5],
  ["src/components/ui/searchBarAPI/SearchBar.js", 2],
  ["src/components/ui/StaffButton.js", 1],
  ["src/components/ui/timePickerAPI/TimePicker.js", 6],
  ["src/components/ui/timePickerAPI/TimePickerField.js", 2],
  ["src/components/ui/variants.js", 2],
  ["src/components/VHC/BrakeDiagram.js", 1],
  ["src/components/VHC/BrakesHubsDetailsModal.js", 2],
  ["src/components/VHC/CustomerVideoButton.js", 1],
  ["src/components/VHC/ExternalDetailsModal.js", 3],
  ["src/components/VHC/InternalElectricsDetailsModal.js", 3],
  ["src/components/VHC/IssueAutocomplete.js", 2],
  ["src/components/VHC/mediaCapture/ConcernPanel.js", 2],
  ["src/components/VHC/mediaCapture/ConcernPickerModal.js", 1],
  ["src/components/VHC/mediaCapture/FullScreenCapture.js", 8],
  ["src/components/VHC/mediaCapture/SectionCameraButton.js", 0],
  ["src/components/VHC/MediaUploadConfirmModal.js", 1],
  ["src/components/VHC/photoEditor/ShapeToolbar.js", 2],
  ["src/components/VHC/PhotoEditorModal.js", 1],
  ["src/components/VHC/ServiceIndicatorDetailsModal.js", 5],
  ["src/components/VHC/TyreDiagram.js", 2],
  ["src/components/VHC/TyresSection.js", 1],
  ["src/components/VHC/UndersideDetailsModal.js", 3],
  ["src/components/VHC/VhcCustomerDescriptionModal.js", 1],
  ["src/components/VHC/VhcCustomerView.js", 1],
  ["src/components/VHC/VhcDetailsPanel.js", 39],
  ["src/components/VHC/videoEditor/TimelineTrimControl.js", 2],
  ["src/components/VHC/videoEditor/VideoMetaPanel.js", 2],
  ["src/components/VHC/WheelsHubsModal.js", 4],
  ["src/components/VHC/WheelsTyresDetailsModal.js", 9],
  ["src/components/Workshop/JobClockingCard.js", 6],
  ["src/features/3Dwebsite/components/DealershipEntrySection.js", 1],
  ["src/features/3Dwebsite/components/ScrollProgress.js", 1],
  ["src/features/invoices/components/InvoiceDetail.js", 3],
  ["src/features/invoices/components/InvoicePaymentModal.js", 3],
  ["src/features/invoices/components/InvoiceWorkspace.js", 1],
  ["src/features/invoices/components/ProformaOverrideModal.js", 0],
  ["src/features/payslips/PayslipsCard.js", 1],
  ["src/features/payslips/PayslipsListPopup.js", 1],
  ["src/features/roleTreeDemo/components/RoleTreeDemo.js", 1],
  ["src/features/roleTreeDemo/components/sections/InteractiveDemoSection.js", 1],
  ["src/features/staffStyleReview/StaffStyleReviewPage.js", 2],
  ["src/features/tracking/map/TrackingMap.js", 16],
  ["src/features/vision/components/VisionViews.js", 1],
  ["src/features/website/components/ShopSection.js", 8],
  ["src/features/website/components/WebsiteNativeDateTimeInput.js", 9],
  ["src/features/website/components/WebsiteNativeSelect.js", 2],
  ["src/features/website/shop/CartPage.js", 3],
  ["src/features/website/shop/CheckoutPage.js", 9],
  ["src/features/website/WebsitePage.js", 2],
  ["src/features/websiteManager/panels/SeoPanel.js", 1],
  ["src/pages/admin/compliance/breaches.js", 2],
  ["src/pages/admin/compliance/dpias.js", 1],
  ["src/pages/admin/compliance/ropa.js", 1],
  ["src/pages/customers/[customerSlug].js", 3],
  ["src/pages/deliveries/index.js", 0],
  ["src/pages/delivery-planner.js", 16],
  ["src/pages/dev/knowledge.js", 1],
  ["src/pages/dev/user-diagnostic.js", 27],
  ["src/pages/goods-in/index.js", 11],
  ["src/pages/hr/disciplinary.js", 1],
  ["src/pages/hr/performance.js", 1],
  ["src/pages/hr/settings.js", 1],
  ["src/pages/hr/training.js", 1],
  ["src/pages/job-cards/[jobNumber].js", 25],
  ["src/pages/messages/index.js", 1],
  ["src/pages/new-order/[orderNumber].js", 1],
  ["src/pages/password-reset/new.js", 2],
  ["src/pages/stock-catalogue.js", 31],
  ["src/pages/tech/[jobNumber].js", 5],
  ["src/pages/valet/index.js", 3],
  ["src/pages/vhc/customer-preview/[jobNumber].js", 2],
]);

const CONTROL_TAG_RE = /<(input|textarea|button)\b/;
// Body of a style={{ ... }} prop, so VISUAL_STYLE_RE is tested against the
// declarations themselves rather than against neighbouring attribute text.
const STYLE_BODY_RE = /style=\{\{([\s\S]*?)\}\}/;
const styleBody = (tag) => (tag.match(STYLE_BODY_RE) || ["", ""])[1];
const SELECT_TAG_RE = /<select\b/;
const VISUAL_STYLE_RE = /\b(background|backgroundColor|color|padding|border|borderRadius|font|fontSize|fontWeight|boxShadow|minHeight|height)\b/;
const APP_INPUT_RE = /className=(?:"[^"]*\bapp-input\b[^"]*"|'[^']*\bapp-input\b[^']*'|{`[^`]*\bapp-input\b[^`]*`}|{[^}]*app-input[^}]*})/;
const APP_TOGGLE_RE = /className=(?:"[^"]*\bapp-toggle--(?:checkbox|radio)\b[^"]*"|'[^']*\bapp-toggle--(?:checkbox|radio)\b[^']*'|{`[^`]*\bapp-toggle--(?:checkbox|radio)\b[^`]*`}|{[^}]*app-toggle--(?:checkbox|radio)[^}]*})/;
const APP_BUTTON_RE = /className=(?:"[^"]*\b(app-btn|tab-api__item|vhc-btn)\b[^"]*"|'[^']*\b(app-btn|tab-api__item|vhc-btn)\b[^']*'|{`[^`]*\b(app-btn|tab-api__item|vhc-btn)\b[^`]*`}|{[^}]*(app-btn|tab-api__item|vhc-btn)[^}]*})/;
const HIDDEN_FILE_RE = /type=(?:"file"|'file'|{"file"}).*style=\{\{\s*display:\s*["']none["']\s*\}\}/;
const HIDDEN_INPUT_RE = /type=(?:"hidden"|'hidden'|{"hidden"})/;

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, files);
    } else if (FILE_EXT_RE.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

function relativePath(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

function stripLineComments(line) {
  const index = line.indexOf("//");
  return index >= 0 ? line.slice(0, index) : line;
}

function readOpeningTag(lines, startIndex) {
  const chunks = [];
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 12); index += 1) {
    const line = stripLineComments(lines[index]);
    chunks.push(line);
    if (/\/>\s*$/.test(line) || />\s*$/.test(line.replace(/=>/g, ""))) break;
  }
  return chunks.join(" ");
}

function findViolations(source) {
  const lines = source.split(/\r?\n/);
  const violations = [];

  lines.forEach((line, index) => {
    if (!CONTROL_TAG_RE.test(line) && !SELECT_TAG_RE.test(line)) return;
    const openingTag = readOpeningTag(lines, index);
    const lineNumber = index + 1;

    if (SELECT_TAG_RE.test(openingTag)) {
      violations.push({ line: lineNumber, reason: "native <select>; use DropdownField" });
      return;
    }

    const tagMatch = openingTag.match(CONTROL_TAG_RE);
    if (!tagMatch) return;
    const tagName = tagMatch[1].toLowerCase();

    if (tagName === "button") {
      if (!APP_BUTTON_RE.test(openingTag)) {
        violations.push({ line: lineNumber, reason: "raw <button>; use Button or .app-btn" });
        return;
      }
      if (VISUAL_STYLE_RE.test(styleBody(openingTag))) {
        violations.push({ line: lineNumber, reason: "button visual inline style; use staffglobal button classes" });
      }
      return;
    }

    if (tagName === "input" && (HIDDEN_INPUT_RE.test(openingTag) || HIDDEN_FILE_RE.test(openingTag))) {
      return;
    }

    if (tagName === "input" && APP_TOGGLE_RE.test(openingTag)) {
      return;
    }

    if (!APP_INPUT_RE.test(openingTag)) {
      violations.push({ line: lineNumber, reason: `${tagName} missing .app-input` });
      return;
    }

    if (VISUAL_STYLE_RE.test(styleBody(openingTag))) {
      violations.push({ line: lineNumber, reason: `${tagName} visual inline style; use .app-input/staffglobal` });
    }
  });

  return violations;
}

const violations = [];
const observedCounts = new Map();
const files = SEARCH_ROOTS.flatMap((root) => walk(path.join(ROOT, root)));

for (const file of files) {
  const relative = relativePath(file);
  if (EXCLUDED_PREFIXES.some((prefix) => relative.startsWith(prefix))) continue;
  const fileViolations = findViolations(fs.readFileSync(file, "utf8"));
  observedCounts.set(relative, fileViolations.length);
  const permitted = MIGRATION_BASELINE.get(relative) ?? 0;
  if (fileViolations.length > permitted) {
    fileViolations.slice(permitted).forEach((violation) => {
      violations.push(`${relative}:${violation.line}: ${violation.reason}`);
    });
  }
}

// The job-card clocking form previously left its conditional "Just clock"
// action behind when the neighbouring Save and Reset actions moved to Button.
// The per-file migration baseline prevents aggregate debt from growing, but it
// cannot identify one specific legacy control being swapped for another. Keep
// this action on the canonical Button contract explicitly.
const jobCardPath = "src/pages/job-cards/[jobNumber].js";
const jobCardSource = fs.readFileSync(path.join(ROOT, jobCardPath), "utf8");
const justClockStart = jobCardSource.indexOf("{isJustClockState && selectedTechnicianId ?");
const justClockEnd = jobCardSource.indexOf("null}", justClockStart);

if (justClockStart < 0 || justClockEnd < 0) {
  violations.push(`${jobCardPath}: Just clock action contract could not be located`);
} else {
  const justClockAction = jobCardSource.slice(justClockStart, justClockEnd);
  const requiredFragments = [
    "<Button",
    'variant="secondary"',
    "busy={submitting}",
    '"Just clock"',
  ];
  const forbiddenFragments = ["<button", "style={{"];

  requiredFragments.forEach((fragment) => {
    if (!justClockAction.includes(fragment)) {
      violations.push(`${jobCardPath}: Just clock action missing staff contract fragment ${JSON.stringify(fragment)}`);
    }
  });
  forbiddenFragments.forEach((fragment) => {
    if (justClockAction.includes(fragment)) {
      violations.push(`${jobCardPath}: Just clock action contains forbidden legacy fragment ${JSON.stringify(fragment)}`);
    }
  });
}

// Regression guard for the /jobs quick-note popup. This popup previously
// duplicated control styling and placed completion actions in a footer, which
// bypassed the compact staff-popup convention documented in staffglobal.css.
// Keep this check in the predev/prebuild control gate so later edits cannot
// silently reintroduce that drift.
const quickNoteUiPath = "src/components/page-ui/job-cards/view/job-cards-view-ui.js";
const quickNoteUiSource = fs.readFileSync(path.join(ROOT, quickNoteUiPath), "utf8");
const quickNoteStart = quickNoteUiSource.indexOf('cardClassName="app-job-quick-note"');
const quickNoteEnd = quickNoteUiSource.indexOf("</PopupModal>", quickNoteStart);

if (quickNoteStart < 0 || quickNoteEnd < 0) {
  violations.push(`${quickNoteUiPath}: quick-note PopupModal contract could not be located`);
} else {
  const quickNotePopup = quickNoteUiSource.slice(quickNoteStart, quickNoteEnd);
  const requiredFragments = [
    '<header className="app-popup-compact-header">',
    '<div className="app-popup-compact-header__actions">',
    'variant="primary"',
    "Save note",
    'variant="secondary"',
    "Close",
    'className="app-summary-grid"',
    'className="app-summary-item"',
    'className="app-summary-label"',
    'className="app-summary-value"',
    '<LayerTheme as="section" className="app-job-quick-note__recent"',
  ];
  const forbiddenFragments = [
    "app-job-quick-note__eyebrow",
    "app-job-quick-note__header",
    "app-job-quick-note__actions",
    ">Cancel<",
    "<button",
  ];

  requiredFragments.forEach((fragment) => {
    if (!quickNotePopup.includes(fragment)) {
      violations.push(`${quickNoteUiPath}: quick-note popup missing staff contract fragment ${JSON.stringify(fragment)}`);
    }
  });
  forbiddenFragments.forEach((fragment) => {
    if (quickNotePopup.includes(fragment)) {
      violations.push(`${quickNoteUiPath}: quick-note popup contains forbidden legacy fragment ${JSON.stringify(fragment)}`);
    }
  });

  if (
    quickNotePopup.indexOf("Open full notes") > quickNotePopup.indexOf("Save note") ||
    quickNotePopup.indexOf("Save note") > quickNotePopup.indexOf("Close")
  ) {
    violations.push(`${quickNoteUiPath}: quick-note actions must render Open full notes, Save note, then Close`);
  }
}

// The appointments day-jobs table is rendered through a body-level portal.
// Keep its controls on the same canonical table/badge/layer families as page
// content so global density and theme changes reach both locations.
const appointmentsUiPath = "src/components/page-ui/appointments/appointments-ui.js";
const appointmentsUiSource = fs.readFileSync(path.join(ROOT, appointmentsUiPath), "utf8");
const dayJobsStart = appointmentsUiSource.indexOf('ariaLabel="Jobs for the selected day"');
const dayJobsEnd = appointmentsUiSource.indexOf("</PopupModal>", dayJobsStart);

if (dayJobsStart < 0 || dayJobsEnd < 0) {
  violations.push(`${appointmentsUiPath}: day-jobs PopupModal contract could not be located`);
} else {
  const dayJobsPopup = appointmentsUiSource.slice(dayJobsStart, dayJobsEnd);
  const requiredFragments = [
    '<LayerTheme padding="0" gap="0"',
    'className="app-data-table app-data-table--rounded app-table-shell app-table-shell--with-headings"',
    'className={`app-badge ${getJobTypeBadgeClass(label)}`}',
    'className={`app-badge ${getCustomerStatusBadgeClass(job.waitingStatus || "Neither")}`}',
  ];
  const forbiddenFragments = [
    "...getJobTypeBadgeStyle(",
    "...getCustomerStatusBadgeColors(",
  ];

  requiredFragments.forEach((fragment) => {
    if (!dayJobsPopup.includes(fragment)) {
      violations.push(`${appointmentsUiPath}: day-jobs popup missing staff contract fragment ${JSON.stringify(fragment)}`);
    }
  });
  forbiddenFragments.forEach((fragment) => {
    if (dayJobsPopup.includes(fragment)) {
      violations.push(`${appointmentsUiPath}: day-jobs popup contains forbidden inline badge fragment ${JSON.stringify(fragment)}`);
    }
  });
}

const staffGlobalPath = "src/styles/staffglobal.css";
const staffGlobalSource = fs.readFileSync(path.join(ROOT, staffGlobalPath), "utf8");
const buttonFamilyPath = "src/styles/families/buttons.css";
const buttonFamilySource = fs.readFileSync(path.join(ROOT, buttonFamilyPath), "utf8");

function cssRuleBody(source, selector) {
  const start = source.indexOf(selector);
  if (start < 0) return null;
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  if (open < 0 || close < 0) return null;
  return source.slice(open + 1, close);
}

// Action buttons must retain their semantic brand/tint variants in every
// layer. Form-control tokens are intentionally rebound to --surface inside
// LayerTheme and must never be reused for buttons: doing so recreates the
// black/white mode inversion that previously affected Goods In Supplier Search.
const buttonContracts = [
  {
    path: buttonFamilyPath,
    source: buttonFamilySource,
    selector: "html.staff-scope .app-btn--primary",
    // The fill may be the flat brand step or the deeper --primary-hover step:
    // Primary sits one step deeper so it is not pixel-identical to the
    // is-active / aria-selected paint, which uses flat --primary. Either is a
    // brand accent; what matters is that it is never a form-control token.
    required: [["--btn-bg: var(--primary)", "--btn-bg: var(--primary-hover)"], "--btn-color: var(--onAccentText)"],
  },
  {
    path: buttonFamilyPath,
    source: buttonFamilySource,
    selector: "html.staff-scope .app-btn--secondary",
    required: ["--btn-bg: var(--secondary)", "--btn-color: var(--accent-text-on-tint)"],
  },
  {
    path: staffGlobalPath,
    source: staffGlobalSource,
    selector: "html.staff-scope button:not(.app-btn)",
    required: ["background: var(--primary)", "color: var(--onAccentText)"],
  },
  {
    path: staffGlobalPath,
    source: staffGlobalSource,
    selector: "html.staff-scope .app-table-action-btn",
    required: ["background: var(--secondary)", "color: var(--accent-text-on-tint)"],
  },
  {
    path: staffGlobalPath,
    source: staffGlobalSource,
    selector: "html.staff-scope .app-table-action-btn--primary",
    required: ["background: var(--primary)", "color: var(--onAccentText)"],
  },
];
const forbiddenButtonFillTokens = [
  "var(--primary-control-bg)",
  "var(--primary-control-color)",
  "var(--control-bg)",
  "var(--input-bg)",
  "var(--surface)",
  "var(--text-1)",
  "var(--surfaceText)",
];

for (const contract of buttonContracts) {
  const body = cssRuleBody(contract.source, contract.selector);
  if (body == null) {
    violations.push(`${contract.path}: canonical button rule ${contract.selector} could not be located`);
    continue;
  }
  for (const fragment of contract.required) {
    const alternatives = Array.isArray(fragment) ? fragment : [fragment];
    if (!alternatives.some((alternative) => body.includes(alternative))) {
      const expected = alternatives.map((alternative) => JSON.stringify(alternative)).join(" or ");
      violations.push(`${contract.path}: ${contract.selector} missing ${expected}`);
    }
  }
  for (const token of forbiddenButtonFillTokens) {
    if (body.includes(token)) {
      violations.push(`${contract.path}: ${contract.selector} must not use inverse/form-control token ${token}`);
    }
  }
}

// The canonical data-table row-control density contract. It lives in
// staffglobal.css today (see the family-ownership ratchet in
// check-design-governance.js, which tracks that as recorded debt) - this
// assertion follows the rule to wherever it actually is rather than forcing it
// to move.
const tableButtonRuleStart = staffGlobalSource.indexOf("html.staff-scope .app-data-table button {");
const tableButtonRuleEnd = staffGlobalSource.indexOf("}", tableButtonRuleStart);

if (tableButtonRuleStart < 0 || tableButtonRuleEnd < 0) {
  violations.push(`${staffGlobalPath}: canonical data-table button height rule could not be located`);
} else {
  const tableButtonRule = staffGlobalSource.slice(tableButtonRuleStart, tableButtonRuleEnd);
  [
    "height: var(--table-action-btn-height) !important",
    "min-height: var(--table-action-btn-height) !important",
  ].forEach((fragment) => {
    if (!tableButtonRule.includes(fragment)) {
      violations.push(`${staffGlobalPath}: canonical data-table buttons missing ${JSON.stringify(fragment)}`);
    }
  });
}

const quickNoteCssStart = staffGlobalSource.indexOf("/* Quick-note composer on /jobs;");
const quickNoteCssEnd = staffGlobalSource.indexOf(
  "html.staff-scope .app-job-operations-row__request-meta",
  quickNoteCssStart
);

if (quickNoteCssStart < 0 || quickNoteCssEnd < 0) {
  violations.push(`${staffGlobalPath}: quick-note colour contract could not be located`);
} else {
  const quickNoteCss = staffGlobalSource.slice(quickNoteCssStart, quickNoteCssEnd);
  if (quickNoteCss.includes("var(--text-2)")) {
    violations.push(
      `${staffGlobalPath}: quick-note surface text must not use inverse --text-2; use --text-1 or --surfaceTextMuted`
    );
  }
  if (!quickNoteCss.includes("color: var(--surfaceTextMuted)")) {
    violations.push(`${staffGlobalPath}: quick-note muted copy must use --surfaceTextMuted`);
  }
}

if (process.argv.includes("--print-baseline")) {
  [...observedCounts.entries()]
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([file, count]) => {
      console.log(`  ["${file}", ${count}],`);
    });
  process.exit(0);
}

for (const [file, expectedCount] of MIGRATION_BASELINE) {
  const observedCount = observedCounts.get(file) ?? 0;
  if (observedCount < expectedCount) {
    violations.push(
      `${file}: migration baseline is stale (${expectedCount} recorded, ${observedCount} found); lower it in check-staff-controls.js`
    );
  }
}

if (violations.length > 0) {
  console.error(`\nStaff control violations (${violations.length}):\n`);
  violations.slice(0, 120).forEach((violation) => console.error(`  ${violation}`));
  if (violations.length > 120) {
    console.error(`  ...and ${violations.length - 120} more`);
  }
  console.error(
    "\nUse Button/.app-btn, DropdownField, SearchBar, and .app-input. Do not use browser-default controls in staff UI.\n"
  );
  process.exit(1);
}

const baselineTotal = [...MIGRATION_BASELINE.values()].reduce((total, count) => total + count, 0);
console.log(`Staff control check passed - no new raw staff controls (${baselineTotal} legacy controls remain queued for migration).`);
