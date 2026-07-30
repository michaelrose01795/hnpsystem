import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import ActivityLogView from "@/components/activity/ActivityLogView";
import { AUDIT_VIEW_ROLES } from "@/lib/auth/roles";

const ALLOWED_ROLES = AUDIT_VIEW_ROLES.map((role) => role.toUpperCase());

export default function AdminActivityLogPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED_ROLES}>
      <Head>
        <title>User Activity | HNPSystem</title>
      </Head>
      <ActivityLogView />
    </ProtectedRoute>
  );
}
