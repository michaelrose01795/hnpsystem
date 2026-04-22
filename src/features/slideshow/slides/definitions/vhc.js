import { WORKFLOW } from "../workflow";

export const vhcSlide = {
  id: "vhc",
  route: "/customer/vhc",
  title: "Vehicle Health Check (VHC)",
  roles: null,
  workflowIndex: WORKFLOW.VHC,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Digital VHC",
      body: "Technicians run through a structured vehicle health check on a tablet — tyres, brakes, fluids, lights. Green / amber / red results attach to the job and generate a customer-facing report automatically.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Consistent process",
      body: "Every vehicle gets the same checks. No more variation between technicians or rushed VHCs at busy periods.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Upsell visibility",
      body: "Amber and red items surface directly to reception as upsell opportunities — typically 15–20% uplift on average ticket value.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Customer transparency",
      body: "The customer sees photos and a clear report. Trust, repeat business, better reviews.",
    },
  ],
};
