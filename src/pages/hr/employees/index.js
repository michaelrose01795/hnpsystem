// file location: src/pages/hr/employees/index.js
import React, { useEffect, useMemo, useState } from "react";
import Layout from "../../../components/Layout";
import { useHrMockData } from "../../../hooks/useHrData";
import { SectionCard, StatusTag } from "../../../components/HR/MetricCard";
import EmployeeProfilePanel from "../../../components/HR/EmployeeProfilePanel";

const defaultFilters = { department: "all", status: "all", employmentType: "all" };

export default function EmployeeManagement() {
  const { data, isLoading, error } = useHrMockData();
  const employees = data?.employeeDirectory ?? [];

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
            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#111827" }}>Employee Management</h1>
            <p style={{ color: "#6B7280", marginTop: "6px" }}>
              Maintain staff records, employment details, documents, and system access.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid #E0E7FF",
                background: "white",
                fontWeight: 600,
                color: "#4338CA",
                boxShadow: "0 8px 16px rgba(67, 56, 202, 0.12)",
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
                background: "#4338CA",
                fontWeight: 600,
                color: "white",
                boxShadow: "0 10px 24px rgba(67, 56, 202, 0.25)",
              }}
            >
              Manage Keycloak Access
            </button>
          </div>
        </header>

        {isLoading && (
          <SectionCard title="Loading directory…" subtitle="Fetching employee listing.">
            <span style={{ color: "#6B7280" }}>Please wait while we load the placeholder directory data.</span>
          </SectionCard>
        )}

        {error && (
          <SectionCard title="Failed to load employee directory" subtitle="Mock API returned an error.">
            <span style={{ color: "#B91C1C" }}>{error.message}</span>
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
                  <thead style={{ position: "sticky", top: 0, background: "white", zIndex: 1 }}>
                    <tr style={{ color: "#6B7280", fontSize: "0.8rem" }}>
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
                            backgroundColor: isSelected ? "rgba(67, 56, 202, 0.08)" : "transparent",
                            borderTop: "1px solid #E5E7EB",
                          }}
                        >
                          <td style={{ padding: "14px 0" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 600, color: "#111827" }}>{employee.name}</span>
                              <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>{employee.jobTitle}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 500 }}>{employee.department}</td>
                          <td style={{ fontSize: "0.85rem", color: "#4B5563" }}>{employee.employmentType}</td>
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
  border: "1px solid #E0E7FF",
  padding: "6px 12px",
  fontWeight: 600,
  color: "#4338CA",
  background: "white",
};
