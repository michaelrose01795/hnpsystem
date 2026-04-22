import { WORKFLOW } from "../workflow";

export const myJobsSlide = {
  id: "my-jobs",
  route: "/job-cards/myjobs",
  title: "My Jobs (Technician View)",
  roles: ["techs", "mobile technician", "mot tester", "painters"],
  workflowIndex: WORKFLOW.MY_JOBS,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "A technician's personal queue",
      body: "Every technician sees only the work assigned to them. They clock on and off each job from here — no paper cards, no separate timesheet, no end-of-day reconciliation.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Digital clocking",
      body: "Time on each job is recorded automatically. Payroll, efficiency reporting, and job-costing all pull from the same source of truth.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Paperless workflow",
      body: "Job notes, measurements, and photos attach directly to the job. No more lost paper cards or unreadable handwriting on the service sheet.",
    },
  ],
};
