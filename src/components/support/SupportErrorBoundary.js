// file location: src/components/support/SupportErrorBoundary.js
//
// Phase 4 — application-wide React error boundary for the Help & Diagnostics
// ("support") feature. Modelled on the existing JobCardErrorBoundary
// (src/pages/job-cards/[jobNumber].js) but fully namespaced under "support" and
// wired into the Phase 2 diagnostics provider.
//
// Responsibilities:
//   - Catch React render errors + component stacks (getDerivedStateFromError /
//     componentDidCatch) anywhere below it.
//   - Feed the render error into the SHARED diagnostics store via the context
//     (recordRenderError). Runtime exceptions + unhandled promise rejections are
//     ALREADY captured by installBrowserCapture's window listeners, so this
//     boundary deliberately does NOT add its own window listeners — that would
//     double-record them. Its unique contribution is the render error + stack.
//   - Record each recovery attempt (retry / reload / open report) as a timeline
//     event in the same store, so it rides along in the next captured bundle.
//   - Show a user-friendly recovery screen: Try again, Reload app, or open the
//     Help & Diagnostics popup pre-filled with the captured error context
//     (which automatically links route, section key + resolved code ownership).
//   - Reusable: pass a custom `fallback` render-prop, or nest it inside an
//     individual page later for finer-grained recovery. Auto-resets when the
//     route changes (resetKey) so navigating away clears a caught error.
//
// Mounted once at the app shell in _app.js (flagged global change). Individual
// pages may also wrap a subtree in <SupportErrorBoundary> for local recovery.

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import { useSupportReport } from "@/context/SupportReportContext";
import {
  buildBoundaryReportPrefill,
  buildBoundaryEvent,
  errorMessage,
  BOUNDARY_EVENTS,
} from "@/lib/support/errorBoundaryDiagnostics";

// The popup is only ever needed once a user clicks "Report a problem" from the
// recovery screen — lazy + client-only, mirroring SupportControl.
const SupportReportModal = dynamic(() => import("@/components/support/SupportReportModal"), {
  ssr: false,
});

class SupportErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: null };
    this.handleRetry = this.handleRetry.bind(this);
    this.handleReload = this.handleReload.bind(this);
    this.handleReport = this.handleReport.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const componentStack = info?.componentStack || null;
    this.setState({ componentStack });
    // Record the render error (with its component stack) into the shared store,
    // then log a "caught" timeline event. No window listeners here — see header.
    this.props.onRenderError?.({ error, componentStack });
    this.props.onEvent?.(buildBoundaryEvent(BOUNDARY_EVENTS.CAUGHT, { message: errorMessage(error) }));
    // Preserve the console signal the old JobCardErrorBoundary emitted (also
    // re-captured by the console patch, so it surfaces in console_errors too).
    console.error("SupportErrorBoundary caught a render error:", error, info);
  }

  componentDidUpdate(prevProps) {
    // Auto-recover when the route (resetKey) changes so a stale crash screen
    // doesn't persist across navigation in nested boundaries.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, componentStack: null });
    }
  }

  handleRetry() {
    this.props.onEvent?.(buildBoundaryEvent(BOUNDARY_EVENTS.RETRY));
    this.setState({ error: null, componentStack: null });
  }

  handleReload() {
    this.props.onEvent?.(buildBoundaryEvent(BOUNDARY_EVENTS.RELOAD));
    if (typeof window !== "undefined") window.location.reload();
  }

  handleReport() {
    this.props.onEvent?.(buildBoundaryEvent(BOUNDARY_EVENTS.REPORT));
    this.props.onReport?.({ error: this.state.error, componentStack: this.state.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;

    if (typeof this.props.fallback === "function") {
      return this.props.fallback({
        error: this.state.error,
        componentStack: this.state.componentStack,
        retry: this.handleRetry,
        reload: this.handleReload,
        report: this.handleReport,
      });
    }

    return (
      <SupportErrorRecovery
        error={this.state.error}
        onRetry={this.handleRetry}
        onReload={this.handleReload}
        onReport={this.handleReport}
        hostSupportModal={this.props.hostSupportModal}
      />
    );
  }
}

// The default recovery screen. Borderless surface + token colours + app-btn
// classes per CLAUDE.md §3. Buttons meet the 44px touch-target rule (§3.6).
function SupportErrorRecovery({ error, onRetry, onReload, onReport, hostSupportModal }) {
  const { isOpen } = useSupportReport();
  const message = errorMessage(error);

  return (
    <div
      role="alert"
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <LayerSurface
        padding="clamp(24px, 5vw, 40px)"
        gap="16px"
        style={{ maxWidth: "520px", width: "100%", textAlign: "center", alignItems: "center" }}
      >
        {/* Decorative status indicator (not a card/section, so an inline tint is
            allowed under §3.0 rule 5). */}
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "var(--warning-surface)",
            color: "var(--warning-dark)",
            fontSize: "1.5rem",
            fontWeight: 700,
          }}
        >
          !
        </span>

        <h2 style={{ margin: 0, color: "var(--accentText)", fontSize: "1.4rem" }}>
          Something went wrong on this screen
        </h2>
        <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.75, lineHeight: 1.5 }}>
          The page hit an unexpected error. You can try again, reload the app, or send us a report so
          we can fix it.
        </p>
        <p
          style={{
            margin: 0,
            color: "var(--text-1)",
            opacity: 0.55,
            fontSize: "0.8rem",
            wordBreak: "break-word",
          }}
        >
          {message}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center", marginTop: "4px" }}>
          <button type="button" className="app-btn app-btn--primary" onClick={onRetry} style={{ minHeight: "44px" }}>
            Try again
          </button>
          <button type="button" className="app-btn app-btn--secondary" onClick={onReload} style={{ minHeight: "44px" }}>
            Reload app
          </button>
          <button type="button" className="app-btn app-btn--ghost" onClick={onReport} style={{ minHeight: "44px" }}>
            Report a problem
          </button>
        </div>
      </LayerSurface>

      {/* When this is the app-shell boundary, the StaffTopbar (which normally
          hosts the modal) is unmounted, so the recovery screen hosts the popup
          itself. Nested page boundaries leave hostSupportModal false so the
          topbar stays the single host — no duplicate modal. */}
      {hostSupportModal && isOpen && <SupportReportModal />}
    </div>
  );
}

export default function SupportErrorBoundary({ children, fallback, hostSupportModal = false }) {
  const router = useRouter();
  const { recordRenderError, recordDiagnosticEvent, openSupportReport } = useSupportReport();

  const handleReport = React.useCallback(
    ({ error, componentStack }) => {
      // Pre-fill the report from the error; the diagnostics snapshot taken here
      // already contains the recorded render error + recovery timeline, and the
      // provider auto-links route + last section key + resolved code ownership.
      openSupportReport({ prefill: buildBoundaryReportPrefill({ error, componentStack }) });
    },
    [openSupportReport]
  );

  return (
    <SupportErrorBoundaryInner
      fallback={fallback}
      hostSupportModal={hostSupportModal}
      resetKey={router?.asPath}
      onRenderError={recordRenderError}
      onEvent={recordDiagnosticEvent}
      onReport={handleReport}
    >
      {children}
    </SupportErrorBoundaryInner>
  );
}

export { SupportErrorBoundaryInner, SupportErrorRecovery };
