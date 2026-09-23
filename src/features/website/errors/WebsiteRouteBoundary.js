// file location: src/features/website/errors/WebsiteRouteBoundary.js
//
// Route-level error boundary for /website pages. It is the shared RouteBoundary
// (same logging, reference code, crash-loop detection and reset-on-navigation)
// with one difference: the fallback is the customer-site WebsiteErrorPage, not
// the staff recovery card, so a crash on the public site stays on the public site.

import { RouteBoundary } from "@/components/support/SupportErrorBoundary";
import { RECOVERY_ACTIONS } from "@/lib/support/recoveryModel";
import WebsiteErrorPage from "./WebsiteErrorPage";

const renderWebsiteFallback = ({ error, referenceCode, loopDetected, handlers }) => (
  <WebsiteErrorPage
    statusCode={null}
    error={error}
    referenceCode={referenceCode}
    // After repeated crashes an in-place retry would just crash again, so the
    // same button does a full reload instead.
    onRetry={loopDetected ? handlers[RECOVERY_ACTIONS.RELOAD] : handlers[RECOVERY_ACTIONS.RETRY]}
  />
);

export default function WebsiteRouteBoundary({ children }) {
  return (
    <RouteBoundary variant="customer" homeHref="/website" hostSupportModal fallback={renderWebsiteFallback}>
      {children}
    </RouteBoundary>
  );
}
