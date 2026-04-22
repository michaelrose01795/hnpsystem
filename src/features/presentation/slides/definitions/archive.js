import { WORKFLOW } from "../workflow";

export const archiveSlide = {
  id: "archive",
  route: "/job-cards/archive",
  title: "Archive - Completed Jobs",
  roles: ["admin", "admin manager", "owner", "service manager", "workshop manager", "general manager", "after sales director", "aftersales manager"],
  workflowIndex: WORKFLOW.ARCHIVE,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "History preserved and searchable",
      body: "Every completed job is archived but still searchable by registration, customer, part fitted or date. Warranty queries and repeat jobs can be answered in seconds.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"archive-filters\"]",
      position: "bottom",
      title: "Search by the question asked",
      body: "Managers can filter by registration, status or completion order instead of digging through boxes of paper cards.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"archive-results\"]",
      position: "top",
      title: "Archived rows stay useful",
      body: "Completed work remains connected to customer, vehicle, status and completion date for warranty and reporting.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Business intelligence",
      body: "Historical data drives reporting on seasonal patterns, technician productivity and common faults by model.",
    },
  ],
};
