// file location: src/pages/website/shop/success.js
// Legacy route: opens the single /website/shop flow at the success checkpoint.

import dynamic from "next/dynamic";

const ShopCheckoutFlow = dynamic(() => import("@/features/website/shop/ShopCheckoutFlow"), {
  ssr: false,
});

export default function Page() {
  return <ShopCheckoutFlow initialStep="success" />;
}

Page.getLayout = (page) => page;
