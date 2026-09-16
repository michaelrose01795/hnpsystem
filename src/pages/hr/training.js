// file location: src/pages/hr/training.js
import React from "react";
import { useHrOperationsData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { Button, LayerSurface, StatusMessage } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { StatusTag } from "@/components/HR/MetricCard";
import { CalendarField } from "@/components/ui/calendarAPI";
import { SkeletonTableRow, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { hrPresentationData } from "@/features/presentation/mockData/hr_operations";
import { redirectToHrManagerTab } from "@/lib/hr/hrManagerRoutes";
import DataTableShell from "@/components/ui/DataTableShell"; // canonical table scroll shell (CLAUDE.md §3.4)
import EmptyState from "@/components/ui/EmptyState"; // canonical empty-state primitive
import HrSummaryStrip from "@/components/HR/HrSummaryStrip"; // shared at-a-glance metric strip
import { buildTrainingSummary } from "@/lib/hr/hrTabSummaries";

export function getServerSideProps() {
  return redirectToHrManagerTab("training");
}

// Skeleton rows shown inside the Upcoming Expiries table while training data
// loads. Keeps the outer page shell + header + assign-training form mounted so
// the first visible frame matches the final layout.
import HrTrainingQualificationsUi from "@/components/page-ui/hr/hr-training-ui"; // Extracted presentation layer.
function TableRowsSkeleton({ rows = 5, cols = 4 }) {return (
    <>
      {Array.from({ length: rows }).map((_, i) =>
      <SkeletonTableRow key={i} cols={cols} />
      )}
    </>);

}

function TrainingContent() {
  const { data, isLoading, error } = useHrOperationsData();
  const trainingRenewals = data?.trainingRenewals ?? [];
  const employeeDirectory = data?.employeeDirectory ?? [];
  const trainingCourses = data?.trainingCourses ?? [];
  const showPresentationMock = isPresentationMode();

  // Everything expiring inside the 90-day renewal horizon, split by urgency so
  // the lapsed and nearly-lapsed certificates are impossible to miss.
  const summary = buildTrainingSummary({ trainingRenewals });

  if (error) {
    return (
      <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
        <SectionCard layer="theme"
          sectionKey="hr-training-error" parentKey="hr-manager-tab-training" title="Unable to load training data" subtitle="Mock API returned an error.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>
      </div>);

  }

  const employeeOptions = employeeDirectory.map((employee) => ({
    value: employee.id,
    label: employee.name
  }));

  const courseOptions = trainingCourses.map((course) => ({
    value: course.courseId,
    label: course.title,
    description: course.category || undefined
  }));

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <SkeletonKeyframes />
      <header>
        <p style={{ color: "var(--text-1)", marginTop: "var(--space-1)" }}>
          Monitor mandatory training, certificate uploads, and renewal reminders.
        </p>
      </header>

      {isLoading ? null : <HrSummaryStrip items={summary} parentKey="hr-manager-tab-training" />}

      <SectionCard layer="theme"
        sectionKey="hr-training-upcoming-expiries" parentKey="hr-manager-tab-training"
        title="Upcoming Expiries"
        subtitle="Renew before certificates lapse"
        action={
        <Button variant="primary" size="sm">
            Notify employees
          </Button>
        }>
        
        <LayerSurface padding="var(--space-3)" gap="0">
          <DataTableShell>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Employee</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ?
                <TableRowsSkeleton rows={5} cols={4} /> :

                trainingRenewals.length === 0 ?
                <tr>
                  <td colSpan={4}>
                    <EmptyState variant="bare" icon="🎓" title="No renewals due" description="Certifications falling due in the next 90 days appear here." />
                  </td>
                </tr> :

                trainingRenewals.map((record) => {
                  const tone =
                  record.status === "Overdue" ? "danger" : record.status === "Due Soon" ? "warning" : "default";
                  return (
                    <tr key={record.id}>
                        <td style={{ fontWeight: 600 }}>{record.course}</td>
                        <td>{record.employee}</td>
                        <td>{new Date(record.dueDate).toLocaleDateString()}</td>
                        <td>
                          <StatusTag label={record.status} tone={tone} />
                        </td>
                      </tr>);

                })
                }
              </tbody>
            </table>
          </DataTableShell>
        </LayerSurface>
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-training-catalogue" parentKey="hr-manager-tab-training"
        title="Training Catalogue"
        subtitle="Courses available to assign">
        
        {showPresentationMock ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Duration</th>
                    <th>Mandatory For</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hrPresentationData.trainingCatalogue.map((course) => (
                    <tr key={course.id}>
                      <td style={{ fontWeight: 600 }}>{course.title}</td>
                      <td>{course.duration}</td>
                      <td>{course.mandatory}</td>
                      <td>{course.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </LayerSurface>
        ) : trainingCourses.length ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Category</th>
                    <th>Renewal</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingCourses.map((course) => (
                    <tr key={course.courseId}>
                      <td style={{ fontWeight: 600 }}>{course.title}</td>
                      <td>{course.category || "General"}</td>
                      <td>
                        {course.renewalIntervalMonths
                          ? `Every ${course.renewalIntervalMonths} months`
                          : "No renewal"}
                      </td>
                      <td>{course.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </LayerSurface>
        ) : isLoading ? null : (
          <EmptyState
            icon="🎓"
            title="No courses in the catalogue"
            description="Courses appear here with their category and how often they need renewing."
          />
        )}
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-training-assign-training" parentKey="hr-manager-tab-training" title="Assign Training" subtitle="Send employees on mandatory or optional courses.">
        <form
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--space-md)"
          }}>
          
          <DropdownField
            label="Employee"
            name="employee"
            placeholder="Choose employee"
            defaultValue=""
            options={employeeOptions} />
          
          <DropdownField
            label="Training Course"
            name="course"
            placeholder="Select course"
            defaultValue=""
            disabled={courseOptions.length === 0}
            options={courseOptions} />
          
          <CalendarField label="Due Date" name="dueDate" id="dueDate" />
          <label style={labelStyle}>
            <span>Notes for employee</span>
            <textarea
              className="app-input"
              style={{ minHeight: "120px", resize: "vertical" }}
              placeholder="Provide additional guidance or pre-reading" />
            
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "var(--space-3)" }}>
            <Button type="button" variant="primary">
              Assign training
            </Button>
            <Button type="button" variant="ghost">
              Attach supporting file
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-training-compliance-snapshot" parentKey="hr-manager-tab-training" title="Training Compliance Snapshot" subtitle="High-level view of overall compliance rates.">
        {showPresentationMock ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Compliance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hrPresentationData.trainingCompliance.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600 }}>{row.department}</td>
                      <td>{row.compliance}%</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </LayerSurface>
        ) : (
          <EmptyState
            icon="📈"
            title="No compliance data yet"
            description="Completion rates per department appear here once training records are recorded against employees."
          />
        )}
      </SectionCard>
    </div>);

}

export default function HrTrainingQualifications() {
  return <HrTrainingQualificationsUi view="section1" TrainingContent={TrainingContent} />;
}

// Local textarea label — InputField covers input/select fields, but no global textarea component exists yet.
const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-xs)",
  color: "var(--text-1)",
  fontSize: "var(--text-label)",
  fontWeight: "var(--control-label-weight)",
  textTransform: "uppercase",
  letterSpacing: "var(--tracking-caps)",
  gridColumn: "1 / -1"
};
