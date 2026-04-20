// ✅ Employees Tab Component
// file location: src/components/HR/tabs/EmployeesTab.js
// Manages employee directory, profiles, and employment details

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useHrEmployeesData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section"; // section card layout — ghost chain removed
import { StatusTag } from "@/components/HR/MetricCard"; // status badge component
import EmployeeProfilePanel from "@/components/HR/EmployeeProfilePanel";
import { roleCategories } from "@/config/users";
import { CalendarField } from "@/components/ui/calendarAPI"; // Date input component
import { DropdownField } from "@/components/ui/dropdownAPI";
import Button from "@/components/ui/Button";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

const defaultFilters = { department: "all", status: "all", employmentType: "all" };

const surfaceButtonStyle = {
  padding: "var(--control-padding)",
  borderRadius: "var(--input-radius)",
  border: "1px solid var(--surface-light)",
  background: "var(--surface)",
  fontWeight: 600,
  color: "var(--text-primary)",
  cursor: "pointer",
};

const primaryButtonStyle = {
  ...surfaceButtonStyle,
  border: "1px solid rgba(var(--primary-rgb), 0.18)",
  background: "var(--primary)",
  color: "var(--text-inverse)",
};

const accentFieldSurface = {
  background: "var(--surface)",
  border: "1px solid var(--surface-light)",
};

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
  "line manager": "lineManagerIds",
  "hourly rate (£)": "hourlyRate",
  "overtime rate (£)": "overtimeRate",
  "basic salary (£)": "annualSalary",
  "annual salary (£)": "annualSalary",
  "payroll reference": "payrollNumber",
  "national insurance no.": "nationalInsurance",
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
  manager_id: "lineManagerIds",
  hourly_rate: "hourlyRate",
  overtime_rate: "overtimeRate",
  annual_salary: "annualSalary",
  payroll_reference: "payrollNumber",
  national_insurance_number: "nationalInsurance",
  home_address: "address",
  emergency_contact: "emergencyContact",
};

const FIELD_SECTION_MAP = {
  firstName: "personal",
  lastName: "personal",
  email: "personal",
  phone: "personal",
  department: "employment",
  jobTitle: "employment",
  role: "employment",
  employmentType: "employment",
  status: "employment",
  startDate: "employment",
  probationEnd: "employment",
  contractedHours: "employment",
  lineManagerIds: "employment",
  hourlyRate: "compensation",
  overtimeRate: "compensation",
  annualSalary: "compensation",
  payrollNumber: "compensation",
  nationalInsurance: "compensation",
  address: "address",
  emergencyContact: "emergency",
};

const SECTION_LABELS = {
  personal: "Personal details",
  employment: "Employment details",
  compensation: "Pay & compensation",
  address: "Home address",
  emergency: "Emergency contact",
};

const SECTION_ORDER = ["personal", "employment", "compensation", "address", "emergency"];

function calculateBasicSalary(contractedHours, hourlyRate) {
  const hours = Number(contractedHours);
  const rate = Number(hourlyRate);
  if (!Number.isFinite(hours) || !Number.isFinite(rate)) return "";
  if (hours < 0 || rate < 0) return "";
  return (hours * rate).toFixed(2);
}

function syncDerivedSalary(values = {}) {
  return {
    ...values,
    annualSalary: calculateBasicSalary(values.contractedHours, values.hourlyRate),
  };
}

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
  const [newEmployee, setNewEmployee] = useState(
    syncDerivedSalary({
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
      lineManagerIds: [],
      hourlyRate: "",
      overtimeRate: "",
      annualSalary: "",
      keycloakId: "",
      payrollNumber: "",
      nationalInsurance: "",
      emergencyContact: "",
      address: "",
    })
  );
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

  const lineManagerOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.userId,
        label: employee.name || employee.email || `User ${employee.userId}`,
        description: [employee.jobTitle, employee.department].filter(Boolean).join(" · "),
      })),
    [employees]
  );

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

  const employeeSummary = useMemo(() => {
    const active = filteredEmployees.filter((employee) => employee.status === "Active").length;
    const inactive = filteredEmployees.filter((employee) => employee.status && employee.status !== "Active").length;
    return {
      total: filteredEmployees.length,
      active,
      inactive,
    };
  }, [filteredEmployees]);

  useEffect(() => {
    if (isLoading || error) return;
    if (selectedEmployeeId == null) return;
    if (!filteredEmployees.some((employee) => employee.id === selectedEmployeeId)) {
      setSelectedEmployeeId(null);
    }
  }, [isLoading, error, filteredEmployees, selectedEmployeeId]);

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
    setNewEmployee(
      syncDerivedSalary({
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
        lineManagerIds: [],
        hourlyRate: "",
        overtimeRate: "",
        annualSalary: "",
        keycloakId: "",
        payrollNumber: "",
        nationalInsurance: "",
        emergencyContact: "",
        address: "",
      })
    );
  };

  const updateNewEmployeeField = (field, value) => {
    setNewEmployee((prev) => syncDerivedSalary({ ...prev, [field]: value }));
  };

  const updateEditEmployeeField = (field, value) => {
    setEditEmployee((prev) => syncDerivedSalary({ ...prev, [field]: value }));
    setEditFieldErrors((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const fieldsToClear = [field];
      if (field === "contractedHours" || field === "hourlyRate") {
        fieldsToClear.push("annualSalary");
      }
      let changed = false;
      fieldsToClear.forEach((fieldKey) => {
        if (next[fieldKey]) {
          delete next[fieldKey];
          changed = true;
        }
      });
      if (!changed) return prev;
      return next;
    });
  };

  const mapEmployeeToForm = (employee) => {
    if (!employee) return null;
    const nameParts = (employee.name || "").trim().split(/\s+/);
    const firstName = nameParts.shift() || "";
    const lastName = nameParts.join(" ");
    return syncDerivedSalary({
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
      lineManagerIds: Array.isArray(employee.lineManagerIds) ? employee.lineManagerIds : [],
      hourlyRate: employee.hourlyRate ?? "",
      overtimeRate: employee.overtimeRate ?? "",
      annualSalary: employee.annualSalary ?? "",
      payrollNumber: employee.payrollNumber || "",
      nationalInsurance: employee.nationalInsurance || "",
      keycloakId: employee.keycloakId || "",
      emergencyContact: employee.emergencyContact || "",
      address: employee.address || "",
    });
  };

  const upsertLocalEmployee = (employeeRecord) => {
    if (!employeeRecord) return;
    const normalizedLineManagerIds = Array.isArray(employeeRecord.lineManagerIds)
      ? employeeRecord.lineManagerIds.map((entry) => Number(entry)).filter(Boolean)
      : [];
    const fallbackLineManagers = normalizedLineManagerIds
      .map((managerId) => {
        const match = lineManagerOptions.find((option) => Number(option.value) === managerId);
        if (!match) return null;
        return {
          userId: managerId,
          name: match.label,
        };
      })
      .filter(Boolean);
    const enrichedEmployeeRecord = {
      ...employeeRecord,
      lineManagerIds: normalizedLineManagerIds,
      lineManagers:
        Array.isArray(employeeRecord.lineManagers) && employeeRecord.lineManagers.length > 0
          ? employeeRecord.lineManagers
          : fallbackLineManagers,
    };
    setLocalEmployees((prev) => {
      const key = enrichedEmployeeRecord.userId || enrichedEmployeeRecord.id || enrichedEmployeeRecord.email;
      const filtered = prev.filter((emp) => (emp.userId || emp.id || emp.email) !== key);
      return [...filtered, enrichedEmployeeRecord];
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
        const parsedError = await extractError(response, newEmployee);
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
    if (!editEmployee.userId) {
      setEditError("Cannot save changes because this profile is not linked to a user record.");
      return;
    }
    setIsSavingEdit(true);
    setEditError(null);
    setEditFieldErrors({});
    try {
      const response = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editEmployee, _operation: "edit" }),
      });

      if (!response.ok) {
        const parsedError = await extractError(response, editEmployee);
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

  const extractError = async (response, submittedValues = {}) => {
    try {
      const data = await response.json();
      const fieldErrors = {};
      const serverMessage = typeof data?.message === "string" ? data.message : "";
      const serverError = typeof data?.error === "string" ? data.error : "";
      const combinedServerText = [serverMessage, serverError].filter(Boolean).join(" ");

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

      const emailFormatError = /(invalid email|email format|malformed email|not a valid email address)/i;
      if (emailFormatError.test(serverError) && !fieldErrors.email) {
        fieldErrors.email = "Enter a valid email address.";
      }

      if (/users_email_key/i.test(serverError) && !fieldErrors.email) {
        fieldErrors.email = "That email address is already in use by another user.";
      }

      if (/record\s+"new"\s+has\s+no\s+field\s+"name"/i.test(combinedServerText)) {
        // Only highlight role when it is actually missing; this backend error can occur even when UI values are valid.
        const roleValue = String(submittedValues?.role ?? "").trim();
        if (!roleValue && !fieldErrors.role) {
          fieldErrors.role = "Select a role before saving.";
        }
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
      setNewEmployee((prev) => syncDerivedSalary({ ...prev, ...updates }));
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
    <DevLayoutSection
      as="section"
      ref={directorySectionRef}
      sectionKey="hr-employees-workspace"
      parentKey="hr-manager-tab-employees"
      sectionType="section-shell"
      shell
      className="hr-employees-layout"
    >
      <DevLayoutSection
        sectionKey="hr-employees-directory"
        parentKey="hr-employees-workspace"
        sectionType="section-shell"
        shell
        className="hr-employees-directory-shell"
      >
        <SectionCard
          sectionKey="hr-employees-directory-card"
          parentKey="hr-employees-directory"
          sectionType="content-card"
          backgroundToken="surface"
          className="hr-employees-directory-card"
          title=""
          subtitle={null}
        >
          <div className="hr-employees-directory-toolbar">
            <div className="hr-employees-search">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by employee name..."
                className="hr-employees-search-input"
              />
              <span className="hr-employees-search-meta">
                {filteredEmployees.length} of {employees.length} employees
              </span>
            </div>
            <div className="hr-employees-directory-actions">
              <DirectoryFilters
                filters={filters}
                setFilters={setFilters}
                departments={uniqueDepartments}
                employmentTypes={uniqueEmploymentTypes}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleShowAddEmployee}
                aria-label="Add employee"
                style={{ gap: "6px" }}
              >
                <span style={{ fontSize: "1rem", lineHeight: 1, fontWeight: 700 }}>+</span>
                <span>Add Employee</span>
              </Button>
            </div>
          </div>
          <div className="hr-employees-summary-row">
            <div className="hr-employees-summary-card">
              <span className="hr-employees-summary-label">Visible employees</span>
              <strong className="hr-employees-summary-value">{employeeSummary.total}</strong>
            </div>
            <div className="hr-employees-summary-card">
              <span className="hr-employees-summary-label">Active</span>
              <strong className="hr-employees-summary-value">{employeeSummary.active}</strong>
            </div>
            <div className="hr-employees-summary-card">
              <span className="hr-employees-summary-label">Inactive / leave</span>
              <strong className="hr-employees-summary-value">{employeeSummary.inactive}</strong>
            </div>
          </div>
          <DevLayoutSection
            sectionKey="hr-employees-directory-list"
            parentKey="hr-employees-directory-card"
            sectionType="data-table"
            backgroundToken="accent-surface"
            className="hr-employees-list"
          >
            {filteredEmployees.length === 0 && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "var(--radius-sm)",
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
                <DevLayoutSection
                  as="div"
                  key={employee.id}
                  sectionKey={`hr-employee-row-${employee.userId || employee.id}`}
                  parentKey="hr-employees-directory-list"
                  sectionType="table-row"
                  backgroundToken="accent-surface"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedEmployeeId(employee.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedEmployeeId(employee.id);
                    }
                  }}
                aria-pressed={isSelected}
                className={`hr-employees-row${isSelected ? " is-selected" : ""}`}
              >
                  <div className="hr-employees-row-avatar">
                    {getInitials(employee.name)}
                  </div>

                  <div className="hr-employees-row-body">
                    <div className="hr-employees-row-header">
                      <span className="hr-employees-row-name">
                        {employee.name}
                      </span>
                      {employee.email ? (
                        <span className="hr-employees-row-email">{employee.email}</span>
                      ) : null}
                    </div>
                    <span className="hr-employees-row-role">
                      {employee.department || "Department"} • {employee.jobTitle || employee.role || "Role"}
                    </span>
                    <div className="hr-employees-row-meta">
                      {employee.startDate ? <span>Started {employee.startDate}</span> : null}
                      {employee.phone ? <span>{employee.phone}</span> : null}
                      {employee.contractedHours ? <span>{employee.contractedHours} hrs / week</span> : null}
                    </div>
                    <div className="hr-employees-row-badges">
                      {employee.status && (
                        <span className="app-badge app-badge--control app-badge--accent-soft">
                          {employee.status}
                        </span>
                      )}
                      {employee.employmentType && (
                        <span className="app-badge app-badge--control app-badge--neutral">
                          {employee.employmentType}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hr-employees-row-end">
                    <StatusTag
                      label={employee.status}
                      tone={employee.status === "Active" ? "success" : "danger"}
                    />
                    <span className="hr-employees-row-chevron">{">"}</span>
                  </div>
                </DevLayoutSection>
              );
            })}
          </DevLayoutSection>
        </SectionCard>
      </DevLayoutSection>

      <DevLayoutSection
        ref={detailPanelRef}
        sectionKey="hr-employees-detail-panel"
        parentKey="hr-employees-workspace"
        sectionType="section-shell"
        shell
        disableFallback
        className="hr-employees-detail-panel"
        backgroundToken="accent-surface"
      >
        <EmployeeProfilePanel
          employee={selectedEmployee}
          onEdit={selectedEmployee ? handleStartEditEmployee : null}
        />
      </DevLayoutSection>
    </DevLayoutSection>
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
      lineManagerOptions={lineManagerOptions}
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
        lineManagerOptions={lineManagerOptions}
      />
    ) : null;

  if (isLoading) {
    return <HrTabLoadingSkeleton variant="employees" />;
  }

  if (error) {
    return (
      <SectionCard title="Failed to load employee directory" subtitle="An error occurred.">
        <span style={{ color: "var(--danger)" }}>{error.message}</span>
      </SectionCard>
    );
  }

  return (
    <>
      <DevLayoutSection
        sectionKey="hr-employees-header"
        parentKey="hr-manager-tab-employees"
        sectionType="toolbar"
        className="hr-employees-topbar"
      >
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        </div>
      </DevLayoutSection>

      {editFormSection ? editFormSection : isAddingEmployee ? addFormSection : (
        directorySection
      )}
    </>
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
  lineManagerOptions,
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
              style={surfaceButtonStyle}
            >
              Back
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              style={{
                ...primaryButtonStyle,
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
            <div
              role="alert"
              style={{
                color: "var(--danger-dark)",
                background: "var(--danger-surface)",
                border: "1px solid var(--danger-border)",
                borderRadius: "var(--input-radius)",
                padding: "var(--control-padding)",
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {errorMessage}
            </div>
          )}
          <EmployeeDetailsFields
            values={values}
            onFieldChange={onFieldChange}
            fieldErrors={fieldErrors}
            availableRoles={availableRoles}
            availableJobTitles={availableJobTitles}
            lineManagerOptions={lineManagerOptions}
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
          ...accentFieldSurface,
          padding: "10px",
          borderRadius: "var(--radius-xs)",
          border: hasError ? "1px solid var(--danger)" : accentFieldSurface.border,
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
            border: "none",
            borderRadius: "var(--radius-xs)",
            marginTop: "4px",
            zIndex: 1000,
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
                  background: value === item ? "rgba(var(--primary-rgb), 0.1)" : "var(--surface)",
                  color: value === item ? "var(--primary)" : "var(--text-primary)",
                  fontWeight: value === item ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (value !== item) {
                    e.currentTarget.style.background = "var(--surface-light)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (value !== item) {
                    e.currentTarget.style.background = "var(--surface)";
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

function SearchableMultiSelect({
  values = [],
  onChange,
  items = [],
  placeholder,
  emptyLabel,
  hasError = false,
  excludeIds = [],
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = React.useRef(null);
  const controlInputRef = React.useRef(null);

  const normalizedExcludeIds = useMemo(
    () => new Set((excludeIds || []).map((entry) => Number(entry)).filter(Boolean)),
    [excludeIds]
  );
  const normalizedValues = useMemo(
    () => (values || []).map((entry) => Number(entry)).filter(Boolean),
    [values]
  );
  const selectedIds = useMemo(() => new Set(normalizedValues), [normalizedValues]);

  const filteredItems = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    return safeItems.filter((item) => {
      if (normalizedExcludeIds.has(Number(item.value))) return false;
      if (!searchTerm.trim()) return true;
      const haystack = [item.label, item.description].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(searchTerm.toLowerCase());
    });
  }, [items, normalizedExcludeIds, searchTerm]);

  const selectedItems = useMemo(
    () => (items || []).filter((item) => selectedIds.has(Number(item.value))),
    [items, selectedIds]
  );

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

  const toggleValue = (value) => {
    const numericValue = Number(value);
    const next = selectedIds.has(numericValue)
      ? normalizedValues.filter((entry) => entry !== numericValue)
      : [...normalizedValues, numericValue];
    onChange(next);
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <div
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => controlInputRef.current?.focus(), 0);
        }}
        style={{
          minHeight: "42px",
          padding: "8px 10px",
          borderRadius: "var(--radius-xs)",
          border: hasError ? "1px solid var(--danger)" : "1px solid var(--surface-light)",
          boxShadow: hasError ? "0 0 0 2px rgba(var(--danger-rgb), 0.12)" : "none",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          cursor: "text",
        }}
      >
        {selectedItems.length > 0 ? (
          selectedItems.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleValue(item.value);
              }}
              style={{
                border: "1px solid rgba(var(--primary-rgb), 0.24)",
                borderRadius: "var(--radius-pill)",
                padding: "8px 12px",
                background: "rgba(var(--primary-rgb), 0.12)",
                color: "var(--primary)",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "none",
                lineHeight: 1,
              }}
            >
              {item.label} ×
            </button>
          ))
        ) : null}
        <input
          ref={controlInputRef}
          type="text"
          value={searchTerm}
          onFocus={() => setIsOpen(true)}
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen(true);
          }}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          placeholder={selectedItems.length > 0 ? "Search for more users..." : placeholder}
          style={{
            flex: "1 1 180px",
            minWidth: "140px",
            border: "none",
            outline: "none",
            background: "var(--surface)",
            color: "var(--text-primary)",
            fontSize: "0.9rem",
            padding: 0,
          }}
        />
      </div>
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: "260px",
            overflow: "hidden",
            background: "var(--surface)",
            borderRadius: "var(--radius-xs)",
            marginTop: "4px",
            zIndex: 1000,
            border: "1px solid var(--surface-light)",
          }}
        >
          <div style={{ maxHeight: "210px", overflowY: "auto" }}>
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const isSelected = selectedIds.has(Number(item.value));
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => toggleValue(item.value)}
                    style={{
                      width: "100%",
                      border: "none",
                      background: isSelected ? "rgba(var(--primary-rgb), 0.1)" : "var(--surface)",
                      padding: "10px 12px",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <span style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? "var(--primary)" : "var(--text-primary)" }}>
                      {item.label}
                    </span>
                    {item.description ? (
                      <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        {item.description}
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div style={{ padding: "10px 12px", color: "var(--info)", fontSize: "0.9rem" }}>
                {emptyLabel}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeading({ title, hasError = false, errorCount = 0 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        fontSize: "0.82rem",
        fontWeight: 700,
        color: hasError ? "var(--danger-dark)" : "var(--primary)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        paddingBottom: "6px",
        borderBottom: hasError
          ? "2px solid rgba(var(--danger-rgb), 0.35)"
          : "2px solid rgba(var(--primary-rgb), 0.15)",
      }}
    >
      <span>{title}</span>
      {hasError && (
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "var(--danger-dark)",
            background: "rgba(var(--danger-rgb), 0.15)",
            border: "1px solid var(--danger-border)",
            borderRadius: "var(--radius-pill)",
            padding: "2px 8px",
            textTransform: "none",
            letterSpacing: "normal",
          }}
        >
          {errorCount > 1 ? `${errorCount} fields need attention` : "Needs attention"}
        </span>
      )}
    </div>
  );
}

function EmployeeDetailsFields({
  values,
  onFieldChange,
  fieldErrors = {},
  availableRoles,
  availableJobTitles,
  lineManagerOptions = [],
}) {
  const update = (field) => (event) => onFieldChange(field, event.target.value);
  const inputStyle = {
    padding: "10px",
    borderRadius: "var(--radius-xs)",
    border: "1px solid var(--surface-light)",
    background: "var(--surface)",
    color: "var(--text-primary)",
  };
  const applyFieldErrorStyle = (field, baseStyle = inputStyle) =>
    fieldErrors[field]
      ? {
          ...baseStyle,
          border: "1px solid var(--danger)",
          boxShadow: "0 0 0 2px rgba(var(--danger-rgb), 0.12)",
        }
      : baseStyle;
  const sectionErrors = useMemo(() => {
    const grouped = {};
    Object.keys(fieldErrors || {}).forEach((field) => {
      const section = FIELD_SECTION_MAP[field];
      if (!section) return;
      grouped[section] = grouped[section] || [];
      grouped[section].push(field);
    });
    return grouped;
  }, [fieldErrors]);
  const getSectionShellStyle = (section) => {
    const hasError = Boolean(sectionErrors[section]?.length);
    return {
      border: hasError ? "1px solid var(--danger-border)" : "1px solid var(--surface-light)",
      borderRadius: "var(--radius-sm)",
      padding: "12px",
      background: hasError ? "rgba(var(--danger-rgb), 0.06)" : "var(--surface-light)",
      boxShadow: hasError ? "0 0 0 2px rgba(var(--danger-rgb), 0.08)" : "none",
    };
  };
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  };

  return (
    <>
      {/* ── Personal Details ── */}
      <div style={getSectionShellStyle("personal")}>
        <SectionHeading
          title="Personal Details"
          hasError={Boolean(sectionErrors.personal?.length)}
          errorCount={sectionErrors.personal?.length || 0}
        />
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
      </div>

      {/* ── Employment Details ── */}
      <div style={getSectionShellStyle("employment")}>
        <SectionHeading
          title="Employment Details"
          hasError={Boolean(sectionErrors.employment?.length)}
          errorCount={sectionErrors.employment?.length || 0}
        />
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
            <div style={applyFieldErrorStyle("startDate", { borderRadius: "var(--radius-xs)" })}>
              <CalendarField name="startDate" id="startDate" value={values.startDate} onChange={update("startDate")} />
            </div>
          </FormField>
          <FormField label="Probation Ends" errorMessage={fieldErrors.probationEnd}>
            <div style={applyFieldErrorStyle("probationEnd", { borderRadius: "var(--radius-xs)" })}>
              <CalendarField name="probationEnd" id="probationEnd" value={values.probationEnd} onChange={update("probationEnd")} />
            </div>
          </FormField>
          <FormField label="Contracted Hours / Week" errorMessage={fieldErrors.contractedHours}>
            <input type="number" min="0" value={values.contractedHours} onChange={update("contractedHours")} style={applyFieldErrorStyle("contractedHours")} />
          </FormField>
          <FormField label="Line Manager" errorMessage={fieldErrors.lineManagerIds}>
            <SearchableMultiSelect
              values={values.lineManagerIds || []}
              onChange={(nextValue) => onFieldChange("lineManagerIds", nextValue)}
              items={lineManagerOptions}
              placeholder="Search and select line managers..."
              emptyLabel="No users found"
              hasError={Boolean(fieldErrors.lineManagerIds)}
              excludeIds={values.userId ? [values.userId] : []}
            />
          </FormField>
        </div>
      </div>

      {/* ── Pay & Compensation ── */}
      <div style={getSectionShellStyle("compensation")}>
        <SectionHeading
          title="Pay &amp; Compensation"
          hasError={Boolean(sectionErrors.compensation?.length)}
          errorCount={sectionErrors.compensation?.length || 0}
        />
        <div style={gridStyle}>
          <FormField label="Hourly Rate (£)" errorMessage={fieldErrors.hourlyRate}>
            <input type="number" min="0" step="0.01" value={values.hourlyRate} onChange={update("hourlyRate")} style={applyFieldErrorStyle("hourlyRate")} placeholder="15.50" />
          </FormField>
          <FormField label="Overtime Rate (£)" errorMessage={fieldErrors.overtimeRate}>
            <input type="number" min="0" step="0.01" value={values.overtimeRate} onChange={update("overtimeRate")} style={applyFieldErrorStyle("overtimeRate")} placeholder="23.25" />
          </FormField>
          <FormField label="Basic Salary (£)" errorMessage={fieldErrors.annualSalary}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.annualSalary}
              readOnly
              style={{ ...applyFieldErrorStyle("annualSalary"), background: "var(--surface-light)", cursor: "not-allowed" }}
              placeholder="Auto-calculated"
            />
          </FormField>
          <FormField label="Payroll Reference" errorMessage={fieldErrors.payrollNumber}>
            <input type="text" value={values.payrollNumber} onChange={update("payrollNumber")} style={applyFieldErrorStyle("payrollNumber")} placeholder="PAY-001" />
          </FormField>
          <FormField label="National Insurance No." errorMessage={fieldErrors.nationalInsurance}>
            <input type="text" value={values.nationalInsurance} onChange={update("nationalInsurance")} style={applyFieldErrorStyle("nationalInsurance")} placeholder="QQ123456C" />
          </FormField>
        </div>
      </div>

      {/* ── Address ── */}
      <div style={getSectionShellStyle("address")}>
        <SectionHeading
          title="Home Address"
          hasError={Boolean(sectionErrors.address?.length)}
          errorCount={sectionErrors.address?.length || 0}
        />
        <AddressSearchField
          value={values.address}
          onChange={(val) => onFieldChange("address", val)}
        />
      </div>

      {/* ── Emergency Contact ── */}
      <div style={getSectionShellStyle("emergency")}>
        <SectionHeading
          title="Emergency Contact"
          hasError={Boolean(sectionErrors.emergency?.length)}
          errorCount={sectionErrors.emergency?.length || 0}
        />
        <EmergencyContactSection
          value={values.emergencyContact}
          onChange={(val) => onFieldChange("emergencyContact", val)}
          userId={values.userId}
        />
      </div>
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
    borderRadius: "var(--radius-xs)",
    border: "1px solid var(--surface-light)",
    background: "var(--surface)",
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
              background: "var(--surface)",
              border: "1px solid var(--surface-light)",
              borderRadius: "var(--radius-xs)",
              marginTop: "4px",
              maxHeight: "200px",
              overflowY: "auto",
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
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
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
    borderRadius: "var(--radius-xs)",
    border: "1px solid var(--surface-light)",
    background: "var(--surface)",
    fontSize: "0.9rem",
  };

  return (
    <div
      style={{
        border: "1px solid var(--surface-light)",
        borderRadius: "var(--radius-sm)",
        padding: "16px",
        background: "var(--surface)",
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
              color: "var(--primary)",
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
  ...primaryButtonStyle,
};

const buttonStyleGhost = {
  ...surfaceButtonStyle,
  border: "1px solid rgba(var(--primary-rgb), 0.18)",
  color: "var(--primary)",
};

function SampleAutofillBlock({ value, onChange, onApply, onClear }) {
  return (
    <div
      style={{
        marginTop: "12px",
        border: "1px solid rgba(var(--primary-rgb), 0.14)",
        borderRadius: "var(--radius-sm)",
        padding: "16px",
        background: "var(--surface-light)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <strong style={{ color: "var(--primary)" }}>Temporary Sample Autofill</strong>
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
          borderRadius: "var(--input-radius)",
          border: "1px solid var(--surface-light)",
          background: "var(--surface)",
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
    annualSalary: "Basic salary",
    payrollNumber: "Payroll reference",
    nationalInsurance: "National Insurance number",
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

function formatList(labels = []) {
  const safe = labels.filter(Boolean);
  if (safe.length === 0) return "";
  if (safe.length === 1) return safe[0];
  if (safe.length === 2) return `${safe[0]} and ${safe[1]}`;
  return `${safe.slice(0, -1).join(", ")}, and ${safe[safe.length - 1]}`;
}

function getErrorSections(fieldErrors = {}) {
  const grouped = {};
  Object.keys(fieldErrors || {}).forEach((field) => {
    const section = FIELD_SECTION_MAP[field];
    if (!section) return;
    grouped[section] = grouped[section] || [];
    grouped[section].push(field);
  });

  return SECTION_ORDER.filter((section) => grouped[section]?.length).map((section) => ({
    key: section,
    label: SECTION_LABELS[section],
    fields: grouped[section],
  }));
}

function formatEmployeeSaveError(serverMessage, serverError, fieldErrors = {}) {
  const invalidFields = Object.keys(fieldErrors || {});
  if (invalidFields.length > 0) {
    const sections = getErrorSections(fieldErrors);
    if (sections.length > 0) {
      return `Cannot save changes yet. Check ${formatList(sections.map((section) => section.label))} and update the highlighted field${invalidFields.length > 1 ? "s" : ""}.`;
    }
    return `Cannot save changes yet. Update the highlighted field${invalidFields.length > 1 ? "s" : ""} and try again.`;
  }
  const combinedServerText = [serverMessage, serverError].filter(Boolean).join(" ");
  if (/record\s+"new"\s+has\s+no\s+field\s+"name"/i.test(combinedServerText)) {
    return "Unable to save employee changes right now due to a server validation issue on the users table.";
  }
  if (serverError) {
    if (/duplicate key/i.test(serverError)) {
      return "Cannot save changes because a duplicate value already exists.";
    }
    if (/invalid input syntax/i.test(serverError)) {
      return "Cannot save changes because one or more values are in the wrong format.";
    }
    return "Unable to save changes right now. Please review the form and try again.";
  }
  if (serverMessage) {
    return `Unable to save changes right now: ${serverMessage}`;
  }
  return null;
}
