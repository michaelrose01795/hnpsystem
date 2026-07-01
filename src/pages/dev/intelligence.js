// file location: src/pages/dev/intelligence.js
//
// Phase 9 — Developer Platform "Intelligence" dashboard. Phase 11: the view
// moved to the reusable InvestigationsSection so both this standalone page and
// the Support hub's "Investigations" tab render the same component. Strictly
// gated to the `dev` role.

import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import InvestigationsSection from "@/components/dev-platform/sections/InvestigationsSection";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

export default function DevIntelligencePage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Intelligence — Developer Platform</title>
      </Head>
      <InvestigationsSection />
    </ProtectedRoute>
  );
}

DevIntelligencePage.getLayout = withDevPlatformLayout({ activeKey: "intelligence" });
