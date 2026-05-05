import { WORKFLOW } from "../workflow";

export const dashboardSlide = {
  id: "dashboard",
  route: "/dashboard",
  title: "Dashboard - Starting Point",
  roles: null,
  workflowIndex: WORKFLOW.DASHBOARD,
  steps: [
    {
      kind: "main",
      position: "center",
      anchor: "[data-presentation=\"dashboard-overview\"]",
      title: "The role-aware starting point",
      body: "Every user lands on a dashboard shaped to their department, with the current jobs view and role tools kept in one place.",
    },
    {
      kind: "feature",
      position: "top-right",
      anchor: "[data-presentation=\"dashboard-global-search\"]",
      title: "Fast job lookup",
      body: "The dashboard gives users a direct route into job search before they move deeper into workshop, parts or customer workflows.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      anchor: "[data-presentation=\"dashboard-live-jobs\"]",
      title: "Current work in view",
      body: "The jobs table keeps job number, customer, vehicle, status and technician together, so the first screen reflects the operational record.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      anchor: "[data-presentation=\"dashboard-live-jobs\"]",
      title: "Shared handover context",
      body: "Status, vehicle and technician columns replace disconnected handover notes with a shared view that authorised roles can act from.",
    },
  ],
};
