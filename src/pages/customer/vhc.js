// file location: src/pages/customer/vhc.js
import CustomerVhcPage from "@/features/customerPortal/pages/VhcPage";
import CustomerPortalVhcUi from "@/components/page-ui/customer/customer-vhc-ui"; // Extracted presentation layer.

export default function CustomerPortalVhc() {
  return <CustomerPortalVhcUi view="section1" CustomerVhcPage={CustomerVhcPage} />;
}
