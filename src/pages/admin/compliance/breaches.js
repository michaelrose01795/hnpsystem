// file location: src/pages/admin/compliance/breaches.js

import React, { useEffect, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import ComplianceLayout from "@/components/compliance/ComplianceLayout";

const SEVERITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["open", "contained", "reported", "closed"];

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

const hoursSince = (iso) => {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 36e5));
};

function NewBreachForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [rootCause, setRootCause] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/admin/compliance/breaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category,
          severity,
          root_cause: rootCause,
          detected_at: new Date().toISOString(),
        }),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload?.success) {
        setError(payload?.message || "Could not create breach.");
        return;
      }
      setCategory("");
      setRootCause("");
      setSeverity("medium");
      setOpen(false);
      onCreated?.();
    } catch (err) {
      setError(err?.message || "Could not create breach.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
        + New Breach Record
      </Button>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
      <label style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
        Category
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          placeholder="e.g. unauthorised_access, wrong_recipient"
          className="app-input"
          style={{ marginTop: 4, width: "100%", minHeight: 40 }}
        />
      </label>
      <label style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
        Severity
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="app-input"
          style={{ marginTop: 4, width: "100%", minHeight: 40 }}
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
        Root cause / what happened
        <textarea
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          rows={4}
          required
          className="app-input"
          style={{ marginTop: 4, width: "100%" }}
        />
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

export default function BreachesPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setError("");
    try {
      const r = await fetch("/api/admin/compliance/breaches", { credentials: "include" });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload?.success) {
        setError(payload?.message || "Could not load breaches.");
        setRows([]);
        return;
      }
      setRows(payload.breaches || []);
    } catch (err) {
      setError(err?.message || "Could not load breaches.");
      setRows([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patch = async (id, patchBody) => {
    setBusyId(id);
    try {
      const r = await fetch("/api/admin/compliance/breaches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, ...patchBody }),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload?.success) {
        setError(payload?.message || "Could not update breach.");
        return;
      }
      await load();
    } catch (err) {
      setError(err?.message || "Could not update breach.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ComplianceLayout title="Breaches">
      <Section title="Report a Breach">
        <NewBreachForm onCreated={load} />
      </Section>

      <Section title="Breach Register">
        {error && (
          <p role="alert" style={{ margin: "0 0 10px", color: "var(--danger-base, #ef4444)" }}>
            {error}
          </p>
        )}
        {rows === null ? (
          <p style={{ margin: 0, color: "var(--text-1)" }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-1)" }}>No breaches on record.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-1)" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Detected</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Hours elapsed</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Category</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Severity</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Status</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>ICO ref</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const elapsed = hoursSince(row.detected_at);
                  const overdue = elapsed > 72 && !row.ico_notified_at && row.status !== "closed";
                  return (
                    <tr key={row.id}>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>{fmt(row.detected_at)}</td>
                      <td style={{
                        padding: 8,
                        borderBottom: "1px solid var(--primary-border)",
                        color: overdue ? "var(--danger-base, #ef4444)" : "inherit",
                        fontWeight: overdue ? 700 : 400,
                      }}>
                        {elapsed}h{overdue ? " ⚠" : ""}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>{row.category || "—"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>
                        <select
                          value={row.severity || "medium"}
                          disabled={busyId === row.id}
                          onChange={(e) => patch(row.id, { severity: e.target.value })}
                          className="app-input"
                          style={{ minHeight: 32 }}
                        >
                          {SEVERITIES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>
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
                      <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>
                        <input
                          type="text"
                          defaultValue={row.ico_reference || ""}
                          placeholder="ICO ref"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== (row.ico_reference || "")) {
                              patch(row.id, {
                                ico_reference: v,
                                ico_notified_at: row.ico_notified_at || new Date().toISOString(),
                              });
                            }
                          }}
                          className="app-input"
                          style={{ minHeight: 32, width: 130 }}
                        />
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>
                        {row.status !== "closed" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={busyId === row.id}
                            onClick={() => patch(row.id, { status: "closed" })}
                          >
                            Close
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </ComplianceLayout>
  );
}
