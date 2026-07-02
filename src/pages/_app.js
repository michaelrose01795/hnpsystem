// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/_app.js
import "@/utils/polyfills"; // ensure polyfills load globally
import "@/utils/quietConsole"; // minimize console noise unless LOG_LEVEL is raised
import "@/styles/theme.css"; // register CSS variables before globals
import "@/styles/staffglobal.css"; // staff/admin app global base styles
import "@/styles/custglobal.css"; // /website customer overrides (gated by html.website-scope)
import "@/features/tracking/map/trackingMap.css"; // /tracking site-map diagram (Pages Router requires plain-CSS imports here)
import { Inter } from "next/font/google";
import React, { useEffect } from "react"; // import React helpers

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
import { SupportDiagnosticsProvider } from "@/context/SupportReportContext";
import SupportErrorBoundary from "@/components/support/SupportErrorBoundary";
import GlobalNotesWidget from "@/components/GlobalNotesWidget";
import CookieBanner from "@/components/CookieBanner";
import GlobalDraftPersistence from "@/components/App/GlobalDraftPersistence";
import GlobalTableShells from "@/components/App/GlobalTableShells";
import DevLayoutOverlayRoot from "@/components/dev-layout-overlay/DevLayoutOverlayRoot";
import GlobalTooltip from "@/components/ui/GlobalTooltip";
import { SWRConfig } from "swr"; // global SWR cache and revalidation config
import { swrConfig } from "@/lib/swr/config"; // HNP-tuned SWR defaults
import Layout from "@/components/Layout"; // persistent app shell — mounted once via getLayout
import RouteProgressBar from "@/components/layout/RouteProgressBar"; // instant top-bar feedback on route change
import { setPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { installFetchInterceptor, restoreFetchInterceptor } from "@/features/presentation/dataLayer/fetchInterceptor";
import { useUser } from "@/context/UserContext";
import { canAccessPath } from "@/lib/auth/pageAccess";
import { trace } from "@/utils/loadTrace"; // TEMP diagnostic tracer — remove after load flicker is fixed

// Default page layout: every page is wrapped by the persistent <Layout>. Pages that
// need custom layout props (jobNumber, requiresLandscape, disableContentCardHover,
// contentBackground, disableContentCard) override Page.getLayout themselves. Returning
// the same <Layout> element type across navigations lets React keep the shell mounted
// — only the inner children swap.
const defaultGetLayout = (page) => <Layout>{page}</Layout>;

const isWebsitePath = (path = "") => path === "/website" || path.startsWith("/website/");
const isAllowedPresentationNavigation = (url = "") => {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (typeof window !== "undefined" && parsed.origin !== window.location.origin) return false;
    return parsed.pathname.startsWith("/presentation/") || parsed.pathname === "/presentation" || parsed.pathname === "/loginPresentation";
  } catch {
    return url.startsWith("/presentation/") || url === "/presentation" || url.startsWith("/loginPresentation");
  }
};

function AppWrapper({ Component, pageProps }) {
  const router = useRouter();
  const pathname = router?.pathname || "";
  const asPath = router?.asPath || "";
  const asPathWithoutQuery = asPath.split("?")[0] || "";
  // Toggle the presentation-mode runtime flag synchronously on every render
  // so that the very first DB call inside a /presentation/* route already
  // sees the flag and routes through the mock data layer. The flag setter
  // short-circuits when the value hasn't changed.
  const isPresentationRoute = pathname.startsWith("/presentation");
  if (typeof window !== "undefined") setPresentationMode(isPresentationRoute);
  const notesHiddenRoutes = new Set(["/", "/login", "/presentation"]);
  // Customer PORTAL route only (singular "/customer"). Must not match the
  // staff-side "/customers" (plural) pages — those are normal staff pages and
  // should keep the floating notes widget like any other staff page.
  const isCustomerRoute = pathname === "/customer" || pathname.startsWith("/customer/");
  const isWebsiteRoute = isWebsitePath(pathname) || isWebsitePath(asPathWithoutQuery);
  const hideNotesWidget =
    isPresentationRoute ||
    isCustomerRoute ||
    isWebsiteRoute ||
    notesHiddenRoutes.has(pathname) ||
    notesHiddenRoutes.has(asPathWithoutQuery);

  // Route-owned global style scopes. Next loads global CSS from _app only, so
  // the route decides which global family is active by toggling root classes:
  // staffglobal.css applies under html.staff-scope, custglobal.css applies
  // under html.website-scope.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    const body = document.body;
    root.classList.toggle("website-scope", isWebsiteRoute);
    root.classList.toggle("staff-scope", !isWebsiteRoute);
    body?.classList.toggle("website-scope", isWebsiteRoute);
    body?.classList.toggle("staff-scope", !isWebsiteRoute);
    return undefined;
  }, [isWebsiteRoute]);

  // Install / restore the /api/* fetch interceptor based on whether we're on a
  // /presentation/* route. Real routes always get the original window.fetch.
  useEffect(() => {
    if (isPresentationRoute) installFetchInterceptor();
    else restoreFetchInterceptor();
    return () => restoreFetchInterceptor();
  }, [isPresentationRoute]);

  // Presentation mode is a closed demo surface. Real app page actions may still
  // contain ordinary links/buttons; keep them from navigating out to live routes
  // where the normal data layer would be active again.
  useEffect(() => {
    if (!isPresentationRoute || typeof document === "undefined") return undefined;

    const blockLiveRouteClick = (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (isAllowedPresentationNavigation(href)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("click", blockLiveRouteClick, true);
    return () => document.removeEventListener("click", blockLiveRouteClick, true);
  }, [isPresentationRoute]);

  useEffect(() => {
    if (!isPresentationRoute) return undefined;
    const blockLiveRouteChange = (url) => {
      if (isAllowedPresentationNavigation(url)) return;
      router.events.emit("routeChangeError", new Error("Presentation mode blocked live route navigation"), url, { shallow: false });
      throw "Presentation mode blocked live route navigation";
    };
    router.events.on("routeChangeStart", blockLiveRouteChange);
    return () => router.events.off("routeChangeStart", blockLiveRouteChange);
  }, [isPresentationRoute, router.events]);

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

  // TEMP diagnostic: mark each fresh document/app boot. Also clear any
  // leftover console output and trace buffer so F12 starts clean.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const native = globalThis.__HNP_NATIVE_CONSOLE__ || console;
      try {
        native.clear?.();
      } catch {
        // ignore
      }
      try {
        window.sessionStorage.removeItem("hnp-trace-buffer");
      } catch {
        // ignore
      }
      window.__hnpTrace = [];
    }
    trace("boot", "app shell mounted");
  }, []);

  // Navigation diagnostics — clears the F12 console at each new navigation
  // and prints a fresh timeline so the user can copy the events for one nav
  // in isolation. Tracks: link click, prefetch, every router event, page
  // mount, errors, history popstate. Hint after each completed nav:
  //   copy(window.__hnpTrace)   to grab the full timeline
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const native =
      (typeof globalThis !== "undefined" && globalThis.__HNP_NATIVE_CONSOLE__) || console;

    let navStartedAt = null;
    let navTargetHref = null;

    const beginNavigationLog = (sourceLabel, href) => {
      navStartedAt =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      navTargetHref = href || null;
      try {
        native.clear?.();
      } catch {
        // ignore
      }
      native.log(
        `%c[NAV] ${sourceLabel} → ${href || "(unknown)"}`,
        "color:#fff;background:#0b66ff;padding:2px 6px;border-radius:3px;font-weight:600"
      );
      native.log(
        `[NAV] from ${window.location.pathname}${window.location.search}`
      );
      trace("nav", `${sourceLabel} → ${href || "(unknown)"}`, {
        from: window.location.pathname + window.location.search,
      });
    };

    const logElapsed = (label, data) => {
      if (navStartedAt == null) {
        trace("nav", label, data);
        return;
      }
      const ms =
        ((typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now()) - navStartedAt) | 0;
      trace("nav", `+${ms}ms ${label}`, data);
    };

    const describeAnchor = (anchor) => {
      if (!anchor) return null;
      const href = anchor.getAttribute("href") || "(no-href)";
      const text = (anchor.textContent || "").trim().slice(0, 60);
      const inSidebar = !!anchor.closest?.(".app-sidebar");
      return { href, text, inSidebar };
    };

    const onLinkClickCapture = (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor) return;
      const info = describeAnchor(anchor);
      // Don't reset the log for in-page hash/external/new-tab clicks.
      const href = info?.href || "";
      const isInternalNav =
        href &&
        !href.startsWith("#") &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:") &&
        (!anchor.target || anchor.target === "_self") &&
        !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) &&
        (event.button == null || event.button === 0);

      if (!isInternalNav) {
        trace("nav", "anchor click ignored (modifier/external/new-tab)", info);
        return;
      }
      beginNavigationLog(
        info.inSidebar ? "sidebar click" : "link click",
        href
      );
      trace("nav", "click default-prevented?", { defaultPrevented: event.defaultPrevented });
      // Schedule a follow-up check — if routeChangeStart never fires within
      // ~150ms after a same-origin internal click, something swallowed the
      // navigation. That gap is the smoking gun for "click does nothing".
      setTimeout(() => {
        if (navTargetHref === href && navStartedAt != null) {
          // routeChangeStart resets navStartedAt by re-calling beginNavigationLog
          // only if we go through onRouteStart path. We use a separate flag.
        }
      }, 0);
    };

    const onRouteStart = (url, options) => {
      if (!navStartedAt) beginNavigationLog("router.start", url);
      logElapsed("routeChangeStart", { url, shallow: !!options?.shallow });
    };
    const onRouteComplete = (url) => {
      logElapsed("routeChangeComplete", url);
      native.log(
        `%c[NAV] done — copy(window.__hnpTrace) to copy this timeline`,
        "color:#0a7; font-weight:600"
      );
      navStartedAt = null;
      navTargetHref = null;
    };
    const onRouteError = (err, url) => {
      logElapsed("routeChangeError", {
        url,
        error: String(err?.message || err),
        stack: err?.stack ? String(err.stack).split("\n").slice(0, 4) : undefined,
      });
      native.log(
        `%c[NAV] error — copy(window.__hnpTrace) for full trace`,
        "color:#c33; font-weight:600"
      );
      navStartedAt = null;
      navTargetHref = null;
    };
    const onBeforeHistoryChange = (url) => logElapsed("beforeHistoryChange", url);
    const onHashChangeStart = (url) => logElapsed("hashChangeStart", url);
    const onHashChangeComplete = (url) => logElapsed("hashChangeComplete", url);

    const onPopState = (event) => {
      beginNavigationLog("popstate", window.location.pathname + window.location.search);
      logElapsed("popstate", { state: !!event.state });
    };

    const onWindowError = (event) => {
      if (navStartedAt == null) return;
      logElapsed("window.error", {
        message: event?.message,
        source: event?.filename,
        line: event?.lineno,
        col: event?.colno,
        error: event?.error?.stack
          ? String(event.error.stack).split("\n").slice(0, 4)
          : undefined,
      });
    };
    const onUnhandledRejection = (event) => {
      if (navStartedAt == null) return;
      logElapsed("unhandledrejection", {
        reason: String(event?.reason?.message || event?.reason || "unknown"),
      });
    };

    document.addEventListener("click", onLinkClickCapture, true);
    router.events.on("routeChangeStart", onRouteStart);
    router.events.on("routeChangeComplete", onRouteComplete);
    router.events.on("routeChangeError", onRouteError);
    router.events.on("beforeHistoryChange", onBeforeHistoryChange);
    router.events.on("hashChangeStart", onHashChangeStart);
    router.events.on("hashChangeComplete", onHashChangeComplete);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    native.log(
      `%c[NAV] diagnostics installed — F12 will clear at each click`,
      "color:#888"
    );

    return () => {
      document.removeEventListener("click", onLinkClickCapture, true);
      router.events.off("routeChangeStart", onRouteStart);
      router.events.off("routeChangeComplete", onRouteComplete);
      router.events.off("routeChangeError", onRouteError);
      router.events.off("beforeHistoryChange", onBeforeHistoryChange);
      router.events.off("hashChangeStart", onHashChangeStart);
      router.events.off("hashChangeComplete", onHashChangeComplete);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [router.events]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;
    const prefetchedRoutes = new Set();

    const getInternalHref = (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor) return null;
      if (anchor.target && anchor.target !== "_self") return null;
      if (anchor.hasAttribute("download")) return null;
      const rawHref = anchor.getAttribute("href") || "";
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:")
      ) {
        return null;
      }

      try {
        const parsed = new URL(rawHref, window.location.origin);
        if (parsed.origin !== window.location.origin) return null;
        const targetPath = `${parsed.pathname}${parsed.search}`;
        const currentPath = `${window.location.pathname}${window.location.search}`;
        if (targetPath === currentPath) return null;
        return targetPath;
      } catch {
        return null;
      }
    };

    const prefetchRoute = (eventOrHref) => {
      const href = typeof eventOrHref === "string" ? eventOrHref : getInternalHref(eventOrHref);
      if (!href) return;
      if (prefetchedRoutes.has(href)) return;
      prefetchedRoutes.add(href);
      Promise.resolve(router.prefetch?.(href)).catch(() => {
        prefetchedRoutes.delete(href);
      });
    };

    // Intent-based prefetch only. Navigation itself is handled by Next's <Link>
    // so router.asPath updates optimistically and the sidebar's active state
    // flips on click without waiting for the new page to finish loading.
    document.addEventListener("mouseover", prefetchRoute, true);
    document.addEventListener("focusin", prefetchRoute, true);
    document.addEventListener("touchstart", prefetchRoute, true);
    document.addEventListener("pointerdown", prefetchRoute, true);

    return () => {
      document.removeEventListener("mouseover", prefetchRoute, true);
      document.removeEventListener("focusin", prefetchRoute, true);
      document.removeEventListener("touchstart", prefetchRoute, true);
      document.removeEventListener("pointerdown", prefetchRoute, true);
    };
  }, [router]);

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
      <RouteProgressBar />
      <GlobalDraftPersistence />
      <GlobalTableShells />
      <PageAccessGuard pathname={pathname} />
      {getLayout(pageElement)}
      {!hideNotesWidget && <GlobalNotesWidget />}
      <CookieBanner />
      <GlobalTooltip />
      <DevLayoutOverlayRoot />
    </>
  ); // render the requested page inside its (persistent) layout shell
}

// Redirects unauthorised users back to /newsfeed whenever the route
// changes (or on first paint). Pages reachable via the user's filtered
// sidebar/topbar are allowed; everything else is rejected. See
// src/lib/auth/pageAccess.js for the rule.
function PageAccessGuard({ pathname }) {
  const router = useRouter();
  const { user, loading } = useUser();
  useEffect(() => {
    if (loading) return; // wait for user context to resolve
    if (!user) return; // unauthenticated → existing auth guards handle redirect
    // Skip the guard while the user is still being hydrated or on routes
    // that always exit through their own auth flow.
    if (canAccessPath(pathname, user?.roles)) return;
    if (router.pathname === "/newsfeed") return;
    router.replace("/newsfeed");
  }, [pathname, user, loading, router]);
  return null;
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
                            <SupportDiagnosticsProvider>
                              {/* App-wide Help & Diagnostics error boundary (Phase 4).
                                  hostSupportModal: the boundary hosts the report popup
                                  when the shell (and its StaffTopbar host) is unmounted. */}
                              <SupportErrorBoundary hostSupportModal>
                                <AppWrapper Component={Component} pageProps={pageProps} />
                              </SupportErrorBoundary>
                            </SupportDiagnosticsProvider>
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
