// file location: src/components/layout/ErrorSurfaceLayout.js
//
// Layout for the framework error pages (404 / 500 / _error). Those pages have no
// fixed audience: the same /404 serves a missing staff page and a missing
// /website page. This picks the chrome from the real address — the customer
// website layout for /website, the staff Layout for everything else — and
// renders nothing until the address is known, so neither side flashes the
// other's chrome.

import Layout from "@/components/Layout";
import CustomerWebsiteLayout from "@/components/layout/CustomerWebsiteLayout";
import useErrorSurface from "@/features/website/hooks/useErrorSurface";

export default function ErrorSurfaceLayout({ children }) {
  const surface = useErrorSurface();
  if (surface === "website") return <CustomerWebsiteLayout>{children}</CustomerWebsiteLayout>;
  if (surface === "staff") return <Layout>{children}</Layout>;
  return null;
}

export const errorSurfaceGetLayout = (page) => <ErrorSurfaceLayout>{page}</ErrorSurfaceLayout>;
