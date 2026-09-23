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
  badgeClass,
  EmptyState,
  LoadingBlock,
} from "@/components/support/dev/supportDevUi";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

function FilterChips({ filters }) {
  const entries = Object.entries(filters || {}).filter(([, v]) => v !== undefined && v !== "" && v !== false);
  if (entries.length === 0) {
    return <span style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.6 }}>No filters</span>;
  }
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "6px" }}>
      {entries.map(([k, v]) => (
        <span key={k} className="app-badge app-badge--neutral">{`${k}: ${v === true ? "yes" : v}`}</span>
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
          <span className={badgeClass(view.shared ? "accentText" : "success-base", true)}>{view.shared ? "Shared" : "Personal"}</span>
        </span>
        <FilterChips filters={view.filters} />
      </div>
      <div style={{ display: "flex", gap: "var(--space-xs)" }}>
        <Link href="/dev/support-reports" style={{ textDecoration: "none" }}>
          <button type="button" className="app-btn app-btn--secondary app-btn--sm">Open Support Centre</button>
        </Link>
        <button type="button" onClick={() => onRemove(view.id)} className="app-btn app-btn--danger app-btn--sm">Remove</button>
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
      actions={<button type="button" onClick={refresh} className="app-btn app-btn--secondary app-btn--sm">Refresh</button>}
    >
      {source === "loading" ? (
        <LoadingBlock rows={3} />
      ) : views.length === 0 ? (
        <EmptyState
          title="No saved views yet"
          message="Open the Support Centre, set some filters, and use “Save view” to create one (personal or shared)."
          action={
            <Link href="/dev/support-reports" style={{ textDecoration: "none" }}>
              <button type="button" className="app-btn app-btn--secondary app-btn--sm">Go to Support Centre</button>
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
