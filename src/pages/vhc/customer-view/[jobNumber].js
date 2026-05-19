// file location: src/pages/vhc/customer-view/[jobNumber].js
// Customer-facing VHC route without a share code. It reuses the same page
// customers see in the staff preview so /website/profile and presentations
// show the customer surface, not the staff VHC panel.

import CustomerPreviewPage from "@/pages/vhc/customer-preview/[jobNumber]";

export default function VhcCustomerViewPage() {
  return <CustomerPreviewPage />;
}

VhcCustomerViewPage.getLayout = (page) => page;
