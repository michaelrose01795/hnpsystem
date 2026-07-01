// file location: src/pages/dev/support-reports/[id].js
//
// Phase 6 — developer-only Support Centre report detail. Phase 8: re-gated to the
// strict DEV_PLATFORM_ROLES (`dev`) and re-homed under DevPlatformLayout. Thin
// shell; UI in SupportReportDetail.

import Head from "next/head";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import SupportReportDetail from "@/components/support/dev/SupportReportDetail";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

export default function SupportReportDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Support report — HNP System</title>
      </Head>
      <SupportReportDetail id={typeof id === "string" ? id : undefined} />
    </ProtectedRoute>
  );
}

SupportReportDetailPage.getLayout = withDevPlatformLayout({ activeKey: "support" });
