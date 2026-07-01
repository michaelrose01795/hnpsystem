// file location: src/pages/dev/support-reports/[id].js
//
// Phase 6 — developer-only Support Centre report detail. Role-gated with
// ProtectedRoute + DEV_FULL_ACCESS_ROLES. Thin shell; UI in SupportReportDetail.

import Head from "next/head";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_FULL_ACCESS_ROLES } from "@/lib/auth/roles";
import SupportReportDetail from "@/components/support/dev/SupportReportDetail";

const ALLOWED = DEV_FULL_ACCESS_ROLES.map((r) => r.toUpperCase());

export default function SupportReportDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Support report — HNP System</title>
      </Head>
      <div className="app-page-shell" style={{ padding: "8px 8px 32px" }}>
        <SupportReportDetail id={typeof id === "string" ? id : undefined} />
      </div>
    </ProtectedRoute>
  );
}
