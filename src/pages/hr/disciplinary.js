// file location: src/pages/hr/disciplinary.js
import React from "react";
import Layout from "../../components/Layout";
import { SectionCard, StatusTag } from "../../components/HR/MetricCard";

// TODO: Replace placeholder incident data with live case records before shipping.
const placeholderIncidents = [
  {
    id: "INC-1",
    employee: "Aaron Blake",
    department: "Workshop",
    level: "Written Warning",
    reportedOn: "2024-02-02",
    status: "Open",
    notes: "Repeated late arrivals. Monitoring punctuality for 30 days.",
  },
  {
    id: "INC-2",
    employee: "Emily Chen",
    department: "Service",
    level: "Verbal Warning",
    reportedOn: "2024-02-26",
    status: "Closed",
    notes: "Missing paperwork on job handovers. Completed refresher training.",
  },
];

const placeholderIncidentsLog = [
  {
    id: "LOG-1",
    jobNumber: "J-20451",
    type: "Incident Report",
    recordedBy: "Sarah Thompson",
    outcome: "Awaiting review",
    createdAt: "2024-03-08",
  },
  {
    id: "LOG-2",
    jobNumber: "J-20402",
    type: "Safety Breach",
    recordedBy: "Workshop QC",
    outcome: "Closed",
    createdAt: "2024-02-17",
  },
];

export default function HrDisciplinaryIncidents() {
  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
        <header>
          <p style={{ color: "#6B7280", marginTop: "6px" }}>
            Log warnings, track follow-ups, and maintain audit trails for workplace incidents.
          </p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px" }}>
          <SectionCard
            title="Active Warnings"
            subtitle="Warnings that still require follow-up or monitoring."
            action={
              <button type="button" style={buttonStylePrimary}>
                Add warning
              </button>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {placeholderIncidents.map((incident) => (
                <div
                  key={incident.id}
                  style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: "12px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    background: "rgba(249, 250, 251, 0.8)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>{incident.employee}</span>
                    <StatusTag
                      label={incident.level}
                      tone={incident.level.includes("Final") ? "danger" : "warning"}
                    />
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>
                    Reported {new Date(incident.reportedOn).toLocaleDateString()} • {incident.department}
                  </span>
                  <p style={{ margin: 0, color: "#374151" }}>{incident.notes}</p>
                  <StatusTag label={incident.status} tone={incident.status === "Open" ? "warning" : "success"} />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Incident Log"
            subtitle="Recent case entries and their current outcome."
            action={
              <button type="button" style={buttonStyleSecondary}>
                Export log
              </button>
            }
          >
            <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {placeholderIncidentsLog.map((entry) => (
                <li key={entry.id} style={{ color: "#374151" }}>
                  <strong>{entry.type}</strong> • Job {entry.jobNumber} • {entry.recordedBy} •{" "}
                  <StatusTag
                    label={entry.outcome}
                    tone={entry.outcome === "Closed" ? "success" : "warning"}
                  />
                </li>
              ))}
            </ul>
          </SectionCard>
        </section>

        <SectionCard
          title="New Incident / Warning"
          subtitle="Record the details, attach documentation, and assign a case owner."
        >
          <form style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            <label style={labelStyle}>
              <span>Employee Name</span>
              <input style={inputStyle} type="text" placeholder="Employee involved" />
            </label>
            <label style={labelStyle}>
              <span>Department</span>
              <input style={inputStyle} type="text" placeholder="Department / team" />
            </label>
            <label style={labelStyle}>
              <span>Incident Date</span>
              <input style={inputStyle} type="date" />
            </label>
            <label style={labelStyle}>
              <span>Warning Level</span>
              <select style={inputStyle} defaultValue="">
                <option value="" disabled>
                  Choose level
                </option>
                <option value="Verbal Warning">Verbal Warning</option>
                <option value="Written Warning">Written Warning</option>
                <option value="Final Warning">Final Warning</option>
                <option value="Incident Report">Incident Report</option>
              </select>
            </label>
            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
              <span>Summary</span>
              <textarea
                style={{ ...inputStyle, minHeight: "140px", resize: "vertical" }}
                placeholder="Describe the incident, who was involved, and immediate actions taken."
              ></textarea>
            </label>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: "12px" }}>
              <button type="button" style={buttonStylePrimary}>
                Save record
              </button>
              <button type="button" style={buttonStyleGhost}>
                Attach supporting file
              </button>
            </div>
          </form>
          <p style={{ color: "#6B7280", marginTop: "18px" }}>
            These controls are placeholders for UX validation. Wire up Supabase tables for incidents and warnings before launch.
          </p>
        </SectionCard>
      </div>
    </Layout>
  );
}

const buttonStylePrimary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#F97316",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid #FED7AA",
  background: "white",
  color: "#B45309",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleGhost = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px dashed #D1D5DB",
  background: "transparent",
  color: "#6B7280",
  fontWeight: 600,
  cursor: "pointer",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "0.85rem",
  color: "#374151",
  fontWeight: 600,
};

const inputStyle = {
  borderRadius: "10px",
  border: "1px solid #E5E7EB",
  padding: "10px 12px",
  fontWeight: 500,
  color: "#111827",
  background: "#FFFFFF",
};
