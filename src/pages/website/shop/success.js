// file location: src/pages/website/shop/success.js

import dynamic from "next/dynamic";

const SuccessPage = dynamic(() => import("@/singlescroll/shop/SuccessPage"), {
  ssr: false,
});

export default function Page() {
  return <SuccessPage />;
}

Page.getLayout = (page) => page;
