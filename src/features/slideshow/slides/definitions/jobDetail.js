import { WORKFLOW } from "../workflow";

export const jobDetailSlide = {
  id: "job-detail",
  route: "/job-cards/DEMO-1042",
  title: "Job Detail — Full Write-up",
  roles: null,
  workflowIndex: WORKFLOW.JOB_DETAIL,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "One page, the whole job",
      body: "Every piece of information about a job lives here: vehicle, customer, technician notes, parts ordered, VHC results, time entries, photos, invoice status. Every department sees the same page — no more 'check with parts' phone calls.",
    },
    {
      kind: "tooltip",
      anchor: "[data-slideshow=\"job-detail-status\"]",
      position: "bottom",
      title: "Status + progress",
      body: "Real-time progress visible to reception so customer queries are answered instantly.",
    },
    {
      kind: "tooltip",
      anchor: "[data-slideshow=\"job-detail-tabs\"]",
      position: "bottom",
      title: "Tabs for each aspect",
      body: "Write-up, parts, VHC, time, invoice — everything about this job, in one card.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Centralised record",
      body: "Replaces: paper job card, parts clipboard, technician notepad, and separate time-sheet.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Audit trail",
      body: "Every change is timestamped and attributed — invaluable for warranty disputes and internal accountability.",
    },
  ],
};
