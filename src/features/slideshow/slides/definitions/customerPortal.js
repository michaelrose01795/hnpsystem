import { WORKFLOW } from "../workflow";

export const customerPortalSlide = {
  id: "customer-portal",
  route: "/customer",
  title: "Customer Portal",
  roles: null,
  workflowIndex: WORKFLOW.CUSTOMER_PORTAL,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "What the customer sees",
      body: "Customers sign in to see their vehicle history, VHC reports with photos, invoices, and upcoming appointments. Reduces inbound calls and builds trust.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Self-serve reduces phone calls",
      body: "'Is my car ready?' calls drop significantly once customers have live status in their pocket.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Improved retention",
      body: "Visible MOT reminders, service intervals, and past work keep customers booking with us instead of shopping around.",
    },
  ],
};
