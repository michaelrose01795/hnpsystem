// file location: src/pages/website/valuation.js
// Route for the free car valuation wizard. Everything lives in the feature
// component so the page file stays a route entry (CLAUDE.md section 4.3).
//
// Client-only: there is nothing to render on the server that the first paint
// needs, and the DVLA lookup happens on demand from the customer's own action.
import { customerWebsiteGetLayout } from "@/components/layout/CustomerWebsiteLayout";
import WebsiteRouteBoundary from "@/features/website/errors/WebsiteRouteBoundary";
import ValuationPage from "@/features/website/valuation/ValuationPage";

export default function Valuation() {
  return (
    <WebsiteRouteBoundary>
      <ValuationPage />
    </WebsiteRouteBoundary>
  );
}

// Opts out of the staff sidebar / topbar chrome — see CustomerWebsiteLayout.
Valuation.getLayout = customerWebsiteGetLayout;
