// file location: src/pages/dev/ownership.js
//
// Phase 9 — Developer Platform "Code Ownership" dashboard. Renders the server-
// aggregated ownership map (ownershipGraph.js via /api/support/intelligence): an
// ownership explorer (which files attract the most issues) with clickable source
// refs, module impact roll-ups, a route → module dependency/impact graph, and an
// affected-features overview. Strictly gated to `dev`. CLAUDE.md compliant.

import React from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import useIntelligence from "@/components/dev-platform/useIntelligence";
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

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

function OwnershipView() {
  const { data, loading, error, reload } = useIntelligence({ view: "ownership" });
  const own = data?.ownership;

  if (loading) {
    return (
      <Panel title="Code Ownership" subtitle="Mapping issues to code…">
        <LoadingBlock rows={4} />
      </Panel>
    );
  }
  if (error) {
    return (
      <Panel title="Code Ownership" actions={<DevButton small onClick={reload}>⟳ Retry</DevButton>}>
        <EmptyState icon="⚠️" title="Could not load ownership map" message={error} />
      </Panel>
    );
  }

  const files = own?.files || [];
  const modules = own?.modules || [];
  const edges = own?.edges || [];
  const features = own?.features || [];

  return (
    <>
      <Panel
        title="Code Ownership"
        subtitle="Resolved from data-dev-section-key → source map — no extra instrumentation"
        actions={<DevButton small onClick={reload}>⟳ Refresh</DevButton>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--space-sm)" }}>
          <StatCard label="Files touched" value={files.length} tone="accentText" />
          <StatCard label="Modules" value={modules.length} tone="text-1" />
          <StatCard label="Route→module links" value={edges.length} tone="warning-base" />
          <StatCard label="Features affected" value={features.length} tone="success-base" />
        </div>
      </Panel>

      {features.length > 0 && (
        <Panel title="Affected features" subtitle="Distinct feature areas attracting reports">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {features.map((f) => (
              <Pill key={f.feature} label={`${f.feature} · ${f.total}${f.open ? ` (${f.open} open)` : ""}`} tone={f.open ? "accentText" : "text-1"} strong />
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Ownership explorer" subtitle="Source files ranked by open + total reports">
        {files.length === 0 ? (
          <EmptyState icon="🗺️" title="No ownership data" message="Reports need a resolved source file (section key) to map." />
        ) : (
          files.map((f) => (
            <SubSurface key={f.file} style={{ gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <SourceRef file={f.file} line={f.line} />
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <Pill label={`${f.total} total`} tone="text-1" />
                  {f.open > 0 && <Pill label={`${f.open} open`} tone="accentText" />}
                  {f.regressions > 0 && <Pill label={`${f.regressions} regression`} tone="danger-base" strong />}
                </div>
              </div>
              <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7, wordBreak: "break-word" }}>
                {f.feature ? `feature: ${f.feature}` : ""}{f.routes.length ? ` · routes: ${f.routes.slice(0, 4).join(", ")}${f.routes.length > 4 ? "…" : ""}` : ""}
              </div>
            </SubSurface>
          ))
        )}
      </Panel>

      <Panel title="Module impact" subtitle="Issues rolled up to the owning module">
        {modules.map((m) => (
          <SubSurface key={m.module} style={{ flexDirection: "row", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: "var(--text-1)", wordBreak: "break-word" }}>{m.module}</div>
              <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>{m.fileCount} file(s)</div>
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <Pill label={`${m.total} total`} tone="text-1" />
              {m.open > 0 && <Pill label={`${m.open} open`} tone="accentText" />}
              {m.regressions > 0 && <Pill label={`${m.regressions} regression`} tone="danger-base" strong />}
            </div>
          </SubSurface>
        ))}
      </Panel>

      <Panel title="Dependency / impact map" subtitle="Which routes exercise which modules (weighted)">
        {edges.length === 0 ? (
          <EmptyState icon="🔗" title="No route→module links" message="Links form as reports resolve both a route and a source file." />
        ) : (
          edges.map((e) => (
            <SubSurface key={`${e.route}¦${e.module}`} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "var(--text-body-xs)", color: "var(--accentText)", wordBreak: "break-word" }}>{e.route}</span>
                <span aria-hidden style={{ color: "var(--text-1)", opacity: 0.5 }}>→</span>
                <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", wordBreak: "break-word" }}>{e.module}</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <Pill label={`×${e.weight}`} tone="warning-base" strong />
                {e.open > 0 && <Pill label={`${e.open} open`} tone="accentText" />}
              </div>
            </SubSurface>
          ))
        )}
      </Panel>
    </>
  );
}

export default function DevOwnershipPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Code Ownership — Developer Platform</title>
      </Head>
      <OwnershipView />
    </ProtectedRoute>
  );
}

DevOwnershipPage.getLayout = withDevPlatformLayout({ activeKey: "ownership" });
