// file location: src/pages/hr/settings.js
import React from "react";
import { SectionCard } from "@/components/Section";
import { Button, InputField, LayerSurface } from "@/components/ui"; // LayerSurface: third rung — nested inside a --theme SectionCard (CLAUDE.md §3.0a-2)
import { DropdownField } from "@/components/ui/dropdownAPI";
import HrSettingsPoliciesUi from "@/components/page-ui/hr/hr-settings-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { hrPresentationData } from "@/features/presentation/mockData/hr_operations";
import { redirectToHrManagerTab } from "@/lib/hr/hrManagerRoutes";
import DataTableShell from "@/components/ui/DataTableShell"; // canonical table scroll shell (CLAUDE.md §3.4)
import EmptyState from "@/components/ui/EmptyState"; // canonical empty-state primitive

export function getServerSideProps() {
  return redirectToHrManagerTab("settings");
}

function SettingsContent() {
  const showPresentationMock = isPresentationMode();

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--text-1)", marginTop: "var(--space-1)" }}>
          Upload policy documents, configure shift patterns, and manage role-based access for HR tools.
        </p>
      </header>

      <SectionCard layer="theme"
        sectionKey="hr-settings-company-policies" parentKey="hr-manager-tab-settings"
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
        {showPresentationMock ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell style={{ marginTop: "var(--space-md)" }}>
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
            </DataTableShell>
          </LayerSurface>
        ) : null}
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-settings-shift-patterns" parentKey="hr-manager-tab-settings"
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

      <SectionCard layer="theme"
        sectionKey="hr-settings-role-based-access" parentKey="hr-manager-tab-settings"
        title="Role-Based Access"
        subtitle="Control which roles can access HR functionality.">
        
        {showPresentationMock ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
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
            </DataTableShell>
          </LayerSurface>
        ) : (
          <EmptyState
            icon="🔐"
            title="Access matrix not configured"
            description="Which roles can reach each HR module appears here once the access policy is set up."
          />
        )}
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-settings-notifications" parentKey="hr-manager-tab-settings"
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
// Surface routes through LayerSurface: it sits inside a SectionCard, which is
// now the --theme rung of the ladder, so the alternation rule puts the toggle
// row back on --surface (CLAUDE.md 3.0a-2).
function ToggleSetting({ label, defaultChecked }) {
  return (
    <LayerSurface
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
    </LayerSurface>);

}
