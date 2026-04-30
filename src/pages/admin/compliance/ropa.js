// file location: src/pages/admin/compliance/ropa.js

import React, { useEffect, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import ComplianceLayout from "@/components/compliance/ComplianceLayout";

const LAWFUL_BASES = [
  "contract",
  "legal_obligation",
  "legitimate_interest",
  "consent",
  "vital_interest",
  "public_task",
];

function NewActivityForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [lawfulBasis, setLawfulBasis] = useState("legitimate_interest");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/admin/compliance/ropa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, purpose, lawful_basis: lawfulBasis }),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload?.success) {
        setError(payload?.message || "Could not create activity.");
        return;
      }
      setName("");
      setPurpose("");
      setOpen(false);
      onCreated?.();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New Processing Activity
      </Button>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
      <label style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
        Activity name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="app-input"
          style={{ marginTop: 4, width: "100%", minHeight: 40 }}
        />
      </label>
      <label style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
        Purpose
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          rows={3}
          className="app-input"
          style={{ marginTop: 4, width: "100%" }}
        />
      </label>
      <label style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
        Lawful basis
        <select
          value={lawfulBasis}
          onChange={(e) => setLawfulBasis(e.target.value)}
          className="app-input"
          style={{ marginTop: 4, width: "100%", minHeight: 40 }}
        >
          {LAWFUL_BASES.map((b) => (
            <option key={b} value={b}>{b}</option>
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

export default function RopaPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const r = await fetch("/api/admin/compliance/ropa", { credentials: "include" });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload?.success) {
        setError(payload?.message || "Could not load ROPA.");
        setRows([]);
        return;
      }
      setRows(payload.activities || []);
    } catch (err) {
      setError(err?.message || "Could not load ROPA.");
      setRows([]);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <ComplianceLayout title="ROPA">
      <Section title="Record of Processing Activities">
        <p style={{ margin: "0 0 10px", color: "var(--text-1)" }}>
          Per UK GDPR Art. 30, controllers must maintain a record of processing activities.
          Each entry should describe the purpose, lawful basis, data categories, recipients,
          international transfers, security measures, and retention.
        </p>
        <NewActivityForm onCreated={load} />
      </Section>

      <Section title="Activities">
        {error && <p role="alert" style={{ margin: "0 0 10px", color: "var(--danger-base, #ef4444)" }}>{error}</p>}
        {rows === null ? (
          <p style={{ margin: 0, color: "var(--text-1)" }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-1)" }}>No activities recorded yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-1)" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Name</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Lawful basis</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Purpose</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Last reviewed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>{row.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>{row.lawful_basis || "—"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>
                      {row.purpose ? row.purpose.slice(0, 120) : "—"}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>{row.last_reviewed_at || "—"}</td>
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
