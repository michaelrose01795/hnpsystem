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
      body: "A prioritised queue shows which cars need cleaning before handover, collection or forecourt prep. No more sticky notes on keys.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"valet-filters\"]",
      position: "bottom",
      title: "Search and day filters",
      body: "Valet can narrow the queue by registration, customer or date so urgent collection work is easy to find.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"valet-table\"]",
      position: "top",
      title: "Operational checklist",
      body: "The row tracks whether the vehicle is here, through workshop, MOT complete and washed, with estimated technician completion visible to the team.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Clean handover",
      body: "Valet marks the car ready and reception sees it instantly, removing walk-downs to the wash bay.",
    },
  ],
};
