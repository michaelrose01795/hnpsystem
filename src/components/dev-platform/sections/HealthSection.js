// file location: src/components/dev-platform/sections/HealthSection.js
//
// Phase 8 content, Phase 11 extraction — "Application Health" view. Fetches the
// dev-gated GET /api/support/health roll-up and renders subsystem tiles
// (sanitiser canary, database, storage, RLS, build). The endpoint returns only
// statuses + short notes — never diagnostics content — so this dashboard is safe
// by construction. Rendered both by the standalone /dev/health page and the
// Support hub's "Health" tab.

import React, { useCallback, useEffect, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import {
  Panel,
  Pill,
  DevButton,
  LoadingBlock,
  EmptyState,
} from "@/components/support/dev/supportDevUi";

const TONE = { ok: "success-base", warn: "warning-base", fail: "danger-base" };
const SUMMARY_LABEL = { ok: "All systems healthy", warn: "Degraded — review warnings", fail: "One or more subsystems failing" };

const CHECK_META = {
  sanitiser: { label: "Sanitiser canary" },
  database: { label: "Database" },
  storage: { label: "Private storage" },
  rls: { label: "Row-level security" },
  build: { label: "Build / code-state" },
};

function CheckTile({ name, check }) {
  const meta = CHECK_META[name] || { label: name };
  return (
    <LayerSurface style={{ gap: "8px", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{ fontWeight: 700, color: "var(--accentText)", fontSize: "var(--text-body-sm)" }}>
          {meta.label}
        </span>
        <Pill label={check?.status || "?"} tone={TONE[check?.status] || "text-1"} strong />
      </div>
      <p style={{ margin: 0, fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.8, wordBreak: "break-word" }}>
        {check?.note || "No detail."}
      </p>
    </LayerSurface>
  );
}

export default function HealthSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const probe = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/support/health", { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!body) throw new Error(`Health endpoint returned ${res.status}`);
      setData(body);
    } catch (e) {
      setError(e?.message || "Could not reach the health endpoint.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    probe();
  }, [probe]);

  const status = data?.status;
  const checks = data?.checks || {};
  const checkEntries = Object.entries(checks);

  return (
    <Panel
      title="Application health"
      subtitle={data?.checkedAt ? `Checked ${new Date(data.checkedAt).toLocaleString()}` : "Subsystem roll-up"}
      actions={<DevButton small onClick={probe}>Re-check</DevButton>}
    >
      {status ? (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <Pill label={(status || "").toUpperCase()} tone={TONE[status] || "text-1"} strong style={{ minHeight: 28 }} />
          <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.85 }}>
            {SUMMARY_LABEL[status] || "Status unknown"}
          </span>
        </div>
      ) : null}

      {loading && !data ? (
        <LoadingBlock rows={3} />
      ) : error ? (
        <EmptyState title="Health unavailable" message={error} action={<DevButton small onClick={probe}>Try again</DevButton>} />
      ) : checkEntries.length === 0 ? (
        <EmptyState title="No checks reported" />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--layout-card-gap, 12px)",
          }}
        >
          {checkEntries.map(([name, check]) => (
            <CheckTile key={name} name={name} check={check} />
          ))}
        </div>
      )}
    </Panel>
  );
}
