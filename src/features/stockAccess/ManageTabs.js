// file location: src/features/stockAccess/ManageTabs.js
//
// The secondary tabs of /access/manage:
//   CheckoutsTab  everything currently out, overdue or missing, and who has it
//   RestockTab    Requested -> Ordered -> (Partially) Received / Cancelled
//   WarrantyTab   parts in warranty storage and their outcome
//   ActivityTab   the ledger across every item
// Tables are the global .app-data-table, untouched (CLAUDE.md 3.0b rule 5a).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import { Button, DataTableShell, EmptyState, InputField, StatusMessage } from "@/components/ui";
import {
  ACTION_META,
  CHECKOUT_STATUS_META,
  OPEN_RESTOCK_STATUSES,
  RESTOCK_STATUS_BY_VALUE,
  WARRANTY_STATUSES,
  WARRANTY_STATUS_BY_VALUE,
  describeTransaction,
  formatDate,
  formatDateTime,
  formatQuantity,
  isCheckoutOverdue,
  outstandingOnCheckout,
} from "@/features/stockAccess/stockAccessModel";
import { loadActivity, updateRestock, updateWarrantyPart } from "@/features/stockAccess/stockAccessClient";
import { StatusBadge } from "@/features/stockAccess/AccessBits";
import styles from "@/features/stockAccess/stockAccess.module.css";

const NONE = [];
const FALLBACK_ITEM = { unitType: "each", name: "Unknown item" };

const openOnKey = (handler) => (event) => {
  if (event.target === event.currentTarget && event.key === "Enter") handler();
};

// ---------------------------------------------------------------------------
// Checked out
// ---------------------------------------------------------------------------
export function CheckoutsTab({ checkouts = NONE, itemsById, onOpenItem }) {
  const rows = useMemo(
    () =>
      [...checkouts].sort((a, b) => {
        const rank = (entry) => (entry.status === "missing" ? 0 : isCheckoutOverdue(entry) ? 1 : 2);
        return rank(a) - rank(b) || String(a.takenAt).localeCompare(String(b.takenAt));
      }),
    [checkouts]
  );
  if (!rows.length) return <EmptyState title="Nothing is checked out" description="Every reusable item is back on the shelf." />;
  return (
    <DataTableShell stack visibleRows={15}>
      <table className="app-data-table app-data-table--clickable">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Holder</th>
            <th scope="col" data-table-cell="nowrap">Qty out</th>
            <th scope="col" data-table-cell="nowrap">Taken</th>
            <th scope="col" data-table-cell="nowrap">Due</th>
            <th scope="col">Status</th>
            <th scope="col">Job / reg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((checkout) => {
            const item = itemsById.get(checkout.itemId) || FALLBACK_ITEM;
            const overdue = isCheckoutOverdue(checkout);
            return (
              <tr key={checkout.id} tabIndex={0} onClick={() => onOpenItem(checkout.itemId)} onKeyDown={openOnKey(() => onOpenItem(checkout.itemId))}>
                <td><span className={styles.cellTitle}>{item.name}</span></td>
                <td>{checkout.holderName}</td>
                <td data-table-cell="nowrap">{formatQuantity(outstandingOnCheckout(checkout), item)}</td>
                <td data-table-cell="nowrap">{formatDateTime(checkout.takenAt)}</td>
                <td data-table-cell="nowrap">{checkout.dueAt ? formatDateTime(checkout.dueAt) : "—"}</td>
                <td>
                  <StatusBadge tone={overdue ? "danger" : CHECKOUT_STATUS_META[checkout.status]?.tone}>
                    {overdue ? "Overdue" : CHECKOUT_STATUS_META[checkout.status]?.label}
                  </StatusBadge>
                </td>
                <td>{[checkout.jobNumber, checkout.vehicleReg].filter(Boolean).join(" · ") || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataTableShell>
  );
}

// ---------------------------------------------------------------------------
// Restock
// ---------------------------------------------------------------------------
function RestockDecisionModal({ request, item, action, onClose, onSaved }) {
  const [supplierReference, setSupplierReference] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [quantity, setQuantity] = useState(String(request.quantityRequested));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateRestock(
        action === "order"
          ? { id: request.id, action, supplierReference, expectedAt, quantityRequested: quantity }
          : { id: request.id, action, reason }
      );
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  return (
    <PopupModal isOpen onClose={onClose} ariaLabel={action === "order" ? "Mark ordered" : "Cancel request"} cardClassName="app-settings-popup-card">
      <form className={`app-settings-popup ${styles.sheet}`} onSubmit={submit}>
        <header className="app-popup-compact-header">
          <h2 className={styles.sheetTitle}>{action === "order" ? `Order ${item.name}` : `Cancel request — ${item.name}`}</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="submit" variant={action === "order" ? "primary" : "danger"} size="sm" symbol={false} busy={saving} disabled={action === "cancel" && !reason.trim()}>
              {action === "order" ? "Mark ordered" : "Cancel request"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>
        <span className={styles.muted}>
          {formatQuantity(request.quantityRequested, item)} requested by {request.requesterName || "—"} at {formatDateTime(request.requestedAt)} · {request.reason}
          {request.notes ? ` · ${request.notes}` : ""}
        </span>
        {action === "order" ? (
          <div className={styles.fieldGrid}>
            <InputField label="Quantity ordered" type="number" inputMode="decimal" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <InputField label="Supplier / PO reference" value={supplierReference} onChange={(event) => setSupplierReference(event.target.value)} placeholder="Optional" />
            <InputField label="Expected" type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} />
          </div>
        ) : (
          <InputField label="Reason" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is it no longer needed?" />
        )}
        {error && <StatusMessage tone="danger">{error}</StatusMessage>}
      </form>
    </PopupModal>
  );
}

export function RestockTab({ restock = NONE, itemsById, capabilities, onReceive, onOpenItem, onChanged }) {
  const [view, setView] = useState("open");
  const [decision, setDecision] = useState(null); // { request, action }
  const rows = useMemo(
    () => (view === "open" ? restock.filter((entry) => OPEN_RESTOCK_STATUSES.includes(entry.status)) : restock),
    [restock, view]
  );

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.toolbarFilter}>
          <DropdownField
            label="Show"
            options={[
              { value: "open", label: "Open requests" },
              { value: "all", label: "All requests" },
            ]}
            value={view}
            onValueChange={(value) => setView(value || "open")}
          />
        </div>
      </div>
      {!rows.length ? (
        <EmptyState title={view === "open" ? "No open restock requests" : "No restock requests yet"} description="Staff flag items from /access when they run low." />
      ) : (
        <DataTableShell stack visibleRows={15}>
          <table className="app-data-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" data-table-cell="nowrap">Requested</th>
                <th scope="col" data-table-cell="nowrap">Received</th>
                <th scope="col">Requester</th>
                <th scope="col">Reason</th>
                <th scope="col" data-table-cell="nowrap">When</th>
                <th scope="col">Status</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => {
                const item = itemsById.get(request.itemId) || FALLBACK_ITEM;
                const open = OPEN_RESTOCK_STATUSES.includes(request.status);
                const meta = RESTOCK_STATUS_BY_VALUE[request.status];
                return (
                  <tr key={request.id}>
                    <td>
                      <Button type="button" variant="ghost" size="xs" symbol={false} onClick={() => onOpenItem(request.itemId)}>
                        {item.name}
                      </Button>
                    </td>
                    <td data-table-cell="nowrap">{formatQuantity(request.quantityRequested, item)}</td>
                    <td data-table-cell="nowrap">{formatQuantity(request.quantityReceived, item)}</td>
                    <td>{request.requesterName || "—"}</td>
                    <td>
                      {request.reason}
                      {request.notes && <span className={styles.cellSub}>{request.notes}</span>}
                    </td>
                    <td data-table-cell="nowrap">
                      {formatDateTime(request.requestedAt)}
                      {request.expectedAt && <span className={styles.cellSub}>Expected {formatDate(request.expectedAt)}</span>}
                      {request.supplierReference && <span className={styles.cellSub}>Ref {request.supplierReference}</span>}
                    </td>
                    <td><StatusBadge tone={meta?.tone}>{meta?.label || request.status}</StatusBadge></td>
                    <td>
                      {open && capabilities?.processRestock && (
                        <div className={styles.rowActions}>
                          {request.status === "requested" && (
                            <Button type="button" size="xs" variant="secondary" symbol={false} onClick={() => setDecision({ request, action: "order" })}>
                              Ordered
                            </Button>
                          )}
                          <Button type="button" size="xs" variant="primary" symbol={false} onClick={() => onReceive(request)}>
                            Receive
                          </Button>
                          <Button type="button" size="xs" variant="ghost" symbol={false} onClick={() => setDecision({ request, action: "cancel" })}>
                            Cancel
                          </Button>
                        </div>
                      )}
                      {!open && request.cancelReason && <span className={styles.cellSub}>{request.cancelReason}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableShell>
      )}
      {decision && (
        <RestockDecisionModal
          request={decision.request}
          item={itemsById.get(decision.request.itemId) || FALLBACK_ITEM}
          action={decision.action}
          onClose={() => setDecision(null)}
          onSaved={() => {
            setDecision(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Warranty
// ---------------------------------------------------------------------------
function WarrantyStatusModal({ record, onClose, onSaved }) {
  const [status, setStatus] = useState(record.status === "stored" ? "awaiting_return" : record.status);
  const [outcomeReference, setOutcomeReference] = useState(record.outcomeReference || "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateWarrantyPart({ id: record.id, status, outcomeReference, notes });
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  return (
    <PopupModal isOpen onClose={onClose} ariaLabel="Update warranty part" cardClassName="app-settings-popup-card">
      <form className={`app-settings-popup ${styles.sheet}`} onSubmit={submit}>
        <header className="app-popup-compact-header">
          <h2 className={styles.sheetTitle}>{record.partDescription}</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="submit" variant="primary" size="sm" symbol={false} busy={saving} disabled={status === record.status}>
              Update
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>
        <span className={styles.muted}>
          {[record.jobNumber && `Job ${record.jobNumber}`, record.vehicleReg].filter(Boolean).join(" · ")} · stored by {record.storedByName || "—"} at {formatDateTime(record.storedAt)}
        </span>
        <div className={styles.fieldGrid}>
          <DropdownField label="Status" options={WARRANTY_STATUSES.map((entry) => ({ value: entry.value, label: entry.label }))} value={status} onValueChange={(value) => setStatus(value || record.status)} />
          <InputField label="Return / disposal reference" value={outcomeReference} onChange={(event) => setOutcomeReference(event.target.value)} placeholder="e.g. RMA or waste note" />
        </div>
        <InputField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
        {error && <StatusMessage tone="danger">{error}</StatusMessage>}
      </form>
    </PopupModal>
  );
}

export function WarrantyTab({ warranty = NONE, locationNames, capabilities, onChanged }) {
  const [view, setView] = useState("held");
  const [editing, setEditing] = useState(null);
  const rows = useMemo(
    () => (view === "held" ? warranty.filter((entry) => entry.status === "stored" || entry.status === "awaiting_return") : warranty),
    [view, warranty]
  );

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.toolbarFilter}>
          <DropdownField
            label="Show"
            options={[
              { value: "held", label: "Still held" },
              { value: "all", label: "All records" },
            ]}
            value={view}
            onValueChange={(value) => setView(value || "held")}
          />
        </div>
      </div>
      {!rows.length ? (
        <EmptyState title="No warranty parts held" description="Parts stored from /access appear here until they are returned or disposed of." />
      ) : (
        <DataTableShell stack visibleRows={15}>
          <table className={`app-data-table${capabilities?.manageWarranty ? " app-data-table--clickable" : ""}`}>
            <thead>
              <tr>
                <th scope="col">Part</th>
                <th scope="col">Job / reg</th>
                <th scope="col" data-table-cell="nowrap">Qty</th>
                <th scope="col">Stored by</th>
                <th scope="col" data-table-cell="nowrap">Stored</th>
                <th scope="col">Location</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => {
                const meta = WARRANTY_STATUS_BY_VALUE[record.status];
                const open = () => capabilities?.manageWarranty && setEditing(record);
                return (
                  <tr key={record.id} tabIndex={capabilities?.manageWarranty ? 0 : undefined} onClick={open} onKeyDown={openOnKey(open)}>
                    <td>
                      <span className={styles.cellTitle}>{record.partDescription}</span>
                      {record.partNumber && <span className={styles.cellSub}>{record.partNumber}</span>}
                      {record.claimReference && <span className={styles.cellSub}>Claim {record.claimReference}</span>}
                    </td>
                    <td>{[record.jobNumber, record.vehicleReg].filter(Boolean).join(" · ")}</td>
                    <td data-table-cell="nowrap">{record.quantity}</td>
                    <td>{record.storedByName || "—"}</td>
                    <td data-table-cell="nowrap">{formatDateTime(record.storedAt)}</td>
                    <td>{[locationNames.get(record.locationId), record.bin].filter(Boolean).join(" · ") || "—"}</td>
                    <td>
                      <StatusBadge tone={meta?.tone}>{meta?.label || record.status}</StatusBadge>
                      {record.outcomeReference && <span className={styles.cellSub}>{record.outcomeReference}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableShell>
      )}
      {editing && (
        <WarrantyStatusModal
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------
const DAY_OPTIONS = [
  { value: "1", label: "Today (24 h)" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export function ActivityTab({ storeKey, itemsById, onOpenItem, refreshKey }) {
  const [days, setDays] = useState("7");
  const [action, setAction] = useState("");
  const [state, setState] = useState({ loading: true, error: null, transactions: NONE });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await loadActivity(storeKey, { days, action });
      setState({ loading: false, error: null, transactions: data.transactions });
    } catch (error) {
      setState({ loading: false, error: error.message, transactions: NONE });
    }
  }, [action, days, storeKey]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.toolbarFilter}>
          <DropdownField label="Period" options={DAY_OPTIONS} value={days} onValueChange={(value) => setDays(value || "7")} />
        </div>
        <div className={styles.toolbarFilter}>
          <DropdownField
            label="Action"
            options={[{ value: "", label: "All actions" }, ...Object.entries(ACTION_META).map(([value, meta]) => ({ value, label: meta.label }))]}
            value={action}
            onValueChange={(value) => setAction(value || "")}
          />
        </div>
      </div>
      {state.error && <StatusMessage tone="danger">{state.error}</StatusMessage>}
      {state.loading ? (
        <TableSkeleton rows={8} />
      ) : !state.transactions.length ? (
        <EmptyState title="No activity in this period" />
      ) : (
        <DataTableShell stack visibleRows={20}>
          <table className="app-data-table app-data-table--clickable">
            <thead>
              <tr>
                <th scope="col" data-table-cell="nowrap">Time</th>
                <th scope="col">Item</th>
                <th scope="col">What</th>
                <th scope="col">Who</th>
                <th scope="col" data-table-cell="nowrap">Stock after</th>
                <th scope="col">Job / reg</th>
                <th scope="col">Reason / notes</th>
              </tr>
            </thead>
            <tbody>
              {state.transactions.map((tx) => {
                const item = (tx.itemId && itemsById.get(tx.itemId)) || { ...FALLBACK_ITEM, name: tx.detail?.partDescription || "Warranty part" };
                const open = () => tx.itemId && onOpenItem(tx.itemId);
                return (
                  <tr key={tx.id} tabIndex={0} onClick={open} onKeyDown={openOnKey(open)}>
                    <td data-table-cell="nowrap">{formatDateTime(tx.occurredAt)}</td>
                    <td><span className={styles.cellTitle}>{item.name}</span></td>
                    <td>
                      {describeTransaction(tx, item)}
                      {tx.overrideNegative && <span className={styles.cellSub}>Authorised override</span>}
                    </td>
                    <td>
                      {tx.userName || "—"}
                      {tx.detail?.onBehalfOf && <span className={styles.cellSub}>for {tx.detail.onBehalfOf}</span>}
                    </td>
                    <td data-table-cell="nowrap">{tx.stockAfter === null ? "—" : `${formatQuantity(tx.availableAfter, item)} available`}</td>
                    <td>{[tx.jobNumber, tx.vehicleReg].filter(Boolean).join(" · ") || "—"}</td>
                    <td>{[tx.reason, tx.notes].filter(Boolean).join(" · ") || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableShell>
      )}
    </>
  );
}
