// file location: src/pages/hr/employees/index.js
import React, { useEffect, useMemo, useState } from "react";
import { useHrEmployeesData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { Button, StatusMessage } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { StatusTag } from "@/components/HR/MetricCard";
import EmployeeProfilePanel from "@/components/HR/EmployeeProfilePanel";
import EmployeeManagementUi from "@/components/page-ui/hr/employees/hr-employees-ui"; // Extracted presentation layer.

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

  return <EmployeeManagementUi view="section1" Button={Button} DirectoryFilters={DirectoryFilters} EmployeeProfilePanel={EmployeeProfilePanel} employees={employees} error={error} filteredEmployees={filteredEmployees} filters={filters} isLoading={isLoading} SectionCard={SectionCard} selectedEmployee={selectedEmployee} selectedEmployeeId={selectedEmployeeId} setFilters={setFilters} setSelectedEmployeeId={setSelectedEmployeeId} StatusMessage={StatusMessage} StatusTag={StatusTag} uniqueDepartments={uniqueDepartments} uniqueEmploymentTypes={uniqueEmploymentTypes} />;





































































































}

function DirectoryFilters({ filters, setFilters, departments, employmentTypes }) {
  const departmentOptions = departments.map((dept) => ({
    value: dept,
    label: dept === "all" ? "All departments" : dept
  }));

  const employmentTypeOptions = employmentTypes.map((type) => ({
    value: type,
    label: type === "all" ? "All contracts" : type
  }));

  const statusOptions = ["all", "Active", "On leave", "Resigned", "Terminated"].map((status) => ({
    value: status,
    label: status === "all" ? "All statuses" : status
  }));

  return (
    <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
      <DropdownField
        size="sm"
        options={departmentOptions}
        value={filters.department}
        onValueChange={(value) => setFilters((prev) => ({ ...prev, department: value }))} />
      
      <DropdownField
        size="sm"
        options={employmentTypeOptions}
        value={filters.employmentType}
        onValueChange={(value) => setFilters((prev) => ({ ...prev, employmentType: value }))} />
      
      <DropdownField
        size="sm"
        options={statusOptions}
        value={filters.status}
        onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))} />
      
    </div>);

}
