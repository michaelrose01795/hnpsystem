// file location: src/pages/dev/plugins.js
//
// Phase 10 — Developer Platform "Plugins". A CLIENT-ONLY window onto the platform
// plugin architecture (src/lib/dev-platform/pluginRegistry.js). It is an
// extension point: any HNPSystem module can contribute a diagnostic (capture-time)
// provider, an investigation (dev-only analysis) provider, or a tool (a platform
// surface / action) WITHOUT editing the core. On mount we register the built-in
// diagnostic providers and expose each nav area as a "tool", then read the
// resulting inventory. Registration happens in an effect so SSR / first paint is
// safe (we start from empty groups and populate client-side).

import React from "react";
import Head from "next/head";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import { registerBuiltinDiagnosticProviders } from "@/lib/support/providers";
import {
  getPluginInventory,
  groupPluginsByKind,
  registerTool,
} from "@/lib/dev-platform/pluginRegistry";
import { DEV_PLATFORM_NAV } from "@/components/dev-platform/devPlatformNav";
import {
  Panel,
  SubSurface,
  Pill,
  StatCard,
  EmptyState,
  DashboardGrid,
} from "@/components/support/dev/supportDevUi";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

const EMPTY_GROUPS = { diagnostic: [], investigation: [], tool: [] };

const KIND_META = {
  diagnostic: {
    title: "Diagnostic providers",
    tone: "accentText",
    note: "Capture-time providers that attach context when a report is submitted.",
    empty: "No diagnostic providers registered yet.",
  },
  investigation: {
    title: "Investigation providers",
    tone: "warning-base",
    note: "Dev-only analysers that enrich a report during triage.",
    empty: "No investigation providers registered yet.",
  },
  tool: {
    title: "Tools",
    tone: "success-base",
    note: "Engineering tools and platform surfaces (never capture data).",
    empty: "No tools registered yet.",
  },
};

function PluginRow({ plugin }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-md)",
        flexWrap: "wrap",
        padding: "8px 0",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Pill label={plugin.id} tone="text-1" style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }} />
          <strong style={{ fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>{plugin.label}</strong>
        </div>
        {plugin.description ? (
          <span style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.8, wordBreak: "break-word" }}>
            {plugin.description}
          </span>
        ) : null}
      </div>
      {plugin.href ? (
        <Link
          href={plugin.href}
          style={{
            textDecoration: "none",
            fontSize: "var(--text-body-sm)",
            fontWeight: 600,
            color: "var(--accentText)",
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44, // 44px touch target
            padding: "0 4px",
          }}
        >
          Open
        </Link>
      ) : null}
    </div>
  );
}

function KindPanel({ kind, plugins }) {
  const meta = KIND_META[kind];
  return (
    <Panel title={meta.title} subtitle={meta.note}>
      {plugins.length === 0 ? (
        <EmptyState
          title={meta.empty}
          message="This is an extension point — modules register via registerPlugin({ kind, id, ... }) without editing the core."
        />
      ) : (
        <SubSurface>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {plugins.map((p) => (
              <PluginRow key={p.id} plugin={p} />
            ))}
          </div>
        </SubSurface>
      )}
    </Panel>
  );
}

function PluginsView() {
  const [groups, setGroups] = React.useState(EMPTY_GROUPS);

  React.useEffect(() => {
    // Populate the inventory client-side (idempotent — both registrars replace by id).
    registerBuiltinDiagnosticProviders();
    DEV_PLATFORM_NAV.forEach((item) =>
      registerTool({
        id: `nav:${item.key}`,
        label: item.label,
        description: item.description,
        href: item.href,
      })
    );
    const inventory = getPluginInventory();
    setGroups(groupPluginsByKind(inventory));
  }, []);

  const counts = {
    diagnostic: groups.diagnostic.length,
    investigation: groups.investigation.length,
    tool: groups.tool.length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap)" }}>
      <Panel
        title="Plugins"
        subtitle="Registered diagnostic, investigation and tool extensions across the Developer Platform."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "var(--space-sm)",
          }}
        >
          <StatCard label="Diagnostic providers" value={String(counts.diagnostic)} tone="accentText" />
          <StatCard label="Investigation providers" value={String(counts.investigation)} tone="warning-base" />
          <StatCard label="Tools" value={String(counts.tool)} tone="success-base" />
        </div>
      </Panel>

      <DashboardGrid min={360}>
        <KindPanel kind="diagnostic" plugins={groups.diagnostic} />
        <KindPanel kind="investigation" plugins={groups.investigation} />
        <KindPanel kind="tool" plugins={groups.tool} />
      </DashboardGrid>

      <Panel title="Extending the platform" subtitle="One architecture, three extension kinds.">
        <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.9, lineHeight: 1.6, maxWidth: "70ch" }}>
          The platform is extended through a single registry facade. A{" "}
          <strong style={{ color: "var(--accentText)" }}>diagnostic</strong> plugin runs at capture-time,
          attaching context the moment a report is submitted. An{" "}
          <strong style={{ color: "var(--accentText)" }}>investigation</strong> plugin performs dev-only
          analysis during triage. A <strong style={{ color: "var(--accentText)" }}>tool</strong> plugin
          surfaces an engineering utility or navigation area on the platform itself and never captures data.
          Any HNPSystem module registers with{" "}
          <code style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", color: "var(--accentText)" }}>
            registerPlugin({"{ kind, id, ... }"})
          </code>{" "}
          — new plugins slot in <strong style={{ color: "var(--accentText)" }}>without editing the core</strong>,
          and this page reflects whatever is registered.
        </div>
      </Panel>
    </div>
  );
}

export default function DevPluginsPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Plugins — Developer Platform</title>
      </Head>
      <PluginsView />
    </ProtectedRoute>
  );
}

DevPluginsPage.getLayout = withDevPlatformLayout({ activeKey: "plugins" });
