// Presentation overlays for the GDPR / data-protection register pages under
// /admin/compliance. Deck order is driven by docs/ui/ui-presentation, so the
// workflowIndex values here only need to be unique numbers.

const COMPLIANCE_ROLES = ["admin", "admin manager", "owner"];

export const adminComplianceSlide = {
  id: "admin-compliance",
  route: "/admin/compliance",
  title: "Compliance - Data Protection Hub",
  roles: COMPLIANCE_ROLES,
  workflowIndex: 130,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "One place for data-protection duties",
      body: "Subject requests, breaches, DPIAs, retention and the processing record all sit behind one admin hub instead of scattered spreadsheets.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Audit-ready at any time",
      body: "Every register is timestamped and owned, so an ICO query or internal audit can be answered without a scramble.",
    },
  ],
};

export const adminComplianceBreachesSlide = {
  id: "admin-compliance-breaches",
  route: "/admin/compliance/breaches",
  title: "Compliance - Breach Register",
  roles: COMPLIANCE_ROLES,
  workflowIndex: 132,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Personal-data breach log",
      body: "Every suspected breach is logged with detection time, severity and category — the 72-hour ICO clock is visible from the moment it is recorded.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Decision trail captured",
      body: "Containment, remediation and the reportable-or-not rationale are stored against each entry so the decision can be justified later.",
    },
  ],
};

export const adminComplianceDpiasSlide = {
  id: "admin-compliance-dpias",
  route: "/admin/compliance/dpias",
  title: "Compliance - DPIA Register",
  roles: COMPLIANCE_ROLES,
  workflowIndex: 133,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Impact assessments per feature",
      body: "Each system or feature that processes personal data carries a DPIA with its risk level, mitigations and sign-off.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Review dates that don't slip",
      body: "Next-review dates surface here so assessments are refreshed before they go stale.",
    },
  ],
};

export const adminComplianceRetentionSlide = {
  id: "admin-compliance-retention",
  route: "/admin/compliance/retention",
  title: "Compliance - Retention",
  roles: COMPLIANCE_ROLES,
  workflowIndex: 135,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Retention policy and runs",
      body: "How long each type of record is kept, the legal basis behind it, and a log of the sweeps that enforce it.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Dry-run before deletion",
      body: "Retention runs can be dry-run first so the volume to be actioned is checked before anything is removed.",
    },
  ],
};

export const adminComplianceRopaSlide = {
  id: "admin-compliance-ropa",
  route: "/admin/compliance/ropa",
  title: "Compliance - Processing Activities",
  roles: COMPLIANCE_ROLES,
  workflowIndex: 134,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Record of Processing Activities",
      body: "The Article 30 record: every processing activity with its purpose, lawful basis, data categories and recipients.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "The map of where data flows",
      body: "When a new system is added, the ROPA shows what already touches that data and who owns it.",
    },
  ],
};

export const adminComplianceSarsSlide = {
  id: "admin-compliance-sars",
  route: "/admin/compliance/sars",
  title: "Compliance - Subject Requests",
  roles: COMPLIANCE_ROLES,
  workflowIndex: 131,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Data-rights requests tracked to deadline",
      body: "Access, erasure and rectification requests are logged with their received date and statutory due date so none are missed.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Identity check recorded",
      body: "How each requester was verified is stored alongside the response, closing the loop on the request.",
    },
  ],
};
