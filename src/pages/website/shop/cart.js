// file location: src/pages/website/shop/cart.js
// Public cart review page. Opts out of the dashboard chrome.

import dynamic from "next/dynamic";

const CartPage = dynamic(() => import("@/features/website/shop/CartPage"), {
  ssr: false,
});

export default function Page() {
  return <CartPage />;
}

Page.getLayout = (page) => page;
