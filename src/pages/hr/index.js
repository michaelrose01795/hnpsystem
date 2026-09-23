// Legacy HR landing route. HR now lives in the consolidated Manager workspace.
import { redirectToHrManagerTab } from "@/lib/hr/hrManagerRoutes";

export default function LegacyHrOverviewRoute() {
  return null;
}

export function getServerSideProps() {
  return redirectToHrManagerTab("dashboard");
}
