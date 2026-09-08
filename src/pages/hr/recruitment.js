// file location: src/pages/hr/recruitment.js
import React from "react";
import { SectionCard } from "@/components/Section";
import HrRecruitmentUi from "@/components/page-ui/hr/hr-recruitment-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { hrPresentationData } from "@/features/presentation/mockData/hr_operations";
import { redirectToHrManagerTab } from "@/lib/hr/hrManagerRoutes";
import LayerSurface from "@/components/ui/LayerSurface"; // third rung: nested inside a --theme SectionCard, so --surface (CLAUDE.md 3.0a-2)
import DataTableShell from "@/components/ui/DataTableShell"; // canonical table scroll shell (CLAUDE.md §3.4)
import EmptyState from "@/components/ui/EmptyState"; // canonical empty-state primitive
import HrSummaryStrip from "@/components/HR/HrSummaryStrip"; // shared at-a-glance metric strip
import { buildRecruitmentSummary } from "@/lib/hr/hrTabSummaries";

export function getServerSideProps() {
  return redirectToHrManagerTab("recruitment");
}

function RecruitmentContent() {
  const showPresentationMock = isPresentationMode();

  // Hoisted so the summary strip and the tables below always read the same
  // rows — no card can drift out of step with the headline numbers.
  const openRoles = showPresentationMock ? hrPresentationData.openRoles : [];
  const recruitmentTasks = showPresentationMock ? hrPresentationData.recruitmentTasks : [];
  const applicants = showPresentationMock ? hrPresentationData.applicants : [];
  const onboardingTasks = showPresentationMock ? hrPresentationData.onboardingTasks : [];

  // Pipeline health: how many roles are live, where the candidates have got to,
  // and what is still blocking a start date.
  const summary = buildRecruitmentSummary({ openRoles, applicants, recruitmentTasks, onboardingTasks });

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--text-1)", marginTop: "var(--space-1)" }}>
          Manage job listings, applicant pipelines, interview scheduling, and onboarding checklists.
        </p>
      </header>

      <HrSummaryStrip items={summary} parentKey="hr-manager-tab-recruitment" />

      <SectionCard layer="theme"
        sectionKey="hr-recruitment-open-roles" parentKey="hr-manager-tab-recruitment"
        title="Open Roles"
        subtitle="Current postings and their pipeline status">
        
        {showPresentationMock ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
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
                  {openRoles.map((role) => (
                    <tr key={role.id}>
                      <td style={{ fontWeight: 600 }}>{role.title}</td>
                      <td>{role.department}</td>
                      <td>{role.applicantCount}</td>
                      <td>{role.stage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </LayerSurface>
        ) : (
          <EmptyState
            icon="📣"
            title="No roles advertised"
            description="Live postings appear here with their department, applicant count and pipeline stage."
          />
        )}
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-recruitment-tasks" parentKey="hr-manager-tab-recruitment"
        title="Recruitment Tasks"
        subtitle="Keep the hiring pipeline moving">
        
        {showPresentationMock ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
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
                  {recruitmentTasks.map((task) => (
                    <tr key={task.id}>
                      <td style={{ fontWeight: 600 }}>{task.description}</td>
                      <td>{task.role}</td>
                      <td>{task.owner}</td>
                      <td>{task.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </LayerSurface>
        ) : (
          <EmptyState
            icon="✅"
            title="No hiring tasks"
            description="Tasks attached to an open role — screening, scheduling, references — appear here with their owner."
          />
        )}
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-recruitment-applicants-pipeline" parentKey="hr-manager-tab-recruitment"
        title="Applicants Pipeline"
        subtitle="Track candidates across the recruitment workflow">
        
        {showPresentationMock ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
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
                  {applicants.map((applicant) => (
                    <tr key={applicant.id}>
                      <td style={{ fontWeight: 600 }}>{applicant.name}</td>
                      <td>{applicant.role}</td>
                      <td>{applicant.stage}</td>
                      <td>{applicant.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </LayerSurface>
        ) : (
          <EmptyState
            icon="🧑"
            title="No applicants in the pipeline"
            description="Candidates appear here as they move through screening, interview and offer."
          />
        )}
      </SectionCard>

      <SectionCard layer="theme"
        sectionKey="hr-recruitment-onboarding-checklist" parentKey="hr-manager-tab-recruitment"
        title="Onboarding Checklist"
        subtitle="Tasks to complete once a candidate accepts an offer.">
        
        {showPresentationMock ? (
          <LayerSurface padding="var(--space-3)" gap="0">
            <DataTableShell>
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Owner</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {onboardingTasks.map((task) => (
                    <tr key={task.id}>
                      <td style={{ fontWeight: 600 }}>{task.task}</td>
                      <td>{task.owner}</td>
                      <td>{task.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </LayerSurface>
        ) : (
          <EmptyState
            icon="📦"
            title="No onboarding checklist yet"
            description="Once a candidate accepts, their IT access, PPE, induction and training tasks are tracked here."
          />
        )}
      </SectionCard>
    </div>);

}

export default function HrRecruitment() {
  return <HrRecruitmentUi view="section1" RecruitmentContent={RecruitmentContent} />;
}
