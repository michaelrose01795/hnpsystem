// ✅ Employees Tab Component
// file location: src/components/HR/tabs/EmployeesTab.js
// Manages employee directory, profiles, and employment details

import React, { useEffect, useMemo, useState } from "react";
import { useHrEmployeesData } from "@/hooks/useHrData";
import { SectionCard, StatusTag } from "@/components/HR/MetricCard";
import EmployeeProfilePanel from "@/components/HR/EmployeeProfilePanel";

const defaultFilters = { department: "all", status: "all", employmentType: "all" };

const SAMPLE_PAYLOAD_FIELD_MAP = {
  "first name": "firstName",
  "last name": "lastName",
  email: "email",
  phone: "phone",
  department: "department",
  "job title": "jobTitle",
  "role / band": "role",
  "employment type": "employmentType",
  "employment status": "status",
  "start date": "startDate",
  "probation ends": "probationEnd",
  "contracted hours per week": "contractedHours",
  "hourly rate (£)": "hourlyRate",
  "overtime rate (£)": "overtimeRate",
  "annual salary (£)": "annualSalary",
  "payroll reference": "payrollNumber",
  "national insurance no.": "nationalInsurance",
  "keycloak user id": "keycloakId",
  "home address": "address",
  "emergency contact": "emergencyContact",
};

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
  const baseEmployees = data ?? [];

  const [filters, setFilters] = useState(defaultFilters);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [localEmployees, setLocalEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "",
    jobTitle: "",
    role: "",
    employmentType: "Full-time",
    status: "Active",
    startDate: "",
    probationEnd: "",
    contractedHours: 40,
    hourlyRate: "",
    overtimeRate: "",
    annualSalary: "",
    overtimeRate: "",
    keycloakId: "",
    payrollNumber: "",
    nationalInsurance: "",
    emergencyContact: "",
    address: "",
  });
  const [samplePayload, setSamplePayload] = useState("");
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const employees = useMemo(() => {
    if (!localEmployees.length) {
      return baseEmployees;
    }
    const map = new Map();
    baseEmployees.forEach((emp) => {
      const key = emp.userId || emp.id || emp.email;
      map.set(key, emp);
    });
    localEmployees.forEach((emp) => {
      const key = emp.userId || emp.id || emp.email;
      map.set(key, emp);
    });
    return Array.from(map.values());
  }, [baseEmployees, localEmployees]);

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

  const resetNewEmployeeForm = () => {
    setNewEmployee({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      department: "",
      jobTitle: "",
      role: "",
      employmentType: "Full-time",
      status: "Active",
      startDate: "",
      probationEnd: "",
      contractedHours: 40,
      hourlyRate: "",
      overtimeRate: "",
      annualSalary: "",
      keycloakId: "",
      payrollNumber: "",
      nationalInsurance: "",
      emergencyContact: "",
      address: "",
    });
  };

  const handleCancelNewEmployee = () => {
    resetNewEmployeeForm();
    setIsAddingEmployee(false);
  };

  const handleSaveNewEmployee = async () => {
    setIsSavingEmployee(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmployee),
      });

      if (!response.ok) {
        const message = await extractError(response);
        throw new Error(message);
      }

      const payload = await response.json();

      if (!payload?.success) {
        throw new Error(payload?.message || "Failed to save employee");
      }

      if (payload.employee) {
        setLocalEmployees((prev) => {
          const key = payload.employee.userId || payload.employee.id || payload.employee.email;
          const filtered = prev.filter(
            (emp) => (emp.userId || emp.id || emp.email) !== key
          );
          return [...filtered, payload.employee];
        });
      }

      resetNewEmployeeForm();
      setSamplePayload("");
      setIsAddingEmployee(false);
    } catch (err) {
      setSaveError(err.message || "Failed to save employee");
    } finally {
      setIsSavingEmployee(false);
    }
  };

  const extractError = async (response) => {
    try {
      const data = await response.json();
      return data?.message || `Request failed (${response.status})`;
    } catch {
      return `Request failed (${response.status})`;
    }
  };

  const normalizeDateValue = (value) => {
    const trimmed = value.trim();
    const dateParts = trimmed.split(/[\/\-]/);
    if (dateParts.length === 3) {
      if (dateParts[0].length === 4) {
        return trimmed; // already YYYY-MM-DD
      }
      const [day, month, rawYear] = dateParts.map((part) => part.padStart(2, "0"));
      const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
      return `${year}-${month}-${day}`;
    }
    return trimmed;
  };

  const normalizeNumericValue = (value) => {
    const cleaned = value.replace(/[^0-9.\-]/g, "");
    return cleaned;
  };

  const applySamplePayload = () => {
    if (!samplePayload.trim()) return;
    const updates = {};
    samplePayload.split(/\n+/).forEach((line) => {
      if (!line.includes(":")) return;
      const [rawLabel, ...rest] = line.split(":");
      if (!rest.length) return;
      const label = rawLabel.trim().toLowerCase();
      const mappedKey = SAMPLE_PAYLOAD_FIELD_MAP[label];
      if (!mappedKey) return;
      const rawValue = rest.join(":").trim();
      if (!rawValue) return;
      if (["contractedHours", "hourlyRate", "overtimeRate", "annualSalary"].includes(mappedKey)) {
        updates[mappedKey] = normalizeNumericValue(rawValue);
      } else if (["startDate", "probationEnd"].includes(mappedKey)) {
        updates[mappedKey] = normalizeDateValue(rawValue);
      } else {
        updates[mappedKey] = rawValue;
      }
    });
    if (Object.keys(updates).length > 0) {
      setNewEmployee((prev) => ({ ...prev, ...updates }));
    }
  };

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
            onClick={() => setIsAddingEmployee(true)}
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
      {!isAddingEmployee ? (
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
      ) : (
        <section className="employee-form" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <SectionCard
            title="Add New Employee"
            subtitle="Provide starter details to create the employee profile."
            action={
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={handleCancelNewEmployee}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--surface-light)",
                    background: "var(--surface)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewEmployee}
                  disabled={isSavingEmployee}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--accent-purple)",
                    fontWeight: 600,
                    color: "white",
                    cursor: isSavingEmployee ? "not-allowed" : "pointer",
                    opacity: isSavingEmployee ? 0.7 : 1,
                  }}
                >
                  {isSavingEmployee ? "Saving…" : "Save"}
                </button>
              </div>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {saveError && (
                <div style={{ color: "var(--danger)", fontWeight: 600 }}>{saveError}</div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                <FormField label="First Name">
                  <input
                    type="text"
                    value={newEmployee.firstName}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, firstName: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="Jordan"
                  />
                </FormField>
                <FormField label="Last Name">
                  <input
                    type="text"
                    value={newEmployee.lastName}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, lastName: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="Reyes"
                  />
                </FormField>
                <FormField label="Email">
                  <input
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, email: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="jordan.reyes@example.com"
                  />
                </FormField>
                <FormField label="Phone">
                  <input
                    type="tel"
                    value={newEmployee.phone}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, phone: e.target.value }))}
                    style={{
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid var(--surface-light)",
                      background: "var(--surface-light)",
                    }}
                    placeholder="+44 7000 000000"
                  />
                </FormField>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                <FormField label="Department">
                  <input
                    type="text"
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, department: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="Operations"
                  />
                </FormField>
                <FormField label="Job Title">
                  <input
                    type="text"
                    value={newEmployee.jobTitle}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, jobTitle: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="Supervisor"
                  />
                </FormField>
                <FormField label="Role / Band">
                  <input
                    type="text"
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, role: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="HR_CORE"
                  />
                </FormField>
                <FormField label="Employment Type">
                  <select
                    value={newEmployee.employmentType}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, employmentType: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Temporary">Temporary</option>
                  </select>
                </FormField>
                <FormField label="Employment Status">
                  <select
                    value={newEmployee.status}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, status: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </FormField>
                <FormField label="Start Date">
                  <input
                    type="date"
                    value={newEmployee.startDate}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, startDate: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                  />
                </FormField>
                <FormField label="Probation Ends">
                  <input
                    type="date"
                    value={newEmployee.probationEnd}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, probationEnd: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                  />
                </FormField>
                <FormField label="Contracted Hours per Week">
                  <input
                    type="number"
                    min="0"
                    value={newEmployee.contractedHours}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, contractedHours: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                  />
                </FormField>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                <FormField label="Hourly Rate (£)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newEmployee.hourlyRate}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, hourlyRate: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="15.50"
                  />
                </FormField>
                <FormField label="Overtime Rate (£)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newEmployee.overtimeRate}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, overtimeRate: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="23.25"
                  />
                </FormField>
                <FormField label="Annual Salary (£)">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={newEmployee.annualSalary}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, annualSalary: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="32000"
                  />
                </FormField>
                <FormField label="Payroll Reference">
                  <input
                    type="text"
                    value={newEmployee.payrollNumber}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, payrollNumber: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="PAY-001"
                  />
                </FormField>
                <FormField label="National Insurance No.">
                  <input
                    type="text"
                    value={newEmployee.nationalInsurance}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, nationalInsurance: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="QQ123456C"
                  />
                </FormField>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                <FormField label="Keycloak User ID">
                  <input
                    type="text"
                    value={newEmployee.keycloakId}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, keycloakId: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="kc-jreyes"
                  />
                </FormField>
                <FormField label="Emergency Contact">
                  <input
                    type="text"
                    value={newEmployee.emergencyContact}
                    onChange={(e) => setNewEmployee((prev) => ({ ...prev, emergencyContact: e.target.value }))}
                    style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
                    placeholder="Alex Reyes (+44 7000 000111)"
                  />
                </FormField>
              </div>

              <FormField label="Address">
                <textarea
                  value={newEmployee.address}
                  onChange={(e) => setNewEmployee((prev) => ({ ...prev, address: e.target.value }))}
                  rows={3}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid var(--surface-light)",
                    resize: "vertical",
                  }}
                  placeholder="123 Main Street, Birmingham, B1 1AA"
                />
              </FormField>

              <div
                style={{
                  marginTop: "12px",
                  border: "1px dashed var(--accent-purple-surface)",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "var(--surface-light)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <strong style={{ color: "var(--accent-purple)" }}>Temporary Sample Autofill</strong>
                  <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>
                    Paste a block of <code>Field: Value</code> lines here to quickly populate the form. Clearing this box does not clear any field values.
                  </span>
                </div>
                <textarea
                  value={samplePayload}
                  onChange={(e) => setSamplePayload(e.target.value)}
                  rows={6}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid var(--surface-light)",
                    resize: "vertical",
                  }}
                  placeholder="First Name: Soren&#10;Last Name: Sorensen&#10;Email: soren@example.com&#10;..."
                />
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button type="button" style={buttonStylePrimary} onClick={applySamplePayload}>
                    Apply Sample
                  </button>
                  <button
                    type="button"
                    style={buttonStyleGhost}
                    onClick={() => setSamplePayload("")}
                  >
                    Clear Text
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>
        </section>
      )}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>{label}</span>
      {children}
    </label>
  );
}

const buttonStylePrimary = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: "var(--accent-purple)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleGhost = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "1px dashed var(--accent-purple)",
  background: "transparent",
  color: "var(--accent-purple)",
  fontWeight: 600,
  cursor: "pointer",
};
