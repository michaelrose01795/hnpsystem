import { WORKFLOW } from "../workflow";

export const jobDetailSlide = {
  id: "job-detail",
  route: "/job-cards/DEMO-1042",
  title: "Job Detail - Full Write-up",
  roles: [
    "admin", "admin manager", "owner", "service", "service manager",
    "workshop manager", "general manager", "after sales director", "aftersales manager",
    "receptionist", "techs", "mobile technician", "mot tester", "parts", "parts manager",
    "valet service", "valet sales", "accounts", "accounts manager",
  ],
  workflowIndex: WORKFLOW.JOB_DETAIL,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "One page for the whole job",
      body: "Vehicle, customer, technician notes, parts, VHC results, time entries, photos and invoice status all live on the job detail page. Every department works from the same record.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"job-detail-status\"]",
      position: "bottom",
      title: "Status and actions",
      body: "The header shows the job number, status, division and key actions so reception and managers can see progress immediately.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"job-detail-tabs\"]",
      position: "bottom",
      title: "Tabs for each aspect",
      body: "Customer requests, write-up, parts, VHC, clocking, messages, documents and invoice data stay attached to one job card.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Centralised record",
      body: "This replaces the paper job card, parts clipboard, technician notes and separate time-sheet with one auditable record.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Audit trail",
      body: "Every change can be timestamped and attributed, which is invaluable for warranty disputes and internal accountability.",
    },
  ],
};
