// file location: src/pages/vision/role-tree-demo.js
// Standalone mock-only presentation route. The page bypasses the persistent
// app <Layout> entirely so it renders full-screen with no sidebar, no top bar,
// no auth gate and no DMS chrome. Mock data only — no Supabase, no API calls.
// /vision/ is in ALWAYS_ALLOWED_PREFIXES (src/lib/auth/pageAccess.js) so the
// route is reachable without logging in. staffglobal.css is loaded globally by
// _app.js and scoped via html.staff-scope, which _app.js applies on non-website
// routes — so this page picks up the dealership design system automatically.

import React from "react";
import RoleTreeDemo from "@/features/roleTreeDemo/components/RoleTreeDemo";

export default function RoleTreeDemoPage() {
  return <RoleTreeDemo />;
}

RoleTreeDemoPage.getLayout = (page) => page;
