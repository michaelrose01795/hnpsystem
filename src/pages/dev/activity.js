// file location: src/pages/dev/activity.js
//
// Phase 10 — Developer Platform "Activity & Audit". Phase 11: the view moved to
// the reusable ActivitySection so both this standalone page and the Support
// hub's "Activity" tab render the same component. Strictly gated to the `dev`
// role.

import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import ActivityLogView from "@/components/activity/ActivityLogView";
import { AUDIT_VIEW_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";

const ALLOWED = AUDIT_VIEW_ROLES.map((role) => role.toUpperCase());

export default function DevActivityPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Activity &amp; Audit — Developer Platform</title>
      </Head>
      <ActivityLogView />
    </ProtectedRoute>
  );
}

DevActivityPage.getLayout = withDevPlatformLayout({ activeKey: "activity" });
