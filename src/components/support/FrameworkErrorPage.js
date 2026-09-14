// file location: src/components/support/FrameworkErrorPage.js
//
// The body of the framework error pages (404 / 500 / _error), split by surface:
// a /website address gets the customer-site WebsiteErrorPage, everything else
// keeps the staff PageErrorScreen. Pair it with errorSurfaceGetLayout so the
// chrome around it matches too.

import Head from "next/head";
import PageErrorScreen from "@/components/support/PageErrorScreen";
import WebsiteErrorPage from "@/features/website/errors/WebsiteErrorPage";
import useErrorSurface from "@/features/website/hooks/useErrorSurface";

export default function FrameworkErrorPage({ statusCode = 500, variant = "staff", error = null }) {
  const surface = useErrorSurface();

  if (surface === "website") {
    return <WebsiteErrorPage statusCode={statusCode === 404 ? 404 : 500} error={error} />;
  }
  if (surface === null) return null;

  return (
    <>
      {/* Named so a staff member with a dozen tabs open can see WHICH one fell
          over without clicking through them. */}
      <Head>
        <title>{statusCode === 404 ? "Page not found" : "Something went wrong"} - HNP System</title>
      </Head>
      <PageErrorScreen statusCode={statusCode} variant={variant} error={error} />
    </>
  );
}
