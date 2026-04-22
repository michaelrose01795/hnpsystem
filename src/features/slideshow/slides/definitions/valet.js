import { WORKFLOW } from "../workflow";

export const valetSlide = {
  id: "valet",
  route: "/valet",
  title: "Valet Queue",
  roles: ["admin", "admin manager", "owner", "valet service", "valet sales", "service manager", "workshop manager"],
  workflowIndex: WORKFLOW.VALET,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Vehicles awaiting valet",
      body: "A prioritised queue for the valet team — which cars need cleaning before handover, for collection, or for the forecourt. No more sticky notes on keys.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Clear priorities",
      body: "Customer collecting at 2pm shows up in red. Forecourt prep is amber. Nothing gets missed.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Clean handover",
      body: "Valet marks the car ready and reception sees it instantly — no walk-downs to the wash bay.",
    },
  ],
};
