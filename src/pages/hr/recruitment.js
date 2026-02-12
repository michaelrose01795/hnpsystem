// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/recruitment.js
import React from "react";
import Layout from "@/components/Layout";
import { SectionCard } from "@/components/HR/MetricCard";

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
          >
            <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", margin: 0 }}>
              TODO: Fetch job listings from Supabase recruitment table. Display role title, department, applicant count, pipeline stage, posted date, and a "New job listing" action.
            </p>
          </SectionCard>

          <SectionCard
            title="Recruitment Tasks"
            subtitle="Keep the hiring pipeline moving"
          >
            <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", margin: 0 }}>
              TODO: Fetch recruitment tasks from Supabase. Display task descriptions linked to open roles with assign/complete actions.
            </p>
          </SectionCard>
        </section>

        <SectionCard
          title="Applicants Pipeline"
          subtitle="Track candidates across the recruitment workflow"
        >
          <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch applicants from Supabase recruitment pipeline. Display applicant name, role applied for, current stage, last update, and hiring owner with import/export actions.
          </p>
        </SectionCard>

        <SectionCard
          title="Onboarding Checklist"
          subtitle="Tasks to complete once a candidate accepts an offer."
        >
          <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch onboarding checklist templates from Supabase. Display dynamic task list (IT access, PPE, induction, training) with completion toggles per new hire.
          </p>
        </SectionCard>
    </div>
  );
}

export default function HrRecruitment({ embedded = false } = {}) {
  const content = <RecruitmentContent />;
  return embedded ? content : <Layout>{content}</Layout>;
}

