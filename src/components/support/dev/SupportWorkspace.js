// file location: src/components/support/dev/SupportWorkspace.js
//
// Help & Diagnostics ("support") — Phase 6. The developer Support Centre
// workspace: dashboard stat cards, advanced filtering, saved views, and an
// impact-sorted report queue with badges. CLAUDE.md compliant (LayerSurface /
// LayerTheme alternation, tokens, no surface borders, DropdownField for selects,
// 44px targets, responsive). Data + optimistic logic live in the hooks; badge /
// sort / group logic in src/lib/support/adminView.js.

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { useSupportReports } from "@/components/support/dev/useSupportAdmin";
import { useSupportKeyboard } from "@/components/support/dev/useSupportKeyboard";
import {
  Panel,
  StatCard,
  Pill,
  BadgeRow,
  EmptyState,
  LoadingBlock,
  DevButton,
} from "@/components/support/dev/supportDevUi";
import {
  STATUS_META,
  SEVERITY_META,
  STATUS_OPTIONS,
  SEVERITY_OPTIONS,
  CATEGORY_OPTIONS,
  SORT_OPTIONS,
  SAVED_VIEW_PRESETS,
  deriveBadges,
} from "@/lib/support/adminView";
import { loadSavedViews, addSavedView, removeSavedView } from "@/lib/support/savedViews";

const relTime = (iso) => {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
};

const withDefault = (options, placeholder) => [{ value: "", label: placeholder }, ...options];

function ReportRow({ report, onOpen, active }) {
  const status = STATUS_META[report.status] || { label: report.status, tone: "text-1" };
  const sev = SEVERITY_META[report.severity] || SEVERITY_META.unset;
  const badges = useMemo(() => deriveBadges(report), [report]);
  const title = report.title || report.description || "(no description)";
  return (
    <button
      type="button"
      onClick={onOpen}
      data-active={active ? "1" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        width: "100%",
        textAlign: "left",
        padding: "12px 8px",
        minHeight: 44,
        cursor: "pointer",
        background: active ? "color-mix(in srgb, var(--accentText) 8%, transparent)" : "transparent",
        borderBottom: "1px solid var(--separating-line)", // allowed: row rule inside a list
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <Pill label={sev.label} tone={sev.tone} strong />
        <Pill label={status.label} tone={status.tone} />
        <span style={{ fontWeight: 600, color: "var(--text-1)", flex: "1 1 240px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
        <BadgeRow badges={badges} />
      </div>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>
        {report.route ? <span>🧭 {report.route}</span> : null}
        {report.reporter_username ? <span>👤 {report.reporter_username}</span> : null}
        {report.app_version ? <span>🏷️ {report.app_version}</span> : null}
        {report.inv_priority ? <span>{report.inv_priority}</span> : null}
        <span>🕑 {relTime(report.created_at)}</span>
      </div>
    </button>
  );
}

export default function SupportWorkspace() {
  const router = useRouter();
  const { reports, count, stats, loading, error, filters, setFilters, view, setView, refresh } = useSupportReports();
  const [savedViews, setSavedViews] = useState(() => loadSavedViews());
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef(null);

  const patchFilter = useCallback((patch) => setFilters((f) => ({ ...f, ...patch, offset: 0 })), [setFilters]);

  const applyView = useCallback(
    (v) => {
      const f = v.filters || {};
      setFilters((prev) => ({
        ...prev,
        status: f.status || "",
        severity: f.severity || "",
        category: f.category || "",
        q: f.q || "",
        unassigned: Boolean(f.unassigned),
        offset: 0,
      }));
      setView({ sort: f.sort || "impact", openOnly: Boolean(f.openOnly), regressionsOnly: Boolean(f.regressionsOnly) });
    },
    [setFilters, setView]
  );

  const openReport = useCallback((id) => router.push(`/dev/support-reports/${id}`), [router]);

  const saveCurrentView = useCallback(() => {
    const name = typeof window !== "undefined" ? window.prompt("Name this view") : null;
    if (!name) return;
    const next = addSavedView(
      { name, filters: { ...filters, sort: view.sort, openOnly: view.openOnly, regressionsOnly: view.regressionsOnly } },
      undefined
    );
    setSavedViews(next);
  }, [filters, view]);

  // Keyboard shortcuts: j/k move, Enter open, r refresh, / focus search.
  useSupportKeyboard(
    useMemo(
      () => [
        { key: "j", handler: () => setActiveIndex((i) => Math.min(i + 1, reports.length - 1)) },
        { key: "k", handler: () => setActiveIndex((i) => Math.max(i - 1, 0)) },
        { key: "Enter", handler: () => reports[activeIndex] && openReport(reports[activeIndex].id) },
        { key: "r", handler: () => refresh() },
        { key: "/", handler: () => searchRef.current?.focus() },
      ],
      [reports, activeIndex, openReport, refresh]
    )
  );

  const statCards = [
    { label: "Open", value: stats?.open ?? "—", tone: "accentText", view: { openOnly: true, sort: "impact" } },
    { label: "Unassigned", value: stats?.unassigned ?? "—", tone: "warning-base", view: { unassigned: true, openOnly: true } },
    { label: "Regressions", value: stats?.regressions ?? "—", tone: "danger-base", view: { regressionsOnly: true } },
    { label: "Critical", value: stats?.bySeverity?.critical ?? 0, tone: "danger-base", view: { severity: "critical" } },
    { label: "Last 24h", value: stats?.last24h ?? "—", tone: "success-base" },
    { label: "Total", value: stats?.total ?? count, tone: "text-1" },
  ];

  return (
    <LayerSurface sectionKey="support-centre-workspace" style={{ gap: "var(--page-stack-gap)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-md)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "var(--text-h2, 22px)", fontWeight: 800, color: "var(--accentText)" }}>Support Centre</div>
          <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.75 }}>
            Help &amp; Diagnostics reports · {count} total · press <kbd>/</kbd> to search, <kbd>j</kbd>/<kbd>k</kbd> to move, <kbd>Enter</kbd> to open
          </div>
        </div>
        <DevButton onClick={refresh} tone="accentText">↻ Refresh</DevButton>
      </div>

      {/* Dashboard */}
      <Panel title="Dashboard" sectionKey="support-centre-dashboard">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "var(--space-sm)" }}>
          {statCards.map((c) => (
            <StatCard
              key={c.label}
              label={c.label}
              value={c.value}
              tone={c.tone}
              onClick={c.view ? () => applyView({ filters: c.view }) : undefined}
            />
          ))}
        </div>
      </Panel>

      {/* Filters + saved views */}
      <Panel
        title="Filters"
        sectionKey="support-centre-filters"
        actions={<DevButton small onClick={saveCurrentView}>＋ Save view</DevButton>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-sm)" }}>
          <input
            ref={searchRef}
            className="app-input"
            placeholder="Search title, description, route…"
            value={filters.q || ""}
            onChange={(e) => patchFilter({ q: e.target.value })}
            style={{ minHeight: 44, padding: "8px 12px", borderRadius: "var(--radius-md)", background: "var(--surface)", color: "var(--text-1)" }}
          />
          <DropdownField options={withDefault(STATUS_OPTIONS, "All statuses")} value={filters.status || ""} onChange={(e) => patchFilter({ status: e.target.value })} />
          <DropdownField options={withDefault(SEVERITY_OPTIONS, "All severities")} value={filters.severity || ""} onChange={(e) => patchFilter({ severity: e.target.value })} />
          <DropdownField options={withDefault(CATEGORY_OPTIONS, "All categories")} value={filters.category || ""} onChange={(e) => patchFilter({ category: e.target.value })} />
          <DropdownField options={SORT_OPTIONS} value={view.sort || "impact"} onChange={(e) => setView((v) => ({ ...v, sort: e.target.value }))} />
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.6 }}>Views:</span>
          {SAVED_VIEW_PRESETS.map((v) => (
            <DevButton key={v.id} small variant="ghost" onClick={() => applyView(v)}>{v.name}</DevButton>
          ))}
          {savedViews.map((v) => (
            <span key={v.id} style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
              <DevButton small variant="ghost" tone="success-base" onClick={() => applyView(v)}>{v.name}</DevButton>
              <button
                type="button"
                title="Remove saved view"
                onClick={() => setSavedViews(removeSavedView(v.id, undefined))}
                style={{ background: "transparent", color: "var(--text-1)", opacity: 0.5, cursor: "pointer", fontSize: "12px", minHeight: 32, padding: "0 4px" }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </Panel>

      {/* Queue */}
      <Panel title={`Queue (${reports.length})`} sectionKey="support-centre-queue">
        {loading ? (
          <LoadingBlock rows={5} />
        ) : error ? (
          <EmptyState icon="⚠️" title="Couldn't load reports" message={error} action={<DevButton onClick={refresh}>Try again</DevButton>} />
        ) : reports.length === 0 ? (
          <EmptyState icon="✅" title="No reports match" message="Nothing matches the current filters. Adjust the filters or clear them." action={<DevButton onClick={() => applyView({ filters: {} })}>Clear filters</DevButton>} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {reports.map((r, i) => (
              <ReportRow key={r.id} report={r} active={i === activeIndex} onOpen={() => { setActiveIndex(i); openReport(r.id); }} />
            ))}
          </div>
        )}
      </Panel>
    </LayerSurface>
  );
}
