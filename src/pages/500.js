// file location: src/pages/500.js
//
// The H&P in-app experience for a server-side failure.
//
// Next.js serves this page for a 500 without running getInitialProps, so it must
// be renderable with no props and no server data — hence the bare render below.
// Without it, staff would see the framework's stock "Internal Server Error"
// text in production.
//
// Anything the client CAN still do (report a problem, log the event, navigate
// away) is handled by the shared recovery screen once it hydrates.

import PageErrorScreen from "@/components/support/PageErrorScreen";

export default function ServerErrorPage() {
  return <PageErrorScreen statusCode={500} />;
}
