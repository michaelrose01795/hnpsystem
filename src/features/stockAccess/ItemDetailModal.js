// file location: src/features/stockAccess/ItemDetailModal.js
//
// One item's full record for /access/manage: the figures, who holds it, open
// restock requests, warranty records, and the complete timeline — every ledger
// row with the user, exact time, quantity, stock after, job / vehicle, reason
// and notes. From here a manager can edit, receive or adjust stock, deal with
// custody (return on someone's behalf, mark missing / found, write off),
// print a QR label and deactivate or reactivate the item.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import PopupModal from "@/components/popups/popupStyleApi";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { SectionSkeleton } from "@/components/ui/LoadingSkeleton";
import { Button, InputField, LayerTheme, StatusMessage } from "@/components/ui";
import {
  ACTION_META,
  CATEGORY_BY_VALUE,
  CHECKOUT_STATUS_META,
  RESTOCK_STATUS_BY_VALUE,
  UNIT_BY_VALUE,
  WARRANTY_STATUS_BY_VALUE,
  availableQuantity,
  deriveItemStatus,
  describeTransaction,
  formatDateTime,
  formatMoney,
  formatQuantity,
  isCheckoutOverdue,
  isOpenCheckout,
  outstandingOnCheckout,
  toNumber,
} from "@/features/stockAccess/stockAccessModel";
import { loadItemDetail, newRequestId, recordTransaction, setAccessItemActive } from "@/features/stockAccess/stockAccessClient";
import { StatusBadge } from "@/features/stockAccess/AccessBits";
import styles from "@/features/stockAccess/stockAccess.module.css";

const NONE = [];

const TIMELINE_FILTERS = [
  { value: "all", label: "All", actions: null },
  { value: "movements", label: "Movements", actions: ["take_out", "return", "consume", "receive", "adjustment"] },
  { value: "custody", label: "Custody", actions: ["take_out", "return", "mark_missing", "found", "write_off"] },
  { value: "restock", label: "Restock", actions: ["restock_request", "restock_update", "receive"] },
  { value: "record", label: "Record changes", actions: ["created", "edited", "activated", "deactivated", "warranty_store", "warranty_status"] },
];

const WRITE_OFF_REASONS = ["Lost", "Broken beyond repair", "Stolen", "Other"];

const statusLabel = (value) => RESTOCK_STATUS_BY_VALUE[value]?.label || WARRANTY_STATUS_BY_VALUE[value]?.label || value || "—";

function Stat({ label, value }) {
  return (
    // Summary tile: one labelled figure for the stock item, such as the current quantity.
    <div className="app-summary-item app-summary-item--theme">
      <span className="app-summary-label">{label}</span>
      <strong className="app-summary-value">{value}</strong>
    </div>
  );
}

const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function buildQr(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  let path = "";
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + quiet},${row + quiet}h1v1h-1z`;
    }
  }
  return { path, size: count + quiet * 2 };
}

/** Print a black-on-white label whatever the app theme is. */
function printLabel(item, url, locationName) {
  const qr = buildQr(url);
  const win = window.open("", "_blank", "width=420,height=560");
  if (!win) return;
  const caption = [locationName, item.bin, item.sku].filter(Boolean).join(" · ");
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(item.name)} label</title>
    <style>body{font-family:sans-serif;text-align:center;margin:24px}svg{width:60mm;height:60mm}h1{font-size:16pt;margin:8px 0 4px}p{font-size:10pt;margin:2px 0}</style>
    </head><body>
    <svg viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges"><path d="${qr.path}" fill="black"/></svg>
    <h1>${escapeHtml(item.name)}</h1>
    <p>${escapeHtml(caption)}</p>
    ${item.barcode ? `<p>${escapeHtml(item.barcode)}</p>` : ""}
    <script>window.onload=function(){window.print();}</script>
    </body></html>`);
  win.document.close();
}

function CustodyAction({ item, checkout, action, onDone, onCancel }) {
  const [reason, setReason] = useState("");
  const [quantity, setQuantity] = useState(String(outstandingOnCheckout(checkout)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [requestId] = useState(newRequestId);
  const labels = { return: "Return on their behalf", mark_missing: "Mark missing", found: "Mark found", write_off: "Write off" };

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await recordTransaction(item.storeKey, {
        itemId: item.id,
        action,
        checkoutId: checkout.id,
        quantity: action === "return" ? quantity : null,
        reason,
        clientRequestId: requestId,
      });
      onDone();
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  return (
    // Custody action form: confirms returning an item on someone's behalf, marking it missing or found, or writing it off, with a quantity, reason or note as needed.
    <LayerTheme>
      <strong>
        {labels[action]} — {checkout.holderName}, {formatQuantity(outstandingOnCheckout(checkout), item)}
      </strong>
      {action === "return" && outstandingOnCheckout(checkout) > 1 && (
        <InputField label="Quantity returned" type="number" inputMode="decimal" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      )}
      {action === "write_off" ? (
        <DropdownField label="Reason" required options={WRITE_OFF_REASONS.map((entry) => ({ value: entry, label: entry }))} value={reason} onValueChange={(value) => setReason(value || "")} placeholder="Required" />
      ) : (
        <InputField label="Note" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional" />
      )}
      {error && <StatusMessage tone="danger">{error}</StatusMessage>}
      <div className={styles.rowActions}>
        <Button type="button" variant={action === "write_off" ? "danger" : "primary"} size="sm" symbol={false} busy={saving} disabled={action === "write_off" && !reason} onClick={confirm}>
          Confirm
        </Button>
        <Button type="button" variant="secondary" size="sm" symbol={false} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </LayerTheme>
  );
}

export default function ItemDetailModal({ itemId, capabilities, onClose, onEdit, onMovement, onChanged }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [filter, setFilter] = useState("all");
  const [custody, setCustody] = useState(null); // { checkout, action }
  const [activeBusy, setActiveBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await loadItemDetail(itemId);
      setState({ loading: false, error: null, data });
    } catch (error) {
      setState({ loading: false, error: error.message, data: null });
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const data = state.data;
  const item = data?.item;
  const transactions = data?.transactions || NONE;
  const checkouts = data?.checkouts || NONE;
  const openCheckouts = useMemo(() => checkouts.filter(isOpenCheckout), [checkouts]);
  const locationName = useMemo(() => (data?.locations || NONE).find((entry) => entry.id === item?.locationId)?.name || "", [data, item]);
  const visible = useMemo(() => {
    const actions = TIMELINE_FILTERS.find((entry) => entry.value === filter)?.actions;
    return actions ? transactions.filter((tx) => actions.includes(tx.action)) : transactions;
  }, [filter, transactions]);

  const afterChange = async () => {
    setCustody(null);
    await load();
    onChanged?.();
  };

  const toggleActive = async () => {
    setActiveBusy(true);
    try {
      await setAccessItemActive(item.id, !item.isActive);
      await afterChange();
    } catch (error) {
      setState((prev) => ({ ...prev, error: error.message }));
    } finally {
      setActiveBusy(false);
    }
  };

  const status = item ? deriveItemStatus(item, openCheckouts) : null;
  const value = item && toNumber(item.unitCost) !== null ? toNumber(item.unitCost) * (toNumber(item.currentQuantity) || 0) : null;

  return (
    // Stock item record popup: the item's figures and details, who currently holds it, restock and warranty records and the full activity timeline, with buttons to receive or adjust stock, edit, print a label and deactivate.
    <PopupModal isOpen onClose={onClose} ariaLabel={item ? `${item.name} record` : "Stock item"} cardClassName="app-settings-popup-card">
      <div className={`app-settings-popup ${styles.sheet}`}>
        <header className="app-popup-compact-header">
          <h2 className={styles.sheetTitle}>{item?.name || "Stock item"}</h2>
          <div className="app-popup-compact-header__actions">
            {item && (
              <>
                <Button type="button" variant="primary" size="sm" symbol={false} onClick={() => onMovement(item)} disabled={!item.isActive}>
                  Receive / Adjust
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(item)}>
                  Edit
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => printLabel(item, `${window.location.origin}/access/${item.storeKey}?item=${item.id}`, locationName)}>
                  Print
                </Button>
              </>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        {state.loading && <SectionSkeleton rows={6} />}
        {state.error && <StatusMessage tone="danger">{state.error}</StatusMessage>}

        {item && (
          <>
            <div className={styles.statusLine}>
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              <span className={styles.muted}>
                {CATEGORY_BY_VALUE[item.category]?.label}
                {item.subcategory ? ` · ${item.subcategory}` : ""} · {item.returnRequired ? "must be returned" : "consumed on use"}
              </span>
            </div>

            <div className={styles.summaryGrid}>
              <Stat label="Current quantity" value={formatQuantity(item.currentQuantity, item)} />
              <Stat label="Available" value={formatQuantity(availableQuantity(item), item)} />
              <Stat label="Checked out" value={formatQuantity(item.checkedOutQuantity, item)} />
              <Stat label="Minimum / reorder" value={`${formatQuantity(item.minQuantity, item)} / ${formatQuantity(item.reorderQuantity, item)}`} />
              {capabilities?.viewCosts && <Stat label="Unit cost" value={formatMoney(item.unitCost)} />}
              {capabilities?.viewCosts && <Stat label="Stock value" value={formatMoney(value)} />}
            </div>

            <dl className={styles.detailGrid}>
              <div><dt>SKU / code</dt><dd>{item.sku || "—"}</dd></div>
              <div><dt>Barcode</dt><dd>{item.barcode || "—"}</dd></div>
              <div><dt>Location</dt><dd>{[locationName, item.bin].filter(Boolean).join(" · ") || "—"}</dd></div>
              <div><dt>Unit</dt><dd>{UNIT_BY_VALUE[item.unitType]?.label || item.unitType} · step {item.quantityStep}</dd></div>
              <div><dt>Overdue after</dt><dd>{item.returnRequired && item.loanPeriodHours ? `${item.loanPeriodHours} hours` : "—"}</dd></div>
              <div><dt>Supplier</dt><dd>{[item.supplierName, item.supplierPartNumber].filter(Boolean).join(" · ") || "—"}</dd></div>
              <div><dt>Last movement</dt><dd>{formatDateTime(item.lastMovementAt)}</dd></div>
              {item.description && <div><dt>Description</dt><dd>{item.description}</dd></div>}
            </dl>

            {openCheckouts.length > 0 && (
              // Who has it: each person currently holding the item, how many, when it is due back and the related job, with manager buttons for returned, missing, found and write off.
              <LayerTheme>
                <h3 className={styles.sectionTitle}>Who has it</h3>
                <ul className={styles.timeline}>
                  {openCheckouts.map((checkout) => (
                    <li key={checkout.id} className={styles.timelineRow}>
                      <span className={styles.timelineTime}>{formatDateTime(checkout.takenAt)}</span>
                      <div className={styles.timelineBody}>
                        <span className={styles.timelineSummary}>
                          {checkout.holderName} · {formatQuantity(outstandingOnCheckout(checkout), item)}{" "}
                          <StatusBadge tone={isCheckoutOverdue(checkout) ? "danger" : CHECKOUT_STATUS_META[checkout.status]?.tone}>
                            {isCheckoutOverdue(checkout) ? "Overdue" : CHECKOUT_STATUS_META[checkout.status]?.label}
                          </StatusBadge>
                        </span>
                        <span className={styles.cellSub}>
                          {checkout.dueAt ? `Due ${formatDateTime(checkout.dueAt)}` : "No due time"}
                          {[checkout.jobNumber && `Job ${checkout.jobNumber}`, checkout.vehicleReg].filter(Boolean).map((text) => ` · ${text}`)}
                        </span>
                        {capabilities?.manageCustody && (
                          <div className={styles.rowActions}>
                            <Button type="button" size="xs" variant="secondary" symbol={false} onClick={() => setCustody({ checkout, action: "return" })}>Returned</Button>
                            {checkout.status === "out" && (
                              <Button type="button" size="xs" variant="secondary" symbol={false} onClick={() => setCustody({ checkout, action: "mark_missing" })}>Missing</Button>
                            )}
                            {checkout.status === "missing" && (
                              <Button type="button" size="xs" variant="secondary" symbol={false} onClick={() => setCustody({ checkout, action: "found" })}>Found</Button>
                            )}
                            <Button type="button" size="xs" variant="danger" symbol={false} onClick={() => setCustody({ checkout, action: "write_off" })}>Write off</Button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {custody && <CustodyAction item={item} checkout={custody.checkout} action={custody.action} onDone={afterChange} onCancel={() => setCustody(null)} />}
              </LayerTheme>
            )}

            {(data.restock?.length > 0 || data.warranty?.length > 0) && (
              <div className={styles.fieldGrid}>
                {data.restock?.length > 0 && (
                  // Restock requests: the five most recent requests with status, quantity, requester and date.
                  <LayerTheme>
                    <h3 className={styles.sectionTitle}>Restock requests</h3>
                    {data.restock.slice(0, 5).map((entry) => (
                      <span key={entry.id} className={styles.small}>
                        <StatusBadge tone={RESTOCK_STATUS_BY_VALUE[entry.status]?.tone}>{RESTOCK_STATUS_BY_VALUE[entry.status]?.label}</StatusBadge>{" "}
                        {formatQuantity(entry.quantityRequested, item)} · {entry.requesterName} · {formatDateTime(entry.requestedAt)}
                      </span>
                    ))}
                  </LayerTheme>
                )}
                {data.warranty?.length > 0 && (
                  // Warranty storage: the five most recent warranty records with status, job number, vehicle registration and date stored.
                  <LayerTheme>
                    <h3 className={styles.sectionTitle}>Warranty storage</h3>
                    {data.warranty.slice(0, 5).map((entry) => (
                      <span key={entry.id} className={styles.small}>
                        <StatusBadge tone={WARRANTY_STATUS_BY_VALUE[entry.status]?.tone}>{WARRANTY_STATUS_BY_VALUE[entry.status]?.label}</StatusBadge>{" "}
                        {[entry.jobNumber && `Job ${entry.jobNumber}`, entry.vehicleReg].filter(Boolean).join(" · ")} · {formatDateTime(entry.storedAt)}
                      </span>
                    ))}
                  </LayerTheme>
                )}
              </div>
            )}

            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>Timeline</h3>
              <span className={styles.muted}>{visible.length} of {transactions.length}</span>
            </div>
            <TabGroup items={TIMELINE_FILTERS.map((entry) => ({ label: entry.label, value: entry.value }))} value={filter} onChange={setFilter} ariaLabel="Timeline filter" />
            <ul className={styles.timeline}>
              {visible.map((tx) => (
                <li key={tx.id} className={styles.timelineRow}>
                  <span className={styles.timelineTime}>{formatDateTime(tx.occurredAt)}</span>
                  <div className={styles.timelineBody}>
                    <span className={styles.timelineSummary}>
                      {describeTransaction(tx, item)}
                      {tx.overrideNegative ? " · OVERRIDE" : ""}
                    </span>
                    <span className={styles.cellSub}>
                      {tx.userName || "Unknown user"}
                      {tx.detail?.onBehalfOf ? ` for ${tx.detail.onBehalfOf}` : ""}
                      {tx.stockAfter !== null && ["take_out", "return", "consume", "receive", "adjustment", "write_off"].includes(tx.action)
                        ? ` · stock ${formatQuantity(tx.stockBefore, item)} → ${formatQuantity(tx.stockAfter, item)} · available ${formatQuantity(tx.availableAfter, item)}`
                        : ""}
                      {tx.locationName || tx.bin ? ` · ${[tx.locationName, tx.bin].filter(Boolean).join(" · ")}` : ""}
                    </span>
                    {(tx.jobNumber || tx.vehicleReg || tx.reason || tx.notes || tx.detail?.to) && (
                      <span className={styles.cellSub}>
                        {[
                          tx.jobNumber && `Job ${tx.jobNumber}`,
                          tx.vehicleReg,
                          tx.detail?.to && `${statusLabel(tx.detail.from)} → ${statusLabel(tx.detail.to)}`,
                          tx.reason,
                          tx.notes,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                    {tx.action === "edited" && tx.detail?.changes && (
                      <span className={styles.cellSub}>Changed: {Object.keys(tx.detail.changes).join(", ")}</span>
                    )}
                  </div>
                </li>
              ))}
              {!visible.length && <li className={styles.muted}>No {filter === "all" ? "" : "matching "}activity yet.</li>}
            </ul>

            <div className={styles.rowActions}>
              <Button type="button" variant={item.isActive ? "danger" : "secondary"} size="sm" symbol={false} busy={activeBusy} onClick={toggleActive}>
                {item.isActive ? "Deactivate item" : "Reactivate item"}
              </Button>
              <span className={styles.muted}>{ACTION_META.deactivated.label} items stay in history but cannot be moved.</span>
            </div>
          </>
        )}
      </div>
    </PopupModal>
  );
}
