// file location: src/pages/dev/health.js
//
// Phase 8 — Developer Platform "Application Health". Phase 11: the view moved to
// the reusable HealthSection so both this standalone page and the Support hub's
// "Health" tab render the same component. Strictly gated to the `dev` role.

import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import HealthSection from "@/components/dev-platform/sections/HealthSection";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

export default function DevHealthPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Application Health — Developer Platform</title>
      </Head>
      <HealthSection />
    </ProtectedRoute>
  );
}

DevHealthPage.getLayout = withDevPlatformLayout({ activeKey: "health" });
