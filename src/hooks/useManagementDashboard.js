import useSWR from "swr";

const fetchDashboard = async ([, mode, days]) => {
  if (mode === "admin") {
    const { getAdminDashboardData } = await import("@/lib/database/dashboard/admin");
    return getAdminDashboardData(days);
  }
  const { getManagersDashboardData } = await import("@/lib/database/dashboard/managers");
  return getManagersDashboardData(days);
};

// Only mounted inside ProtectedRoute. SWR deduplicates refreshes and ignores
// responses belonging to a previously selected reporting period.
export default function useManagementDashboard(mode, days) {
  return useSWR(["management-dashboard", mode, days], fetchDashboard, {
    revalidateOnFocus: false, shouldRetryOnError: false,
  });
}
