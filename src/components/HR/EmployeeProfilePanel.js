// file location: src/components/HR/EmployeeProfilePanel.js
// Right-hand employee detail panel for the HR Manager > Employees tab.
//
// Layout contract (CLAUDE.md §3.0 / §3.0a-2):
//   .hr-employees-detail-panel (structural, transparent)
//     <LayerTheme>  .hr-employee-profile-panel   -- its own scroll container
//       <LayerSurface> sticky header card
//       <LayerSurface> section cards (two columns once the panel is wide)
//         <LayerTheme> nested stat tiles inside those cards
//
// All appearance lives in the `.hr-employee-*` rules in staffglobal.css — this
// file carries no one-off visual styling.
import React, { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useUser } from "@/context/UserContext";
import { canViewSensitiveHrDetails, normalizeRoles } from "@/lib/auth/roles";
import { StatusTag } from "@/components/HR/MetricCard";
import DocumentsUploadPopup from "@/components/popups/DocumentsUploadPopup";
import DataTableShell from "@/components/ui/DataTableShell";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import { resolveDocumentCategory, resolveDocumentStatus } from "@/lib/hr/employeeDocuments";
import { logFailure } from "@/lib/utils/logFailure";

const NOT_PROVIDED = /^(not provided|n\/a|none)$/i;

export default function EmployeeProfilePanel({
  employee,
  onEdit,
  onSelectEmployee = null,
  resolveEmployeeByUserId = null,
}) {
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false);
  const { data: session } = useSession();
  const { user } = useUser();

  // Pay, home address, emergency contacts and HR documents are gated through the
  // existing role system rather than a panel-local rule (src/lib/auth/roles.js).
  const canViewSensitive = useMemo(
    () => canViewSensitiveHrDetails(normalizeRoles(session?.user?.roles || user?.roles || [])),
    [session?.user?.roles, user?.roles]
  );

  const lineManagers = useMemo(() => {
    if (!employee?.lineManagers?.length) return [];
    return employee.lineManagers.map((manager) => {
      const match = resolveEmployeeByUserId ? resolveEmployeeByUserId(manager.userId) : null;
      return {
        userId: manager.userId,
        name: match?.name || manager.name,
        description: match ? [match.jobTitle, match.department].filter(Boolean).join(" · ") : "",
        selectable: Boolean(match && onSelectEmployee),
      };
    });
  }, [employee?.lineManagers, resolveEmployeeByUserId, onSelectEmployee]);

  const emergency = useMemo(
    () => parseEmergencyContact(employee?.emergencyContact),
    [employee?.emergencyContact]
  );

  const documents = useMemo(() => employee?.documents || [], [employee?.documents]);

  // Category / Status / Expiry only earn a column when the stored records
  // actually carry that information.
  const documentColumns = useMemo(() => {
    const now = new Date();
    return {
      category: documents.some((doc) => resolveDocumentCategory(doc)),
      status: documents.some((doc) => resolveDocumentStatus(doc, now)),
      expires: documents.some((doc) => doc.expiresOn),
    };
  }, [documents]);

  if (!employee) {
    return (
      <LayerTheme
        sectionKey="hr-employee-profile-panel"
        parentKey="hr-employees-detail-panel"
        sectionType="section-shell"
        shell
        disableFallback
        className="hr-employee-profile-panel hr-employee-profile-panel--empty"
      >
        <p className="hr-employee-empty-title">Employee Profile</p>
        <p className="hr-employee-empty-copy">
          Select an employee from the directory to view their profile. Role, employment, pay,
          contact details and documents appear here.
        </p>
      </LayerTheme>
    );
  }

  const displayName =
    employee.name ||
    employee.fullName ||
    [employee.firstName, employee.lastName].filter(Boolean).join(" ") ||
    "Employee";

  // Status, job title and department already lead the header, so the chip row
  // only carries what is not shown above it.
  const chips = [
    employee.employmentType,
    employee.contractedHours ? `${employee.contractedHours} hrs / week` : null,
    employee.startDate ? `Started ${formatDate(employee.startDate)}` : null,
    describeTenure(employee.startDate),
  ].filter(Boolean);

  const handleCopy = async (value) => {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      logFailure("Copy failed", err);
    }
  };

  const email = cleanValue(employee.email);
  const phone = cleanValue(employee.phone);
  const address = cleanValue(employee.address);
  const phoneWithExtension = employee.extension && phone ? `${phone} ext. ${employee.extension}` : phone;

  return (
    <LayerTheme
      sectionKey="hr-employee-profile-panel"
      parentKey="hr-employees-detail-panel"
      sectionType="section-shell"
      shell
      disableFallback
      className="hr-employee-profile-panel"
      radius="var(--radius-md)"
      padding="0"
      gap="0"
    >
      <LayerSurface
        sectionKey="hr-employee-profile-header"
        parentKey="hr-employee-profile-panel"
        sectionType="content-card"
        className="hr-employee-profile-header-card"
        radius="var(--radius-md) var(--radius-md) 0 0"
        padding="var(--space-4) var(--space-5)"
        gap="var(--space-2)"
      >
        <div className="hr-employee-profile-identity">
          <span className="hr-employee-profile-avatar" aria-hidden="true">
            {buildInitials(displayName)}
          </span>
          <div className="hr-employee-profile-names">
            <h2 className="hr-employee-profile-name">{displayName}</h2>
            <p className="hr-employee-profile-meta">
              <span className="hr-employee-profile-job-title">{employee.jobTitle || "Job title"}</span>
              <span className="hr-employee-profile-meta-divider" aria-hidden="true" />
              <span className="hr-employee-profile-department">{employee.department || "Department"}</span>
            </p>
          </div>
          <div className="hr-employee-profile-header-actions">
            <StatusTag
              label={employee.status || "Unknown"}
              tone={employee.status === "Active" ? "success" : "warning"}
            />
            <Button type="button" variant="ghost" size="sm" onClick={onEdit} disabled={!onEdit}>
              Edit details
            </Button>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="hr-employee-profile-chips">
            {chips.map((chip) => (
              <span key={chip} className="hr-employee-chip">
                {chip}
              </span>
            ))}
          </div>
        )}
      </LayerSurface>

      <DevLayoutSection
        as="section"
        sectionKey="hr-employee-profile-sections"
        parentKey="hr-employee-profile-panel"
        sectionType="section-shell"
        className="hr-employee-profile-sections"
      >
        <CardBlock
          title="Role & Access"
          subtitle="What this person does, and what the system lets them do."
          sectionKey="hr-employee-role-access"
        >
          <div className="hr-employee-field-grid">
            <KeyValue
              label="Job Title"
              value={employee.jobTitle}
              helper="Position held"
              sectionKey="hr-employee-job-title"
              parentKey="hr-employee-role-access"
            />
            <KeyValue
              label="Department"
              value={employee.department}
              helper="Reporting area"
              sectionKey="hr-employee-department"
              parentKey="hr-employee-role-access"
            />
            <KeyValue
              label="System Role"
              value={employee.role}
              helper="Drives permissions, not job title"
              sectionKey="hr-employee-role"
              parentKey="hr-employee-role-access"
            />
            <KeyValue
              label="Sidebar Access"
              value={employee.sidebarAccess ? "Custom override" : "Role default"}
              helper="Managed from Edit details"
              sectionKey="hr-employee-sidebar-access"
              parentKey="hr-employee-role-access"
            />
          </div>

          <DevLayoutSection
            as="div"
            sectionKey="hr-employee-line-managers"
            parentKey="hr-employee-role-access"
            sectionType="content-card"
            className="hr-employee-key-value hr-employee-key-value--wide"
          >
            <div className="hr-employee-key-value-head">
              <span className="hr-employee-label">Line Manager</span>
              {onEdit && (
                <Button type="button" variant="ghost" size="xxs" pill onClick={onEdit}>
                  {lineManagers.length ? "Change" : "Assign"}
                </Button>
              )}
            </div>
            {lineManagers.length ? (
              <div className="hr-employee-manager-list">
                {lineManagers.map((manager) =>
                  manager.selectable ? (
                    <button
                      key={manager.userId}
                      type="button"
                      className="hr-employee-manager-link"
                      onClick={() => onSelectEmployee(manager.userId)}
                      title={`Open the profile for ${manager.name}`}
                    >
                      <span className="hr-employee-manager-name">{manager.name}</span>
                      {manager.description && (
                        <span className="hr-employee-manager-meta">{manager.description}</span>
                      )}
                    </button>
                  ) : (
                    <span key={manager.userId} className="hr-employee-manager-static">
                      <span className="hr-employee-manager-name">{manager.name}</span>
                    </span>
                  )
                )}
              </div>
            ) : (
              <span className="hr-employee-value hr-employee-value--muted">Not assigned</span>
            )}
          </DevLayoutSection>
        </CardBlock>

        <CardBlock
          title="Employment"
          subtitle="Contract, service and probation."
          sectionKey="hr-employee-employment"
        >
          <div className="hr-employee-field-grid">
            <KeyValue
              label="Employment Type"
              value={employee.employmentType}
              sectionKey="hr-employee-employment-type"
              parentKey="hr-employee-employment"
            />
            <KeyValue
              label="Employment Status"
              value={employee.status}
              sectionKey="hr-employee-employment-status"
              parentKey="hr-employee-employment"
            />
            <KeyValue
              label="Start Date"
              value={formatDate(employee.startDate)}
              helper={formatEmploymentTenure(employee.startDate)}
              sectionKey="hr-employee-start-date"
              parentKey="hr-employee-employment"
            />
            <KeyValue
              label="Probation End"
              value={formatDate(employee.probationEnd)}
              helper={formatProbationStatus(employee.probationEnd)}
              sectionKey="hr-employee-probation-end"
              parentKey="hr-employee-employment"
            />
          </div>
        </CardBlock>


        <CardBlock
          title="Contact Information"
          subtitle="How to reach this employee."
          sectionKey="hr-employee-contact-information"
        >
          <div className="hr-employee-contact-list">
            <ContactRow
              label="Email"
              value={email}
              sectionKey="hr-employee-email"
              actions={
                email ? (
                  <>
                    <ActionButton onClick={() => handleCopy(email)}>Copy</ActionButton>
                    <ActionLink href={`mailto:${email}`}>Email</ActionLink>
                  </>
                ) : null
              }
            />
            <ContactRow
              label="Phone"
              value={phoneWithExtension}
              sectionKey="hr-employee-phone"
              actions={
                phone ? (
                  <>
                    <ActionButton onClick={() => handleCopy(phone)}>Copy</ActionButton>
                    <ActionLink href={`tel:${sanitizeTel(phone)}`}>Call</ActionLink>
                  </>
                ) : null
              }
            />
            {canViewSensitive ? (
              <ContactRow
                label="Home Address"
                value={address}
                multiline
                sectionKey="hr-employee-address"
                actions={address ? <ActionButton onClick={() => handleCopy(address)}>Copy</ActionButton> : null}
              />
            ) : (
              <ContactRow label="Home Address" value="" restricted sectionKey="hr-employee-address" />
            )}
          </div>
        </CardBlock>

        {canViewSensitive ? (
          <CardBlock
            title="Emergency Contact"
            subtitle="Who to call in an emergency."
            sectionKey="hr-employee-emergency"
          >
            {emergency ? (
              <div className="hr-employee-contact-list">
                <ContactRow
                  label="Contact"
                  value={emergency.name || emergency.raw}
                  helper={emergency.relationship || undefined}
                  sectionKey="hr-employee-emergency-contact"
                  actions={<ActionButton onClick={() => handleCopy(emergency.raw)}>Copy</ActionButton>}
                />
                {emergency.phone && (
                  <ContactRow
                    label="Emergency Phone"
                    value={emergency.phone}
                    sectionKey="hr-employee-emergency-phone"
                    actions={
                      <>
                        <ActionButton onClick={() => handleCopy(emergency.phone)}>Copy</ActionButton>
                        <ActionLink href={`tel:${sanitizeTel(emergency.phone)}`}>Call</ActionLink>
                      </>
                    }
                  />
                )}
              </div>
            ) : (
              <div className="hr-employee-empty-block">
                No emergency contact recorded. Add one from Edit details.
              </div>
            )}
          </CardBlock>
        ) : (
          <RestrictedBlock title="Emergency Contact" sectionKey="hr-employee-emergency" />
        )}

        {canViewSensitive ? (
          <CardBlock
            title="Pay & Hours"
            subtitle="Salary, rates and payroll references."
            fullWidth
            sectionKey="hr-employee-pay-hours"
          >
            <div className="hr-employee-pay-layout">
              <LayerTheme
                sectionKey="hr-employee-basic-salary"
                parentKey="hr-employee-pay-hours"
                sectionType="stat-card"
                className="hr-employee-stat-card"
                radius="var(--radius-sm)"
                padding="var(--space-3) var(--space-4)"
                gap="var(--space-1)"
              >
                <span className="hr-employee-label">Basic Salary</span>
                <span className="hr-employee-stat-value">{formatCurrencyValue(employee.annualSalary)}</span>
                <span className="hr-employee-helper">Contracted hours × hourly rate</span>
              </LayerTheme>
              <div className="hr-employee-field-grid">
                <KeyValue
                  label="Hourly Rate"
                  value={formatCurrencyValue(employee.hourlyRate)}
                  helper="Base rate"
                  sectionKey="hr-employee-hourly-rate"
                  parentKey="hr-employee-pay-hours"
                />
                <KeyValue
                  label="Overtime Rate"
                  value={formatCurrencyValue(employee.overtimeRate)}
                  helper="Per overtime hour"
                  sectionKey="hr-employee-overtime-rate"
                  parentKey="hr-employee-pay-hours"
                />
                <KeyValue
                  label="Contracted Hours"
                  value={formatHours(employee.contractedHours)}
                  helper="Per week"
                  sectionKey="hr-employee-contracted-hours"
                  parentKey="hr-employee-pay-hours"
                />
                <KeyValue
                  label="Payroll Reference"
                  value={employee.payrollNumber}
                  sectionKey="hr-employee-payroll-reference"
                  parentKey="hr-employee-pay-hours"
                />
                <KeyValue
                  label="National Insurance"
                  value={employee.nationalInsurance}
                  sectionKey="hr-employee-national-insurance"
                  parentKey="hr-employee-pay-hours"
                />
              </div>
            </div>
          </CardBlock>
        ) : (
          <RestrictedBlock title="Pay & Hours" fullWidth sectionKey="hr-employee-pay-hours" />
        )}

        {canViewSensitive ? (
          <CardBlock
            title="Documents"
            subtitle={documents.length ? `${documents.length} on file` : "Nothing on file yet"}
            fullWidth
            sectionKey="hr-employee-documents"
            action={
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowDocumentsPopup(true)}>
                Upload document
              </Button>
            }
          >
            {documents.length > 0 ? (
              <DataTableShell visibleRows={6}>
                <DevLayoutSection
                  as="table"
                  sectionKey="hr-employee-documents-list"
                  parentKey="hr-employee-documents"
                  sectionType="data-table"
                  backgroundToken="surface"
                  className="app-data-table hr-employee-documents-table"
                >
                  <DevLayoutSection
                    as="thead"
                    sectionKey="hr-employee-documents-headings"
                    parentKey="hr-employee-documents-list"
                    sectionType="table-headings"
                  >
                    <tr>
                      <th scope="col" data-doc-col="name">
                        Document
                      </th>
                      {documentColumns.category && (
                        <th scope="col" data-doc-col="category" data-table-cell="nowrap">
                          Category
                        </th>
                      )}
                      {documentColumns.status && (
                        <th scope="col" data-doc-col="status" data-table-cell="nowrap">
                          Status
                        </th>
                      )}
                      <th scope="col" data-doc-col="uploaded" data-table-cell="nowrap">
                        Uploaded
                      </th>
                      {documentColumns.expires && (
                        <th scope="col" data-doc-col="expires" data-table-cell="nowrap">
                          Expires
                        </th>
                      )}
                      <th scope="col" data-doc-col="actions" data-table-cell="nowrap">
                        Actions
                      </th>
                    </tr>
                  </DevLayoutSection>
                  <tbody>
                    {documents.map((doc, index) => {
                      const status = resolveDocumentStatus(doc);
                      return (
                        <DevLayoutSection
                          as="tr"
                          key={doc.id || index}
                          sectionKey={`hr-employee-document-${doc.id || index + 1}`}
                          parentKey="hr-employee-documents-list"
                          sectionType="table-row"
                        >
                          <td data-doc-col="name">{doc.name || "-"}</td>
                          {documentColumns.category && (
                            <td data-doc-col="category" data-table-cell="nowrap">
                              {resolveDocumentCategory(doc) || "-"}
                            </td>
                          )}
                          {documentColumns.status && (
                            <td data-doc-col="status" data-table-cell="nowrap">
                              {status ? <StatusTag label={status.label} tone={status.tone} /> : "-"}
                            </td>
                          )}
                          <td data-doc-col="uploaded" data-table-cell="nowrap">
                            {formatDate(doc.uploadedOn)}
                          </td>
                          {documentColumns.expires && (
                            <td data-doc-col="expires" data-table-cell="nowrap">
                              {formatDate(doc.expiresOn)}
                            </td>
                          )}
                          <td data-doc-col="actions" data-table-cell="nowrap">
                            {doc.url ? (
                              <a
                                className="app-table-action-btn"
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View
                              </a>
                            ) : (
                              <button type="button" className="app-table-action-btn" disabled>
                                View
                              </button>
                            )}
                          </td>
                        </DevLayoutSection>
                      );
                    })}
                  </tbody>
                </DevLayoutSection>
              </DataTableShell>
            ) : (
              <DevLayoutSection
                as="div"
                sectionKey="hr-employee-documents-empty"
                parentKey="hr-employee-documents"
                sectionType="content-card"
                className="hr-employee-empty-block"
              >
                No documents uploaded yet.
              </DevLayoutSection>
            )}
          </CardBlock>
        ) : (
          <RestrictedBlock title="Documents" fullWidth sectionKey="hr-employee-documents" />
        )}
      </DevLayoutSection>

      <DocumentsUploadPopup
        open={showDocumentsPopup}
        onClose={() => setShowDocumentsPopup(false)}
        jobId={null}
        userId={employee?.userId || null}
      />
    </LayerTheme>
  );
}

function CardBlock({ title, subtitle, action = null, children, sectionKey, fullWidth = false }) {
  return (
    <LayerSurface
      as="section"
      sectionKey={sectionKey}
      parentKey="hr-employee-profile-sections"
      sectionType="content-card"
      className={`hr-employee-card-block${fullWidth ? " hr-employee-card-block--full" : ""}`}
      radius="var(--radius-md)"
      padding="var(--space-4)"
      gap="var(--space-3)"
    >
      <div className="hr-employee-card-head">
        <div className="hr-employee-card-heading">
          <h3 className="hr-employee-card-title">{title}</h3>
          {subtitle && <p className="hr-employee-card-subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </LayerSurface>
  );
}

// Stands in for a gated card so the shape of the record — and the fact that the
// section exists — stays visible without leaking any of the values.
function RestrictedBlock({ title, sectionKey, fullWidth = false }) {
  return (
    <CardBlock title={title} sectionKey={sectionKey} fullWidth={fullWidth}>
      <div className="hr-employee-empty-block">Restricted — your role cannot view this section.</div>
    </CardBlock>
  );
}

function KeyValue({ label, value, helper, sectionKey, parentKey }) {
  return (
    <DevLayoutSection
      as="div"
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      className="hr-employee-key-value"
    >
      <span className="hr-employee-label">{label}</span>
      <span className="hr-employee-value">{cleanValue(value) || "-"}</span>
      {helper && <span className="hr-employee-helper">{helper}</span>}
    </DevLayoutSection>
  );
}

// Contact rows keep the label and its actions on one line and give the value a
// full-width line of its own, so long emails and addresses never have to wrap
// mid-word beside a button.
function ContactRow({ label, value, helper, actions, multiline = false, restricted = false, sectionKey }) {
  const valueClassName = [
    "hr-employee-value",
    "hr-employee-contact-value",
    multiline ? "hr-employee-contact-value--multiline" : "",
    restricted || !value ? "hr-employee-value--muted" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <DevLayoutSection
      as="div"
      sectionKey={sectionKey}
      parentKey="hr-employee-contact-information"
      sectionType="content-card"
      className="hr-employee-contact-row"
    >
      <div className="hr-employee-key-value-head">
        <span className="hr-employee-label">{label}</span>
        {actions ? <span className="hr-employee-action-row">{actions}</span> : null}
      </div>
      <span className={valueClassName}>{restricted ? "Restricted" : value || "Not provided"}</span>
      {helper && <span className="hr-employee-helper">{helper}</span>}
    </DevLayoutSection>
  );
}

function ActionButton({ children, onClick }) {
  return (
    <Button type="button" variant="ghost" size="xxs" pill onClick={onClick}>
      {children}
    </Button>
  );
}

// Anchor rather than <Button> because mailto: / tel: need a real link, but it
// wears the same ghost button classes so it matches the Copy control beside it.
function ActionLink({ children, href }) {
  return (
    <a className="app-btn app-btn--ghost app-btn--xxs app-btn--pill" href={href}>
      {children}
    </a>
  );
}

function cleanValue(value) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  if (!text || NOT_PROVIDED.test(text)) return "";
  return text;
}

function buildInitials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function sanitizeTel(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

// The directory flattens the emergency contact into one "name, phone,
// relationship" string, so split it back out for the Call action. Anything that
// does not match keeps its original text as the contact name.
function parseEmergencyContact(value) {
  const raw = cleanValue(value);
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const phone = parts.find((part) => sanitizeTel(part).replace(/\D/g, "").length >= 6) || "";
  const rest = parts.filter((part) => part !== phone);
  return {
    raw,
    name: rest[0] || "",
    relationship: rest.slice(1).join(", "),
    phone,
  };
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
