// file location: src/pages/website/shop/cart.js
// Legacy route: opens the single /website/shop flow at the basket checkpoint.

import dynamic from "next/dynamic";

const ShopCheckoutFlow = dynamic(() => import("@/features/website/shop/ShopCheckoutFlow"), {
  ssr: false,
});

export default function Page() {
  return <ShopCheckoutFlow initialStep="basket" />;
}

Page.getLayout = (page) => page;
