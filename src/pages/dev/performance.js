// file location: src/pages/dev/performance.js
//
// Phase 9 — Developer Platform "Performance" dashboard. Profiles the CURRENT
// session from the same sanitised bundle Live Ops polls
// (useSupportReport().captureDiagnostics()), aggregated client-side by the pure
// performanceInsights.js engine — so it adds NO new capture path and NO new
// privacy surface (names + durations only, never request bodies). Shows frontend
// timing, an API request timeline / failing-endpoint table, and the execution
// flow that led there. Strictly gated to `dev`. CLAUDE.md compliant.
//
// NOTE: cross-session DB query-level timing (a persisted trace store) is out of
// scope here and FLAGGED in the living doc — it needs a new store, which Phase 9
// does not introduce. This surface traces the live session's requests instead.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import { useSupportReport } from "@/context/SupportReportContext";
import { buildPerformanceProfile } from "@/lib/dev-platform/performanceInsights";
import {
  Panel,
  SubSurface,
  StatCard,
  Pill,
  KeyValue,
  KeyValueGrid,
  EmptyState,
  DevButton,
} from "@/components/support/dev/supportDevUi";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

const fmtMs = (v) => (v == null ? "—" : `${v}ms`);

function PerformanceView() {
  const { captureDiagnostics } = useSupportReport();
  const [snapshot, setSnapshot] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const refresh = useCallback(() => {
    try {
      setSnapshot(captureDiagnostics());
      setUpdatedAt(new Date());
    } catch {
      /* capture is defensive */
    }
  }, [captureDiagnostics]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const profile = useMemo(() => (snapshot ? buildPerformanceProfile(snapshot) : null), [snapshot]);

  const m = profile?.metrics || {};
  const endpoints = profile?.endpoints || [];
  const timeline = profile?.requestTimeline || [];
  const flow = profile?.executionFlow || [];

  return (
    <>
      <Panel
        title="Performance"
        subtitle={updatedAt ? `Live session profile · captured ${updatedAt.toLocaleTimeString()}` : "Profiling…"}
        actions={<DevButton small onClick={refresh}>⟳ Recapture</DevButton>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "var(--space-sm)" }}>
          <StatCard label="TTFB" value={fmtMs(m.ttfbMs)} tone="accentText" />
          <StatCard label="DOM ready" value={fmtMs(m.domReadyMs)} tone="text-1" />
          <StatCard label="Load" value={fmtMs(m.loadMs)} tone="text-1" />
          <StatCard label="Memory" value={m.memoryUsedMb != null ? `${m.memoryUsedMb}MB` : "—"} tone={m.memoryPressure > 0.8 ? "danger-base" : "success-base"} />
          <StatCard label="Failing requests" value={profile?.totalCapturedRequests ?? 0} tone="warning-base" />
        </div>
      </Panel>

      <Panel title="Failing / slow endpoints" subtitle="Captured non-2xx requests grouped by endpoint (no bodies)">
        {endpoints.length === 0 ? (
          <EmptyState icon="✅" title="No failing requests" message="Nothing non-2xx captured this session." />
        ) : (
          endpoints.map((e) => (
            <SubSurface key={e.endpoint} style={{ flexDirection: "row", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "var(--text-body-sm)", color: "var(--text-1)", wordBreak: "break-word" }}>{e.endpoint}</div>
                <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>
                  {Object.entries(e.statuses).map(([s, c]) => `${s}×${c}`).join(" · ")}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <Pill label={`×${e.count}`} tone="warning-base" strong />
                {e.avgMs != null && <Pill label={`avg ${e.avgMs}ms`} tone="text-1" />}
                {e.maxMs != null && <Pill label={`max ${e.maxMs}ms`} tone={e.maxMs > 1000 ? "danger-base" : "text-1"} />}
                {e.serverErrors > 0 && <Pill label={`${e.serverErrors}× 5xx`} tone="danger-base" strong />}
              </div>
            </SubSurface>
          ))
        )}
      </Panel>

      <Panel title="Request timeline" subtitle="Captured requests in time order">
        {timeline.length === 0 ? (
          <EmptyState icon="📉" title="No request trace" message="No failing requests to trace this session." />
        ) : (
          <div>
            {timeline.map((t, i) => (
              <div
                key={`${t.ts}-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: "10px",
                  alignItems: "baseline",
                  borderBottom: "1px solid var(--separating-line)",
                  padding: "6px 0",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.6, whiteSpace: "nowrap" }}>
                  {t.ts ? new Date(t.ts).toLocaleTimeString() : "—"}
                </span>
                <span style={{ color: `var(--${t.tone})`, fontSize: "var(--text-body-sm)", wordBreak: "break-word" }}>
                  {t.status} · {t.method} {t.path}
                </span>
                <span style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.6 }}>{t.ms != null ? `${t.ms}ms` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Execution flow" subtitle="The route changes + interactions that led here">
        {flow.length === 0 ? (
          <EmptyState icon="🧭" title="No recent actions" message="Navigate around and recapture to see the flow." />
        ) : (
          flow.map((f, i) => (
            <KeyValueGrid key={`${f.ts}-${i}`}>
              <KeyValue
                label={f.kind}
                value={`${f.label}${f.sectionKey ? ` · ${f.sectionKey}` : ""}${f.gapMs != null ? ` (+${f.gapMs}ms)` : ""}`}
                mono
              />
            </KeyValueGrid>
          ))
        )}
      </Panel>
    </>
  );
}

export default function DevPerformancePage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Performance — Developer Platform</title>
      </Head>
      <PerformanceView />
    </ProtectedRoute>
  );
}

DevPerformancePage.getLayout = withDevPlatformLayout({ activeKey: "performance" });
