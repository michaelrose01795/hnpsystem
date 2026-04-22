import { WORKFLOW } from "../workflow";

export const myJobsSlide = {
  id: "my-jobs",
  route: "/job-cards/myjobs",
  title: "My Jobs - Technician View",
  roles: ["techs", "mobile technician", "mot tester", "painters"],
  workflowIndex: WORKFLOW.MY_JOBS,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "A technician's personal queue",
      body: "Each technician sees the work assigned to them. They can move through jobs without paper cards, separate timesheets or end-of-day reconciliation.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"my-jobs-filters\"]",
      position: "bottom",
      title: "Find the right job quickly",
      body: "Search and status filters let the technician narrow the queue to in progress, waiting or completed work.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"my-jobs-results\"]",
      position: "top",
      title: "Work queue rows",
      body: "Each row carries job number, registration, customer, vehicle and type so the technician has the right context before opening the job.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Digital clocking",
      body: "Time on each job can be recorded against the operational record, feeding payroll, efficiency and job costing from one source of truth.",
    },
  ],
};
