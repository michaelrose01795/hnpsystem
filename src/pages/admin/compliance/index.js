// file location: src/pages/admin/compliance/index.js
// Compliance dashboard: counts of open items + list of nearest deadlines.

import React, { useEffect, useState } from "react";
import Section from "@/components/Section";
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

const hoursBetween = (a, b) =>
  Math.max(0, Math.round((new Date(a) - new Date(b)) / 36e5));

export default function ComplianceDashboardPage() {
  const [sars, setSars] = useState([]);
  const [breaches, setBreaches] = useState([]);
  const [dpias, setDpias] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, b, d] = await Promise.all([
          fetch("/api/admin/compliance/sars", { credentials: "include" }).then((r) => r.json()),
          fetch("/api/admin/compliance/breaches", { credentials: "include" }).then((r) => r.json()),
          fetch("/api/admin/compliance/dpias", { credentials: "include" }).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setSars(s?.requests || []);
        setBreaches(b?.breaches || []);
        setDpias(d?.dpias || []);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Could not load compliance data.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openSars = sars.filter((r) => r.status !== "fulfilled" && r.status !== "rejected");
  const openBreaches = breaches.filter((b) => b.status !== "closed");
  const draftDpias = dpias.filter((d) => d.status === "draft" || d.status === "in_review");

  const card = (label, count, hint) => (
    <div
      style={{
        padding: 16,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm, 8px)",
        background: "var(--section-card-bg, var(--surface))",
        minWidth: 180,
        flex: "1 1 180px",
      }}
    >
      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, marginTop: 4 }}>{count}</div>
      {hint && (
        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 6 }}>{hint}</div>
      )}
    </div>
  );

  return (
    <ComplianceLayout title="Dashboard">
      <Section title="At a Glance">
        {error && (
          <p role="alert" style={{ margin: "0 0 10px", color: "var(--danger-base, #ef4444)" }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {card("Open Subject Requests", openSars.length, "30-day SLA per request.")}
          {card("Open Breaches", openBreaches.length, "72-hour ICO clock starts at detection.")}
          {card("DPIAs in draft / review", draftDpias.length)}
        </div>
      </Section>

      <Section title="Nearest SAR Deadlines">
        {openSars.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>No open subject requests.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {openSars
              .slice()
              .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
              .slice(0, 8)
              .map((r) => (
                <li key={r.id} style={{ marginBottom: 6 }}>
                  <strong>{r.request_type}</strong> · due {fmt(r.due_at)} · status {r.status}
                </li>
              ))}
          </ul>
        )}
      </Section>

      <Section title="Open Breaches — ICO 72h Window">
        {openBreaches.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>No open breaches.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {openBreaches.map((b) => {
              const hoursElapsed = hoursBetween(new Date().toISOString(), b.detected_at);
              const overdue = hoursElapsed > 72 && !b.ico_notified_at;
              return (
                <li key={b.id} style={{ marginBottom: 6 }}>
                  <strong>{b.category || "Breach"}</strong> · detected {fmt(b.detected_at)} ·{" "}
                  <span style={{ color: overdue ? "var(--danger-base, #ef4444)" : "inherit" }}>
                    {hoursElapsed}h elapsed{overdue ? " (ICO deadline passed)" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </ComplianceLayout>
  );
}
