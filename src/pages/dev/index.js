// file location: src/pages/dev/index.js
//
// Phase 8 → Phase 11.1 — Developer Platform home. No longer a redirect/tile grid:
// it is a live statistics dashboard over the incoming support reports
// (DevOverviewStats), rendered inside the normal staff <Layout> with the platform
// tab group on top. Strictly gated to the `dev` role.

import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import DevOverviewStats from "@/components/dev-platform/sections/DevOverviewStats";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

export default function DevPlatformHome() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Developer Platform — HNP System</title>
      </Head>
      <DevOverviewStats />
    </ProtectedRoute>
  );
}

DevPlatformHome.getLayout = withDevPlatformLayout({ activeKey: "home" });
