// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/HR/EmployeeProfilePanel.js
import React from "react";
import { StatusTag } from "@/components/HR/MetricCard";

export default function EmployeeProfilePanel({ employee }) {
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

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusTag label={employee.status} tone={employee.status === "Active" ? "success" : "default"} />
          </div>
        </div>
        <div className="pb-3 border-b border-[var(--surface-light)]">
          <p className="text-sm text-slate-500">{employee.jobTitle} • {employee.department}</p>
        </div>
      </div>

      <div className="pt-3 border-t border-[var(--surface-light)]">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--primary)] font-semibold">Employment Details</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
          <ProfileItem label="Job Title" value={employee.jobTitle} />
          <ProfileItem label="Role (Permissions)" value={employee.role} />
          <ProfileItem label="Employment Type" value={employee.employmentType} />
          <ProfileItem label="Start Date" value={formatDate(employee.startDate)} />
          <ProfileItem label="Probation End" value={formatDate(employee.probationEnd)} />
          <ProfileItem label="Contracted Hours" value={`${employee.contractedHours} hrs`} />
          <ProfileItem label="Hourly Rate" value={`£${employee.hourlyRate.toFixed(2)}`} />
          <ProfileItem label="Keycloak ID" value={employee.keycloakId} />
        </div>
      </div>

      <div className="pt-3 border-t border-[var(--surface-light)] space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--primary)]">Contact Information</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <ProfileItem label="Email" value={employee.email} />
          <ProfileItem label="Phone" value={employee.phone} />
          <ProfileItem label="Emergency Contact" value={employee.emergencyContact} />
        </div>
        <div className="pt-2">
          <ProfileItem label="Address" value={employee.address} />
        </div>
      </div>

      <div className="pt-3 border-t border-[var(--surface-light)] space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--primary)]">Documents</p>
          <button
            type="button"
            className="rounded-full border border-[var(--primary)] bg-white px-3 py-1 text-xs font-semibold text-[var(--primary)] hover:border-[var(--primary-dark)]"
          >
            Upload document
          </button>
        </div>
        <p className="text-xs text-slate-500">Contracts, licences, training certificates and other uploads</p>
        <div className="space-y-2">
          {employee.documents?.length > 0 ? (
            employee.documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-2xl border border-[var(--surface-light)] bg-white p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{doc.name}</p>
                  <p className="text-xs text-slate-500">
                    {doc.type} • Uploaded {formatDate(doc.uploadedOn)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-[var(--surface-light)] px-3 py-1 text-xs font-semibold text-[var(--primary)] hover:border-[var(--primary)]"
                >
                  View
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 py-2">No documents uploaded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileItem({ label, value }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value || "—"}</span>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}
