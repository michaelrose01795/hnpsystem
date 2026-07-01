// file location: src/pages/dev/activity.js
//
// Phase 10 — Developer Platform "Activity & Audit". Reads the dev-gated activity
// feed (/api/support/activity), which shapes the hash-chained audit_log into a
// timeline plus a coverage roll-up of the expected developer actions. Shows which
// audited actions have actually been observed (coverage) and a grouped-by-day
// recent-activity timeline. Read-only surface; all data comes from the API.

import React from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import usePlatformResource from "@/components/dev-platform/usePlatformResource";
import { useAlerts } from "@/context/AlertContext";
import {
  Panel,
  SubSurface,
  Pill,
  StatCard,
  EmptyState,
  LoadingBlock,
  DevButton,
  KeyValue,
  KeyValueGrid,
} from "@/components/support/dev/supportDevUi";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

// Category → tone token mapping (colour comes only from theme tokens).
const CATEGORY_TONE = {
  Session: "accentText",
  Access: "text-1",
  Comment: "success-base",
  Triage: "warning-base",
  Integration: "accentText",
  Configuration: "text-1",
  Other: "text-1",
};

// Short, locale-agnostic timestamp for a row (UK English, defensive).
function shortTime(at) {
  if (!at) return "—";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return String(at);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// Friendly day heading (e.g. "Monday, 30 June 2026") from a YYYY-MM-DD key.
function dayHeading(day) {
  if (!day || day === "unknown") return "Undated";
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function CoveragePanel({ coverage }) {
  const covered = coverage?.covered || [];
  const missing = coverage?.missing || [];
  const byAction = coverage?.byAction || {};
  const expected = [...covered, ...missing];
  const complete = Boolean(coverage?.complete);

  return (
    <Panel
      title="Audit coverage"
      subtitle="Which expected developer-platform actions have actually been written to the hash-chained audit log."
    >
      <div
        style={{
          fontSize: "var(--text-body-sm)",
          fontWeight: 600,
          color: complete ? "var(--success-base)" : "var(--warning-base)",
        }}
      >
        {complete
          ? "✓ Coverage complete — every expected developer action has been logged."
          : `⚠ ${missing.length} expected action${missing.length === 1 ? "" : "s"} not yet observed in this environment.`}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {expected.map((action) => {
          const isCovered = covered.includes(action);
          return (
            <Pill
              key={action}
              label={`${isCovered ? "✓ " : ""}${action}`}
              tone={isCovered ? "success-base" : "danger-base"}
              strong
            />
          );
        })}
      </div>

      {Object.keys(byAction).length > 0 ? (
        <SubSurface>
          <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Logged actions
          </div>
          <KeyValueGrid>
            {Object.entries(byAction).map(([action, count]) => (
              <KeyValue key={action} label={action} value={String(count)} mono />
            ))}
          </KeyValueGrid>
        </SubSurface>
      ) : null}
    </Panel>
  );
}

function ActivityRow({ item, showRule }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-md)",
        flexWrap: "wrap",
        padding: "8px 0",
        // Allowed row separator (§3.0a — row-bottom rule inside a list).
        borderBottom: showRule ? "1px solid var(--separating-line)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", minWidth: 0, flexWrap: "wrap" }}>
        <Pill label={item.category || "Other"} tone={CATEGORY_TONE[item.category] || "text-1"} />
        <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", wordBreak: "break-word" }}>
          {item.summary || item.action}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexShrink: 0 }}>
        {item.actorRole ? (
          <span style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7 }}>
            {item.actorRole}
          </span>
        ) : null}
        <span style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.55, fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
          {shortTime(item.at)}
        </span>
      </div>
    </div>
  );
}

function RecentActivityPanel({ loading, byDay, count, onReload }) {
  return (
    <Panel
      title="Recent activity"
      subtitle={`${count ?? 0} events, grouped by day, newest first.`}
      actions={<DevButton small onClick={onReload}>⟳ Refresh</DevButton>}
    >
      {loading ? (
        <LoadingBlock rows={4} />
      ) : !byDay || byDay.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No activity recorded"
          message="The hash-chained audit_log may be empty in this environment — developer actions appear here once they are logged."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {byDay.map((group) => (
            <SubSurface key={group.day}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>
                  {dayHeading(group.day)}
                </div>
                <Pill label={`${group.items.length} item${group.items.length === 1 ? "" : "s"}`} tone="text-1" />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {group.items.map((item, i) => (
                  <ActivityRow key={item.id || `${group.day}-${i}`} item={item} showRule={i < group.items.length - 1} />
                ))}
              </div>
            </SubSurface>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ActivityView() {
  const { data, loading, error, reload } = usePlatformResource("/api/support/activity");
  const { pushAlert } = useAlerts();

  React.useEffect(() => {
    if (error) pushAlert(error, "error");
  }, [error, pushAlert]);

  const coverage = data?.coverage || null;
  const byDay = data?.byDay || [];
  const count = data?.count || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap)" }}>
      <Panel title="Activity & audit" subtitle="Hash-chained developer action log and audit coverage.">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "var(--space-sm)",
          }}
        >
          <StatCard label="Activity items" value={loading ? "…" : String(count)} tone="accentText" />
          <StatCard
            label="Actions covered"
            value={loading ? "…" : String((coverage?.covered || []).length)}
            tone="success-base"
          />
          <StatCard
            label="Actions missing"
            value={loading ? "…" : String((coverage?.missing || []).length)}
            tone={coverage && coverage.missing.length ? "danger-base" : "success-base"}
          />
          <StatCard label="Days with activity" value={loading ? "…" : String(byDay.length)} tone="text-1" />
        </div>
      </Panel>

      {coverage ? <CoveragePanel coverage={coverage} /> : null}

      <RecentActivityPanel loading={loading} byDay={byDay} count={count} onReload={reload} />
    </div>
  );
}

export default function DevActivityPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Activity &amp; Audit — Developer Platform</title>
      </Head>
      <ActivityView />
    </ProtectedRoute>
  );
}

DevActivityPage.getLayout = withDevPlatformLayout({ activeKey: "activity" });
