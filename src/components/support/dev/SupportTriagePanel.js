// file location: src/components/support/dev/SupportTriagePanel.js
//
// Help & Diagnostics ("support") — Phase 6. Triage controls for a report:
// status, severity, assignee (assign-to-me / unassign), and duplicate linking.
// All mutations are optimistic (handled by the parent's `patch`, from
// useSupportReport). Reusable wherever a report needs quick triage.

import React, { useState } from "react";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { useUser } from "@/context/UserContext";
import { Panel, KeyValue, KeyValueGrid, badgeClass } from "@/components/support/dev/supportDevUi";
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
          <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.7, marginBottom: 4 }}>Status</div>
          <DropdownField
            options={STATUS_OPTIONS}
            value={report.status}
            onChange={(e) => patch({ status: e.target.value })}
          />
        </div>
        <div>
          <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.7, marginBottom: 4 }}>Severity</div>
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
              {assignedTo ? <span className="app-badge app-badge--accent-soft">{isMine ? "You" : `User #${assignedTo}`}</span> : <span style={{ opacity: 0.6 }}>Unassigned</span>}
              {!isMine && Number.isInteger(dbUserId) ? (
                <button type="button" onClick={() => patch({ assignedTo: dbUserId })} className="app-btn app-btn--secondary app-btn--sm">Assign to me</button>
              ) : null}
              {assignedTo ? <button type="button" onClick={() => patch({ assignedTo: null })} className="app-btn app-btn--secondary app-btn--sm">Unassign</button> : null}
            </span>
          }
        />
        <KeyValue
          label="Duplicate of"
          value={
            report.duplicate_of ? (
              <span style={{ display: "inline-flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <a href={`/dev/support-reports/${report.duplicate_of}`} style={{ color: "var(--accentText)", fontFamily: "var(--font-family-mono)", fontSize: "var(--text-caption)" }}>
                  {String(report.duplicate_of).slice(0, 8)}…
                </a>
                <button type="button" onClick={() => patch({ duplicateOf: null })} className="app-btn app-btn--secondary app-btn--sm">Clear</button>
              </span>
            ) : (
              <span style={{ display: "inline-flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  className="app-input"
                  placeholder="Canonical report id (UUID)"
                  value={dupInput}
                  onChange={(e) => setDupInput(e.target.value)}
                  style={{ minWidth: 220 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = dupInput.trim();
                    if (v && v !== report.id) {
                      patch({ duplicateOf: v, status: "duplicate" });
                      setDupInput("");
                    }
                  }}
                  className="app-btn app-btn--secondary app-btn--sm"
                >
                  Mark duplicate
                </button>
              </span>
            )
          }
        />
      </KeyValueGrid>

      <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.6 }}>
        Current: <span className={badgeClass(STATUS_META[report.status]?.tone)}>{STATUS_META[report.status]?.label || report.status}</span> ·{" "}
        <span className={badgeClass(SEVERITY_META[report.severity]?.tone)}>{SEVERITY_META[report.severity]?.label || report.severity}</span>
      </div>
    </Panel>
  );
}
