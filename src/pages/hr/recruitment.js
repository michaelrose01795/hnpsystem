// file location: src/pages/hr/recruitment.js
import React from "react";
import { SectionCard } from "@/components/Section";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import HrRecruitmentUi from "@/components/page-ui/hr/hr-recruitment-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { hrPresentationData } from "@/features/presentation/mockData/hr_operations";

function RecruitmentContent() {
  const showPresentationMock = isPresentationMode();

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--text-1)", marginTop: "var(--space-1)" }}>
          Manage job listings, applicant pipelines, interview scheduling, and onboarding checklists.
        </p>
      </header>

      <DevLayoutSection
        as="section"
        sectionKey="hr-recruitment-row-1"
        parentKey="hr-manager-tab-recruitment"
        sectionType="section-shell"
        shell
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--page-stack-gap)"
        }}>
        
        <SectionCard
          sectionKey="hr-recruitment-card-1" parentKey="hr-recruitment-row-1"
          title="Open Roles"
          subtitle="Current postings and their pipeline status">
          
          {showPresentationMock ? (
            <div style={{ overflowX: "auto" }}>
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Applicants</th>
                    <th>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {hrPresentationData.openRoles.map((role) => (
                    <tr key={role.id}>
                      <td style={{ fontWeight: 600 }}>{role.title}</td>
                      <td>{role.department}</td>
                      <td>{role.applicantCount}</td>
                      <td>{role.stage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", fontStyle: "italic", margin: 0 }}>
              TODO: Fetch job listings from Supabase recruitment table. Display role title, department, applicant count, pipeline stage, posted date, and a "New job listing" action.
            </p>
          )}
        </SectionCard>

        <SectionCard
          sectionKey="hr-recruitment-card-2" parentKey="hr-recruitment-row-1"
          title="Recruitment Tasks"
          subtitle="Keep the hiring pipeline moving">
          
          {showPresentationMock ? (
            <div style={{ overflowX: "auto" }}>
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Role</th>
                    <th>Owner</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hrPresentationData.recruitmentTasks.map((task) => (
                    <tr key={task.id}>
                      <td style={{ fontWeight: 600 }}>{task.description}</td>
                      <td>{task.role}</td>
                      <td>{task.owner}</td>
                      <td>{task.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", fontStyle: "italic", margin: 0 }}>
              TODO: Fetch recruitment tasks from Supabase. Display task descriptions linked to open roles with assign/complete actions.
            </p>
          )}
        </SectionCard>
      </DevLayoutSection>

      <SectionCard
        sectionKey="hr-recruitment-card-3" parentKey="hr-manager-tab-recruitment"
        title="Applicants Pipeline"
        subtitle="Track candidates across the recruitment workflow">
        
        {showPresentationMock ? (
          <div style={{ overflowX: "auto" }}>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Role</th>
                  <th>Stage</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {hrPresentationData.applicants.map((applicant) => (
                  <tr key={applicant.id}>
                    <td style={{ fontWeight: 600 }}>{applicant.name}</td>
                    <td>{applicant.role}</td>
                    <td>{applicant.stage}</td>
                    <td>{applicant.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch applicants from Supabase recruitment pipeline. Display applicant name, role applied for, current stage, last update, and hiring owner with import/export actions.
          </p>
        )}
      </SectionCard>

      <SectionCard
        sectionKey="hr-recruitment-card-4" parentKey="hr-manager-tab-recruitment"
        title="Onboarding Checklist"
        subtitle="Tasks to complete once a candidate accepts an offer.">
        
        {showPresentationMock ? (
          <div style={{ overflowX: "auto" }}>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Owner</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {hrPresentationData.onboardingTasks.map((task) => (
                  <tr key={task.id}>
                    <td style={{ fontWeight: 600 }}>{task.task}</td>
                    <td>{task.owner}</td>
                    <td>{task.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch onboarding checklist templates from Supabase. Display dynamic task list (IT access, PPE, induction, training) with completion toggles per new hire.
          </p>
        )}
      </SectionCard>
    </div>);

}

export default function HrRecruitment() {
  return <HrRecruitmentUi view="section1" RecruitmentContent={RecruitmentContent} />;
}
