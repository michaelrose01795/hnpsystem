// file location: src/config/navigation.js
//
// Back-compat façade over the Workspace Navigation manifest.
//
// The sidebar sections USED to be declared inline here (one section per role,
// with the reporting section conditionally spliced in). That data now lives in
// the single, department-first manifest at src/config/workspace/ — the future
// source of truth for the Department Rail, Context Sidebar, breadcrumbs, search
// and the nav-derived permission layer.
//
// `sidebarSections` is now DERIVED from the manifest and is byte-for-byte
// identical to the previous inline definition (locked by
// src/config/workspace/manifest.test.js), so every existing consumer
// (StaffSidebar, pageAccess.js, navigation.test.js, buildAppKnowledge.js, …)
// keeps working unchanged. To add or change navigation, edit the manifest — see
// docs/Workspace Navigation/workspace-navigation-manifest-guide.md.

import { toSidebarSections } from "@/config/workspace/manifest";

// Reproduces the classic role-organised sidebar exactly (reporting section still
// gated by `reporting_nav_enabled`, inserted just before Account).
export const sidebarSections = toSidebarSections();
