// file location: src/pages/website/shop/checkout.js
// Legacy route: opens the single /website/shop flow at the details checkpoint.

import dynamic from "next/dynamic";

const ShopCheckoutFlow = dynamic(() => import("@/features/website/shop/ShopCheckoutFlow"), {
  ssr: false,
});

export default function Page() {
  return <ShopCheckoutFlow initialStep="details" />;
}

Page.getLayout = (page) => page;
