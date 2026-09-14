// file location: src/pages/website/shop/cancel.js
// Legacy route: opens the single /website/shop flow at the cancelled checkpoint.

import dynamic from "next/dynamic";

const ShopCheckoutFlow = dynamic(() => import("@/features/website/shop/ShopCheckoutFlow"), {
  ssr: false,
});

export default function Page() {
  return <ShopCheckoutFlow initialStep="cancelled" />;
}

Page.getLayout = (page) => page;
