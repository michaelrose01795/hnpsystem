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
      body: "Attendance, leave, payroll, training, performance and disciplinary data live together instead of being chased through email, folders and paper records.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"hr-metrics\"]",
      position: "bottom",
      title: "Management metrics",
      body: "The top row gives managers the current people picture: headcount, leave, training due and vacancies.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"hr-compliance\"]",
      position: "top",
      title: "Compliance watchlist",
      body: "Training renewals, absences and active warnings are visible without opening separate spreadsheets.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Real-time attendance",
      body: "Clock-in data from the workshop feeds HR attendance, removing the separate sign-in sheet and reconciliation step.",
    },
  ],
};
