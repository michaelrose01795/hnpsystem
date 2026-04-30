// file location: src/components/HR/EmployeeProfilePanel.js
import React, { useState } from "react";
import { StatusTag } from "@/components/HR/MetricCard";
import DocumentsUploadPopup from "@/components/popups/DocumentsUploadPopup";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

// Outer "main" card uses the accent-surface theme colour; all inner blocks sit on --surface.
const mainCardStyle = {
  borderRadius: "var(--radius-md)",
  border: "1px solid rgba(var(--accent-base-rgb), 0.22)",
  background: "var(--theme)",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const subCardStyle = {
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--surface)",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const labelStyle = {
  fontSize: "0.72rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-1)",
  fontWeight: 600,
};

export default function EmployeeProfilePanel({ employee, onEdit }) {
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false);

  if (!employee) {
    return (
      <DevLayoutSection
        sectionKey="hr-employee-profile-panel"
        parentKey="hr-employees-detail-panel"
        sectionType="section-shell"
        shell
        disableFallback
        className="hr-employee-profile-panel hr-employee-profile-panel--empty"
        style={{
          ...mainCardStyle,
          alignItems: "center",
          justifyContent: "center",
          minHeight: "240px",
          textAlign: "center",
        }}
      >
        <p style={{ ...labelStyle, color: "var(--text-1)", margin: 0 }}>Employee Profile</p>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-1)" }}>
          Select an employee from the list to view their profile.
        </p>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-1)" }}>
          Details, documents, and employment information will appear here.
        </p>
      </DevLayoutSection>
    );
  }

  const displayName =
    employee.name ||
    employee.fullName ||
    [employee.firstName, employee.lastName].filter(Boolean).join(" ") ||
    "Employee";

  const chips = [
    employee.employmentType,
    employee.department,
    employee.jobTitle,
    employee.status,
  ].filter(Boolean);

  const profileParentKey = "hr-employee-profile-panel";
  const handleCopy = async (value) => {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  return (
    <DevLayoutSection
      sectionKey="hr-employee-profile-panel"
      parentKey="hr-employees-detail-panel"
      sectionType="section-shell"
      shell
      disableFallback
      className="hr-employee-profile-panel"
      backgroundToken="accent-surface"
      style={mainCardStyle}
    >
      <DevLayoutSection
        sectionKey="hr-employee-profile-edit-row"
        parentKey={profileParentKey}
        sectionType="toolbar"
        className="hr-employee-profile-edit-row"
        style={{ display: "flex", justifyContent: "flex-end" }}
      >
        <button
          type="button"
          onClick={onEdit}
          disabled={!onEdit}
          style={{
            padding: "10px 18px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(var(--accent-base-rgb), 0.32)",
            background: "var(--surface)",
            color: "var(--text-1)",
            fontWeight: 700,
            cursor: onEdit ? "pointer" : "not-allowed",
          }}
        >
          Edit employee details
        </button>
      </DevLayoutSection>

      <DevLayoutSection
        sectionKey="hr-employee-profile-header"
        parentKey={profileParentKey}
        sectionType="content-card"
        backgroundToken="surface"
        className="hr-employee-profile-header-card"
        style={subCardStyle}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <StatusTag label={employee.status} tone={employee.status === "Active" ? "success" : "default"} />
            <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.9rem" }}>
              {employee.jobTitle || "Job title"} - {employee.department || "Department"}
            </p>
          </div>
          <h2 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: "var(--text-1)" }}>
            {displayName}
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {chips.length === 0 ? (
              <span style={{ ...labelStyle, textTransform: "none", letterSpacing: "0.02em" }}>
                No highlights yet.
              </span>
            ) : (
              chips.map((chip) => (
                <span
                  key={chip}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-pill)",
                    border: "none",
                    background: "rgba(var(--accent-base-rgb), 0.12)",
                    color: "var(--text-1)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {chip}
                </span>
              ))
            )}
          </div>
        </div>
      </DevLayoutSection>

      <DevLayoutSection
        as="section"
        sectionKey="hr-employee-profile-sections"
        parentKey={profileParentKey}
        sectionType="section-shell"
        className="hr-employee-profile-sections"
        style={{ display: "grid", gap: "16px" }}
      >
        <CardBlock title="Role & Access" sectionKey="hr-employee-role-access" parentKey="hr-employee-profile-sections">
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <KeyValue label="Role (Permissions)" value={employee.role} sectionKey="hr-employee-role" parentKey="hr-employee-role-access" />
            <KeyValue label="Job Title" value={employee.jobTitle} sectionKey="hr-employee-job-title" parentKey="hr-employee-role-access" />
            <KeyValue label="Department" value={employee.department} sectionKey="hr-employee-department" parentKey="hr-employee-role-access" />
            <KeyValue
              label="Line Managers"
              value={
                employee.lineManagers?.length
                  ? employee.lineManagers.map((manager) => manager.name).join(", ")
                  : "Not assigned"
              }
              sectionKey="hr-employee-line-managers"
              parentKey="hr-employee-role-access"
            />
          </div>
        </CardBlock>

        <CardBlock title="Tenure & Probation" sectionKey="hr-employee-tenure-probation" parentKey="hr-employee-profile-sections">
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <KeyValue
              label="Start Date"
              value={formatDate(employee.startDate)}
              helper={formatEmploymentTenure(employee.startDate)}
              sectionKey="hr-employee-start-date"
              parentKey="hr-employee-tenure-probation"
            />
            <KeyValue
              label="Probation End"
              value={formatDate(employee.probationEnd)}
              helper={formatProbationStatus(employee.probationEnd)}
              sectionKey="hr-employee-probation-end"
              parentKey="hr-employee-tenure-probation"
            />
          </div>
        </CardBlock>

        <CardBlock title="Compensation & Hours" sectionKey="hr-employee-compensation-hours" parentKey="hr-employee-profile-sections">
          <div style={{ display: "grid", gap: "12px" }}>
            <DevLayoutSection
              sectionKey="hr-employee-basic-salary"
              parentKey="hr-employee-compensation-hours"
              sectionType="stat-card"
              className="hr-employee-basic-salary-card"
              style={{
                borderRadius: "var(--radius-md)",
                border: "none",
                background: "var(--theme)",
                padding: "14px",
              }}
            >
              <div style={labelStyle}>Basic Salary</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-1)" }}>
                {formatCurrencyValue(employee.annualSalary)}
              </div>
            </DevLayoutSection>
            <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <KeyValue label="Hourly Rate" value={formatCurrencyValue(employee.hourlyRate)} helper="Base rate" sectionKey="hr-employee-hourly-rate" parentKey="hr-employee-compensation-hours" />
              <KeyValue label="Contracted Hours" value={formatHours(employee.contractedHours)} helper="Per week" sectionKey="hr-employee-contracted-hours" parentKey="hr-employee-compensation-hours" />
            </div>
          </div>
        </CardBlock>

        <CardBlock title="Contact Information" sectionKey="hr-employee-contact-information" parentKey="hr-employee-profile-sections">
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <KeyValue
              label="Email"
              value={employee.email}
              sectionKey="hr-employee-email"
              parentKey="hr-employee-contact-information"
              actions={
                employee.email && (
                  <ActionRow>
                    <ActionButton onClick={() => handleCopy(employee.email)}>Copy</ActionButton>
                    <ActionButton onClick={() => (window.location.href = `mailto:${employee.email}`)}>Email</ActionButton>
                  </ActionRow>
                )
              }
            />
            <KeyValue
              label="Phone"
              value={employee.phone}
              sectionKey="hr-employee-phone"
              parentKey="hr-employee-contact-information"
              actions={
                employee.phone && (
                  <ActionRow>
                    <ActionButton onClick={() => handleCopy(employee.phone)}>Copy</ActionButton>
                    <ActionButton onClick={() => (window.location.href = `tel:${employee.phone}`)}>Call</ActionButton>
                  </ActionRow>
                )
              }
            />
            <KeyValue
              label="Emergency Contact"
              value={employee.emergencyContact}
              sectionKey="hr-employee-emergency-contact"
              parentKey="hr-employee-contact-information"
              actions={
                employee.emergencyContact && (
                  <ActionRow>
                    <ActionButton onClick={() => handleCopy(employee.emergencyContact)}>Copy</ActionButton>
                  </ActionRow>
                )
              }
            />
            <KeyValue
              label="Address"
              value={employee.address}
              sectionKey="hr-employee-address"
              parentKey="hr-employee-contact-information"
              actions={
                employee.address && (
                  <ActionRow>
                    <ActionButton onClick={() => handleCopy(employee.address)}>Copy</ActionButton>
                  </ActionRow>
                )
              }
            />
          </div>
        </CardBlock>

        <CardBlock title="Documents" action={null} sectionKey="hr-employee-documents" parentKey="hr-employee-profile-sections">
          <DevLayoutSection
            as="button"
            sectionKey="hr-employee-upload-document"
            parentKey="hr-employee-documents"
            sectionType="toolbar"
            type="button"
            onClick={() => setShowDocumentsPopup(true)}
            style={{
              width: "100%",
              padding: "var(--control-padding)",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "rgba(var(--primary-rgb), 0.12)",
              color: "var(--text-1)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Upload document
          </DevLayoutSection>
          <DevLayoutSection
            as="div"
            sectionKey="hr-employee-documents-list"
            parentKey="hr-employee-documents"
            sectionType="data-table"
            style={{ display: "grid", gap: "10px" }}
          >
            {employee.documents?.length > 0 ? (
              employee.documents.map((doc, index) => (
                <DevLayoutSection
                  key={doc.id}
                  sectionKey={`hr-employee-document-${doc.id || index + 1}`}
                  parentKey="hr-employee-documents-list"
                  sectionType="table-row"
                  style={{
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "rgba(var(--grey-accent-rgb), 0.08)",
                    padding: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-1)" }}>
                      {doc.name}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-1)" }}>
                      Type: {doc.type} - Uploaded {formatDate(doc.uploadedOn)}
                    </span>
                  </div>
                  <button
                    type="button"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-pill)",
                      border: "none",
                      background: "transparent",
                      color: "var(--primary)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    View
                  </button>
                </DevLayoutSection>
              ))
            ) : (
              <DevLayoutSection
                sectionKey="hr-employee-documents-empty"
                parentKey="hr-employee-documents-list"
                sectionType="content-card"
                style={{
                  borderRadius: "var(--radius-sm)",
                  border: "1px dashed rgba(var(--grey-accent-rgb), 0.4)",
                  padding: "14px",
                  color: "var(--text-1)",
                  fontSize: "0.85rem",
                }}
              >
                No documents uploaded yet.
              </DevLayoutSection>
            )}
          </DevLayoutSection>
        </CardBlock>
      </DevLayoutSection>

      <DocumentsUploadPopup
        open={showDocumentsPopup}
        onClose={() => setShowDocumentsPopup(false)}
        jobId={null}
        userId={employee?.userId || null}
      />
    </DevLayoutSection>
  );
}

function CardBlock({ title, action = null, children, sectionKey, parentKey }) {
  return (
    <DevLayoutSection
      as="section"
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      backgroundToken="surface"
      className="hr-employee-card-block"
      style={subCardStyle}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-1)" }}>{title}</div>
        {action}
      </div>
      {children}
    </DevLayoutSection>
  );
}

function KeyValue({ label, value, helper, actions, sectionKey, parentKey }) {
  return (
    <DevLayoutSection
      as="div"
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      backgroundToken="surface"
      className="hr-employee-key-value"
      style={{ display: "flex", flexDirection: "column", gap: "6px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
        <span style={labelStyle}>{label}</span>
        {actions}
      </div>
      <span style={{ fontSize: "0.98rem", fontWeight: 600, color: "var(--text-1)" }}>
        {value || "-"}
      </span>
      {helper && <span style={{ fontSize: "0.75rem", color: "var(--text-1)" }}>{helper}</span>}
    </DevLayoutSection>
  );
}

function ActionRow({ children }) {
  return <div style={{ display: "flex", gap: "6px" }}>{children}</div>;
}

function ActionButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 8px",
        borderRadius: "var(--radius-pill)",
        border: "none",
        background: "transparent",
        color: "var(--primary)",
        fontSize: "0.65rem",
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatHours(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `${value} hrs`;
}

function formatCurrencyValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "-";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatEmploymentTenure(value) {
  const descriptor = describeTenure(value);
  return descriptor ? `${descriptor} tenure` : "Tenure not available";
}

function describeTenure(value) {
  if (!value) return null;
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  let totalMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (totalMonths < 0) totalMonths = 0;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} yr${years > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} mo${months > 1 ? "s" : ""}`);
  if (!parts.length) return "Less than a month";
  return parts.join(" ");
}

function formatProbationStatus(value) {
  if (!value) return "Probation end date not set";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "Probation end date not set";
  const now = new Date();
  const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Completed";
  return `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}
