// file location: src/features/website/hooks/useErrorSurface.js
//
// Resolves which surface an error page should render on: "website" (the
// customer site), "staff", or null while it cannot be known yet.
//
// Static error pages can have different router.asPath values on the server and
// the first client render. Always wait for mount before reading the browser
// address so hydration starts with the same empty surface on both sides and a
// /website visitor never sees a flash of the staff chrome.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { isWebsitePath } from "@/features/website/errors/websiteErrorRoutes";

export default function useErrorSurface() {
  const router = useRouter();
  const asPath = router?.asPath || "";
  const [browserPath, setBrowserPath] = useState(null);

  useEffect(() => {
    setBrowserPath(window.location.pathname);
  }, [asPath]);

  if (browserPath === null) return null;
  return isWebsitePath(browserPath) ? "website" : "staff";
}
