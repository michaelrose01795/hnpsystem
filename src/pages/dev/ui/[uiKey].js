// Legacy dev preview route. The old per-slide mock catalog has been replaced
// by the real-page mount under /presentation/<role>/<pageSlug>/<slide>; to
// see any page-ui standalone, pick a role tile on /loginPresentation and
// navigate to the relevant slide. This page now redirects there.
import { useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";

export default function DevUiPreviewPage() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    router.replace("/loginPresentation");
  }, [router, router.isReady]);
  return null;
}

DevUiPreviewPage.getLayout = (page) => <Layout>{page}</Layout>;
