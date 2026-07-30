import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { canAccessPath } from "@/lib/auth/pageAccess";
import { AUDIT_ADMIN_ROLES, hasAnyRole } from "@/lib/auth/roles";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import InputField from "@/components/ui/InputField";
import LayerTheme from "@/components/ui/LayerTheme";
import StatusMessage from "@/components/ui/StatusMessage";
import StaffPageHeader from "@/components/ui/StaffPageHeader";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";

const PAGE_SIZE = 25;
const EMPTY_FILTERS = {
  userId: "",
  role: "",
  department: "",
  from: "",
  to: "",
  sessionId: "",
  device: "",
  browser: "",
  page: "",
  actionCategory: "",
  recordType: "",
  recordId: "",
  outcome: "",
  search: "",
};

const ACTION_OPTIONS = [
  "authentication",
  "navigation",
  "interaction",
  "record_change",
  "delete",
  "export",
  "security",
];

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Europe/London",
      }).format(new Date(value))
    : "Not recorded";

const formatDuration = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

const eventTone = (outcome) =>
  outcome === "success" ? "success" : outcome === "failure" ? "danger" : "neutral";

const RECORD_LINKS = {
  job: { build: (id) => `/job-cards/${encodeURIComponent(id)}`, access: "/jobs" },
  job_card: { build: (id) => `/job-cards/${encodeURIComponent(id)}`, access: "/jobs" },
  customer: { build: (id) => `/customers/${encodeURIComponent(id)}`, access: "/jobs" },
  invoice: { build: (id) => `/accounts/invoices/${encodeURIComponent(id)}`, access: "/accounts" },
  appointment: { build: () => "/appointments", access: "/appointments" },
  parts_request: { build: () => "/parts", access: "/parts" },
  vhc_item: { build: (id) => `/job-cards/${encodeURIComponent(id)}`, access: "/jobs" },
};

const buildQuery = (filters, pageNumber, extra = {}) => {
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(PAGE_SIZE) });
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return params.toString();
};

function JsonDetails({ label, value }) {
  if (!value || (typeof value === "object" && !Object.keys(value).length)) return null;
  return (
    <div>
      <strong>{label}</strong>
      <pre
        style={{
          margin: "var(--space-xs) 0 0",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          color: "var(--surfaceTextMuted)",
          fontSize: "var(--text-caption)",
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function RecordReference({ event, user }) {
  if (!event.record_type || !event.record_id) return <span>None</span>;
  const config = RECORD_LINKS[event.record_type];
  const label = `${event.record_type} ${event.record_id}`;
  if (!config || !canAccessPath(config.access, user?.roles, user?.sidebarAccess)) {
    return <span>{label}</span>;
  }
  return <Link href={config.build(event.record_id)}>{label}</Link>;
}

export default function ActivityLogView() {
  const { user } = useUser();
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [options, setOptions] = useState({
    users: [],
    roles: [],
    departments: [],
    sessions: [],
    devices: [],
    browsers: [],
  });
  const [result, setResult] = useState({ rows: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retention, setRetention] = useState(null);
  const [retentionBusy, setRetentionBusy] = useState(false);
  const [retentionMessage, setRetentionMessage] = useState("");
  const canManageRetention = hasAnyRole(user?.roles || [], AUDIT_ADMIN_ROLES);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/audit?${buildQuery(filters, pageNumber)}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to load activity.");
      }
      setResult(payload.data);
    } catch (loadError) {
      setError(loadError.message || "Unable to load activity.");
      setResult({ rows: [], total: 0, page: pageNumber, pageSize: PAGE_SIZE });
    } finally {
      setLoading(false);
    }
  }, [filters, pageNumber]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/audit?options=1", {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (response.ok && payload?.success) setOptions(payload.data);
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          setError(loadError.message || "Unable to load activity filters.");
        }
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!canManageRetention) return undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/audit/retention", {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (response.ok && payload?.success) setRetention(payload.data);
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          setRetentionMessage("Unable to load retention settings.");
        }
      }
    })();
    return () => controller.abort();
  }, [canManageRetention]);

  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const sessionCount = useMemo(
    () => new Set(result.rows.map((row) => row.session_id).filter(Boolean)).size,
    [result.rows]
  );
  const failureCount = result.rows.filter((row) => row.outcome === "failure").length;
  const sessionSummaries = useMemo(() => {
    const summaries = new Map();
    for (const event of result.rows) {
      if (!event.session_id || summaries.has(event.session_id)) continue;
      const sessionData = Array.isArray(event.audit_sessions)
        ? event.audit_sessions[0]
        : event.audit_sessions;
      summaries.set(event.session_id, {
        id: event.session_id,
        userName: event.actor_name,
        ...sessionData,
      });
    }
    return Array.from(summaries.values());
  }, [result.rows]);
  const exportHref = `/api/audit?${buildQuery(filters, 1, { format: "csv" })}`;

  const updateDraft = (key, value) =>
    setDraftFilters((current) => ({ ...current, [key]: value }));

  const applyFilters = () => {
    setPageNumber(1);
    setFilters(draftFilters);
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPageNumber(1);
  };

  const saveRetention = async () => {
    if (!retention) return;
    setRetentionBusy(true);
    setRetentionMessage("");
    try {
      const response = await fetch("/api/audit/retention", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liveDays: Number(retention.live_days),
          archiveDays: Number(retention.archive_days),
          sessionTimeoutMinutes: Number(retention.session_timeout_minutes),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to save retention settings.");
      }
      setRetention(payload.data);
      setRetentionMessage("Retention settings saved.");
    } catch (saveError) {
      setRetentionMessage(saveError.message || "Unable to save retention settings.");
    } finally {
      setRetentionBusy(false);
    }
  };

  const runMaintenance = async () => {
    setRetentionBusy(true);
    setRetentionMessage("");
    try {
      const response = await fetch("/api/audit/retention", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: true }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to run retention maintenance.");
      }
      setRetentionMessage(
        `Maintenance complete. ${payload.data?.expiredSessions || 0} stale sessions closed.`
      );
      void loadEvents();
    } catch (maintenanceError) {
      setRetentionMessage(maintenanceError.message || "Unable to run retention maintenance.");
    } finally {
      setRetentionBusy(false);
    }
  };

  return (
    <div className="app-page-stack">
      <StaffPageHeader
        title="User Activity"
        subtitle="Authenticated sessions, navigation and operational changes from live Supabase data."
        actions={
          <a className="app-btn app-btn--secondary" href={exportHref} data-audit-category="export">
            Export CSV
          </a>
        }
      />

      <LayerTheme>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "var(--layout-card-gap)",
            alignItems: "end",
          }}
        >
          <DropdownField
            label="User"
            value={draftFilters.userId}
            onValueChange={(value) => updateDraft("userId", value)}
            options={options.users.map((item) => ({ value: item.id, label: item.name }))}
            placeholder="All users"
          />
          <DropdownField
            label="Role"
            value={draftFilters.role}
            onValueChange={(value) => updateDraft("role", value)}
            options={options.roles}
            placeholder="All roles"
          />
          <DropdownField
            label="Department"
            value={draftFilters.department}
            onValueChange={(value) => updateDraft("department", value)}
            options={options.departments}
            placeholder="All departments"
          />
          <InputField
            label="From"
            type="datetime-local"
            value={draftFilters.from}
            onChange={(event) => updateDraft("from", event.target.value)}
          />
          <InputField
            label="To"
            type="datetime-local"
            value={draftFilters.to}
            onChange={(event) => updateDraft("to", event.target.value)}
          />
          <DropdownField
            label="Session"
            value={draftFilters.sessionId}
            onValueChange={(value) => updateDraft("sessionId", value)}
            options={options.sessions.map((item) => ({
              value: item.id,
              label: `${item.userName} - ${formatDateTime(item.startedAt)}`,
            }))}
            placeholder="All sessions"
            searchable
          />
          <DropdownField
            label="Device"
            value={draftFilters.device}
            onValueChange={(value) => updateDraft("device", value)}
            options={options.devices}
            placeholder="All devices"
          />
          <DropdownField
            label="Browser"
            value={draftFilters.browser}
            onValueChange={(value) => updateDraft("browser", value)}
            options={options.browsers}
            placeholder="All browsers"
          />
          <InputField
            label="Page or route"
            value={draftFilters.page}
            onChange={(event) => updateDraft("page", event.target.value)}
            placeholder="/job-cards"
          />
          <DropdownField
            label="Action type"
            value={draftFilters.actionCategory}
            onValueChange={(value) => updateDraft("actionCategory", value)}
            options={ACTION_OPTIONS}
            placeholder="All actions"
          />
          <InputField
            label="Record type"
            value={draftFilters.recordType}
            onChange={(event) => updateDraft("recordType", event.target.value)}
            placeholder="job_card"
          />
          <InputField
            label="Record ID"
            value={draftFilters.recordId}
            onChange={(event) => updateDraft("recordId", event.target.value)}
          />
          <DropdownField
            label="Status"
            value={draftFilters.outcome}
            onValueChange={(value) => updateDraft("outcome", value)}
            options={["success", "failure", "cancelled", "unknown"]}
            placeholder="All statuses"
          />
          <InputField
            label="Search"
            type="search"
            value={draftFilters.search}
            onChange={(event) => updateDraft("search", event.target.value)}
            placeholder="User, action or record"
          />
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
          <Button type="button" onClick={applyFilters}>Apply filters</Button>
          <Button type="button" variant="secondary" onClick={resetFilters}>Reset</Button>
        </div>
      </LayerTheme>

      {canManageRetention && retention ? (
        <LayerTheme>
          <div>
            <h2 style={{ margin: 0, fontSize: "var(--text-h3)", color: "var(--accentText)" }}>
              Retention and session expiry
            </h2>
            <p style={{ margin: "var(--space-xs) 0 0", color: "var(--surfaceTextMuted)" }}>
              Live events are archived before expiry. Stale sessions are closed using the heartbeat timeout.
            </p>
          </div>
          {retentionMessage ? (
            <StatusMessage tone={retentionMessage.includes("Unable") ? "danger" : "success"}>
              {retentionMessage}
            </StatusMessage>
          ) : null}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "var(--layout-card-gap)",
            }}
          >
            <InputField
              label="Live retention days"
              type="number"
              min="30"
              max="3650"
              value={retention.live_days}
              onChange={(event) => setRetention((current) => ({ ...current, live_days: event.target.value }))}
            />
            <InputField
              label="Archive retention days"
              type="number"
              min="365"
              max="7300"
              value={retention.archive_days}
              onChange={(event) => setRetention((current) => ({ ...current, archive_days: event.target.value }))}
            />
            <InputField
              label="Session timeout minutes"
              type="number"
              min="5"
              max="1440"
              value={retention.session_timeout_minutes}
              onChange={(event) => setRetention((current) => ({ ...current, session_timeout_minutes: event.target.value }))}
            />
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <Button type="button" busy={retentionBusy} onClick={saveRetention}>Save retention</Button>
            <Button type="button" variant="secondary" busy={retentionBusy} onClick={runMaintenance}>
              Run maintenance
            </Button>
          </div>
        </LayerTheme>
      ) : null}

      <LayerTheme>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "var(--layout-card-gap)",
          }}
        >
          <div><span style={{ color: "var(--surfaceTextMuted)" }}>Matching events</span><strong style={{ display: "block" }}>{result.total}</strong></div>
          <div><span style={{ color: "var(--surfaceTextMuted)" }}>Sessions on page</span><strong style={{ display: "block" }}>{sessionCount}</strong></div>
          <div><span style={{ color: "var(--surfaceTextMuted)" }}>Failures on page</span><strong style={{ display: "block" }}>{failureCount}</strong></div>
          <div><span style={{ color: "var(--surfaceTextMuted)" }}>Page</span><strong style={{ display: "block" }}>{pageNumber} of {pageCount}</strong></div>
        </div>
        {sessionSummaries.length ? (
          <details>
            <summary>Session summaries ({sessionSummaries.length})</summary>
            <div className="app-table-shell-scroll" style={{ marginTop: "var(--space-sm)" }}>
              <table className="app-table-shell app-data-table" aria-label="Session summaries">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Started</th>
                    <th>Last activity</th>
                    <th>Duration</th>
                    <th>Device</th>
                    <th>IP address</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionSummaries.map((summary) => (
                    <tr key={summary.id}>
                      <td>{summary.user_name || summary.userName || "Unknown user"}</td>
                      <td>{formatDateTime(summary.started_at)}</td>
                      <td>{formatDateTime(summary.last_activity_at)}</td>
                      <td>{formatDuration(Number(summary.duration_seconds || 0) * 1000)}</td>
                      <td>{[summary.device_category, summary.operating_system, summary.browser_name, summary.browser_version, summary.app_mode].filter(Boolean).join(" / ") || "Unknown"}</td>
                      <td>{summary.ip_address || "Not available"}</td>
                      <td><span className="app-badge app-badge--neutral">{summary.status || "unknown"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </LayerTheme>

      <LayerTheme>
        {error && <StatusMessage tone="danger">{error}</StatusMessage>}
        {loading ? (
          <InlineLoading label="Loading user activity" width={220} />
        ) : result.rows.length === 0 ? (
          <EmptyState
            variant="bare"
            title="No activity matches these filters"
            description="Change or reset the filters to widen the result set."
            role="status"
          />
        ) : (
          <div className="app-table-shell-scroll">
            <table className="app-table-shell app-data-table" aria-label="User activity timeline">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Event</th>
                  <th>Page / feature</th>
                  <th>Record</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((event) => {
                  const device = Array.isArray(event.audit_sessions)
                    ? event.audit_sessions[0]
                    : event.audit_sessions;
                  return (
                    <tr key={event.id}>
                      <td>
                        <time dateTime={event.occurred_at}>{formatDateTime(event.occurred_at)}</time>
                        {event.duration_ms ? (
                          <small style={{ display: "block", color: "var(--surfaceTextMuted)" }}>
                            {formatDuration(event.duration_ms)}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <strong>{event.actor_name || `User ${event.actor_user_id || "unknown"}`}</strong>
                        <small style={{ display: "block", color: "var(--surfaceTextMuted)" }}>
                          {[event.actor_role, event.actor_department].filter(Boolean).join(" / ") || "Unassigned"}
                        </small>
                      </td>
                      <td>
                        <strong>{event.action_label || event.event_name}</strong>
                        <small style={{ display: "block", color: "var(--surfaceTextMuted)" }}>
                          {event.action_category}
                        </small>
                      </td>
                      <td>
                        <span>{event.page_title || event.route || event.feature || "Application"}</span>
                        {event.route && event.page_title ? (
                          <small style={{ display: "block", color: "var(--surfaceTextMuted)" }}>{event.route}</small>
                        ) : null}
                      </td>
                      <td><RecordReference event={event} user={user} /></td>
                      <td>
                        <span className={`app-badge app-badge--${eventTone(event.outcome)}`}>{event.outcome}</span>
                      </td>
                      <td>
                        <details>
                          <summary>View</summary>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "var(--space-sm)",
                              minWidth: "min(420px, 70vw)",
                              paddingBlock: "var(--space-sm)",
                            }}
                          >
                            <div><strong>Session</strong><div>{event.session_id || "Server event"}</div></div>
                            <div><strong>Device</strong><div>{device ? [device.device_category, device.operating_system, device.browser_name, device.browser_version, device.app_mode].filter(Boolean).join(" / ") : "Not available"}</div></div>
                            <div><strong>Previous page</strong><div>{event.previous_page || "Not recorded"}</div></div>
                            <div><strong>Page entered</strong><div>{formatDateTime(event.page_entered_at)}</div></div>
                            <div><strong>Page left</strong><div>{formatDateTime(event.page_left_at)}</div></div>
                            <JsonDetails label="Before" value={event.before_data} />
                            <JsonDetails label="After" value={event.after_data} />
                            <JsonDetails label="Metadata" value={event.metadata} />
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--layout-card-gap)",
            flexWrap: "wrap",
          }}
        >
          <Button
            type="button"
            variant="secondary"
            disabled={pageNumber <= 1 || loading}
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <span>Page {pageNumber} of {pageCount}</span>
          <Button
            type="button"
            variant="secondary"
            disabled={pageNumber >= pageCount || loading}
            onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))}
          >
            Next
          </Button>
        </div>
      </LayerTheme>
    </div>
  );
}
