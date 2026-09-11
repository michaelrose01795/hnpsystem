// file location: src/pages/website/parts-catalog/index.js
// The public parts & accessories shop, reading the staff DMS Stock
// Catalogue. Opts out of the dashboard chrome.

import dynamic from "next/dynamic";

const PartsCatalogPage = dynamic(
  () => import("@/features/website/shop/PartsCatalogPage"),
  { ssr: false }
);

export default function Page() {
  return <PartsCatalogPage />;
}

Page.getLayout = (page) => page;
