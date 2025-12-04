// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/settings.js
import React from "react";
import Layout from "@/components/Layout";
import { SectionCard } from "@/components/HR/MetricCard";

// TODO: Persist policy uploads, shift rules, and access controls to the HR settings tables.

// TODO: Replace placeholder policy uploads and access matrix with real configuration storage.
export default function HrSettingsPolicies() {
  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
        <header>
          <p style={{ color: "var(--info)", marginTop: "6px" }}>
            Upload policy documents, configure shift patterns, and manage role-based access for HR tools.
          </p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "20px" }}>
          <SectionCard
            title="Company Policies"
            subtitle="Upload and manage policies available to employees."
          >
            <form style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={labelStyle}>
                <span>Policy Title</span>
                <input style={inputStyle} type="text" placeholder="e.g., Health & Safety Handbook" />
              </label>
              <label style={labelStyle}>
                <span>Category</span>
                <select style={inputStyle} defaultValue="">
                  <option value="" disabled>
                    Choose category
                  </option>
                  <option value="Health & Safety">Health & Safety</option>
                  <option value="Equality & Diversity">Equality & Diversity</option>
                  <option value="Employee Handbook">Employee Handbook</option>
                  <option value="Code of Conduct">Code of Conduct</option>
                </select>
              </label>
              <label style={labelStyle}>
                <span>Upload File</span>
                <input style={inputStyle} type="file" />
              </label>
              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" style={buttonStylePrimary}>
                  Upload policy
                </button>
                <button type="button" style={buttonStyleGhost}>
                  Preview existing
                </button>
              </div>
            </form>
            <p style={{ color: "var(--info)", marginTop: "16px" }}>
              Placeholder upload form. Connect to Supabase Storage and metadata tables before deployment.
            </p>
          </SectionCard>

          <SectionCard
            title="Shift Patterns & Break Rules"
            subtitle="Configure default schedules used across departments."
          >
            <label style={labelStyle}>
              <span>Default shift duration</span>
              <input style={inputStyle} type="number" min="0" step="1" defaultValue="8" />
            </label>
            <label style={labelStyle}>
              <span>Break entitlement (minutes)</span>
              <input style={inputStyle} type="number" min="0" step="5" defaultValue="30" />
            </label>
            <label style={labelStyle}>
              <span>Overtime threshold (hours per week)</span>
              <input style={inputStyle} type="number" min="0" step="1" defaultValue="40" />
            </label>
            <button type="button" style={buttonStylePrimary}>
              Save schedule rules
            </button>
          </SectionCard>
        </section>

        <SectionCard
          title="Role-Based Access"
          subtitle="Control which roles can access HR functionality."
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                  <th style={{ textAlign: "left", paddingBottom: "10px" }}>Role</th>
                  <th>HR Dashboard</th>
                  <th>Employee Records</th>
                  <th>Payroll</th>
                  <th>Leave Approvals</th>
                  <th>Recruitment</th>
                </tr>
              </thead>
              <tbody>
                {accessMatrix.map((row) => (
                  <tr key={row.role} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                    <td style={{ padding: "12px 0", fontWeight: 600 }}>{row.role}</td>
                    <td style={cellStyle}>{renderToggle(row.hrDashboard)}</td>
                    <td style={cellStyle}>{renderToggle(row.employeeRecords)}</td>
                    <td style={cellStyle}>{renderToggle(row.payroll)}</td>
                    <td style={cellStyle}>{renderToggle(row.leave)}</td>
                    <td style={cellStyle}>{renderToggle(row.recruitment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ color: "var(--info)", marginTop: "16px" }}>
            Toggle boxes are placeholders to visualise permissions. Integrate with Supabase policy tables later.
          </p>
        </SectionCard>

        <SectionCard
          title="Notification Settings"
          subtitle="Configure email alerts and reminders for HR events."
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            <ToggleSetting label="Overtime submission" defaultChecked />
            <ToggleSetting label="Leave approvals" defaultChecked />
            <ToggleSetting label="Training expiries" defaultChecked={false} />
            <ToggleSetting label="Disciplinary follow-ups" defaultChecked />
            <ToggleSetting label="Recruitment updates" defaultChecked={false} />
          </div>
          <button type="button" style={{ ...buttonStylePrimary, marginTop: "16px" }}>
            Save notification preferences
          </button>
        </SectionCard>
      </div>
    </Layout>
  );
}

const accessMatrix = [
  { role: "HR Manager", hrDashboard: true, employeeRecords: true, payroll: true, leave: true, recruitment: true },
  { role: "Admin Manager / Owner", hrDashboard: true, employeeRecords: true, payroll: true, leave: true, recruitment: true },
  { role: "Manager (Service/Sales/Workshop)", hrDashboard: true, employeeRecords: false, payroll: false, leave: true, recruitment: false },
  { role: "Employee", hrDashboard: false, employeeRecords: false, payroll: false, leave: false, recruitment: false },
];

function renderToggle(isEnabled) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "36px",
        height: "20px",
        borderRadius: "999px",
        backgroundColor: isEnabled ? "var(--success)" : "var(--info)",
        color: "white",
        fontWeight: 700,
        fontSize: "0.7rem",
      }}
    >
      {isEnabled ? "ON" : "OFF"}
    </span>
  );
}

function ToggleSetting({ label, defaultChecked }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px",
        borderRadius: "12px",
        border: "1px solid var(--accent-purple-surface)",
        background: "var(--surface)",
        fontWeight: 600,
        color: "var(--info-dark)",
      }}
    >
      <input type="checkbox" defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

const buttonStylePrimary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "none",
  background: "var(--accent-purple)",
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

const cellStyle = {
  textAlign: "center",
  padding: "12px 0",
};
