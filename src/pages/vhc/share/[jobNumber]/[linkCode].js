// file location: src/pages/vhc/share/[jobNumber]/[linkCode].js
// Read-only external VHC share route. It uses the same linked customer page
// controller and shared VhcCustomerView UI as the customer-facing link, but
// disables authorise / decline actions for copied external links.

import { VhcLinkedCustomerPage } from "@/pages/vhc/customer/[jobNumber]/[linkCode]";

export default function VhcReadOnlySharePage() {
  return <VhcLinkedCustomerPage accessMode="share" />;
}

// Bypass the global app shell so external recipients see only the report.
VhcReadOnlySharePage.getLayout = function publicLayout(page) {
  return page;
};
