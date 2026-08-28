// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/_app.js
import "@/utils/polyfills"; // ensure polyfills load globally
import "@/utils/quietConsole"; // minimize console noise unless LOG_LEVEL is raised
import "@/styles/theme.css"; // register CSS variables before globals
import "@/styles/staffglobal.css"; // staff/admin app global base styles
// custglobal.css (/website) and trackingMap.css (/tracking) are NOT imported
// here any more. Both were costing 82 KB of render-blocking CSS on all 162
// routes, because anything _app imports lands in the stylesheet every route
// loads — and neither can match anything outside its own routes.
//
// Option (b) from the note that used to sit here is now implemented: they are
// emitted as standalone static assets by tools/scripts/emit-route-scoped-css.js
// and linked only where they apply — from _document.js on first paint (so there
// is no unstyled flash) and from ensureRouteScopedStylesheet() below on client
// navigation into those routes.
import ROUTE_SCOPED_CSS from "@/config/routeScopedCss.generated.json";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import dynamic from "next/dynamic";
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
import { useUser } from "@/context/UserContext";
import { ThemeProvider } from "@/styles/themeProvider";
import { setPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { installFetchInterceptor, restoreFetchInterceptor } from "@/features/presentation/dataLayer/fetchInterceptor";
import { canAccessPath } from "@/lib/auth/pageAccess";
import { hasDevPlatformPageAccess } from "@/lib/auth/devSession";
import { isAllAccessUser } from "@/lib/auth/allAccessSession";
import { rememberStaffRoute } from "@/lib/auth/returnRoute";
import { isPublicVhcReportPath } from "@/config/routeAccess";
import { trace, TRACE_ENABLED } from "@/utils/loadTrace"; // TEMP diagnostic tracer — remove after load flicker is fixed
import { installPerfConsole, startJourney, stage } from "@/lib/perf/stageTimings";
// STATIC, deliberately — see the note above StaffProviders/Layout below.
import StaffProviders from "@/components/App/StaffProviders";
import Layout from "@/components/Layout";

// Keep staff-only providers, shell code and global listeners out of the login
// route's initial JavaScript. These chunks are requested only when rendered.
const GlobalNotesWidget = dynamic(() => import("@/components/GlobalNotesWidget"), { ssr: false });
const CookieBanner = dynamic(() => import("@/components/CookieBanner"), { ssr: false });
const GlobalDraftPersistence = dynamic(() => import("@/components/App/GlobalDraftPersistence"), { ssr: false });
const GlobalTableShells = dynamic(() => import("@/components/App/GlobalTableShells"), { ssr: false });
const DevLayoutOverlayRoot = dynamic(() => import("@/components/dev-layout-overlay/DevLayoutOverlayRoot"), { ssr: false });
const StaffStyleReviewHighlighter = dynamic(() => import("@/components/dev-platform/StaffStyleReviewHighlighter"), { ssr: false });
const GlobalTooltip = dynamic(() => import("@/components/ui/GlobalTooltip"), { ssr: false });
const ActivityTracker = dynamic(() => import("@/components/activity/ActivityTracker"), { ssr: false });
// StaffProviders and Layout are imported STATICALLY (at the top of this file) and
// must stay that way.
//
// They were `dynamic(..., { ssr: true })`, which wraps them in a React.lazy
// boundary. The boundary is server-rendered, but its chunk is not loaded when
// hydration starts: React suspends there, drops the server-rendered chrome out
// of its tree WITHOUT removing it from the DOM, and renders a second chrome
// beside it. The orphan keeps whatever the server painted — always the pre-auth
// shell, i.e. SidebarNavSkeleton — so the user is left looking at a frozen
// skeleton sidebar with the real, fully resolved one behind it. Measured on
// production builds: orphaned shell in 12/12 loads code-split, 0/12 static.
//
// Three alternatives were built and measured before settling here:
//
//   dynamic + ssr:true   correct only by luck (loses the hydration race).
//   dynamic + ssr:false  also 0/12 orphans and keeps /login small, but nothing
//                        is server-rendered any more: /newsfeed FCP 656ms vs
//                        156ms and /profile FCP 740ms vs 144ms, and staff
//                        routes get BIGGER (+80KB) from the extra chunking.
//   static (this)        0/12 orphans, fastest staff routes.
//
// The cost is real and lands on /login, which no longer code-splits the shell
// away: first-load JS 325KB -> 444KB (+119KB transferred), hydration 338ms ->
// 448ms. FCP/LCP there are unchanged within noise (168ms vs 184ms). Staff
// routes — where users actually spend the day — are better off on every metric:
// FCP -500ms (/newsfeed) and -596ms (/profile), LCP -80ms and -176ms, and 80KB
// less JavaScript. Sign-in happens once; the shell renders on every page.
const RouteProgressBar = dynamic(() => import("@/components/layout/RouteProgressBar"), { ssr: false });

// Default page layout: every page is wrapped by the persistent <Layout>. Pages that
// need custom layout props (jobNumber, requiresLandscape, disableContentCardHover,
// contentBackground, disableContentCard) override Page.getLayout themselves. Returning
// the same <Layout> element type across navigations lets React keep the shell mounted
// — only the inner children swap.
const defaultGetLayout = (page) => <Layout>{page}</Layout>;

const isWebsitePath = (path = "") => path === "/website" || path.startsWith("/website/");
const isTrackingPath = (path = "") => path === "/tracking" || path.startsWith("/tracking/");

// Add a route-scoped stylesheet once, if it is not already in the document.
//
// _document.js emits the same <link> (same href) server-side for a direct hit on
// one of these routes, so on a first paint this finds it already present and does
// nothing. It only actually inserts anything when the user arrives by client-side
// navigation from another route, where no new document is rendered.
//
// The link is deliberately never removed: it is a handful of KB, it keeps a
// return visit to the route instant, and removing it mid-session risks
// unstyling a page that is still animating out.
const ensureRouteScopedStylesheet = (key) => {
  if (typeof document === "undefined") return;
  const href = ROUTE_SCOPED_CSS?.[key];
  if (!href) return;
  if (document.querySelector(`link[data-route-css="${key}"]`)) return;
  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute("data-route-css", key);
  document.head.appendChild(link);
};
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
  const asPathClean = (asPathWithoutQuery.split("#")[0] || "").replace(/\/$/, "") || "/";
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
  const isPublicVhcReportRoute =
    isPublicVhcReportPath(pathname) ||
    isPublicVhcReportPath(asPathClean) ||
    Component.hideGlobalNotesWidget === true;
  const isWebsiteRoute = isWebsitePath(pathname) || isWebsitePath(asPathWithoutQuery);
  const isTrackingRoute = isTrackingPath(pathname) || isTrackingPath(asPathWithoutQuery);
  const isDevRoute = pathname === "/dev" || pathname.startsWith("/dev/") || asPathWithoutQuery === "/dev" || asPathWithoutQuery.startsWith("/dev/");
  const hideNotesWidget =
    isPresentationRoute ||
    isCustomerRoute ||
    isPublicVhcReportRoute ||
    isWebsiteRoute ||
    notesHiddenRoutes.has(pathname) ||
    notesHiddenRoutes.has(asPathWithoutQuery);

  // Stage timing for the journeys users actually feel. Installs `hnpPerf()` in
  // the console and marks each client navigation so route-change time can be
  // separated from data time and from API/database time (the latter comes from
  // the Server-Timing headers the hot endpoints now emit).
  useEffect(() => {
    installPerfConsole();
    stage("app:mounted");
  }, []);

  useEffect(() => {
    if (!router?.events) return undefined;
    const onStart = (url) => startJourney(`nav ${url}`);
    const onComplete = () => stage("nav:routeChangeComplete");
    router.events.on("routeChangeStart", onStart);
    router.events.on("routeChangeComplete", onComplete);
    return () => {
      router.events.off("routeChangeStart", onStart);
      router.events.off("routeChangeComplete", onComplete);
    };
  }, [router]);

  // Route-owned global style scopes. Next loads global CSS from _app only, so
  // the route decides which global family is active by toggling root classes:
  // staffglobal.css applies under html.staff-scope, custglobal.css applies
  // under html.website-scope.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    // Attach the route's own stylesheet before flipping its scope class, so the
    // rules exist by the time the selector they hang off starts matching.
    if (isWebsiteRoute) ensureRouteScopedStylesheet("website");
    if (isTrackingRoute) ensureRouteScopedStylesheet("trackingMap");
    const root = document.documentElement;
    const body = document.body;
    root.classList.toggle("website-scope", isWebsiteRoute);
    root.classList.toggle("staff-scope", !isWebsiteRoute);
    root.classList.toggle("dev-scope", isDevRoute);
    body?.classList.toggle("website-scope", isWebsiteRoute);
    body?.classList.toggle("staff-scope", !isWebsiteRoute);
    body?.classList.toggle("dev-scope", isDevRoute);
    return undefined;
  }, [isWebsiteRoute, isTrackingRoute, isDevRoute]);

  // Install / restore the /api/* fetch interceptor based on whether we're on a
  // /presentation/* route. Real routes always get the original window.fetch.
  useEffect(() => {
    if (isPresentationRoute) {
      installFetchInterceptor();
      // The demo fixtures behind the supabase presentation stub are loaded
      // lazily (see features/presentation/dataLayer/queryRouter.js) so they stay
      // out of every real route's bundle. Warm them the moment a demo route is
      // entered so the first stubbed query does not wait on the chunk.
      void import("@/features/presentation/dataLayer/queryRouter").then((mod) =>
        mod.preloadPresentationFixtures?.()
      );
    } else {
      restoreFetchInterceptor();
    }
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
    // Development-only: clears the console and the persisted trace buffer so a
    // fresh boot starts clean. Skipped in production, where the tracer is a
    // no-op and wiping the user's console would be user-hostile.
    if (!TRACE_ENABLED) return;
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
    // Development-only navigation timeline. In production this installed nine
    // global listeners (including a capture-phase document click handler that
    // called console.clear() on every link click) purely to feed a tracer that
    // is itself disabled there.
    if (!TRACE_ENABLED) return undefined;

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
      const wasCancelled = Boolean(err?.cancelled);
      logElapsed(wasCancelled ? "routeChangeCancelled" : "routeChangeError", {
        url,
        error: String(err?.message || err),
        stack: err?.stack ? String(err.stack).split("\n").slice(0, 4) : undefined,
      });
      native.log(
        wasCancelled
          ? `%c[NAV] cancelled — a newer navigation took over`
          : `%c[NAV] error — copy(window.__hnpTrace) for full trace`,
        wasCancelled ? "color:#888; font-weight:600" : "color:#c33; font-weight:600"
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

    // Route bundles here are large (0.7-2.7MB uncompressed). Prefetching on a
    // bare `mouseover` meant that sweeping the cursor down the sidebar fired a
    // prefetch for every link it crossed, downloading and parsing dozens of
    // route bundles the user never asked for. Two guards fix that without
    // losing the instant-navigation benefit:
    //   1. hover must be SUSTAINED (HOVER_INTENT_MS) before it counts as intent;
    //      pointerdown / touchstart / focusin are real intent and fire at once.
    //   2. a session cap, so an unusual interaction pattern cannot queue an
    //      unbounded number of bundle downloads.
    const HOVER_INTENT_MS = 150;
    const MAX_PREFETCHED_ROUTES = 12;
    let hoverTimer = null;

    const prefetchRoute = (eventOrHref) => {
      const href = typeof eventOrHref === "string" ? eventOrHref : getInternalHref(eventOrHref);
      if (!href) return;
      if (prefetchedRoutes.has(href)) return;
      if (prefetchedRoutes.size >= MAX_PREFETCHED_ROUTES) return;
      prefetchedRoutes.add(href);
      Promise.resolve(router.prefetch?.(href)).catch(() => {
        prefetchedRoutes.delete(href);
      });
    };

    const clearHoverIntent = () => {
      if (hoverTimer) {
        window.clearTimeout(hoverTimer);
        hoverTimer = null;
      }
    };

    const onHover = (event) => {
      const href = getInternalHref(event);
      clearHoverIntent();
      if (!href) return;
      hoverTimer = window.setTimeout(() => {
        hoverTimer = null;
        prefetchRoute(href);
      }, HOVER_INTENT_MS);
    };

    // Intent-based prefetch only. Navigation itself is handled by Next's <Link>
    // so router.asPath updates optimistically and the sidebar's active state
    // flips on click without waiting for the new page to finish loading.
    document.addEventListener("mouseover", onHover, true);
    document.addEventListener("mouseout", clearHoverIntent, true);
    document.addEventListener("focusin", prefetchRoute, true);
    document.addEventListener("touchstart", prefetchRoute, true);
    document.addEventListener("pointerdown", prefetchRoute, true);

    return () => {
      clearHoverIntent();
      document.removeEventListener("mouseover", onHover, true);
      document.removeEventListener("mouseout", clearHoverIntent, true);
      document.removeEventListener("focusin", prefetchRoute, true);
      document.removeEventListener("touchstart", prefetchRoute, true);
      document.removeEventListener("pointerdown", prefetchRoute, true);
    };
  }, [router]);

  // REMOVED: the global show-scrollbar-on-scroll handler.
  //
  // It bound a capture-phase `scroll` listener on `document` (catching every
  // scroll event from every scroller in the app), kept a WeakMap of per-element
  // timers, and toggled `.scrollbar-visible` / `.scrollbar-hidden` classes —
  // class mutations that then woke the document-wide modal-lock MutationObserver
  // below.
  //
  // Those two classes have no visual effect: staffglobal.css ends with
  // `html.staff-scope * { scrollbar-width: none !important }` and
  // `html.staff-scope *::-webkit-scrollbar { display: none !important }`, which
  // hide scrollbar chrome on every element. `.scrollbar-visible` only re-declares
  // `scrollbar-color`, so the bar it colours is never rendered. Scrollbar chrome
  // is opted back in per-container (.app-table-shell-scroll /
  // [data-app-table-shell-scroll]) and does not depend on these classes.

  // Enforce global modal lock for any popup implementation pattern in the app.
  useEffect(() => {
    const MODAL_CLASS = "modal-open";
    const MODAL_SELECTOR = ".popup-backdrop, [aria-modal='true'], [data-modal-portal='true']";
    if (typeof document === "undefined") return undefined;

    const preventBackgroundScroll = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(MODAL_SELECTOR)) return;
      event.preventDefault();
    };

    // The wheel/touchmove blockers must be non-passive to call preventDefault,
    // which forces the browser to wait on JS for every scroll gesture. They used
    // to be attached for the whole session and no-op'd on a class check. Attach
    // them only while a modal is actually open, so ordinary page scrolling is
    // never gated on a listener that has nothing to do.
    let scrollBlockersAttached = false;
    const attachScrollBlockers = () => {
      if (scrollBlockersAttached) return;
      scrollBlockersAttached = true;
      document.addEventListener("wheel", preventBackgroundScroll, { capture: true, passive: false });
      document.addEventListener("touchmove", preventBackgroundScroll, { capture: true, passive: false });
    };
    const detachScrollBlockers = () => {
      if (!scrollBlockersAttached) return;
      scrollBlockersAttached = false;
      document.removeEventListener("wheel", preventBackgroundScroll, true);
      document.removeEventListener("touchmove", preventBackgroundScroll, true);
    };

    const updateModalLock = () => {
      const hasModal = Boolean(document.querySelector(MODAL_SELECTOR));
      document.documentElement.classList.toggle(MODAL_CLASS, hasModal);
      document.body.classList.toggle(MODAL_CLASS, hasModal);
      if (hasModal) attachScrollBlockers();
      else detachScrollBlockers();
    };

    // The observer watches the whole body subtree, so it fires for every React
    // commit that touches a class anywhere on the page — frequently on the
    // realtime-driven job tables. Coalesce a burst of mutations into a single
    // document-wide querySelector per animation frame.
    let lockFrame = 0;
    const scheduleModalLockUpdate = () => {
      if (lockFrame) return;
      lockFrame = window.requestAnimationFrame(() => {
        lockFrame = 0;
        updateModalLock();
      });
    };

    updateModalLock();
    const observer = new MutationObserver(scheduleModalLockUpdate);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-modal"] });

    return () => {
      observer.disconnect();
      if (lockFrame) window.cancelAnimationFrame(lockFrame);
      detachScrollBlockers();
      document.documentElement.classList.remove(MODAL_CLASS);
      document.body.classList.remove(MODAL_CLASS);
    };
  }, []);

  // getLayout pattern: each page may expose Component.getLayout to control its shell.
  // Default is the persistent <Layout>. Returning the SAME element type across routes
  // keeps the sidebar/topbar mounted and only swaps the inner children.
  const getLayout = Component.getLayout || defaultGetLayout;
  const pageElement = <Component {...pageProps} />;

  // Customer-facing surfaces (the public website, the customer portal, and the
  // public VHC report links) render none of the staff chrome, so the staff-only
  // global helpers below have nothing to act on there. They are not free,
  // though: GlobalTableShells installs a document-wide MutationObserver plus
  // mousemove/scroll/resize listeners for staff data tables, and
  // GlobalDraftPersistence tracks staff form drafts. Skipping them keeps the
  // customer pages off those listeners entirely.
  const isCustomerFacingSurface = isWebsiteRoute || isCustomerRoute || isPublicVhcReportRoute;

  return (
    <>
      <RouteProgressBar />
      {!isCustomerFacingSurface && <GlobalDraftPersistence />}
      {!isCustomerFacingSurface && <GlobalTableShells />}
      <PageAccessGuard pathname={pathname} />
      {getLayout(pageElement)}
      {!hideNotesWidget && <GlobalNotesWidget />}
      <CookieBanner />
      <GlobalTooltip />
      {!isCustomerFacingSurface && <DevLayoutOverlayRoot />}
      {/* Renders nothing unless a Staff Style Review "Search" link put
          ?styleReviewHighlight= on the URL. */}
      {!isCustomerFacingSurface && <StaffStyleReviewHighlighter />}
    </>
  ); // render the requested page inside its (persistent) layout shell
}

// Redirects unauthorised users back to /newsfeed whenever the route
// changes (or on first paint). Pages reachable via the user's filtered
// sidebar/topbar are allowed; everything else is rejected. See
// src/lib/auth/pageAccess.js for the rule.
function PageAccessGuard({ pathname }) {
  const router = useRouter();
  const { user, loading, sidebarAccessReady } = useUser();
  useEffect(() => {
    if (loading) return; // wait for user context to resolve
    if (!user) return; // unauthenticated → existing auth guards handle redirect
    // Developer Platform login only: it must be able to land on every page so
    // audits (Staff Style Review, layout overlay) can run against the real
    // screens. It gains no roles, so its own sidebar/nav is unchanged.
    if (hasDevPlatformPageAccess(user)) return;
    // All Access demo login: same reasoning. Every page in its sidebar already
    // passes canAccessPath below; this keeps it consistent with the edge guard
    // and ProtectedRoute, which also let this synthetic session through.
    if (isAllAccessUser(user)) return;
    // Skip the guard while the user is still being hydrated or on routes
    // that always exit through their own auth flow.
    if (canAccessPath(pathname, user?.roles, user?.sidebarAccess)) {
      // This route has just been authorised for this user, so it is safe to
      // offer back on a cold start that arrives with no route of its own (a
      // pinned "/" tab, a bookmarked /login). Recorded only once the per-user
      // sidebar-access snapshot has resolved — before that canAccessPath is
      // running on the broader role-derived set, and remembering then could
      // store a route the snapshot goes on to deny. `pathname` is the route
      // PATTERN the check needs; asPath is the real URL worth returning to.
      if (sidebarAccessReady) rememberStaffRoute(user.id, router.asPath);
      return;
    }
    if (router.pathname === "/newsfeed") return;
    router.replace("/newsfeed");
  }, [pathname, user, loading, router, sidebarAccessReady]);
  return null;
}

function LightweightLoginScope({ children }) {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.remove("website-scope", "dev-scope");
    root.classList.add("staff-scope");
    body.classList.remove("website-scope", "dev-scope");
    body.classList.add("staff-scope");
    restoreFetchInterceptor();
  }, []);

  return children;
}

// Main app entry with all providers composed
export default function MyApp({ Component, pageProps }) {
  const isLightweightLogin = Component.lightweightApp === true;
  const loginPage = <Component {...pageProps} />;

  return (
    <>
      {/* Pin --font-inter to :root so var(--font-family) (which references it)
          resolves correctly on <body> and every form control that inherits.
          The interFont.className activates next/font's @font-face declaration. */}
      <style dangerouslySetInnerHTML={{ __html: FONT_VARIABLE_STYLE }} />
      <span className={interFont.className} style={{ display: "none" }} aria-hidden="true" />
      <SessionProvider session={pageProps.session}>
          {isLightweightLogin ? (
            <ThemeProvider defaultMode="system">
            <LightweightLoginScope>{loginPage}</LightweightLoginScope>
            </ThemeProvider>
          ) : (
            <>
              <ActivityTracker />
              <StaffProviders initialRosterData={pageProps.initialRosterData}>
                <AppWrapper Component={Component} pageProps={pageProps} />
              </StaffProviders>
            </>
          )}
      </SessionProvider>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
