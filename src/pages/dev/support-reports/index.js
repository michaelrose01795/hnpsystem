// file location: src/pages/dev/support-reports/index.js
//
// Phase 6 — developer-only Help & Diagnostics Support Centre (list workspace).
// Role-gated with ProtectedRoute + DEV_FULL_ACCESS_ROLES (matches the API gate).
// The page is a thin shell; all UI lives in SupportWorkspace.

import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_FULL_ACCESS_ROLES } from "@/lib/auth/roles";
import SupportWorkspace from "@/components/support/dev/SupportWorkspace";

// ProtectedRoute compares role strings upper-cased.
const ALLOWED = DEV_FULL_ACCESS_ROLES.map((r) => r.toUpperCase());

export default function SupportReportsPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Support Centre — HNP System</title>
      </Head>
      <div className="app-page-shell" style={{ padding: "8px 8px 32px" }}>
        <SupportWorkspace />
      </div>
    </ProtectedRoute>
  );
}
