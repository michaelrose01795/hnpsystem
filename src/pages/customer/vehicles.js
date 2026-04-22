// file location: src/pages/customer/vehicles.js
import CustomerVehiclesPage from "@/features/customerPortal/pages/VehiclesPage";
import CustomerPortalVehiclesUi from "@/components/page-ui/customer/customer-vehicles-ui"; // Extracted presentation layer.

export default function CustomerPortalVehicles() {
  return <CustomerPortalVehiclesUi view="section1" CustomerVehiclesPage={CustomerVehiclesPage} />;
}
