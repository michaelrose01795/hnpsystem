import { WORKFLOW } from "../workflow";

export const jobCreateSlide = {
  id: "job-create",
  route: "/job-cards/create",
  title: "Create a Job Card",
  roles: [
    "admin", "admin manager", "owner", "service", "service manager",
    "workshop manager", "general manager", "after sales director", "aftersales manager",
    "receptionist",
  ],
  workflowIndex: WORKFLOW.JOB_CREATE,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Start the operational record once",
      body: "A service advisor captures vehicle, customer, requests and job type once. That job card then drives workshop, VHC, parts, messaging and invoice workflows.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"create-reg-lookup\"]",
      position: "right",
      title: "Vehicle lookup from registration",
      body: "Registration lookup pulls make, model, VIN, MOT expiry and history so staff are not re-typing data already held by the system.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"create-customer-lookup\"]",
      position: "right",
      title: "Customer lookup",
      body: "Returning customers are found by name, phone or registration, keeping vehicle and contact history connected to the new job.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"create-submit\"]",
      position: "top",
      title: "Save creates the shared job",
      body: "Saving generates the job number and makes the work visible to the departments that need it next.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Removes duplicate entry",
      body: "The same details no longer need to be written on a paper card, diary entry and workshop board.",
    },
  ],
};
