// file location: src/pages/_error.js
//
// The catch-all framework error page. Next.js routes here for any error it
// surfaces outside a React error boundary that is not covered by the dedicated
// 404 / 500 pages — an error thrown during server rendering, a failed data fetch
// in getServerSideProps, or a client-side error Next.js escalates to the error
// page.
//
// DEVELOPMENT IS DELIBERATELY LEFT ALONE. In development Next.js shows its own
// error overlay (with the stack, the source frame and fast-refresh recovery)
// *before* this page, and for a server error it renders the overlay in place of
// this page entirely. That overlay is the thing a developer needs, so nothing
// here suppresses it — the H&P screen below is what PRODUCTION users get, where
// the overlay does not exist and the framework would otherwise print raw error
// text. `getInitialProps` below passes the status through in both modes and adds
// no behaviour of its own.
//
// Note on the boundary relationship: a crash *inside* a page's React tree is
// caught by the RouteBoundary in _app.js and never reaches this page. This is
// only for the errors React cannot see.

import PageErrorScreen from "@/components/support/PageErrorScreen";

function AppErrorPage({ statusCode, isCustomerSurface }) {
  return (
    <PageErrorScreen
      statusCode={statusCode || 500}
      variant={isCustomerSurface ? "customer" : "staff"}
    />
  );
}

// Customer-facing routes get the softer copy and a public "home" target — the
// same split the route boundary makes in _app.js. Matched on the path because
// this page runs before any of our own routing context exists.
const CUSTOMER_PATH_RE = /^\/(website|3Dwebsite|vhc\/customer-view|vhc\/customer-preview|tracking)(\/|$)/;

AppErrorPage.getInitialProps = ({ res, err, asPath }) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return {
    statusCode,
    isCustomerSurface: CUSTOMER_PATH_RE.test(asPath || ""),
  };
};

export default AppErrorPage;
