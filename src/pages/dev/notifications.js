// file location: src/pages/dev/notifications.js
//
// Phase 10 — Developer Platform "Notifications". Phase 11: the view moved to the
// reusable NotificationsSection so both this standalone page and the Support
// hub's "Notifications" tab render the same component. Strictly gated to the
// Developer Platform roles.

import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import NotificationsSection from "@/components/dev-platform/sections/NotificationsSection";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

export default function DevNotificationsPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Notifications — Developer Platform</title>
      </Head>
      <NotificationsSection />
    </ProtectedRoute>
  );
}

DevNotificationsPage.getLayout = withDevPlatformLayout({ activeKey: "notifications" });
