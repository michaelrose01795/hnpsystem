import { WORKFLOW } from "../workflow";

export const partsGoodsInSlide = {
  id: "parts-goods-in",
  route: "/parts/goods-in",
  title: "Parts — Goods In",
  roles: ["admin", "admin manager", "owner", "parts", "parts manager"],
  workflowIndex: WORKFLOW.PARTS_GOODS_IN,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Receiving stock",
      body: "Parts are checked in against the original order, matched to their job, and the technician is notified automatically that the part has arrived.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Automatic notifications",
      body: "Technician gets a real-time alert — no more parts sitting unnoticed on a shelf for half a day.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Discrepancy tracking",
      body: "Wrong parts, shortages, and damaged items are logged so supplier performance is measurable over time.",
    },
  ],
};
