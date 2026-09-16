// file location: src/pages/_error.js
//
// The catch-all framework error page. Next.js routes here for any error it
// surfaces outside a React error boundary that is not covered by the dedicated
// 404 / 500 pages — an error thrown during server rendering, a failed data fetch
// in getServerSideProps, or a client-side error Next.js escalates to the error
// page.
//
// DEVELOPMENT IS DELIBERATELY LEFT ALONE. In development Next.js shows its own
// error overlay before this page, and for a server error renders the overlay in
// place of this page entirely. The screen below is what PRODUCTION users get.
//
// A /website address gets the customer-site error page and layout
// (custglobal.css). Other customer-facing routes (tracking, customer VHC view)
// keep the softer customer copy on the shared screen; staff routes the staff
// screen. A crash *inside* a page's React tree is caught by the route boundary
// in _app.js and never reaches this page.

import FrameworkErrorPage from "@/components/support/FrameworkErrorPage";
import { errorSurfaceGetLayout } from "@/components/layout/ErrorSurfaceLayout";

function AppErrorPage({ statusCode, isCustomerSurface }) {
  return (
    <FrameworkErrorPage
      statusCode={statusCode || 500}
      variant={isCustomerSurface ? "customer" : "staff"}
    />
  );
}

AppErrorPage.getLayout = errorSurfaceGetLayout;

// Matched on the path because this page runs before any of our own routing
// context exists.
const CUSTOMER_PATH_RE = /^\/(website|3Dwebsite|vhc\/customer-view|vhc\/customer-preview|tracking)(\/|$)/;

AppErrorPage.getInitialProps = ({ res, err, asPath }) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return {
    statusCode,
    isCustomerSurface: CUSTOMER_PATH_RE.test(asPath || ""),
  };
};

export default AppErrorPage;
