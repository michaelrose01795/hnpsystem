import { WORKFLOW } from "../workflow";

export const vhcSlide = {
  id: "vhc",
  route: "/vhc",
  title: "Vehicle Health Check",
  roles: [
    "admin", "admin manager", "owner", "service", "service manager",
    "workshop manager", "general manager", "after sales director", "aftersales manager",
    "receptionist", "techs", "mobile technician", "mot tester", "customer",
  ],
  workflowIndex: WORKFLOW.VHC,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Digital VHC",
      body: "Technicians run through a structured vehicle health check on a tablet. Results, photos and advisories attach to the job and become a customer-facing report automatically.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"vhc-summary-list\"]",
      position: "right",
      title: "Traffic-light inspection history",
      body: "Amber and red items are visible by vehicle and visit, giving reception a clear list of advisories to explain and quote.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"vhc-customer-messages\"]",
      position: "left",
      title: "Customer questions stay attached",
      body: "Follow-up messages sit beside the VHC, keeping approvals and clarification in the same customer record.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Customer transparency",
      body: "The customer sees evidence, photos and a clear report. That builds trust, improves authorisation rates and reduces repeat explanation calls.",
    },
  ],
};
