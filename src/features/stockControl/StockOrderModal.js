// file location: src/features/stockControl/StockOrderModal.js
//
// The order workflow for one item, in three modes:
//   order    raise a new order, or update the open one (status, supplier,
//            quantity, expected delivery, cost, reference, notes). The quantity
//            starts at the suggested replenishment and staff can change it.
//   receive  book a delivery in — full or partial — against the open order.
//   view     read-only order details for roles that cannot order.

import React, { useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import { CalendarField } from "@/components/ui/calendarAPI";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { Button, InputField, LayerTheme, StatusMessage } from "@/components/ui";
import {
  ORDER_STATUSES,
  formatDate,
  formatMoney,
  formatQuantity,
  outstandingQuantity,
  suggestReplenishment,
  toNumber,
  unitShortLabel,
} from "@/features/stockControl/stockModel";
import { TextAreaField } from "@/features/stockControl/StockFields";
import { cancelStockOrder, createStockOrder, receiveStockOrder, updateStockOrder } from "@/features/stockControl/stockClient";

const EDITABLE_STATUSES = ["order_required", "ordered", "awaiting_delivery"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isoDate = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function OrderFacts({ order, item, capabilities }) {
  const rows = [
    ["Status", ORDER_STATUSES.find((status) => status.value === order.status)?.label || order.status],
    ["Supplier", order.supplier || "—"],
    ["Supplier code", order.supplierProductCode || "—"],
    ["Ordered", formatQuantity(order.quantityOrdered, item)],
    ["Received so far", formatQuantity(order.quantityReceived, item)],
    ["Outstanding", formatQuantity(outstandingQuantity(order), item)],
    ["Expected delivery", formatDate(order.expectedDelivery)],
    ["Reference", order.reference || "—"],
    ...(capabilities.viewCosts ? [["Unit cost", formatMoney(order.unitCost)]] : []),
    ["Raised", formatDate(order.createdAt)],
  ];
  return (
    <LayerTheme radius="var(--radius-sm)" padding="12px" gap="8px">
      {rows.map(([label, value]) => (
        <div key={label} className="stock-row">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      {order.notes && <p className="stock-card__note">{order.notes}</p>}
    </LayerTheme>
  );
}

export default function StockOrderModal({ row, mode = "order", capabilities, onClose, onSaved }) {
  const { item, openOrder } = row;
  const unit = unitShortLabel(item);
  const suggestion = useMemo(() => suggestReplenishment(item, { incoming: row.incoming }), [item, row.incoming]);
  const editing = Boolean(openOrder);
  const leadDays = toNumber(item.leadTimeDays);

  const [form, setForm] = useState(() => ({
    status: openOrder?.status || (capabilities.order ? "ordered" : "order_required"),
    supplier: openOrder?.supplier || item.preferredSupplier || "",
    supplierProductCode: openOrder?.supplierProductCode || item.supplierProductCode || "",
    quantityOrdered: openOrder ? String(openOrder.quantityOrdered) : suggestion.quantity ? String(suggestion.quantity) : "",
    expectedDelivery: openOrder?.expectedDelivery || (leadDays ? isoDate(new Date(Date.now() + leadDays * MS_PER_DAY)) : ""),
    unitCost: openOrder?.unitCost ?? item.unitCost ?? "",
    reference: openOrder?.reference || "",
    notes: openOrder?.notes || "",
  }));
  const outstanding = outstandingQuantity(openOrder);
  const [receipt, setReceipt] = useState(() => ({
    quantity: outstanding ? String(outstanding) : openOrder ? String(openOrder.quantityOrdered) : "",
    unitCost: openOrder?.unitCost ?? item.unitCost ?? "",
    notes: "",
    closeShort: false,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const run = async (task) => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await task());
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  const submitOrder = (event) => {
    event.preventDefault();
    const body = {
      status: form.status,
      supplier: form.supplier,
      supplierProductCode: form.supplierProductCode,
      quantityOrdered: form.quantityOrdered,
      expectedDelivery: form.expectedDelivery || null,
      reference: form.reference,
      notes: form.notes,
      ...(capabilities.viewCosts ? { unitCost: form.unitCost === "" ? null : form.unitCost } : {}),
    };
    run(() => (editing ? updateStockOrder({ id: openOrder.id, ...body }) : createStockOrder({ itemId: item.id, ...body })));
  };

  const submitReceipt = (event) => {
    event.preventDefault();
    run(() =>
      receiveStockOrder({
        id: openOrder.id,
        quantity: receipt.quantity,
        unitCost: capabilities.viewCosts && receipt.unitCost !== "" ? receipt.unitCost : null,
        notes: receipt.notes,
        closeShort: receipt.closeShort,
      })
    );
  };

  const receivingShort = mode === "receive" && toNumber(receipt.quantity) !== null && toNumber(receipt.quantity) < (outstanding || toNumber(openOrder?.quantityOrdered) || 0);
  const title = mode === "receive" ? "Mark Received" : mode === "view" ? "Order" : editing ? "Update Order" : "Order Stock";

  return (
    <PopupModal isOpen onClose={onClose} ariaLabel={`${title} — ${item.title}`} cardClassName="app-settings-popup-card stock-popup">
      <form className="app-settings-popup stock-form" onSubmit={mode === "receive" ? submitReceipt : submitOrder}>
        <header className="app-popup-compact-header">
          <h2>
            {title} — {item.title}
          </h2>
          <div className="app-popup-compact-header__actions">
            {mode !== "view" && (
              <Button type="submit" variant="primary" size="sm" symbol={false} busy={saving}>
                {mode === "receive" ? "Book In" : editing ? "Save" : "Raise Order"}
              </Button>
            )}
            {mode === "order" && editing && capabilities.order && (
              <Button type="button" variant="danger" size="sm" symbol={false} onClick={() => setConfirmCancel(true)}>
                Cancel Order
              </Button>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        {error && <StatusMessage tone="danger">{error}</StatusMessage>}

        <div className="stock-callout">
          <span>
            On hand {formatQuantity(item.currentQuantity, item)}
            {row.incoming ? ` · ${formatQuantity(row.incoming, item)} on the way` : ""}
          </span>
          {mode === "order" && (
            <>
              <strong>Suggested: {suggestion.quantity ? formatQuantity(suggestion.quantity, item) : "—"}</strong>
              <span>{suggestion.basis}</span>
            </>
          )}
        </div>

        {(mode === "view" || mode === "receive") && openOrder && <OrderFacts order={openOrder} item={item} capabilities={capabilities} />}

        {mode === "order" && (
          <>
            <div className="stock-form__grid">
              <DropdownField
                label="Status"
                options={ORDER_STATUSES.filter((status) => EDITABLE_STATUSES.includes(status.value) || status.value === openOrder?.status).map((status) => ({
                  ...status,
                  disabled: !EDITABLE_STATUSES.includes(status.value),
                }))}
                value={form.status}
                onValueChange={(value) => setField("status", value || "ordered")}
              />
              <InputField
                label={`Quantity (${unit})`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required
                value={form.quantityOrdered}
                onChange={(e) => setField("quantityOrdered", e.target.value)}
              />
              <InputField label="Supplier" value={form.supplier} onChange={(e) => setField("supplier", e.target.value)} />
              <InputField label="Supplier product code" value={form.supplierProductCode} onChange={(e) => setField("supplierProductCode", e.target.value)} />
              <CalendarField
                label="Expected delivery"
                value={form.expectedDelivery}
                onValueChange={(value) => setField("expectedDelivery", value || "")}
                placeholder={leadDays ? `Lead time ${leadDays} days` : "Select date"}
                size="md"
              />
              <InputField label="Order reference" value={form.reference} onChange={(e) => setField("reference", e.target.value)} placeholder="PO / supplier ref" />
              {capabilities.viewCosts && (
                <InputField label="Unit cost (£)" type="number" inputMode="decimal" min="0" step="0.01" value={form.unitCost} onChange={(e) => setField("unitCost", e.target.value)} />
              )}
            </div>
            {suggestion.quantity > 0 && String(suggestion.quantity) !== form.quantityOrdered && (
              <div className="stock-inline-actions">
                <Button type="button" variant="secondary" size="sm" symbol={false} onClick={() => setField("quantityOrdered", String(suggestion.quantity))}>
                  Use suggested {formatQuantity(suggestion.quantity, item)}
                </Button>
              </div>
            )}
            <TextAreaField label="Notes" value={form.notes} onChange={(value) => setField("notes", value)} rows={2} />
          </>
        )}

        {mode === "receive" && (
          <>
            <div className="stock-form__grid">
              <InputField
                label={`Quantity received now (${unit})`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required
                autoFocus
                value={receipt.quantity}
                onChange={(e) => setReceipt((previous) => ({ ...previous, quantity: e.target.value }))}
              />
              {capabilities.viewCosts && (
                <InputField
                  label="Unit cost (£)"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={receipt.unitCost}
                  onChange={(e) => setReceipt((previous) => ({ ...previous, unitCost: e.target.value }))}
                />
              )}
            </div>
            {receivingShort && (
              <label className="app-toggle-field">
                <input
                  type="checkbox"
                  className="app-toggle app-toggle--checkbox"
                  checked={receipt.closeShort}
                  onChange={(e) => setReceipt((previous) => ({ ...previous, closeShort: e.target.checked }))}
                />
                <span>Close the order — nothing more is coming (otherwise it stays Partially Received)</span>
              </label>
            )}
            <TextAreaField label="Notes" value={receipt.notes} onChange={(value) => setReceipt((previous) => ({ ...previous, notes: value }))} rows={2} />
          </>
        )}
      </form>

      <ConfirmationDialog
        isOpen={confirmCancel}
        message="Cancel this order? It stays in the item's history."
        cancelLabel="Keep order"
        confirmLabel="Cancel order"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          run(() => cancelStockOrder(openOrder.id));
        }}
      />
    </PopupModal>
  );
}
