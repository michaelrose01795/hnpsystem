import React, { useState } from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import {
  MetricPill,
  SectionLabel,
  formatCurrency,
  widgetButtonStyle,
  widgetInputStyle,
} from "@/components/profile/personal/widgets/shared";

export default function CustomWidget({
  widget,
  widgetData,
  actions,
  onRemove,
  compact = false,
  isMoveMode = false,
  canDrag = false,
  isDraggingWidget = false,
  moveButtonProps = null,
}) {
  const [form, setForm] = useState({
    title: widget.config?.title || widgetData?.title || "Custom widget",
    amount: widgetData?.amount || 0,
    target: widgetData?.target || 0,
    note: widgetData?.note || "",
  });

  const saveCustomWidget = async () => {
    await actions.saveWidgetData("custom", {
      ...widgetData,
      ...form,
    });
    await actions.updateWidget(widget.id, {
      config: {
        ...widget.config,
        title: form.title,
      },
    });
  };

  return (
    <BaseWidget
      title={form.title}
      subtitle="A flexible personal metric card"
      accent="var(--accent-purple)"
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
          <MetricPill label="Amount" value={formatCurrency(form.amount)} accent="var(--accent-purple)" />
          <MetricPill label="Target" value={formatCurrency(form.target)} accent="var(--info, #1565c0)" />
        </div>
      }
      onRemove={onRemove}
      compact={compact}
      isMoveMode={isMoveMode}
      canDrag={canDrag}
      isDraggingWidget={isDraggingWidget}
      moveButtonProps={moveButtonProps}
    >
      <SectionLabel>Custom settings</SectionLabel>
      <div style={{ display: "grid", gap: "10px" }}>
        <input
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          style={widgetInputStyle}
          placeholder="Widget title"
        />
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "1fr 1fr" }}>
          <input
            type="number"
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            style={widgetInputStyle}
            placeholder="Amount"
          />
          <input
            type="number"
            value={form.target}
            onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))}
            style={widgetInputStyle}
            placeholder="Target"
          />
        </div>
        <textarea
          value={form.note}
          onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
          style={{ ...widgetInputStyle, minHeight: "110px", resize: "vertical" }}
          placeholder="Notes"
        />
      </div>
      <button type="button" onClick={saveCustomWidget} style={{ ...widgetButtonStyle, alignSelf: "flex-start" }}>
        Save custom widget
      </button>
    </BaseWidget>
  );
}
