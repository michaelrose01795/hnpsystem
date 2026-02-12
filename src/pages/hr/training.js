// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/training.js
import React from "react"; // React runtime for page rendering
import Layout from "@/components/Layout"; // shared site layout
import { useHrOperationsData } from "@/hooks/useHrData"; // Supabase-backed HR aggregation hook
import { SectionCard, StatusTag } from "@/components/HR/MetricCard"; // shared HR UI widgets
import { CalendarField } from "@/components/calendarAPI"; // Date input component

function TrainingContent() {
  const { data, isLoading, error } = useHrOperationsData();
  const trainingRenewals = data?.trainingRenewals ?? [];
  const employeeDirectory = data?.employeeDirectory ?? [];

  if (isLoading) {
    return (
      <div style={{ padding: "8px 8px 32px" }}>
        <SectionCard title="Loading training data" subtitle="Fetching renewals and directory.">
          <span style={{ color: "var(--info)" }}>
            Retrieving placeholder training records to validate the UI flow.
          </span>
        </SectionCard>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "8px 8px 32px" }}>
        <SectionCard title="Unable to load training data" subtitle="Mock API returned an error.">
          <span style={{ color: "var(--danger)" }}>{error.message}</span>
        </SectionCard>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--info)", marginTop: "6px" }}>
          Monitor mandatory training, certificate uploads, and renewal reminders.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px" }}>
        <SectionCard
          title="Upcoming Expiries"
          subtitle="Renew before certificates lapse"
          action={
            <button type="button" style={buttonStylePrimary}>
              Notify employees
            </button>
          }
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                <th style={{ textAlign: "left", paddingBottom: "10px" }}>Course</th>
                <th>Employee</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trainingRenewals.map((record) => {
                const tone =
                  record.status === "Overdue" ? "danger" : record.status === "Due Soon" ? "warning" : "default";
                return (
                  <tr key={record.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                    <td style={{ padding: "12px 0", fontWeight: 600 }}>{record.course}</td>
                    <td>{record.employee}</td>
                    <td>{new Date(record.dueDate).toLocaleDateString()}</td>
                    <td>
                      <StatusTag label={record.status} tone={tone} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard
          title="Training Catalogue"
          subtitle="Courses available to assign"
        >
          <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch course catalogue from LMS/Supabase. Display course name, duration, mandatory flag, and an "Add course" action.
          </p>
        </SectionCard>
      </section>

      <SectionCard title="Assign Training" subtitle="Send employees on mandatory or optional courses.">
        <form style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <label style={labelStyle}>
            <span>Employee</span>
            <select style={inputStyle} defaultValue="">
              <option value="" disabled>
                Choose employee
              </option>
              {employeeDirectory.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            <span>Training Course</span>
            <select style={inputStyle} defaultValue="" disabled>
              <option value="" disabled>
                Select course
              </option>
            </select>
            <span style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic" }}>
              TODO: Populate course options from the training catalogue database table.
            </span>
          </label>
          <CalendarField
            label="Due Date"
            name="dueDate"
            id="dueDate"
          />
          <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
            <span>Notes for employee</span>
            <textarea
              style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
              placeholder="Provide additional guidance or pre-reading"
            ></textarea>
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "12px" }}>
            <button type="button" style={buttonStylePrimary}>
              Assign training
            </button>
            <button type="button" style={buttonStyleGhost}>
              Attach supporting file
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Training Compliance Snapshot" subtitle="High-level view of overall compliance rates.">
        <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", margin: 0 }}>
          TODO: Calculate compliance percentages per department from Supabase training records. Show percentage cards for each department with on-track/behind status.
        </p>
      </SectionCard>
    </div>
  );
}

export default function HrTrainingQualifications({ embedded = false } = {}) {
  const content = <TrainingContent />;
  return embedded ? content : <Layout>{content}</Layout>;
}

const buttonStylePrimary = {
  padding: "10px 18px",
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
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--danger)",
  fontWeight: 600,
  cursor: "pointer",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  color: "var(--info-dark)",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid var(--accent-purple-surface)",
  background: "var(--surface)",
  color: "var(--accent-purple)",
  fontSize: "0.9rem",
};
