// file location: src/pages/hr/recruitment.js
import React from "react";
import { SectionCard } from "@/components/Section";
import HrRecruitmentUi from "@/components/page-ui/hr/hr-recruitment-ui"; // Extracted presentation layer.

function RecruitmentContent() {
  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <header>
        <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
          Manage job listings, applicant pipelines, interview scheduling, and onboarding checklists.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--page-stack-gap)"
        }}>
        
        <SectionCard
          title="Open Roles"
          subtitle="Current postings and their pipeline status">
          
          <p style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch job listings from Supabase recruitment table. Display role title, department, applicant count, pipeline stage, posted date, and a "New job listing" action.
          </p>
        </SectionCard>

        <SectionCard
          title="Recruitment Tasks"
          subtitle="Keep the hiring pipeline moving">
          
          <p style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch recruitment tasks from Supabase. Display task descriptions linked to open roles with assign/complete actions.
          </p>
        </SectionCard>
      </section>

      <SectionCard
        title="Applicants Pipeline"
        subtitle="Track candidates across the recruitment workflow">
        
        <p style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)", fontStyle: "italic", margin: 0 }}>
          TODO: Fetch applicants from Supabase recruitment pipeline. Display applicant name, role applied for, current stage, last update, and hiring owner with import/export actions.
        </p>
      </SectionCard>

      <SectionCard
        title="Onboarding Checklist"
        subtitle="Tasks to complete once a candidate accepts an offer.">
        
        <p style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)", fontStyle: "italic", margin: 0 }}>
          TODO: Fetch onboarding checklist templates from Supabase. Display dynamic task list (IT access, PPE, induction, training) with completion toggles per new hire.
        </p>
      </SectionCard>
    </div>);

}

export default function HrRecruitment({ embedded = false } = {}) {
  return <HrRecruitmentUi view="section1" RecruitmentContent={RecruitmentContent} />;
}
