// file location: src/features/stockControl/StockItemCard.js
//
// The two ways the tracker lists items:
//   StockItemCard      the workshop card — same compact --theme card the
//                      Oil/Stock tab has always had, now with a level gauge
//                      and context-sensitive actions.
//   StockCompactTable  the dense list for Parts and management - the global
//                      .app-data-table in DataTableShell, no local table styling.
//
// Both are presentational: they render a resolved row (stockModel.resolveRows)
// and report intent through callbacks. Which action a card offers comes from
// stockModel.getPrimaryAction, so cards and list always agree.

import React from "react";
import { Button, DataTableShell, LayerTheme } from "@/components/ui";
import {
  describeRunOut,
  formatDate,
  formatMoney,
  formatQuantity,
  getPrimaryAction,
  getThresholds,
  STOCK_STATUS_META,
  unitShortLabel,
} from "@/features/stockControl/stockModel";
import { StockGauge } from "@/features/stockControl/StockFields";

const activate = (handler) => (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handler();
  }
};

const stop = (handler) => (event) => {
  event.stopPropagation();
  handler();
};

const canRecordStock = (capabilities) => capabilities.check || capabilities.use || capabilities.receive || capabilities.adjust;

/** Secondary status line: the level behind an order, or a due check. */
function subStatus(row) {
  const { status } = row;
  if (status.orderState && status.key !== status.levelState && STOCK_STATUS_META[status.levelState] && status.levelState !== "normal") {
    return { label: STOCK_STATUS_META[status.levelState].label, tone: STOCK_STATUS_META[status.levelState].tone };
  }
  if (row.checkDue && !row.archived) return { label: "Check due", tone: "warning" };
  return null;
}

function metaLine(row) {
  return [row.category?.name, row.item.oilGrade, row.location?.name].filter(Boolean).join(" · ") || "Uncategorised";
}

function orderSummary(row) {
  const order = row.openOrder;
  if (!order) return null;
  const qty = formatQuantity(order.status === "partially_received" ? row.incoming : order.quantityOrdered, row.item);
  if (order.status === "order_required") return `${qty} requested`;
  return `${qty}${order.status === "partially_received" ? " outstanding" : ""}${order.expectedDelivery ? ` · due ${formatDate(order.expectedDelivery)}` : ""}`;
}

export function StockItemCard({ row, siblings = [], capabilities, onOpen, onAction, onHistory, onStockAction }) {
  const { item, status } = row;
  const primary = getPrimaryAction(status, capabilities);
  const secondaryStock = !row.archived && canRecordStock(capabilities) && primary?.id !== "check";
  const sub = subStatus(row);
  const { min, target } = getThresholds(item);
  const unit = unitShortLabel(item);
  const runOut = describeRunOut(item.usage);
  const rows = [
    ["Min / target", min !== null || target !== null ? `${min ?? "—"} / ${target ?? "—"} ${unit}` : "Not set"],
    ["Last check", `${formatDate(item.lastCheck)}${item.lastCheckedByName ? ` · ${item.lastCheckedByName}` : ""}`],
    ["Next check", formatDate(item.nextCheck)],
  ];
  const order = orderSummary(row);
  if (order) rows.push(["On order", order]);
  if (item.usage?.reliable) rows.push(["Usage", `≈ ${formatQuantity(item.usage.weeklyUsage, item)} / week`]);
  if (runOut) rows.push(["Est. run-out", runOut]);

  return (
    <LayerTheme
      className="stock-card"
      radius="var(--radius-sm)"
      padding="20px 24px"
      gap="10px"
      role="button"
      tabIndex={0}
      aria-label={`${item.title}, ${status.label}`}
      onClick={() => onOpen(row)}
      onKeyDown={activate(() => onOpen(row))}
    >
      <div className="stock-card__head">
        <div>
          <strong className="stock-card__title">{item.title}</strong>
          <span className="stock-card__meta">{metaLine(row)}</span>
        </div>
        <span className={`stock-card__status stock-tone--${status.tone}`}>
          {status.label}
          {sub && <span className={`stock-card__substatus stock-tone--${sub.tone}`}>{sub.label}</span>}
        </span>
      </div>

      <StockGauge row={row} />

      <div className="stock-rows">
        {rows.map(([label, value]) => (
          <div key={label} className="stock-row">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {siblings.length > 0 && (
        <p className="stock-card__note">
          Also stocked at:{" "}
          {siblings.map((sibling) => `${sibling.location?.name || "No location"} (${formatQuantity(sibling.item.currentQuantity, sibling.item)})`).join(", ")}
        </p>
      )}
      {item.currentQuantity === null && item.legacyStock && <p className="stock-card__note">Previous note: {item.legacyStock}</p>}

      <div className={`stock-card__actions${secondaryStock && primary ? " stock-card__actions--three" : ""}`}>
        <Button type="button" variant="secondary" size="sm" symbol={false} onClick={stop(() => onHistory(row))}>
          View History
        </Button>
        {secondaryStock && (
          <Button type="button" variant="secondary" size="sm" symbol={false} onClick={stop(() => onStockAction(row))}>
            Record Stock
          </Button>
        )}
        {primary && (
          <Button type="button" variant="primary" size="sm" symbol={false} onClick={stop(() => onAction(primary.id, row))}>
            {primary.label}
          </Button>
        )}
      </div>
    </LayerTheme>
  );
}

// The table look is entirely the global one: .app-data-table (staffglobal.css
// + families/tables.css) inside the canonical DataTableShell. Do not add a
// feature class to the <table>, <tr>, <th> or <td> here - style the CONTENT
// inside a cell instead (npm run check:design, table-overrides).
export function StockCompactTable({ rows, capabilities, onOpen, onAction, onHistory }) {
  return (
    <DataTableShell aria-label="Stock items">
      <table className="app-data-table app-data-table--rounded app-data-table--clickable">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Location</th>
            <th scope="col" data-table-cell="nowrap">Stock</th>
            <th scope="col">Level</th>
            <th scope="col" data-table-cell="nowrap">Min / Target</th>
            <th scope="col">Status</th>
            <th scope="col" data-table-cell="nowrap">Last check</th>
            <th scope="col">On order</th>
            {capabilities.viewCosts && <th scope="col" data-table-cell="nowrap">Value</th>}
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { item, status } = row;
            const primary = getPrimaryAction(status, capabilities);
            const sub = subStatus(row);
            const { min, target } = getThresholds(item);
            return (
              <tr
                key={item.id}
                tabIndex={0}
                onClick={() => onOpen(row)}
                onKeyDown={activate(() => onOpen(row))}
                aria-label={`${item.title}, ${status.label}`}
              >
                <td>
                  <span className="stock-compact__name">
                    <strong>{item.title}</strong>
                    <span className="stock-compact__sub">
                      {[row.category?.name, item.oilGrade, item.stockCode].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                </td>
                <td>{row.location?.name || "—"}</td>
                <td data-table-cell="nowrap">{formatQuantity(item.currentQuantity, item)}</td>
                <td><StockGauge row={row} compact /></td>
                <td data-table-cell="nowrap">
                  {min !== null || target !== null ? `${min ?? "—"} / ${target ?? "—"}` : "—"}
                </td>
                <td>
                  <span className={`stock-tone--${status.tone}`}><strong>{status.label}</strong></span>
                  {sub && <span className={`stock-compact__sub stock-tone--${sub.tone}`}> · {sub.label}</span>}
                </td>
                <td data-table-cell="nowrap">{formatDate(item.lastCheck)}</td>
                <td>{orderSummary(row) || "—"}</td>
                {capabilities.viewCosts && <td data-table-cell="nowrap">{row.value !== null ? formatMoney(row.value) : "—"}</td>}
                <td>
                  <span className="stock-compact__actions">
                    <Button type="button" variant="secondary" size="xs" symbol={false} onClick={stop(() => onHistory(row))}>
                      History
                    </Button>
                    {primary && (
                      <Button type="button" variant="primary" size="xs" symbol={false} onClick={stop(() => onAction(primary.id, row))}>
                        {primary.label}
                      </Button>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataTableShell>
  );
}
