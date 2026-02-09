// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/HR/EmployeeProfilePanel.js
import React, { useEffect, useRef, useState } from "react";
import { StatusTag } from "@/components/HR/MetricCard";
import DocumentsUploadPopup from "@/components/popups/DocumentsUploadPopup";

const panelCardStyle = {
  borderRadius: "18px",
  border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
  background: "var(--surface)",
  padding: "18px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
};

const sectionCardStyle = {
  borderRadius: "18px",
  border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
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
  color: "var(--text-secondary)",
  fontWeight: 600,
};

export default function EmployeeProfilePanel({ employee }) {
  const editButtonRef = useRef(null);
  const editButtonDisplayRef = useRef("");
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const button = Array.from(document.querySelectorAll("button")).find(
      (node) => node?.textContent?.trim() === "Edit employee details"
    );
    if (!button) return undefined;
    editButtonRef.current = button;
    editButtonDisplayRef.current = button.style.display;
    button.style.display = "none";
    return () => {
      button.style.display = editButtonDisplayRef.current || "";
    };
  }, [employee?.id]);

  if (!employee) {
    return (
      <div className="text-center py-8">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--primary)] mb-2">Employee Profile</p>
        <p className="text-sm text-slate-500">Select an employee to view their profile.</p>
        <p className="text-xs text-slate-400 mt-2">
          Employee details, documents, and employment information will appear here.
        </p>
      </div>
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

  const keycloakLabel = employee.keycloakId ? `Keycloak: ${employee.keycloakId}` : "Keycloak ID not set";

  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ ...panelCardStyle, padding: "20px", position: "relative" }}>
        <button
          type="button"
          onClick={() => editButtonRef.current?.click()}
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            padding: "10px 16px",
            borderRadius: "12px",
            border: "1px solid rgba(var(--primary-rgb), 0.4)",
            background: "rgba(var(--primary-rgb), 0.18)",
            fontWeight: 700,
            color: "var(--text-primary)",
            cursor: "pointer",
            boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
          }}
        >
          Edit employee details
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingRight: "160px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <StatusTag label={employee.status} tone={employee.status === "Active" ? "success" : "default"} />
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {employee.jobTitle || "Job title"} - {employee.department || "Department"}
            </p>
          </div>
          <h2 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: "var(--text-primary)" }}>
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
                    borderRadius: "999px",
                    border: "1px solid rgba(var(--primary-rgb), 0.35)",
                    background: "rgba(var(--primary-rgb), 0.08)",
                    color: "var(--text-primary)",
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{keycloakLabel}</span>
            {employee.keycloakId && (
              <button
                type="button"
                onClick={() => handleCopy(employee.keycloakId)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "999px",
                  border: "1px solid rgba(var(--primary-rgb), 0.4)",
                  background: "transparent",
                  color: "var(--primary)",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                aria-label="Copy Keycloak ID"
              >
                Copy
              </button>
            )}
          </div>
        </div>
      </div>

      <section style={{ display: "grid", gap: "16px" }}>
        <CardBlock title="Role & Access" icon="RA">
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <KeyValue label="Role (Permissions)" value={employee.role} />
            <KeyValue label="Keycloak ID" value={employee.keycloakId} />
            <KeyValue label="Job Title" value={employee.jobTitle} />
            <KeyValue label="Department" value={employee.department} />
          </div>
        </CardBlock>

        <CardBlock title="Tenure & Probation" icon="TP">
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <KeyValue
              label="Start Date"
              value={formatDate(employee.startDate)}
              helper={formatEmploymentTenure(employee.startDate)}
            />
            <KeyValue
              label="Probation End"
              value={formatDate(employee.probationEnd)}
              helper={formatProbationStatus(employee.probationEnd)}
            />
          </div>
        </CardBlock>

        <CardBlock title="Compensation & Hours" icon="CH">
          <div style={{ display: "grid", gap: "12px" }}>
            <div
              style={{
                borderRadius: "16px",
                border: "1px solid rgba(var(--primary-rgb), 0.35)",
                background: "linear-gradient(135deg, rgba(var(--primary-rgb), 0.18), rgba(0,0,0,0))",
                padding: "14px",
              }}
            >
              <div style={labelStyle}>Annual Salary</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {formatCurrencyValue(employee.annualSalary)}
              </div>
            </div>
            <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <KeyValue label="Hourly Rate" value={formatCurrencyValue(employee.hourlyRate)} helper="Base rate" />
              <KeyValue label="Contracted Hours" value={formatHours(employee.contractedHours)} helper="Per week" />
            </div>
          </div>
        </CardBlock>

        <CardBlock title="Contact Information" icon="CI">
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <KeyValue
              label="Email"
              value={employee.email}
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

        <CardBlock title="Documents" icon="DOC" action={null}>
          <button
            type="button"
            className="w-full"
            onClick={() => setShowDocumentsPopup(true)}
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(var(--primary-rgb), 0.4)",
              background: "rgba(var(--primary-rgb), 0.12)",
              color: "var(--text-primary)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Upload document
          </button>
          <div style={{ display: "grid", gap: "10px" }}>
            {employee.documents?.length > 0 ? (
              employee.documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    borderRadius: "14px",
                    border: "1px solid rgba(var(--grey-accent-rgb), 0.3)",
                    background: "rgba(var(--grey-accent-rgb), 0.08)",
                    padding: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {doc.name}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      Type: {doc.type} - Uploaded {formatDate(doc.uploadedOn)}
                    </span>
                  </div>
                  <button
                    type="button"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "999px",
                      border: "1px solid rgba(var(--primary-rgb), 0.35)",
                      background: "transparent",
                      color: "var(--primary)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    View
                  </button>
                </div>
              ))
            ) : (
              <div
                style={{
                  borderRadius: "14px",
                  border: "1px dashed rgba(var(--grey-accent-rgb), 0.4)",
                  padding: "14px",
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                }}
              >
                No documents uploaded yet.
              </div>
            )}
          </div>
        </CardBlock>
      </section>

      <DocumentsUploadPopup
        open={showDocumentsPopup}
        onClose={() => setShowDocumentsPopup(false)}
        jobId={null}
        userId={employee?.userId || null}
      />
    </div>
  );
}

function CardBlock({ title, icon, action = null, children }) {
  return (
    <section style={sectionCardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "10px",
              display: "grid",
              placeItems: "center",
              background: "rgba(var(--primary-rgb), 0.15)",
              color: "var(--primary)",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            {icon}
          </span>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function KeyValue({ label, value, helper, actions }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
        <span style={labelStyle}>{label}</span>
        {actions}
      </div>
      <span style={{ fontSize: "0.98rem", fontWeight: 600, color: "var(--text-primary)" }}>
        {value || "-"}
      </span>
      {helper && <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{helper}</span>}
    </div>
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
        borderRadius: "999px",
        border: "1px solid rgba(var(--primary-rgb), 0.35)",
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
