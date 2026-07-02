// file location: src/components/dev-platform/sections/DevOverviewStats.js
//
// Phase 11.1 — the Developer Platform home is a live statistics dashboard over
// the incoming support reports (not a redirect/tile grid). It reads the same
// dev-gated stats the Support workspace uses (GET /api/support/reports?withStats=1
// → getSupportReportStats): headline counts + status / severity / category
// breakdowns. Borderless LayerSurface panels, token-only colour, 44px targets —
// the same look as the report pages. Strictly dev-gated by its host page.

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Panel,
  SubSurface,
  StatCard,
  Pill,
  LoadingBlock,
  EmptyState,
  DevButton,
} from "@/components/support/dev/supportDevUi";
import { SUPPORT_CATEGORIES } from "@/lib/support/reportSubmission";

const STATUS_LABEL = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In progress",
  resolved: "Resolved",
  wont_fix: "Won’t fix",
  duplicate: "Duplicate",
};
const STATUS_TONE = {
  new: "accentText",
  triaged: "warning-base",
  in_progress: "warning-base",
  resolved: "success-base",
  wont_fix: "text-1",
  duplicate: "text-1",
};
const SEVERITY_LABEL = { unset: "Unset", low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const SEVERITY_TONE = { unset: "text-1", low: "success-base", medium: "warning-base", high: "danger-base", critical: "danger-base" };
const CATEGORY_LABEL = Object.fromEntries(SUPPORT_CATEGORIES.map((c) => [c.value, c.label]));

// One breakdown panel: a labelled count row per key, biggest first.
function Breakdown({ title, subtitle, map, labels, tones }) {
  const entries = Object.entries(map || {}).sort((a, b) => b[1] - a[1]);
  return (
    <Panel title={title} subtitle={subtitle}>
      {entries.length === 0 ? (
        <EmptyState title="Nothing yet" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {entries.map(([key, count]) => (
            <SubSurface
              key={key}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)" }}
            >
              <Pill label={(labels && labels[key]) || key} tone={(tones && tones[key]) || "text-1"} strong />
              <span style={{ fontWeight: 700, fontSize: "var(--text-h4, 15px)", color: "var(--text-1)", fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
                {count}
              </span>
            </SubSurface>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function DevOverviewStats() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/support/reports?withStats=1", { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!body?.success) throw new Error(body?.message || `Stats endpoint returned ${res.status}`);
      setStats(body.stats || null);
    } catch (e) {
      setError(e?.message || "Could not load report statistics.");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openReports = () => router.push("/dev/support?tab=reports");

  return (
    <>
      <Panel
        title="Developer Platform"
        subtitle="Live overview of Help & Diagnostics reports coming in from staff."
        actions={
          <>
            <DevButton small onClick={load}>Refresh</DevButton>
            <DevButton small variant="solid" onClick={openReports}>Open reports</DevButton>
          </>
        }
      >
        {loading && !stats ? (
          <LoadingBlock rows={2} />
        ) : error ? (
          <EmptyState title="Statistics unavailable" message={error} action={<DevButton small onClick={load}>Try again</DevButton>} />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "var(--space-sm)",
            }}
          >
            <StatCard label="Total reports" value={String(stats?.total ?? 0)} tone="text-1" />
            <StatCard label="Open" value={String(stats?.open ?? 0)} tone="accentText" />
            <StatCard label="Unassigned" value={String(stats?.unassigned ?? 0)} tone="warning-base" />
            <StatCard label="Regressions" value={String(stats?.regressions ?? 0)} tone="danger-base" />
            <StatCard label="Last 24 hours" value={String(stats?.last24h ?? 0)} tone="accentText" />
            <StatCard label="Last 7 days" value={String(stats?.last7d ?? 0)} tone="text-1" />
          </div>
        )}
      </Panel>

      {!error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--page-stack-gap, 12px)",
          }}
        >
          <Breakdown title="By status" subtitle="Where reports sit in triage" map={stats?.byStatus} labels={STATUS_LABEL} tones={STATUS_TONE} />
          <Breakdown title="By severity" subtitle="Assigned triage severity" map={stats?.bySeverity} labels={SEVERITY_LABEL} tones={SEVERITY_TONE} />
          <Breakdown title="By category" subtitle="What staff are reporting" map={stats?.byCategory} labels={CATEGORY_LABEL} />
        </div>
      )}
    </>
  );
}
