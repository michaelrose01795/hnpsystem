// file location: src/components/support/dev/SupportTriagePanel.js
//
// Help & Diagnostics ("support") — Phase 6. Triage controls for a report:
// status, severity, assignee (assign-to-me / unassign), and duplicate linking.
// All mutations are optimistic (handled by the parent's `patch`, from
// useSupportReport). Reusable wherever a report needs quick triage.

import React, { useState } from "react";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { useUser } from "@/context/UserContext";
import { Panel, KeyValue, KeyValueGrid, DevButton, Pill } from "@/components/support/dev/supportDevUi";
import { STATUS_OPTIONS, SEVERITY_OPTIONS, STATUS_META, SEVERITY_META } from "@/lib/support/adminView";

export default function SupportTriagePanel({ report, patch }) {
  const { dbUserId } = useUser();
  const [dupInput, setDupInput] = useState("");
  if (!report) return null;

  const assignedTo = report.assigned_to;
  const isMine = Number.isInteger(dbUserId) && assignedTo === dbUserId;

  return (
    <Panel title="Triage" sectionKey="support-detail-triage">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-sm)" }}>
        <div>
          <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7, marginBottom: 4 }}>Status</div>
          <DropdownField
            options={STATUS_OPTIONS}
            value={report.status}
            onChange={(e) => patch({ status: e.target.value })}
          />
        </div>
        <div>
          <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.7, marginBottom: 4 }}>Severity</div>
          <DropdownField
            options={SEVERITY_OPTIONS}
            value={report.severity}
            onChange={(e) => patch({ severity: e.target.value })}
          />
        </div>
      </div>

      <KeyValueGrid>
        <KeyValue
          label="Assignee"
          value={
            <span style={{ display: "inline-flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {assignedTo ? <Pill label={isMine ? "You" : `User #${assignedTo}`} tone="accentText" /> : <span style={{ opacity: 0.6 }}>Unassigned</span>}
              {!isMine && Number.isInteger(dbUserId) ? (
                <DevButton small onClick={() => patch({ assignedTo: dbUserId })}>Assign to me</DevButton>
              ) : null}
              {assignedTo ? <DevButton small variant="ghost" tone="text-1" onClick={() => patch({ assignedTo: null })}>Unassign</DevButton> : null}
            </span>
          }
        />
        <KeyValue
          label="Duplicate of"
          value={
            report.duplicate_of ? (
              <span style={{ display: "inline-flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <a href={`/dev/support-reports/${report.duplicate_of}`} style={{ color: "var(--accentText)", fontFamily: "var(--font-mono, monospace)", fontSize: "var(--text-body-xs)" }}>
                  {String(report.duplicate_of).slice(0, 8)}…
                </a>
                <DevButton small variant="ghost" tone="text-1" onClick={() => patch({ duplicateOf: null })}>Clear</DevButton>
              </span>
            ) : (
              <span style={{ display: "inline-flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  className="app-input"
                  placeholder="Canonical report id (UUID)"
                  value={dupInput}
                  onChange={(e) => setDupInput(e.target.value)}
                  style={{ minHeight: 36, padding: "4px 10px", borderRadius: "var(--radius-md)", background: "var(--surface)", color: "var(--text-1)", minWidth: 220 }}
                />
                <DevButton
                  small
                  onClick={() => {
                    const v = dupInput.trim();
                    if (v && v !== report.id) {
                      patch({ duplicateOf: v, status: "duplicate" });
                      setDupInput("");
                    }
                  }}
                >
                  Mark duplicate
                </DevButton>
              </span>
            )
          }
        />
      </KeyValueGrid>

      <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.6 }}>
        Current: <Pill label={STATUS_META[report.status]?.label || report.status} tone={STATUS_META[report.status]?.tone} /> ·{" "}
        <Pill label={SEVERITY_META[report.severity]?.label || report.severity} tone={SEVERITY_META[report.severity]?.tone} />
      </div>
    </Panel>
  );
}
