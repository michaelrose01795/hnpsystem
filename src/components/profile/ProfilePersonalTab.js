import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import useIsMobile from "@/hooks/useIsMobile";
import usePersonalDashboard from "@/hooks/usePersonalDashboard";
import usePersonalTabModel from "@/hooks/usePersonalTabModel";
import usePersonalWidgets from "@/hooks/usePersonalWidgets";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import DropdownField from "@/components/dropdownAPI/DropdownField";
import WidgetSettingsModal from "@/components/profile/personal/WidgetSettingsModal";
import { formatMonthLabel, normaliseMonthKey, shiftMonthKey } from "@/lib/profile/calculations";
import { generateHeadline, generateInsights } from "@/lib/profile/personalInsights";
import { PERSONAL_WIDGET_DEFINITIONS, PERSONAL_WIDGET_TYPE_OPTIONS, sortWidgetsForDisplay } from "@/lib/profile/personalWidgets";
import Button from "@/components/ui/Button";
import {
  EmptyState,
  StatusBadge,
  widgetAccentSurfaceStyle,
  widgetInsetSurfaceStyle,
} from "@/components/profile/personal/widgets/shared";
import {
  AttachmentsWidget,
  BillsWidget,
  ChartWidget,
  CustomWidget,
  FuelWidget,
  HolidayWidget,
  IncomeWidget,
  MortgageWidget,
  NetPositionWidget,
  NotesWidget,
  SavingsWidget,
  SpendingWidget,
  WorkSummaryWidget,
} from "@/components/profile/personal/widgets/PersonalWidgets";

/* ── Widget component map ─────────────────────────────────────── */

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

/* ── PasscodeModal ────────────────────────────────────────────── */

const passcodeOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.64)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 2000,
};

const passcodeCardStyle = {
  width: "100%",
  maxWidth: "420px",
  background: "rgba(var(--surface-rgb), 0.98)",
  borderRadius: "22px",
  border: "1px solid rgba(var(--primary-rgb), 0.14)",
  boxShadow: "var(--shadow-lg)",
  padding: "24px",
  display: "grid",
  gap: "16px",
};

const passcodeInputStyle = {
  fontSize: "1.1rem",
  letterSpacing: "0.3em",
  textAlign: "center",
};

const toolbarButtonStyle = {
  minWidth: "112px",
};

function PasscodeModal({
  isOpen,
  mode = "unlock",
  isSubmitting = false,
  error = "",
  onSubmit,
  onClose,
}) {
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  useBodyModalLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    setPasscode("");
    setConfirmPasscode("");
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit?.({ passcode, confirmPasscode });
  };

  const modal = (
    <div style={passcodeOverlayStyle}>
      <form onSubmit={handleSubmit} style={passcodeCardStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
            {mode === "setup" ? "Create your personal passcode" : "Unlock personal dashboard"}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5 }}>
            {mode === "setup"
              ? "Set a 4-digit passcode to protect your personal dashboard."
              : "Enter your 4-digit passcode to open the personal dashboard."}
          </div>
        </div>

        <input
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoFocus
          className="app-input"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value.replace(/\D/g, "").slice(0, 4))}
          style={passcodeInputStyle}
          placeholder="0000"
        />

        {mode === "setup" ? (
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            className="app-input"
            value={confirmPasscode}
            onChange={(event) => setConfirmPasscode(event.target.value.replace(/\D/g, "").slice(0, 4))}
            style={passcodeInputStyle}
            placeholder="Confirm"
          />
        ) : null}

        {error ? (
          <div
            style={{
              borderRadius: "14px",
              padding: "10px 12px",
              background: "rgba(198, 40, 40, 0.08)",
              color: "var(--danger, #c62828)",
              fontSize: "0.84rem",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
          <Button type="button" variant="secondary" size="sm" pill onClick={onClose}>
            Close
          </Button>
          <Button type="submit" variant="primary" size="sm" pill disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : mode === "setup" ? "Save passcode" : "Unlock"}
          </Button>
        </div>
      </form>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}

/* ── MonthPicker ──────────────────────────────────────────────── */

function buildMonthOptions(centerMonthKey, radius = 12) {
  return Array.from({ length: radius * 2 + 1 }, (_, index) => {
    const offset = index - radius;
    const monthKey = shiftMonthKey(centerMonthKey, offset);
    return {
      value: monthKey,
      label: formatMonthLabel(monthKey),
    };
  });
}

function MonthPicker({
  value,
  onChange,
  compact = false,
  align = "left",
  showLabel = true,
}) {
  const monthKey = normaliseMonthKey(value);
  const monthOptions = useMemo(() => buildMonthOptions(monthKey, 12), [monthKey]);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        gap: "6px",
      }}
    >
      {showLabel ? (
        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Month
        </div>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onChange?.(shiftMonthKey(monthKey, -1))}
        style={{ width: "40px", minWidth: "40px", padding: 0 }}
        aria-label="Previous month"
      >
        ‹
      </Button>
      <DropdownField
        value={monthKey}
        onChange={(event) => onChange?.(normaliseMonthKey(event.target.value, monthKey))}
        options={monthOptions}
        ariaLabel="Selected month"
        style={{
          width: compact ? "100%" : "190px",
          minWidth: compact ? "140px" : "190px",
          flex: compact ? "1 1 180px" : "0 0 auto",
        }}
        controlStyle={{ justifyContent: "center" }}
        valueStyle={{ justifyContent: "center", whiteSpace: "nowrap" }}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onChange?.(shiftMonthKey(monthKey, 1))}
        style={{ width: "40px", minWidth: "40px", padding: 0 }}
        aria-label="Next month"
      >
        ›
      </Button>
    </div>
  );
}

/* ── InsightPanel ─────────────────────────────────────────────── */

function InsightCard({ insight }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "6px",
        padding: "10px 12px",
        borderRadius: "10px",
        ...widgetInsetSurfaceStyle,
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <StatusBadge tone="neutral">
          {insight.type}
        </StatusBadge>
      </div>
      <div style={{ fontSize: "0.82rem", fontWeight: 600, lineHeight: 1.5, color: "var(--text-primary)" }}>
        {insight.message}
      </div>
      {insight.action ? (
        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 600 }}>
          {insight.action}
        </div>
      ) : null}
    </div>
  );
}

function InsightPanel({ finance }) {
  const isMobile = useIsMobile();

  const insights = useMemo(
    () => generateInsights({ derived: finance.derived, model: finance.model }),
    [finance.derived, finance.model]
  );

  const headline = useMemo(() => generateHeadline(insights), [insights]);

  return (
    <div
      style={{
        ...widgetAccentSurfaceStyle,
        padding: isMobile ? "12px" : "14px",
        display: "grid",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: "2px" }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
            Insights
          </div>
          <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.35 }}>
            {headline}
          </div>
        </div>
        <StatusBadge tone="neutral">
          {finance.model.selectedMonthKey}
        </StatusBadge>
      </div>

      {insights.length === 0 ? (
        <EmptyState>
          Add your pay settings and outgoings to unlock personalised insights.
        </EmptyState>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "8px",
            gridTemplateColumns: isMobile
              ? "minmax(0, 1fr)"
              : "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {insights.map((insight) => (
            <InsightCard key={insight.category} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── AddWidgetModal ───────────────────────────────────────────── */

function AddWidgetModal({
  isOpen,
  widgets = [],
  visibleWidgetsByType = {},
  onToggle,
  onClose,
}) {
  useBodyModalLock(isOpen);
  const isMobile = useIsMobile();
  const panelRef = useRef(null);

  const handleBackdropClick = useCallback(
    (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose?.();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modal = (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "8px" : "24px",
        zIndex: 2000,
      }}
    >
      <div
        ref={panelRef}
        style={{
          width: "100%",
          maxWidth: "640px",
          maxHeight: "84vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          background: "rgba(var(--surface-rgb), 0.98)",
          borderRadius: isMobile ? "18px" : "22px",
          border: "1px solid rgba(var(--primary-rgb), 0.14)",
          boxShadow: "var(--shadow-lg)",
          padding: isMobile ? "14px" : "20px",
          display: "grid",
          gap: "14px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700 }}>Manage cards</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "2px", lineHeight: 1.4 }}>
              Toggle which cards appear on your dashboard.
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" pill onClick={onClose}>
            Done
          </Button>
        </div>

        {/* Widget toggle grid */}
        <div
          style={{
            display: "grid",
            gap: "8px",
            gridTemplateColumns: isMobile
              ? "minmax(0, 1fr)"
              : "repeat(auto-fill, minmax(200px, 1fr))",
          }}
        >
          {PERSONAL_WIDGET_TYPE_OPTIONS.map((definition) => {
            const isVisible = Boolean(visibleWidgetsByType[definition.type]);
            return (
              <button
                key={definition.type}
                type="button"
                onClick={() => onToggle?.(definition.type, isVisible)}
                style={{
                  textAlign: "left",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  borderRadius: "var(--radius-sm)",
                  border: isVisible
                    ? "1px solid rgba(var(--primary-rgb), 0.22)"
                    : "1px solid rgba(var(--primary-rgb), 0.08)",
                  background: isVisible
                    ? "rgba(var(--primary-rgb), 0.08)"
                    : "var(--surface)",
                  padding: "11px 13px",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  transition: "var(--control-transition)",
                }}
              >
                {/* Status dot */}
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    marginTop: "4px",
                    background: isVisible ? "var(--primary)" : "rgba(var(--primary-rgb), 0.15)",
                    transition: "var(--control-transition)",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.84rem" }}>{definition.label}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: 1.4, marginTop: "2px" }}>
                    {definition.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}

/* ── WidgetGrid ───────────────────────────────────────────────── */

function WidgetGrid({
  widgets = [],
  renderWidget,
  onReorder = null,
  moveMode = false,
}) {
  const visibleWidgets = useMemo(
    () => sortWidgetsForDisplay((widgets || []).filter((widget) => widget.isVisible !== false)),
    [widgets]
  );
  const [draggingId, setDraggingId] = useState(null);
  const [overId, setOverId] = useState(null);
  const isMobile = useIsMobile();
  const dragImageRef = useRef(null);
  const itemRefs = useRef({});

  const handleDragStart = useCallback(
    (event, widgetId) => {
      if (!moveMode) return;
      setDraggingId(widgetId);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", widgetId);
      if (!dragImageRef.current) {
        const el = document.createElement("div");
        el.style.width = "1px";
        el.style.height = "1px";
        el.style.position = "fixed";
        el.style.top = "-9999px";
        document.body.appendChild(el);
        dragImageRef.current = el;
      }
      event.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
    },
    [moveMode]
  );

  const handleDragOver = useCallback(
    (event, widgetId) => {
      if (!moveMode) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setOverId(widgetId);
    },
    [moveMode]
  );

  const handleDrop = useCallback(
    async (event, targetId) => {
      if (!moveMode) return;
      event.preventDefault();
      const sourceId = draggingId;
      setDraggingId(null);
      setOverId(null);
      if (!sourceId || !targetId || sourceId === targetId) return;
      await onReorder?.(sourceId, targetId);
    },
    [draggingId, moveMode, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setOverId(null);
  }, []);

  /* Row-height equalization removed — widgets now show full content. */

  return (
    <div
      style={{
        display: "grid",
        gap: isMobile ? "10px" : "14px",
        gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
        alignItems: "start",
        userSelect: moveMode ? "none" : "auto",
        WebkitUserSelect: moveMode ? "none" : "auto",
      }}
    >
      {visibleWidgets.map((widget) => {
        const isDragging = draggingId === widget.id;
        const isOver = overId === widget.id && draggingId && draggingId !== widget.id;

        return (
          <div
            key={widget.id}
            draggable={moveMode}
            onDragStart={(e) => handleDragStart(e, widget.id)}
            onDragOver={(e) => handleDragOver(e, widget.id)}
            onDragLeave={() => { if (overId === widget.id) setOverId(null); }}
            onDrop={(e) => handleDrop(e, widget.id)}
            onDragEnd={handleDragEnd}
            ref={(node) => {
              if (node) itemRefs.current[widget.id] = node;
              else delete itemRefs.current[widget.id];
            }}
            style={{
              position: "relative",
              borderRadius: "16px",
              cursor: moveMode ? "grab" : "default",
              opacity: isDragging ? 0.4 : 1,
              minHeight: 0,
              transform: isOver ? "scale(1.01)" : isDragging ? "scale(0.97)" : "scale(1)",
              transition: "transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease",
              boxShadow: isOver
                ? "0 0 0 2px rgba(var(--primary-rgb), 0.18), 0 4px 14px rgba(var(--primary-rgb), 0.12)"
                : moveMode
                  ? "0 1px 4px rgba(var(--primary-rgb), 0.06)"
                  : "none",
            }}
          >
            {renderWidget?.(widget)}
          </div>
        );
      })}
    </div>
  );
}

/* ── PersonalDashboard ────────────────────────────────────────── */

function PersonalDashboard({ dashboard }) {
  const widgetManager = usePersonalWidgets({
    widgets: dashboard.widgets,
    onSaveWidgets: dashboard.saveWidgets,
    onUpdateWidget: dashboard.updateWidget,
    onRemoveWidget: dashboard.removeWidget,
    onAddWidget: dashboard.addWidget,
  });
  const [settingsWidgetId, setSettingsWidgetId] = useState(null);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const isMobile = useIsMobile();

  const finance = usePersonalTabModel({
    financeState: dashboard.financeState,
    workData: dashboard.workData,
    onUpdateFinanceState: dashboard.updateFinanceState,
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

  return (
    <div style={{ display: "grid", gap: isMobile ? "10px" : "14px" }}>
      {/* ── Dashboard header ── */}
      <div
        style={{
          ...widgetAccentSurfaceStyle,
          padding: isMobile ? "12px" : "14px",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          gap: isMobile ? "10px" : "12px",
          alignItems: isMobile ? "stretch" : "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: "2px" }}>
          <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>Personal planning</div>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.76rem" }}>
            Year <strong>{finance.model.selectedFinanceYear}</strong>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="app-btn--control"
            style={toolbarButtonStyle}
            onClick={() => setIsMoveMode((current) => !current)}
          >
            {isMoveMode ? "Done" : "Move"}
          </Button>
          <MonthPicker
            value={finance.model.selectedMonthKey}
            onChange={finance.setSelectedMonth}
            align={isMobile ? "left" : "right"}
            compact={isMobile}
            showLabel={false}
          />
        </div>
      </div>

      {/* ── Insights ── */}
      <InsightPanel finance={finance} />

      {/* ── Widget grid ── */}
      {visibleWidgets.length === 0 ? (
        <div
          style={{
            ...widgetAccentSurfaceStyle,
            borderStyle: "dashed",
            padding: isMobile ? "20px 16px" : "28px 20px",
            color: "var(--text-secondary)",
            fontSize: "0.84rem",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          No cards visible. Use <strong>Add widget</strong> above to add some.
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

      {/* ── Modals ── */}
      <AddWidgetModal
        isOpen={dashboard.isAddWidgetOpen}
        widgets={widgetManager.widgets}
        visibleWidgetsByType={visibleWidgetsByType}
        onClose={dashboard.onCloseAddWidget}
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
        finance={finance}
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

/* ── ProfilePersonalTab (entry point) ─────────────────────────── */

export default function ProfilePersonalTab({ disabled = false, onHeaderActionsChange = null }) {
  const dashboard = usePersonalDashboard({ enabled: !disabled });
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!disabled && !dashboard.isInitialising && !dashboard.isUnlocked && !dashboard.isSetup) {
      setIsPasscodeModalOpen(true);
    }
    if (dashboard.isUnlocked) {
      setIsPasscodeModalOpen(false);
      setModalError("");
    }
  }, [dashboard.isInitialising, dashboard.isUnlocked, dashboard.isSetup, disabled]);

  const headerActions = useMemo(() => {
    if (!dashboard.isUnlocked) {
      return null;
    }

    return (
      <DevLayoutSection sectionKey="profile-personal-header-actions" parentKey="profile-tab-actions" sectionType="toolbar">
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Button type="button" variant="secondary" size="sm" className="app-btn--control" style={toolbarButtonStyle} onClick={() => setIsAddWidgetOpen(true)}>
            Add widget
          </Button>
          <Button type="button" variant="secondary" size="sm" className="app-btn--control" style={toolbarButtonStyle} onClick={dashboard.lock}>
            Lock
          </Button>
        </div>
      </DevLayoutSection>
    );
  }, [dashboard.isUnlocked, dashboard.lock]);

  useEffect(() => {
    onHeaderActionsChange?.(headerActions);
    return () => onHeaderActionsChange?.(null);
  }, [headerActions, onHeaderActionsChange]);

  if (disabled) {
    return (
      <DevLayoutSection
        sectionKey="profile-personal-disabled-state"
        parentKey="profile-active-tab-panel"
        sectionType="section-shell"
        shell
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(var(--accent-purple-rgb), 0.12)",
          borderRadius: "14px",
          padding: "24px",
          color: "var(--text-secondary)",
          fontSize: "0.88rem",
          lineHeight: 1.5,
        }}
      >
        Personal dashboard access is only available when you are viewing your own profile.
      </DevLayoutSection>
    );
  }

  const passcodeMode = dashboard.isSetup ? "unlock" : "setup";

  const handlePasscodeSubmit = async ({ passcode, confirmPasscode }) => {
    setIsSubmitting(true);
    setModalError("");
    try {
      if (passcodeMode === "setup") {
        await dashboard.setupPasscode({ passcode, confirmPasscode });
      } else {
        await dashboard.unlock({ passcode });
      }
    } catch (error) {
      setModalError(error.message || "Unable to unlock personal dashboard.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {dashboard.isUnlocked ? (
        <DevLayoutSection
          sectionKey="profile-personal-dashboard-unlocked"
          parentKey="profile-active-tab-panel"
          sectionType="section-shell"
          shell
        >
          <PersonalDashboard
            dashboard={{
              ...dashboard,
              isAddWidgetOpen,
              onCloseAddWidget: () => setIsAddWidgetOpen(false),
            }}
          />
        </DevLayoutSection>
      ) : (
        <DevLayoutSection
          sectionKey="profile-personal-locked-state"
          parentKey="profile-active-tab-panel"
          sectionType="section-shell"
          shell
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(var(--accent-purple-rgb), 0.12)",
            borderRadius: "14px",
            padding: "24px",
            display: "grid",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>Personal dashboard locked</div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <Button type="button" variant="primary" size="sm" pill onClick={() => setIsPasscodeModalOpen(true)}>
              {dashboard.isSetup ? "Unlock" : "Set up passcode"}
            </Button>
            {dashboard.isSetup ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  setModalError("");
                  try {
                    await dashboard.resetPasscode();
                    setIsPasscodeModalOpen(true);
                  } catch (error) {
                    setModalError(error.message || "Unable to reset code.");
                  }
                }}
              >
                Reset code
              </Button>
            ) : null}
          </div>
          {dashboard.error ? (
            <div
              style={{
                borderRadius: "10px",
                padding: "10px 12px",
                background: "rgba(198, 40, 40, 0.08)",
                color: "var(--danger, #c62828)",
                fontSize: "0.84rem",
                lineHeight: 1.5,
              }}
            >
              {dashboard.error.message}
            </div>
          ) : null}
        </DevLayoutSection>
      )}

      <PasscodeModal
        isOpen={isPasscodeModalOpen}
        mode={passcodeMode}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={() => setIsPasscodeModalOpen(false)}
        onSubmit={handlePasscodeSubmit}
      />
    </>
  );
}
