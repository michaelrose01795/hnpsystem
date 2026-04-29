// file location: src/pages/admin/compliance/dpias.js

import React, { useEffect, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import ComplianceLayout from "@/components/compliance/ComplianceLayout";

const STATUSES = ["draft", "in_review", "approved", "rejected"];
const RISK_LEVELS = ["low", "medium", "high"];

const fmt = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};

function NewDpiaForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [systemOrFeature, setSystemOrFeature] = useState("");
  const [description, setDescription] = useState("");
  const [riskLevel, setRiskLevel] = useState("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/admin/compliance/dpias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          system_or_feature: systemOrFeature,
          description,
          risk_level: riskLevel,
          status: "draft",
        }),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload?.success) {
        setError(payload?.message || "Could not create DPIA.");
        return;
      }
      setSystemOrFeature("");
      setDescription("");
      setOpen(false);
      onCreated?.();
    } catch (err) {
      setError(err?.message || "Could not create DPIA.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New DPIA
      </Button>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
      <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        System or feature
        <input
          type="text"
          value={systemOrFeature}
          onChange={(e) => setSystemOrFeature(e.target.value)}
          required
          className="app-input"
          style={{ marginTop: 4, width: "100%", minHeight: 40 }}
        />
      </label>
      <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="app-input"
          style={{ marginTop: 4, width: "100%" }}
        />
      </label>
      <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        Initial risk level
        <select
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value)}
          className="app-input"
          style={{ marginTop: 4, width: "100%", minHeight: 40 }}
        >
          {RISK_LEVELS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      {error && <p role="alert" style={{ margin: 0, color: "var(--danger-base, #ef4444)" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Creating..." : "Create"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function DpiasPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setError("");
    try {
      const r = await fetch("/api/admin/compliance/dpias", { credentials: "include" });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload?.success) {
        setError(payload?.message || "Could not load DPIAs.");
        setRows([]);
        return;
      }
      setRows(payload.dpias || []);
    } catch (err) {
      setError(err?.message || "Could not load DPIAs.");
      setRows([]);
    }
  };

  useEffect(() => { load(); }, []);

  const patch = async (id, patchBody) => {
    setBusyId(id);
    try {
      const r = await fetch("/api/admin/compliance/dpias", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, ...patchBody }),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload?.success) {
        setError(payload?.message || "Could not update DPIA.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ComplianceLayout title="DPIAs">
      <Section title="New DPIA">
        <p style={{ margin: "0 0 10px", color: "var(--text-secondary)" }}>
          Required for high-risk processing: employee monitoring, CCTV, AI-assisted features
          on PII, marketing profiling, finance application processing, and the internal auth
          system itself.
        </p>
        <NewDpiaForm onCreated={load} />
      </Section>

      <Section title="DPIA Register">
        {error && <p role="alert" style={{ margin: "0 0 10px", color: "var(--danger-base, #ef4444)" }}>{error}</p>}
        {rows === null ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>No DPIAs on record.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-secondary)" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>System / Feature</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Status</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Risk</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>Next review</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{row.system_or_feature}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
                      <select
                        value={row.status}
                        disabled={busyId === row.id}
                        onChange={(e) => patch(row.id, { status: e.target.value })}
                        className="app-input"
                        style={{ minHeight: 32 }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
                      <select
                        value={row.risk_level || "medium"}
                        disabled={busyId === row.id}
                        onChange={(e) => patch(row.id, { risk_level: e.target.value })}
                        className="app-input"
                        style={{ minHeight: 32 }}
                      >
                        {RISK_LEVELS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>{fmt(row.next_review)}</td>
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
