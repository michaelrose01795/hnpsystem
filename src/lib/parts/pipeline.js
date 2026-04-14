// Shared metadata for the parts pipeline stages used across the workspace, manager, and job views.
export const PARTS_PIPELINE_STAGES = [
  {
    id: "waiting_authorisation",
    label: "Waiting Authorisation",
    description: "Require VHC approval before ordering.",
    statuses: ["waiting_authorisation"],
  },
  {
    id: "waiting_to_order",
    label: "Waiting to Order",
    description: "Authorised but waiting for purchase order or stock allocation.",
    statuses: ["pending", "awaiting_stock"],
  },
  {
    id: "on_order",
    label: "On Order",
    description: "Order placed with suppliers and inbound.",
    statuses: ["on_order"],
  },
  {
    id: "pre_picked",
    label: "Pre Picked",
    description: "Prep complete and ready for fitting.",
    statuses: ["pre_picked", "picked"],
  },
  {
    id: "in_stock",
    label: "In Stock",
    description: "Stocked, allocated, or fitted on the job.",
    statuses: ["stock", "allocated", "fitted"],
  },
];

const normalizeStatus = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const stageLookup = PARTS_PIPELINE_STAGES.reduce((map, stage) => {
  map[stage.id] = stage;
  return map;
}, {});

export const mapPartStatusToPipelineId = (status = "") => {
  const normalized = normalizeStatus(status);
  for (const stage of PARTS_PIPELINE_STAGES) {
    if (stage.statuses.includes(normalized)) {
      return stage.id;
    }
  }
  return PARTS_PIPELINE_STAGES[0].id;
};

const resolveQuantity = (part, field) => {
  if (typeof field === "function") {
    return Number(field(part)) || 0;
  }
  if (typeof field === "string" && field.length > 0) {
    return Number(part?.[field] || 0);
  }
  return 0;
};

export const summarizePartsPipeline = (parts = [], options = {}) => {
  const { quantityField } = options;
  const stageSummaries = PARTS_PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: 0,
    parts: [],
  }));
  const stageMap = stageSummaries.reduce((map, stage) => {
    map[stage.id] = stage;
    return map;
  }, {});

  let totalCount = 0;

  (Array.isArray(parts) ? parts : []).forEach((part) => {
    if (!part) return;
    const stageId = mapPartStatusToPipelineId(part.status);
    const stage = stageMap[stageId] || stageMap[PARTS_PIPELINE_STAGES[0].id];
    const qty = resolveQuantity(part, quantityField);
    const increment = qty > 0 ? qty : 1;
    stage.count += increment;
    stage.parts.push(part);
    totalCount += increment;
  });

  return {
    stageSummary: stageSummaries,
    stageMap,
    totalCount,
  };
};

export const getPipelineStageMeta = (stageId) => stageLookup[stageId] || stageLookup[PARTS_PIPELINE_STAGES[0].id];
