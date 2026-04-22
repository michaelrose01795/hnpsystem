import { WORKFLOW } from "../workflow";

export const partsDeliveriesSlide = {
  id: "parts-deliveries",
  route: "/parts/deliveries",
  title: "Parts - Deliveries and Planner",
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
      kind: "tooltip",
      anchor: "[data-presentation=\"deliveries-day-controls\"]",
      position: "bottom",
      title: "Driver day controls",
      body: "The driver can move between days, see the selected run and understand how much work is queued before leaving the site.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"deliveries-list\"]",
      position: "top",
      title: "Route list with proof points",
      body: "Each stop shows customer, payment state, address, ETA and delivery status so the van run can be reordered without a separate sheet.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Fewer miles, more drops",
      body: "Clustered routing helps reduce daily mileage and gives managers a clearer view of what has actually been delivered.",
    },
  ],
};
