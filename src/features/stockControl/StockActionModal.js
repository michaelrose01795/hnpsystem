// file location: src/features/stockControl/StockActionModal.js
//
// The fast stock workflow for one item, as four clearly separate actions:
//   Check     a physical check — what is there now (count / level / dipstick)
//   Use       stock out, with a reason and optional job number
//   Stock in  stock added outside an order (deliveries use Mark Received)
//   Adjust    an audited correction with a mandatory reason
// Tabs only appear for actions the caller's role may take. Opened from a card,
// the compact list or a scanned QR label.

import React, { useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { Button, InputField, StatusMessage } from "@/components/ui";
import {
  ADJUSTMENT_REASONS,
  STOCK_IN_REASONS,
  STOCK_OUT_REASONS,
  formatDate,
  formatQuantity,
  toNumber,
  unitShortLabel,
} from "@/features/stockControl/stockModel";
import { ChoiceButtons, MeasureInputs, TextAreaField, emptyReading, readingPayload } from "@/features/stockControl/StockFields";
import { recordStockAction } from "@/features/stockControl/stockClient";

const ACTIONS = [
  { id: "check", label: "Check", capability: "check", submit: "Save Check" },
  { id: "use", label: "Use", capability: "use", submit: "Book Out" },
  { id: "in", label: "Stock In", capability: "receive", submit: "Book In" },
  { id: "adjust", label: "Adjust", capability: "adjust", submit: "Save Adjustment" },
];

const reasonOptions = (reasons) => reasons.map((reason) => ({ value: reason, label: reason }));

export default function StockActionModal({ row, initialAction = "check", capabilities, onClose, onSaved }) {
  const { item } = row;
  const available = useMemo(() => ACTIONS.filter((action) => capabilities[action.capability]), [capabilities]);
  const [tab, setTab] = useState(() => (available.some((a) => a.id === initialAction) ? initialAction : available[0]?.id));
  const [reading, setReading] = useState(emptyReading);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [adjustMode, setAdjustMode] = useState("delta");
  const [direction, setDirection] = useState("remove");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const current = toNumber(item.currentQuantity);
  const unit = unitShortLabel(item);
  const action = ACTIONS.find((entry) => entry.id === tab);

  const switchTab = (next) => {
    setTab(next);
    setQuantity("");
    setReason("");
    setError(null);
  };

  const adjustPreview = (() => {
    const amount = toNumber(quantity);
    if (amount === null || current === null) return null;
    if (adjustMode === "set") return amount;
    return Math.max(0, current + (direction === "add" ? amount : -amount));
  })();

  const buildBody = () => {
    const base = { itemId: item.id, notes };
    if (tab === "check") return { ...base, type: "check", ...readingPayload(reading) };
    if (tab === "use") return { ...base, type: "stock_out", quantity, reason, jobNumber };
    if (tab === "in") return { ...base, type: "stock_in", quantity, reason, unitCost: unitCost === "" ? null : unitCost };
    const amount = toNumber(quantity);
    return adjustMode === "set"
      ? { ...base, type: "adjustment", mode: "set", quantity, reason }
      : { ...base, type: "adjustment", mode: "delta", delta: amount === null ? null : direction === "add" ? amount : -amount, reason };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await recordStockAction(buildBody());
      onSaved(result);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  const needsQuantity = tab !== "check" && current === null;

  return (
    <PopupModal isOpen onClose={onClose} ariaLabel={`Record stock for ${item.title}`} cardClassName="app-settings-popup-card stock-popup">
      <form className="app-settings-popup stock-form" onSubmit={handleSubmit}>
        <header className="app-popup-compact-header">
          <h2>{item.title}</h2>
          <div className="app-popup-compact-header__actions">
            {action && (
              <Button type="submit" variant="primary" size="sm" symbol={false} busy={saving} disabled={needsQuantity}>
                {action.submit}
              </Button>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        <div className="stock-callout">
          <span>
            {[row.location?.name, row.category?.name].filter(Boolean).join(" · ") || "Stock"} · last checked {formatDate(item.lastCheck)}
          </span>
          <strong>Recorded: {formatQuantity(item.currentQuantity, item)}</strong>
        </div>

        {available.length > 1 && (
          <TabGroup items={available.map((a) => ({ label: a.label, value: a.id }))} value={tab} onChange={switchTab} ariaLabel="Stock action" />
        )}

        {error && <StatusMessage tone="danger">{error}</StatusMessage>}
        {needsQuantity && <StatusMessage tone="warning">This item has no recorded quantity yet. Record a check first.</StatusMessage>}

        {tab === "check" && <MeasureInputs item={item} value={reading} onChange={setReading} autoFocus />}

        {tab === "use" && !needsQuantity && (
          <div className="stock-form__grid">
            <InputField label={`Quantity used (${unit})`} type="number" inputMode="decimal" min="0" step="any" autoFocus required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <DropdownField label="Reason" required options={reasonOptions(STOCK_OUT_REASONS)} value={reason} onValueChange={(value) => setReason(value || "")} placeholder="Choose a reason" />
            <InputField label="Job number" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} placeholder={reason === "Used on job" ? "Recommended" : "Optional"} />
          </div>
        )}

        {tab === "in" && !needsQuantity && (
          <>
            <p className="stock-hint">For a delivery against an order, use Mark Received so the order and outstanding quantity update.</p>
            <div className="stock-form__grid">
              <InputField label={`Quantity added (${unit})`} type="number" inputMode="decimal" min="0" step="any" autoFocus required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <DropdownField label="Reason" required options={reasonOptions(STOCK_IN_REASONS)} value={reason} onValueChange={(value) => setReason(value || "")} placeholder="Choose a reason" />
              {capabilities.viewCosts && (
                <InputField label="Unit cost (£)" type="number" inputMode="decimal" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="Optional" />
              )}
            </div>
          </>
        )}

        {tab === "adjust" && !needsQuantity && (
          <>
            <ChoiceButtons
              label="Adjustment"
              options={[
                { value: "delta", label: "Add or remove" },
                { value: "set", label: "Set exact quantity" },
              ]}
              value={adjustMode}
              onChange={(value) => setAdjustMode(value || "delta")}
            />
            {adjustMode === "delta" && (
              <ChoiceButtons
                options={[
                  { value: "remove", label: "Remove" },
                  { value: "add", label: "Add" },
                ]}
                ariaLabel="Direction"
                value={direction}
                onChange={(value) => setDirection(value || "remove")}
              />
            )}
            <div className="stock-form__grid">
              <InputField
                label={adjustMode === "set" ? `New quantity (${unit})` : `Amount (${unit})`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <DropdownField label="Reason" required options={reasonOptions(ADJUSTMENT_REASONS)} value={reason} onValueChange={(value) => setReason(value || "")} placeholder="Required" />
            </div>
            {adjustPreview !== null && (
              <div className="stock-callout">
                <span>After adjustment</span>
                <strong>{formatQuantity(adjustPreview, item)}</strong>
                <span>
                  {adjustPreview === current ? "No change" : `${adjustPreview > current ? "+" : "−"}${formatQuantity(Math.abs(adjustPreview - current), item)} · recorded with your name and the time`}
                </span>
              </div>
            )}
          </>
        )}

        {action && <TextAreaField label="Notes" value={notes} onChange={setNotes} rows={2} />}
      </form>
    </PopupModal>
  );
}
