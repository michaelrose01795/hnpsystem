// file location: src/pages/website/privacy.js
// Route for the privacy, data and legal information page. Everything lives in
// the feature component so the page file stays a route entry (CLAUDE.md 4.3).
import { customerWebsiteGetLayout } from "@/components/layout/CustomerWebsiteLayout";
import WebsiteRouteBoundary from "@/features/website/errors/WebsiteRouteBoundary";
import PrivacyPolicyPage from "@/features/website/legal/PrivacyPolicyPage";

export default function Privacy() {
  return (
    <WebsiteRouteBoundary>
      <PrivacyPolicyPage />
    </WebsiteRouteBoundary>
  );
}

// Opts out of the staff sidebar / topbar chrome — see CustomerWebsiteLayout.
Privacy.getLayout = customerWebsiteGetLayout;
