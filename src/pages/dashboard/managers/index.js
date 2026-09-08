// file location: src/pages/dashboard/managers/index.js
import React, { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEALERSHIP_MANAGER_ROLES, ADMIN_ROLES } from "@/lib/auth/roles";
import useManagementDashboard from "@/hooks/useManagementDashboard";
import ManagersDashboardUi from "@/components/page-ui/dashboard/managers/dashboard-managers-ui";

const allowedRoles = [...DEALERSHIP_MANAGER_ROLES, ...ADMIN_ROLES].map((role) => role.toUpperCase());

function DashboardContent() {
  const [days, setDays] = useState(7);
  const { data, error, isLoading, isValidating, mutate } = useManagementDashboard("managers", days);
  return <ManagersDashboardUi data={data} error={error} loading={isLoading} refreshing={isValidating}
    days={days} onDaysChange={setDays} onRefresh={() => mutate()} />;
}

export default function ManagersDashboard() {
  return <ProtectedRoute allowedRoles={allowedRoles}><DashboardContent /></ProtectedRoute>;
}
