// file location: src/pages/website/shop/checkout.js

import dynamic from "next/dynamic";

const CheckoutPage = dynamic(() => import("@/features/website/shop/CheckoutPage"), {
  ssr: false,
});

export default function Page() {
  return <CheckoutPage />;
}

Page.getLayout = (page) => page;
