// Legacy employee route. Employee management now lives in HR Manager.
import { redirectToHrManagerTab } from "@/lib/hr/hrManagerRoutes";

export default function LegacyHrEmployeesRoute() {
  return null;
}

export function getServerSideProps() {
  return redirectToHrManagerTab("employees");
}
