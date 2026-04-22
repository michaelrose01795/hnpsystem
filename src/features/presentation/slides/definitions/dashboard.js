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
      title: "The role-aware starting point",
      body: "Every user lands on a dashboard shaped to their department. Managers see KPIs, technicians see work queues, and operations teams see the items that need attention now.",
    },
    {
      kind: "feature",
      position: "top-left",
      title: "One app, many views",
      body: "The same system supports retail, workshop, parts, accounts, HR and customer-facing workflows without sending users to separate spreadsheets.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Real-time working picture",
      body: "Cards and lists pull from the operational record, so the morning meeting is based on the system of record rather than yesterday's notes.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Replaces whiteboards and handover notes",
      body: "Status, appointments, parts and messages move from physical boards into shared live views that every authorised role can use.",
    },
  ],
};
