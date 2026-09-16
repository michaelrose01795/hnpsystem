// GENERATED FILE — do not edit by hand.
// Written by tools/scripts/audit-non-global.js (npm run audit:non-global),
// which runs in predev/prebuild.
//
// Each entry is one "Non-Global" showcase on /dev/user-diagnostic: staff UI
// that hand-rolls something staffglobal.css already owns. The counts are read
// out of the code on every dev/build, so the page cannot drift from reality the
// way a hand-kept register does.
//
// This is a REPORT, not a gate. The ratchets that fail a build are
// check:design, check:layers and check:borders.
export const NON_GLOBAL_AUDIT = {
  "non-global-buttons": {
    title: "buttons carrying their own fill / radius / type instead of .app-btn",
    total: 198,
    files: 60,
    usage: [
      { label: "VhcDetailsPanel (VHC) — 21", file: "src/components/VHC/VhcDetailsPanel.js" },
      { label: "[jobNumber] (job-cards) — 15", file: "src/pages/job-cards/[jobNumber].js" },
      { label: "ProfileWorkTab (profile) — 14", file: "src/components/profile/ProfileWorkTab.js" },
      { label: "parts-deliveries-delivery-id-ui (deliveries) — 12", file: "src/components/page-ui/parts/deliveries/parts-deliveries-delivery-id-ui.js" },
      { label: "stock-catalogue (pages) — 8", file: "src/pages/stock-catalogue.js", route: "/stock-catalogue" },
      { label: "InvoiceBuilderPopup (popups) — 7", file: "src/components/popups/InvoiceBuilderPopup.js" },
      { label: "FullScreenCapture (mediaCapture) — 7", file: "src/components/VHC/mediaCapture/FullScreenCapture.js" },
      { label: "delivery-planner (pages) — 6", file: "src/pages/delivery-planner.js", route: "/delivery-planner" },
      { label: "NotesTab (components) — 5", file: "src/components/NotesTab.js" },
      { label: "parts-delivery-planner-ui (parts) — 5", file: "src/components/page-ui/parts/parts-delivery-planner-ui.js" },
    ],
  },
  "non-global-inputs": {
    title: "text inputs and textareas that are not .app-input",
    total: 62,
    files: 35,
    usage: [
      { label: "[jobNumber] (job-cards) — 5", file: "src/pages/job-cards/[jobNumber].js" },
      { label: "parts-goods-in-ui (parts) — 5", file: "src/components/page-ui/parts/parts-goods-in-ui.js" },
      { label: "VhcDetailsPanel (VHC) — 4", file: "src/components/VHC/VhcDetailsPanel.js" },
      { label: "index (goods-in) — 3", file: "src/pages/goods-in/index.js", route: "/goods-in" },
      { label: "InvoicePaymentModal (components) — 3", file: "src/features/invoices/components/InvoicePaymentModal.js" },
      { label: "TrackingMap (map) — 3", file: "src/features/tracking/map/TrackingMap.js" },
      { label: "[jobNumber] (tech) — 2", file: "src/pages/tech/[jobNumber].js" },
      { label: "EfficiencyTab (Clocking) — 2", file: "src/components/Clocking/EfficiencyTab.js" },
      { label: "parts-deliveries-delivery-id-ui (deliveries) — 2", file: "src/components/page-ui/parts/deliveries/parts-deliveries-delivery-id-ui.js" },
      { label: "InvoiceBuilderPopup (popups) — 2", file: "src/components/popups/InvoiceBuilderPopup.js" },
    ],
  },
  "non-global-form-labels": {
    title: "form labels styled locally — there is no label primitive to use",
    total: 132,
    files: 42,
    usage: [
      { label: "stock-catalogue (pages) — 15", file: "src/pages/stock-catalogue.js", route: "/stock-catalogue" },
      { label: "delivery-planner (pages) — 10", file: "src/pages/delivery-planner.js", route: "/delivery-planner" },
      { label: "PartsTab (components) — 9", file: "src/components/PartsTab.js" },
      { label: "workshop-consumables-tracker-ui (workshop) — 6", file: "src/components/page-ui/workshop/workshop-consumables-tracker-ui.js" },
      { label: "DeliverySchedulerModal (Parts) — 6", file: "src/components/Parts/DeliverySchedulerModal.js" },
      { label: "PartDeliveryLogModal (Parts) — 6", file: "src/components/Parts/PartDeliveryLogModal.js" },
      { label: "VhcDetailsPanel (VHC) — 6", file: "src/components/VHC/VhcDetailsPanel.js" },
      { label: "[jobNumber] (job-cards) — 5", file: "src/pages/job-cards/[jobNumber].js" },
      { label: "parts-deliveries-delivery-id-ui (deliveries) — 5", file: "src/components/page-ui/parts/deliveries/parts-deliveries-delivery-id-ui.js" },
      { label: "StockCheckPopup (Consumables) — 4", file: "src/components/Consumables/StockCheckPopup.js" },
    ],
  },
  "non-global-selects": {
    title: "raw <select> in staff UI (CLAUDE.md 3.4a: must be DropdownField)",
    total: 1,
    files: 1,
    usage: [
      { label: "VhcDetailsPanel (VHC) — 1", file: "src/components/VHC/VhcDetailsPanel.js" },
    ],
  },
  "non-global-tables": {
    title: "tables that do not carry .app-data-table",
    total: 7,
    files: 6,
    usage: [
      { label: "VhcDetailsPanel (VHC) — 2", file: "src/components/VHC/VhcDetailsPanel.js" },
      { label: "parts-goods-in-goods-in-number-ui (goods-in) — 1", file: "src/components/page-ui/parts/goods-in/parts-goods-in-goods-in-number-ui.js" },
      { label: "parts-goods-in-ui (parts) — 1", file: "src/components/page-ui/parts/parts-goods-in-ui.js" },
      { label: "stock-catalogue-ui (page-ui) — 1", file: "src/components/page-ui/stock-catalogue-ui.js" },
      { label: "ProfileWorkTab (profile) — 1", file: "src/components/profile/ProfileWorkTab.js" },
      { label: "JobClockingCard (Workshop) — 1", file: "src/components/Workshop/JobClockingCard.js" },
    ],
  },
  "non-global-badges": {
    title: "pill-shaped status chips built inline instead of .app-badge",
    total: 56,
    files: 32,
    usage: [
      { label: "VhcDetailsPanel (VHC) — 7", file: "src/components/VHC/VhcDetailsPanel.js" },
      { label: "ProfileWorkTab (profile) — 5", file: "src/components/profile/ProfileWorkTab.js" },
      { label: "FullScreenCapture (mediaCapture) — 4", file: "src/components/VHC/mediaCapture/FullScreenCapture.js" },
      { label: "index (goods-in) — 3", file: "src/pages/goods-in/index.js", route: "/goods-in" },
      { label: "ServiceIndicatorDetailsModal (VHC) — 3", file: "src/components/VHC/ServiceIndicatorDetailsModal.js" },
      { label: "NotesTab (components) — 2", file: "src/components/NotesTab.js" },
      { label: "appointments-ui (appointments) — 2", file: "src/components/page-ui/appointments/appointments-ui.js" },
      { label: "WarrantyTab (job-cards) — 2", file: "src/components/page-ui/job-cards/WarrantyTab.js" },
      { label: "ConcernPanel (mediaCapture) — 2", file: "src/components/VHC/mediaCapture/ConcernPanel.js" },
      { label: "ConcernPickerModal (mediaCapture) — 2", file: "src/components/VHC/mediaCapture/ConcernPickerModal.js" },
    ],
  },
  "non-global-modals": {
    title: "modal scrims painted by hand instead of .popup-backdrop",
    total: 0,
    files: 0,
    usage: [

    ],
  },
  "non-global-colours": {
    title: "hex colour literals with no token to move to yet",
    total: 14,
    files: 6,
    usage: [
      { label: "useWidgetRecorder (mediaCapture) — 5", file: "src/components/VHC/mediaCapture/useWidgetRecorder.js" },
      { label: "WorkshopQueuePlanner (QueuePlanner) — 3", file: "src/components/Workshop/QueuePlanner/WorkshopQueuePlanner.js" },
      { label: "BrandLogo (components) — 2", file: "src/components/BrandLogo.js" },
      { label: "ProfileThemeControls (profile) — 2", file: "src/components/profile/ProfileThemeControls.js" },
      { label: "appointments-ui (appointments) — 1", file: "src/components/page-ui/appointments/appointments-ui.js" },
      { label: "SupportScreenshotField (support) — 1", file: "src/components/support/SupportScreenshotField.js" },
    ],
  },
  "non-global-tabs": {
    title: "three tab implementations still live side by side",
    total: 3,
    files: 3,
    usage: [
      { label: "TabGroup / .tab-api — dominant (38 files)", file: "src/components/ui/tabAPI/TabGroup.js" },
      { label: ".app-tab--* — second base (3 files)", file: "src/styles/families/tabs.css" },
      { label: "StaffTabs / .app-staff-tabs — third (2 files)", file: "src/styles/staffglobal.css" },
    ],
  },
  "non-global-stylesheets": {
    title: "CSS Modules declaring surfaces outside the family system",
    total: 199,
    files: 5,
    usage: [
      { label: "roleTreeDemo.module.css — 297 rules, 104 surface declarations", file: "src/features/roleTreeDemo/styles/roleTreeDemo.module.css" },
      { label: "GlobalNotesWidget.module.css — 75 rules, 34 surface declarations", file: "src/components/GlobalNotesWidget.module.css" },
      { label: "invoice.module.css — 54 rules, 31 surface declarations", file: "src/features/invoices/styles/invoice.module.css" },
      { label: "AiGuidePanel.module.css — 96 rules, 24 surface declarations", file: "src/features/appGuide/components/AiGuidePanel.module.css" },
      { label: "ShareNotePopup.module.css — 17 rules, 6 surface declarations", file: "src/components/GlobalNotes/ShareNotePopup.module.css" },
    ],
  },
};
