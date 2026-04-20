// file location: src/pages/hr/training.js
import React from "react";
import { useHrOperationsData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { Button, StatusMessage } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { StatusTag } from "@/components/HR/MetricCard";
import { CalendarField } from "@/components/ui/calendarAPI";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

function TrainingContent() {
  const { data, isLoading, error } = useHrOperationsData();
  const trainingRenewals = data?.trainingRenewals ?? [];
  const employeeDirectory = data?.employeeDirectory ?? [];

  if (isLoading) {
    return <HrTabLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
        <SectionCard title="Unable to load training data" subtitle="Mock API returned an error.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>
      </div>
    );
  }

  const employeeOptions = employeeDirectory.map((employee) => ({
    value: employee.id,
    label: employee.name,
  }));

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
          Monitor mandatory training, certificate uploads, and renewal reminders.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--layout-card-gap)",
        }}
      >
        <SectionCard
          title="Upcoming Expiries"
          subtitle="Renew before certificates lapse"
          action={
            <Button variant="primary" size="sm">
              Notify employees
            </Button>
          }
        >
          <div style={{ overflowX: "auto" }}>
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
                {trainingRenewals.map((record) => {
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Training Catalogue"
          subtitle="Courses available to assign"
        >
          <p style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch course catalogue from LMS/Supabase. Display course name, duration, mandatory flag, and an "Add course" action.
          </p>
        </SectionCard>
      </section>

      <SectionCard title="Assign Training" subtitle="Send employees on mandatory or optional courses.">
        <form
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--space-md)",
          }}
        >
          <DropdownField
            label="Employee"
            name="employee"
            placeholder="Choose employee"
            defaultValue=""
            options={employeeOptions}
          />
          <DropdownField
            label="Training Course"
            name="course"
            placeholder="Select course"
            defaultValue=""
            disabled
            options={[]}
            helperText="Populate course options from the training catalogue database table."
          />
          <CalendarField label="Due Date" name="dueDate" id="dueDate" />
          <label style={labelStyle}>
            <span>Notes for employee</span>
            <textarea
              className="app-input"
              style={{ minHeight: "120px", resize: "vertical" }}
              placeholder="Provide additional guidance or pre-reading"
            />
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

      <SectionCard title="Training Compliance Snapshot" subtitle="High-level view of overall compliance rates.">
        <p style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)", fontStyle: "italic", margin: 0 }}>
          TODO: Calculate compliance percentages per department from Supabase training records. Show percentage cards for each department with on-track/behind status.
        </p>
      </SectionCard>
    </div>
  );
}

export default function HrTrainingQualifications({ embedded = false } = {}) {
  return <TrainingContent />;
}

// Local textarea label — InputField covers input/select fields, but no global textarea component exists yet.
const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-xs)",
  color: "var(--text-secondary)",
  fontSize: "var(--text-label)",
  fontWeight: "var(--control-label-weight)",
  textTransform: "uppercase",
  letterSpacing: "var(--tracking-caps)",
  gridColumn: "1 / -1",
};
