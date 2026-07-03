// file location: src/components/support/SupportErrorBoundary.js
//
// The application's reusable React error boundary for the Help & Diagnostics
// ("support") feature. Phase 4 introduced it (app-shell recovery + diagnostics
// wiring); Phase 9 (Support & Recovery System) extends it into a LEVELLED,
// AUDIENCE-AWARE boundary that can isolate a failure at three granularities
// without taking down the whole interface:
//
//   • <SupportErrorBoundary hostSupportModal>  (level="app")  — the single
//       app-shell boundary in _app.js. A crash here has replaced the whole UI.
//   • <RouteBoundary>    (level="route")   — wraps one page below the shell, so
//       a page crash recovers locally while the sidebar/topbar survive.
//   • <SectionBoundary>  (level="section") — wraps a leaf subtree (a tab, panel,
//       widget) so a leaf crash recovers in place, compact, page intact.
//
// What Phase 9 adds on top of the Phase-4 boundary:
//   - A Phase-4-style REFERENCE CODE minted for every caught crash, shown to the
//     user and threaded into the recorded timeline + the pre-filled report, so a
//     render crash is quotable/traceable exactly like an async error.
//   - Contextual recovery actions resolved by level + audience: Try again,
//     Reload, Go back, Return to dashboard/home, Report a problem. (recoveryModel.js)
//   - Recoverable vs unrecoverable distinction + CRASH-LOOP prevention: after a
//     subtree dies repeatedly (or on a stale-chunk error), in-place retry is
//     withdrawn and the user is steered to a heavier recovery.
//   - A graceful CUSTOMER variant for non-staff surfaces (public website,
//     customer VHC view) with softer copy and no technical detail.
//   - A diagnostics panel revealed ONLY to authorised roles (canViewDiagnostics),
//     never to staff-at-large or customers.
//
// Recovery attempts feed the SHARED diagnostics store (recordDiagnosticEvent) so
// they ride along in the next captured bundle. Runtime exceptions + unhandled
// rejections are ALREADY captured by installBrowserCapture's window listeners, so
// this boundary deliberately adds NO window listeners — its unique contribution
// is the render error + component stack + recovery timeline.
//
// Unsaved form data: GlobalDraftPersistence auto-saves draftable fields per route
// (localStorage) on input/blur/route-change/beforeunload, so a Retry (re-render)
// or Reload restores what the user had typed where practical — the recovery
// actions here never clear those drafts.

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import { useSupportReport } from "@/context/SupportReportContext";
import { useUser } from "@/context/UserContext";
import { canViewDiagnostics } from "@/lib/auth/roles";
import {
  buildBoundaryReportPrefill,
  buildBoundaryEvent,
  errorMessage,
  topComponentFromStack,
  mintBoundaryReferenceCode,
  BOUNDARY_EVENTS,
} from "@/lib/support/errorBoundaryDiagnostics";
import {
  RECOVERY_LEVELS,
  RECOVERY_VARIANTS,
  RECOVERY_ACTIONS,
  nextCrashState,
  isCrashLoop,
  resolveRecovery,
} from "@/lib/support/recoveryModel";

// The popup is only ever needed once a user clicks "Report a problem" from the
// recovery screen — lazy + client-only, mirroring SupportControl.
const SupportReportModal = dynamic(() => import("@/components/support/SupportReportModal"), {
  ssr: false,
});

const TONE_CLASS = {
  primary: "app-btn app-btn--primary",
  secondary: "app-btn app-btn--secondary",
  ghost: "app-btn app-btn--ghost",
};

class SupportErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: null, referenceCode: null, loopDetected: false };
    // Rolling record of recent crashes for this boundary instance (survives a
    // Retry, which only resets error state — not a full remount — so a rapid
    // re-crash is correctly counted toward the loop). Reset on route change.
    this.crashState = { timestamps: [] };
    this.handleRetry = this.handleRetry.bind(this);
    this.handleReload = this.handleReload.bind(this);
    this.handleBack = this.handleBack.bind(this);
    this.handleHome = this.handleHome.bind(this);
    this.handleReport = this.handleReport.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const componentStack = info?.componentStack || null;
    const referenceCode = mintBoundaryReferenceCode();
    this.crashState = nextCrashState(this.crashState, { now: Date.now() });
    const loopDetected = isCrashLoop(this.crashState);
    this.setState({ componentStack, referenceCode, loopDetected });

    // Record the render error (with its component stack) into the shared store,
    // then log a "caught" timeline event carrying the reference code. No window
    // listeners here — see header.
    this.props.onRenderError?.({ error, componentStack });
    this.props.onEvent?.(
      buildBoundaryEvent(BOUNDARY_EVENTS.CAUGHT, {
        message: errorMessage(error),
        sectionKey: this.props.sectionKey,
        referenceCode,
      })
    );
    // Preserve the console signal for developers (also re-captured by the console
    // patch, so it surfaces in console_errors too).
    console.error(
      `SupportErrorBoundary [${this.props.level || "app"}] caught a render error (${referenceCode}):`,
      error,
      info
    );
  }

  componentDidUpdate(prevProps) {
    // Auto-recover when the route (resetKey) changes so a stale crash screen
    // doesn't persist across navigation — and treat the new route as a fresh
    // start for crash-loop tracking.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.crashState = { timestamps: [] };
      this.setState({ error: null, componentStack: null, referenceCode: null, loopDetected: false });
    }
  }

  recordAttempt(kind) {
    this.props.onEvent?.(
      buildBoundaryEvent(kind, {
        sectionKey: this.props.sectionKey,
        referenceCode: this.state.referenceCode,
      })
    );
  }

  handleRetry() {
    this.recordAttempt(BOUNDARY_EVENTS.RETRY);
    // Keep crashState so an immediate re-crash counts toward the loop; only the
    // visible error is cleared so the subtree re-mounts.
    this.setState({ error: null, componentStack: null });
  }

  handleReload() {
    this.recordAttempt(BOUNDARY_EVENTS.RELOAD);
    // beforeunload → GlobalDraftPersistence flushes drafts before the reload.
    if (typeof window !== "undefined") window.location.reload();
  }

  handleBack() {
    this.recordAttempt(BOUNDARY_EVENTS.RETRY);
    this.props.onNavigateBack?.();
  }

  handleHome() {
    this.recordAttempt(BOUNDARY_EVENTS.RETRY);
    this.props.onNavigateHome?.();
  }

  handleReport() {
    this.recordAttempt(BOUNDARY_EVENTS.REPORT);
    this.props.onReport?.({
      error: this.state.error,
      componentStack: this.state.componentStack,
      referenceCode: this.state.referenceCode,
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const handlers = {
      [RECOVERY_ACTIONS.RETRY]: this.handleRetry,
      [RECOVERY_ACTIONS.RELOAD]: this.handleReload,
      [RECOVERY_ACTIONS.BACK]: this.handleBack,
      [RECOVERY_ACTIONS.HOME]: this.handleHome,
      [RECOVERY_ACTIONS.REPORT]: this.handleReport,
    };

    if (typeof this.props.fallback === "function") {
      return this.props.fallback({
        error: this.state.error,
        componentStack: this.state.componentStack,
        referenceCode: this.state.referenceCode,
        loopDetected: this.state.loopDetected,
        handlers,
      });
    }

    return (
      <SupportErrorRecovery
        error={this.state.error}
        componentStack={this.state.componentStack}
        referenceCode={this.state.referenceCode}
        loopDetected={this.state.loopDetected}
        level={this.props.level || RECOVERY_LEVELS.APP}
        variant={this.props.variant || RECOVERY_VARIANTS.STAFF}
        homeHref={this.props.homeHref}
        sectionLabel={this.props.sectionLabel}
        handlers={handlers}
        hostSupportModal={this.props.hostSupportModal}
      />
    );
  }
}

// The default recovery screen. Borderless surface + token colours + app-btn
// classes per CLAUDE.md §3. Buttons meet the 44px touch-target rule (§3.6).
function SupportErrorRecovery({
  error,
  componentStack,
  referenceCode,
  loopDetected,
  level,
  variant,
  homeHref,
  sectionLabel,
  handlers,
  hostSupportModal,
}) {
  const { isOpen, captureDiagnostics } = useSupportReport();
  const userCtx = useUser?.();
  const canView =
    variant === RECOVERY_VARIANTS.STAFF && canViewDiagnostics(userCtx?.user?.roles);

  const plan = resolveRecovery({ level, variant, error, loopDetected, homeHref, sectionLabel });
  const isSection = level === RECOVERY_LEVELS.SECTION;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        // Section boundaries stay compact (the surrounding page still works);
        // route/app boundaries fill the viewport so the recovery screen reads as
        // the primary content.
        minHeight: isSection ? undefined : "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isSection ? "12px" : "24px",
        width: "100%",
      }}
    >
      <LayerSurface
        padding={isSection ? "clamp(16px, 4vw, 24px)" : "clamp(24px, 5vw, 40px)"}
        gap={isSection ? "12px" : "16px"}
        style={{
          maxWidth: isSection ? "440px" : "520px",
          width: "100%",
          textAlign: "center",
          alignItems: "center",
        }}
      >
        {/* Decorative status indicator (not a card/section, so an inline tint is
            allowed under §3.0 rule 5). */}
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: isSection ? "40px" : "48px",
            height: isSection ? "40px" : "48px",
            borderRadius: "50%",
            background: "var(--warning-surface)",
            color: "var(--warning-dark)",
            fontSize: isSection ? "1.25rem" : "1.5rem",
            fontWeight: 700,
          }}
        >
          !
        </span>

        <h2 style={{ margin: 0, color: "var(--accentText)", fontSize: isSection ? "1.15rem" : "1.4rem" }}>
          {plan.headline}
        </h2>
        <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.75, lineHeight: 1.5 }}>{plan.message}</p>

        {/* Reference code — shown to EVERYONE (staff quote it to support; the
            same code is logged against the private diagnostics). Selectable in
            one drag. */}
        {referenceCode && (
          <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.6, fontSize: "0.82rem" }}>
            Reference code:{" "}
            <span style={{ fontWeight: 600, userSelect: "all" }}>{referenceCode}</span>
          </p>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            justifyContent: "center",
            marginTop: "4px",
          }}
        >
          {plan.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={TONE_CLASS[action.tone] || TONE_CLASS.secondary}
              onClick={handlers[action.id]}
              style={{ minHeight: "44px" }}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Diagnostics panel — authorised roles only (canViewDiagnostics), never
            customers or staff-at-large. Collapsed by default. */}
        {canView && plan.allowDiagnostics && (
          <RecoveryDiagnostics
            error={error}
            componentStack={componentStack}
            referenceCode={referenceCode}
            captureDiagnostics={captureDiagnostics}
          />
        )}
      </LayerSurface>

      {/* When this boundary hosts the report popup (the app-shell boundary whose
          StaffTopbar host is unmounted, or a customer-surface boundary that has
          no topbar at all), render the modal here. Nested staff boundaries leave
          hostSupportModal false so the topbar stays the single host. */}
      {hostSupportModal && isOpen && <SupportReportModal />}
    </div>
  );
}

// Developer-only technical detail on the recovery screen. Uses text + a
// box-shadow-free <details>; copies the freshly captured, already-sanitised
// diagnostics bundle to the clipboard for a bug report.
function RecoveryDiagnostics({ error, componentStack, referenceCode, captureDiagnostics }) {
  const [copied, setCopied] = React.useState(false);
  const component = topComponentFromStack(componentStack);

  const copyDiagnostics = async () => {
    try {
      const snapshot = captureDiagnostics ? captureDiagnostics() : {};
      const text = JSON.stringify({ referenceCode, error: errorMessage(error), component, snapshot }, null, 2);
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; the on-screen detail below is still readable.
      setCopied(false);
    }
  };

  return (
    <details style={{ width: "100%", textAlign: "left", marginTop: "4px" }}>
      <summary
        style={{
          cursor: "pointer",
          color: "var(--text-1)",
          opacity: 0.7,
          fontSize: "0.8rem",
          fontWeight: 600,
        }}
      >
        Technical details (staff)
      </summary>
      <div
        style={{
          marginTop: "8px",
          padding: "10px 12px",
          borderRadius: "var(--radius-md)",
          background: "var(--theme)",
          fontSize: "0.78rem",
          color: "var(--text-1)",
          lineHeight: 1.5,
          wordBreak: "break-word",
        }}
      >
        <div>
          <strong>Error:</strong> {errorMessage(error)}
        </div>
        {component && (
          <div>
            <strong>Component:</strong> {component}
          </div>
        )}
        {referenceCode && (
          <div>
            <strong>Reference:</strong> {referenceCode}
          </div>
        )}
        <button
          type="button"
          className="app-btn app-btn--ghost"
          onClick={copyDiagnostics}
          style={{ minHeight: "44px", marginTop: "8px" }}
        >
          {copied ? "Copied ✓" : "Copy diagnostics"}
        </button>
      </div>
    </details>
  );
}

/**
 * The public boundary. Wires router + shared diagnostics/report context into the
 * class component. `level` / `variant` / `homeHref` / `sectionLabel` shape the
 * recovery screen; everything defaults to the app-shell behaviour so the existing
 * `<SupportErrorBoundary hostSupportModal>` in _app.js is unchanged.
 */
export default function SupportErrorBoundary({
  children,
  fallback,
  hostSupportModal = false,
  level = RECOVERY_LEVELS.APP,
  variant = RECOVERY_VARIANTS.STAFF,
  homeHref,
  sectionKey,
  sectionLabel,
}) {
  const router = useRouter();
  const { recordRenderError, recordDiagnosticEvent, openSupportReport } = useSupportReport();

  const handleReport = React.useCallback(
    ({ error, componentStack, referenceCode }) => {
      // Pre-fill the report from the error + reference code; the diagnostics
      // snapshot taken here already contains the recorded render error + recovery
      // timeline, and the provider auto-links route + last section key + resolved
      // code ownership.
      openSupportReport({
        prefill: buildBoundaryReportPrefill({ error, componentStack, referenceCode }),
      });
    },
    [openSupportReport]
  );

  const handleNavigateBack = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(homeHref || "/newsfeed");
  }, [router, homeHref]);

  const handleNavigateHome = React.useCallback(() => {
    const target = homeHref || (variant === RECOVERY_VARIANTS.CUSTOMER ? "/" : "/newsfeed");
    router.push(target);
  }, [router, homeHref, variant]);

  return (
    <SupportErrorBoundaryInner
      fallback={fallback}
      hostSupportModal={hostSupportModal}
      level={level}
      variant={variant}
      homeHref={homeHref}
      sectionKey={sectionKey}
      sectionLabel={sectionLabel}
      resetKey={router?.asPath}
      onRenderError={recordRenderError}
      onEvent={recordDiagnosticEvent}
      onReport={handleReport}
      onNavigateBack={handleNavigateBack}
      onNavigateHome={handleNavigateHome}
    >
      {children}
    </SupportErrorBoundaryInner>
  );
}

/**
 * Route-level boundary: wrap a page's content below the app shell so a page
 * crash recovers locally (Try again / Reload / Go back / Return to dashboard /
 * Report) while the sidebar + topbar survive.
 *
 * Pass `variant="customer"` on non-staff surfaces (public website, customer VHC
 * view) for softer copy, a public "home" route, and no technical detail — and
 * `hostSupportModal` there so the report popup has a host (no StaffTopbar).
 */
export function RouteBoundary(props) {
  return <SupportErrorBoundary level={RECOVERY_LEVELS.ROUTE} {...props} />;
}

/**
 * Section-level boundary: wrap a leaf subtree (a tab, panel, widget) so a leaf
 * crash recovers in place — compact, with Retry + Report — leaving the rest of
 * the page usable. Pass `sectionLabel` for a friendly name in the message and
 * `sectionKey` to tag the recovery timeline for code ownership.
 */
export function SectionBoundary(props) {
  return <SupportErrorBoundary level={RECOVERY_LEVELS.SECTION} {...props} />;
}

export { SupportErrorBoundaryInner, SupportErrorRecovery };
