// file location: src/pages/hr/training.js
import React from "react";
import Layout from "../../components/Layout";
import { useHrMockData } from "../../hooks/useHrData";
import { SectionCard, StatusTag } from "../../components/HR/MetricCard";

// TODO: Swap placeholder course catalogue for real LMS integration after testing.
const placeholderCourses = [
  { id: "COURSE-1", name: "Hybrid Vehicle Safety", mandatory: true, duration: "4 hrs" },
  { id: "COURSE-2", name: "Customer Experience Excellence", mandatory: false, duration: "2 hrs" },
  { id: "COURSE-3", name: "MOT Standards Update 2024", mandatory: true, duration: "3 hrs" },
];

export default function HrTrainingQualifications() {
  const { data, isLoading, error } = useHrMockData();

  const trainingRenewals = data?.trainingRenewals ?? [];
  const employeeDirectory = data?.employeeDirectory ?? [];

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
        <header>
          <p style={{ color: "#6B7280", marginTop: "6px" }}>
            Monitor mandatory training, certificate uploads, and renewal reminders.
          </p>
        </header>

        {isLoading && (
          <SectionCard title="Loading training data" subtitle="Fetching renewals and directory.">
            <span style={{ color: "#6B7280" }}>
              Retrieving placeholder training records to validate the UI flow.
            </span>
          </SectionCard>
        )}

        {error && (
          <SectionCard title="Unable to load training data" subtitle="Mock API returned an error.">
            <span style={{ color: "#B91C1C" }}>{error.message}</span>
          </SectionCard>
        )}

        {!isLoading && !error && (
          <>
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
                    <tr style={{ color: "#6B7280", fontSize: "0.8rem" }}>
                      <th style={{ textAlign: "left", paddingBottom: "10px" }}>Course</th>
                      <th>Employee</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainingRenewals.map((record) => {
                      const tone =
                        record.status === "Overdue"
                          ? "danger"
                          : record.status === "Due Soon"
                          ? "warning"
                          : "default";
                      return (
                        <tr key={record.id} style={{ borderTop: "1px solid #E5E7EB" }}>
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
                    <li key={course.id} style={{ color: "#374151" }}>
                      <strong>{course.name}</strong> — {course.duration}{" "}
                      {course.mandatory ? "(Mandatory)" : "(Optional)"}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </section>

            <SectionCard
              title="Assign Training"
              subtitle="Send employees on mandatory or optional courses."
            >
              <form style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                <label style={labelStyle}>
                  <span>Employee</span>
                  <select style={inputStyle} defaultValue="">
                    <option value="" disabled>
                      Choose employee
                    </option>
                    {/* TODO: Replace employee list with real-time lookup before GA. */}
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

            <SectionCard
              title="Training Compliance Snapshot"
              subtitle="High-level view of overall compliance rates."
            >
              <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
                <ComplianceCard title="Workshop" percent={88} status="On Track" />
                <ComplianceCard title="Service" percent={76} status="Needs Attention" />
                <ComplianceCard title="Sales" percent={91} status="On Track" />
                <ComplianceCard title="Valet" percent={64} status="Behind" />
              </div>
              <p style={{ color: "#6B7280", marginTop: "16px" }}>
                These percentages use placeholder data for UI verification. Replace with real metrics once Supabase views are ready.
              </p>
            </SectionCard>
          </>
        )}
      </div>
    </Layout>
  );
}

function ComplianceCard({ title, percent, status }) {
  const tone = percent >= 85 ? "success" : percent >= 70 ? "warning" : "danger";

  return (
    <div
      style={{
        flex: "1 1 220px",
        background: "white",
        padding: "18px",
        borderRadius: "12px",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <span style={{ fontWeight: 600, color: "#111827" }}>{title}</span>
      <span style={{ fontSize: "2rem", fontWeight: 700, color: "#0EA5E9" }}>{percent}%</span>
      <StatusTag label={status} tone={tone} />
    </div>
  );
}

const buttonStylePrimary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#0EA5E9",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid #BAE6FD",
  background: "white",
  color: "#0284C7",
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
