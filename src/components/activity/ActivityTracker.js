import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import {
  clearAuditSession,
  createClientAuditId,
  endCurrentAuditSession,
  getClientAuditSessionId,
  getServerAuditSessionId,
  setClientAuditSessionId,
  setServerAuditSessionId,
} from "@/lib/audit/client";
import {
  detectAppMode,
  getClientDeviceHints,
} from "@/lib/audit/device";
import {
  extractSafeMutationMetadata,
  sanitiseActionLabel,
  sanitiseRoute,
} from "@/lib/audit/privacy";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";

const HEARTBEAT_MS = 60_000;
const FLUSH_MS = 2_000;
const ACTIVITY_THROTTLE_MS = 30_000;
const CLICK_DEDUPE_MS = 800;
const PAGE_REFRESH_DEDUPE_MS = 15_000;
const PAGE_STATE_KEY = "hnp:audit:page-state";
const PENDING_LOGOUT_STORAGE_KEY = "hnp-pending-logout";

const featureFromRoute = (route = "") => route.split("/").filter(Boolean)[0] || "application";

const inferRecord = (element, route = "") => {
  const explicitType = element?.closest?.("[data-audit-record-type]")?.dataset?.auditRecordType;
  const explicitId = element?.closest?.("[data-audit-record-id]")?.dataset?.auditRecordId;
  if (explicitType || explicitId) return { recordType: explicitType || null, recordId: explicitId || null };
  const patterns = [
    [/\/job-cards\/([^/?#]+)/, "job_card"],
    [/\/customers\/([^/?#]+)/, "customer"],
    [/\/accounts\/invoices\/([^/?#]+)/, "invoice"],
    [/\/deliveries\/([^/?#]+)/, "delivery"],
    [/\/goods-in\/([^/?#]+)/, "goods_in"],
  ];
  for (const [pattern, type] of patterns) {
    const match = route.match(pattern);
    if (match) return { recordType: type, recordId: decodeURIComponent(match[1]) };
  }
  return { recordType: null, recordId: null };
};

const inferActionCategory = (label = "", element) => {
  const explicit = element?.closest?.("[data-audit-category]")?.dataset?.auditCategory;
  if (explicit) return explicit;
  if (/login|logout|sign in|sign out/i.test(label)) return "authentication";
  if (/export|download|print/i.test(label)) return "export";
  if (/delete|remove|archive|deactivate/i.test(label)) return "delete";
  if (/save|update|edit|change|assign|approve|decline|clock|create|add|send|upload/i.test(label)) {
    return "record_change";
  }
  if (element?.closest?.("a[href]")) return "navigation";
  return "interaction";
};

const readBodyMetadata = (body) => {
  if (typeof body !== "string" || body.length > 100_000) return {};
  try {
    return extractSafeMutationMetadata(JSON.parse(body));
  } catch {
    return {};
  }
};

export default function ActivityTracker() {
  const router = useRouter();

  // The main effect below opens the audit session, installs the fetch
  // interceptor and subscribes to route events. It only ever reads
  // `router.asPath` (lazily, at event time) and `router.events` (a stable
  // emitter), but having `router` in its dependency array made the whole thing
  // tear down and re-run every time useRouter() handed back a new object — which
  // it does during hydration and on every navigation. Each re-run POSTed
  // /api/audit/session again: measured against production, up to 3 identical
  // session starts and 2 duplicate /api/audit/events per page load, creating
  // duplicate audit session rows as well as the wasted round trips.
  //
  // Reading through a ref keeps `asPath` current without making the effect
  // depend on the object's identity.
  const routerRef = useRef(router);
  routerRef.current = router;
  const { data: session, status } = useSession();
  const serverSessionRef = useRef(null);
  const pageRef = useRef(null);
  const queueRef = useRef([]);
  const flushTimerRef = useRef(null);
  const nativeFetchRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const lastClickRef = useRef({ signature: "", at: 0 });

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      status !== "authenticated" ||
      isPresentationMode()
    ) return undefined;
    nativeFetchRef.current = window.fetch.bind(window);
    let cancelled = false;

    const flush = async () => {
      if (!queueRef.current.length || !serverSessionRef.current || !nativeFetchRef.current) return;
      const events = queueRef.current.splice(0, 50);
      try {
        const response = await nativeFetchRef.current("/api/audit/events", {
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: serverSessionRef.current, events }),
        });
        if (!response.ok && response.status !== 409) queueRef.current.unshift(...events);
      } catch {
        queueRef.current.unshift(...events);
      }
    };

    const scheduleFlush = () => {
      if (flushTimerRef.current) return;
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        void flush();
      }, FLUSH_MS);
    };

    const enqueue = (event) => {
      if (!serverSessionRef.current || !event?.eventName) return;
      queueRef.current.push({
        occurredAt: new Date().toISOString(),
        outcome: "success",
        ...event,
      });
      if (queueRef.current.length >= 20) void flush();
      else scheduleFlush();
    };

    const closePage = (reason = "navigation") => {
      const page = pageRef.current;
      if (!page) return;
      const leftAt = new Date();
      enqueue({
        eventName: "page_left",
        actionCategory: "navigation",
        feature: featureFromRoute(page.route),
        route: page.route,
        pageTitle: page.title,
        previousPage: page.previousPage,
        pageEnteredAt: page.enteredAt,
        pageLeftAt: leftAt.toISOString(),
        durationMs: Math.max(0, leftAt.getTime() - new Date(page.enteredAt).getTime()),
        actionLabel: reason,
        dedupeKey: `page-left:${page.route}:${page.enteredAt}`,
      });
      pageRef.current = null;
    };

    const openPage = (rawRoute, { force = false } = {}) => {
      const route = sanitiseRoute(rawRoute || window.location.pathname) || "/";
      if (route === "/presentation" || route.startsWith("/presentation/")) return;
      const title = document.title || route;
      const now = new Date();
      const stored = (() => {
        try {
          return JSON.parse(window.sessionStorage.getItem(PAGE_STATE_KEY) || "null");
        } catch {
          return null;
        }
      })();
      const isRapidRefresh =
        !force &&
        stored?.route === route &&
        now.getTime() - new Date(stored.enteredAt || 0).getTime() < PAGE_REFRESH_DEDUPE_MS;
      const enteredAt = isRapidRefresh ? stored.enteredAt : now.toISOString();
      const previousPage = sanitiseRoute(stored?.route);
      pageRef.current = { route, title, enteredAt, previousPage };
      window.sessionStorage.setItem(PAGE_STATE_KEY, JSON.stringify(pageRef.current));
      if (!isRapidRefresh) {
        enqueue({
          eventName: "page_opened",
          actionCategory: "navigation",
          feature: featureFromRoute(route),
          route,
          pageTitle: title,
          previousPage,
          pageEnteredAt: enteredAt,
          actionLabel: "Page opened",
          dedupeKey: `page-open:${route}:${enteredAt}`,
        });
      }
    };

    const start = async () => {
      if (status !== "authenticated" || !session?.user?.id) return;
      if (window.sessionStorage.getItem(PENDING_LOGOUT_STORAGE_KEY) === "1") {
        await endCurrentAuditSession();
        return;
      }
      const existingServerId = getServerAuditSessionId();
      if (existingServerId) serverSessionRef.current = existingServerId;
      const clientSessionId = getClientAuditSessionId();
      if (!clientSessionId || !nativeFetchRef.current) return;
      try {
        const response = await nativeFetchRef.current("/api/audit/session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start",
            clientSessionId,
            appMode: detectAppMode(),
            deviceHints: getClientDeviceHints(),
          }),
        });
        if (!response.ok || cancelled || response.status === 204) return;
        const payload = await response.json();
        const sessionId = payload?.data?.id;
        if (!sessionId) return;
        serverSessionRef.current = sessionId;
        setClientAuditSessionId(payload.data.client_session_id);
        setServerAuditSessionId(sessionId);
        enqueue({
          eventName: "session_started",
          actionCategory: "authentication",
          feature: "authentication",
          route: sanitiseRoute(routerRef.current.asPath),
          pageTitle: document.title,
          actionLabel: "Authenticated session started",
          dedupeKey: `session-start:${sessionId}`,
          metadata: { app_mode: detectAppMode() },
        });
        openPage(routerRef.current.asPath);
      } catch {
        // Auditing is non-blocking; authentication and page use must continue.
      }
    };

    void start();

    const onRouteStart = () => closePage("route_change");
    const onRouteComplete = (url) => openPage(url);
    routerRef.current.events.on("routeChangeStart", onRouteStart);
    routerRef.current.events.on("routeChangeComplete", onRouteComplete);

    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
    };
    for (const name of ["pointerdown", "keydown", "scroll", "touchstart"]) {
      document.addEventListener(name, onActivity, { capture: true, passive: true });
    }

    const onClick = (event) => {
      const element = event.target?.closest?.(
        "button, a[href], [role='button'], input[type='button'], input[type='submit']"
      );
      if (!element || element.closest("[data-audit-ignore='true']")) return;
      const label = sanitiseActionLabel(
        element.getAttribute("data-audit-action") ||
        element.getAttribute("aria-label") ||
        element.getAttribute("title") ||
        element.textContent ||
        element.getAttribute("value")
      );
      if (!label) return;
      const route = sanitiseRoute(routerRef.current.asPath) || "/";
      const href = element.closest("a[href]")?.getAttribute("href") || null;
      const signature = `${route}|${label}|${href || ""}`;
      const now = Date.now();
      if (
        lastClickRef.current.signature === signature &&
        now - lastClickRef.current.at < CLICK_DEDUPE_MS
      ) return;
      lastClickRef.current = { signature, at: now };
      const record = inferRecord(element, href || route);
      enqueue({
        eventName: "action_pressed",
        actionCategory: inferActionCategory(label, element),
        feature: element.closest("[data-audit-feature]")?.dataset?.auditFeature || featureFromRoute(route),
        route,
        pageTitle: document.title,
        actionLabel: label,
        recordType: record.recordType,
        recordId: record.recordId,
        metadata: {
          button_type: element.tagName.toLowerCase(),
          link_target: href ? sanitiseRoute(href) : null,
        },
      });
      if (/^(log ?out|sign ?out)$/i.test(label)) {
        void flush().finally(() => endCurrentAuditSession());
      }
    };
    document.addEventListener("click", onClick, true);

    const originalFetch = nativeFetchRef.current;
    const auditedFetch = async (input, init = {}) => {
      const rawUrl = typeof input === "string" ? input : input?.url || "";
      const url = new URL(rawUrl, window.location.origin);
      const sameOrigin = url.origin === window.location.origin;
      const method = String(init?.method || input?.method || "GET").toUpperCase();
      const isAuditEndpoint = url.pathname.startsWith("/api/audit/");
      const requestId = createClientAuditId();
      let nextInit = init;
      if (sameOrigin && url.pathname.startsWith("/api/") && !isAuditEndpoint) {
        const headers = new Headers(input?.headers || init?.headers || {});
        if (serverSessionRef.current) headers.set("x-audit-session-id", serverSessionRef.current);
        if (requestId) headers.set("x-request-id", requestId);
        nextInit = { ...init, headers };
      }
      const startedAt = Date.now();
      try {
        const response = await originalFetch(input, nextInit);
        if (sameOrigin && !isAuditEndpoint && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
          const record = inferRecord(null, url.pathname);
          enqueue({
            eventName: "api_mutation",
            actionCategory: "record_change",
            feature: featureFromRoute(url.pathname.replace(/^\/api/, "")),
            route: sanitiseRoute(routerRef.current.asPath),
            pageTitle: document.title,
            actionLabel: `${method} ${url.pathname}`,
            recordType: record.recordType,
            recordId: record.recordId,
            outcome: response.ok ? "success" : "failure",
            requestId,
            durationMs: Date.now() - startedAt,
            dedupeKey: requestId ? `api:${requestId}` : null,
            metadata: {
              api_route: url.pathname,
              http_method: method,
              http_status: response.status,
              ...readBodyMetadata(init?.body),
            },
          });
        }
        return response;
      } catch (error) {
        if (sameOrigin && !isAuditEndpoint && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
          enqueue({
            eventName: "api_mutation",
            actionCategory: "record_change",
            feature: featureFromRoute(url.pathname.replace(/^\/api/, "")),
            route: sanitiseRoute(routerRef.current.asPath),
            pageTitle: document.title,
            actionLabel: `${method} ${url.pathname}`,
            outcome: "failure",
            requestId,
            durationMs: Date.now() - startedAt,
            dedupeKey: requestId ? `api:${requestId}` : null,
            metadata: { api_route: url.pathname, http_method: method, error_code: "network_error" },
          });
        }
        throw error;
      }
    };
    window.fetch = auditedFetch;

    const heartbeat = window.setInterval(() => {
      if (
        !serverSessionRef.current ||
        document.visibilityState !== "visible" ||
        Date.now() - lastActivityRef.current > HEARTBEAT_MS * 2
      ) return;
      void originalFetch("/api/audit/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat", sessionId: serverSessionRef.current }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (payload?.data?.status === "active") return;
          serverSessionRef.current = null;
          clearAuditSession();
          void start();
        })
        .catch(() => {});
      void flush();
    }, HEARTBEAT_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        closePage("visibility_hidden");
        void flush();
      } else if (!pageRef.current) {
        openPage(routerRef.current.asPath, { force: true });
      }
    };
    const onPageHide = () => {
      closePage("page_hidden");
      void flush();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      closePage("tracker_unmounted");
      void flush();
      routerRef.current.events.off("routeChangeStart", onRouteStart);
      routerRef.current.events.off("routeChangeComplete", onRouteComplete);
      for (const name of ["pointerdown", "keydown", "scroll", "touchstart"]) {
        document.removeEventListener(name, onActivity, true);
      }
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(heartbeat);
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      if (window.fetch === auditedFetch) window.fetch = originalFetch;
    };
    // `router` is deliberately absent — it is read through routerRef so a new
    // router object cannot restart the audit session. See the note by the ref.
  }, [session?.user?.id, status]);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    serverSessionRef.current = null;
    clearAuditSession();
  }, [status]);

  return null;
}
