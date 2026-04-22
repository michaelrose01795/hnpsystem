import { WORKFLOW } from "../workflow";

export const dashboardSlide = {
  id: "dashboard",
  route: "/dashboard",
  title: "Dashboard — Your Starting Point",
  roles: null, // visible to every authenticated role
  workflowIndex: WORKFLOW.DASHBOARD,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "The Dashboard",
      body: "Every user lands here after login. The dashboard shows live KPIs tailored to their department — jobs in progress, parts pending, invoices overdue, today's appointments. It replaces three separate spreadsheets and the morning stand-up email chain.",
    },
    {
      kind: "feature",
      position: "top-left",
      title: "Role-aware KPIs",
      body: "Managers see financial metrics, technicians see their own job queue, parts staff see inbound deliveries. One URL, one page — the system decides what's relevant.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Real-time data",
      body: "Every card re-queries on focus. No manual refresh, no stale numbers in a morning meeting.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Replaces spreadsheets + whiteboards",
      body: "The workshop whiteboard, the parts clipboard, and the appointments diary are all live tiles here instead of physical artefacts that go out of date the moment they're written.",
    },
  ],
};
