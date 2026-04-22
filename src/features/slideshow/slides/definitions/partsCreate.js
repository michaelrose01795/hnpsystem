import { WORKFLOW } from "../workflow";

export const partsCreateSlide = {
  id: "parts-create-order",
  route: "/parts/create-order",
  title: "Parts — Create Order",
  roles: ["admin", "admin manager", "owner", "parts", "parts manager", "service", "service manager", "workshop manager"],
  workflowIndex: WORKFLOW.PARTS_CREATE,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Request parts without phoning the counter",
      body: "A technician identifies a needed part from the VHC or job detail and requests it here. Parts staff see the request instantly — no phone tag, no scribbled sticky notes.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Live stock catalogue",
      body: "Parts already on the shelf are picked, not re-ordered. Reduces stock-holding cost and accidental duplicate orders.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Linked to the job",
      body: "Every part is tied to its job card automatically — no more 'which job was this for?' conversations.",
    },
  ],
};
