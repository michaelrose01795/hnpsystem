// file location: src/pages/dev/saved-views.js
//
// Phase 8 — Developer Platform "Saved Views" management. Lists the developer's
// personal views plus shared team views (server-synced via useSavedViews), shows
// each view's filters + scope, and allows removal. New views are captured from
// the Support Centre's "Save view" action; this is the management hub.

import React from "react";
import Head from "next/head";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import useSavedViews from "@/components/dev-platform/useSavedViews";
import { useAlerts } from "@/context/AlertContext";
import LayerTheme from "@/components/ui/LayerTheme";
import {
  Panel,
  Pill,
  DevButton,
  EmptyState,
  LoadingBlock,
} from "@/components/support/dev/supportDevUi";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

function FilterChips({ filters }) {
  const entries = Object.entries(filters || {}).filter(([, v]) => v !== undefined && v !== "" && v !== false);
  if (entries.length === 0) {
    return <span style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.6 }}>No filters</span>;
  }
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "6px" }}>
      {entries.map(([k, v]) => (
        <Pill key={k} label={`${k}: ${v === true ? "yes" : v}`} tone="text-1" />
      ))}
    </span>
  );
}

function ViewRow({ view, onRemove }) {
  return (
    <LayerTheme
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-md)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <strong style={{ color: "var(--accentText)", fontSize: "var(--text-body)" }}>{view.name}</strong>
          <Pill label={view.shared ? "Shared" : "Personal"} tone={view.shared ? "accentText" : "success-base"} strong />
        </span>
        <FilterChips filters={view.filters} />
      </div>
      <div style={{ display: "flex", gap: "var(--space-xs)" }}>
        <Link href="/dev/support-reports" style={{ textDecoration: "none" }}>
          <DevButton small>Open Support Centre</DevButton>
        </Link>
        <DevButton small tone="danger-base" onClick={() => onRemove(view.id)}>Remove</DevButton>
      </div>
    </LayerTheme>
  );
}

function SavedViewsView() {
  const { views, source, refresh, removeView } = useSavedViews({ surface: "support" });
  const { pushAlert } = useAlerts();

  const onRemove = async (id) => {
    const res = await removeView(id);
    if (!res?.ok) pushAlert(res?.error || "Could not remove the view.", "error");
  };

  return (
    <Panel
      title="Saved views"
      subtitle={
        source === "local"
          ? "Showing device-local views (server unavailable or migration not applied)."
          : "Personal and shared team workspaces, synced to the server."
      }
      actions={<DevButton small onClick={refresh}>⟳ Refresh</DevButton>}
    >
      {source === "loading" ? (
        <LoadingBlock rows={3} />
      ) : views.length === 0 ? (
        <EmptyState
          icon="🔖"
          title="No saved views yet"
          message="Open the Support Centre, set some filters, and use “＋ Save view” to create one (personal or shared)."
          action={
            <Link href="/dev/support-reports" style={{ textDecoration: "none" }}>
              <DevButton small>Go to Support Centre</DevButton>
            </Link>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {views.map((v) => (
            <ViewRow key={v.id} view={v} onRemove={onRemove} />
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function DevSavedViewsPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Saved Views — Developer Platform</title>
      </Head>
      <SavedViewsView />
    </ProtectedRoute>
  );
}

DevSavedViewsPage.getLayout = withDevPlatformLayout({ activeKey: "saved-views" });
