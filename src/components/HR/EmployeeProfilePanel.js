// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/HR/EmployeeProfilePanel.js
import React from "react";
import { SectionCard, StatusTag } from "@/components/HR/MetricCard";

export default function EmployeeProfilePanel({ employee }) {
  if (!employee) {
    return (
      <SectionCard title="Employee Profile" subtitle="Select an employee to view their profile.">
        <div style={{ color: "var(--info)", fontSize: "0.9rem" }}>
          Employee details, documents, and employment information will appear here.
        </div>
      </SectionCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <SectionCard
        title={employee.name}
        subtitle={`${employee.jobTitle} • ${employee.department}`}
        action={<StatusTag label={employee.status} tone={employee.status === "Active" ? "success" : "default"} />}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
          <ProfileItem label="Role" value={employee.role} />
          <ProfileItem label="Employment Type" value={employee.employmentType} />
          <ProfileItem label="Start Date" value={formatDate(employee.startDate)} />
          <ProfileItem label="Probation End" value={formatDate(employee.probationEnd)} />
          <ProfileItem label="Contracted Hours" value={`${employee.contractedHours} hrs`} />
          <ProfileItem label="Hourly Rate" value={`£${employee.hourlyRate.toFixed(2)}`} />
          <ProfileItem label="Keycloak ID" value={employee.keycloakId} />
        </div>
      </SectionCard>

      <SectionCard title="Contact Information">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <ProfileItem label="Email" value={employee.email} />
          <ProfileItem label="Phone" value={employee.phone} />
          <ProfileItem label="Emergency Contact" value={employee.emergencyContact} />
        </div>
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>Address</span>
          <span style={{ color: "var(--info-dark)" }}>{employee.address}</span>
        </div>
      </SectionCard>

      <SectionCard
        title="Documents"
        subtitle="Contracts, licences, training certificates and other uploads"
        action={
          <button
            type="button"
            style={{
              padding: "8px 14px",
              borderRadius: "999px",
              border: "1px solid var(--accent-purple)",
              background: "white",
              color: "var(--accent-purple)",
              fontWeight: 600,
              fontSize: "0.8rem",
            }}
          >
            Upload document
          </button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {employee.documents?.map((doc) => (
            <div
              key={doc.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: "12px",
                border: "1px solid var(--accent-purple-surface)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{doc.name}</span>
                <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>
                  {doc.type} • Uploaded {formatDate(doc.uploadedOn)}
                </span>
              </div>
              <button
                type="button"
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--info)",
                  background: "white",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                }}
              >
                View
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function ProfileItem({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--info)", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "var(--info-dark)", fontWeight: 600 }}>{value || "—"}</span>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}
