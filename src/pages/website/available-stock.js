// file location: src/pages/website/available-stock.js
// Route for the customer vehicle search. Everything lives in the feature
// component so the page file stays a route entry (CLAUDE.md section 4.3).
//
// Server-rendered so the ?filter=new|used the Cars block hands over is applied
// in the FIRST paint. Reading it from the router on the client instead would
// show every car for a frame and then drop half of them, which reads as a bug.
import { customerWebsiteGetLayout } from "@/components/layout/CustomerWebsiteLayout";
import WebsiteRouteBoundary from "@/features/website/errors/WebsiteRouteBoundary";
import AvailableStockPage from "@/features/website/stock/AvailableStockPage";

export default function AvailableStock({ initialQuery }) {
  return (
    <WebsiteRouteBoundary>
      <AvailableStockPage initialQuery={initialQuery} />
    </WebsiteRouteBoundary>
  );
}

// Opts out of the staff sidebar / topbar chrome — see CustomerWebsiteLayout.
AvailableStock.getLayout = customerWebsiteGetLayout;

export async function getServerSideProps({ query }) {
  return { props: { initialQuery: query || {} } };
}
