import { WORKFLOW } from "../workflow";

export const partsCreateSlide = {
  id: "parts-create-order",
  route: "/parts/create-order",
  title: "Parts - Create Order",
  roles: ["admin", "admin manager", "owner", "parts", "parts manager", "service", "service manager", "workshop manager"],
  workflowIndex: WORKFLOW.PARTS_CREATE,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Request parts without phoning the counter",
      body: "A technician or advisor identifies a required part from the job or VHC and starts the order here. Parts staff see the request with the job context already attached.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"parts-customer-context\"]",
      position: "right",
      title: "Customer and job context",
      body: "The order keeps the customer, vehicle and job together so the parts desk is not guessing which car a part belongs to.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"parts-line-items\"]",
      position: "top",
      title: "Line items linked to stock",
      body: "Part number, quantity, supplier status and line total can be reviewed before submission, reducing duplicate ordering and missed margin.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Linked to the job",
      body: "Every part is tied to its job card automatically, removing the common 'which job was this for?' conversation.",
    },
  ],
};
