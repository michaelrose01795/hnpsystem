// file location: src/pages/dev/feedback-diagnostics.js
//
// Phase 10 — Developer Platform "Feedback & Errors" inspector. The dev-facing
// diagnostics surface for the whole Frontend Feedback & Error System: it reads
// the live, globally-reachable feedback state (feedbackDevBridge +
// window.__HNP_FEEDBACK__), the support-report context (Phase 2/4/9), and the
// active toast stack, and lays them out with the shared dev UI toolkit.
//
// It answers, at a glance: what was the last error surfaced to a user, what is
// its reference code, is a support report / boundary recovery currently open,
// and what does the sanitised diagnostics snapshot look like right now. Strictly
// gated to `dev`. CLAUDE.md compliant (LayerSurface toolkit, tokens, no borders).

import React from "react";
import Head from "next/head";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import { useSupportReport } from "@/context/SupportReportContext";
import { reportError, reportWarning, reportSuccess } from "@/lib/notifications/report";
import { getFeedbackState, subscribeFeedbackState } from "@/lib/support/feedbackDevBridge";
import {
  Panel,
  SubSurface,
  StatCard,
  Pill,
  KeyValue,
  KeyValueGrid,
  EmptyState,
  DevButton,
  DashboardGrid,
} from "@/components/support/dev/supportDevUi";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

const relTime = (iso) => {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "—";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
};

// The Feedback System primitives, so a developer can see the standard at a glance
// and confirm which layer owns each surface.
const PRIMITIVES = [
  { phase: "P3", surface: "Reporting", detail: "reportError / reportApiError / reportSuccess / reportInfo / reportWarning" },
  { phase: "P5", surface: "API/DB errors", detail: "ApiError + friendlyKeyForError → friendly message + devInfo" },
  { phase: "P6", surface: "Loading", detail: "LoadingSkeleton / InlineLoading + <Button busy>" },
  { phase: "P7", surface: "Empty", detail: ".app-empty-state / <EmptyState>" },
  { phase: "P8", surface: "Validation", detail: "useFormValidation + <FieldError> / <FormErrorSummary>" },
  { phase: "P9", surface: "Boundaries", detail: "RouteBoundary / SectionBoundary + reference-coded recovery" },
];

function useFeedbackState() {
  const [state, setState] = React.useState(() => getFeedbackState());
  React.useEffect(() => {
    // Refresh on every reported error, and poll lightly so relative times tick.
    const unsub = subscribeFeedbackState(setState);
    const id = setInterval(() => setState(getFeedbackState()), 5000);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, []);
  return state;
}

function FeedbackDiagnosticsView() {
  const feedback = useFeedbackState();
  const { isOpen, snapshot, prefill, captureDiagnostics, openSupportReport } = useSupportReport();
  const [snap, setSnap] = React.useState(null);

  const lastError = feedback.lastError;
  const recent = feedback.recent || [];
  const reports = feedback.reportsCreated || [];
  const clickReports = reports.filter((r) => r.origin === "error-toast");

  const takeSnapshot = () => {
    try {
      setSnap(captureDiagnostics ? captureDiagnostics() : null);
    } catch {
      setSnap(null);
    }
  };

  const active = snap || snapshot || null;

  return (
    <>
      <Panel
        title="Feedback & Errors"
        subtitle="Live state of the Frontend Feedback & Error System (Phases 2–9)."
        actions={
          <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
            <DevButton small onClick={takeSnapshot}>Capture snapshot</DevButton>
            <DevButton small onClick={() => openSupportReport()}>Open report</DevButton>
          </div>
        }
      />

      <DashboardGrid min={220}>
        <StatCard label="Latest reference code" value={feedback.latestReferenceCode || "—"} tone={feedback.latestReferenceCode ? "warning-base" : "text-1"} />
        <StatCard label="Errors traced (recent)" value={recent.length} tone={recent.length ? "danger-base" : "success-base"} />
        <StatCard label="Reports from clicked errors" value={clickReports.length} tone={clickReports.length ? "warning-base" : "text-1"} />
        <StatCard label="Last error" value={lastError ? relTime(lastError.at) : "none"} tone={lastError ? "warning-base" : "success-base"} />
      </DashboardGrid>

      <DashboardGrid min={420}>
        {/* Last surfaced error */}
        <Panel title="Last error shown to a user">
          {lastError ? (
            <KeyValueGrid>
              <KeyValue label="Reference" value={lastError.referenceCode || "—"} />
              <KeyValue label="Message" value={lastError.message || "—"} />
              <KeyValue label="Kind" value={lastError.kind || "—"} />
              <KeyValue label="Source" value={lastError.source || "—"} />
              <KeyValue label="When" value={relTime(lastError.at)} />
            </KeyValueGrid>
          ) : (
            <EmptyState title="No errors yet" message="Nothing has been reported through the Phase-3 helpers this session." />
          )}
        </Panel>

        {/* Support-report / boundary context */}
        <Panel title="Support report & boundary">
          <KeyValueGrid>
            <KeyValue label="Report popup" value={isOpen ? "open" : "closed"} tone={isOpen ? "warning-base" : undefined} />
            <KeyValue label="Prefill category" value={prefill?.category || "—"} />
            <KeyValue label="Prefill reference" value={prefill?.referenceCode || "—"} />
            <KeyValue label="Snapshot captured" value={active ? "yes" : "no"} />
          </KeyValueGrid>
          <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.7 }}>
            RouteBoundary / SectionBoundary recovery screens mint a reference code and route their report through this same context.
          </div>
        </Panel>
      </DashboardGrid>

      {/* Recent traced errors (reference-coded) */}
      <Panel title={`Recent traced errors (${recent.length})`}>
        {recent.length === 0 ? (
          <EmptyState title="No traced errors" message="Reference-coded errors from reportError appear here (newest last)." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {recent
              .slice()
              .reverse()
              .map((e, i) => (
                <SubSurface key={`${e.referenceCode}-${i}`} style={{ gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <Pill label={e.referenceCode} tone="warning-base" strong />
                    <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)" }}>{e.message}</span>
                    <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.6, marginLeft: "auto" }}>
                      {relTime(e.at)}
                    </span>
                  </div>
                </SubSurface>
              ))}
          </div>
        )}
      </Panel>

      {/* Reports created from clicked errors (Phase 10.1) */}
      <Panel title={`Reports created from clicked errors (${clickReports.length})`}>
        {clickReports.length === 0 ? (
          <EmptyState
            title="No click-to-report reports yet"
            message="When a user clicks “Report this problem” on an error/warning toast, the filed report appears here (routed to Developer Platform → Support)."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {clickReports
              .slice()
              .reverse()
              .map((r, i) => (
                <SubSurface key={`${r.referenceCode || "noref"}-${r.at}-${i}`} style={{ gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <Pill label={r.referenceCode || "no ref"} tone="warning-base" strong />
                    <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)" }}>{r.message || "(no message)"}</span>
                    <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.6, marginLeft: "auto" }}>
                      {relTime(r.at)}
                    </span>
                  </div>
                </SubSurface>
              ))}
          </div>
        )}
        <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.7 }}>
          Full reports (with the private diagnostics + devInfo) live in{" "}
          <Link href="/dev/support" style={{ color: "var(--accentText)" }}>Developer Platform → Support</Link>.
        </div>
      </Panel>

      {/* Live snapshot preview */}
      {active && (
        <Panel title="Diagnostics snapshot (sanitised)">
          <KeyValueGrid>
            <KeyValue label="Route" value={active.route?.asPath || active.route?.pathname || "—"} />
            <KeyValue label="Auth status" value={active.session?.authStatus || "—"} />
            <KeyValue label="Roles" value={(active.session?.roles || []).join(", ") || "—"} />
            <KeyValue label="Section key" value={active.sectionKey || "—"} />
            <KeyValue label="Build" value={active.build?.version || active.build?.commit || "—"} />
            <KeyValue label="Recent actions" value={(active.recent_actions || []).length} />
            <KeyValue label="Unhandled errors" value={(active.unhandled_errors || []).length} />
          </KeyValueGrid>
        </Panel>
      )}

      {/* The standard, plus test emitters so a dev can exercise the pipeline. */}
      <Panel
        title="Feedback primitives (the standard)"
        actions={
          <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
            <DevButton small onClick={() => reportError("Test error from feedback diagnostics.", new Error("synthetic test error"), { source: "dev:feedback-diagnostics" })}>
              Emit error
            </DevButton>
            <DevButton small onClick={() => reportWarning("Test warning from feedback diagnostics.")}>Emit warning</DevButton>
            <DevButton small onClick={() => reportSuccess("Test success from feedback diagnostics.")}>Emit success</DevButton>
          </div>
        }
      >
        <KeyValueGrid>
          {PRIMITIVES.map((p) => (
            <KeyValue key={p.phase} label={`${p.phase} · ${p.surface}`} value={p.detail} />
          ))}
        </KeyValueGrid>
      </Panel>
    </>
  );
}

export default function FeedbackDiagnosticsPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Feedback &amp; Errors — Developer Platform</title>
      </Head>
      <FeedbackDiagnosticsView />
    </ProtectedRoute>
  );
}

FeedbackDiagnosticsPage.getLayout = withDevPlatformLayout({ activeKey: "feedback" });
