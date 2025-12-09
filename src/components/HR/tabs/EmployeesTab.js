// ✅ Employees Tab Component
// file location: src/components/HR/tabs/EmployeesTab.js
// Manages employee directory, profiles, and employment details

import React, { useEffect, useMemo, useState } from "react";
import { useHrEmployeesData } from "@/hooks/useHrData";
import { SectionCard, StatusTag } from "@/components/HR/MetricCard";
import EmployeeProfilePanel from "@/components/HR/EmployeeProfilePanel";

const defaultFilters = { department: "all", status: "all", employmentType: "all" };

function DirectoryFilters({ filters, setFilters, departments, employmentTypes }) {
  return (
    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
      <select
        value={filters.department}
        onChange={(e) => setFilters({ ...filters, department: e.target.value })}
        style={{
          padding: "6px 12px",
          borderRadius: "8px",
          border: "1px solid var(--surface-light)",
          background: "var(--surface)",
          color: "var(--text-primary)",
          fontSize: "0.9rem",
        }}
      >
        {departments.map((dept) => (
          <option key={dept} value={dept}>
            {dept === "all" ? "All Departments" : dept}
          </option>
        ))}
      </select>

      <select
        value={filters.status}
        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        style={{
          padding: "6px 12px",
          borderRadius: "8px",
          border: "1px solid var(--surface-light)",
          background: "var(--surface)",
          color: "var(--text-primary)",
          fontSize: "0.9rem",
        }}
      >
        <option value="all">All Status</option>
        <option value="Active">Active</option>
        <option value="Inactive">Inactive</option>
      </select>

      <select
        value={filters.employmentType}
        onChange={(e) => setFilters({ ...filters, employmentType: e.target.value })}
        style={{
          padding: "6px 12px",
          borderRadius: "8px",
          border: "1px solid var(--surface-light)",
          background: "var(--surface)",
          color: "var(--text-primary)",
          fontSize: "0.9rem",
        }}
      >
        {employmentTypes.map((type) => (
          <option key={type} value={type}>
            {type === "all" ? "All Types" : type}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function EmployeesTab() {
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

  if (isLoading) {
    return (
      <SectionCard title="Loading directory…" subtitle="Fetching employee listing.">
        <span style={{ color: "var(--info)" }}>Please wait while we load the employee directory from Supabase.</span>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Failed to load employee directory" subtitle="An error occurred.">
        <span style={{ color: "var(--danger)" }}>{error.message}</span>
      </SectionCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 4px", color: "var(--text-primary)" }}>
            Employee Management
          </h2>
          <p style={{ color: "var(--info)", margin: 0 }}>
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
              boxShadow: "none",
              cursor: "pointer",
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
              boxShadow: "none",
              cursor: "pointer",
            }}
          >
            Manage Keycloak Access
          </button>
        </div>
      </div>

      {/* Employee Directory & Profile */}
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
          <div style={{ maxHeight: "600px", overflowY: "auto" }}>
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
                          tone={employee.status === "Active" ? "success" : "danger"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {selectedEmployee && <EmployeeProfilePanel employee={selectedEmployee} />}
      </section>
    </div>
  );
}
