// file location: src/pages/dev/support-reports/index.js
//
// Phase 6 — developer-only Help & Diagnostics Support Centre (list workspace).
// Phase 8: re-gated to the strict DEV_PLATFORM_ROLES (`dev`) and re-homed under
// the shared DevPlatformLayout. The page is a thin shell; all UI lives in
// SupportWorkspace.

import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import SupportWorkspace from "@/components/support/dev/SupportWorkspace";

// ProtectedRoute compares role strings upper-cased.
const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

export default function SupportReportsPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Support Centre — HNP System</title>
      </Head>
      <SupportWorkspace />
    </ProtectedRoute>
  );
}

SupportReportsPage.getLayout = withDevPlatformLayout({ activeKey: "support" });
