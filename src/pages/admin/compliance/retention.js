// file location: src/pages/admin/compliance/retention.js

import React, { useEffect, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import ComplianceLayout from "@/components/compliance/ComplianceLayout";

const fmt = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export default function RetentionPage() {
  const [policies, setPolicies] = useState(null);
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setError("");
    try {
      const r = await fetch("/api/admin/compliance/retention", { credentials: "include" });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload?.success) {
        setError(payload?.message || "Could not load retention.");
        setPolicies([]);
        return;
      }
      setPolicies(payload.policies || []);
      setRuns(payload.recentRuns || []);
    } catch (err) {
      setError(err?.message || "Could not load retention.");
      setPolicies([]);
    }
  };

  useEffect(() => { load(); }, []);

  const recordDryRun = async (entityType, action) => {
    setBusy(entityType);
    try {
      await fetch("/api/admin/compliance/retention?action=run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entity_type: entityType,
          action,
          dry_run: true,
          rows_processed: 0,
          rows_actioned: 0,
          notes: "Dry-run logged from UI; actual deletion to be performed via runbook.",
        }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <ComplianceLayout title="Retention">
      <Section title="Retention Policies">
        <p style={{ margin: "0 0 10px", color: "var(--text-secondary)" }}>
          One policy per data category. Defaults seeded from the published audit
          matrix; review and adjust per legal advice.
        </p>
        {error && <p role="alert" style={{ margin: "0 0 10px", color: "var(--danger-base, #ef4444)" }}>{error}</p>}
        {policies === null ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>Loading...</p>
        ) : policies.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>No policies configured.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-secondary)" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Entity type</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Retention</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Action</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Legal basis</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Notes</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Run (log only)</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((row) => (
                  <tr key={row.entity_type}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)", fontWeight: 600 }}>
                      {row.entity_type}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{row.retention_period}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{row.action}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{row.legal_basis || "—"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
                      {row.notes ? row.notes.slice(0, 80) : "—"}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busy === row.entity_type}
                        onClick={() => recordDryRun(row.entity_type, row.action)}
                      >
                        Log dry-run
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Recent Retention Runs">
        {runs.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>No runs recorded yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-secondary)" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>When</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Entity</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Action</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Dry-run?</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Processed</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Actioned</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{fmt(row.ran_at)}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{row.entity_type}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{row.action}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{row.dry_run ? "yes" : "no"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{row.rows_processed}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{row.rows_actioned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </ComplianceLayout>
  );
}
