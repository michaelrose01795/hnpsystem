// file location: src/pages/newpage.js
import React, { useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import LayerTheme from "@/components/ui/LayerTheme";
import { WORKSHOP_CONTROLLER_ROLES } from "@/lib/auth/roles";

const NEWPAGE_ALLOWED_ROLES = WORKSHOP_CONTROLLER_ROLES.map((role) => role.toUpperCase());

const testTabs = [
  { key: "overview", label: "Overview" },
  { key: "workshop", label: "Workshop" },
  { key: "testing", label: "Testing" },
];

const statusOptions = [
  { value: "all", label: "All departments", description: "Show every test row" },
  { value: "workshop", label: "Workshop", description: "Workshop-only mock rows" },
  { value: "parts", label: "Parts", description: "Parts-only mock rows" },
  { value: "service", label: "Service", description: "Service-only mock rows" },
];

const testRows = [
  {
    id: "NP-001",
    department: "workshop",
    owner: "Workshop Team",
    task: "Inspect table spacing",
    status: "Ready",
  },
  {
    id: "NP-002",
    department: "parts",
    owner: "Parts Desk",
    task: "Check dropdown alignment",
    status: "In Review",
  },
  {
    id: "NP-003",
    department: "service",
    owner: "Service Advisors",
    task: "Confirm mobile wrapping",
    status: "Ready",
  },
  {
    id: "NP-004",
    department: "workshop",
    owner: "Workshop Control",
    task: "Validate row separators",
    status: "Queued",
  },
];

const formatDepartment = (department) =>
  department.charAt(0).toUpperCase() + department.slice(1);

export default function NewPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  const visibleRows = useMemo(() => {
    if (selectedDepartment === "all") return testRows;
    return testRows.filter((row) => row.department === selectedDepartment);
  }, [selectedDepartment]);

  return (
    <ProtectedRoute allowedRoles={NEWPAGE_ALLOWED_ROLES}>
      <>
        <LayerTheme
          as="section"
          sectionKey="newpage-controls"
          sectionType="content-card"
          parentKey="app-layout-page-card"
          gap="var(--layout-card-gap)"
        >
          <TabGroup
            items={testTabs.map((tab) => ({ value: tab.key, label: tab.label }))}
            value={activeTab}
            onChange={setActiveTab}
            ariaLabel="Test tabs"
            devSectionKey="newpage-test-tabs"
            devSectionParent="newpage-controls"
          />

          <p style={{ margin: 0, color: "var(--surfaceTextMuted)", fontSize: "var(--text-body-sm)" }}>
            Active tab: {testTabs.find((tab) => tab.key === activeTab)?.label}
          </p>

          <DropdownField
            id="newpage-department-filter"
            label="Department"
            options={statusOptions}
            value={selectedDepartment}
            onChange={(event) => setSelectedDepartment(event.target.value)}
            helperText="Filter the local mock rows below."
            searchable
            style={{ maxWidth: 360, width: "100%" }}
          />
        </LayerTheme>

        <LayerTheme
          as="section"
          sectionKey="newpage-table-card"
          sectionType="content-card"
          parentKey="app-layout-page-card"
          gap="var(--layout-card-gap)"
        >
          <div
            data-app-table-shell-scroll
            data-dev-section="1"
            data-dev-section-key="newpage-table-wrap"
            data-dev-section-type="data-table"
            data-dev-section-parent="newpage-table-card"
            data-dev-shell="0"
            style={{ overflowX: "auto", width: "100%" }}
          >
            <table
              data-dev-section="1"
              data-dev-section-key="newpage-table"
              data-dev-section-type="data-table"
              data-dev-section-parent="newpage-table-wrap"
              style={{ width: "100%", minWidth: 680, borderCollapse: "collapse" }}
            >
              <thead
                data-dev-section="1"
                data-dev-section-key="newpage-table-headings"
                data-dev-section-type="table-headings"
                data-dev-section-parent="newpage-table"
              >
                <tr style={{ textAlign: "left", color: "var(--surfaceTextMuted)" }}>
                  <th style={{ padding: "10px 12px 10px 0", borderBottom: "1px solid var(--separating-line)" }}>Reference</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--separating-line)" }}>Department</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--separating-line)" }}>Owner</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--separating-line)" }}>Test Item</th>
                  <th style={{ padding: "10px 0 10px 12px", borderBottom: "1px solid var(--separating-line)" }}>Status</th>
                </tr>
              </thead>
              <tbody
                data-dev-section="1"
                data-dev-section-key="newpage-table-rows"
                data-dev-section-type="table-rows"
                data-dev-section-parent="newpage-table"
              >
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: "10px 12px 10px 0", borderBottom: "1px solid var(--separating-line)", fontWeight: 700 }}>
                      {row.id}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--separating-line)" }}>
                      {formatDepartment(row.department)}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--separating-line)" }}>
                      {row.owner}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--separating-line)" }}>
                      {row.task}
                    </td>
                    <td style={{ padding: "10px 0 10px 12px", borderBottom: "1px solid var(--separating-line)" }}>
                      {row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LayerTheme>
      </>
    </ProtectedRoute>
  );
}
