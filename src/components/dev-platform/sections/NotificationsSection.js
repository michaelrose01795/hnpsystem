// file location: src/components/dev-platform/sections/NotificationsSection.js
//
// Phase 10 content, Phase 11 extraction — "Notifications" view: a history of
// platform notifications (severity signalled via tone/background tint, never a
// coloured side-border) plus subscription-rule management (team-default rules are
// read-only; personal rules can be toggled, created and removed). Rendered by
// both the standalone /dev/notifications page and the Support hub's tab.
// CLAUDE.md compliant.

import React, { useState } from "react";
import usePlatformResource, { postJson } from "@/components/dev-platform/usePlatformResource";
import { useAlerts } from "@/context/AlertContext";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import {
  Panel,
  SubSurface,
  Pill,
  EmptyState,
  LoadingBlock,
  DevButton,
} from "@/components/support/dev/supportDevUi";

const SEVERITY_META = {
  info: { icon: "ℹ️", tone: "accentText" },
  success: { icon: "✅", tone: "success-base" },
  warning: { icon: "⚠️", tone: "warning-base" },
  critical: { icon: "🚨", tone: "danger-base" },
};

const severityMeta = (severity) => SEVERITY_META[severity] || SEVERITY_META.info;

const EVENT_OPTIONS = [
  { value: "report.created", label: "Report created" },
  { value: "report.critical", label: "Report critical" },
  { value: "report.regression", label: "Report regression" },
  { value: "report.assigned", label: "Report assigned" },
  { value: "release.blocked", label: "Release blocked" },
  { value: "release.approved", label: "Release approved" },
];

const MIN_SEVERITY_OPTIONS = [
  { value: "", label: "Any severity" },
  { value: "info", label: "Info" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export default function NotificationsSection() {
  const { pushAlert } = useAlerts();

  const historyRes = usePlatformResource("/api/support/notifications");
  const rulesRes = usePlatformResource("/api/support/notifications/rules");

  const notifications = historyRes.data?.data || [];
  const unread = historyRes.data?.unread || 0;
  const rules = rulesRes.data?.data || [];

  const [markingAll, setMarkingAll] = useState(false);
  const [busyRuleId, setBusyRuleId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [ruleForm, setRuleForm] = useState({ event: EVENT_OPTIONS[0].value, minSeverity: "" });

  const setRule = (patch) => setRuleForm((f) => ({ ...f, ...patch }));

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await postJson("/api/support/notifications", { action: "read_all" });
      if (res?.ok) {
        pushAlert("All notifications marked as read.", "success");
        historyRes.reload();
      } else {
        pushAlert(res?.error || "Could not mark notifications as read.", "error");
      }
    } finally {
      setMarkingAll(false);
    }
  };

  const createRule = async () => {
    setCreating(true);
    try {
      const filters = ruleForm.minSeverity ? { minSeverity: ruleForm.minSeverity } : {};
      const res = await postJson("/api/support/notifications/rules", { event: ruleForm.event, filters });
      if (res?.ok) {
        pushAlert("Subscription rule created.", "success");
        setRuleForm({ event: EVENT_OPTIONS[0].value, minSeverity: "" });
        rulesRes.reload();
      } else {
        pushAlert(res?.error || "Could not create the rule.", "error");
      }
    } finally {
      setCreating(false);
    }
  };

  const deleteRule = async (id) => {
    setBusyRuleId(id);
    try {
      const res = await postJson("/api/support/notifications/rules?id=" + id, null, "DELETE");
      if (res?.ok) {
        pushAlert("Rule deleted.", "success");
        rulesRes.reload();
      } else {
        pushAlert(res?.error || "Could not delete the rule.", "error");
      }
    } finally {
      setBusyRuleId(null);
    }
  };

  const toggleRule = async (rule) => {
    setBusyRuleId(rule.id);
    try {
      const res = await postJson("/api/support/notifications/rules", { id: rule.id, enabled: !rule.enabled }, "PATCH");
      if (res?.ok) {
        pushAlert(rule.enabled ? "Rule disabled." : "Rule enabled.", "success");
        rulesRes.reload();
      } else {
        pushAlert(res?.error || "Could not update the rule.", "error");
      }
    } finally {
      setBusyRuleId(null);
    }
  };

  return (
    <>
      <Panel
        title="Recent notifications"
        subtitle={`${unread} unread of ${notifications.length} shown.`}
        actions={
          <DevButton small onClick={markAllRead} disabled={markingAll || unread === 0}>
            {markingAll ? "Marking…" : "Mark all read"}
          </DevButton>
        }
      >
        {historyRes.loading ? (
          <LoadingBlock rows={4} />
        ) : notifications.length === 0 ? (
          <EmptyState icon="🔔" title="No notifications" message="Platform events will appear here as they happen." />
        ) : (
          notifications.map((n) => {
            const meta = severityMeta(n.severity);
            const isUnread = !n.read_at;
            return (
              <SubSurface
                key={n.id}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: "var(--space-sm)",
                  // Unread rows are tinted with the severity tone (background tint, never a border).
                  background: isUnread ? `color-mix(in srgb, var(--${meta.tone}) 12%, var(--surface))` : "var(--surface)",
                }}
              >
                <span style={{ fontSize: "18px", lineHeight: 1.4 }} aria-hidden>{meta.icon}</span>
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: "var(--text-1)", wordBreak: "break-word" }}>{n.title}</span>
                    {isUnread && <Pill label="Unread" tone={meta.tone} strong />}
                    {n.kind && <Pill label={n.kind} tone="text-1" />}
                  </div>
                  {n.body && (
                    <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.85, wordBreak: "break-word" }}>{n.body}</div>
                  )}
                  <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.6 }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString("en-GB") : ""}
                  </div>
                </div>
              </SubSurface>
            );
          })
        )}
      </Panel>

      <Panel
        title="Subscription rules"
        subtitle="Rules marked “team default” apply to everyone and are read-only."
      >
        {rulesRes.loading ? (
          <LoadingBlock rows={3} />
        ) : rules.length === 0 ? (
          <EmptyState icon="🧭" title="No rules yet" message="Create a subscription rule below to be notified about platform events." />
        ) : (
          rules.map((r) => {
            const isDefault = r.owner_key === "*";
            return (
              <SubSurface
                key={r.id}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}
              >
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    <Pill label={r.event} tone="accentText" strong />
                    {isDefault && <Pill label="team default" tone="text-1" />}
                    <Pill label={r.enabled ? "enabled" : "disabled"} tone={r.enabled ? "success-base" : "text-1"} />
                  </div>
                  {r.filters?.minSeverity && (
                    <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>
                      Min severity: {r.filters.minSeverity}
                    </div>
                  )}
                </div>
                {!isDefault && (
                  <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                    <DevButton small disabled={busyRuleId === r.id} onClick={() => toggleRule(r)}>
                      {r.enabled ? "Disable" : "Enable"}
                    </DevButton>
                    <DevButton small tone="danger-base" disabled={busyRuleId === r.id} onClick={() => deleteRule(r.id)}>
                      {busyRuleId === r.id ? "…" : "Delete"}
                    </DevButton>
                  </div>
                )}
              </SubSurface>
            );
          })
        )}
      </Panel>

      <Panel
        title="New rule"
        subtitle="Subscribe to a platform event, optionally filtered by minimum severity."
        actions={
          <DevButton variant="solid" onClick={createRule} disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </DevButton>
        }
      >
        <SubSurface style={{ gap: "var(--space-md)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-md)" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "var(--text-body-xs)", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-1)", opacity: 0.75 }}>
                Event
              </span>
              <DropdownField options={EVENT_OPTIONS} value={ruleForm.event} onChange={(e) => setRule({ event: e.target.value })} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "var(--text-body-xs)", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-1)", opacity: 0.75 }}>
                Minimum severity (optional)
              </span>
              <DropdownField options={MIN_SEVERITY_OPTIONS} value={ruleForm.minSeverity} onChange={(e) => setRule({ minSeverity: e.target.value })} />
            </label>
          </div>
        </SubSurface>
      </Panel>
    </>
  );
}
