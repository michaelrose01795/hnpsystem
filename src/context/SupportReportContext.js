// file location: src/context/SupportReportContext.js
//
// Phase 2 — runtime capture provider for the Help & Diagnostics ("support")
// feature. Mounts the always-on diagnostic ring buffers (via installBrowserCapture),
// records route-change actions, and exposes a context API for later phases:
//
//   const { openSupportReport, captureDiagnostics, isOpen, closeSupportReport,
//           prefill, snapshot } = useSupportReport();
//
// In Phase 2 nothing renders UI — openSupportReport() just takes a sanitised
// diagnostics snapshot and stores it in state. The Phase 3 popup consumes
// `isOpen` / `prefill` / `snapshot`. The error boundary (Phase 4) calls
// openSupportReport({ error, sectionKey }) to pre-fill a report.
//
// The provider must sit inside <UserProvider> and <SessionProvider> so it can
// read session/roles. It uses useRouter for route + route-change actions.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useUser } from "@/context/UserContext";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import {
  createDiagnosticsStore,
  installBrowserCapture,
  captureDiagnostics as assembleDiagnostics,
  recordAction,
  recordError,
  snapshotDevice,
} from "@/lib/support/diagnostics";
import { collectProviderDiagnostics } from "@/lib/support/diagnosticRegistry";
import { registerBuiltinDiagnosticProviders } from "@/lib/support/providers";

const noop = () => {};

const SupportReportContext = createContext({
  isOpen: false,
  prefill: null,
  snapshot: null,
  openSupportReport: noop,
  closeSupportReport: noop,
  captureDiagnostics: () => ({}),
  recordRenderError: noop,
  recordDiagnosticEvent: noop,
});

// Build the static build/version info available today. Phase 5 will populate
// commit/ref/buildId via next.config; until then these are best-effort.
const readBuildInfo = () => ({
  version: process.env.NEXT_PUBLIC_APP_VERSION || undefined,
  commit_sha: process.env.NEXT_PUBLIC_COMMIT_SHA || undefined,
  commit_ref: process.env.NEXT_PUBLIC_COMMIT_REF || undefined,
  build_id: process.env.NEXT_PUBLIC_BUILD_ID || undefined,
});

const readFlags = () => ({
  NEXT_PUBLIC_DEV_AUTH_BYPASS: process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true",
  presentationMode: typeof window !== "undefined" ? isPresentationMode() : false,
});

export function SupportDiagnosticsProvider({ children }) {
  const router = useRouter();
  const { user, dbUserId } = useUser();
  const { status: sessionStatus } = useSession();

  // One store for the lifetime of the provider.
  const storeRef = useRef(null);
  if (storeRef.current === null) storeRef.current = createDiagnosticsStore();

  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  // Install browser capture (console/error/fetch/click) once on mount, and
  // register the built-in diagnostic providers (UI state + dev metadata). Feature
  // teams can register their own providers anywhere; see diagnosticRegistry.js.
  useEffect(() => {
    registerBuiltinDiagnosticProviders();
    const uninstall = installBrowserCapture(storeRef.current, { now: () => Date.now() });
    return uninstall;
  }, []);

  // Record route-change actions. Uses the router event bus already present.
  useEffect(() => {
    if (!router?.events) return undefined;
    const onChange = (to) => {
      recordAction(storeRef.current, {
        type: "route_change",
        from: router.asPath,
        to,
        ts: Date.now(),
      });
    };
    router.events.on("routeChangeStart", onChange);
    return () => router.events.off("routeChangeStart", onChange);
  }, [router]);

  // Most recent section key the user interacted with (for code ownership).
  const latestSectionKey = useCallback(() => {
    const actions = storeRef.current?.actions?.toArray?.() || [];
    for (let i = actions.length - 1; i >= 0; i -= 1) {
      if (actions[i]?.sectionKey) return actions[i].sectionKey;
    }
    return undefined;
  }, []);

  // Assemble a sanitised diagnostics bundle from current state. `overrides`
  // lets callers (error boundary) inject a specific sectionKey.
  const captureDiagnostics = useCallback(
    (overrides = {}) => {
      const sessionSnapshot = {
        authStatus: sessionStatus,
        roles: Array.isArray(user?.roles) ? user.roles : [],
        dbUserId: Number.isInteger(dbUserId) ? dbUserId : null,
        isDevLogin: Boolean(user?.isDevLogin),
      };
      const isDev =
        Boolean(user?.isDevLogin) || process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
      // Collect per-feature diagnostics from every registered provider. Faulty
      // providers are swallowed inside collectProviderDiagnostics.
      const providers = collectProviderDiagnostics({
        win: typeof window !== "undefined" ? window : undefined,
        doc: typeof document !== "undefined" ? document : undefined,
        store: storeRef.current,
        isDev,
      });
      return assembleDiagnostics(storeRef.current, {
        capturedAt: new Date().toISOString(),
        route: {
          asPath: router?.asPath,
          pathname: router?.pathname,
          query: router?.query,
        },
        sectionKey: overrides.sectionKey || latestSectionKey(),
        session: sessionSnapshot,
        flags: readFlags(),
        device: snapshotDevice(),
        build: readBuildInfo(),
        providers,
      });
    },
    [router, user, dbUserId, sessionStatus, latestSectionKey]
  );

  // Phase 4 — the SupportErrorBoundary feeds caught React render errors and
  // recovery attempts into THIS store so they ride along in the next captured
  // bundle. Runtime exceptions + unhandled promise rejections are already
  // captured by installBrowserCapture's window listeners, so the boundary never
  // adds its own window listeners — it only contributes the render error (with
  // component stack) and the recovery timeline, avoiding duplicate events.
  const recordRenderError = useCallback(
    ({ error, componentStack } = {}) => {
      const message = error?.message || String(error ?? "Render error");
      recordError(storeRef.current, {
        message,
        stack: error?.stack,
        componentStack,
        ts: Date.now(),
      });
      // Mirror it onto the action timeline so it is visible in recent_actions,
      // tagged with the section the user last interacted with (code ownership
      // is resolved from this at capture time).
      recordAction(storeRef.current, {
        type: "render_error",
        label: message,
        sectionKey: latestSectionKey(),
        ts: Date.now(),
      });
    },
    [latestSectionKey]
  );

  // Record a recovery attempt (retry / reload / open-report) as a timeline event.
  const recordDiagnosticEvent = useCallback(
    (event = {}) => {
      recordAction(storeRef.current, {
        type: event.type || "action",
        label: event.label,
        sectionKey: event.sectionKey || latestSectionKey(),
        ts: Date.now(),
      });
    },
    [latestSectionKey]
  );

  const openSupportReport = useCallback(
    (options = {}) => {
      const snap = captureDiagnostics({ sectionKey: options.sectionKey });
      setSnapshot(snap);
      setPrefill(options.prefill || (options.error ? { description: String(options.error) } : null));
      setIsOpen(true);
    },
    [captureDiagnostics]
  );

  const closeSupportReport = useCallback(() => {
    setIsOpen(false);
    setPrefill(null);
    setSnapshot(null);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      prefill,
      snapshot,
      openSupportReport,
      closeSupportReport,
      captureDiagnostics,
      recordRenderError,
      recordDiagnosticEvent,
    }),
    [
      isOpen,
      prefill,
      snapshot,
      openSupportReport,
      closeSupportReport,
      captureDiagnostics,
      recordRenderError,
      recordDiagnosticEvent,
    ]
  );

  return <SupportReportContext.Provider value={value}>{children}</SupportReportContext.Provider>;
}

export function useSupportReport() {
  return useContext(SupportReportContext);
}

export { SupportReportContext };
export default SupportDiagnosticsProvider;
