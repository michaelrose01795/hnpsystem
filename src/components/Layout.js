// file location: src/components/Layout.js
// Back-compat shim. The staff app shell implementation moved to
// src/components/layout/StaffLayout.js during the layout cleanup. The topbar
// and sidebar were split out into ./layout/StaffTopbar and ./layout/StaffSidebar.
// This re-export keeps every existing `@/components/Layout` import (10 pages +
// _app.js) working unchanged — the default export is still the same component.
export { default } from "@/components/layout/StaffLayout";
