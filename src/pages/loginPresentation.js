import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import LoginPresentationPageUi from "@/components/page-ui/login-presentation/login-presentation-ui";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { useTheme } from "@/styles/themeProvider";

export default function LoginPresentationPage() {
  const { setTemporaryOverride } = useTheme();
  const router = useRouter();
  const [isEntering, setIsEntering] = useState(false);

  const handleSelectRole = useCallback((event, role) => {
    if (
      event?.defaultPrevented ||
      event?.button !== 0 ||
      event?.metaKey ||
      event?.ctrlKey ||
      event?.shiftKey ||
      event?.altKey
    ) {
      return;
    }
    if (role?.key && typeof window !== "undefined") {
      window.sessionStorage.setItem("presentation:activeRoleKey", role.key);
    }
    setIsEntering(true);
  }, []);

  // Lock the role-picker into the brand red accent regardless of the visitor's
  // saved theme preference — Presentation Mode is a controlled demo surface.
  useEffect(() => {
    setTemporaryOverride({ mode: "system", accent: "red" });
    return () => {
      setTemporaryOverride(null);
    };
  }, [setTemporaryOverride]);

  // Swap in the shared PageSkeleton the instant a deck is chosen — the same
  // loading behaviour the /login page uses on its post-login redirect — so the
  // jump into /presentation/* is smooth instead of freezing on the role grid
  // while the deck page code-splits in.
  useEffect(() => {
    const handleStart = (url) => {
      if (typeof url === "string" && url.startsWith("/presentation/")) {
        setIsEntering(true);
      }
    };
    const handleStop = () => setIsEntering(false);
    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleStop);
    router.events.on("routeChangeError", handleStop);
    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleStop);
      router.events.off("routeChangeError", handleStop);
    };
  }, [router.events]);

  if (isEntering) {
    return <LoginPresentationPageUi view="section1" PageSkeleton={PageSkeleton} />;
  }

  return <LoginPresentationPageUi view="section2" onSelectRole={handleSelectRole} />;
}
