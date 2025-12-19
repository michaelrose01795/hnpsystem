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

      <div className="pt-3 border-t border-[var(--surface-light)] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Employment Details</h3>
            <p className="text-sm font-semibold text-slate-500 mt-1">Role, tenure, and compensation at a glance:</p>
          </div>
          <InfoChip label={employee.keycloakId ? `Keycloak • ${employee.keycloakId}` : "Keycloak ID not set"} />
        </div>

        <div className="grid gap-4">
          <section className="rounded-2xl border border-[var(--surface-light)] bg-white p-5 space-y-4">
            <h4 className="text-sm font-semibold text-slate-900">Role & Access</h4>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xl font-semibold text-slate-900">{employee.jobTitle || "—"}</p>
                <p className="text-sm text-slate-500">{employee.department || "Department not set"}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <InfoChip label={employee.employmentType || "Employment type"} tone="solid" />
                <InfoChip label={employee.role || "Role not assigned"} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileItem label="Role (Permissions)" value={employee.role} />
              <ProfileItem label="Keycloak ID" value={employee.keycloakId} />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--surface-light)] bg-white p-5 space-y-4">
            <h4 className="text-sm font-semibold text-slate-900">Tenure & Probation</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <TimelineCard
                label="Start Date"
                value={formatDate(employee.startDate)}
                helper={formatEmploymentTenure(employee.startDate)}
              />
              <TimelineCard
                label="Probation"
                value={formatDate(employee.probationEnd)}
                helper={employee.probationEnd ? formatRelativeDate(employee.probationEnd) : "Probation end date not set"}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--surface-light)] bg-white p-5 space-y-4">
            <h4 className="text-sm font-semibold text-slate-900">Compensation & Hours</h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailStat label="Contracted Hours" value={formatHours(employee.contractedHours)} helper="Per week" />
              <DetailStat label="Hourly Rate" value={formatCurrencyValue(employee.hourlyRate)} helper="Base rate" />
              <DetailStat label="Annual Salary" value={formatCurrencyValue(employee.annualSalary)} helper="If applicable" />
            </div>
          </section>
        </div>
      </div>

      <section className="pt-3 border-t border-[var(--surface-light)] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Contact Information</h3>
            <p className="text-sm font-semibold text-slate-500 mt-1">Primary communication details:</p>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--surface-light)] bg-white p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileItem label="Email" value={employee.email} />
            <ProfileItem label="Phone" value={employee.phone} />
            <ProfileItem label="Emergency Contact" value={employee.emergencyContact} />
            <ProfileItem label="Address" value={employee.address} />
          </div>
        </div>
      </section>

      <section className="pt-3 border-t border-[var(--surface-light)] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Documents</h3>
            <p className="text-sm font-semibold text-slate-500 mt-1">Contracts, licences, training certificates:</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-[var(--accent-purple)] bg-white px-3 py-1 text-xs font-semibold text-[var(--accent-purple)] hover:border-[var(--primary-dark)]"
          >
            Upload document
          </button>
        </div>
        <div className="rounded-2xl border border-[var(--surface-light)] bg-white p-4 space-y-3">
          {employee.documents?.length > 0 ? (
            employee.documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{doc.name}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    Type: {doc.type} • Uploaded {formatDate(doc.uploadedOn)}
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
      </section>
    </div>
  );
}

function ProfileItem({ label, value }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-slate-900 tracking-wide">{label}:</span>
      <span className="text-sm font-semibold text-slate-900">{value || "—"}</span>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function InfoChip({ label, tone = "outline" }) {
  const baseClasses =
    "rounded-full px-3 py-1 text-[0.7rem] tracking-wide uppercase border font-semibold";
  const variant =
    tone === "solid"
      ? "bg-[var(--accent-purple)] text-white border-[var(--accent-purple)]"
      : "bg-[var(--surface-light)] border-[var(--surface-light)] text-[var(--info-dark)]";
  return <span className={`${baseClasses} ${variant}`}>{label}</span>;
}

function TimelineCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-[var(--surface-light)] bg-[var(--surface-light)] p-4 space-y-2">
      <p className="text-xs font-semibold text-slate-900 tracking-wide">{label}:</p>
      <p className="text-lg font-semibold text-slate-900">{value || "—"}</p>
      <p className="text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function DetailStat({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-[var(--surface-light)] bg-white p-4 space-y-2">
      <p className="text-xs font-semibold text-slate-900 tracking-wide">{label}:</p>
      <p className="text-lg font-semibold text-slate-900">{value || "—"}</p>
      {helper && <p className="text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

function formatHours(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${value} hrs`;
}

function formatCurrencyValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "—";
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

function formatRelativeDate(value) {
  if (!value) return "—";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "—";
  const now = new Date();
  const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Scheduled for today";
  if (diffDays > 0) return `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  const pastDays = Math.abs(diffDays);
  return `Completed ${pastDays} day${pastDays === 1 ? "" : "s"} ago`;
}
