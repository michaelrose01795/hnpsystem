// file location: src/pages/dev/activity.js
//
// Phase 10 — Developer Platform "Activity & Audit". Phase 11: the view moved to
// the reusable ActivitySection so both this standalone page and the Support
// hub's "Activity" tab render the same component. Strictly gated to the `dev`
// role.

import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import ActivitySection from "@/components/dev-platform/sections/ActivitySection";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

export default function DevActivityPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Activity &amp; Audit — Developer Platform</title>
      </Head>
      <ActivitySection />
    </ProtectedRoute>
  );
}

DevActivityPage.getLayout = withDevPlatformLayout({ activeKey: "activity" });
