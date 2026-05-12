// Legacy dev preview index. Superseded by the role-driven deep-link form
// /presentation/<role>/<pageSlug>/<slide>. Redirects to the role picker.
import { useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";

export default function DevUiIndexPage() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    router.replace("/loginPresentation");
  }, [router, router.isReady]);
  return null;
}

DevUiIndexPage.getLayout = (page) => <Layout>{page}</Layout>;
