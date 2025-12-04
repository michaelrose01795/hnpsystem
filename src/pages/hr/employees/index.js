// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/employees/index.js
import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useHrEmployeesData } from "@/hooks/useHrData";
import { SectionCard, StatusTag } from "@/components/HR/MetricCard";
import EmployeeProfilePanel from "@/components/HR/EmployeeProfilePanel";

// TODO: Connect employee directory, filters, and profile panel to live HR tables.

const defaultFilters = { department: "all", status: "all", employmentType: "all" };

export default function EmployeeManagement() {
  const { data, isLoading, error } = useHrEmployeesData();
  const employees = data ?? [];

  const [filters, setFilters] = useState(defaultFilters);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  useEffect(() => {
    if (!isLoading && !error && employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [isLoading, error, employees, selectedEmployeeId]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const departmentPass =
        filters.department === "all" || employee.department === filters.department;
      const statusPass = filters.status === "all" || employee.status === filters.status;
      const employmentPass =
        filters.employmentType === "all" || employee.employmentType === filters.employmentType;
      return departmentPass && statusPass && employmentPass;
    });
  }, [employees, filters]);

  const selectedEmployee = useMemo(
    () => employees.find((emp) => emp.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId]
  );

  const uniqueDepartments = useMemo(() => {
    return ["all", ...new Set(employees.map((emp) => emp.department))];
  }, [employees]);

  const uniqueEmploymentTypes = useMemo(() => {
    return ["all", ...new Set(employees.map((emp) => emp.employmentType))];
  }, [employees]);

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: "var(--info)", marginTop: "6px" }}>
              Maintain staff records, employment details, documents, and system access.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid var(--accent-purple-surface)",
                background: "var(--surface)",
                fontWeight: 600,
                color: "var(--accent-purple)",
                boxShadow: "0 8px 16px rgba(var(--accent-purple-rgb), 0.12)",
              }}
            >
              + Add Employee
            </button>
            <button
              type="button"
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "none",
                background: "var(--accent-purple)",
                fontWeight: 600,
                color: "white",
                boxShadow: "0 10px 24px rgba(var(--accent-purple-rgb), 0.25)",
              }}
            >
              Manage Keycloak Access
            </button>
          </div>
        </header>

        {isLoading && (
          <SectionCard title="Loading directory…" subtitle="Fetching employee listing.">
            <span style={{ color: "var(--info)" }}>Please wait while we load the placeholder directory data.</span>
          </SectionCard>
        )}

        {error && (
          <SectionCard title="Failed to load employee directory" subtitle="Mock API returned an error.">
            <span style={{ color: "var(--danger)" }}>{error.message}</span>
          </SectionCard>
        )}

        {!isLoading && !error && (
          <section style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "20px" }}>
            <SectionCard
              title="Employee Directory"
              subtitle={`${filteredEmployees.length} of ${employees.length} employees`}
              action={
                <DirectoryFilters
                  filters={filters}
                  setFilters={setFilters}
                  departments={uniqueDepartments}
                  employmentTypes={uniqueEmploymentTypes}
                />
              }
            >
              <div style={{ maxHeight: "520px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
                    <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                      <th style={{ padding: "12px 0", textAlign: "left" }}>Employee</th>
                      <th>Department</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee) => {
                      const isSelected = employee.id === selectedEmployeeId;
                      return (
                        <tr
                          key={employee.id}
                          onClick={() => setSelectedEmployeeId(employee.id)}
                          style={{
                            cursor: "pointer",
                            backgroundColor: isSelected ? "rgba(var(--accent-purple-rgb), 0.08)" : "transparent",
                            borderTop: "1px solid var(--accent-purple-surface)",
                          }}
                        >
                          <td style={{ padding: "14px 0" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{employee.name}</span>
                              <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>{employee.jobTitle}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 500 }}>{employee.department}</td>
                          <td style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>{employee.employmentType}</td>
                          <td>
                            <StatusTag
                              label={employee.status}
                              tone={employee.status === "Active" ? "success" : "warning"}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <EmployeeProfilePanel employee={selectedEmployee} />
          </section>
        )}
      </div>
    </Layout>
  );
}

function DirectoryFilters({ filters, setFilters, departments, employmentTypes }) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <select
        value={filters.department}
        onChange={(event) => setFilters((prev) => ({ ...prev, department: event.target.value }))}
        style={selectStyle}
      >
        {departments.map((dept) => (
          <option key={dept} value={dept}>
            {dept === "all" ? "All departments" : dept}
          </option>
        ))}
      </select>

      <select
        value={filters.employmentType}
        onChange={(event) =>
          setFilters((prev) => ({ ...prev, employmentType: event.target.value }))
        }
        style={selectStyle}
      >
        {employmentTypes.map((type) => (
          <option key={type} value={type}>
            {type === "all" ? "All contracts" : type}
          </option>
        ))}
      </select>

      <select
        value={filters.status}
        onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
        style={selectStyle}
      >
        {["all", "Active", "On leave", "Resigned", "Terminated"].map((status) => (
          <option key={status} value={status}>
            {status === "all" ? "All statuses" : status}
          </option>
        ))}
      </select>
    </div>
  );
}

const selectStyle = {
  borderRadius: "999px",
  border: "1px solid var(--accent-purple-surface)",
  padding: "6px 12px",
  fontWeight: 600,
  color: "var(--accent-purple)",
  background: "var(--surface)",
};
