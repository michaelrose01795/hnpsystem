// file location: src/features/stockControl/StockHistoryDrawer.js
//
// View History as a tracking popup: one chronological timeline of every
// check, receipt, usage, adjustment, order event and lifecycle change, each
// with the user and time, plus the usage trend and purchase-cost history.
// Trend figures are labelled as estimates and only shown when the ledger has
// enough history (see stockModel.summariseUsage).

import React, { useEffect, useMemo, useState } from "react";
import { StatusMessage } from "@/components/ui";
import TrackingPopup from "@/features/tracking/TrackingPopup";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { SectionSkeleton } from "@/components/ui/LoadingSkeleton";
import {
  HISTORY_FILTERS,
  ORDER_STATUSES,
  USAGE_WINDOW_DAYS,
  describeMovement,
  describeRunOut,
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
} from "@/features/stockControl/stockModel";
import { loadItemHistory } from "@/features/stockControl/stockClient";

const NONE = [];

const dayKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
};

const timeOf = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

function Stat({ label, value }) {
  return (
    <div className="app-summary-item app-summary-item--theme">
      <span className="app-summary-label">{label}</span>
      <strong className="app-summary-value">{value}</strong>
    </div>
  );
}

export default function StockHistoryDrawer({ row, capabilities, onClose }) {
  const { item } = row;
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: null, data: null });
    loadItemHistory(item.id)
      .then((data) => !cancelled && setState({ loading: false, error: null, data }))
      .catch((error) => !cancelled && setState({ loading: false, error: error.message, data: null }));
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  const movements = state.data?.movements || NONE;
  const orders = state.data?.orders || NONE;
  const orderById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const visible = useMemo(() => {
    const types = HISTORY_FILTERS.find((entry) => entry.value === filter)?.types;
    return types ? movements.filter((movement) => types.includes(movement.movementType)) : movements;
  }, [filter, movements]);
  const days = useMemo(() => {
    const groups = [];
    visible.forEach((movement) => {
      const key = dayKey(movement.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.entries.push(movement);
      else groups.push({ key, entries: [movement] });
    });
    return groups;
  }, [visible]);

  const usage = item.usage;
  const runOut = describeRunOut(usage);

  return (
    <TrackingPopup
      closeOnEscape
      title={item.title}
      description={[row.category?.name, row.location?.name, item.stockCode].filter(Boolean).join(" · ") || "Stock history"}
      onClose={onClose}
      ariaLabel={`${item.title} history`}
    >
      <div className="stock-history">
        <div className="stock-history__stats">
          <Stat label="Recorded" value={formatQuantity(item.currentQuantity, item)} />
          <Stat label="Last check" value={formatDate(item.lastCheck)} />
          <Stat label="Usage / week" value={usage?.reliable ? `≈ ${formatQuantity(usage.weeklyUsage, item)}` : "—"} />
          <Stat label="Est. run-out" value={runOut || "—"} />
          {capabilities.viewCosts && <Stat label="Unit cost" value={formatMoney(item.unitCost)} />}
        </div>
        <p className="stock-hint">
          {usage?.reliable
            ? `Estimated from ${usage.eventCount} usage records over the last ${Math.min(usage.spanDays, USAGE_WINDOW_DAYS)} days. A guide for ordering, not an exact forecast.`
            : "Not enough history yet for a usage trend — it needs at least 3 usage records over 2 weeks."}
        </p>

        <TabGroup items={HISTORY_FILTERS.map((entry) => ({ label: entry.label, value: entry.value }))} value={filter} onChange={setFilter} ariaLabel="History filter" />

        {state.loading && <SectionSkeleton rows={5} showHeader={false} />}
        {state.error && <StatusMessage tone="danger">{state.error}</StatusMessage>}
        {!state.loading && !state.error && days.length === 0 && <p className="stock-hint">Nothing recorded yet{filter !== "all" ? " for this filter" : ""}.</p>}

        {days.map((day) => (
          <section key={day.key} aria-label={day.key}>
            <h3 className="stock-history__day">{day.key}</h3>
            <ul className="stock-history__list">
              {day.entries.map((movement) => {
                const described = describeMovement(movement, item);
                const order = movement.orderId ? orderById.get(movement.orderId) : null;
                const meta = [
                  movement.reason,
                  movement.jobNumber ? `Job ${movement.jobNumber}` : null,
                  order?.supplier ? `Supplier ${order.supplier}` : null,
                  order?.reference ? `Ref ${order.reference}` : null,
                  capabilities.viewCosts && movement.unitCost !== null && movement.unitCost !== undefined ? `${formatMoney(movement.unitCost)} each` : null,
                  movement.detail?.outstanding ? `${formatQuantity(movement.detail.outstanding, item)} still outstanding` : null,
                  movement.detail?.clampedToZero ? "Booked out more than recorded — set to zero" : null,
                  movement.detail?.significant ? "Significant change — management notified" : null,
                ].filter(Boolean);
                return (
                  <li key={movement.id} className="stock-history__entry">
                    <div className="stock-history__entry-head">
                      <span className={`stock-history__type stock-tone--${described.tone}`}>{described.label}</span>
                      <span className="stock-history__time">
                        {timeOf(movement.createdAt)} · {movement.actorName || "Unknown user"}
                      </span>
                    </div>
                    {described.detail && <span>{described.detail}</span>}
                    {meta.length > 0 && <span className="stock-history__meta">{meta.join(" · ")}</span>}
                    {movement.notes && <span className="stock-history__meta">“{movement.notes}”</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {orders.length > 0 && (
          <section aria-label="Orders">
            <h3 className="stock-history__day">Orders</h3>
            <ul className="stock-history__list">
              {orders.map((order) => (
                <li key={order.id} className="stock-history__entry">
                  <div className="stock-history__entry-head">
                    <span className="stock-history__type">{ORDER_STATUSES.find((status) => status.value === order.status)?.label || order.status}</span>
                    <span className="stock-history__time">{formatDateTime(order.createdAt)}</span>
                  </div>
                  <span>
                    {formatQuantity(order.quantityReceived, item)} of {formatQuantity(order.quantityOrdered, item)} received
                    {order.supplier ? ` · ${order.supplier}` : ""}
                  </span>
                  <span className="stock-history__meta">
                    {[order.reference && `Ref ${order.reference}`, order.expectedDelivery && `Expected ${formatDate(order.expectedDelivery)}`, capabilities.viewCosts && order.unitCost !== null && order.unitCost !== undefined && `${formatMoney(order.unitCost)} each`]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {capabilities.viewCosts && state.data?.purchaseHistory?.length > 0 && (
          <section aria-label="Purchase cost history">
            <h3 className="stock-history__day">Purchase cost history</h3>
            <ul className="stock-history__list">
              {state.data.purchaseHistory.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="stock-history__entry">
                  <div className="stock-history__entry-head">
                    <span className="stock-history__type">{formatMoney(entry.unitCost)} each</span>
                    <span className="stock-history__time">{formatDate(entry.at)}</span>
                  </div>
                  <span className="stock-history__meta">
                    {[entry.quantity ? formatQuantity(entry.quantity, item) : null, entry.supplier].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </TrackingPopup>
  );
}
