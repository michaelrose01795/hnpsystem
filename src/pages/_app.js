// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/_app.js
import "@/utils/polyfills"; // ensure polyfills load globally
import "@/utils/quietConsole"; // minimize console noise unless LOG_LEVEL is raised
import "@/styles/theme.css"; // register CSS variables before globals
import "../styles/globals.css"; // import global base styles
import { Inter } from "next/font/google";
import React, { useEffect, useState } from "react"; // import React helpers

// Self-hosted Inter via next/font (no FOUT, no external request at runtime).
// We need the resolved font-family string (next/font generates a hashed name
// like '__Inter_xxxxx, __Inter_Fallback_xxxxx') so we can pin it to :root —
// putting the className on a wrapper div would only define --font-inter for
// descendants, leaving body's `font-family: var(--font-family)` invalid.
const interFont = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
});

// Bind the resolved font family to a CSS custom property at :root. theme.css
// consumes this via --font-family, so swapping fonts is still a one-line
// change there. Rendered as an inline <style> tag so it is present in the
// initial HTML — no FOUC, no JS dependency, no _document.js changes.
const FONT_VARIABLE_STYLE = `:root { --font-inter: ${interFont.style.fontFamily}; }`;
import { SessionProvider } from "next-auth/react"; // import NextAuth session provider
import { useRouter } from "next/router";
import { UserProvider } from "@/context/UserContext"; // import user context
import { NextActionProvider } from "@/context/NextActionContext"; // import next action context provider
import { JobsProvider } from "@/context/JobsContext"; // import jobs context
import { ClockingProvider } from "@/context/ClockingContext"; // import clocking context
import { RosterProvider } from "@/context/RosterContext"; // import roster context
import { AlertProvider } from "@/context/AlertContext";
import { ThemeProvider } from "@/styles/themeProvider";
import { ConfirmationProvider } from "@/context/ConfirmationContext";
import { DevLayoutOverlayProvider } from "@/context/DevLayoutOverlayContext";
import { DevLayoutRegistryProvider } from "@/context/DevLayoutRegistryContext";
import GlobalNotesWidget from "@/components/GlobalNotesWidget";
import CookieBanner from "@/components/CookieBanner";
import GlobalDraftPersistence from "@/components/App/GlobalDraftPersistence";
import GlobalTableShells from "@/components/App/GlobalTableShells";
import DevLayoutOverlayRoot from "@/components/dev-layout-overlay/DevLayoutOverlayRoot";
import { SWRConfig } from "swr"; // global SWR cache and revalidation config
import { swrConfig } from "@/lib/swr/config"; // HNP-tuned SWR defaults
import Layout from "@/components/Layout"; // persistent app shell — mounted once via getLayout

// Default page layout: every page is wrapped by the persistent <Layout>. Pages that
// need custom layout props (jobNumber, requiresLandscape, disableContentCardHover,
// contentBackground, disableContentCard) override Page.getLayout themselves. Returning
// the same <Layout> element type across navigations lets React keep the shell mounted
// — only the inner children swap.
const defaultGetLayout = (page) => <Layout>{page}</Layout>;

function AppWrapper({ Component, pageProps }) {
  const router = useRouter();
  const pathname = router?.pathname || "";
  const asPath = router?.asPath || "";
  const asPathWithoutQuery = asPath.split("?")[0] || "";
  const notesHiddenRoutes = new Set(["/", "/login", "/presentation"]);
  const hideNotesWidget =
    notesHiddenRoutes.has(pathname) || notesHiddenRoutes.has(asPathWithoutQuery);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  // Remove legacy reload/boot classes that can persist on iOS Safari and block manual reloads.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const clearLegacyBootArtifacts = () => {
      document.documentElement.classList.remove("app-boot-loading");
      document.documentElement.classList.remove("app-reloading");
      document.getElementById("app-boot-loader")?.remove();
    };

    clearLegacyBootArtifacts();
    window.addEventListener("pageshow", clearLegacyBootArtifacts);
    return () => window.removeEventListener("pageshow", clearLegacyBootArtifacts);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleRouteStart = () => setIsRouteLoading(true);
    const handleRouteDone = () => setIsRouteLoading(false);

    router.events.on("routeChangeStart", handleRouteStart);
    router.events.on("routeChangeComplete", handleRouteDone);
    router.events.on("routeChangeError", handleRouteDone);
    return () => {
      router.events.off("routeChangeStart", handleRouteStart);
      router.events.off("routeChangeComplete", handleRouteDone);
      router.events.off("routeChangeError", handleRouteDone);
    };
  }, [router.events]);

  useEffect(() => {
    const hideTimers = new WeakMap();
    const HIDE_DELAY = 3000;

    const showScrollbar = (el) => {
      el.classList.add('scrollbar-visible');
      el.classList.remove('scrollbar-hidden');
    };

    const hideScrollbar = (el) => {
      el.classList.remove('scrollbar-visible');
      el.classList.add('scrollbar-hidden');
    };

    const resetHideTimer = (el) => {
      const existing = hideTimers.get(el);
      if (existing) clearTimeout(existing);
      showScrollbar(el);
      hideTimers.set(el, setTimeout(() => hideScrollbar(el), HIDE_DELAY));
    };

    // Capture scroll events from any element (scroll doesn't bubble, so we use capture phase)
    const handleScroll = (e) => {
      const target = e.target === document ? document.body : e.target;
      if (target && target.nodeType === 1) {
        resetHideTimer(target);
      }
    };

    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  // Enforce global modal lock for any popup implementation pattern in the app.
  useEffect(() => {
    const MODAL_CLASS = "modal-open";
    const MODAL_SELECTOR = ".popup-backdrop, [aria-modal='true'], [data-modal-portal='true']";
    if (typeof document === "undefined") return undefined;

    const updateModalLock = () => {
      const hasModal = Boolean(document.querySelector(MODAL_SELECTOR));
      document.documentElement.classList.toggle(MODAL_CLASS, hasModal);
      document.body.classList.toggle(MODAL_CLASS, hasModal);
    };

    const preventBackgroundScroll = (event) => {
      if (!document.body.classList.contains(MODAL_CLASS)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(MODAL_SELECTOR)) return;
      event.preventDefault();
    };

    updateModalLock();
    const observer = new MutationObserver(updateModalLock);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-modal"] });
    document.addEventListener("wheel", preventBackgroundScroll, { capture: true, passive: false });
    document.addEventListener("touchmove", preventBackgroundScroll, { capture: true, passive: false });

    return () => {
      observer.disconnect();
      document.removeEventListener("wheel", preventBackgroundScroll, true);
      document.removeEventListener("touchmove", preventBackgroundScroll, true);
      document.documentElement.classList.remove(MODAL_CLASS);
      document.body.classList.remove(MODAL_CLASS);
    };
  }, []);

  // getLayout pattern: each page may expose Component.getLayout to control its shell.
  // Default is the persistent <Layout>. Returning the SAME element type across routes
  // keeps the sidebar/topbar mounted and only swaps the inner children.
  const getLayout = Component.getLayout || defaultGetLayout;
  const pageElement = <Component {...pageProps} />;

  return (
    <>
      <RouteProgressBar isRouteLoading={isRouteLoading} />
      <GlobalDraftPersistence />
      <GlobalTableShells />
      {getLayout(pageElement)}
      {!hideNotesWidget && <GlobalNotesWidget />}
      <CookieBanner />
      <DevLayoutOverlayRoot />
    </>
  ); // render the requested page inside its (persistent) layout shell
}

// Top-edge progress bar — drives off the same isRouteLoading flag as the global loader
// so users get instant visual feedback that nav is happening even though the shell stays put.
function RouteProgressBar({ isRouteLoading }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let trickle;
    let hideTimer;
    if (isRouteLoading) {
      setVisible(true);
      setProgress(20);
      trickle = setInterval(() => {
        setProgress((p) => (p < 85 ? p + (90 - p) * 0.1 : p));
      }, 200);
    } else if (visible) {
      setProgress(100);
      hideTimer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 220);
    }
    return () => {
      if (trickle) clearInterval(trickle);
      if (hideTimer) clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRouteLoading]);

  if (!visible) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "2px",
        width: `${progress}%`,
        background: "var(--accent-base, #3b82f6)",
        boxShadow: "0 0 8px var(--accent-base, #3b82f6)",
        transition: "width 200ms ease-out, opacity 220ms ease-out",
        opacity: progress === 100 ? 0 : 1,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    />
  );
}

// Main app entry with all providers composed
export default function MyApp({ Component, pageProps }) {
  return (
    <>
      {/* Pin --font-inter to :root so var(--font-family) (which references it)
          resolves correctly on <body> and every form control that inherits.
          The interFont.className activates next/font's @font-face declaration. */}
      <style dangerouslySetInnerHTML={{ __html: FONT_VARIABLE_STYLE }} />
      <span className={interFont.className} style={{ display: "none" }} aria-hidden="true" />
    <SessionProvider session={pageProps.session}>
      <AlertProvider>
        <ConfirmationProvider>
          <UserProvider>
            <DevLayoutOverlayProvider>
              <DevLayoutRegistryProvider>
                <ThemeProvider defaultMode="system">
                  <SWRConfig value={swrConfig}>
                    <NextActionProvider>
                      <JobsProvider>
                        <ClockingProvider>
                          <RosterProvider initialRosterData={pageProps.initialRosterData}>
                            <AppWrapper Component={Component} pageProps={pageProps} />
                          </RosterProvider>
                        </ClockingProvider>
                      </JobsProvider>
                    </NextActionProvider>
                  </SWRConfig>
                </ThemeProvider>
              </DevLayoutRegistryProvider>
            </DevLayoutOverlayProvider>
          </UserProvider>
        </ConfirmationProvider>
      </AlertProvider>
    </SessionProvider>
    </>
  );
}
