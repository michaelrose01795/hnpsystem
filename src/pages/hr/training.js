// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/training.js
import React from "react"; // React runtime for page rendering
import Layout from "@/components/Layout"; // shared site layout
import { useHrOperationsData } from "@/hooks/useHrData"; // Supabase-backed HR aggregation hook
import { SectionCard, StatusTag } from "@/components/HR/MetricCard"; // shared HR UI widgets

// TODO: Swap placeholder course catalogue for real LMS integration after testing.
// TODO: Persist assigned courses and renewals in the HR training database tables.
const placeholderCourses = [
  { id: "COURSE-1", name: "Hybrid Vehicle Safety", mandatory: true, duration: "4 hrs" },
  { id: "COURSE-2", name: "Customer Experience Excellence", mandatory: false, duration: "2 hrs" },
  { id: "COURSE-3", name: "MOT Standards Update 2024", mandatory: true, duration: "3 hrs" },
];

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
          action={
            <button type="button" style={buttonStyleSecondary}>
              Add course
            </button>
          }
        >
          <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {placeholderCourses.map((course) => (
              <li key={course.id} style={{ color: "var(--info-dark)" }}>
                <strong>{course.name}</strong> — {course.duration} {course.mandatory ? "(Mandatory)" : "(Optional)"}
              </li>
            ))}
          </ul>
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
            <select style={inputStyle} defaultValue="">
              <option value="" disabled>
                Select course
              </option>
              {placeholderCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            <span>Due Date</span>
            <input style={inputStyle} type="date" />
          </label>
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
        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
          <ComplianceCard title="Workshop" percent={88} status="On Track" />
          <ComplianceCard title="Service" percent={76} status="Needs Attention" />
          <ComplianceCard title="Sales" percent={91} status="On Track" />
          <ComplianceCard title="Valet" percent={64} status="Behind" />
        </div>
        <p style={{ color: "var(--info)", marginTop: "16px" }}>
          These percentages use placeholder data for UI verification. Replace with real metrics once Supabase views are ready.
        </p>
      </SectionCard>
    </div>
  );
}

export default function HrTrainingQualifications({ embedded = false } = {}) {
  const content = <TrainingContent />;
  return embedded ? content : <Layout>{content}</Layout>;
}

function ComplianceCard({ title, percent, status }) {
  const tone = percent >= 85 ? "success" : percent >= 70 ? "warning" : "danger"; // simple tone mapping

  return (
    <div
      style={{
        flex: "1 1 220px",
        background: "var(--surface)",
        padding: "18px",
        borderRadius: "12px",
        boxShadow: "none",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{title}</span>
      <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--info)" }}>{percent}%</span>
      <StatusTag label={status} tone={tone} />
    </div>
  );
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

const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--warning)",
  background: "var(--surface)",
  color: "var(--danger)",
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
