// file location: src/components/Sidebar.js
// Back-compat shim. The staff sidebar implementation moved to
// src/components/layout/StaffSidebar.js during the layout cleanup so the
// navigation rail lives alongside the other layout primitives. This re-export
// keeps existing `@/components/Sidebar` imports working unchanged.
export { default } from "@/components/layout/StaffSidebar";
