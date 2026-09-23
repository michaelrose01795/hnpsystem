// file location: src/components/page-ui/dashboard/admin/dashboard-admin-ui.js
import ManagementInsights from "@/components/dashboards/ManagementInsights";

export default function AdminDashboardUi(props) {
  return <ManagementInsights {...props} mode="admin" />;
}
