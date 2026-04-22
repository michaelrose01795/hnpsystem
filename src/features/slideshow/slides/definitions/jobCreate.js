import { WORKFLOW } from "../workflow";

export const jobCreateSlide = {
  id: "job-create",
  route: "/job-cards/create",
  title: "Create a Job Card",
  roles: [
    "admin", "admin manager", "owner", "service", "service manager",
    "workshop manager", "general manager", "after sales director", "receptionist",
  ],
  workflowIndex: WORKFLOW.JOB_CREATE,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Starting a new job",
      body: "The workflow begins here. A service advisor fills in vehicle reg, customer, and complaint, and the system creates a job card that every other department can see immediately.",
    },
    {
      kind: "tooltip",
      anchor: "[data-slideshow=\"create-reg-lookup\"]",
      position: "right",
      title: "Vehicle lookup from reg",
      body: "Type a reg and the system pulls make, model, VIN, MOT expiry, and service history. No separate DVLA check, no re-typing details that already exist.",
    },
    {
      kind: "tooltip",
      anchor: "[data-slideshow=\"create-customer-lookup\"]",
      position: "right",
      title: "Customer lookup",
      body: "Returning customers are found by name, phone, or reg. All of their vehicle history shows in one click.",
    },
    {
      kind: "tooltip",
      anchor: "[data-slideshow=\"create-submit\"]",
      position: "top",
      title: "One-click creation",
      body: "Submit and a job number is generated, a card drops onto the workshop board, and the customer receives a confirmation SMS — all in one action.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Removes duplicate entry",
      body: "Previously the same details were written on a paper card, a diary entry, and a workshop board. Now it's entered once.",
    },
  ],
};
