// file location: src/pages/customer/parts.js
import CustomerPartsPage from "@/features/customerPortal/pages/PartsPage";
import CustomerPortalPartsUi from "@/components/page-ui/customer/customer-parts-ui"; // Extracted presentation layer.

export default function CustomerPortalParts() {
  return <CustomerPortalPartsUi view="section1" CustomerPartsPage={CustomerPartsPage} />;
}
