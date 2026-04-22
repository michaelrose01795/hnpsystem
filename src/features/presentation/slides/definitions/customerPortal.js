import { WORKFLOW } from "../workflow";

export const customerPortalSlide = {
  id: "customer-portal",
  route: "/customer",
  title: "Customer Portal",
  roles: [
    "admin", "admin manager", "owner", "service", "service manager",
    "workshop manager", "general manager", "after sales director", "aftersales manager",
    "receptionist", "customer",
  ],
  workflowIndex: WORKFLOW.CUSTOMER_PORTAL,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "What the customer sees",
      body: "Customers sign in to see vehicle history, VHC reports with photos, invoices and upcoming appointments. That reduces inbound calls and builds trust.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"customer-hero\"]",
      position: "bottom",
      title: "Live visit summary",
      body: "The customer sees the next visit and latest status without calling reception.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"customer-history\"]",
      position: "top",
      title: "Vehicle and VHC history",
      body: "Garage records and health checks sit together so the customer can understand what has been done and what is advised next.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Improved retention",
      body: "Visible MOT reminders, service intervals and past work keep customers booking with HNP instead of shopping around.",
    },
  ],
};
