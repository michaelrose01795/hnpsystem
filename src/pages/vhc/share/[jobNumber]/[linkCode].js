// file location: src/pages/vhc/share/[jobNumber]/[linkCode].js
// Read-only external VHC share route. It uses the same linked customer page
// controller and shared VhcCustomerView UI as the customer-facing link, but
// disables authorise / decline actions for copied external links.

import {
  VhcLinkedCustomerPage,
  getVhcLinkServerSideProps,
} from "@/pages/vhc/customer/[jobNumber]/[linkCode]";

// Same server-side resolution as the customer link — this route is equally
// public and equally likely to be opened on a phone, so it gets the report in
// the first paint too.
export const getServerSideProps = getVhcLinkServerSideProps;

export default function VhcReadOnlySharePage({ initialReport }) {
  return <VhcLinkedCustomerPage accessMode="share" initialReport={initialReport} />;
}

// Bypass the global app shell so external recipients see only the report.
VhcReadOnlySharePage.getLayout = function publicLayout(page) {
  return page;
};
VhcReadOnlySharePage.hideGlobalNotesWidget = true;
