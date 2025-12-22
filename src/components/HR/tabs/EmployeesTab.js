// ✅ Employees Tab Component
// file location: src/components/HR/tabs/EmployeesTab.js
// Manages employee directory, profiles, and employment details

import React, { useEffect, useMemo, useState } from "react";
import { useHrEmployeesData } from "@/hooks/useHrData";
import { SectionCard, StatusTag } from "@/components/HR/MetricCard";
import EmployeeProfilePanel from "@/components/HR/EmployeeProfilePanel";
import { roleCategories } from "@/config/users";

const defaultFilters = { department: "all", status: "all", employmentType: "all" };

// Get all available roles from Retail and Sales categories (excluding Customers)
const AVAILABLE_ROLES = [
  ...(roleCategories.Retail || []),
  ...(roleCategories.Sales || []),
].sort();

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
  const [searchQuery, setSearchQuery] = useState("");
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
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editingEmployeeName, setEditingEmployeeName] = useState("");

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

      // Search filter - only searches employee names
      const searchPass =
        searchQuery.trim() === "" ||
        (employee.name && employee.name.toLowerCase().includes(searchQuery.toLowerCase()));

      return departmentPass && statusPass && employmentPass && searchPass;
    });
  }, [employees, filters, searchQuery]);

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

  const updateNewEmployeeField = (field, value) => {
    setNewEmployee((prev) => ({ ...prev, [field]: value }));
  };

  const updateEditEmployeeField = (field, value) => {
    setEditEmployee((prev) => ({ ...prev, [field]: value }));
  };

  const mapEmployeeToForm = (employee) => {
    if (!employee) return null;
    const nameParts = (employee.name || "").trim().split(/\s+/);
    const firstName = nameParts.shift() || "";
    const lastName = nameParts.join(" ");
    return {
      firstName,
      lastName,
      email: employee.email || "",
      phone: employee.phone || "",
      department: employee.department || "",
      jobTitle: employee.jobTitle || "",
      role: employee.role || "",
      employmentType: employee.employmentType || "Full-time",
      status: employee.status || "Active",
      startDate: employee.startDate || "",
      probationEnd: employee.probationEnd || "",
      contractedHours:
        employee.contractedHours !== undefined && employee.contractedHours !== null
          ? employee.contractedHours
          : 40,
      hourlyRate: employee.hourlyRate ?? "",
      overtimeRate: employee.overtimeRate ?? "",
      annualSalary: employee.annualSalary ?? "",
      payrollNumber: employee.payrollNumber || "",
      nationalInsurance: employee.nationalInsurance || "",
      keycloakId: employee.keycloakId || "",
      emergencyContact: employee.emergencyContact || "",
      address: employee.address || "",
    };
  };

  const upsertLocalEmployee = (employeeRecord) => {
    if (!employeeRecord) return;
    setLocalEmployees((prev) => {
      const key = employeeRecord.userId || employeeRecord.id || employeeRecord.email;
      const filtered = prev.filter((emp) => (emp.userId || emp.id || emp.email) !== key);
      return [...filtered, employeeRecord];
    });
  };

  const handleCancelNewEmployee = () => {
    resetNewEmployeeForm();
    setIsAddingEmployee(false);
  };

  const handleShowAddEmployee = () => {
    setIsEditingEmployee(false);
    setEditEmployee(null);
    setEditError(null);
    setIsAddingEmployee(true);
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

      const baseEmployeeData = selectedEmployee || {};
      if (payload.employee) {
        const mergedEmployee = {
          ...baseEmployeeData,
          ...payload.employee,
          ...editEmployee,
        };
        upsertLocalEmployee(mergedEmployee);
      } else {
        upsertLocalEmployee({
          ...baseEmployeeData,
          ...editEmployee,
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

  const handleStartEditEmployee = () => {
    if (!selectedEmployee) return;
    const mapped = mapEmployeeToForm(selectedEmployee);
    if (!mapped) return;
    setEditEmployee(mapped);
    setEditingEmployeeName(selectedEmployee.name || "Employee");
    setEditError(null);
    setIsAddingEmployee(false);
    setIsEditingEmployee(true);
  };

  const handleCancelEditEmployee = () => {
    setIsEditingEmployee(false);
    setEditEmployee(null);
    setEditError(null);
    setEditingEmployeeName("");
  };

  const handleSaveEditEmployee = async () => {
    if (!editEmployee) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const response = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editEmployee),
      });

      if (!response.ok) {
        const message = await extractError(response);
        throw new Error(message);
      }

      const payload = await response.json();

      if (!payload?.success) {
        throw new Error(payload?.message || "Failed to save employee");
      }

      const baseEmployeeData = selectedEmployee || {};
      if (payload.employee) {
        const mergedEmployee = {
          ...baseEmployeeData,
          ...payload.employee,
          ...editEmployee,
        };
        upsertLocalEmployee(mergedEmployee);
      } else {
        upsertLocalEmployee({
          ...baseEmployeeData,
          ...editEmployee,
        });
      }

      setIsEditingEmployee(false);
      setEditEmployee(null);
      setEditingEmployeeName("");
    } catch (err) {
      setEditError(err.message || "Failed to save employee");
    } finally {
      setIsSavingEdit(false);
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

  const sampleFooter = (
    <SampleAutofillBlock
      value={samplePayload}
      onChange={setSamplePayload}
      onApply={applySamplePayload}
      onClear={() => setSamplePayload("")}
    />
  );

  const directorySection = (
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
        {/* Search Bar */}
        <div style={{ marginBottom: "16px" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by employee name..."
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid var(--surface-light)",
              background: "var(--surface-light)",
              color: "var(--text-primary)",
              fontSize: "0.95rem",
              outline: "none",
            }}
          />
        </div>

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

      {selectedEmployee && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <EmployeeProfilePanel employee={selectedEmployee} />
          <button
            type="button"
            onClick={handleStartEditEmployee}
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid var(--accent-purple-surface)",
              background: "var(--surface)",
              fontWeight: 600,
              color: "var(--accent-purple)",
              cursor: "pointer",
            }}
          >
            Edit employee details
          </button>
        </div>
      )}
    </section>
  );

  const addFormSection = (
    <EmployeeForm
      title="Add New Employee"
      subtitle="Provide starter details to create the employee profile."
      values={newEmployee}
      onFieldChange={updateNewEmployeeField}
      onCancel={handleCancelNewEmployee}
      onSave={handleSaveNewEmployee}
      isSaving={isSavingEmployee}
      saveLabel={isSavingEmployee ? "Saving…" : "Save"}
      errorMessage={saveError}
      footerContent={sampleFooter}
    />
  );

  const editFormSection =
    isEditingEmployee && editEmployee ? (
      <EmployeeForm
        title={`Edit ${editingEmployeeName || "Employee"}`}
        subtitle="Update employment and contact details."
        values={editEmployee}
        onFieldChange={updateEditEmployeeField}
        onCancel={handleCancelEditEmployee}
        onSave={handleSaveEditEmployee}
        isSaving={isSavingEdit}
        saveLabel={isSavingEdit ? "Saving…" : "Save changes"}
        errorMessage={editError}
      />
    ) : null;

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
            onClick={handleShowAddEmployee}
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

      {editFormSection ? editFormSection : isAddingEmployee ? addFormSection : directorySection}
    </div>
  );
}

function EmployeeForm({
  title,
  subtitle,
  values,
  onFieldChange,
  onCancel,
  onSave,
  isSaving,
  saveLabel,
  errorMessage,
  footerContent = null,
}) {
  if (!values) return null;

  return (
    <section className="employee-form" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionCard
        title={title}
        subtitle={subtitle}
        action={
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              onClick={onCancel}
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
              onClick={onSave}
              disabled={isSaving}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "none",
                background: "var(--accent-purple)",
                fontWeight: 600,
                color: "white",
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {saveLabel}
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {errorMessage && (
            <div style={{ color: "var(--danger)", fontWeight: 600 }}>{errorMessage}</div>
          )}
          <EmployeeDetailsFields values={values} onFieldChange={onFieldChange} />
          {footerContent}
        </div>
      </SectionCard>
    </section>
  );
}

function SearchableRoleDropdown({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const currentValue = value || "";

  // Filter roles based on search term
  const filteredRoles = useMemo(() => {
    if (!searchTerm.trim()) return AVAILABLE_ROLES;
    return AVAILABLE_ROLES.filter((role) =>
      role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleSelectRole = (role) => {
    if (typeof onChange === "function") {
      onChange(role);
    }
    closeDropdown();
    if (inputRef.current) {
      requestAnimationFrame(() => inputRef.current && inputRef.current.blur());
    }
  };

  const handleOptionPointerDown = (event, role) => {
    event.preventDefault();
    handleSelectRole(role);
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? searchTerm : currentValue}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => {
          if (!isOpen) {
            setIsOpen(true);
            setSearchTerm("");
          }
        }}
        placeholder="Select or search role..."
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid var(--surface-light)",
          width: "100%",
          cursor: "pointer",
        }}
      />
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: "200px",
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--surface-light)",
            borderRadius: "8px",
            marginTop: "4px",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
        >
          {filteredRoles.length > 0 ? (
            filteredRoles.map((role) => (
              <div
                key={role}
                onMouseDown={(event) => handleOptionPointerDown(event, role)}
                onTouchStart={(event) => handleOptionPointerDown(event, role)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  background:
                    currentValue === role ? "rgba(var(--accent-purple-rgb), 0.1)" : "transparent",
                  color: currentValue === role ? "var(--accent-purple)" : "var(--text-primary)",
                  fontWeight: currentValue === role ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (currentValue !== role) {
                    e.currentTarget.style.background = "var(--surface-light)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentValue !== role) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {role}
              </div>
            ))
          ) : (
            <div style={{ padding: "10px 12px", color: "var(--info)", fontSize: "0.9rem" }}>
              No roles found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmployeeDetailsFields({ values, onFieldChange }) {
  const update = (field) => (event) => onFieldChange(field, event.target.value);
  const handleRoleChange = (roleValue) => onFieldChange("role", roleValue || "");

  return (
    <>
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
            value={values.firstName}
            onChange={update("firstName")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
            placeholder="Jordan"
          />
        </FormField>
        <FormField label="Last Name">
          <input
            type="text"
            value={values.lastName}
            onChange={update("lastName")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
            placeholder="Reyes"
          />
        </FormField>
        <FormField label="Email">
          <input
            type="email"
            value={values.email}
            onChange={update("email")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
            placeholder="jordan.reyes@example.com"
          />
        </FormField>
        <FormField label="Phone">
          <input
            type="tel"
            value={values.phone}
            onChange={update("phone")}
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
            value={values.department}
            onChange={update("department")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
            placeholder="Operations"
          />
        </FormField>
        <FormField label="Job Title">
          <input
            type="text"
            value={values.jobTitle}
            onChange={update("jobTitle")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
            placeholder="Supervisor"
          />
        </FormField>
        <FormField label="Role">
          <SearchableRoleDropdown
            value={values.role}
            onChange={handleRoleChange}
          />
        </FormField>
        <FormField label="Employment Type">
          <select
            value={values.employmentType}
            onChange={update("employmentType")}
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
            value={values.status}
            onChange={update("status")}
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
            value={values.startDate}
            onChange={update("startDate")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
          />
        </FormField>
        <FormField label="Probation Ends">
          <input
            type="date"
            value={values.probationEnd}
            onChange={update("probationEnd")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
          />
        </FormField>
        <FormField label="Contracted Hours per Week">
          <input
            type="number"
            min="0"
            value={values.contractedHours}
            onChange={update("contractedHours")}
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
            value={values.hourlyRate}
            onChange={update("hourlyRate")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
            placeholder="15.50"
          />
        </FormField>
        <FormField label="Overtime Rate (£)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.overtimeRate}
            onChange={update("overtimeRate")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
            placeholder="23.25"
          />
        </FormField>
        <FormField label="Annual Salary (£)">
          <input
            type="number"
            min="0"
            step="100"
            value={values.annualSalary}
            onChange={update("annualSalary")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
            placeholder="32000"
          />
        </FormField>
        <FormField label="Payroll Reference">
          <input
            type="text"
            value={values.payrollNumber}
            onChange={update("payrollNumber")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
            placeholder="PAY-001"
          />
        </FormField>
        <FormField label="National Insurance No.">
          <input
            type="text"
            value={values.nationalInsurance}
            onChange={update("nationalInsurance")}
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
            value={values.keycloakId}
            onChange={update("keycloakId")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
            placeholder="kc-jreyes"
          />
        </FormField>
        <FormField label="Emergency Contact">
          <input
            type="text"
            value={values.emergencyContact}
            onChange={update("emergencyContact")}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" }}
            placeholder="Alex Reyes (+44 7000 000111)"
          />
        </FormField>
      </div>

      <FormField label="Address">
        <textarea
          value={values.address}
          onChange={update("address")}
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
    </>
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

function SampleAutofillBlock({ value, onChange, onApply, onClear }) {
  return (
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
          Paste a block of <code>Field: Value</code> lines here to quickly populate the form. Clearing this box does
          not clear any field values.
        </span>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
        <button type="button" style={buttonStylePrimary} onClick={onApply}>
          Apply Sample
        </button>
        <button type="button" style={buttonStyleGhost} onClick={onClear}>
          Clear Text
        </button>
      </div>
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
