// file location: src/pages/vhc/customer-view/[jobNumber].js
// Customer-facing VHC route without a share code. It reuses the same page
// customers see in the staff preview so /website/profile and presentations
// show the customer surface, not the staff VHC panel.

import { VhcDirectCustomerPage } from "@/pages/vhc/customer-preview/[jobNumber]";
import { RouteBoundary } from "@/components/support/SupportErrorBoundary";

// Phase 9 — customer-variant recovery boundary (see customer-preview) so this
// share-code-free customer route degrades gracefully instead of white-screening.
export default function VhcCustomerViewPage() {
  return (
    <RouteBoundary variant="customer" homeHref="/website" hostSupportModal>
      <VhcDirectCustomerPage accessMode="customer" />
    </RouteBoundary>
  );
}

VhcCustomerViewPage.getLayout = (page) => page;
VhcCustomerViewPage.hideGlobalNotesWidget = true;
