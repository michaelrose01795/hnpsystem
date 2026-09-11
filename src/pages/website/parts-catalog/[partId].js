// file location: src/pages/website/parts-catalog/[partId].js
// One part from the public catalogue, with full detail and add-to-basket.
// Opts out of the dashboard chrome.

import dynamic from "next/dynamic";

const PartDetailPage = dynamic(
  () => import("@/features/website/shop/PartDetailPage"),
  { ssr: false }
);

export default function Page() {
  return <PartDetailPage />;
}

Page.getLayout = (page) => page;
