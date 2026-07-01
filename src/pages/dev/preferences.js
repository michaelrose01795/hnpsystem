// file location: src/pages/dev/preferences.js
//
// Phase 8 — Developer Platform preferences. Developer + notification settings,
// server-synced per developer (usePreferences → /api/support/preferences). All
// values are normalised through the shared allowlist so nothing arbitrary is
// stored.

import React, { useEffect, useState } from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import usePreferences from "@/components/dev-platform/usePreferences";
import { useAlerts } from "@/context/AlertContext";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { SORT_OPTIONS } from "@/lib/support/adminView";
import {
  Panel,
  SubSurface,
  DevButton,
  LoadingBlock,
} from "@/components/support/dev/supportDevUi";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: 44, cursor: "pointer" }}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18 }} />
      <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)" }}>{label}</span>
    </label>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ fontSize: "var(--text-body-xs)", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-1)", opacity: 0.75 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function PreferencesView() {
  const { preferences, loading, saving, save } = usePreferences();
  const { pushAlert } = useAlerts();
  const [draft, setDraft] = useState(preferences);

  // Reseed the draft whenever the server value loads/changes.
  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const onSave = async () => {
    const res = await save(draft);
    if (res?.ok) pushAlert("Preferences saved.", "success");
    else pushAlert(res?.error || "Could not save preferences.", "error");
  };

  if (loading) {
    return (
      <Panel title="Preferences">
        <LoadingBlock rows={4} />
      </Panel>
    );
  }

  return (
    <Panel
      title="Developer preferences"
      subtitle="Personal to your developer session."
      actions={<DevButton small variant="solid" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</DevButton>}
    >
      <SubSurface style={{ gap: "var(--space-md)" }}>
        <div style={{ fontWeight: 700, color: "var(--accentText)", fontSize: "var(--text-body-sm)" }}>Interface</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-md)" }}>
          <Field label="Density">
            <DropdownField options={DENSITY_OPTIONS} value={draft.density} onChange={(e) => set({ density: e.target.value })} />
          </Field>
          <Field label="Default queue sort">
            <DropdownField options={SORT_OPTIONS} value={draft.defaultSort} onChange={(e) => set({ defaultSort: e.target.value })} />
          </Field>
          <Field label="Live Ops refresh (seconds)">
            <input
              type="number"
              min={2}
              max={60}
              className="app-input"
              value={draft.liveOpsPollSeconds}
              onChange={(e) => set({ liveOpsPollSeconds: Number(e.target.value) })}
              style={{ minHeight: 44, padding: "8px 12px", borderRadius: "var(--radius-md)", background: "var(--surface)", color: "var(--text-1)" }}
            />
          </Field>
        </div>
      </SubSurface>

      <SubSurface style={{ gap: "var(--space-sm)" }}>
        <div style={{ fontWeight: 700, color: "var(--accentText)", fontSize: "var(--text-body-sm)" }}>Notifications</div>
        <Toggle label="Notify me about new regressions" checked={draft.notifyOnRegression} onChange={(v) => set({ notifyOnRegression: v })} />
        <Toggle label="Notify me about critical-severity reports" checked={draft.notifyOnCritical} onChange={(v) => set({ notifyOnCritical: v })} />
        <Toggle label="Notify me when a report is assigned to me" checked={draft.notifyOnAssignment} onChange={(v) => set({ notifyOnAssignment: v })} />
      </SubSurface>
    </Panel>
  );
}

export default function DevPreferencesPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Preferences — Developer Platform</title>
      </Head>
      <PreferencesView />
    </ProtectedRoute>
  );
}

DevPreferencesPage.getLayout = withDevPlatformLayout({ activeKey: "preferences" });
