// file location: src/pages/customer/index.js
import CustomerDashboardPage from "@/features/customerPortal/pages/DashboardPage";
import CustomerPortalIndexUi from "@/components/page-ui/customer/customer-ui"; // Extracted presentation layer.

export default function CustomerPortalIndex() {
  return <CustomerPortalIndexUi view="section1" CustomerDashboardPage={CustomerDashboardPage} />;
}
