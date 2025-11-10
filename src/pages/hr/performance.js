// file location: src/pages/hr/performance.js
import React from "react"; // React runtime for the page component
import Layout from "../../components/Layout"; // shared layout shell with navigation
import { useHrOperationsData } from "../../hooks/useHrData"; // aggregated HR hook backed by Supabase
import { SectionCard, StatusTag } from "../../components/HR/MetricCard"; // shared HR UI components

// TODO: Replace placeholder performance data with live Supabase-backed scores before release.
// TODO: Connect review scheduling/actions to the HR reviews tables once available.
const placeholderReviews = [
  {
    id: "REV-1",
    employee: "Sarah Thompson",
    period: "Q1 2024",
    overall: "Exceeds Expectations",
    ratings: {
      attendance: 5,
      productivity: 5,
      quality: 4,
      teamwork: 5,
    },
    reviewer: "Lewis Carter",
    nextReview: "2024-06-30",
    developmentFocus: "Mentor new workshop technicians.",
  },
  {
    id: "REV-2",
    employee: "Michael Green",
    period: "Q1 2024",
    overall: "Meets Expectations",
    ratings: {
      attendance: 4,
      productivity: 4,
      quality: 3,
      teamwork: 4,
    },
    reviewer: "Sarah Thompson",
    nextReview: "2024-06-12",
    developmentFocus: "Upskill on EV diagnostics.",
  },
];

export default function HrPerformanceAppraisals() {
  const { data, isLoading, error } = useHrOperationsData(); // hydrate the workspace with real HR data
  const employeeDirectory = data?.employeeDirectory ?? []; // fallback to empty array when no staff records

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
        <header>
          <p style={{ color: "#6B7280", marginTop: "6px" }}>
            Track reviews, ratings, development plans, and upcoming appraisals.
          </p>
        </header>

        {isLoading && (
          <SectionCard title="Loading performance data" subtitle="Fetching placeholder employee list.">
            <span style={{ color: "#6B7280" }}>
              Gathering mock performance records to render the workspace.
            </span>
          </SectionCard>
        )}

        {error && (
          <SectionCard title="Unable to load performance data" subtitle="Mock API returned an error.">
            <span style={{ color: "#B91C1C" }}>{error.message}</span>
          </SectionCard>
        )}

        {!isLoading && !error && (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <SectionCard
                title="Upcoming Reviews"
                subtitle="Schedule and prepare feedback before the review date"
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#6B7280", fontSize: "0.8rem" }}>
                      <th style={{ textAlign: "left", paddingBottom: "10px" }}>Employee</th>
                      <th>Period</th>
                      <th>Reviewer</th>
                      <th>Next Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placeholderReviews.map((review) => (
                      <tr key={review.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                        <td style={{ padding: "12px 0", fontWeight: 600 }}>{review.employee}</td>
                        <td>{review.period}</td>
                        <td>{review.reviewer}</td>
                        <td>{new Date(review.nextReview).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionCard>

              <SectionCard
                title="Development To-Do"
                subtitle="Actions to follow up after reviews"
                action={
                  <button type="button" style={buttonStylePrimary}>
                    Add reminder
                  </button>
                }
              >
                <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {placeholderReviews.map((review) => (
                    <li key={review.id} style={{ color: "#374151" }}>
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
                <button type="button" style={buttonStyleSecondary}>
                  Export PDF
                </button>
              }
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#6B7280", fontSize: "0.8rem" }}>
                      <th style={{ textAlign: "left", paddingBottom: "10px" }}>Employee</th>
                      <th>Overall</th>
                      <th>Attendance</th>
                      <th>Productivity</th>
                      <th>Quality</th>
                      <th>Teamwork</th>
                      <th>Reviewer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placeholderReviews.map((review) => (
                      <tr key={review.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                        <td style={{ padding: "12px 0", fontWeight: 600 }}>{review.employee}</td>
                        <td>
                          <StatusTag
                            label={review.overall}
                            tone={review.overall.includes("Exceeds") ? "success" : "default"}
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
              <p style={{ color: "#4B5563", marginBottom: "14px" }}>
                Select an employee to start drafting their performance review. You can attach supporting documents and invite
                co-reviewers.
              </p>
              <form style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                <label style={labelStyle}>
                  <span>Employee</span>
                  <select style={inputStyle} defaultValue="">
                    <option value="" disabled>
                      Choose employee
                    </option>
                    {/* TODO: Replace employee list with dynamic data source before production. */}
                    {employeeDirectory.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>Review Period</span>
                  <input style={inputStyle} type="text" placeholder="e.g., Q2 2024" />
                </label>
                <label style={labelStyle}>
                  <span>Reviewer</span>
                  <input style={inputStyle} type="text" placeholder="Name of reviewer" />
                </label>
                <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                  <span>Summary & Notes</span>
                  <textarea
                    style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
                    placeholder="Enter objectives, observations, and feedback"
                  ></textarea>
                </label>
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: "12px" }}>
                  <button type="button" style={buttonStylePrimary}>
                    Save Draft
                  </button>
                  <button type="button" style={buttonStyleGhost}>
                    Share with reviewer
                  </button>
                </div>
              </form>
            </SectionCard>
          </>
        )}
      </div>
    </Layout>
  );
}

const buttonStylePrimary = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: "#F97316",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid #FED7AA",
  background: "white",
  color: "#EA580C",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleGhost = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid transparent",
  background: "transparent",
  color: "#EA580C",
  fontWeight: 600,
  cursor: "pointer",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  color: "#374151",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #E5E7EB",
  background: "white",
  color: "#111827",
  fontSize: "0.9rem",
};
