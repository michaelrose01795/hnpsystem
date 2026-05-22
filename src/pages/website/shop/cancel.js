// file location: src/pages/website/shop/cancel.js

import dynamic from "next/dynamic";

const CancelPage = dynamic(() => import("@/features/website/shop/CancelPage"), {
  ssr: false,
});

export default function Page() {
  return <CancelPage />;
}

Page.getLayout = (page) => page;
