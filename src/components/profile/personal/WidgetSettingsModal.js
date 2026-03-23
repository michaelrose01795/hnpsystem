import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import {
  widgetButtonStyle,
  widgetGhostButtonStyle,
  widgetInputStyle,
  widgetSelectStyle,
  widgetTextAreaStyle,
} from "@/components/profile/personal/widgets/shared";
import {
  createPlanningOverride,
  createPlanningRule,
} from "@/lib/profile/calculations";
import { getCurrentMonthKey, normaliseMonthKey } from "@/lib/profile/monthPlanning";

const WIDGET_SETTINGS_PRESETS = {
  income: {
    settings: {
      baseMonthlyIncome: 0,
      useWorkEstimate: true,
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
    },
    ruleTemplates: [
      { category: "Base income", amount: 0 },
      { category: "Overtime", amount: 0 },
      { category: "Other income", amount: 0 },
    ],
  },
  spending: {
    settings: {
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
    },
    ruleTemplates: [
      { category: "Fuel", amount: 0 },
      { category: "Food", amount: 0 },
      { category: "Eating out", amount: 0 },
      { category: "Car costs", amount: 0 },
      { category: "Shopping", amount: 0 },
      { category: "Subscriptions", amount: 0 },
    ],
  },
  savings: {
    settings: {
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
      includeInNetPosition: true,
    },
    ruleTemplates: [
      { category: "House", amount: 0 },
      { category: "Emergency", amount: 0 },
      { category: "Holiday", amount: 0 },
      { category: "Car", amount: 0 },
    ],
  },
  bills: {
    settings: {
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
    },
    ruleTemplates: [
      { category: "Rent", amount: 0 },
      { category: "Phone", amount: 0 },
      { category: "Insurance", amount: 0 },
      { category: "Subscriptions", amount: 0 },
    ],
  },
  fuel: {
    settings: {
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
      expectedMileage: "",
      trendPct: "",
    },
    ruleTemplates: [{ category: "Fuel", amount: 0 }],
  },
  holiday: {
    settings: {
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
      targetAmount: 0,
      goalDate: "",
    },
    ruleTemplates: [{ category: "Holiday", amount: 0 }],
  },
  mortgage: {
    settings: {
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
      depositTarget: 0,
      housePriceTarget: 0,
    },
    ruleTemplates: [{ category: "House", amount: 0 }],
  },
  "net-position": {
    settings: {
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
      includeSavings: true,
      includeBills: true,
      includeFuel: true,
    },
    ruleTemplates: [],
  },
  chart: {
    settings: {
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
    },
    ruleTemplates: [],
  },
  "work-summary": {
    settings: {
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
      plannedHours: 0,
      plannedOvertimeHours: 0,
      useWorkEstimate: true,
    },
    ruleTemplates: [],
  },
  notes: {
    settings: {
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
    },
    ruleTemplates: [],
  },
  attachments: {
    settings: {
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
    },
    ruleTemplates: [],
  },
  custom: {
    settings: {
      useGlobalMonth: true,
      monthKey: getCurrentMonthKey(),
    },
    ruleTemplates: [],
  },
};

function buildInitialState(widgetType, data = {}, activeMonthKey = getCurrentMonthKey()) {
  const preset = WIDGET_SETTINGS_PRESETS[widgetType] || WIDGET_SETTINGS_PRESETS.spending;
  const settings = {
    ...preset.settings,
    ...(data?.settings || {}),
    monthKey: normaliseMonthKey(data?.settings?.monthKey || activeMonthKey),
  };

  return {
    settings,
    rules:
      Array.isArray(data?.rules) && data.rules.length > 0
        ? data.rules.map((rule) => ({
            ...createPlanningRule(rule),
            ...rule,
            startMonth: normaliseMonthKey(rule.startMonth || activeMonthKey),
            endMonth: rule.endMonth ? normaliseMonthKey(rule.endMonth, activeMonthKey) : "",
          }))
        : preset.ruleTemplates.map((rule) =>
            createPlanningRule({
              ...rule,
              startMonth: activeMonthKey,
            })
          ),
    overrides:
      Array.isArray(data?.overrides) && data.overrides.length > 0
        ? data.overrides.map((override) => ({
            ...createPlanningOverride({
              category: override.category,
              monthKey: override.monthKey || activeMonthKey,
              amount: override.overrideJson?.amount ?? override.amount ?? 0,
              note: override.overrideJson?.note || "",
            }),
            ...override,
            monthKey: normaliseMonthKey(override.monthKey || activeMonthKey),
          }))
        : [],
  };
}

function CheckboxRow({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.84rem", fontWeight: 600 }}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ display: "grid", gap: "10px" }}>
      <div style={{ fontSize: "0.76rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function WidgetSettingsModal({
  isOpen,
  widgetId,
  widgetType,
  widgetLabel,
  activeMonthKey = getCurrentMonthKey(),
  widgetIsVisible = true,
  data = {},
  onClose,
  onSave,
  onToggleVisibility,
}) {
  useBodyModalLock(isOpen);
  const [draft, setDraft] = useState(buildInitialState(widgetType, data, activeMonthKey));

  useEffect(() => {
    if (isOpen) {
      setDraft(buildInitialState(widgetType, data, activeMonthKey));
    }
  }, [activeMonthKey, data, isOpen, widgetType]);

  const previewMonthKey = useMemo(
    () => normaliseMonthKey(draft.settings?.monthKey || activeMonthKey),
    [activeMonthKey, draft.settings]
  );

  if (!isOpen) return null;

  const updateSetting = (key, value) => {
    setDraft((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: value,
      },
    }));
  };

  const updateRule = (id, key, value) => {
    setDraft((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.id === id ? { ...rule, [key]: value } : rule)),
    }));
  };

  const updateOverride = (id, key, value) => {
    setDraft((current) => ({
      ...current,
      overrides: current.overrides.map((override) =>
        override.id === id
          ? key === "amount" || key === "note"
            ? {
                ...override,
                overrideJson: {
                  ...override.overrideJson,
                  [key]: value,
                },
              }
            : { ...override, [key]: value }
          : override
      ),
    }));
  };

  const handleSave = async () => {
    await onSave?.({
      ...data,
      settings: {
        ...data?.settings,
        ...draft.settings,
      },
      rules: draft.rules.map((rule) => ({
        ...rule,
        amount: Number(rule.amount || 0),
      })),
      overrides: draft.overrides.map((override) => ({
        ...override,
        monthKey: normaliseMonthKey(override.monthKey || previewMonthKey),
        overrideJson: {
          ...override.overrideJson,
          amount: Number(override.overrideJson?.amount || 0),
        },
      })),
    });
    onClose?.();
  };

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.58)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 2100,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "920px",
          maxHeight: "84vh",
          overflowY: "auto",
          background: "var(--surface)",
          borderRadius: "24px",
          border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
          boxShadow: "var(--shadow-lg)",
          padding: "22px",
          display: "grid",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{widgetLabel || "Widget"} settings</div>
            <div style={{ color: "var(--text-secondary)", lineHeight: 1.5, fontSize: "0.86rem" }}>
              Configure recurring rules, month overrides, and whether this widget follows the shared dashboard month.
            </div>
          </div>
          <button type="button" onClick={onClose} style={widgetGhostButtonStyle}>
            Close
          </button>
        </div>

        <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <Section title="General">
            <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
              Widget ID: {widgetId || "—"}
            </div>
            <CheckboxRow
              label="Use dashboard month"
              checked={draft.settings.useGlobalMonth !== false}
              onChange={(checked) => updateSetting("useGlobalMonth", checked)}
            />
            {"detailRows" in draft.settings ? null : (
              <CheckboxRow
                label="Show detail rows in widget"
                checked={draft.settings.showDetailRows !== false}
                onChange={(checked) => updateSetting("showDetailRows", checked)}
              />
            )}
            <div style={{ display: "grid", gap: "8px" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Widget month</div>
              <input
                type="month"
                disabled={draft.settings.useGlobalMonth !== false}
                value={previewMonthKey}
                onChange={(event) => updateSetting("monthKey", event.target.value)}
                style={widgetInputStyle}
              />
            </div>
            {"baseMonthlyIncome" in draft.settings ? (
              <input
                type="number"
                value={draft.settings.baseMonthlyIncome}
                onChange={(event) => updateSetting("baseMonthlyIncome", event.target.value)}
                style={widgetInputStyle}
                placeholder="Base monthly income"
              />
            ) : null}
            {"expectedMileage" in draft.settings ? (
              <input
                type="number"
                value={draft.settings.expectedMileage}
                onChange={(event) => updateSetting("expectedMileage", event.target.value)}
                style={widgetInputStyle}
                placeholder="Expected monthly mileage"
              />
            ) : null}
            {"trendPct" in draft.settings ? (
              <input
                type="number"
                value={draft.settings.trendPct}
                onChange={(event) => updateSetting("trendPct", event.target.value)}
                style={widgetInputStyle}
                placeholder="Expected cost trend %"
              />
            ) : null}
            {"targetAmount" in draft.settings ? (
              <input
                type="number"
                value={draft.settings.targetAmount}
                onChange={(event) => updateSetting("targetAmount", event.target.value)}
                style={widgetInputStyle}
                placeholder="Target amount"
              />
            ) : null}
            {"goalDate" in draft.settings ? (
              <input
                type="date"
                value={draft.settings.goalDate}
                onChange={(event) => updateSetting("goalDate", event.target.value)}
                style={widgetInputStyle}
              />
            ) : null}
            {"depositTarget" in draft.settings ? (
              <input
                type="number"
                value={draft.settings.depositTarget}
                onChange={(event) => updateSetting("depositTarget", event.target.value)}
                style={widgetInputStyle}
                placeholder="Deposit target"
              />
            ) : null}
            {"housePriceTarget" in draft.settings ? (
              <input
                type="number"
                value={draft.settings.housePriceTarget}
                onChange={(event) => updateSetting("housePriceTarget", event.target.value)}
                style={widgetInputStyle}
                placeholder="House price target"
              />
            ) : null}
            {"plannedHours" in draft.settings ? (
              <input
                type="number"
                value={draft.settings.plannedHours}
                onChange={(event) => updateSetting("plannedHours", event.target.value)}
                style={widgetInputStyle}
                placeholder="Planned hours"
              />
            ) : null}
            {"plannedOvertimeHours" in draft.settings ? (
              <input
                type="number"
                value={draft.settings.plannedOvertimeHours}
                onChange={(event) => updateSetting("plannedOvertimeHours", event.target.value)}
                style={widgetInputStyle}
                placeholder="Planned overtime hours"
              />
            ) : null}
            {"useWorkEstimate" in draft.settings ? (
              <CheckboxRow
                label="Use work-linked estimate when available"
                checked={draft.settings.useWorkEstimate !== false}
                onChange={(checked) => updateSetting("useWorkEstimate", checked)}
              />
            ) : null}
            {widgetType === "work-summary" || widgetType === "income" ? (
              <>
                <input
                  type="number"
                  value={draft.settings.contractedWeeklyHours || ""}
                  onChange={(event) => updateSetting("contractedWeeklyHours", event.target.value)}
                  style={widgetInputStyle}
                  placeholder="Contracted weekly hours (fallback)"
                />
                <input
                  type="number"
                  value={draft.settings.hourlyRate || ""}
                  onChange={(event) => updateSetting("hourlyRate", event.target.value)}
                  style={widgetInputStyle}
                  placeholder="Hourly rate override"
                />
                <input
                  type="number"
                  value={draft.settings.overtimeRate || ""}
                  onChange={(event) => updateSetting("overtimeRate", event.target.value)}
                  style={widgetInputStyle}
                  placeholder="Overtime rate override"
                />
                <input
                  type="number"
                  value={draft.settings.taxRate || ""}
                  onChange={(event) => updateSetting("taxRate", event.target.value)}
                  style={widgetInputStyle}
                  placeholder="Tax % estimate"
                />
                <input
                  type="number"
                  value={draft.settings.niRate || ""}
                  onChange={(event) => updateSetting("niRate", event.target.value)}
                  style={widgetInputStyle}
                  placeholder="National insurance % estimate"
                />
              </>
            ) : null}
            {"includeSavings" in draft.settings ? (
              <CheckboxRow
                label="Include savings in net position"
                checked={draft.settings.includeSavings !== false}
                onChange={(checked) => updateSetting("includeSavings", checked)}
              />
            ) : null}
            {"includeBills" in draft.settings ? (
              <CheckboxRow
                label="Include bills in net position"
                checked={draft.settings.includeBills !== false}
                onChange={(checked) => updateSetting("includeBills", checked)}
              />
            ) : null}
            {"includeFuel" in draft.settings ? (
              <CheckboxRow
                label="Include fuel in net position"
                checked={draft.settings.includeFuel !== false}
                onChange={(checked) => updateSetting("includeFuel", checked)}
              />
            ) : null}
            <div style={{ paddingTop: "6px", borderTop: "1px dashed rgba(var(--accent-purple-rgb), 0.24)" }}>
              <CheckboxRow
                label="Widget visible"
                checked={widgetIsVisible !== false}
                onChange={(checked) => onToggleVisibility?.(checked)}
              />
              <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "6px" }}>
                Hide is managed here so widget cards stay uncluttered.
              </div>
            </div>
          </Section>

          <Section title="Recurring rules">
            {draft.rules.length === 0 ? (
              <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>This widget currently uses only direct data and month overrides.</div>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {draft.rules.map((rule) => (
                  <div key={rule.id} style={{ display: "grid", gap: "8px", borderRadius: "16px", padding: "12px", background: "rgba(var(--accent-purple-rgb), 0.05)" }}>
                    <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "1.4fr 1fr" }}>
                      <input
                        value={rule.category}
                        onChange={(event) => updateRule(rule.id, "category", event.target.value)}
                        style={widgetInputStyle}
                        placeholder="Category"
                      />
                      <input
                        type="number"
                        value={rule.amount}
                        onChange={(event) => updateRule(rule.id, "amount", event.target.value)}
                        style={widgetInputStyle}
                        placeholder="Monthly amount"
                      />
                    </div>
                    <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(3, minmax(0, 1fr)) auto" }}>
                      <input
                        type="month"
                        value={rule.startMonth}
                        onChange={(event) => updateRule(rule.id, "startMonth", event.target.value)}
                        style={widgetInputStyle}
                      />
                      <input
                        type="month"
                        value={rule.endMonth || ""}
                        onChange={(event) => updateRule(rule.id, "endMonth", event.target.value)}
                        style={widgetInputStyle}
                      />
                      <select
                        value={rule.recurrenceType || "monthly"}
                        onChange={(event) => updateRule(rule.id, "recurrenceType", event.target.value)}
                        style={widgetSelectStyle}
                      >
                        <option value="monthly">Monthly</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            rules: current.rules.filter((entry) => entry.id !== rule.id),
                          }))
                        }
                        style={widgetGhostButtonStyle}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  rules: [...current.rules, createPlanningRule({ startMonth: previewMonthKey })],
                }))
              }
              style={{ ...widgetGhostButtonStyle, alignSelf: "flex-start" }}
            >
              Add recurring rule
            </button>
          </Section>
        </div>

        {widgetType === "savings" ? (
          <Section title="Savings accounts">
            <div style={{ display: "grid", gap: "10px" }}>
              {(draft.settings.savingsAccounts || []).map((account, index) => (
                <div key={`${account?.name || "account"}-${index}`} style={{ display: "grid", gap: "8px", gridTemplateColumns: "1fr auto" }}>
                  <input
                    value={account?.name || ""}
                    onChange={(event) =>
                      updateSetting(
                        "savingsAccounts",
                        (draft.settings.savingsAccounts || []).map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, name: event.target.value } : entry
                        )
                      )
                    }
                    style={widgetInputStyle}
                    placeholder="Account name"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateSetting(
                        "savingsAccounts",
                        (draft.settings.savingsAccounts || []).filter((_, entryIndex) => entryIndex !== index)
                      )
                    }
                    style={widgetGhostButtonStyle}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateSetting("savingsAccounts", [
                    ...(draft.settings.savingsAccounts || []),
                    { name: "New account", type: "savings", hidden: false },
                  ])
                }
                style={{ ...widgetGhostButtonStyle, alignSelf: "flex-start" }}
              >
                Add account
              </button>
            </div>
          </Section>
        ) : null}

        {widgetType === "fuel" ? (
          <Section title="Fuel defaults">
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <input
                type="number"
                value={draft.settings.defaultFuelBudget || ""}
                onChange={(event) => updateSetting("defaultFuelBudget", event.target.value)}
                style={widgetInputStyle}
                placeholder="Default fuel budget"
              />
              <input
                value={draft.settings.defaultFuelStation || ""}
                onChange={(event) => updateSetting("defaultFuelStation", event.target.value)}
                style={widgetInputStyle}
                placeholder="Default station label"
              />
            </div>
          </Section>
        ) : null}

        <Section title="Month overrides">
          <div style={{ display: "grid", gap: "10px" }}>
            {draft.overrides.length === 0 ? (
              <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                No one-off overrides yet. Add one when a specific month should differ from the normal recurring plan.
              </div>
            ) : (
              draft.overrides.map((override) => (
                <div key={override.id} style={{ display: "grid", gap: "8px", borderRadius: "16px", padding: "12px", background: "rgba(var(--accent-purple-rgb), 0.05)" }}>
                  <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "1.2fr 1fr 1fr auto" }}>
                    <input
                      value={override.category}
                      onChange={(event) => updateOverride(override.id, "category", event.target.value)}
                      style={widgetInputStyle}
                      placeholder="Category"
                    />
                    <input
                      type="month"
                      value={override.monthKey}
                      onChange={(event) => updateOverride(override.id, "monthKey", event.target.value)}
                      style={widgetInputStyle}
                    />
                    <input
                      type="number"
                      value={override.overrideJson?.amount ?? 0}
                      onChange={(event) => updateOverride(override.id, "amount", event.target.value)}
                      style={widgetInputStyle}
                      placeholder="Override amount"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          overrides: current.overrides.filter((entry) => entry.id !== override.id),
                        }))
                      }
                      style={widgetGhostButtonStyle}
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    value={override.overrideJson?.note || ""}
                    onChange={(event) => updateOverride(override.id, "note", event.target.value)}
                    style={widgetTextAreaStyle}
                    placeholder="Optional note for this month"
                  />
                </div>
              ))
            )}
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  overrides: [
                    ...current.overrides,
                    createPlanningOverride({
                      monthKey: previewMonthKey,
                    }),
                  ],
                }))
              }
              style={{ ...widgetGhostButtonStyle, alignSelf: "flex-start" }}
            >
              Add month override
            </button>
          </div>
        </Section>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
          <button type="button" onClick={onClose} style={widgetGhostButtonStyle}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} style={widgetButtonStyle}>
            Save settings
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
