// file location: src/pages/hr/settings.js
import React from "react";
import { SectionCard } from "@/components/Section";
import { Button, InputField, LayerTheme } from "@/components/ui"; // LayerTheme: canonical layer primitive (see CLAUDE.md §3.0)
import { DropdownField } from "@/components/ui/dropdownAPI";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import HrSettingsPoliciesUi from "@/components/page-ui/hr/hr-settings-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { hrPresentationData } from "@/features/presentation/mockData/hr_operations";

function SettingsContent() {
  const showPresentationMock = isPresentationMode();

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--text-1)", marginTop: "var(--space-1)" }}>
          Upload policy documents, configure shift patterns, and manage role-based access for HR tools.
        </p>
      </header>

      <DevLayoutSection
        as="section"
        sectionKey="hr-settings-policies-row"
        parentKey="hr-manager-tab-settings"
        sectionType="section-shell"
        shell
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--layout-card-gap)"
        }}>

        <SectionCard
          sectionKey="hr-settings-card-1" parentKey="hr-settings-policies-row"
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
          {showPresentationMock ? (
            <div style={{ marginTop: "var(--space-md)", overflowX: "auto" }}>
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th>Policy</th>
                    <th>Category</th>
                    <th>Updated</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hrPresentationData.policyDocuments.map((policy) => (
                    <tr key={policy.id}>
                      <td style={{ fontWeight: 600 }}>{policy.title}</td>
                      <td>{policy.category}</td>
                      <td>{new Date(policy.updatedAt).toLocaleDateString()}</td>
                      <td>{policy.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          sectionKey="hr-settings-card-2" parentKey="hr-settings-policies-row"
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
      </DevLayoutSection>

      <SectionCard
        sectionKey="hr-settings-card-3" parentKey="hr-manager-tab-settings"
        title="Role-Based Access"
        subtitle="Control which roles can access HR functionality.">
        
        {showPresentationMock ? (
          <div style={{ overflowX: "auto" }}>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Modules</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {hrPresentationData.accessMatrix.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600 }}>{row.role}</td>
                    <td>{row.modules}</td>
                    <td>{row.access}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch role permissions from Supabase policy tables. Display editable access matrix with roles (HR Manager, Admin, Manager, Employee) and toggles for each HR module (Dashboard, Records, Payroll, Leave, Recruitment).
          </p>
        )}
      </SectionCard>

      <SectionCard
        sectionKey="hr-settings-card-4" parentKey="hr-manager-tab-settings"
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

export default function HrSettingsPolicies() {
  return <HrSettingsPoliciesUi view="section1" SettingsContent={SettingsContent} />;
}

// Local toggle row — no global toggle component exists in the UI kit yet.
// Surface routes through LayerTheme (sits inside a SectionCard = LayerSurface,
// so per the alternation rule it renders as LayerTheme).
function ToggleSetting({ label, defaultChecked }) {
  return (
    <LayerTheme
      as="label"
      radius="var(--radius-sm)"
      padding="var(--space-3)"
      gap="var(--space-2)"
      style={{
        flexDirection: "row",
        alignItems: "center",
        fontWeight: 600,
        color: "var(--text-1)"
      }}>

      <input type="checkbox" defaultChecked={defaultChecked} />
      {label}
    </LayerTheme>);

}
