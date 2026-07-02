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
  Pill,
  EmptyState,
  LoadingBlock,
  DevButton,
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
      <Panel title="Releases" actions={<DevButton small onClick={reload}>Retry</DevButton>}>
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
        actions={<DevButton small onClick={reload}>Refresh</DevButton>}
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
            <DevButton variant="solid" tone="danger-base" onClick={applyAutoReopen} disabled={reopening}>
              {reopening ? "Reopening…" : `Reopen all (${autoReopen.length})`}
            </DevButton>
          }
        >
          {autoReopen.map((c) => (
            <SubSurface key={c.id} style={{ gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: "var(--text-1)", wordBreak: "break-word" }}>{c.route || c.id}</span>
                <Pill label={`was ${c.fromStatus}`} tone="text-1" />
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
                <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>
                  {t.commit ? `${t.commit.slice(0, 8)} · ` : ""}{t.firstSeen ? new Date(t.firstSeen).toLocaleDateString() : ""} · {t.reportCount} report(s)
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                {t.regressions > 0 && <Pill label={`${t.regressions} regression`} tone="danger-base" strong />}
                <Pill label={`quality ${t.qualityScore}`} tone={qualityTone(t.qualityScore)} strong />
                {t.qualityDelta != null && (
                  <Pill label={`${t.qualityDelta >= 0 ? "+" : "−"}${Math.abs(t.qualityDelta)}`} tone={t.qualityDelta >= 0 ? "success-base" : "danger-base"} />
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
              <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>{rl.ref || rl.commit || ""}</div>
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <Pill label={`${rl.reportCount} reports`} tone="text-1" />
              {rl.open > 0 && <Pill label={`${rl.open} open`} tone="accentText" />}
              {rl.regressions > 0 && <Pill label={`${rl.regressions} regression`} tone="danger-base" strong />}
              <Pill label={`quality ${rl.qualityScore}`} tone={qualityTone(rl.qualityScore)} strong />
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
                  <Pill label={`×${inc.occurrences}`} tone="warning-base" strong />
                  {inc.regression && <Pill label="Regression" tone="danger-base" strong />}
                  {inc.open > 0 && <Pill label={`${inc.open} open`} tone="accentText" />}
                </div>
              </div>
              <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>
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
