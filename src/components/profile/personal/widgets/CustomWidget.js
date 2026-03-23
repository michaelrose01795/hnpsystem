import React, { useState } from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import {
  MetricPill,
  SectionLabel,
  formatCurrency,
  widgetButtonStyle,
  widgetInputStyle,
} from "@/components/profile/personal/widgets/shared";

const PRESETS = {
  "goal-tracker": { title: "Goal Tracker", amount: 0, target: 1000, note: "Track progress toward a personal goal." },
  "bill-reminder": { title: "Bill Reminder", amount: 0, target: 0, note: "Due date and bill reminder notes." },
  "event-countdown": { title: "Event Countdown", amount: 0, target: 0, note: "Countdown details for your next event." },
  "birthday-tracker": { title: "Birthday Tracker", amount: 0, target: 0, note: "Birthday reminders and gift planning." },
};

export default function CustomWidget({
  widget,
  actions,
  compact = false,
}) {
  const config = widget?.config || {};
  const [form, setForm] = useState({
    title: config.title || "Custom widget",
    amount: config.amount || 0,
    target: config.target || 0,
    note: config.note || "",
    preset: config.preset || "goal-tracker",
  });

  const saveCustomWidget = async () => {
    await actions.updateWidget(widget.id, {
      config: {
        ...widget.config,
        ...form,
      },
    });
  };

  return (
    <BaseWidget
      title={form.title}
      subtitle="Flexible preset-based personal card"
      accent="var(--accent-purple)"
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
          <MetricPill label="Amount" value={formatCurrency(form.amount)} accent="var(--accent-purple)" />
          <MetricPill label="Target" value={formatCurrency(form.target)} accent="var(--info, #1565c0)" />
        </div>
      }
      compact={compact}
    >
      <SectionLabel>Preset</SectionLabel>
      <select
        value={form.preset}
        onChange={(event) => {
          const presetKey = event.target.value;
          const preset = PRESETS[presetKey] || PRESETS["goal-tracker"];
          setForm((current) => ({ ...current, ...preset, preset: presetKey }));
        }}
        style={widgetInputStyle}
      >
        {Object.entries(PRESETS).map(([value, preset]) => (
          <option key={value} value={value}>{preset.title}</option>
        ))}
      </select>
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
