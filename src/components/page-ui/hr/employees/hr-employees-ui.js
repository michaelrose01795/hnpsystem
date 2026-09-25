import LayerTheme from "@/components/ui/LayerTheme"; // canonical theme layer around data tables (CLAUDE.md §3.0)
import DataTableShell from "@/components/ui/DataTableShell"; // canonical table scroll shell (CLAUDE.md §3.4)
import { SectionSkeleton, SkeletonBlock, SkeletonKeyframes, TableSkeleton } from "@/components/ui/LoadingSkeleton";
// file location: src/components/page-ui/hr/employees/hr-employees-ui.js

export default function EmployeeManagementUi(props) {
  const {
    Button,
    DirectoryFilters,
    EmployeeProfilePanel,
    SectionCard,
    StatusMessage,
    StatusTag,
    employees,
    error,
    filteredEmployees,
    filters,
    isLoading,
    selectedEmployee,
    selectedEmployeeId,
    setFilters,
    setSelectedEmployeeId,
    uniqueDepartments,
    uniqueEmploymentTypes,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div className="app-page-stack" style={{
  padding: "8px 8px 32px"
}}>
      <header style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "var(--space-3)",
    flexWrap: "wrap"
  }}>
        <p style={{
      color: "var(--text-1)",
      margin: 0
    }}>
          Maintain staff records, employment details, documents, and system access.
        </p>
        <Button variant="secondary">Add Employee</Button>
      </header>

      {isLoading && <section role="status" aria-live="polite" aria-busy="true" aria-label="Loading directory" style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: "var(--layout-card-gap)"
  }}>
          <SkeletonKeyframes />
          {/* Mirrors the Employee Directory card (header + table) and the profile panel. */}
          <SectionCard>
            <div style={{
        display: "grid",
        gap: "var(--space-sm)"
      }}>
              <SkeletonBlock width="180px" height="18px" />
              <SkeletonBlock width="140px" height="12px" />
            </div>
            <LayerTheme padding="var(--space-3)" gap="0">
              <TableSkeleton columns={["Employee", "Department", "Type", "Status"]} rows={6} label="Loading employee directory" />
            </LayerTheme>
          </SectionCard>
          <SectionSkeleton layer="surface" rows={5} />
        </section>}

      {error && <SectionCard title="Failed to load employee directory" subtitle="Mock API returned an error.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>}

      {!isLoading && !error && <section style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: "var(--layout-card-gap)"
  }}>
          <SectionCard title="Employee Directory" subtitle={`${filteredEmployees.length} of ${employees.length} employees`} action={<DirectoryFilters filters={filters} setFilters={setFilters} departments={uniqueDepartments} employmentTypes={uniqueEmploymentTypes} />}>
            <LayerTheme padding="var(--space-3)" gap="0">
              <DataTableShell>
                <table className="app-data-table">
                  <thead style={{
              position: "sticky",
              top: 0,
              zIndex: 1
            }}>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map(employee => {
                const isSelected = employee.id === selectedEmployeeId;
                return <tr key={employee.id} onClick={() => setSelectedEmployeeId(employee.id)} style={{
                  cursor: "pointer",
                  backgroundColor: isSelected ? "var(--theme-hover)" : "transparent"
                }}>
                          <td>
                            <div style={{
                      display: "flex",
                      flexDirection: "column"
                    }}>
                              <span style={{
                        fontWeight: 600,
                        color: "var(--text-1)"
                      }}>{employee.name}</span>
                              <span style={{
                        fontSize: "var(--text-label)",
                        color: "var(--text-1)"
                      }}>
                                {employee.jobTitle}
                              </span>
                            </div>
                          </td>
                          <td style={{
                    fontWeight: 500
                  }}>{employee.department}</td>
                          <td style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--text-1)"
                  }}>
                            {employee.employmentType}
                          </td>
                          <td>
                            <StatusTag label={employee.status} tone={employee.status === "Active" ? "success" : "warning"} />
                          </td>
                        </tr>;
              })}
                  </tbody>
                </table>
              </DataTableShell>
            </LayerTheme>
          </SectionCard>

          <EmployeeProfilePanel employee={selectedEmployee} />
        </section>}
    </div>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
