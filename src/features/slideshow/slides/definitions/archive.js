import { WORKFLOW } from "../workflow";

export const archiveSlide = {
  id: "archive",
  route: "/job-cards/archive",
  title: "Archive — Completed Jobs",
  roles: ["admin", "admin manager", "owner", "service manager", "workshop manager", "general manager", "after sales director"],
  workflowIndex: WORKFLOW.ARCHIVE,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "History preserved and searchable",
      body: "Every completed job is archived but still fully searchable — by reg, customer, part fitted, or date. Warranty queries, repeat jobs, and tax disputes are answered in seconds.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Audit-ready",
      body: "Seven-year retention by default, fully queryable. No basement full of paper.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Business intelligence",
      body: "Historical data drives reports: seasonal patterns, technician productivity, common faults by model.",
    },
  ],
};
