// file location: src/pages/500.js
//
// The H&P experience for a server-side failure.
//
// Next.js serves this page for a 500 without running getInitialProps, so it must
// be renderable with no props and no server data. Without it, users would see
// the framework's stock "Internal Server Error" text in production.
//
// A /website address gets the customer-site error page and layout; everything
// else the staff screen. See FrameworkErrorPage / ErrorSurfaceLayout.

import FrameworkErrorPage from "@/components/support/FrameworkErrorPage";
import { errorSurfaceGetLayout } from "@/components/layout/ErrorSurfaceLayout";

export default function ServerErrorPage() {
  return <FrameworkErrorPage statusCode={500} />;
}

ServerErrorPage.getLayout = errorSurfaceGetLayout;
