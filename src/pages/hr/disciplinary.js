// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/disciplinary.js
import React from "react";
import Layout from "@/components/Layout";
import { SectionCard } from "@/components/HR/MetricCard";
import { CalendarField } from "@/components/calendarAPI"; // Date input component

function DisciplinaryContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--info)", marginTop: "6px" }}>
          Log warnings, track follow-ups, and maintain audit trails for workplace incidents.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px" }}>
          <SectionCard
            title="Active Warnings"
            subtitle="Warnings that still require follow-up or monitoring."
          >
            <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", margin: 0 }}>
              TODO: Fetch active warnings from Supabase disciplinary table. Display employee name, department, warning level, reported date, status, and notes for each open case.
            </p>
          </SectionCard>

          <SectionCard
            title="Incident Log"
            subtitle="Recent case entries and their current outcome."
          >
            <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", margin: 0 }}>
              TODO: Fetch incident log from Supabase. Display incident type, job number, recorded by, outcome status, and export functionality.
            </p>
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
            <CalendarField
              label="Incident Date"
              name="incidentDate"
              id="incidentDate"
            />
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
          <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", marginTop: "18px" }}>
            TODO: Wire form submission to Supabase incidents table. Save record should persist the incident and refresh the active warnings list.
          </p>
      </SectionCard>
    </div>
  );
}

export default function HrDisciplinaryIncidents({ embedded = false } = {}) {
  const content = <DisciplinaryContent />;
  return embedded ? content : <Layout>{content}</Layout>;
}

const buttonStylePrimary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "none",
  background: "var(--danger)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleGhost = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px dashed var(--info)",
  background: "transparent",
  color: "var(--info)",
  fontWeight: 600,
  cursor: "pointer",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "0.85rem",
  color: "var(--info-dark)",
  fontWeight: 600,
};

const inputStyle = {
  borderRadius: "10px",
  border: "1px solid var(--accent-purple-surface)",
  padding: "10px 12px",
  fontWeight: 500,
  color: "var(--accent-purple)",
  background: "var(--surface)",
};
