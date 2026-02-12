// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/settings.js
import React from "react";
import Layout from "@/components/Layout";
import { SectionCard } from "@/components/HR/MetricCard";

function SettingsContent() {
  return (
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
            <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", marginTop: "16px" }}>
              TODO: Wire upload to Supabase Storage. Persist policy metadata (title, category, file URL) in the policies table.
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
          <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch role permissions from Supabase policy tables. Display editable access matrix with roles (HR Manager, Admin, Manager, Employee) and toggles for each HR module (Dashboard, Records, Payroll, Leave, Recruitment).
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
  );
}

export default function HrSettingsPolicies({ embedded = false } = {}) {
  const content = <SettingsContent />;
  return embedded ? content : <Layout>{content}</Layout>;
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

