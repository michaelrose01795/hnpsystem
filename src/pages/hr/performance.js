// file location: src/pages/hr/performance.js
import React from "react";
import { useHrOperationsData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section";
import { Button, InputField, LayerSurface, StatusMessage } from "@/components/ui";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { StatusTag } from "@/components/HR/MetricCard";
import { SkeletonBlock, SkeletonTableRow, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { redirectToHrManagerTab } from "@/lib/hr/hrManagerRoutes";
import DataTableShell from "@/components/ui/DataTableShell"; // canonical table scroll shell (CLAUDE.md §3.4)
import EmptyState from "@/components/ui/EmptyState"; // canonical empty-state primitive
import HrSummaryStrip from "@/components/HR/HrSummaryStrip"; // shared at-a-glance metric strip
import { buildPerformanceSummary } from "@/lib/hr/hrTabSummaries";

export function getServerSideProps() {
  return redirectToHrManagerTab("performance");
}

// Skeleton rows that sit inside each SectionCard while performance data loads.
// Keeping the outer page shell mounted (header, section grids, card chrome) means
// the first visible frame already matches the final layout.
import HrPerformanceAppraisalsUi from "@/components/page-ui/hr/hr-performance-ui"; // Extracted presentation layer.
function TableRowsSkeleton({ rows = 5, cols = 4 }) {return (
    <>
      {Array.from({ length: rows }).map((_, i) =>
      <SkeletonTableRow key={i} cols={cols} />
      )}
    </>);

}

function BulletsSkeleton({ rows = 4 }) {
  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)"
      }}>
      
      {Array.from({ length: rows }).map((_, i) =>
      <li key={i} style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
          <SkeletonBlock width="6px" height="6px" borderRadius="999px" />
          <SkeletonBlock width={i % 2 === 0 ? "82%" : "68%"} height="12px" />
        </li>
      )}
    </ul>);

}

function PerformanceContent() {
  const { data, isLoading, error } = useHrOperationsData();
  const employeeDirectory = data?.employeeDirectory ?? [];
  const performanceReviews = data?.performanceReviews ?? [];
  const departmentPerformance = data?.departmentPerformance ?? [];

  // Review health at a glance: what is overdue, what lands this month, and how
  // the scored reviews average out.
  const summary = buildPerformanceSummary({ performanceReviews, departmentPerformance });

  if (error) {
    return (
      <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
        <SectionCard layer="theme"
          sectionKey="hr-performance-error" parentKey="hr-manager-tab-performance" title="Unable to load performance data" subtitle="Mock API returned an error.">
          <StatusMessage tone="danger">{error.message}</StatusMessage>
        </SectionCard>
      </div>);

  }

  const employeeOptions = employeeDirectory.map((employee) => ({
    value: employee.id,
    label: employee.name
  }));

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <SkeletonKeyframes />
      <header>
        <p style={{ color: "var(--text-1)", marginTop: "var(--space-1)" }}>
          Track reviews, ratings, development plans, and upcoming appraisals.
        </p>
      </header>

      {isLoading ? null : <HrSummaryStrip items={summary} parentKey="hr-manager-tab-performance" />}

      <SectionCard layer="theme"
        sectionKey="hr-performance-upcoming-reviews" parentKey="hr-manager-tab-performance"
        title="Upcoming Reviews"
        subtitle="Schedule and prepare feedback before the review date">
        
        <LayerSurface padding="var(--space-3)" gap="0">
          <DataTableShell>
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
                {isLoading ?
                <TableRowsSkeleton rows={4} cols={4} /> :

                performanceReviews.length === 0 ?
                <tr>
                  <td colSpan={4}>
                    <EmptyState variant="bare" icon="⭐" title="No reviews scheduled" description="Reviews appear here with their period, reviewer and next review date." />
                  </td>
                </tr> :

                performanceReviews.map((review) =>
                <tr key={review.id}>
                      <td style={{ fontWeight: 600 }}>{review.employee}</td>
                      <td>{review.period}</td>
                      <td>{review.reviewer}</td>
                      <td>{new Date(review.nextReview).toLocaleDateString()}</td>
                    </tr>
                )
                }
              </tbody>
            </table>
          </DataTableShell>
        </LayerSurface>
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-performance-development-todo" parentKey="hr-manager-tab-performance"
        title="Development To-Do"
        subtitle="Actions to follow up after reviews"
        action={
        <Button variant="primary" size="sm">
            Add reminder
          </Button>
        }>
        
        {isLoading ?
        <BulletsSkeleton rows={4} /> :

        <ul
          style={{
            margin: 0,
            paddingLeft: "var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-sm)"
          }}>
          
            {performanceReviews.map((review) =>
          <li key={review.id} style={{ color: "var(--text-1)" }}>
                <strong>{review.employee}:</strong> {review.developmentFocus}
              </li>
          )}
          </ul>
        }
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-performance-recent-appraisals" parentKey="hr-manager-tab-performance"
        title="Recent Appraisals"
        subtitle="Summary of the last review and ratings"
        action={
        <Button variant="secondary" size="sm">
            Export PDF
          </Button>
        }>
        
        <LayerSurface padding="var(--space-3)" gap="0">
          <DataTableShell>
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
                {isLoading ?
                <TableRowsSkeleton rows={5} cols={7} /> :

                performanceReviews.length === 0 ?
                <tr>
                  <td colSpan={7}>
                    <EmptyState variant="bare" icon="⭐" title="No reviews scheduled" description="Reviews appear here with their period, reviewer and next review date." />
                  </td>
                </tr> :

                performanceReviews.map((review) =>
                <tr key={review.id}>
                      <td style={{ fontWeight: 600 }}>{review.employee}</td>
                      <td>
                        <StatusTag
                      label={`${review.overall ?? 0}/5`}
                      tone={(review.overall ?? 0) >= 4 ? "success" : "default"} />
                    
                      </td>
                      <td>{review.ratings.attendance}/5</td>
                      <td>{review.ratings.productivity}/5</td>
                      <td>{review.ratings.quality}/5</td>
                      <td>{review.ratings.teamwork}/5</td>
                      <td>{review.reviewer}</td>
                    </tr>
                )
                }
              </tbody>
            </table>
          </DataTableShell>
        </LayerSurface>
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-performance-create-review" parentKey="hr-manager-tab-performance"
        title="Create Performance Review"
        subtitle="Kick off a new review cycle or log a mid-year check-in.">
        
        <p style={{ color: "var(--text-1)", marginBottom: "var(--space-4)" }}>
          Select an employee to start drafting their performance review. You can attach supporting documents and invite
          co-reviewers.
        </p>
        <form
          style={{
            display: "grid",
            gap: "var(--space-md)",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
          }}>
          
          <DropdownField
            label="Employee"
            name="employee"
            placeholder="Choose employee"
            defaultValue=""
            options={employeeOptions} />
          
          <InputField label="Review Period" type="text" placeholder="e.g., Q2 2024" />
          <InputField label="Reviewer" type="text" placeholder="Name of reviewer" />
          <label style={labelStyle}>
            <span>Summary & Notes</span>
            <textarea
              className="app-input"
              style={{ minHeight: "120px", resize: "vertical" }}
              placeholder="Enter objectives, observations, and feedback" />
            
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
    </div>);

}

export default function HrPerformanceAppraisals({ embedded = false } = {}) {
  return <HrPerformanceAppraisalsUi view="section1" PerformanceContent={PerformanceContent} />;
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
