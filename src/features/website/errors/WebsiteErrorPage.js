// file location: src/features/website/errors/WebsiteErrorPage.js
//
// The customer-site error screen: page not found, server error, and a page that
// crashed while rendering. It is the /website counterpart of the staff
// PageErrorScreen, so a visitor on the public site stays inside the site's own
// look (custglobal.css), top bar and footer instead of being dropped onto the
// staff error screen.
//
// Styling is existing custglobal.css classes only (StockShell chrome, .ws-section,
// .ws-val-*, .ws-card, .ws-stock-empty*, .ws-btn). No inline visual styling, and
// no staff classes.
//
// Every page error is still logged to support_error_events with a reference code,
// exactly like the staff screen. A crash caught by WebsiteRouteBoundary arrives
// with the boundary's reference code and was already logged there.

import React from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

import StockShell from "../stock/StockShell";
import { generateReferenceCode } from "@/lib/notifications/buildErrorAlert";
import { logErrorEvent, ERROR_KINDS } from "@/lib/support/autoErrorLog";

const COPY = {
  404: {
    eyebrow: "Page not found",
    title: "Page not found",
    headline: "We can't find that page",
    message:
      "The link may be out of date, or the page may have moved. Everything on our site is still a click away — head back to the homepage or have a look at the cars we have in stock.",
    retryable: false,
  },
  500: {
    eyebrow: "Something went wrong",
    title: "Something went wrong",
    headline: "Sorry, this page isn't working right now",
    message:
      "Our server ran into a problem loading this page. It is usually momentary, so please try again. If it keeps happening, give us a call and we will help you straight away.",
    retryable: true,
  },
  crash: {
    eyebrow: "Something went wrong",
    title: "Something went wrong",
    headline: "Sorry, something went wrong on this page",
    message:
      "This page stopped working unexpectedly. Trying again usually fixes it. If it does not, head back to the homepage and carry on from there.",
    retryable: true,
  },
};

/**
 * @param {object} props
 * @param {number|null} [props.statusCode]  404, 500, or null for a render crash.
 * @param {unknown} [props.error]           The error, when there is one.
 * @param {string} [props.referenceCode]    Supplied by the boundary (already logged).
 * @param {Function} [props.onRetry]        Supplied by the boundary; defaults to a re-route.
 */
export default function WebsiteErrorPage({ statusCode = 404, error = null, referenceCode, onRetry }) {
  const router = useRouter();
  const copy = COPY[statusCode] || COPY.crash;

  // Minted after mount, not during render: this page is server-rendered, and a
  // code minted on both sides would differ and break hydration.
  const [ownReference, setOwnReference] = React.useState(null);
  const reference = referenceCode || ownReference;

  // Page errors log themselves; a boundary crash was logged by the boundary.
  React.useEffect(() => {
    if (referenceCode) return;
    const code = generateReferenceCode();
    setOwnReference(code);
    logErrorEvent({
      kind: ERROR_KINDS.PAGE,
      error,
      message: error?.message || `${statusCode} page error`,
      referenceCode: code,
      statusCode,
      variant: "customer",
      context: { source: "website-page-error", statusCode },
    });
  }, [error, referenceCode, statusCode]);

  const retry = () => {
    if (typeof onRetry === "function") onRetry();
    else router.replace(router.asPath);
  };

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/website");
  };

  return (
    <StockShell title={`${copy.title} | Humphries & Parks`} backToSite>
      <Head>
        {/* An error address must never be indexed as a real page. */}
        <meta name="robots" content="noindex" />
      </Head>

      <section className="ws-section ws-val-hero">
        <div className="ws-container ws-val-container">
          <span className="ws-eyebrow">{copy.eyebrow}</span>
          <h1 className="ws-h1">{copy.headline}</h1>
        </div>
      </section>

      <section className="ws-section ws-val-body">
        <div className="ws-container ws-val-container">
          <div className="ws-card ws-stock-empty" role="alert">
            <p className="ws-muted">{copy.message}</p>
            <div className="ws-stock-empty-actions">
              {copy.retryable ? (
                <button type="button" onClick={retry}>
                  Try again
                </button>
              ) : null}
              <Link href="/website" className="ws-btn ws-btn--primary">
                Back to the homepage
              </Link>
              {copy.retryable ? null : (
                <Link href="/website/available-stock" className="ws-btn ws-btn--ghost">
                  View available stock
                </Link>
              )}
              <button type="button" onClick={goBack}>
                Go back
              </button>
            </div>
            {reference ? <p className="ws-muted">Reference: {reference}</p> : null}
          </div>
        </div>
      </section>
    </StockShell>
  );
}
