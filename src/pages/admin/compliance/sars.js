// file location: src/pages/admin/compliance/sars.js
// Compliance officer view of subject_requests + status update.

import React, { useEffect, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import ComplianceLayout from "@/components/compliance/ComplianceLayout";

const STATUSES = [
  "received",
  "identity_verified",
  "in_progress",
  "fulfilled",
  "rejected",
];

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

export default function SarsPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setError("");
    try {
      const r = await fetch("/api/admin/compliance/sars", { credentials: "include" });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload?.success) {
        setError(payload?.message || "Could not load subject requests.");
        setRows([]);
        return;
      }
      setRows(payload.requests || []);
    } catch (err) {
      setError(err?.message || "Could not load subject requests.");
      setRows([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id, nextStatus) => {
    setBusyId(id);
    try {
      const r = await fetch("/api/admin/compliance/sars", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, status: nextStatus }),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok || !payload?.success) {
        setError(payload?.message || "Could not update status.");
        return;
      }
      await load();
    } catch (err) {
      setError(err?.message || "Could not update status.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ComplianceLayout title="Subject Requests">
      <Section title="Subject Requests">
        {error && (
          <p role="alert" style={{ margin: "0 0 10px", color: "var(--danger-base, #ef4444)" }}>
            {error}
          </p>
        )}
        {rows === null ? (
          <p style={{ margin: 0, color: "var(--text-1)" }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-1)" }}>No subject requests on record.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-1)" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Type</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Subject</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Status</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Received</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Due</th>
                  <th style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>
                      {row.request_type}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>
                      {row.subject_email || `#${row.subject_user_id || "—"}`}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>
                      <select
                        value={row.status}
                        disabled={busyId === row.id}
                        onChange={(e) => updateStatus(row.id, e.target.value)}
                        className="app-input"
                        style={{ minHeight: 32 }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>{fmt(row.received_at)}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>{fmt(row.due_at)}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--primary-border)" }}>
                      {row.status !== "fulfilled" && row.status !== "rejected" && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={busyId === row.id}
                          onClick={() => updateStatus(row.id, "fulfilled")}
                        >
                          Mark fulfilled
                        </Button>
                      )}
                    </td>
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
