// file location: src/pages/website/stock/[reg].js
// Route for one vehicle, addressed by its registration. The reg is normalised
// in the stock module (spacing and case are ignored), so /website/stock/sf23xkd
// and /website/stock/SF23%20XKD both resolve to the same current listing.
//
// Server-rendered on purpose. A vehicle advert is the page most likely to be
// shared, indexed and linked to, so the car has to be in the HTML rather than
// painted in after hydration — and a reg that is not in stock has to answer
// 404 so a sold car stops being indexed.
import { customerWebsiteGetLayout } from "@/components/layout/CustomerWebsiteLayout";
import { RouteBoundary } from "@/components/support/SupportErrorBoundary";
import StockDetailPage from "@/features/website/stock/StockDetailPage";
import { getStockByReg } from "@/lib/stock/vehicleStock";

export default function StockVehicle({ reg }) {
  return (
    <RouteBoundary variant="customer" homeHref="/website" hostSupportModal>
      <StockDetailPage reg={reg} />
    </RouteBoundary>
  );
}

// Opts out of the staff sidebar / topbar chrome — see CustomerWebsiteLayout.
StockVehicle.getLayout = customerWebsiteGetLayout;

export async function getServerSideProps({ params, res }) {
  const reg = Array.isArray(params?.reg) ? params.reg[0] : params?.reg || "";
  // The page still renders (StockDetailPage has a "sold / not found" state —
  // a customer following an old link deserves an explanation, not a bare 404
  // screen), but the status code tells crawlers the advert is gone.
  if (!getStockByReg(reg)) res.statusCode = 404;
  return { props: { reg } };
}
