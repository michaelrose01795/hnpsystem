// Legacy /presentation entry point. The current deep-link form is
// /presentation/<role>/<pageSlug>/<slide> (see [role]/[pageSlug]/[slide].js).
// A bare /presentation hit always returns the user to the role picker.
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function PresentationIndex() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    router.replace("/loginPresentation");
  }, [router, router.isReady]);
  return null;
}
