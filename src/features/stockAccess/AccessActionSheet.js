// file location: src/features/stockAccess/AccessActionSheet.js
//
// The few-seconds workflow for one item on /access: the status (who has it,
// how many are on the shelf), big action buttons, the quantity stepper and one
// confirm button. The primary action is preselected with a quantity of one, so
// the usual movement is: tap the item, tap confirm.
//
// Safeguards
//   * a live preview of the stock after the movement (planTransaction)
//   * one idempotency key per submission — a double tap or a retry is booked once
//   * a shortage is refused; roles with overrideNegative can record it with a reason
//   * reusable items show who holds them before anyone takes one
//   * a clear confirmation with the exact time, then "Again" for a repeat

import React, { useEffect, useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { Button, InputField, StatusMessage } from "@/components/ui";
import {
  ACTION_META,
  NEGATIVE_OVERRIDE_REASONS,
  RESTOCK_REASONS,
  RESTOCK_STATUS_BY_VALUE,
  availableActions,
  availableQuantity,
  formatDateTime,
  formatQuantity,
  formatRelative,
  isCheckoutOverdue,
  outstandingOnCheckout,
  planTransaction,
  suggestRestockQuantity,
  toNumber,
} from "@/features/stockAccess/stockAccessModel";
import { newRequestId, recordTransaction, requestRestock } from "@/features/stockAccess/stockAccessClient";
import { QuantityStepper, StatusBadge } from "@/features/stockAccess/AccessBits";
import styles from "@/features/stockAccess/stockAccess.module.css";

const SUBMIT_LABEL = {
  take_out: "Take Out",
  return: "Return",
  consume: "Use",
  restock_request: "Request Restock",
};

function defaultCheckoutId(openCheckouts, userId) {
  const mine = openCheckouts.find((checkout) => userId !== null && checkout.holderUserId === userId);
  if (mine) return mine.id;
  return openCheckouts.length === 1 ? openCheckouts[0].id : null;
}

export default function AccessActionSheet({
  item,
  status,
  openCheckouts = [],
  openRestock = null,
  userId = null,
  capabilities,
  locationName = "",
  initialAction = null,
  onClose,
  onRecorded,
  onWarranty,
}) {
  const actions = useMemo(
    () => availableActions(item, { capabilities, openCheckouts, userId }),
    [capabilities, item, openCheckouts, userId]
  );
  const primary = actions.find((entry) => entry.primary) || actions[0];
  const [action, setAction] = useState(() =>
    actions.some((entry) => entry.action === initialAction) ? initialAction : primary?.action || null
  );
  const [quantity, setQuantity] = useState(() => (action === "restock_request" ? String(suggestRestockQuantity(item)) : "1"));
  const [checkoutId, setCheckoutId] = useState(() => defaultCheckoutId(openCheckouts, userId));
  const [showRefs, setShowRefs] = useState(false);
  const [jobNumber, setJobNumber] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [notes, setNotes] = useState("");
  const [restockReason, setRestockReason] = useState(availableQuantity(item) <= 0 ? "Out of stock" : "Running low");
  const [requestId, setRequestId] = useState(newRequestId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [override, setOverride] = useState({ offered: false, reason: "" });
  const [result, setResult] = useState(null);

  const checkout = openCheckouts.find((entry) => entry.id === checkoutId) || null;
  const isRestock = action === "restock_request";

  // Choosing a different action starts a new submission.
  const chooseAction = (next) => {
    if (next === "warranty_store") {
      onWarranty?.(item);
      return;
    }
    setAction(next);
    setError(null);
    setOverride({ offered: false, reason: "" });
    setRequestId(newRequestId());
    setQuantity(next === "restock_request" ? String(suggestRestockQuantity(item)) : "1");
    if (next === "return") setCheckoutId(defaultCheckoutId(openCheckouts, userId));
  };

  // After a return closes a checkout the list changes; keep the choice valid.
  useEffect(() => {
    if (checkoutId && !openCheckouts.some((entry) => entry.id === checkoutId)) {
      setCheckoutId(defaultCheckoutId(openCheckouts, userId));
    }
  }, [checkoutId, openCheckouts, userId]);

  const plan = useMemo(() => {
    if (!action || isRestock) return null;
    return planTransaction({
      action,
      item,
      quantity,
      checkout: action === "return" ? checkout : null,
      allowNegative: override.offered && Boolean(override.reason),
      reason: override.reason,
      holder: { userId, name: "" },
    });
  }, [action, checkout, isRestock, item, override.offered, override.reason, quantity, userId]);

  const canOverride = capabilities?.overrideNegative === true;
  const blocked = plan ? plan.errors.length > 0 && !(plan.negative && canOverride && override.offered && override.reason) : false;
  const needsCheckoutChoice = action === "return" && item.returnRequired && !checkout;

  const submit = async (event) => {
    event?.preventDefault?.();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (isRestock) {
        const data = await requestRestock({ itemId: item.id, quantityRequested: quantity, reason: restockReason, notes });
        setResult({ message: data.message, occurredAt: data.request?.requestedAt, warnings: [], joined: data.joined });
      } else {
        const data = await recordTransaction(item.storeKey, {
          itemId: item.id,
          action,
          quantity,
          checkoutId: action === "return" ? checkoutId : null,
          jobNumber,
          vehicleReg,
          notes,
          clientRequestId: requestId,
          allowNegative: override.offered && Boolean(override.reason),
          reason: override.offered ? override.reason : "",
        });
        setResult({ message: data.message, occurredAt: data.transaction?.occurredAt, warnings: data.warnings || [], duplicate: data.duplicate });
      }
      onRecorded?.();
    } catch (saveError) {
      if (saveError.code === "negative" && saveError.canOverride) setOverride((prev) => ({ ...prev, offered: true }));
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const again = () => {
    setResult(null);
    setError(null);
    setOverride({ offered: false, reason: "" });
    setRequestId(newRequestId());
  };

  const maxForReturn = action === "return" && checkout ? outstandingOnCheckout(checkout) : null;

  return (
    <PopupModal isOpen onClose={onClose} ariaLabel={`Stock access for ${item.name}`} cardClassName="app-settings-popup-card">
      <form className={`app-settings-popup ${styles.sheet}`} onSubmit={submit}>
        <header className="app-popup-compact-header">
          <h2 className={styles.sheetTitle}>{item.name}</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        <div className={styles.statusLine}>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          <span>
            <strong>{formatQuantity(availableQuantity(item), item)}</strong> {item.returnRequired ? "on the shelf" : "in stock"}
            {item.returnRequired && item.currentQuantity > 1 ? ` of ${formatQuantity(item.currentQuantity, item)}` : ""}
          </span>
          {(locationName || item.bin) && <span className={styles.muted}>{[locationName, item.bin].filter(Boolean).join(" · ")}</span>}
        </div>

        {openCheckouts.length > 0 && !result && (
          <StatusMessage tone={openCheckouts.some((entry) => isCheckoutOverdue(entry) || entry.status === "missing") ? "warning" : "info"}>
            {openCheckouts.map((entry) => (
              <span key={entry.id} className={styles.small}>
                {entry.status === "missing" ? "Missing — last with " : ""}
                <strong>{entry.holderName}</strong> has {formatQuantity(outstandingOnCheckout(entry), item)} · taken {formatRelative(entry.takenAt)}
                {entry.dueAt ? ` · due ${formatDateTime(entry.dueAt)}` : ""}
                {isCheckoutOverdue(entry) ? " · OVERDUE" : ""}
                <br />
              </span>
            ))}
          </StatusMessage>
        )}

        {result ? (
          <div className={styles.confirm} role="status" aria-live="polite">
            <span className={styles.confirmMark} aria-hidden="true">✓</span>
            <p className={styles.confirmText}>{result.message}</p>
            {result.occurredAt && <span className={styles.muted}>{formatDateTime(result.occurredAt)}</span>}
            {result.warnings.map((warning) => (
              <StatusMessage key={warning} tone="warning">{warning}</StatusMessage>
            ))}
            <div className={styles.submitRow}>
              {!isRestock && (
                <Button type="button" variant="secondary" symbol={false} onClick={again}>
                  Again
                </Button>
              )}
              <Button type="button" variant="primary" symbol={false} onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            {actions.length > 1 && (
              <div className={styles.actionGrid} role="group" aria-label="What are you doing?">
                {actions.map((entry) => (
                  <Button
                    key={`${entry.action}-${entry.label}`}
                    type="button"
                    symbol={false}
                    variant={action === entry.action ? "primary" : "secondary"}
                    aria-pressed={action === entry.action}
                    onClick={() => chooseAction(entry.action)}
                  >
                    {entry.label}
                  </Button>
                ))}
              </div>
            )}

            {!actions.length && <StatusMessage tone="info">This item is inactive, so nothing can be recorded against it.</StatusMessage>}

            {action === "return" && item.returnRequired && openCheckouts.length > 1 && (
              <div className={styles.actionGrid} role="group" aria-label="Whose item are you returning?">
                {openCheckouts.map((entry) => (
                  <Button
                    key={entry.id}
                    type="button"
                    size="sm"
                    symbol={false}
                    variant={checkoutId === entry.id ? "primary" : "secondary"}
                    aria-pressed={checkoutId === entry.id}
                    onClick={() => setCheckoutId(entry.id)}
                  >
                    {entry.holderName} · {formatQuantity(outstandingOnCheckout(entry), item)}
                  </Button>
                ))}
              </div>
            )}

            {isRestock && openRestock ? (
              <StatusMessage tone="info">
                Already {RESTOCK_STATUS_BY_VALUE[openRestock.status]?.label.toLowerCase()} by {openRestock.requesterName || "someone"} at{" "}
                {formatDateTime(openRestock.requestedAt)} ({formatQuantity(openRestock.quantityRequested, item)}). Parts has it — no need to request again.
              </StatusMessage>
            ) : (
              action && (
                <>
                  <QuantityStepper
                    item={item}
                    value={quantity}
                    onChange={setQuantity}
                    label={isRestock ? "Quantity needed" : "Quantity"}
                    max={maxForReturn}
                  />
                  {isRestock && (
                    <div className={styles.chips} role="group" aria-label="Reason">
                      {RESTOCK_REASONS.map((reason) => (
                        <Button
                          key={reason}
                          type="button"
                          size="sm"
                          pill
                          symbol={false}
                          variant={restockReason === reason ? "primary" : "secondary"}
                          aria-pressed={restockReason === reason}
                          onClick={() => setRestockReason(reason)}
                        >
                          {reason}
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              )
            )}

            {action && !isRestock && (
              <>
                {showRefs ? (
                  <div className={styles.fieldGrid}>
                    <InputField label="Job number" inputMode="numeric" value={jobNumber} onChange={(event) => setJobNumber(event.target.value)} placeholder="Optional" />
                    <InputField label="Vehicle reg" value={vehicleReg} onChange={(event) => setVehicleReg(event.target.value.toUpperCase())} placeholder="Optional" autoCapitalize="characters" />
                    <InputField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
                  </div>
                ) : (
                  <Button type="button" variant="ghost" size="sm" symbol={false} onClick={() => setShowRefs(true)}>
                    Add job / reg / note
                  </Button>
                )}
              </>
            )}
            {isRestock && !openRestock && (
              <InputField label="Note for Parts" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
            )}

            {plan && !plan.errors.length && (
              <div className={styles.preview}>
                <span>After this</span>
                <strong>
                  {formatQuantity(plan.preview.availableAfter, item)} {item.returnRequired ? "on the shelf" : "in stock"}
                </strong>
              </div>
            )}
            {plan?.warnings.map((warning) => (
              <StatusMessage key={warning} tone="warning">{warning}</StatusMessage>
            ))}
            {plan?.errors.length > 0 && !error && (
              <StatusMessage tone={plan.negative ? "warning" : "danger"}>{plan.errors[0]}</StatusMessage>
            )}
            {error && <StatusMessage tone="danger">{error}</StatusMessage>}

            {plan?.negative && canOverride && (
              override.offered ? (
                <DropdownField
                  label="Override reason"
                  required
                  options={NEGATIVE_OVERRIDE_REASONS.map((reason) => ({ value: reason, label: reason }))}
                  value={override.reason}
                  onValueChange={(value) => setOverride({ offered: true, reason: value || "" })}
                  placeholder="Required to record below zero"
                />
              ) : (
                <Button type="button" variant="ghost" size="sm" symbol={false} onClick={() => setOverride({ offered: true, reason: "" })}>
                  Record anyway (authorised override)
                </Button>
              )
            )}

            {action && !(isRestock && openRestock) && (
              <Button
                type="submit"
                variant="primary"
                symbol={false}
                busy={saving}
                disabled={blocked || needsCheckoutChoice || !(toNumber(quantity) > 0)}
              >
                {SUBMIT_LABEL[action] || ACTION_META[action]?.label} {isRestock ? "" : formatQuantity(quantity, item)}
              </Button>
            )}
          </>
        )}
      </form>
    </PopupModal>
  );
}
