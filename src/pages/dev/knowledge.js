// file location: src/pages/dev/knowledge.js
//
// Phase 10 — Developer Platform "Knowledge Centre". Curated knowledge-base
// entries for recurring incidents, plus a live derivation layer that surfaces
// recurring incidents and suggests which ones to document. Entries are created,
// listed and removed here; suggestions pre-fill the create form so a developer
// can turn a recurring pattern into a documented entry in one click.
// Strictly gated to the Developer Platform roles. CLAUDE.md compliant.

import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import usePlatformResource, { postJson } from "@/components/dev-platform/usePlatformResource";
import { useAlerts } from "@/context/AlertContext";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
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

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const statusTone = (status) =>
  status === "published" ? "success-base" : status === "archived" ? "text-1" : "warning-base";

// Shared input styling — 44px touch target, surface background, token colour.
const inputStyle = {
  minHeight: 44,
  padding: "8px 12px",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
  color: "var(--text-1)",
  width: "100%",
};

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

function KnowledgeView() {
  const router = useRouter();
  const { pushAlert } = useAlerts();

  const entriesRes = usePlatformResource("/api/support/knowledge");
  const derivationRes = usePlatformResource("/api/support/platform?view=knowledge");

  const entries = entriesRes.data?.data || [];
  const knowledge = derivationRes.data?.knowledge || {};
  const suggestions = knowledge.suggestions || [];
  const stats = knowledge.stats || {};

  const [form, setForm] = useState({ title: "", category: "", status: "draft", body: "", fingerprint: "" });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const formRef = useRef(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const reloadAll = () => {
    entriesRes.reload();
    derivationRes.reload();
  };

  // Focus/scroll the create form when arriving with ?new=1.
  useEffect(() => {
    if (router.query?.new === "1" && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      const first = formRef.current.querySelector("input, textarea");
      if (first) first.focus();
    }
  }, [router.query?.new]);

  const documentSuggestion = (s) => {
    set({ title: s.suggestedTitle || "", fingerprint: s.fingerprint || "" });
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      const first = formRef.current.querySelector("input, textarea");
      if (first) first.focus();
    }
  };

  const onSave = async () => {
    if (!form.title.trim()) {
      pushAlert("A title is required.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await postJson("/api/support/knowledge", {
        title: form.title,
        category: form.category,
        status: form.status,
        body: form.body,
        fingerprint: form.fingerprint,
      });
      if (res?.ok) {
        pushAlert("Knowledge entry saved.", "success");
        setForm({ title: "", category: "", status: "draft", body: "", fingerprint: "" });
        reloadAll();
      } else {
        pushAlert(res?.error || "Could not save the entry.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    setBusyId(id);
    try {
      const res = await postJson("/api/support/knowledge/" + id, null, "DELETE");
      if (res?.ok) {
        pushAlert("Entry deleted.", "success");
        reloadAll();
      } else {
        pushAlert(res?.error || "Could not delete the entry.", "error");
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Panel
        title="Knowledge Centre"
        subtitle="Curated documentation for recurring incidents, plus live derivation from captured reports."
        actions={<DevButton small onClick={reloadAll}>Refresh</DevButton>}
      >
        {derivationRes.loading ? (
          <LoadingBlock rows={1} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-sm)" }}>
            <StatCard label="Total entries" value={stats.totalEntries || 0} tone="accentText" />
            <StatCard label="Published" value={stats.publishedEntries || 0} tone="success-base" />
            <StatCard label="Recurring incidents" value={stats.recurringCount || 0} tone="warning-base" />
            <StatCard label="Undocumented recurring" value={stats.undocumentedRecurring || 0} tone="danger-base" />
          </div>
        )}
      </Panel>

      <DashboardGrid min={440}>
      <Panel
        title="Suggested to document"
        subtitle="Recurring incidents that are not yet covered by a knowledge entry."
      >
        {derivationRes.loading ? (
          <LoadingBlock rows={2} />
        ) : suggestions.length === 0 ? (
          <EmptyState title="Nothing outstanding" message="Every recurring incident is already documented." />
        ) : (
          suggestions.map((s) => (
            <SubSurface
              key={s.fingerprint}
              style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}
            >
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontWeight: 700, color: "var(--text-1)", wordBreak: "break-word" }}>
                  {s.suggestedTitle || s.fingerprint}
                </span>
                <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.8 }}>{s.reason}</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                  <Pill label={`×${s.occurrences}`} tone="warning-base" strong />
                  {(s.routes || []).slice(0, 3).map((r) => (
                    <Pill key={r} label={r} tone="text-1" />
                  ))}
                  {s.open > 0 && <Pill label={`${s.open} open`} tone="accentText" />}
                </div>
              </div>
              <DevButton small variant="solid" onClick={() => documentSuggestion(s)}>Document this</DevButton>
            </SubSurface>
          ))
        )}
      </Panel>

      <Panel
        title="Knowledge entries"
        subtitle={`${entries.length} entry(ies) in the knowledge base.`}
      >
        {entriesRes.loading ? (
          <LoadingBlock rows={3} />
        ) : entries.length === 0 ? (
          <EmptyState title="No entries yet" message="Document a recurring incident using the form below to build the knowledge base." />
        ) : (
          entries.map((e) => (
            <SubSurface key={e.id} style={{ gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "var(--accentText)", wordBreak: "break-word", minWidth: 0 }}>{e.title}</span>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                  {e.category && <Pill label={e.category} tone="text-1" />}
                  <Pill label={e.status} tone={statusTone(e.status)} strong />
                  <DevButton
                    small
                    tone="danger-base"
                    disabled={busyId === e.id}
                    onClick={() => onDelete(e.id)}
                  >
                    {busyId === e.id ? "Deleting…" : "Delete"}
                  </DevButton>
                </div>
              </div>
              {e.body && (
                <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.85, wordBreak: "break-word" }}>
                  {String(e.body).slice(0, 200)}{String(e.body).length > 200 ? "…" : ""}
                </div>
              )}
            </SubSurface>
          ))
        )}
      </Panel>
      </DashboardGrid>

      <div ref={formRef}>
        <Panel
          title="New entry"
          subtitle="Document a recurring incident. A fingerprint links the entry to its incident cluster."
          actions={
            <DevButton variant="solid" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </DevButton>
          }
        >
          <SubSurface style={{ gap: "var(--space-md)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-md)" }}>
              <Field label="Title (required)">
                <input
                  className="app-input"
                  value={form.title}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="e.g. Job card save fails when parts list is empty"
                  style={inputStyle}
                />
              </Field>
              <Field label="Category">
                <input
                  className="app-input"
                  value={form.category}
                  onChange={(e) => set({ category: e.target.value })}
                  placeholder="e.g. Job Cards"
                  style={inputStyle}
                />
              </Field>
              <Field label="Status">
                <DropdownField options={STATUS_OPTIONS} value={form.status} onChange={(e) => set({ status: e.target.value })} />
              </Field>
            </div>
            <Field label="Body">
              <textarea
                className="app-input"
                value={form.body}
                onChange={(e) => set({ body: e.target.value })}
                placeholder="Cause, resolution, and any workaround for this recurring incident…"
                rows={6}
                style={{ ...inputStyle, minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
              />
            </Field>
            {form.fingerprint && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>Linked incident:</span>
                <Pill label={form.fingerprint} tone="accentText" />
                <DevButton small onClick={() => set({ fingerprint: "" })}>Clear link</DevButton>
              </div>
            )}
          </SubSurface>
        </Panel>
      </div>
    </>
  );
}

export default function DevKnowledgePage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Knowledge Centre — Developer Platform</title>
      </Head>
      <KnowledgeView />
    </ProtectedRoute>
  );
}

DevKnowledgePage.getLayout = withDevPlatformLayout({ activeKey: "knowledge" });
