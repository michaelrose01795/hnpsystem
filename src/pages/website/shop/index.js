// file location: src/pages/website/shop/index.js
// Public basket -> details -> payment -> confirmation, as one checkpointed
// page. Opts out of the dashboard chrome.

import dynamic from "next/dynamic";

const ShopCheckoutFlow = dynamic(
  () => import("@/features/website/shop/ShopCheckoutFlow"),
  { ssr: false }
);

export default function Page() {
  return <ShopCheckoutFlow />;
}

Page.getLayout = (page) => page;
