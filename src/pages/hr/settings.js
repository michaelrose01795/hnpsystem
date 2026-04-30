// file location: src/pages/hr/settings.js
import React from "react";
import { SectionCard } from "@/components/Section";
import { Button, InputField } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import HrSettingsPoliciesUi from "@/components/page-ui/hr/hr-settings-ui"; // Extracted presentation layer.

function SettingsContent() {
  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--text-1)", marginTop: "var(--space-1)" }}>
          Upload policy documents, configure shift patterns, and manage role-based access for HR tools.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--layout-card-gap)"
        }}>
        
        <SectionCard
          title="Company Policies"
          subtitle="Upload and manage policies available to employees.">
          
          <form style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <InputField label="Policy Title" type="text" placeholder="e.g., Health & Safety Handbook" />
            <DropdownField
              label="Category"
              name="category"
              placeholder="Choose category"
              defaultValue=""
              options={[
              { value: "Health & Safety", label: "Health & Safety" },
              { value: "Equality & Diversity", label: "Equality & Diversity" },
              { value: "Employee Handbook", label: "Employee Handbook" },
              { value: "Code of Conduct", label: "Code of Conduct" }]
              } />
            
            <InputField label="Upload File" type="file" />
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <Button type="button" variant="primary">
                Upload policy
              </Button>
              <Button type="button" variant="ghost">
                Preview existing
              </Button>
            </div>
          </form>
          <p
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--text-1)",
              fontStyle: "italic",
              marginTop: "var(--space-md)"
            }}>
            
            TODO: Wire upload to Supabase Storage. Persist policy metadata (title, category, file URL) in the policies table.
          </p>
        </SectionCard>

        <SectionCard
          title="Shift Patterns & Break Rules"
          subtitle="Configure default schedules used across departments.">
          
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <InputField
              label="Default shift duration"
              type="number"
              min="0"
              step="1"
              defaultValue="8" />
            
            <InputField
              label="Break entitlement (minutes)"
              type="number"
              min="0"
              step="5"
              defaultValue="30" />
            
            <InputField
              label="Overtime threshold (hours per week)"
              type="number"
              min="0"
              step="1"
              defaultValue="40" />
            
            <div>
              <Button type="button" variant="primary">
                Save schedule rules
              </Button>
            </div>
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Role-Based Access"
        subtitle="Control which roles can access HR functionality.">
        
        <p style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", fontStyle: "italic", margin: 0 }}>
          TODO: Fetch role permissions from Supabase policy tables. Display editable access matrix with roles (HR Manager, Admin, Manager, Employee) and toggles for each HR module (Dashboard, Records, Payroll, Leave, Recruitment).
        </p>
      </SectionCard>

      <SectionCard
        title="Notification Settings"
        subtitle="Configure email alerts and reminders for HR events.">
        
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--space-md)"
          }}>
          
          <ToggleSetting label="Overtime submission" defaultChecked />
          <ToggleSetting label="Leave approvals" defaultChecked />
          <ToggleSetting label="Training expiries" defaultChecked={false} />
          <ToggleSetting label="Disciplinary follow-ups" defaultChecked />
          <ToggleSetting label="Recruitment updates" defaultChecked={false} />
        </div>
        <div style={{ marginTop: "var(--space-md)" }}>
          <Button type="button" variant="primary">
            Save notification preferences
          </Button>
        </div>
      </SectionCard>
    </div>);

}

export default function HrSettingsPolicies({ embedded = false } = {}) {
  return <HrSettingsPoliciesUi view="section1" SettingsContent={SettingsContent} />;
}

// Local toggle row — no global toggle component exists in the UI kit yet; uses token-only styling.
function ToggleSetting({ label, defaultChecked }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-3)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--primary-border)",
        background: "var(--surface)",
        fontWeight: 600,
        color: "var(--text-1)"
      }}>
      
      <input type="checkbox" defaultChecked={defaultChecked} />
      {label}
    </label>);

}
