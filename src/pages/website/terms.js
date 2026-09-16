// file location: src/pages/website/terms.js
// Route for the customer terms and conditions page. Everything lives in the
// feature component so the page file stays a route entry (CLAUDE.md 4.3).
import { customerWebsiteGetLayout } from "@/components/layout/CustomerWebsiteLayout";
import WebsiteRouteBoundary from "@/features/website/errors/WebsiteRouteBoundary";
import TermsPage from "@/features/website/legal/TermsPage";

export default function Terms() {
  return (
    <WebsiteRouteBoundary>
      <TermsPage />
    </WebsiteRouteBoundary>
  );
}

// Opts out of the staff sidebar / topbar chrome - see CustomerWebsiteLayout.
Terms.getLayout = customerWebsiteGetLayout;
