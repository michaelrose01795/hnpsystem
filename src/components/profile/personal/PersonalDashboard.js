import React, { useCallback, useMemo, useState } from "react";
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
import usePersonalFinance from "@/hooks/usePersonalFinance";
import usePersonalWidgets from "@/hooks/usePersonalWidgets";
import { StatusBadge } from "@/components/profile/personal/widgets/shared";
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

function insightToneStyle(type) {
  if (type === "warning") return { background: "rgba(239, 108, 0, 0.12)", color: "var(--warning, #ef6c00)" };
  if (type === "positive") return { background: "rgba(46, 125, 50, 0.12)", color: "var(--success, #2e7d32)" };
  return { background: "rgba(21, 101, 192, 0.1)", color: "var(--info, #1565c0)" };
}

export default function PersonalDashboard({ dashboard }) {
  const widgetManager = usePersonalWidgets({
    widgets: dashboard.widgets,
    onSaveWidgets: dashboard.saveWidgets,
    onUpdateWidget: dashboard.updateWidget,
    onRemoveWidget: dashboard.removeWidget,
    onAddWidget: dashboard.addWidget,
  });
  const [settingsWidgetId, setSettingsWidgetId] = useState(null);
  const [isMoveMode, setIsMoveMode] = useState(false);

  const finance = usePersonalFinance({
    widgetDataMap: dashboard.widgetDataMap,
    workData: dashboard.workData,
    onSaveFinanceState: (data) => dashboard.saveWidgetData("net-position", data),
  });

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

  const handleReorderFromModal = useCallback(
    async (sourceId, targetId) => {
      if (!sourceId || !targetId || sourceId === targetId) return;
      const ordered = [...widgetManager.widgets].sort((a, b) => a.positionY - b.positionY || a.positionX - b.positionX);
      const sourceIndex = ordered.findIndex((entry) => entry.id === sourceId);
      const targetIndex = ordered.findIndex((entry) => entry.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
      const next = [...ordered];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      const withSlots = next.map((entry, index) => ({
        ...entry,
        positionX: (index % 2) + 1,
        positionY: Math.floor(index / 2) + 1,
      }));
      await widgetManager.persistLayout(withSlots);
    },
    [widgetManager]
  );

  const activeSettingsWidgetRecord = settingsWidgetId
    ? widgetManager.widgets.find((widget) => widget.id === settingsWidgetId) || null
    : null;
  const activeSettingsWidget = activeSettingsWidgetRecord
    ? PERSONAL_WIDGET_DEFINITIONS[activeSettingsWidgetRecord.widgetType] || null
    : null;

  const financeHeader = useMemo(
    () => (
      <div
        style={{
          borderRadius: "16px",
          border: "1px solid rgba(var(--accent-purple-rgb), 0.14)",
          background: "var(--surface)",
          padding: "14px",
          display: "grid",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "grid", gap: "4px" }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Personal planning</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
              Year <strong>{finance.model.selectedFinanceYear}</strong> · update cards and values in one flow.
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setIsMoveMode((current) => !current)}
              style={{
                borderRadius: "999px",
                border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
                background: isMoveMode ? "var(--accent-purple)" : "transparent",
                color: isMoveMode ? "#ffffff" : "var(--text-primary)",
                padding: "8px 12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {isMoveMode ? "Finish moving" : "Move cards"}
            </button>
            <MonthPicker value={finance.model.selectedMonthKey} onChange={finance.setSelectedMonth} align="right" />
          </div>
        </div>
      </div>
    ),
    [finance.model.selectedFinanceYear, finance.model.selectedMonthKey, finance.setSelectedMonth, isMoveMode]
  );

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {financeHeader}

      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {(finance.model.insights || []).map((insight, index) => (
          <div key={`${insight.type}-${index}`} style={{ borderRadius: "14px", padding: "12px 14px", ...insightToneStyle(insight.type) }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {insight.type}
              </div>
              <StatusBadge tone="neutral">{finance.model.selectedFinanceYear}</StatusBadge>
            </div>
            <div style={{ marginTop: "6px", fontWeight: 600, lineHeight: 1.45 }}>{insight.message}</div>
          </div>
        ))}
      </div>

      {visibleWidgets.length === 0 ? (
        <div
          style={{
            borderRadius: "18px",
            border: "1px dashed rgba(var(--accent-purple-rgb), 0.24)",
            padding: "20px",
            background: "var(--surface)",
            color: "var(--text-secondary)",
          }}
        >
          All cards are hidden. Use <strong>Add widget</strong> to restore them.
        </div>
      ) : (
        <WidgetGrid
          widgets={widgetManager.widgets}
          moveMode={isMoveMode}
          onReorder={handleReorderFromModal}
          renderWidget={(widget) => {
            const WidgetComponent = WIDGET_COMPONENTS[widget.widgetType] || CustomWidget;
            const widgetData = dashboard.widgetDataMap[widget.widgetType]?.data || {};

            return (
              <WidgetComponent
                widget={widget}
                widgetData={widgetData}
                widgetMonthKey={finance.model.selectedMonthKey}
                dashboardMonthKey={finance.model.selectedMonthKey}
                widgetDataMap={dashboard.widgetDataMap}
                datasets={datasets}
                actions={actions}
                onOpenSettings={() => setSettingsWidgetId(widget.id)}
                finance={finance}
              />
            );
          }}
        />
      )}

      <AddWidgetModal
        isOpen={dashboard.isAddWidgetOpen}
        widgets={widgetManager.widgets}
        visibleWidgetsByType={visibleWidgetsByType}
        onClose={dashboard.onCloseAddWidget}
        onReorder={handleReorderFromModal}
        onToggle={async (widgetType, isVisible) => {
          if (isVisible) {
            const visibleWidget = visibleWidgetsByType[widgetType];
            if (visibleWidget?.id) await widgetManager.removeWidget?.(visibleWidget.id);
            return;
          }
          await widgetManager.addWidget?.(widgetType);
        }}
      />

      <WidgetSettingsModal
        isOpen={Boolean(activeSettingsWidget)}
        widgetId={activeSettingsWidgetRecord?.id || null}
        widgetType={activeSettingsWidgetRecord?.widgetType || null}
        widgetLabel={activeSettingsWidget?.label}
        activeMonthKey={finance.model.selectedMonthKey}
        widgetIsVisible={activeSettingsWidgetRecord?.isVisible !== false}
        data={activeSettingsWidgetRecord ? dashboard.widgetDataMap[activeSettingsWidgetRecord.widgetType]?.data || {} : {}}
        onClose={() => setSettingsWidgetId(null)}
        onToggleVisibility={async (nextVisible) => {
          if (!activeSettingsWidgetRecord?.id) return;
          await dashboard.updateWidget(activeSettingsWidgetRecord.id, { isVisible: nextVisible });
          if (!nextVisible) setSettingsWidgetId(null);
        }}
        onSave={async (nextData) => {
          if (!activeSettingsWidgetRecord?.widgetType) return;
          await dashboard.saveWidgetData(activeSettingsWidgetRecord.widgetType, nextData);
        }}
      />
    </div>
  );
}
