// file location: src/pages/404.js
//
// The H&P in-app experience for a route that does not exist.
//
// Without this file Next.js serves its own stock "404 | This page could not be
// found" screen — unstyled by our design system, with no way to report the
// broken link and no record that anyone hit it. This renders the shared recovery
// screen instead (the same component the error boundary uses) and logs the hit
// automatically to support_error_events.

import PageErrorScreen from "@/components/support/PageErrorScreen";

export default function NotFoundPage() {
  return <PageErrorScreen statusCode={404} />;
}
