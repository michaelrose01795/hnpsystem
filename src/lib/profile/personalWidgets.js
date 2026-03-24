const GRID_COLUMNS = 2;
const FIXED_WIDGET_WIDTH = 1;
const FIXED_WIDGET_HEIGHT = 1;

const createDefinition = ({
  type,
  label,
  description,
  category,
  accent,
  defaultConfig = {},
  defaultData = {},
}) => ({
  type,
  label,
  description,
  category,
  defaultWidth: FIXED_WIDGET_WIDTH,
  defaultHeight: FIXED_WIDGET_HEIGHT,
  minWidth: FIXED_WIDGET_WIDTH,
  minHeight: FIXED_WIDGET_HEIGHT,
  accent,
  defaultConfig,
  defaultData,
});

export const PERSONAL_WIDGET_DEFINITIONS = {
  income: createDefinition({
    type: "income",
    label: "Income",
    description: "Tracks monthly income, salary estimates, and manual overrides.",
    category: "money",
    accent: "var(--success, #2e7d32)",
    defaultData: { manualMonthlyIncome: 0 },
  }),
  "work-summary": createDefinition({
    type: "work-summary",
    label: "Overtime",
    description: "Tracks overtime entries and attendance-linked overtime totals.",
    category: "work",
    accent: "var(--accent-purple)",
  }),
  spending: createDefinition({
    type: "spending",
    label: "Outgoings",
    description: "Shows expenses, category splits, and monthly burn rate.",
    category: "money",
    accent: "var(--danger, #c62828)",
  }),
  savings: createDefinition({
    type: "savings",
    label: "Savings",
    description: "Tracks current savings against a target and monthly contributions.",
    category: "money",
    accent: "var(--info, #1565c0)",
  }),
  bills: createDefinition({
    type: "bills",
    label: "Payments",
    description: "Lists recurring bills and the total due each month.",
    category: "money",
    accent: "var(--warning, #ef6c00)",
  }),
  fuel: createDefinition({
    type: "fuel",
    label: "Credit Cards",
    description: "Highlights fuel spending and recent cost changes.",
    category: "money",
    accent: "var(--warning, #ff8f00)",
  }),
  mortgage: createDefinition({
    type: "mortgage",
    label: "Mortgage",
    description: "Tracks mortgage-related goals and recurring outgoings.",
    category: "goals",
    accent: "var(--text-primary)",
    defaultData: { monthlyPayment: 0 },
  }),
  holiday: createDefinition({
    type: "holiday",
    label: "Holiday Tracking",
    description: "Tracks leave dates, days taken, and remaining allowance from Work tab records.",
    category: "goals",
    accent: "var(--info, #00838f)",
  }),
  custom: createDefinition({
    type: "custom",
    label: "Custom",
    description: "A free-form widget for bespoke amounts, targets, and notes.",
    category: "custom",
    accent: "var(--accent-purple)",
    defaultConfig: { title: "Custom widget" },
    defaultData: { amount: 0, target: 0, note: "" },
  }),
  "net-position": createDefinition({
    type: "net-position",
    label: "Net Position",
    description: "Combines income, spending, bills, and savings into a single view.",
    category: "money",
    accent: "var(--success, #388e3c)",
  }),
  chart: createDefinition({
    type: "chart",
    label: "Chart",
    description: "Visualises spending and savings trends.",
    category: "analytics",
    accent: "var(--info, #1e88e5)",
    defaultData: { chartType: "doughnut", source: "spendingByCategory" },
  }),
  notes: createDefinition({
    type: "notes",
    label: "Notes",
    description: "Stores private notes and reminders.",
    category: "notes",
    accent: "var(--text-primary)",
  }),
  attachments: createDefinition({
    type: "attachments",
    label: "Attachments",
    description: "Keeps private personal documents and files.",
    category: "files",
    accent: "var(--accent-purple)",
  }),
};

export const PERSONAL_WIDGET_TYPE_OPTIONS = Object.values(PERSONAL_WIDGET_DEFINITIONS);

export const DEFAULT_PERSONAL_WIDGET_TYPES = ["net-position", "income", "spending", "work-summary", "bills", "fuel", "savings"];

export function getWidgetDefinition(widgetType) {
  return PERSONAL_WIDGET_DEFINITIONS[widgetType] || PERSONAL_WIDGET_DEFINITIONS.custom;
}

export function buildDefaultWidgetConfig(widgetType) {
  const definition = getWidgetDefinition(widgetType);
  return {
    title: definition.label,
    ...definition.defaultConfig,
  };
}

export function buildDefaultWidgetData(widgetType) {
  const definition = getWidgetDefinition(widgetType);
  return {
    ...definition.defaultData,
  };
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function toSlotPosition(index) {
  return {
    positionX: (index % GRID_COLUMNS) + 1,
    positionY: Math.floor(index / GRID_COLUMNS) + 1,
  };
}

function toSlotIndex(positionX, positionY) {
  const safeX = Math.max(1, toInteger(positionX, 1));
  const safeY = Math.max(1, toInteger(positionY, 1));
  return (safeY - 1) * GRID_COLUMNS + (safeX - 1);
}

export function normaliseWidgetRecord(widget, index = 0) {
  const definition = getWidgetDefinition(widget?.widget_type || widget?.widgetType);
  const existingSlotIndex = toSlotIndex(widget?.position_x ?? widget?.positionX, widget?.position_y ?? widget?.positionY);
  const slot = toSlotPosition(Number.isFinite(existingSlotIndex) ? existingSlotIndex : index);

  return {
    id: widget?.id,
    userId: widget?.user_id ?? widget?.userId ?? null,
    widgetType: widget?.widget_type || widget?.widgetType,
    isVisible: widget?.is_visible !== false && widget?.isVisible !== false,
    positionX: slot.positionX,
    positionY: slot.positionY,
    width: FIXED_WIDGET_WIDTH,
    height: FIXED_WIDGET_HEIGHT,
    config: widget?.config_json || widget?.config || buildDefaultWidgetConfig(definition.type),
    createdAt: widget?.created_at || widget?.createdAt || null,
    updatedAt: widget?.updated_at || widget?.updatedAt || null,
  };
}

export function sortWidgetsForDisplay(widgets = []) {
  return [...widgets].sort((left, right) => {
    if (left.positionY !== right.positionY) return left.positionY - right.positionY;
    if (left.positionX !== right.positionX) return left.positionX - right.positionX;
    return String(left.widgetType || "").localeCompare(String(right.widgetType || ""));
  });
}

export function sanitiseWidgetLayout(widgets = []) {
  const visibleWidgets = [];
  const hiddenWidgets = [];

  (widgets || []).forEach((widget, index) => {
    const normalised = normaliseWidgetRecord(widget, index);
    if (normalised.isVisible === false) {
      hiddenWidgets.push(normalised);
      return;
    }
    visibleWidgets.push(normalised);
  });

  const orderedVisibleWidgets = sortWidgetsForDisplay(visibleWidgets).map((widget, index) => {
    const slot = toSlotPosition(index);
    return {
      ...widget,
      positionX: slot.positionX,
      positionY: slot.positionY,
      width: FIXED_WIDGET_WIDTH,
      height: FIXED_WIDGET_HEIGHT,
    };
  });

  return [...orderedVisibleWidgets, ...hiddenWidgets.map((widget) => ({
    ...widget,
    width: FIXED_WIDGET_WIDTH,
    height: FIXED_WIDGET_HEIGHT,
  }))];
}

export function getNextWidgetPlacement(existingWidgets = []) {
  const visibleWidgets = sanitiseWidgetLayout(existingWidgets).filter((widget) => widget.isVisible !== false);
  const slot = toSlotPosition(visibleWidgets.length);

  return {
    positionX: slot.positionX,
    positionY: slot.positionY,
    width: FIXED_WIDGET_WIDTH,
    height: FIXED_WIDGET_HEIGHT,
  };
}

export function buildDefaultWidgets(userId) {
  return DEFAULT_PERSONAL_WIDGET_TYPES.map((widgetType, index) => {
    const slot = toSlotPosition(index);
    return {
      user_id: userId,
      widget_type: widgetType,
      is_visible: true,
      position_x: slot.positionX,
      position_y: slot.positionY,
      width: FIXED_WIDGET_WIDTH,
      height: FIXED_WIDGET_HEIGHT,
      config_json: buildDefaultWidgetConfig(widgetType),
    };
  });
}

export function buildWidgetDataMap(rows = []) {
  return rows.reduce((accumulator, row) => {
    const widgetType = row?.widget_type || row?.widgetType;
    if (!widgetType) {
      return accumulator;
    }

    accumulator[widgetType] = {
      id: row?.id,
      widgetType,
      data: row?.data_json || row?.data || buildDefaultWidgetData(widgetType),
      updatedAt: row?.updated_at || row?.updatedAt || null,
    };
    return accumulator;
  }, {});
}

export function ensureWidgetDataDefaults(widgetTypes = [], widgetDataMap = {}) {
  return widgetTypes.reduce((accumulator, widgetType) => {
    accumulator[widgetType] = widgetDataMap[widgetType] || {
      id: null,
      widgetType,
      data: buildDefaultWidgetData(widgetType),
      updatedAt: null,
    };
    return accumulator;
  }, { ...widgetDataMap });
}
