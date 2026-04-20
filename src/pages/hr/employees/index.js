// file location: src/pages/hr/employees/index.js
import React, { useEffect, useMemo, useState } from "react";
import { useHrEmployeesData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { Button, StatusMessage } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { StatusTag } from "@/components/HR/MetricCard";
import EmployeeProfilePanel from "@/components/HR/EmployeeProfilePanel";

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
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Maintain staff records, employment details, documents, and system access.
        </p>
        <Button variant="secondary">+ Add Employee</Button>
      </header>

      {isLoading && (
        <SectionCard title="Loading directory…" subtitle="Fetching employee listing.">
          <StatusMessage tone="info">Please wait while we load the placeholder directory data.</StatusMessage>
        </SectionCard>
      )}

      {error && (
        <SectionCard title="Failed to load employee directory" subtitle="Mock API returned an error.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>
      )}

      {!isLoading && !error && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "var(--layout-card-gap)",
          }}
        >
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
              <table className="app-data-table">
                <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    <th>Employee</th>
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
                          backgroundColor: isSelected ? "var(--accent-surface-hover)" : "transparent",
                        }}
                      >
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{employee.name}</span>
                            <span style={{ fontSize: "var(--text-label)", color: "var(--text-secondary)" }}>
                              {employee.jobTitle}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 500 }}>{employee.department}</td>
                        <td style={{ fontSize: "var(--text-body-sm)", color: "var(--text-primary)" }}>
                          {employee.employmentType}
                        </td>
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
  );
}

function DirectoryFilters({ filters, setFilters, departments, employmentTypes }) {
  const departmentOptions = departments.map((dept) => ({
    value: dept,
    label: dept === "all" ? "All departments" : dept,
  }));

  const employmentTypeOptions = employmentTypes.map((type) => ({
    value: type,
    label: type === "all" ? "All contracts" : type,
  }));

  const statusOptions = ["all", "Active", "On leave", "Resigned", "Terminated"].map((status) => ({
    value: status,
    label: status === "all" ? "All statuses" : status,
  }));

  return (
    <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
      <DropdownField
        size="sm"
        options={departmentOptions}
        value={filters.department}
        onValueChange={(value) => setFilters((prev) => ({ ...prev, department: value }))}
      />
      <DropdownField
        size="sm"
        options={employmentTypeOptions}
        value={filters.employmentType}
        onValueChange={(value) => setFilters((prev) => ({ ...prev, employmentType: value }))}
      />
      <DropdownField
        size="sm"
        options={statusOptions}
        value={filters.status}
        onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
      />
    </div>
  );
}
