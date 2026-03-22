import React, { useMemo, useState } from "react";
import AddWidgetModal from "@/components/profile/personal/AddWidgetModal";
import MonthPicker from "@/components/profile/personal/MonthPicker";
import WidgetGrid from "@/components/profile/personal/WidgetGrid";
import WidgetSettingsModal from "@/components/profile/personal/WidgetSettingsModal";
import AttachmentsWidget from "@/components/profile/personal/widgets/AttachmentsWidget";
import BillsWidget from "@/components/profile/personal/widgets/BillsWidget";
import ChartWidget from "@/components/profile/personal/widgets/ChartWidget";
import CustomWidget from "@/components/profile/personal/widgets/CustomWidget";
import FuelWidget from "@/components/profile/personal/widgets/FuelWidget";
import HolidayWidget from "@/components/profile/personal/widgets/HolidayWidget";
import IncomeWidget from "@/components/profile/personal/widgets/IncomeWidget";
import MortgageWidget from "@/components/profile/personal/widgets/MortgageWidget";
import NetPositionWidget from "@/components/profile/personal/widgets/NetPositionWidget";
import NotesWidget from "@/components/profile/personal/widgets/NotesWidget";
import SavingsWidget from "@/components/profile/personal/widgets/SavingsWidget";
import SpendingWidget from "@/components/profile/personal/widgets/SpendingWidget";
import WorkSummaryWidget from "@/components/profile/personal/widgets/WorkSummaryWidget";
import usePersonalWidgets from "@/hooks/usePersonalWidgets";
import { StatusBadge } from "@/components/profile/personal/widgets/shared";
import { buildPersonalInsights } from "@/lib/profile/insights";
import { getCurrentMonthKey, normaliseMonthKey } from "@/lib/profile/monthPlanning";
import { PERSONAL_WIDGET_DEFINITIONS } from "@/lib/profile/personalWidgets";

const WIDGET_COMPONENTS = {
  income: IncomeWidget,
  "work-summary": WorkSummaryWidget,
  spending: SpendingWidget,
  savings: SavingsWidget,
  bills: BillsWidget,
  fuel: FuelWidget,
  mortgage: MortgageWidget,
  holiday: HolidayWidget,
  custom: CustomWidget,
  "net-position": NetPositionWidget,
  chart: ChartWidget,
  notes: NotesWidget,
  attachments: AttachmentsWidget,
};

const CONFIGURABLE_WIDGET_TYPES = new Set([
  "income",
  "work-summary",
  "spending",
  "savings",
  "bills",
  "fuel",
  "mortgage",
  "holiday",
  "net-position",
  "chart",
]);

function insightToneStyle(type) {
  if (type === "warning") {
    return {
      background: "rgba(239, 108, 0, 0.12)",
      color: "var(--warning, #ef6c00)",
    };
  }
  if (type === "positive") {
    return {
      background: "rgba(46, 125, 50, 0.12)",
      color: "var(--success, #2e7d32)",
    };
  }
  return {
    background: "rgba(21, 101, 192, 0.1)",
    color: "var(--info, #1565c0)",
  };
}

function getWidgetMonthKey(widgetType, widgetData, globalMonthKey) {
  const settings = widgetData?.settings || {};
  if (settings.useGlobalMonth === false) {
    return normaliseMonthKey(settings.monthKey || globalMonthKey);
  }
  return normaliseMonthKey(globalMonthKey);
}

export default function PersonalDashboard({ dashboard }) {
  const widgetManager = usePersonalWidgets({
    widgets: dashboard.widgets,
    onSaveWidgets: dashboard.saveWidgets,
    onUpdateWidget: dashboard.updateWidget,
    onRemoveWidget: dashboard.removeWidget,
    onAddWidget: dashboard.addWidget,
  });
  const [selectedMonthKey, setSelectedMonthKey] = useState(getCurrentMonthKey());
  const [settingsWidgetType, setSettingsWidgetType] = useState(null);

  const visibleWidgets = widgetManager.widgets.filter((widget) => widget.isVisible !== false);
  const visibleWidgetsByType = visibleWidgets.reduce((accumulator, widget) => {
    accumulator[widget.widgetType] = widget;
    return accumulator;
  }, {});

  const datasets = {
    transactions: dashboard.transactions,
    bills: dashboard.bills,
    savings: dashboard.savings,
    goals: dashboard.goals,
    notes: dashboard.notes,
    attachments: dashboard.attachments,
    workData: dashboard.workData,
  };

  const actions = {
    saveWidgetData: dashboard.saveWidgetData,
    updateWidget: dashboard.updateWidget,
    createTransaction: dashboard.createTransaction,
    updateTransaction: dashboard.updateTransaction,
    deleteTransaction: dashboard.deleteTransaction,
    createBill: dashboard.createBill,
    updateBill: dashboard.updateBill,
    deleteBill: dashboard.deleteBill,
    saveSavings: dashboard.saveSavings,
    clearSavings: dashboard.clearSavings,
    createGoal: dashboard.createGoal,
    updateGoal: dashboard.updateGoal,
    deleteGoal: dashboard.deleteGoal,
    createNote: dashboard.createNote,
    updateNote: dashboard.updateNote,
    deleteNote: dashboard.deleteNote,
    uploadAttachment: dashboard.uploadAttachment,
    deleteAttachment: dashboard.deleteAttachment,
  };

  const insights = useMemo(
    () =>
      buildPersonalInsights({
        transactions: dashboard.transactions,
        bills: dashboard.bills,
        savings: dashboard.savings,
        goals: dashboard.goals,
        workData: dashboard.workData,
        widgetData: dashboard.widgetDataMap,
        monthKey: selectedMonthKey,
      }),
    [
      dashboard.bills,
      dashboard.goals,
      dashboard.savings,
      dashboard.transactions,
      dashboard.widgetDataMap,
      dashboard.workData,
      selectedMonthKey,
    ]
  );

  const activeSettingsWidget = settingsWidgetType
    ? PERSONAL_WIDGET_DEFINITIONS[settingsWidgetType] || null
    : null;

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "14px 16px",
          borderRadius: "18px",
          background: "var(--surface)",
          border: "1px solid rgba(var(--accent-purple-rgb), 0.14)",
        }}
      >
        <div style={{ display: "grid", gap: "6px" }}>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>Plan by month</div>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.84rem" }}>
            Switch months to compare actual activity with planned and projected values.
          </div>
        </div>
        <MonthPicker value={selectedMonthKey} onChange={setSelectedMonthKey} align="right" />
      </div>

      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {(insights || []).map((insight, index) => (
          <div
            key={`${insight.type}-${index}`}
            style={{
              borderRadius: "16px",
              padding: "14px 16px",
              ...insightToneStyle(insight.type),
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
              <div style={{ fontSize: "0.74rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {insight.type}
              </div>
              {insight.monthLabel ? <StatusBadge tone="neutral">{insight.monthLabel}</StatusBadge> : null}
            </div>
            <div style={{ marginTop: "6px", fontWeight: 600, lineHeight: 1.45 }}>{insight.message}</div>
          </div>
        ))}
      </div>

      {visibleWidgets.length === 0 ? (
        <div
          style={{
            borderRadius: "22px",
            border: "1px dashed rgba(var(--accent-purple-rgb), 0.24)",
            padding: "24px",
            background: "var(--surface)",
            color: "var(--text-secondary)",
          }}
        >
          All widgets are currently hidden. Use <strong>Add widget</strong> to restore them.
        </div>
      ) : (
        <WidgetGrid
          widgets={widgetManager.widgets}
          onWidgetsChange={widgetManager.setWidgets}
          onWidgetsCommit={widgetManager.persistLayout}
          renderWidget={(widget, controls) => {
            const WidgetComponent = WIDGET_COMPONENTS[widget.widgetType] || CustomWidget;
            const widgetData = dashboard.widgetDataMap[widget.widgetType]?.data || {};
            const widgetMonthKey = getWidgetMonthKey(widget.widgetType, widgetData, selectedMonthKey);

            return (
              <WidgetComponent
                widget={widget}
                widgetData={widgetData}
                widgetMonthKey={widgetMonthKey}
                dashboardMonthKey={selectedMonthKey}
                widgetDataMap={dashboard.widgetDataMap}
                datasets={datasets}
                actions={actions}
                onOpenSettings={
                  CONFIGURABLE_WIDGET_TYPES.has(widget.widgetType)
                    ? () => setSettingsWidgetType(widget.widgetType)
                    : null
                }
                onRemove={() => widgetManager.removeWidget?.(widget.id)}
                dragHandleProps={controls.dragHandleProps}
                resizeHandleProps={controls.resizeHandleProps}
                compact={controls.compact}
              />
            );
          }}
        />
      )}

      <AddWidgetModal
        isOpen={dashboard.isAddWidgetOpen}
        visibleWidgetsByType={visibleWidgetsByType}
        onClose={dashboard.onCloseAddWidget}
        onToggle={async (widgetType, isVisible) => {
          if (isVisible) {
            const visibleWidget = visibleWidgetsByType[widgetType];
            if (visibleWidget?.id) {
              await widgetManager.removeWidget?.(visibleWidget.id);
            }
            return;
          }
          await widgetManager.addWidget?.(widgetType);
        }}
      />

      <WidgetSettingsModal
        isOpen={Boolean(activeSettingsWidget)}
        widgetType={settingsWidgetType}
        widgetLabel={activeSettingsWidget?.label}
        activeMonthKey={selectedMonthKey}
        data={settingsWidgetType ? dashboard.widgetDataMap[settingsWidgetType]?.data || {} : {}}
        onClose={() => setSettingsWidgetType(null)}
        onSave={async (nextData) => {
          if (!settingsWidgetType) return;
          await dashboard.saveWidgetData(settingsWidgetType, nextData);
        }}
      />
    </div>
  );
}
