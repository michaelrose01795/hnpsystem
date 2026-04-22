import { WORKFLOW } from "../workflow";

export const partsGoodsInSlide = {
  id: "parts-goods-in",
  route: "/parts/goods-in",
  title: "Parts - Goods In",
  roles: ["admin", "admin manager", "owner", "parts", "parts manager", "service", "service manager", "workshop manager"],
  workflowIndex: WORKFLOW.PARTS_GOODS_IN,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Receiving stock",
      body: "Parts are checked in against the original order, matched to the job, and made visible to the technician without a phone call.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"goods-in-invoice\"]",
      position: "bottom",
      title: "Supplier invoice detail",
      body: "The goods-in screen captures supplier, invoice number, delivery note, franchise and notes in one place for audit and reconciliation.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"goods-in-add-part\"]",
      position: "top",
      title: "Add or reconcile part lines",
      body: "Line-level receiving makes shortages, backorders and wrong parts visible before they delay a job.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Automatic notifications",
      body: "When a part is marked in, the technician and service advisor can see it immediately. Nothing sits unnoticed on a shelf.",
    },
  ],
};
