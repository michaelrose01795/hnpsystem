// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/performance.js
import React from "react"; // React runtime for the page component
import Layout from "@/components/Layout"; // shared layout shell with navigation
import { useHrOperationsData } from "@/hooks/useHrData"; // aggregated HR hook backed by Supabase
import { SectionCard, StatusTag } from "@/components/HR/MetricCard"; // shared HR UI components
// ⚠️ Mock data found — replacing with Supabase query
// ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)

function PerformanceContent() {
  const { data, isLoading, error } = useHrOperationsData(); // hydrate the workspace with real HR data
  const employeeDirectory = data?.employeeDirectory ?? []; // fallback to empty array when no staff records
  const performanceReviews = data?.performanceReviews ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
        <header>
          <p style={{ color: "var(--info)", marginTop: "6px" }}>
            Track reviews, ratings, development plans, and upcoming appraisals.
          </p>
        </header>

        {isLoading && (
          <SectionCard title="Loading performance data" subtitle="Fetching placeholder employee list.">
            <span style={{ color: "var(--info)" }}>
              Gathering live performance records from Supabase.
            </span>
          </SectionCard>
        )}

        {error && (
          <SectionCard title="Unable to load performance data" subtitle="Mock API returned an error.">
            <span style={{ color: "var(--danger)" }}>{error.message}</span>
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
                    <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                      <th style={{ textAlign: "left", paddingBottom: "10px" }}>Employee</th>
                      <th>Period</th>
                      <th>Reviewer</th>
                      <th>Next Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceReviews.map((review) => (
                      <tr key={review.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
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
                  {performanceReviews.map((review) => (
                    <li key={review.id} style={{ color: "var(--info-dark)" }}>
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
                    <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
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
                    {performanceReviews.map((review) => (
                      <tr key={review.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                        <td style={{ padding: "12px 0", fontWeight: 600 }}>{review.employee}</td>
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
              <p style={{ color: "var(--info-dark)", marginBottom: "14px" }}>
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
    </div>
  );
}

export default function HrPerformanceAppraisals({ embedded = false } = {}) {
  const content = <PerformanceContent />;
  return embedded ? content : <Layout>{content}</Layout>;
}

const buttonStylePrimary = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: "var(--danger)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--warning)",
  background: "var(--surface)",
  color: "var(--danger)",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleGhost = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--danger)",
  fontWeight: 600,
  cursor: "pointer",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  color: "var(--info-dark)",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid var(--accent-purple-surface)",
  background: "var(--surface)",
  color: "var(--accent-purple)",
  fontSize: "0.9rem",
};
