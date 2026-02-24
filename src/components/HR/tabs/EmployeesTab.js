// ✅ Employees Tab Component
// file location: src/components/HR/tabs/EmployeesTab.js
// Manages employee directory, profiles, and employment details

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useHrEmployeesData } from "@/hooks/useHrData";
import { SectionCard, StatusTag } from "@/components/HR/MetricCard";
import EmployeeProfilePanel from "@/components/HR/EmployeeProfilePanel";
import { roleCategories } from "@/config/users";
import { CalendarField } from "@/components/calendarAPI"; // Date input component
import { DropdownField } from "@/components/dropdownAPI";

const defaultFilters = { department: "all", status: "all", employmentType: "all" };

const buildUniqueList = (items = []) => {
  const map = new Map();
  items.filter(Boolean).forEach((item) => {
    const label = String(item).trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (!map.has(key)) {
      map.set(key, label);
    }
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
};

const getInitials = (name = "") => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "??";
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase() || "??";
};

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

const DB_COLUMN_TO_FORM_FIELD = {
  email: "email",
  first_name: "firstName",
  last_name: "lastName",
  phone: "phone",
  role: "role",
  job_title: "jobTitle",
  department: "department",
  employment_type: "employmentType",
  employment_status: "status",
  start_date: "startDate",
  contracted_hours: "contractedHours",
  hourly_rate: "hourlyRate",
  overtime_rate: "overtimeRate",
  annual_salary: "annualSalary",
  payroll_reference: "payrollNumber",
  national_insurance_number: "nationalInsurance",
  keycloak_user_id: "keycloakId",
  home_address: "address",
  emergency_contact: "emergencyContact",
};

function DirectoryFilters({ filters, setFilters, departments, employmentTypes }) {
  const departmentOptions = departments.map((dept) => ({
    value: dept,
    label: dept === "all" ? "All Departments" : dept,
  }));
  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
  ];
  const employmentOptions = employmentTypes.map((type) => ({
    value: type,
    label: type === "all" ? "All Types" : type,
  }));

  return (
    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ minWidth: "160px" }}>
        <DropdownField
          value={filters.department}
          onChange={(e) => setFilters({ ...filters, department: e.target.value })}
          options={departmentOptions}
          size="sm"
        />
      </div>
      <div style={{ minWidth: "140px" }}>
        <DropdownField
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          options={statusOptions}
          size="sm"
        />
      </div>
      <div style={{ minWidth: "140px" }}>
        <DropdownField
          value={filters.employmentType}
          onChange={(e) => setFilters({ ...filters, employmentType: e.target.value })}
          options={employmentOptions}
          size="sm"
        />
      </div>
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
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [editingEmployeeName, setEditingEmployeeName] = useState("");
  const directorySectionRef = useRef(null);
  const detailPanelRef = useRef(null);

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

  const availableRoles = useMemo(() => {
    const configRoles = [
      ...(roleCategories.Retail || []),
      ...(roleCategories.Sales || []),
      ...(roleCategories.Customers || []),
    ];
    const employeeRoles = employees.map((employee) => employee.role);
    return buildUniqueList([...configRoles, ...employeeRoles]);
  }, [employees]);

  const availableJobTitles = useMemo(() => {
    const employeeTitles = employees.map((employee) => employee.jobTitle);
    return buildUniqueList(employeeTitles);
  }, [employees]);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      const inDirectory = directorySectionRef.current?.contains(target);
      const inDetail = detailPanelRef.current?.contains(target);
      if (!inDirectory && !inDetail) {
        setSelectedEmployeeId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    setEditFieldErrors((prev) => {
      if (!prev || !prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const mapEmployeeToForm = (employee) => {
    if (!employee) return null;
    const nameParts = (employee.name || "").trim().split(/\s+/);
    const firstName = nameParts.shift() || "";
    const lastName = nameParts.join(" ");
    return {
      userId: employee.userId || null,
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
        const parsedError = await extractError(response);
        throw new Error(parsedError.message);
      }

      const payload = await response.json();

      if (!payload?.success) {
        throw new Error(payload?.message || "Failed to save employee");
      }

      if (payload.employee) {
        upsertLocalEmployee(payload.employee);
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
    setEditFieldErrors({});
    setIsAddingEmployee(false);
    setIsEditingEmployee(true);
  };

  const handleCancelEditEmployee = () => {
    setIsEditingEmployee(false);
    setEditEmployee(null);
    setEditError(null);
    setEditFieldErrors({});
    setEditingEmployeeName("");
  };

  const handleSaveEditEmployee = async () => {
    if (!editEmployee) return;
    const validationErrors = validateEmployeeForm(editEmployee);
    if (Object.keys(validationErrors).length > 0) {
      setEditFieldErrors(validationErrors);
      setEditError("Cannot save changes. Fix the highlighted fields and try again.");
      return;
    }
    setIsSavingEdit(true);
    setEditError(null);
    setEditFieldErrors({});
    try {
      const response = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editEmployee),
      });

      if (!response.ok) {
        const parsedError = await extractError(response);
        const failure = new Error(parsedError.message);
        failure.fieldErrors = parsedError.fieldErrors || {};
        throw failure;
      }

      const payload = await response.json();

      if (!payload?.success) {
        throw new Error(payload?.message || "Failed to save employee");
      }

      if (payload.employee) {
        upsertLocalEmployee(payload.employee);
      }

      setIsEditingEmployee(false);
      setEditEmployee(null);
      setEditFieldErrors({});
      setEditingEmployeeName("");
    } catch (err) {
      setEditFieldErrors(err.fieldErrors || {});
      setEditError(err.message || "Failed to save employee");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const extractError = async (response) => {
    try {
      const data = await response.json();
      const fieldErrors = {};
      const serverMessage = typeof data?.message === "string" ? data.message : "";
      const serverError = typeof data?.error === "string" ? data.error : "";

      const missingFieldMatch = serverMessage.match(/Missing required field\s+([a-zA-Z0-9_]+)/i);
      if (missingFieldMatch) {
        const missingField = missingFieldMatch[1];
        fieldErrors[missingField] = `${humanizeFieldLabel(missingField)} is required.`;
      }

      const columnMatch = (serverError || serverMessage).match(/column\s+"([^"]+)"/i);
      if (columnMatch) {
        const mappedField = DB_COLUMN_TO_FORM_FIELD[columnMatch[1]];
        if (mappedField && !fieldErrors[mappedField]) {
          fieldErrors[mappedField] = `${humanizeFieldLabel(mappedField)} is invalid or missing.`;
        }
      }

      if (/email/i.test(serverError) && !fieldErrors.email) {
        fieldErrors.email = "Enter a valid email address.";
      }

      return {
        message:
          formatEmployeeSaveError(serverMessage, serverError, fieldErrors) ||
          `Request failed (${response.status})`,
        fieldErrors,
      };
    } catch {
      return { message: `Request failed (${response.status})`, fieldErrors: {} };
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
    <section
      ref={directorySectionRef}
      style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "20px" }}
    >
      <SectionCard
        title=""
        subtitle={null}
        action={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ position: "relative", minWidth: "260px", flex: "1 1 320px" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by employee name..."
                style={{
                  width: "100%",
                  padding: "10px 120px 10px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--surface-light)",
                  background: "var(--surface-light)",
                  color: "var(--text-primary)",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "0.7rem",
                  color: "var(--text-secondary)",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {filteredEmployees.length} of {employees.length} employees
              </span>
            </div>
            <DirectoryFilters
              filters={filters}
              setFilters={setFilters}
              departments={uniqueDepartments}
              employmentTypes={uniqueEmploymentTypes}
            />
          </div>
        }
      >
        <div style={{ maxHeight: "540px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
          {filteredEmployees.length === 0 && (
            <div
              style={{
                padding: "16px",
                borderRadius: "14px",
                border: "1px dashed var(--surface-light)",
                textAlign: "center",
                color: "var(--text-secondary)",
                background: "var(--surface)",
              }}
            >
              No employees match the current filters.
            </div>
          )}
          {filteredEmployees.map((employee) => {
            const isSelected = employee.id === selectedEmployeeId;
            return (
              <button
                type="button"
                key={employee.id}
                onClick={() => setSelectedEmployeeId(employee.id)}
                style={{
                  cursor: "pointer",
                  textAlign: "left",
                  padding: "14px",
                  borderRadius: "14px",
                  border: isSelected ? "1px solid var(--accent-purple)" : "1px solid var(--surface-light)",
                  background: isSelected ? "rgba(var(--accent-purple-rgb), 0.12)" : "var(--surface)",
                  display: "grid",
                  gridTemplateColumns: "46px 1fr auto",
                  gap: "12px",
                  alignItems: "center",
                  boxShadow: isSelected ? "0 10px 24px rgba(0,0,0,0.18)" : "none",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "rgba(var(--accent-purple-rgb), 0.06)";
                    e.currentTarget.style.borderColor = "rgba(var(--accent-purple-rgb), 0.4)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "var(--surface)";
                    e.currentTarget.style.borderColor = "var(--surface-light)";
                  }
                }}
              >
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "50%",
                    background: "rgba(var(--accent-purple-rgb), 0.2)",
                    color: "var(--accent-purple)",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(var(--accent-purple-rgb), 0.4)",
                    fontSize: "0.85rem",
                    letterSpacing: "0.08em",
                  }}
                >
                  {getInitials(employee.name)}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1rem" }}>
                    {employee.name}
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    {employee.department || "Department"} • {employee.jobTitle || employee.role || "Role"}
                  </span>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {employee.status && (
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "999px",
                          border: "1px solid rgba(var(--accent-purple-rgb), 0.4)",
                          background: "rgba(var(--accent-purple-rgb), 0.12)",
                          color: "var(--accent-purple)",
                          fontSize: "0.65rem",
                          fontWeight: 600,
                        }}
                      >
                        {employee.status}
                      </span>
                    )}
                    {employee.employmentType && (
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "999px",
                          border: "1px solid rgba(var(--grey-accent-rgb), 0.4)",
                          background: "rgba(var(--grey-accent-rgb), 0.15)",
                          color: "var(--text-primary)",
                          fontSize: "0.65rem",
                          fontWeight: 600,
                        }}
                      >
                        {employee.employmentType}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <StatusTag
                    label={employee.status}
                    tone={employee.status === "Active" ? "success" : "danger"}
                  />
                  <span style={{ color: "var(--text-secondary)", fontSize: "1.1rem" }}>{">"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <div
        ref={detailPanelRef}
        style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "680px", overflowY: "auto" }}
      >
        <EmployeeProfilePanel employee={selectedEmployee} />
        {selectedEmployee && (
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
        )}
      </div>
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
      availableRoles={availableRoles}
      availableJobTitles={availableJobTitles}
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
        fieldErrors={editFieldErrors}
        availableRoles={availableRoles}
        availableJobTitles={availableJobTitles}
      />
    ) : null;

  if (isLoading) {
    return (
      <SectionCard title="Employee Directory" subtitle="Loading employees...">
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              style={{
                borderRadius: "14px",
                border: "1px solid var(--surface-light)",
                background: "var(--surface)",
                padding: "14px",
                display: "grid",
                gridTemplateColumns: "46px 1fr 24px",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "50%",
                  background: "var(--surface-light)",
                  border: "1px solid var(--surface-light)",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ height: "12px", width: "60%", background: "var(--surface-light)", borderRadius: "8px" }} />
                <div style={{ height: "10px", width: "40%", background: "var(--surface-light)", borderRadius: "8px" }} />
                <div style={{ height: "10px", width: "50%", background: "var(--surface-light)", borderRadius: "8px" }} />
              </div>
              <div style={{ height: "12px", width: "12px", background: "var(--surface-light)", borderRadius: "4px" }} />
            </div>
          ))}
        </div>
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
        <div />
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
  fieldErrors = {},
  footerContent = null,
  availableRoles,
  availableJobTitles,
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
          <EmployeeDetailsFields
            values={values}
            onFieldChange={onFieldChange}
            fieldErrors={fieldErrors}
            availableRoles={availableRoles}
            availableJobTitles={availableJobTitles}
          />
          {footerContent}
        </div>
      </SectionCard>
    </section>
  );
}

function SearchableListDropdown({
  value,
  onChange,
  items,
  placeholder,
  emptyLabel,
  allowCustom = false,
  hasError = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = React.useRef(null);

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items || [];
    return (items || []).filter((item) =>
      item.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

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

  useEffect(() => {
    if (isOpen) {
      setSearchTerm(value || "");
    }
  }, [isOpen, value]);

  const handleSelectItem = (item) => {
    onChange({ target: { value: item } });
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={isOpen ? searchTerm : value}
        onChange={(e) => {
          const nextValue = e.target.value;
          setSearchTerm(nextValue);
          if (!isOpen) setIsOpen(true);
          if (allowCustom) {
            onChange({ target: { value: nextValue } });
          }
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: hasError ? "1px solid var(--danger)" : "1px solid var(--surface-light)",
          boxShadow: hasError ? "0 0 0 2px rgba(var(--danger-rgb), 0.12)" : "none",
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
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <div
                key={item}
                onClick={() => handleSelectItem(item)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  background: value === item ? "rgba(var(--accent-purple-rgb), 0.1)" : "transparent",
                  color: value === item ? "var(--accent-purple)" : "var(--text-primary)",
                  fontWeight: value === item ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (value !== item) {
                    e.currentTarget.style.background = "var(--surface-light)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (value !== item) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {item}
              </div>
            ))
          ) : (
            <div style={{ padding: "10px 12px", color: "var(--info)", fontSize: "0.9rem" }}>
              {emptyLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeading({ title }) {
  return (
    <div style={{
      fontSize: "0.82rem",
      fontWeight: 700,
      color: "var(--accent-purple)",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      paddingBottom: "6px",
      borderBottom: "2px solid rgba(var(--accent-purple-rgb), 0.15)",
    }}>
      {title}
    </div>
  );
}

function EmployeeDetailsFields({
  values,
  onFieldChange,
  fieldErrors = {},
  availableRoles,
  availableJobTitles,
}) {
  const update = (field) => (event) => onFieldChange(field, event.target.value);
  const inputStyle = { padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-light)" };
  const applyFieldErrorStyle = (field, baseStyle = inputStyle) =>
    fieldErrors[field]
      ? {
          ...baseStyle,
          border: "1px solid var(--danger)",
          boxShadow: "0 0 0 2px rgba(var(--danger-rgb), 0.12)",
        }
      : baseStyle;
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  };

  return (
    <>
      {/* ── Personal Details ── */}
      <SectionHeading title="Personal Details" />
      <div style={gridStyle}>
        <FormField label="First Name" errorMessage={fieldErrors.firstName}>
          <input type="text" value={values.firstName} onChange={update("firstName")} style={applyFieldErrorStyle("firstName")} placeholder="Jordan" />
        </FormField>
        <FormField label="Last Name" errorMessage={fieldErrors.lastName}>
          <input type="text" value={values.lastName} onChange={update("lastName")} style={applyFieldErrorStyle("lastName")} placeholder="Reyes" />
        </FormField>
        <FormField label="Email" errorMessage={fieldErrors.email}>
          <input type="email" value={values.email} onChange={update("email")} style={applyFieldErrorStyle("email")} placeholder="jordan.reyes@example.com" />
        </FormField>
        <FormField label="Phone" errorMessage={fieldErrors.phone}>
          <input type="tel" value={values.phone} onChange={update("phone")} style={applyFieldErrorStyle("phone")} placeholder="+44 7000 000000" />
        </FormField>
      </div>

      {/* ── Employment Details ── */}
      <SectionHeading title="Employment Details" />
      <div style={gridStyle}>
        <FormField label="Department" errorMessage={fieldErrors.department}>
          <input type="text" value={values.department} onChange={update("department")} style={applyFieldErrorStyle("department")} placeholder="Operations" />
        </FormField>
        <FormField label="Job Title" errorMessage={fieldErrors.jobTitle}>
          <SearchableListDropdown
            value={values.jobTitle}
            onChange={update("jobTitle")}
            items={availableJobTitles}
            placeholder="Select or search job title..."
            emptyLabel="No job titles found"
            allowCustom
            hasError={Boolean(fieldErrors.jobTitle)}
          />
        </FormField>
        <FormField label="Role" errorMessage={fieldErrors.role}>
          <SearchableListDropdown
            value={values.role}
            onChange={update("role")}
            items={availableRoles}
            placeholder="Select or search role..."
            emptyLabel="No roles found"
            hasError={Boolean(fieldErrors.role)}
          />
        </FormField>
        <FormField label="Employment Type" errorMessage={fieldErrors.employmentType}>
          <select value={values.employmentType} onChange={update("employmentType")} style={applyFieldErrorStyle("employmentType")}>
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
            <option value="Temporary">Temporary</option>
          </select>
        </FormField>
        <FormField label="Employment Status" errorMessage={fieldErrors.status}>
          <select value={values.status} onChange={update("status")} style={applyFieldErrorStyle("status")}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
          </select>
        </FormField>
        <FormField label="Start Date" errorMessage={fieldErrors.startDate}>
          <div style={applyFieldErrorStyle("startDate", { borderRadius: "8px" })}>
            <CalendarField name="startDate" id="startDate" value={values.startDate} onChange={update("startDate")} />
          </div>
        </FormField>
        <FormField label="Probation Ends" errorMessage={fieldErrors.probationEnd}>
          <div style={applyFieldErrorStyle("probationEnd", { borderRadius: "8px" })}>
            <CalendarField name="probationEnd" id="probationEnd" value={values.probationEnd} onChange={update("probationEnd")} />
          </div>
        </FormField>
        <FormField label="Contracted Hours / Week" errorMessage={fieldErrors.contractedHours}>
          <input type="number" min="0" value={values.contractedHours} onChange={update("contractedHours")} style={applyFieldErrorStyle("contractedHours")} />
        </FormField>
      </div>

      {/* ── Pay & Compensation ── */}
      <SectionHeading title="Pay &amp; Compensation" />
      <div style={gridStyle}>
        <FormField label="Hourly Rate (£)" errorMessage={fieldErrors.hourlyRate}>
          <input type="number" min="0" step="0.01" value={values.hourlyRate} onChange={update("hourlyRate")} style={applyFieldErrorStyle("hourlyRate")} placeholder="15.50" />
        </FormField>
        <FormField label="Overtime Rate (£)" errorMessage={fieldErrors.overtimeRate}>
          <input type="number" min="0" step="0.01" value={values.overtimeRate} onChange={update("overtimeRate")} style={applyFieldErrorStyle("overtimeRate")} placeholder="23.25" />
        </FormField>
        <FormField label="Annual Salary (£)" errorMessage={fieldErrors.annualSalary}>
          <input type="number" min="0" step="100" value={values.annualSalary} onChange={update("annualSalary")} style={applyFieldErrorStyle("annualSalary")} placeholder="32000" />
        </FormField>
        <FormField label="Payroll Reference" errorMessage={fieldErrors.payrollNumber}>
          <input type="text" value={values.payrollNumber} onChange={update("payrollNumber")} style={applyFieldErrorStyle("payrollNumber")} placeholder="PAY-001" />
        </FormField>
        <FormField label="National Insurance No." errorMessage={fieldErrors.nationalInsurance}>
          <input type="text" value={values.nationalInsurance} onChange={update("nationalInsurance")} style={applyFieldErrorStyle("nationalInsurance")} placeholder="QQ123456C" />
        </FormField>
      </div>

      {/* ── System / Auth ── */}
      <SectionHeading title="System" />
      <div style={gridStyle}>
        <FormField label="Keycloak User ID" errorMessage={fieldErrors.keycloakId}>
          <input type="text" value={values.keycloakId} onChange={update("keycloakId")} style={applyFieldErrorStyle("keycloakId")} placeholder="kc-jreyes" />
        </FormField>
      </div>

      {/* ── Address ── */}
      <SectionHeading title="Home Address" />
      <AddressSearchField
        value={values.address}
        onChange={(val) => onFieldChange("address", val)}
      />

      {/* ── Emergency Contact ── */}
      <SectionHeading title="Emergency Contact" />
      <EmergencyContactSection
        value={values.emergencyContact}
        onChange={(val) => onFieldChange("emergencyContact", val)}
        userId={values.userId}
      />
    </>
  );
}

function AddressSearchField({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchPostcode = useCallback(async (term) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) { setResults([]); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}/autocomplete`);
      const data = await res.json();
      if (data.status === 200 && data.result) {
        const detailed = await Promise.all(
          data.result.slice(0, 6).map(async (pc) => {
            const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
            const d = await r.json();
            if (d.status === 200 && d.result) {
              const p = d.result;
              const parts = [p.admin_ward, p.admin_district, p.region, pc].filter(Boolean);
              return parts.join(", ");
            }
            return pc;
          })
        );
        setResults(detailed);
        setShowResults(true);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPostcode(val), 350);
  };

  const handleSelect = (address) => {
    onChange(address);
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  const inputStyle = {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid var(--surface-light)",
    fontSize: "0.9rem",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
      }}
    >
      <FormField label="Address">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          placeholder="123 Main Street, Birmingham, B1 1AA"
        />
      </FormField>
      <div ref={wrapperRef} style={{ position: "relative" }}>
        <FormField label="Search by Postcode">
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => results.length > 0 && setShowResults(true)}
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", paddingRight: "32px" }}
              placeholder="Start typing a postcode…"
            />
            {isSearching && (
              <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "0.8rem", color: "var(--info)" }}>
                …
              </span>
            )}
          </div>
        </FormField>
        {showResults && results.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 20,
              background: "var(--background, #fff)",
              border: "1px solid var(--surface-light)",
              borderRadius: "8px",
              marginTop: "4px",
              maxHeight: "200px",
              overflowY: "auto",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            {results.map((addr, i) => (
              <div
                key={i}
                onClick={() => handleSelect(addr)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  borderBottom: i < results.length - 1 ? "1px solid var(--surface-light)" : "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-light)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {addr}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmergencyContactSection({ value, onChange, userId }) {
  const parsed = useMemo(() => {
    if (!value || typeof value !== "string") return { name: "", phone: "", relationship: "" };
    // Format: "Name, Phone, Relationship" (comma-separated)
    const parts = value.split(",").map((p) => p.trim());
    return {
      name: parts[0] || "",
      phone: parts[1] || "",
      relationship: parts[2] || "",
    };
  }, [value]);

  const buildString = (name, phone, relationship) => {
    return [name, phone, relationship].filter(Boolean).join(", ");
  };

  const handleFieldChange = (field) => (e) => {
    const updated = { ...parsed, [field]: e.target.value };
    onChange(buildString(updated.name, updated.phone, updated.relationship));
  };

  const inputStyle = {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid var(--surface-light)",
    fontSize: "0.9rem",
  };

  return (
    <div
      style={{
        border: "1px solid var(--surface-light)",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>
          Emergency Contact
        </span>
        {userId && (
          <Link
            href={`/profile?userId=${userId}`}
            style={{
              fontSize: "0.8rem",
              color: "var(--accent-purple)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            View on Profile
          </Link>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        <FormField label="Contact Name">
          <input
            type="text"
            value={parsed.name}
            onChange={handleFieldChange("name")}
            style={inputStyle}
            placeholder="Alex Reyes"
          />
        </FormField>
        <FormField label="Contact Phone">
          <input
            type="tel"
            value={parsed.phone}
            onChange={handleFieldChange("phone")}
            style={inputStyle}
            placeholder="+44 7000 000111"
          />
        </FormField>
        <FormField label="Relationship">
          <input
            type="text"
            value={parsed.relationship}
            onChange={handleFieldChange("relationship")}
            style={inputStyle}
            placeholder="Spouse, Parent, Sibling…"
          />
        </FormField>
      </div>
      {!parsed.name && !parsed.phone && (
        <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>
          The employee can also update this from their own profile page.
        </span>
      )}
    </div>
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

function FormField({ label, children, errorMessage = null }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ fontSize: "0.85rem", color: errorMessage ? "var(--danger)" : "var(--info)" }}>
        {label}
      </span>
      {children}
      {errorMessage && (
        <span style={{ fontSize: "0.78rem", color: "var(--danger)", lineHeight: 1.35 }}>
          {errorMessage}
        </span>
      )}
    </label>
  );
}

function validateEmployeeForm(values = {}) {
  const errors = {};

  ["firstName", "lastName", "email"].forEach((field) => {
    if (!String(values[field] ?? "").trim()) {
      errors[field] = `${humanizeFieldLabel(field)} is required.`;
    }
  });

  const email = String(values.email ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address (for example: name@example.com).";
  }

  ["contractedHours", "hourlyRate", "overtimeRate", "annualSalary"].forEach((field) => {
    const value = values[field];
    if (value === "" || value === null || value === undefined) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      errors[field] = `${humanizeFieldLabel(field)} must be a number.`;
      return;
    }
    if (numeric < 0) {
      errors[field] = `${humanizeFieldLabel(field)} cannot be negative.`;
    }
  });

  ["startDate", "probationEnd"].forEach((field) => {
    const value = String(values[field] ?? "").trim();
    if (!value) return;
    if (Number.isNaN(new Date(value).getTime())) {
      errors[field] = `${humanizeFieldLabel(field)} must be a valid date.`;
    }
  });

  return errors;
}

function humanizeFieldLabel(field) {
  const labels = {
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    phone: "Phone",
    department: "Department",
    jobTitle: "Job title",
    role: "Role",
    employmentType: "Employment type",
    status: "Employment status",
    startDate: "Start date",
    probationEnd: "Probation end date",
    contractedHours: "Contracted hours",
    hourlyRate: "Hourly rate",
    overtimeRate: "Overtime rate",
    annualSalary: "Annual salary",
    payrollNumber: "Payroll reference",
    nationalInsurance: "National Insurance number",
    keycloakId: "Keycloak User ID",
    address: "Address",
    emergencyContact: "Emergency contact",
  };
  if (labels[field]) return labels[field];
  return String(field || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .trim()
    .replace(/^./, (ch) => ch.toUpperCase());
}

function formatEmployeeSaveError(serverMessage, serverError, fieldErrors = {}) {
  const invalidFields = Object.keys(fieldErrors || {});
  if (invalidFields.length > 0) {
    return `Cannot save changes. Fix the highlighted field${invalidFields.length > 1 ? "s" : ""} and try again.`;
  }
  if (serverError) {
    if (/duplicate key/i.test(serverError)) {
      return "Cannot save changes because a duplicate value already exists.";
    }
    if (/invalid input syntax/i.test(serverError)) {
      return "Cannot save changes because one or more values are in the wrong format.";
    }
    return `Cannot save changes: ${serverError}`;
  }
  if (serverMessage) {
    return `Cannot save changes: ${serverMessage}`;
  }
  return null;
}
