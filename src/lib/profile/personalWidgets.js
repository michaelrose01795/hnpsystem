const GRID_COLUMNS = 12;

const createDefinition = ({
  type,
  label,
  description,
  category,
  defaultWidth,
  defaultHeight,
  minWidth = 2,
  minHeight = 1,
  accent,
  defaultConfig = {},
  defaultData = {},
}) => ({
  type,
  label,
  description,
  category,
  defaultWidth,
  defaultHeight,
  minWidth,
  minHeight,
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
    defaultWidth: 4,
    defaultHeight: 3,
    accent: "var(--success, #2e7d32)",
    defaultData: { manualMonthlyIncome: 0 },
  }),
  "work-summary": createDefinition({
    type: "work-summary",
    label: "Work Summary",
    description: "Summarises hours worked, overtime, leave, and estimated pay.",
    category: "work",
    defaultWidth: 4,
    defaultHeight: 3,
    accent: "var(--accent-purple)",
  }),
  spending: createDefinition({
    type: "spending",
    label: "Spending",
    description: "Shows expenses, category splits, and monthly burn rate.",
    category: "money",
    defaultWidth: 4,
    defaultHeight: 3,
    accent: "var(--danger, #c62828)",
  }),
  savings: createDefinition({
    type: "savings",
    label: "Savings",
    description: "Tracks current savings against a target and monthly contributions.",
    category: "money",
    defaultWidth: 4,
    defaultHeight: 3,
    accent: "var(--info, #1565c0)",
  }),
  bills: createDefinition({
    type: "bills",
    label: "Bills",
    description: "Lists recurring bills and the total due each month.",
    category: "money",
    defaultWidth: 4,
    defaultHeight: 3,
    accent: "var(--warning, #ef6c00)",
  }),
  fuel: createDefinition({
    type: "fuel",
    label: "Fuel",
    description: "Highlights fuel spending and recent cost changes.",
    category: "money",
    defaultWidth: 4,
    defaultHeight: 3,
    accent: "var(--warning, #ff8f00)",
  }),
  mortgage: createDefinition({
    type: "mortgage",
    label: "Mortgage",
    description: "Tracks mortgage-related goals and recurring outgoings.",
    category: "goals",
    defaultWidth: 4,
    defaultHeight: 3,
    accent: "var(--text-primary)",
    defaultData: { monthlyPayment: 0 },
  }),
  holiday: createDefinition({
    type: "holiday",
    label: "Holiday",
    description: "Tracks holiday savings goals and deadlines.",
    category: "goals",
    defaultWidth: 4,
    defaultHeight: 3,
    accent: "var(--info, #00838f)",
  }),
  custom: createDefinition({
    type: "custom",
    label: "Custom",
    description: "A free-form widget for bespoke amounts, targets, and notes.",
    category: "custom",
    defaultWidth: 4,
    defaultHeight: 3,
    accent: "var(--accent-purple)",
    defaultConfig: { title: "Custom widget" },
    defaultData: { amount: 0, target: 0, note: "" },
  }),
  "net-position": createDefinition({
    type: "net-position",
    label: "Net Position",
    description: "Combines income, spending, bills, and savings into a single view.",
    category: "money",
    defaultWidth: 4,
    defaultHeight: 3,
    accent: "var(--success, #388e3c)",
  }),
  chart: createDefinition({
    type: "chart",
    label: "Chart",
    description: "Visualises spending and savings trends.",
    category: "analytics",
    defaultWidth: 8,
    defaultHeight: 3,
    minWidth: 4,
    minHeight: 2,
    accent: "var(--info, #1e88e5)",
    defaultData: { chartType: "doughnut", source: "spendingByCategory" },
  }),
  notes: createDefinition({
    type: "notes",
    label: "Notes",
    description: "Stores private notes and reminders.",
    category: "notes",
    defaultWidth: 8,
    defaultHeight: 3,
    minWidth: 4,
    minHeight: 2,
    accent: "var(--text-primary)",
  }),
  attachments: createDefinition({
    type: "attachments",
    label: "Attachments",
    description: "Keeps private personal documents and files.",
    category: "files",
    defaultWidth: 8,
    defaultHeight: 3,
    minWidth: 4,
    minHeight: 2,
    accent: "var(--accent-purple)",
  }),
};

export const PERSONAL_WIDGET_TYPE_OPTIONS = Object.values(PERSONAL_WIDGET_DEFINITIONS);

export const DEFAULT_PERSONAL_WIDGET_TYPES = [
  "income",
  "spending",
  "savings",
  "net-position",
  "notes",
];

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function normaliseWidgetRecord(widget, index = 0) {
  const definition = getWidgetDefinition(widget?.widget_type || widget?.widgetType);
  const width = clamp(
    toInteger(widget?.width, definition.defaultWidth),
    definition.minWidth,
    GRID_COLUMNS
  );
  const height = clamp(
    toInteger(widget?.height, definition.defaultHeight),
    definition.minHeight,
    10
  );
  const positionX = clamp(
    toInteger(widget?.position_x ?? widget?.positionX, 1),
    1,
    Math.max(1, GRID_COLUMNS - width + 1)
  );
  const fallbackY = 1 + Math.floor(index / 3) * 3;
  const positionY = clamp(
    toInteger(widget?.position_y ?? widget?.positionY, fallbackY),
    1,
    100
  );

  return {
    id: widget?.id,
    userId: widget?.user_id ?? widget?.userId ?? null,
    widgetType: widget?.widget_type || widget?.widgetType,
    isVisible: widget?.is_visible !== false && widget?.isVisible !== false,
    positionX,
    positionY,
    width,
    height,
    config: widget?.config_json || widget?.config || buildDefaultWidgetConfig(definition.type),
    createdAt: widget?.created_at || widget?.createdAt || null,
    updatedAt: widget?.updated_at || widget?.updatedAt || null,
  };
}

function rangesOverlap(startA, spanA, startB, spanB) {
  const endA = startA + spanA - 1;
  const endB = startB + spanB - 1;
  return startA <= endB && startB <= endA;
}

function widgetsOverlap(a, b) {
  return (
    rangesOverlap(a.positionX, a.width, b.positionX, b.width) &&
    rangesOverlap(a.positionY, a.height, b.positionY, b.height)
  );
}

export function sanitiseWidgetLayout(widgets = []) {
  const visible = [];
  const hidden = [];

  widgets.forEach((widget, index) => {
    const normalised = normaliseWidgetRecord(widget, index);
    if (!normalised.isVisible) {
      hidden.push(normalised);
      return;
    }

    let candidate = { ...normalised };
    let safetyCounter = 0;
    while (visible.some((placed) => widgetsOverlap(candidate, placed)) && safetyCounter < 500) {
      candidate.positionY += 1;
      safetyCounter += 1;
    }

    visible.push(candidate);
  });

  return [...visible, ...hidden];
}

export function sortWidgetsForDisplay(widgets = []) {
  return [...widgets].sort((left, right) => {
    if (left.positionY !== right.positionY) return left.positionY - right.positionY;
    if (left.positionX !== right.positionX) return left.positionX - right.positionX;
    return String(left.widgetType || "").localeCompare(String(right.widgetType || ""));
  });
}

export function getNextWidgetPlacement(existingWidgets = [], widgetType) {
  const definition = getWidgetDefinition(widgetType);
  const visibleWidgets = existingWidgets.filter((widget) => widget.isVisible !== false);
  const maxRowEnd = visibleWidgets.reduce((largest, widget) => {
    const normalised = normaliseWidgetRecord(widget);
    return Math.max(largest, normalised.positionY + normalised.height - 1);
  }, 0);

  return {
    positionX: 1,
    positionY: maxRowEnd + 1,
    width: definition.defaultWidth,
    height: definition.defaultHeight,
  };
}

export function buildDefaultWidgets(userId) {
  const defaultRows = [];
  let nextY = 1;

  DEFAULT_PERSONAL_WIDGET_TYPES.forEach((widgetType, index) => {
    const definition = getWidgetDefinition(widgetType);
    defaultRows.push({
      user_id: userId,
      widget_type: widgetType,
      is_visible: true,
      position_x: index % 3 === 0 ? 1 : index % 3 === 1 ? 5 : 9,
      position_y: nextY,
      width: definition.defaultWidth,
      height: definition.defaultHeight,
      config_json: buildDefaultWidgetConfig(widgetType),
    });

    if (index % 3 === 2) {
      nextY += 3;
    }
  });

  return defaultRows;
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
