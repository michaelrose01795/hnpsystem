// file location: src/features/website/hooks/useErrorSurface.js
//
// Resolves which surface an error page should render on: "website" (the
// customer site), "staff", or null while it cannot be known yet.
//
// A server-rendered error (_error, or 404 in development) already knows the real
// address through router.asPath. The production 404 / 500 pages are prerendered
// once at build time as "/404" / "/500", so for those the browser address is read
// after mount — and nothing renders until then, so a /website visitor never sees
// a flash of the staff chrome.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { isFrameworkErrorRoute, isWebsitePath } from "../errors/websiteErrorRoutes";

export default function useErrorSurface() {
  const router = useRouter();
  const asPath = router?.asPath || "";
  const [browserPath, setBrowserPath] = useState(null);

  useEffect(() => {
    setBrowserPath(window.location.pathname);
  }, [asPath]);

  const path = browserPath ?? (isFrameworkErrorRoute(asPath) ? null : asPath);
  if (path === null) return null;
  return isWebsitePath(path) ? "website" : "staff";
}
