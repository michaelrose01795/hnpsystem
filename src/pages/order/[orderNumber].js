// file location: src/pages/order/[orderNumber].js
"use client";


import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button"; // shared button primitive (CLAUDE.md §3.4)
import InvoiceDetailSection from "@/features/invoices/components/InvoiceDetailSection"; // shared invoice viewer
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import PartsOrderDetailUi from "@/components/page-ui/parts/create-order/parts-create-order-order-number-ui"; // Extracted presentation layer.
import { logFailure } from "@/lib/utils/logFailure";
const containerStyle = {
  minWidth: 0, // Allow tables to scroll inside the page on narrow screens.
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "var(--page-stack-gap)"
};

const sectionCard = { minWidth: 0 }; // Keep wide tab content inside its parent.

const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return "£0.00";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numeric);
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
};

const orderStatusLabels = {
  draft: "Draft",
  booked: "Part Ordered",
  ready: "In Progress",
  complete: "Complete"
};

const deliveryStatusLabels = {
  pending: "Part Ordered",
  scheduled: "Arrived at dealership",
  dispatched: "Out for delivery",
  delivered: "Delivered"
};

const invoiceStatusLabels = {
  draft: "Invoice draft",
  issued: "Invoice issued",
  paid: "Invoice paid",
  cancelled: "Invoice cancelled"
};

const formatDeliveryStatus = (value) => deliveryStatusLabels[value] || "Pending";
const formatInvoiceStatus = (value) => invoiceStatusLabels[value] || "Draft";
const formatOrderStatus = (value) => orderStatusLabels[value] || orderStatusLabels.draft;

const statusChip = (label, tone = "info") => {
  const variants = { info: "neutral", success: "success", warning: "warning" };
  return <span className={`app-badge app-badge--${variants[tone] || "neutral"}`}>{label}</span>;
};

export default function PartsOrderDetail() {
  const router = useRouter();
  const { jobNumber: legacyJobNumber, orderNumber } = router.query;
  const resolvedOrderNumber =
  typeof orderNumber === "string" && orderNumber.trim().length > 0 ?
  orderNumber :
  legacyJobNumber;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("parts");
  const [notesOpen, setNotesOpen] = useState(false); // single popup edits order / delivery / invoice notes
  const [notesDraft, setNotesDraft] = useState({ notes: "", delivery_notes: "", invoice_notes: "", customer_notes: "" });
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [partsEditing, setPartsEditing] = useState(false); // parts table switches to an editable grid
  const [partsDraft, setPartsDraft] = useState([]);
  const [partsSaving, setPartsSaving] = useState(false);
  const [partsError, setPartsError] = useState("");
  useEffect(() => {
    if (!resolvedOrderNumber) return;
    let disposed = false;
    let inFlight = false;
    const controller = new AbortController();
    setLoading(true);
    setOrder(null);
    const refreshOrder = async () => {
      if (inFlight || disposed) return;
      inFlight = true;
      try {
        const response = await fetch(
          `/api/parts/orders/${encodeURIComponent(resolvedOrderNumber)}`,
          { cache: "no-store", signal: controller.signal }
        );
        const result = await response.json();
        if (!response.ok || !result?.success) throw new Error(result?.message || "Unable to load parts order.");
        if (!disposed) { setOrder(result.order || null); setError(""); }
      } catch (fetchError) {
        if (!disposed) {
          logFailure("Failed to refresh parts order:", fetchError);
          setError(fetchError.message || "Unable to refresh parts order.");
        }
      } finally {
        inFlight = false;
        if (!disposed) setLoading(false);
      }
    };
    const refreshVisibleOrder = () => { if (!document.hidden) refreshOrder(); };
    refreshOrder();
    const timer = setInterval(refreshVisibleOrder, 15000);
    window.addEventListener("focus", refreshVisibleOrder);
    document.addEventListener("visibilitychange", refreshVisibleOrder);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refreshVisibleOrder);
      document.removeEventListener("visibilitychange", refreshVisibleOrder);
    };
  }, [resolvedOrderNumber]);

  const totals = useMemo(() => {
    const items = Array.isArray(order?.items) ? order.items : [];
    const lineTotals = items.map((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return qty * price;
    });
    const subtotal = lineTotals.reduce((sum, value) => sum + value, 0);
    return {
      itemsCount: items.length,
      subtotal
    };
  }, [order]);

  const openNotes = () => {
    setNotesError("");
    setNotesDraft({
      notes: order?.notes || "",
      delivery_notes: order?.delivery_notes || "",
      invoice_notes: order?.invoice_notes || "",
      customer_notes: order?.customer_notes || "",
    }); // seed the draft from the loaded order each time the popup opens
    setNotesOpen(true);
  };

  const closeNotes = () => {
    if (notesSaving) return; // avoid dropping an in-flight save
    setNotesOpen(false);
  };

  const setNotesField = (field, value) => setNotesDraft((current) => ({ ...current, [field]: value }));

  const saveNotes = async () => {
    if (!resolvedOrderNumber) return;
    setNotesSaving(true);
    setNotesError("");
    try {
      const response = await fetch(`/api/parts/orders/${encodeURIComponent(resolvedOrderNumber)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
            notes: notesDraft.notes,
            delivery_notes: notesDraft.delivery_notes,
            invoice_notes: notesDraft.invoice_notes,
            customer_notes: notesDraft.customer_notes,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.message || "Unable to save notes.");
      setOrder(result.order || null);
      setNotesOpen(false);
    } catch (saveError) {
      logFailure("Failed to save parts order notes:", saveError);
      setNotesError(saveError.message || "Unable to save notes.");
    } finally {
      setNotesSaving(false);
    }
  };

  const startPartsEdit = () => {
    setPartsError("");
    setPartsDraft(
      (Array.isArray(order?.items) ? order.items : []).map((item) => ({
        id: item.id,
        part_catalog_id: item.part_catalog_id || null,
        part_number: item.part_number || "",
        part_name: item.part_name || "",
        quantity: item.quantity ?? 1,
        unit_price: item.unit_price ?? 0,
        notes: item.notes || "",
        rowKey: item.id || `row-${Math.random().toString(36).slice(2)}`, // stable key for unsaved rows
      }))
    );
    setPartsEditing(true);
  };

  const cancelPartsEdit = () => {
    if (partsSaving) return;
    setPartsEditing(false);
    setPartsError("");
  };

  const addPartRow = () =>
    setPartsDraft((current) => [
      ...current,
      {
        part_number: "",
        part_name: "",
        quantity: 1,
        unit_price: 0,
        notes: "",
        rowKey: `row-${Math.random().toString(36).slice(2)}`,
      },
    ]);

  const removePartRow = (rowKey) =>
    setPartsDraft((current) => current.filter((row) => row.rowKey !== rowKey));

  const setPartField = (rowKey, field, value) =>
    setPartsDraft((current) =>
      current.map((row) => (row.rowKey === rowKey ? { ...row, [field]: value } : row))
    );

  const savePartsEdit = async () => {
    if (!resolvedOrderNumber) return;
    const incomplete = partsDraft.some((row) => !String(row.part_name || row.part_number || "").trim());
    if (incomplete) {
      setPartsError("Every part needs a part number or a description.");
      return;
    }
    setPartsSaving(true);
    setPartsError("");
    try {
      const response = await fetch(`/api/parts/orders/${encodeURIComponent(resolvedOrderNumber)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: partsDraft.map((row) => ({
            id: row.id,
            part_catalog_id: row.part_catalog_id || null,
            part_number: row.part_number,
            part_name: row.part_name,
            quantity: Number(row.quantity) || 0,
            unit_price: Number(row.unit_price) || 0,
            notes: row.notes,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.message || "Unable to save parts.");
      setOrder(result.order || null);
      setPartsEditing(false);
    } catch (saveError) {
      logFailure("Failed to save parts order items:", saveError);
      setPartsError(saveError.message || "Unable to save parts.");
    } finally {
      setPartsSaving(false);
    }
  };

  return <PartsOrderDetailUi view="section1" activeTab={activeTab} addPartRow={addPartRow} cancelPartsEdit={cancelPartsEdit} partsDraft={partsDraft} partsEditing={partsEditing} partsError={partsError} partsSaving={partsSaving} removePartRow={removePartRow} savePartsEdit={savePartsEdit} setPartField={setPartField} startPartsEdit={startPartsEdit} closeNotes={closeNotes} notesDraft={notesDraft} notesError={notesError} notesOpen={notesOpen} notesSaving={notesSaving} openNotes={openNotes} saveNotes={saveNotes} setNotesField={setNotesField} containerStyle={containerStyle} DeliveryTab={DeliveryTab} error={error} formatCurrency={formatCurrency} formatDeliveryStatus={formatDeliveryStatus} formatInvoiceStatus={formatInvoiceStatus} formatOrderStatus={formatOrderStatus} InfoCell={InfoCell} InvoiceTab={InvoiceTab} loading={loading} order={order} PartsTab={PartsTab} resolvedOrderNumber={resolvedOrderNumber} sectionCard={sectionCard} setActiveTab={setActiveTab} statusChip={statusChip} SummaryPill={SummaryPill} totals={totals} />;

}

function SummaryPill({ label, value }) {
  return (
    <LayerSurface gap="0" style={{ minWidth: "140px" }}>
      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-1)" }}>{label}</p>
      <strong style={{ fontSize: "1.1rem", color: "var(--accentText)" }}>{value}</strong>
    </LayerSurface>);

}

function InfoCell({ label, value, fullWidth = false }) {
  return (
    <LayerSurface gap="var(--space-xs)" style={{ minWidth: 0, overflowWrap: "anywhere", gridColumn: fullWidth ? "1 / -1" : undefined }}>
      <p className="app-staff-card__subtitle" style={{ margin: 0 }}>{label}</p>
      <div style={{ fontWeight: 600 }}>{value ?? "Not provided"}</div>
    </LayerSurface>
  );
}

function PartsTab({
  items = [],
  editing = false,
  draft = [],
  saving = false,
  editError = "",
  onRemoveRow,
  onFieldChange,
}) {
  const columns = ["Part number", "Description", "Quantity", "Unit price", "Line total", "Notes"];
  const rows = editing ? draft : items;
  return (
    <div className="app-page-stack">
      {/* Edit / Save / Add part live on the tab row above (parts-create-order-order-number-ui.js). */}
      {editError && <p style={{ margin: 0, color: "var(--danger)" }}>{editError}</p>}
      {rows.length === 0 ? <p>No parts have been recorded for this order.</p> : (
        <div className="app-table-shell-scroll" role="region" aria-label="Parts ordered" tabIndex={0}>
          <table className="app-data-table app-data-table--rounded app-table-shell app-table-shell--with-headings">
            <thead>
              <tr>
                {columns.map((label) => <th key={label} scope="col">{label}</th>)}
                {editing && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const lineTotal = formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0));
                if (!editing) {
                  return (
                    <tr key={item.id}>
                      <td>{item.part_number || "Not provided"}</td>
                      <td>{item.part_name || "Not provided"}</td>
                      <td>{item.quantity ?? 0}</td>
                      <td>{formatCurrency(item.unit_price)}</td>
                      <td>{lineTotal}</td>
                      <td>{item.notes || "Not provided"}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={item.rowKey}>
                    {[
                      ["part_number", "text", "Part number"],
                      ["part_name", "text", "Description"],
                      ["quantity", "number", "Quantity"],
                      ["unit_price", "number", "Unit price"],
                    ].map(([field, type, label]) => (
                      <td key={field}>
                        <input
                          className="app-input"
                          type={type}
                          min={type === "number" ? "0" : undefined}
                          step={field === "unit_price" ? "0.01" : undefined}
                          value={item[field] ?? ""}
                          aria-label={label}
                          onChange={(event) => onFieldChange(item.rowKey, field, event.target.value)}
                          style={{ width: "100%" }}
                        />
                      </td>
                    ))}
                    <td>{lineTotal}</td>
                    <td>
                      <input
                        className="app-input"
                        type="text"
                        value={item.notes ?? ""}
                        aria-label="Notes"
                        onChange={(event) => onFieldChange(item.rowKey, "notes", event.target.value)}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => onRemoveRow(item.rowKey)} disabled={saving}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DeliveryTab({ order }) {
  return (
    <div className="app-page-stack">
      <h3 className="app-staff-card__title">Delivery schedule</h3>
      <div className="app-card-grid">
        <InfoCell label="Delivery type" value={order.delivery_type || "Not provided"} />
        <InfoCell label="Delivery status" value={formatDeliveryStatus(order.delivery_status)} />
        <InfoCell label="Expected arrival" value={formatDate(order.delivery_eta)} />
        <InfoCell label="Time window" value={order.delivery_window || "Not provided"} />
      </div>
      <h3 className="app-staff-card__title">Contact & destination</h3>
      <div className="app-card-grid">
        <InfoCell label="Delivery contact" value={order.delivery_contact || order.customer_name || "Not provided"} />
        <InfoCell label="Delivery phone" value={order.delivery_phone || order.customer_phone || "Not provided"} />
        <InfoCell label="Delivery address" value={order.delivery_address || order.customer_address || "Not provided"} />
      </div>
    </div>
  );
}

function InvoiceTab({ orderNumber, order }) {
  if (!orderNumber) {
    return (
      <LayerSurface padding="var(--section-card-padding)">
        <p style={{ margin: 0, color: "var(--danger-dark)" }}>Order number missing — cannot render invoice.</p>
      </LayerSurface>);

  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}>
      <InvoiceDetailSection orderNumber={orderNumber} customerEmail={order?.customer_email} variant="jobcard" showInvoiceNotes={false} /> {/* invoice notes live in the shared notes popup */}
    </div>);

}
