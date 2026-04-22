import { WORKFLOW } from "../workflow";

export const hrDashboardSlide = {
  id: "hr-dashboard",
  route: "/hr",
  title: "HR Dashboard",
  roles: ["admin", "admin manager", "owner", "hr manager", "general manager"],
  workflowIndex: WORKFLOW.HR_DASHBOARD,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "People operations, centralised",
      body: "Attendance, leave, payroll, training, performance, disciplinary — the same details managers used to chase across email, folders, and paper are all here.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Compliance built in",
      body: "Training expiry, contract renewals, and disciplinary records are all timestamped and auditable.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Real-time attendance",
      body: "Clock-in data from the workshop feeds straight into HR attendance. No separate sign-in sheet, no reconciliation.",
    },
  ],
};
