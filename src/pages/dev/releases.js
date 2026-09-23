// file location: src/pages/dev/releases.js
//
// Phase 9 — Developer Platform "Releases" dashboard. Renders the server-aggregated
// release intelligence (releaseIntelligence.js via /api/support/intelligence): a
// deployment registry with per-release quality, a deployment timeline, incidents
// tracked across releases, and REGRESSION auto-reopen — one click reopens every
// resolved report that recurred on a newer build (bulk PATCH → status: triaged).
// Strictly gated to `dev`. CLAUDE.md compliant.

import React, { useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import useIntelligence from "@/components/dev-platform/useIntelligence";
import { useAlerts } from "@/context/AlertContext";
import {
  Panel,
  SubSurface,
  StatCard,
  badgeClass,
  EmptyState,
  LoadingBlock,
  DashboardGrid,
} from "@/components/support/dev/supportDevUi";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

const qualityTone = (score) => (score >= 80 ? "success-base" : score >= 50 ? "warning-base" : "danger-base");

function ReleasesView() {
  const { data, loading, error, reload, bulkTriage } = useIntelligence({ view: "releases" });
  const { pushAlert } = useAlerts();
  const [reopening, setReopening] = useState(false);

  const rel = data?.releases;

  const applyAutoReopen = async () => {
    const ids = (rel?.autoReopen || []).map((c) => c.id);
    if (ids.length === 0) return;
    setReopening(true);
    try {
      const res = await bulkTriage({ ids, updates: { status: "triaged" } });
      pushAlert(`Reopened ${res.updated} regressed report(s).`, "success");
      reload();
    } catch (err) {
      pushAlert(err?.message || "Auto-reopen failed.", "error");
    } finally {
      setReopening(false);
    }
  };

  if (loading) {
    return (
      <Panel title="Releases" subtitle="Reconstructing deployments…">
        <LoadingBlock rows={4} />
      </Panel>
    );
  }
  if (error) {
    return (
      <Panel title="Releases" actions={<button type="button" onClick={reload} className="app-btn app-btn--secondary app-btn--sm">Retry</button>}>
        <EmptyState title="Could not load release intelligence" message={error} />
      </Panel>
    );
  }

  const releases = rel?.releases || [];
  const timeline = rel?.timeline || [];
  const incidents = rel?.incidents || [];
  const autoReopen = rel?.autoReopen || [];

  return (
    <>
      <Panel
        title="Releases"
        subtitle={`${rel?.releaseCount || 0} release(s) reconstructed from captured reports`}
        actions={<button type="button" onClick={reload} className="app-btn app-btn--secondary app-btn--sm">Refresh</button>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-sm)" }}>
          <StatCard label="Releases" value={rel?.releaseCount || 0} tone="accentText" />
          <StatCard label="Incidents across releases" value={incidents.length} tone="warning-base" />
          <StatCard label="Regression reopens" value={rel?.autoReopenCount || 0} tone="danger-base" />
        </div>
      </Panel>

      {autoReopen.length > 0 && (
        <Panel
          title="Regression auto-reopen"
          subtitle={`${autoReopen.length} closed report(s) recurred on a newer build`}
          actions={
            <button type="button" onClick={applyAutoReopen} disabled={reopening} className="app-btn app-btn--danger">
              {reopening ? "Reopening…" : `Reopen all (${autoReopen.length})`}
            </button>
          }
        >
          {autoReopen.map((c) => (
            <SubSurface key={c.id} style={{ gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: "var(--text-1)", wordBreak: "break-word" }}>{c.route || c.id}</span>
                <span className="app-badge app-badge--neutral">{`was ${c.fromStatus}`}</span>
              </div>
              <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.8 }}>{c.reason}</div>
            </SubSurface>
          ))}
        </Panel>
      )}

      <DashboardGrid min={420}>
      <Panel title="Deployment timeline" subtitle="Oldest to newest, with quality change per deploy">
        {timeline.length === 0 ? (
          <EmptyState title="No deployments yet" message="Version/commit pinning populates in deployed environments." />
        ) : (
          timeline.map((t) => (
            <SubSurface key={t.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "var(--accentText)" }}>{t.version || t.key}</div>
                <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.7 }}>
                  {t.commit ? `${t.commit.slice(0, 8)} · ` : ""}{t.firstSeen ? new Date(t.firstSeen).toLocaleDateString() : ""} · {t.reportCount} report(s)
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                {t.regressions > 0 && <span className="app-badge app-badge--danger-strong">{`${t.regressions} regression`}</span>}
                <span className={badgeClass(qualityTone(t.qualityScore), true)}>{`quality ${t.qualityScore}`}</span>
                {t.qualityDelta != null && (
                  <span className={badgeClass(t.qualityDelta >= 0 ? "success-base" : "danger-base")}>{`${t.qualityDelta >= 0 ? "+" : "−"}${Math.abs(t.qualityDelta)}`}</span>
                )}
              </div>
            </SubSurface>
          ))
        )}
      </Panel>

      <Panel title="Release quality" subtitle="Per-release open / regression roll-up (newest first)">
        {releases.map((rl) => (
          <SubSurface key={rl.key} style={{ flexDirection: "row", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "var(--text-1)" }}>{rl.version || rl.key}</div>
              <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.7 }}>{rl.ref || rl.commit || ""}</div>
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <span className="app-badge app-badge--neutral">{`${rl.reportCount} reports`}</span>
              {rl.open > 0 && <span className="app-badge app-badge--accent-soft">{`${rl.open} open`}</span>}
              {rl.regressions > 0 && <span className="app-badge app-badge--danger-strong">{`${rl.regressions} regression`}</span>}
              <span className={badgeClass(qualityTone(rl.qualityScore), true)}>{`quality ${rl.qualityScore}`}</span>
            </div>
          </SubSurface>
        ))}
      </Panel>
      </DashboardGrid>

      <Panel title="Incidents across releases" subtitle="Recurring incidents and the version span they cover">
        {incidents.length === 0 ? (
          <EmptyState title="No cross-release incidents" message="No incident has recurred across releases yet." />
        ) : (
          incidents.map((inc) => (
            <SubSurface key={inc.key} style={{ gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: "var(--text-1)", wordBreak: "break-word" }}>{inc.sample?.title || "(untitled incident)"}</span>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <span className="app-badge app-badge--warning-strong">{`×${inc.occurrences}`}</span>
                  {inc.regression && <span className="app-badge app-badge--danger-strong">Regression</span>}
                  {inc.open > 0 && <span className="app-badge app-badge--accent-soft">{`${inc.open} open`}</span>}
                </div>
              </div>
              <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.7 }}>
                {inc.firstVersion || "?"} → {inc.lastVersion || "?"}
                {inc.versions.length ? ` · seen on ${inc.versions.join(", ")}` : ""}
              </div>
            </SubSurface>
          ))
        )}
      </Panel>
    </>
  );
}

export default function DevReleasesPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Releases — Developer Platform</title>
      </Head>
      <ReleasesView />
    </ProtectedRoute>
  );
}

DevReleasesPage.getLayout = withDevPlatformLayout({ activeKey: "releases" });
