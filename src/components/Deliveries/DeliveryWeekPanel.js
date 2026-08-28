// file location: src/components/Deliveries/DeliveryWeekPanel.js
//
// The Monday-to-Sunday strip behind the "Week" view control.
//
// Counts come from the same day payload the list uses (one grouped read on the
// server), so switching to the week view costs nothing extra. Selecting a day
// switches the diary to it, which is what the parts desk actually wants from a
// week view — a way to move, not a second board to maintain.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { formatCurrency, formatIsoDateShort, todayIso } from "@/features/deliveries/deliveryFormatting";
import { deliveryStyles, deliveryText } from "./deliveryStyles";

const buildWeekDays = (startDate) => {
  if (!startDate) return [];
  const days = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(`${startDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
};

export default function DeliveryWeekPanel({ week, selectedDate, onSelectDate }) {
  const days = buildWeekDays(week?.startDate);
  const today = todayIso();

  return (
    <LayerTheme
      as="section"
      sectionKey="parts-deliveries-week"
      sectionType="content-card"
      data-presentation="deliveries-week"
      style={deliveryStyles.listCard}
    >
      <div style={deliveryStyles.cell}>
        <span style={deliveryText.label}>Delivery week</span>
        <span style={deliveryText.muted}>
          Select a day to load its route. Counts exclude nothing — every stop on that date is
          included.
        </span>
      </div>
      <div style={deliveryStyles.weekGrid}>
        {days.map((day) => {
          const stats = week?.days?.[day] || {
            total: 0,
            open: 0,
            delivered: 0,
            failed: 0,
            urgent: 0,
            value: 0,
          };
          const isSelected = day === selectedDate;
          return (
            <LayerSurface
              key={day}
              as="button"
              type="button"
              padding="var(--space-3)"
              gap="var(--space-sm)"
              radius="var(--radius-sm)"
              onClick={() => onSelectDate(day)}
              aria-current={isSelected ? "date" : undefined}
              style={{
                ...deliveryStyles.weekDayButton,
                // Selection and "today" are outlines, not fills, so the day
                // tiles keep the surface ladder they share with every other
                // card on the page.
                outline: isSelected
                  ? "2px solid var(--accent-strong)"
                  : day === today
                  ? "2px dashed var(--input-ring-color)"
                  : "none",
                outlineOffset: "2px",
                textAlign: "left",
              }}
            >
              <span style={deliveryText.label}>{formatIsoDateShort(day)}</span>
              <span style={deliveryText.valueStrong}>
                {stats.total} stop{stats.total === 1 ? "" : "s"}
              </span>
              <span style={deliveryText.caption}>
                {stats.open} open · {stats.delivered} delivered
                {stats.failed > 0 ? ` · ${stats.failed} failed` : ""}
              </span>
              <span style={deliveryText.caption}>{formatCurrency(stats.value)}</span>
              {stats.urgent > 0 ? (
                <div style={deliveryStyles.badgeStrip}>
                  <span className="app-badge app-badge--danger-strong">{stats.urgent} urgent</span>
                </div>
              ) : null}
            </LayerSurface>
          );
        })}
      </div>
    </LayerTheme>
  );
}
