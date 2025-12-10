// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/recruitment.js
import React from "react";
import Layout from "@/components/Layout";
import { SectionCard, StatusTag } from "@/components/HR/MetricCard";

// TODO: Link job listings, applicants, and tasks to the recruitment pipeline tables.

// TODO: Replace recruitment placeholders with live pipeline integration before production.
const placeholderJobListings = [
  {
    id: "JOB-1",
    title: "Senior Technician",
    department: "Workshop",
    status: "Open",
    posted: "2024-03-01",
    applicants: 6,
    stage: "Interviewing",
  },
  {
    id: "JOB-2",
    title: "Service Advisor",
    department: "Service",
    status: "Draft",
    posted: "2024-03-10",
    applicants: 0,
    stage: "Draft",
  },
];

const placeholderApplicants = [
  {
    id: "APP-1",
    name: "Laura Jenkins",
    appliedFor: "Senior Technician",
    stage: "Interview",
    lastUpdate: "2024-03-12",
    owner: "Sarah Thompson",
  },
  {
    id: "APP-2",
    name: "Mateo Alvarez",
    appliedFor: "Service Advisor",
    stage: "Screening",
    lastUpdate: "2024-03-11",
    owner: "Lewis Carter",
  },
];

function RecruitmentContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
        <header>
          <p style={{ color: "var(--info)", marginTop: "6px" }}>
            Manage job listings, applicant pipelines, interview scheduling, and onboarding checklists.
          </p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px" }}>
          <SectionCard
            title="Open Roles"
            subtitle="Current postings and their pipeline status"
            action={
              <button type="button" style={buttonStylePrimary}>
                New job listing
              </button>
            }
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                  <th style={{ textAlign: "left", paddingBottom: "10px" }}>Role</th>
                  <th>Department</th>
                  <th>Applicants</th>
                  <th>Stage</th>
                  <th>Posted</th>
                </tr>
              </thead>
              <tbody>
                {placeholderJobListings.map((job) => (
                  <tr key={job.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                    <td style={{ padding: "12px 0", fontWeight: 600 }}>{job.title}</td>
                    <td>{job.department}</td>
                    <td>{job.applicants}</td>
                    <td>
                      <StatusTag
                        label={job.stage}
                        tone={job.stage === "Interviewing" ? "warning" : job.stage === "Draft" ? "default" : "success"}
                      />
                    </td>
                    <td>{new Date(job.posted).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>

          <SectionCard
            title="Recruitment Tasks"
            subtitle="Keep the hiring pipeline moving"
            action={
              <button type="button" style={buttonStyleSecondary}>
                Assign task
              </button>
            }
          >
            <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li style={{ color: "var(--info-dark)" }}>
                Schedule second interview for <strong>Senior Technician</strong> role.
              </li>
              <li style={{ color: "var(--info-dark)" }}>
                Prepare onboarding checklist for upcoming <strong>Sales</strong> hire.
              </li>
              <li style={{ color: "var(--info-dark)" }}>
                Review screening notes for <strong>Service Advisor</strong> applicants.
              </li>
            </ul>
          </SectionCard>
        </section>

        <SectionCard
          title="Applicants Pipeline"
          subtitle="Track candidates across the recruitment workflow"
          action={
            <button type="button" style={buttonStylePrimary}>
              Import applicants
            </button>
          }
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                  <th style={{ textAlign: "left", paddingBottom: "10px" }}>Applicant</th>
                  <th>Applied For</th>
                  <th>Stage</th>
                  <th>Last Update</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {placeholderApplicants.map((applicant) => (
                  <tr key={applicant.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                    <td style={{ padding: "12px 0", fontWeight: 600 }}>{applicant.name}</td>
                    <td>{applicant.appliedFor}</td>
                    <td>
                      <StatusTag
                        label={applicant.stage}
                        tone={
                          applicant.stage === "Offer"
                            ? "success"
                            : applicant.stage === "Interview"
                            ? "warning"
                            : "default"
                        }
                      />
                    </td>
                    <td>{new Date(applicant.lastUpdate).toLocaleDateString()}</td>
                    <td>{applicant.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Onboarding Checklist"
          subtitle="Tasks to complete once a candidate accepts an offer."
        >
          <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <li style={{ color: "var(--info-dark)" }}>Provision IT access (email, DMS login, clocking badge).</li>
            <li style={{ color: "var(--info-dark)" }}>Assign uniform and workshop PPE.</li>
            <li style={{ color: "var(--info-dark)" }}>Schedule induction and health & safety briefing.</li>
            <li style={{ color: "var(--info-dark)" }}>Add to mandatory training list (Hybrid Safety, Customer Experience).</li>
          </ul>
          <p style={{ color: "var(--info)", marginTop: "12px" }}>
            Placeholder checklist for design review. Replace with dynamic onboarding templates before launch.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}

export default function HrRecruitment({ embedded = false } = {}) {
  const content = <RecruitmentContent />;
  return embedded ? content : <Layout>{content}</Layout>;
}

const buttonStylePrimary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "none",
  background: "var(--success)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--success)",
  background: "var(--surface)",
  color: "var(--success)",
  fontWeight: 600,
  cursor: "pointer",
};
