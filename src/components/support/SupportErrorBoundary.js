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
// AUTOMATIC LOGGING: every caught crash is also written to the durable trail
// (support_error_events, via logErrorEvent → /api/support/error-events) at the
// moment it is caught, tagged with the reference code the user sees. That does
// NOT depend on the user pressing "Report a problem" — pressing it adds their
// own words and the full diagnostics bundle on top, and the server stamps the
// resulting report onto the already-captured events by reference code.
//
// Unsaved form data: GlobalDraftPersistence auto-saves draftable fields per route
// (localStorage) on input/blur/route-change/beforeunload, so a Retry (re-render)
// or Reload restores what the user had typed where practical — the recovery
// actions here never clear those drafts.

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
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
  RECOVERY_TONES,
  nextCrashState,
  isCrashLoop,
  resolveRecovery,
} from "@/lib/support/recoveryModel";
import { logFailure } from "@/lib/utils/logFailure";
import { logErrorEvent, ERROR_KINDS } from "@/lib/support/autoErrorLog";

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
    // Persist the crash to the durable trail (support_error_events) IMMEDIATELY,
    // keyed by the same reference code shown on screen — so the failure is
    // traceable whether or not the user goes on to press "Report a problem".
    // Fire-and-forget and self-swallowing; it cannot fail the recovery render.
    logErrorEvent({
      kind: ERROR_KINDS.RENDER,
      error,
      referenceCode,
      componentStack,
      component: topComponentFromStack(componentStack),
      boundaryLevel: this.props.level || RECOVERY_LEVELS.APP,
      variant: this.props.variant || RECOVERY_VARIANTS.STAFF,
      sectionKey: this.props.sectionKey,
      context: {
        sectionLabel: this.props.sectionLabel || null,
        loopDetected,
        crashCount: this.crashState.timestamps.length,
      },
    });

    // Preserve the console signal for developers (also re-captured by the console
    // patch, so it surfaces in console_errors too).
    logFailure(
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

// The default recovery screen. Every visual property lives in the error-recovery
// family (src/styles/families/error-recovery.css) — this file contributes no
// inline styling at all, so the screen cannot drift from the design system and
// the 44px touch-target floor (§3.6) is enforced in one place.
//
// Shape: badge (tone from the plan) → headline → one paragraph → the quotable
// facts (page / section / time / reference + copy) → recovery actions → the
// quiet "this is already logged" line → the role-gated technical panel. A
// SECTION-level boundary drops the facts and the hint: the page around it still
// works, so a full incident block would outweigh the failure it describes.
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
  // Optional pre-built recovery plan. A caught render error resolves its own
  // plan from the error (the default below); the framework error pages
  // (404 / 500 / _error) have no error object to classify, so they build a plan
  // describing THEIR situation and pass it in — which is how those pages reuse
  // this exact screen instead of growing a parallel visual system.
  plan: planOverride,
}) {
  const router = useRouter();
  const { isOpen, captureDiagnostics } = useSupportReport();
  const userCtx = useUser?.();
  const canView =
    variant === RECOVERY_VARIANTS.STAFF && canViewDiagnostics(userCtx?.user?.roles);

  const plan =
    planOverride || resolveRecovery({ level, variant, error, loopDetected, homeHref, sectionLabel });
  const isSection = level === RECOVERY_LEVELS.SECTION;

  // Layer ladder (CLAUDE.md §3.0a-2). A ROUTE boundary replaces a page's content
  // INSIDE the --surface page card, so its card takes the --theme rung to read
  // as a distinct surface rather than dissolving into the card behind it. An APP
  // boundary sits directly on the app shell and a SECTION boundary sits inside a
  // --theme section card, so both take --surface. Whatever the card is, anything
  // nested inside it flips to the other rung.
  const onThemeRung = level === RECOVERY_LEVELS.ROUTE;
  const RecoveryCard = onThemeRung ? LayerTheme : LayerSurface;
  const NestedLayer = onThemeRung ? LayerSurface : LayerTheme;

  const tone = plan.tone || RECOVERY_TONES.DANGER;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={isSection ? "app-recovery app-recovery--section" : "app-recovery"}
    >
      <RecoveryCard
        className={
          isSection ? "app-recovery__card app-recovery__card--section" : "app-recovery__card"
        }
        padding={isSection ? "clamp(16px, 4vw, 24px)" : "clamp(24px, 5vw, 40px)"}
        gap={isSection ? "12px" : "16px"}
      >
        {/* Decorative status indicator. The tint is the only severity signal in
            a borderless system, so the plan chooses it rather than this file. */}
        <span
          aria-hidden="true"
          className={[
            "app-recovery__badge",
            `app-recovery__badge--${tone}`,
            isSection && "app-recovery__badge--section",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {plan.icon || "!"}
        </span>

        <h2
          className={
            isSection ? "app-recovery__title app-recovery__title--section" : "app-recovery__title"
          }
        >
          {plan.headline}
        </h2>
        <p className="app-recovery__message">{plan.message}</p>

        {/* The quotable facts. A section boundary skips them — the page around it
            still works, so a full incident block would be heavier than the
            failure it is describing. */}
        {!isSection && (
          <RecoveryFacts
            referenceCode={referenceCode}
            route={router?.asPath}
            sectionLabel={sectionLabel}
          />
        )}

        <div className="app-recovery__actions">
          {plan.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={TONE_CLASS[action.tone] || TONE_CLASS.secondary}
              onClick={handlers[action.id]}
            >
              {action.label}
            </button>
          ))}
        </div>

        {!isSection && plan.hint && <p className="app-recovery__hint">{plan.hint}</p>}

        {/* Diagnostics panel — authorised roles only (canViewDiagnostics), never
            customers or staff-at-large. Collapsed by default. */}
        {canView && plan.allowDiagnostics && (
          <RecoveryDiagnostics
            error={error}
            componentStack={componentStack}
            referenceCode={referenceCode}
            captureDiagnostics={captureDiagnostics}
            Layer={NestedLayer}
          />
        )}
      </RecoveryCard>

      {/* When this boundary hosts the report popup (the app-shell boundary whose
          StaffTopbar host is unmounted, or a customer-surface boundary that has
          no topbar at all), render the modal here. Nested staff boundaries leave
          hostSupportModal false so the topbar stays the single host. */}
      {hostSupportModal && isOpen && <SupportReportModal />}
    </div>
  );
}

/**
 * The three things a person needs when they ring up about this screen: WHERE it
 * happened, WHEN it happened, and the code the failure was filed under. Before
 * this block the reference code was one quiet line and the route/time existed
 * only inside the private diagnostics bundle, so a staff member describing the
 * problem had to remember the page themselves.
 *
 * The copy button matters more than it looks: the code is the join between what
 * the user says and what support_error_events already recorded, and a code read
 * off a screen into a message is the step people get wrong.
 */
function RecoveryFacts({ referenceCode, route, sectionLabel }) {
  const [copied, setCopied] = React.useState(false);
  // Rendered on the client only. PageErrorScreen server-renders (404/500), and a
  // timestamp resolved during SSR is both wrong (server clock, server locale)
  // and a hydration mismatch — so the row appears once mounted, or not at all.
  const [occurredAt, setOccurredAt] = React.useState(null);

  React.useEffect(() => {
    try {
      setOccurredAt(
        new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch {
      setOccurredAt(null);
    }
  }, []);

  const copyReference = async () => {
    try {
      await navigator.clipboard?.writeText(referenceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the code stays selectable in one drag.
      setCopied(false);
    }
  };

  if (!referenceCode && !route && !occurredAt) return null;

  return (
    <dl className="app-recovery-facts">
      {route && (
        <>
          <dt className="app-recovery-facts__label">Page</dt>
          <dd className="app-recovery-facts__value app-recovery-facts__value--mono">{route}</dd>
        </>
      )}
      {sectionLabel && (
        <>
          <dt className="app-recovery-facts__label">Section</dt>
          <dd className="app-recovery-facts__value">{sectionLabel}</dd>
        </>
      )}
      {occurredAt && (
        <>
          <dt className="app-recovery-facts__label">Time</dt>
          <dd className="app-recovery-facts__value">{occurredAt}</dd>
        </>
      )}
      {referenceCode && (
        <>
          <dt className="app-recovery-facts__label">Reference</dt>
          <dd className="app-recovery-facts__value app-recovery-facts__value--mono">
            <span className="app-recovery-facts__code">{referenceCode}</span>
            <button
              type="button"
              className="app-btn app-btn--ghost app-btn--xs app-recovery-facts__row-btn"
              onClick={copyReference}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </dd>
        </>
      )}
    </dl>
  );
}

// Developer-only technical detail on the recovery screen. Uses text + a
// box-shadow-free <details>; copies the freshly captured, already-sanitised
// diagnostics bundle to the clipboard for a bug report.
function RecoveryDiagnostics({ error, componentStack, referenceCode, captureDiagnostics, Layer }) {
  const [copied, setCopied] = React.useState(false);
  const component = topComponentFromStack(componentStack);
  // The rung opposite the recovery card, passed down so the panel alternates
  // correctly whichever card it is sitting in (§3.0a-2).
  const PanelLayer = Layer || LayerTheme;

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
    <details className="app-recovery__details">
      <summary className="app-recovery__summary">Technical details (staff)</summary>
      <PanelLayer padding="12px 14px" gap="8px">
        <div className="app-recovery__panel">
          <p className="app-recovery__panel-row">
            <span className="app-recovery__panel-key">Error: </span>
            <span className="app-recovery__panel-value">{errorMessage(error)}</span>
          </p>
          {component && (
            <p className="app-recovery__panel-row">
              <span className="app-recovery__panel-key">Component: </span>
              <span className="app-recovery__panel-value">{component}</span>
            </p>
          )}
          {referenceCode && (
            <p className="app-recovery__panel-row">
              <span className="app-recovery__panel-key">Reference: </span>
              <span className="app-recovery__panel-value">{referenceCode}</span>
            </p>
          )}
        </div>
        <div>
          <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={copyDiagnostics}>
            {copied ? "Copied ✓" : "Copy diagnostics"}
          </button>
        </div>
      </PanelLayer>
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
