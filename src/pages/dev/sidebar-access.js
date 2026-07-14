// file location: src/pages/dev/sidebar-access.js
//
// Developer Platform → "Sidebar Access". Dev-only reference + explorer for the
// Group Sidebar: the full group list (each group's Dashboards + page buttons),
// each user's role-granted groups, and a multi-select live preview of any group.
// Strictly gated to the `dev` role via ProtectedRoute + DEV_PLATFORM_ROLES.

import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import DevSidebarAccess from "@/components/dev-platform/sections/DevSidebarAccess";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

export default function DevSidebarAccessPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Sidebar Access — Developer Platform</title>
      </Head>
      <DevSidebarAccess />
    </ProtectedRoute>
  );
}

DevSidebarAccessPage.getLayout = withDevPlatformLayout({
  activeKey: "sidebar-access",
  hideTabs: true,
});
