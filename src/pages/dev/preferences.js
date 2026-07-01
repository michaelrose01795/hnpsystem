// file location: src/pages/dev/preferences.js
//
// Phase 8 — Developer Platform preferences. Phase 11: the view moved to the
// reusable PreferencesSection so both this standalone page and the Support hub's
// "Settings" tab render the same component. Strictly gated to the `dev` role.

import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import PreferencesSection from "@/components/dev-platform/sections/PreferencesSection";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

export default function DevPreferencesPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Preferences — Developer Platform</title>
      </Head>
      <PreferencesSection />
    </ProtectedRoute>
  );
}

DevPreferencesPage.getLayout = withDevPlatformLayout({ activeKey: "preferences" });
