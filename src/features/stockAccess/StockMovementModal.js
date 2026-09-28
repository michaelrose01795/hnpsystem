// file location: src/features/stockAccess/StockMovementModal.js
//
// Manager stock changes for one item:
//   Receive     stock in — optionally against an open restock request, which
//               is then marked received or partially received
//   Adjustment  an audited correction (add / remove, or set an exact count)
//               with a mandatory reason; recorded with the user and time
// Both go through /api/access/transactions, so they land in the ledger like
// every other movement and are idempotent per submission.

import React, { useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { Button, InputField, StatusMessage } from "@/components/ui";
import {
  ADJUSTMENT_REASONS,
  NEGATIVE_OVERRIDE_REASONS,
  OPEN_RESTOCK_STATUSES,
  formatDate,
  formatQuantity,
  planTransaction,
  roundQuantity,
  toNumber,
} from "@/features/stockAccess/stockAccessModel";
import { newRequestId, recordTransaction } from "@/features/stockAccess/stockAccessClient";
import { QuantityStepper } from "@/features/stockAccess/AccessBits";
import styles from "@/features/stockAccess/stockAccess.module.css";

const MODES = [
  { value: "receive", label: "Receive stock", capability: "processRestock" },
  { value: "adjustment", label: "Adjust", capability: "adjust" },
];

export default function StockMovementModal({ item, restock = [], capabilities, initialMode = "receive", initialRestockId = null, onClose, onSaved }) {
  const modes = MODES.filter((entry) => capabilities?.[entry.capability]);
  const [mode, setMode] = useState(modes.some((entry) => entry.value === initialMode) ? initialMode : modes[0]?.value);
  const openRestock = useMemo(() => restock.filter((entry) => entry.itemId === item.id && OPEN_RESTOCK_STATUSES.includes(entry.status)), [item.id, restock]);
  const [restockId, setRestockId] = useState(initialRestockId || openRestock[0]?.id || "");
  const linked = openRestock.find((entry) => entry.id === restockId) || null;
  const [quantity, setQuantity] = useState(() => {
    if (linked) return String(Math.max(roundQuantity(linked.quantityRequested - linked.quantityReceived), 0));
    return "1";
  });
  const [adjustKind, setAdjustKind] = useState("remove"); // add | remove | set
  const [reason, setReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [notes, setNotes] = useState("");
  const [requestId] = useState(newRequestId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const amount = toNumber(quantity);
  const signed = mode === "adjustment" && adjustKind === "remove" ? -(amount || 0) : amount;
  const plan = useMemo(
    () =>
      planTransaction({
        action: mode,
        item,
        quantity: signed,
        mode: mode === "adjustment" && adjustKind === "set" ? "set" : "delta",
        reason: mode === "adjustment" ? reason : "",
        allowNegative: Boolean(overrideReason),
      }),
    [adjustKind, item, mode, overrideReason, reason, signed]
  );

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await recordTransaction(item.storeKey, {
        itemId: item.id,
        action: mode,
        quantity: signed,
        mode: mode === "adjustment" && adjustKind === "set" ? "set" : "delta",
        restockRequestId: mode === "receive" && linked ? linked.id : null,
        reason: mode === "adjustment" ? [reason, overrideReason].filter(Boolean).join(" — ") : overrideReason,
        allowNegative: Boolean(overrideReason),
        notes,
        clientRequestId: requestId,
      });
      onSaved?.();
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  const outstandingOut = item.checkedOutQuantity || 0;

  return (
    <PopupModal isOpen onClose={onClose} ariaLabel={`Stock change for ${item.name}`} cardClassName="app-settings-popup-card">
      <form className={`app-settings-popup ${styles.sheet}`} onSubmit={submit}>
        <header className="app-popup-compact-header">
          <h2 className={styles.sheetTitle}>{item.name}</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="submit" variant="primary" size="sm" symbol={false} busy={saving} disabled={plan.errors.length > 0 && !(plan.negative && overrideReason)}>
              {mode === "receive" ? "Book In" : "Save Adjustment"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        <div className={styles.preview}>
          <span>
            Recorded: <strong>{formatQuantity(item.currentQuantity, item)}</strong>
            {outstandingOut > 0 ? ` (${formatQuantity(outstandingOut, item)} checked out)` : ""}
          </span>
          {!plan.errors.length && (
            <span>
              After: <strong>{formatQuantity(plan.preview.currentAfter, item)}</strong>
            </span>
          )}
        </div>

        {modes.length > 1 && (
          <div className={styles.actionGrid} role="group" aria-label="Change type">
            {modes.map((entry) => (
              <Button key={entry.value} type="button" symbol={false} variant={mode === entry.value ? "primary" : "secondary"} aria-pressed={mode === entry.value} onClick={() => setMode(entry.value)}>
                {entry.label}
              </Button>
            ))}
          </div>
        )}

        {mode === "receive" && openRestock.length > 0 && (
          <DropdownField
            label="Against restock request"
            options={[
              { value: "", label: "Not against a request" },
              ...openRestock.map((entry) => ({
                value: entry.id,
                label: `${formatQuantity(entry.quantityRequested, item)} requested ${formatDate(entry.requestedAt)} by ${entry.requesterName || "—"}${entry.quantityReceived ? ` · ${formatQuantity(entry.quantityReceived, item)} received` : ""}`,
              })),
            ]}
            value={restockId}
            onValueChange={(value) => setRestockId(value || "")}
          />
        )}

        {mode === "adjustment" && (
          <div className={styles.actionGrid} role="group" aria-label="Adjustment">
            {[
              { value: "remove", label: "Remove" },
              { value: "add", label: "Add" },
              { value: "set", label: "Set exact count" },
            ].map((entry) => (
              <Button key={entry.value} type="button" size="sm" symbol={false} variant={adjustKind === entry.value ? "primary" : "secondary"} aria-pressed={adjustKind === entry.value} onClick={() => setAdjustKind(entry.value)}>
                {entry.label}
              </Button>
            ))}
          </div>
        )}

        <QuantityStepper item={item} value={quantity} onChange={setQuantity} label={mode === "adjustment" && adjustKind === "set" ? "Counted total" : "Quantity"} id="stock-access-manage-quantity" />

        {mode === "adjustment" && (
          <DropdownField
            label="Reason"
            required
            options={ADJUSTMENT_REASONS.map((entry) => ({ value: entry, label: entry }))}
            value={reason}
            onValueChange={(value) => setReason(value || "")}
            placeholder="Required"
          />
        )}
        <InputField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={mode === "receive" ? "Delivery note / invoice number" : "Optional"} />

        {plan.errors.length > 0 && <StatusMessage tone={plan.negative ? "warning" : "danger"}>{plan.errors[0]}</StatusMessage>}
        {plan.negative && capabilities?.overrideNegative && (
          <DropdownField
            label="Override reason"
            options={NEGATIVE_OVERRIDE_REASONS.map((entry) => ({ value: entry, label: entry }))}
            value={overrideReason}
            onValueChange={(value) => setOverrideReason(value || "")}
            placeholder="Required to go below zero"
          />
        )}
        {mode === "adjustment" && adjustKind === "set" && outstandingOut > 0 && (
          <StatusMessage tone="info">
            Count everything the business holds, including the {formatQuantity(outstandingOut, item)} checked out — the checked-out units are not on the shelf.
          </StatusMessage>
        )}
        {error && <StatusMessage tone="danger">{error}</StatusMessage>}
      </form>
    </PopupModal>
  );
}
