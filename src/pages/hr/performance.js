// file location: src/pages/hr/performance.js
import React from "react";
import { useHrOperationsData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { Button, InputField, StatusMessage } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { StatusTag } from "@/components/HR/MetricCard";
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";

function PerformanceContent() {
  const { data, isLoading, error } = useHrOperationsData();
  const employeeDirectory = data?.employeeDirectory ?? [];
  const performanceReviews = data?.performanceReviews ?? [];

  if (isLoading) {
    return <HrTabLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
        <SectionCard title="Unable to load performance data" subtitle="Mock API returned an error.">
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
          Track reviews, ratings, development plans, and upcoming appraisals.
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
          title="Upcoming Reviews"
          subtitle="Schedule and prepare feedback before the review date"
        >
          <div style={{ overflowX: "auto" }}>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Period</th>
                  <th>Reviewer</th>
                  <th>Next Review</th>
                </tr>
              </thead>
              <tbody>
                {performanceReviews.map((review) => (
                  <tr key={review.id}>
                    <td style={{ fontWeight: 600 }}>{review.employee}</td>
                    <td>{review.period}</td>
                    <td>{review.reviewer}</td>
                    <td>{new Date(review.nextReview).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Development To-Do"
          subtitle="Actions to follow up after reviews"
          action={
            <Button variant="primary" size="sm">
              Add reminder
            </Button>
          }
        >
          <ul
            style={{
              margin: 0,
              paddingLeft: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
            }}
          >
            {performanceReviews.map((review) => (
              <li key={review.id} style={{ color: "var(--text-primary)" }}>
                <strong>{review.employee}:</strong> {review.developmentFocus}
              </li>
            ))}
          </ul>
        </SectionCard>
      </section>

      <SectionCard
        title="Recent Appraisals"
        subtitle="Summary of the last review and ratings"
        action={
          <Button variant="secondary" size="sm">
            Export PDF
          </Button>
        }
      >
        <div style={{ overflowX: "auto" }}>
          <table className="app-data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Overall</th>
                <th>Attendance</th>
                <th>Productivity</th>
                <th>Quality</th>
                <th>Teamwork</th>
                <th>Reviewer</th>
              </tr>
            </thead>
            <tbody>
              {performanceReviews.map((review) => (
                <tr key={review.id}>
                  <td style={{ fontWeight: 600 }}>{review.employee}</td>
                  <td>
                    <StatusTag
                      label={`${review.overall ?? 0}/5`}
                      tone={(review.overall ?? 0) >= 4 ? "success" : "default"}
                    />
                  </td>
                  <td>{review.ratings.attendance}/5</td>
                  <td>{review.ratings.productivity}/5</td>
                  <td>{review.ratings.quality}/5</td>
                  <td>{review.ratings.teamwork}/5</td>
                  <td>{review.reviewer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Create Performance Review"
        subtitle="Kick off a new review cycle or log a mid-year check-in."
      >
        <p style={{ color: "var(--text-primary)", marginBottom: "var(--space-4)" }}>
          Select an employee to start drafting their performance review. You can attach supporting documents and invite
          co-reviewers.
        </p>
        <form
          style={{
            display: "grid",
            gap: "var(--space-md)",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          <DropdownField
            label="Employee"
            name="employee"
            placeholder="Choose employee"
            defaultValue=""
            options={employeeOptions}
          />
          <InputField label="Review Period" type="text" placeholder="e.g., Q2 2024" />
          <InputField label="Reviewer" type="text" placeholder="Name of reviewer" />
          <label style={labelStyle}>
            <span>Summary & Notes</span>
            <textarea
              className="app-input"
              style={{ minHeight: "120px", resize: "vertical" }}
              placeholder="Enter objectives, observations, and feedback"
            />
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "var(--space-3)" }}>
            <Button type="button" variant="primary">
              Save Draft
            </Button>
            <Button type="button" variant="ghost">
              Share with reviewer
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

export default function HrPerformanceAppraisals({ embedded = false } = {}) {
  return <PerformanceContent />;
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
