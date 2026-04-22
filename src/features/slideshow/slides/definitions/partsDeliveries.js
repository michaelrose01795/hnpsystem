import { WORKFLOW } from "../workflow";

export const partsDeliveriesSlide = {
  id: "parts-deliveries",
  route: "/parts/deliveries",
  title: "Parts — Deliveries & Planner",
  roles: ["admin", "admin manager", "owner", "parts", "parts manager", "parts driver"],
  workflowIndex: WORKFLOW.PARTS_DELIVERIES,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Route planning for drivers",
      body: "Collections and deliveries are grouped into efficient routes. Drivers see their run on a tablet with live status updates.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Fewer miles, more drops",
      body: "Clustered routing typically shaves 15–25% off daily mileage for parts drivers.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Proof of delivery",
      body: "Photo + signature captured at drop-off — disputes are resolved in seconds, not hours.",
    },
  ],
};
