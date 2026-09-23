// file location: src/pages/dashboard/admin/index.js
import React, { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import useManagementDashboard from "@/hooks/useManagementDashboard";
import AdminDashboardUi from "@/components/page-ui/dashboard/admin/dashboard-admin-ui";

const allowedRoles = ADMIN_ROLES.map((role) => role.toUpperCase());

function DashboardContent() {
  const [days, setDays] = useState(7);
  const { data, error, isLoading, isValidating, mutate } = useManagementDashboard("admin", days);
  return <AdminDashboardUi data={data} error={error} loading={isLoading} refreshing={isValidating}
    days={days} onDaysChange={setDays} onRefresh={() => mutate()} />;
}

export default function AdminDashboard() {
  return <ProtectedRoute allowedRoles={allowedRoles}><DashboardContent /></ProtectedRoute>;
}
