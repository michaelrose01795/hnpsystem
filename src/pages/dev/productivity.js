// file location: src/pages/dev/productivity.js
//
// Phase 10 — Developer Platform "Productivity" dashboard. Renders the server-
// aggregated engineering throughput metrics (/api/support/platform?view=
// productivity): the reporting window, headline totals + rates as stat cards,
// per-day created/resolved throughput, and a per-developer breakdown
// (assigned / resolved / average resolve time). Read-only. Strictly gated to
// `dev`. CLAUDE.md compliant.

import React from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import usePlatformResource from "@/components/dev-platform/usePlatformResource";
import {
  Panel,
  SubSurface,
  StatCard,
  Pill,
  EmptyState,
  LoadingBlock,
  DevButton,
} from "@/components/support/dev/supportDevUi";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

// Format helpers — every null/undefined renders as an em dash.
const dash = "—";
const num = (v) => (v == null || Number.isNaN(Number(v)) ? dash : Number(v).toLocaleString("en-GB"));
const hrs = (v) => (v == null || Number.isNaN(Number(v)) ? dash : `${Number(v).toFixed(1)} hrs`);
const pct = (v) => (v == null || Number.isNaN(Number(v)) ? dash : `${Math.round(Number(v) * 100)}%`);
const days = (v) => (v == null || Number.isNaN(Number(v)) ? dash : `${Number(v).toFixed(1)} days`);
const fmtDate = (v) => {
  if (!v) return dash;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-GB");
};

function ProductivityView() {
  const { data, loading, error, reload } = usePlatformResource("/api/support/platform?view=productivity");

  if (loading) {
    return (
      <Panel title="Productivity" subtitle="Aggregating engineering throughput…">
        <LoadingBlock rows={4} />
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel title="Productivity" actions={<DevButton small onClick={reload}>⟳ Retry</DevButton>}>
        <EmptyState icon="⚠️" title="Could not load productivity" message={error} />
      </Panel>
    );
  }

  const p = data?.productivity || {};
  const window = p.window || {};
  const totals = p.totals || {};
  const throughput = p.throughput || [];
  const byDeveloper = p.byDeveloper || [];

  const windowSubtitle =
    window.from || window.to
      ? `${window.days != null ? `${window.days}-day window · ` : ""}${fmtDate(window.from)} → ${fmtDate(window.to)}`
      : "Rolling window";

  return (
    <>
      <Panel
        title="Productivity"
        subtitle={windowSubtitle}
        actions={<DevButton small onClick={reload}>⟳ Refresh</DevButton>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-sm)" }}>
          <StatCard label="Created" value={num(totals.created)} tone="accentText" />
          <StatCard label="Resolved" value={num(totals.resolved)} tone="success-base" />
          <StatCard label="Open" value={num(totals.open)} tone="warning-base" />
          <StatCard label="Mean resolve" value={hrs(p.meanTimeToResolveHours)} tone="text-1" />
          <StatCard label="Median resolve" value={hrs(p.medianTimeToResolveHours)} tone="text-1" />
          <StatCard label="Resolution rate" value={pct(p.resolutionRate)} tone="success-base" />
          <StatCard label="Backlog age" value={days(p.backlogAgeDays)} tone="warning-base" />
          <StatCard label="Oldest open" value={days(p.oldestOpenDays)} tone="danger-base" />
        </div>
      </Panel>

      <Panel title="Throughput" subtitle="Created vs. resolved per day">
        {throughput.length === 0 ? (
          <EmptyState icon="📈" title="No throughput yet" message="Daily created/resolved counts appear once activity is recorded." />
        ) : (
          throughput.map((row) => (
            <SubSurface
              key={row.date}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}
            >
              <span style={{ fontWeight: 700, color: "var(--text-1)" }}>{fmtDate(row.date)}</span>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <Pill label={`${num(row.created)} created`} tone="accentText" />
                <Pill label={`${num(row.resolved)} resolved`} tone="success-base" />
              </div>
            </SubSurface>
          ))
        )}
      </Panel>

      <Panel title="By developer" subtitle="Assigned, resolved and average resolve time per developer">
        {byDeveloper.length === 0 ? (
          <EmptyState icon="🧑‍💻" title="No developer breakdown" message="Per-developer metrics appear once reports are assigned and resolved." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                gap: "var(--space-md)",
                padding: "6px 8px",
                fontSize: "var(--text-body-xs)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                color: "var(--text-1)",
                opacity: 0.7,
                fontWeight: 700,
                // Allowed row rule (Border Law: --separating-line on list/table rows).
                // The token is a full shorthand ("1px solid …"), so it is used directly.
                borderBottom: "var(--separating-line)",
              }}
            >
              <span>Developer</span>
              <span style={{ textAlign: "right" }}>Assigned</span>
              <span style={{ textAlign: "right" }}>Resolved</span>
              <span style={{ textAlign: "right" }}>Avg resolve</span>
            </div>
            {byDeveloper.map((dev) => (
              <div
                key={dev.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto auto",
                  gap: "var(--space-md)",
                  padding: "8px",
                  alignItems: "center",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--text-1)",
                  // Allowed row rule (Border Law: --separating-line on list/table rows).
                  // The token is a full shorthand ("1px solid …"), so it is used directly.
                  borderBottom: "var(--separating-line)",
                }}
              >
                <span style={{ fontWeight: 700, wordBreak: "break-word" }}>{dev.key || dash}</span>
                <span style={{ textAlign: "right" }}>{num(dev.assigned)}</span>
                <span style={{ textAlign: "right" }}>{num(dev.resolved)}</span>
                <span style={{ textAlign: "right" }}>{hrs(dev.avgResolveHours)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

export default function DevProductivityPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Productivity — Developer Platform</title>
      </Head>
      <ProductivityView />
    </ProtectedRoute>
  );
}

DevProductivityPage.getLayout = withDevPlatformLayout({ activeKey: "productivity" });
