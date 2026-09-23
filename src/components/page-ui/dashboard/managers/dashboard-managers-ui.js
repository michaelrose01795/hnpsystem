// file location: src/components/page-ui/dashboard/managers/dashboard-managers-ui.js
import ManagementInsights from "@/components/dashboards/ManagementInsights";

export default function ManagersDashboardUi(props) {
  return <ManagementInsights {...props} mode="managers" />;
}
