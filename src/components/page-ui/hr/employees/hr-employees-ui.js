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
      color: "var(--text-secondary)",
      margin: 0
    }}>
          Maintain staff records, employment details, documents, and system access.
        </p>
        <Button variant="secondary">+ Add Employee</Button>
      </header>

      {isLoading && <SectionCard title="Loading directory…" subtitle="Fetching employee listing.">
          <StatusMessage tone="info">Please wait while we load the placeholder directory data.</StatusMessage>
        </SectionCard>}

      {error && <SectionCard title="Failed to load employee directory" subtitle="Mock API returned an error.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>}

      {!isLoading && !error && <section style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "var(--layout-card-gap)"
  }}>
          <SectionCard title="Employee Directory" subtitle={`${filteredEmployees.length} of ${employees.length} employees`} action={<DirectoryFilters filters={filters} setFilters={setFilters} departments={uniqueDepartments} employmentTypes={uniqueEmploymentTypes} />}>
            <div style={{
        maxHeight: "520px",
        overflowY: "auto"
      }}>
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
                backgroundColor: isSelected ? "var(--accent-surface-hover)" : "transparent"
              }}>
                        <td>
                          <div style={{
                    display: "flex",
                    flexDirection: "column"
                  }}>
                            <span style={{
                      fontWeight: 600,
                      color: "var(--text-primary)"
                    }}>{employee.name}</span>
                            <span style={{
                      fontSize: "var(--text-label)",
                      color: "var(--text-secondary)"
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
                  color: "var(--text-primary)"
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
            </div>
          </SectionCard>

          <EmployeeProfilePanel employee={selectedEmployee} />
        </section>}
    </div>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
