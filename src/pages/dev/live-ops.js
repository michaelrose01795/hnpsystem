// file location: src/pages/dev/live-ops.js
//
// Phase 8 — Developer Platform "Live Operations". A real-time view over the
// capture ring buffers + subsystem service status. It reads the SAME sanitised
// diagnostics bundle the "?" reporter would attach (via the existing
// useSupportReport().captureDiagnostics()), polled on an interval — so it
// introduces NO new privacy surface and needs no change to SupportReportContext.
// Strictly gated to the `dev` role.

import React, { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import { useSupportReport } from "@/context/SupportReportContext";
import {
  Panel,
  SubSurface,
  Pill,
  DevButton,
  EmptyState,
  DashboardGrid,
} from "@/components/support/dev/supportDevUi";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());
const POLL_MS = 4000;

const HEALTH_TONE = { ok: "success-base", warn: "warning-base", fail: "danger-base" };

function formatTime(ts) {
  if (!ts) return "";
  const d = typeof ts === "number" ? new Date(ts) : new Date(String(ts));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString();
}

function EventRow({ time, primary, secondary, tone }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "10px",
        alignItems: "baseline",
        // Row rule uses the ONLY allowed list separator token (Border Law).
        borderBottom: "1px solid var(--separating-line)",
        padding: "6px 0",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          fontSize: "var(--text-body-xs)",
          color: "var(--text-1)",
          opacity: 0.6,
          whiteSpace: "nowrap",
        }}
      >
        {formatTime(time) || "—"}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ color: tone ? `var(--${tone})` : "var(--text-1)", fontSize: "var(--text-body-sm)", wordBreak: "break-word" }}>
          {primary}
        </span>
        {secondary ? (
          <span style={{ display: "block", fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.6, wordBreak: "break-word" }}>
            {secondary}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function EventList({ items, renderRow, emptyMessage }) {
  if (!items || items.length === 0) {
    return <EmptyState title="Nothing recent" message={emptyMessage} />;
  }
  // Newest first for a live feed.
  return <div>{[...items].reverse().map(renderRow)}</div>;
}

function LiveOpsView() {
  const { captureDiagnostics } = useSupportReport();
  const [snapshot, setSnapshot] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [paused, setPaused] = useState(false);
  const [health, setHealth] = useState(null);
  const timerRef = useRef(null);

  const refresh = useCallback(() => {
    try {
      setSnapshot(captureDiagnostics());
      setUpdatedAt(new Date());
    } catch {
      /* capture is defensive; ignore a transient failure */
    }
  }, [captureDiagnostics]);

  const probeHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/support/health", { credentials: "include" });
      const data = await res.json().catch(() => null);
      setHealth(data);
    } catch {
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    probeHealth();
  }, [refresh, probeHealth]);

  useEffect(() => {
    if (paused) return undefined;
    timerRef.current = window.setInterval(refresh, POLL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [paused, refresh]);

  const consoleErrors = snapshot?.console_errors || [];
  const failedRequests = snapshot?.failed_requests || [];
  const recentActions = snapshot?.recent_actions || [];
  const unhandled = snapshot?.unhandled_errors || [];

  const checks = health?.checks || {};
  const checkEntries = Object.entries(checks);

  return (
    <>
      <Panel
        title="Live operations"
        subtitle={updatedAt ? `Updated ${updatedAt.toLocaleTimeString()} · refreshes every ${POLL_MS / 1000}s` : "Starting live feed…"}
        actions={
          <>
            <DevButton small onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume" : "Pause"}
            </DevButton>
            <DevButton small onClick={() => { refresh(); probeHealth(); }}>
              Refresh
            </DevButton>
          </>
        }
      >
        {/* Service status strip */}
        <SubSurface style={{ gap: "8px" }}>
          <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>
            Service status
          </div>
          {checkEntries.length === 0 ? (
            <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.7 }}>
              Health roll-up unavailable.
            </span>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {checkEntries.map(([name, check]) => (
                <Pill
                  key={name}
                  label={`${name}: ${check?.status || "?"}`}
                  tone={HEALTH_TONE[check?.status] || "text-1"}
                  title={check?.note || ""}
                  strong
                />
              ))}
            </div>
          )}
        </SubSurface>
      </Panel>

      <DashboardGrid min={440}>
      <Panel title="Runtime events" subtitle={`${recentActions.length} recent action(s) — route changes and interactions`}>
        <EventList
          items={recentActions}
          emptyMessage="No route changes or interactions captured yet."
          renderRow={(a, i) => (
            <EventRow
              key={`act-${i}`}
              time={a.ts}
              primary={a.type === "route_change" ? `Route → ${a.to || "?"}` : a.label || a.type}
              secondary={a.sectionKey ? `section: ${a.sectionKey}` : a.from ? `from ${a.from}` : ""}
            />
          )}
        />
      </Panel>

      <Panel title="Console errors" subtitle={`${consoleErrors.length} captured`}>
        <EventList
          items={consoleErrors}
          emptyMessage="No console errors captured."
          renderRow={(c, i) => (
            <EventRow key={`con-${i}`} time={c.ts} primary={c.msg || c.message} secondary={c.level ? `level: ${c.level}` : ""} tone="danger-base" />
          )}
        />
      </Panel>

      <Panel title="Failed requests" subtitle={`${failedRequests.length} non-2xx captured (no bodies)`}>
        <EventList
          items={failedRequests}
          emptyMessage="No failed requests captured."
          renderRow={(r, i) => (
            <EventRow
              key={`req-${i}`}
              time={r.ts}
              primary={`${r.status || "?"} · ${r.method || "GET"} ${r.url || ""}`}
              secondary={typeof r.ms === "number" ? `${r.ms}ms` : ""}
              tone="warning-base"
            />
          )}
        />
      </Panel>

      <Panel title="Unhandled errors" subtitle={`${unhandled.length} captured`}>
        <EventList
          items={unhandled}
          emptyMessage="No unhandled errors captured."
          renderRow={(e, i) => (
            <EventRow key={`err-${i}`} time={e.ts} primary={e.message} secondary={e.componentStack ? "component stack captured" : ""} tone="danger-base" />
          )}
        />
      </Panel>
      </DashboardGrid>
    </>
  );
}

export default function DevLiveOpsPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Live Operations — Developer Platform</title>
      </Head>
      <LiveOpsView />
    </ProtectedRoute>
  );
}

DevLiveOpsPage.getLayout = withDevPlatformLayout({ activeKey: "live-ops" });
