// file location: src/components/dev-platform/sections/InvestigationsSection.js
//
// Phase 9 content, Phase 11 extraction — the "Intelligence" / Investigations
// view. Renders the server-aggregated analytics (from /api/support/intelligence,
// computed by the pure engines in src/lib/dev-platform/): roll-up stats, a volume
// trend, ranked problem areas with clickable source refs, recurring incident
// clusters, and predictive "rising problem area" insights, plus intelligent bulk
// issue management (multi-select clusters → bulk triage with a searchable
// developer picker). Rendered by both the standalone /dev/intelligence page and
// the Support hub's "Investigations" tab. CLAUDE.md compliant.

import React, { useMemo, useState } from "react";
import useIntelligence from "@/components/dev-platform/useIntelligence";
import DeveloperPicker from "@/components/dev-platform/DeveloperPicker";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { useAlerts } from "@/context/AlertContext";
import { STATUS_OPTIONS } from "@/lib/support/adminView";
import {
  Panel,
  SubSurface,
  StatCard,
  Pill,
  EmptyState,
  LoadingBlock,
  DevButton,
  SourceRef,
} from "@/components/support/dev/supportDevUi";

const SEV_TONE = ["text-1", "success-base", "warning-base", "danger-base", "danger-base"];

function TrendBars({ series = [] }) {
  const max = Math.max(1, ...series.map((b) => b.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: 72, minWidth: 0, overflowX: "auto" }}>
      {series.map((b) => (
        <div key={b.date} title={`${b.date}: ${b.count} report(s), ${b.regressions} regression(s)`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", flex: "1 0 14px" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 56, width: "100%" }}>
            <div
              style={{
                height: `${(b.count / max) * 100}%`,
                minHeight: b.count ? 3 : 0,
                borderRadius: "var(--radius-sm, 4px)",
                background: b.regressions ? "var(--danger-base)" : "var(--accentText)",
                opacity: b.count ? 0.85 : 0.15,
              }}
            />
          </div>
          <span style={{ fontSize: "9px", color: "var(--text-1)", opacity: 0.5 }}>{b.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function InvestigationsSection() {
  const { data, loading, error, reload, bulkTriage } = useIntelligence({ view: "all" });
  const { pushAlert } = useAlerts();
  const [selected, setSelected] = useState(() => new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkAssignee, setBulkAssignee] = useState(null);
  const [applying, setApplying] = useState(false);

  const intel = data?.intelligence;
  const directory = data?.directory || [];

  const clusters = useMemo(() => intel?.clusters || [], [intel]);
  const selectedIds = useMemo(() => {
    const ids = [];
    for (const c of clusters) if (selected.has(c.key)) ids.push(...c.reportIds);
    return Array.from(new Set(ids));
  }, [clusters, selected]);

  const toggleCluster = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const applyBulk = async () => {
    const updates = {};
    if (bulkStatus) updates.status = bulkStatus;
    if (bulkAssignee !== null) updates.assignedTo = bulkAssignee;
    if (Object.keys(updates).length === 0) {
      pushAlert("Pick a status or assignee to apply.", "error");
      return;
    }
    setApplying(true);
    try {
      const res = await bulkTriage({ ids: selectedIds, updates });
      pushAlert(`Updated ${res.updated} report(s)${res.failed ? `, ${res.failed} failed` : ""}.`, "success");
      setSelected(new Set());
      setBulkStatus("");
      setBulkAssignee(null);
      reload();
    } catch (err) {
      pushAlert(err?.message || "Bulk update failed.", "error");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <Panel title="Intelligence" subtitle="Aggregating investigations…">
        <LoadingBlock rows={4} />
      </Panel>
    );
  }
  if (error) {
    return (
      <Panel title="Intelligence" actions={<DevButton small onClick={reload}>⟳ Retry</DevButton>}>
        <EmptyState icon="⚠️" title="Could not load intelligence" message={error} />
      </Panel>
    );
  }

  const r = intel?.rollup || {};
  const predictions = intel?.predictions || [];
  const problemAreas = intel?.problemAreas || [];

  return (
    <>
      <Panel
        title="Intelligence"
        subtitle={`${intel?.reportCount || 0} report(s) analysed · generated ${new Date(intel?.generatedAt || Date.now()).toLocaleTimeString()}`}
        actions={<DevButton small onClick={reload}>⟳ Refresh</DevButton>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "var(--space-sm)" }}>
          <StatCard label="Open" value={r.open ?? 0} tone="accentText" />
          <StatCard label="Regressions" value={r.regressions ?? 0} tone="danger-base" />
          <StatCard label="Unassigned" value={r.unassigned ?? 0} tone="warning-base" />
          <StatCard label="Code drift" value={r.drift ?? 0} tone="warning-base" />
          <StatCard label="Problem areas" value={r.problemAreas ?? 0} tone="text-1" />
          <StatCard label="Avg confidence" value={r.avgConfidence != null ? `${Math.round(r.avgConfidence * 100)}%` : "—"} tone="success-base" />
        </div>
      </Panel>

      <Panel title="Report volume" subtitle="Daily reports over the trailing window (red = regressions present)">
        <TrendBars series={intel?.trend || []} />
      </Panel>

      {predictions.length > 0 && (
        <Panel title="Predictive insights" subtitle="Problem areas trending up before they escalate">
          {predictions.map((p) => (
            <SubSurface key={p.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "var(--text-1)", wordBreak: "break-word" }}>{p.route || p.key}</div>
                <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.8 }}>{p.message}</div>
              </div>
              <Pill label={p.severity === "high" ? "Rising fast" : "Rising"} tone={p.severity === "high" ? "danger-base" : "warning-base"} strong />
            </SubSurface>
          ))}
        </Panel>
      )}

      <Panel title="Problem areas" subtitle="Routes / sections producing the most (and most severe) reports">
        {problemAreas.length === 0 ? (
          <EmptyState icon="✅" title="No problem areas" message="No reports to rank yet." />
        ) : (
          problemAreas.map((a) => (
            <SubSurface key={a.key} style={{ gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, color: "var(--accentText)", wordBreak: "break-word" }}>{a.route || a.key}</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <Pill label={`${a.total} total`} tone="text-1" />
                  {a.open > 0 && <Pill label={`${a.open} open`} tone="accentText" />}
                  {a.regressions > 0 && <Pill label={`${a.regressions} regression`} tone="danger-base" strong />}
                </div>
              </div>
              {a.sectionKey && <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>section: {a.sectionKey}</div>}
              {a.sourceFile && <SourceRef file={a.sourceFile} line={a.sourceLine} />}
            </SubSurface>
          ))
        )}
      </Panel>

      <Panel
        title="Incident clusters"
        subtitle="Recurring incidents grouped by fingerprint — select to bulk-triage"
      >
        {clusters.length === 0 ? (
          <EmptyState icon="🧩" title="No recurring clusters" message="Every incident so far is unique." />
        ) : (
          clusters.map((c) => (
            <SubSurface key={c.key} style={{ flexDirection: "row", alignItems: "flex-start", gap: "var(--space-sm)" }}>
              <input
                type="checkbox"
                aria-label={`Select cluster ${c.sample?.title || c.key}`}
                checked={selected.has(c.key)}
                onChange={() => toggleCluster(c.key)}
                style={{ marginTop: 4, width: 18, height: 18, flex: "0 0 auto" }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, color: "var(--text-1)", wordBreak: "break-word" }}>{c.sample?.title || "(untitled incident)"}</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <Pill label={`×${c.count}`} tone="warning-base" strong />
                    {c.open > 0 && <Pill label={`${c.open} open`} tone="accentText" />}
                    {c.regression && <Pill label="Regression" tone="danger-base" strong />}
                    <Pill label={`sev ${c.maxSeverity}`} tone={SEV_TONE[c.maxSeverity] || "text-1"} />
                  </div>
                </div>
                <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7, wordBreak: "break-word" }}>
                  {c.routes.join(", ") || "—"}
                  {c.versions.length ? ` · versions ${c.versions.join(", ")}` : ""}
                </div>
              </div>
            </SubSurface>
          ))
        )}
      </Panel>

      {selectedIds.length > 0 && (
        <Panel title={`Bulk triage — ${selectedIds.length} report(s) in ${selected.size} cluster(s)`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-sm)", alignItems: "end" }}>
            <DropdownField
              label="Set status"
              options={[{ value: "", label: "Leave unchanged" }, ...STATUS_OPTIONS]}
              value={bulkStatus}
              onValueChange={(v) => setBulkStatus(v)}
            />
            <DeveloperPicker directory={directory} value={bulkAssignee} onSelect={setBulkAssignee} />
            <DevButton variant="solid" onClick={applyBulk} disabled={applying}>
              {applying ? "Applying…" : "Apply to selection"}
            </DevButton>
          </div>
        </Panel>
      )}
    </>
  );
}
