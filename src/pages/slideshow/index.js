import { useEffect } from "react";
import { useRouter } from "next/router";

export default function LegacyPresentationRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/presentation");
  }, [router]);

  return null;
}
