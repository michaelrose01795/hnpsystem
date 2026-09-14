// file location: src/pages/404.js
//
// The H&P experience for a route that does not exist.
//
// Without this file Next.js serves its own stock "404 | This page could not be
// found" screen. This renders the shared recovery screen instead and logs the
// hit automatically to support_error_events.
//
// The same page serves both sides of the app: a /website address gets the
// customer-site error page and layout (custglobal.css), everything else the
// staff screen and layout. See FrameworkErrorPage / ErrorSurfaceLayout.

import FrameworkErrorPage from "@/components/support/FrameworkErrorPage";
import { errorSurfaceGetLayout } from "@/components/layout/ErrorSurfaceLayout";

export default function NotFoundPage() {
  return <FrameworkErrorPage statusCode={404} />;
}

NotFoundPage.getLayout = errorSurfaceGetLayout;
