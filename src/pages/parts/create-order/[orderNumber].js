"use client";

// file location: src/pages/parts/create-order/[orderNumber].js

import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";
import InvoiceDetailSection from "@/features/invoices/components/InvoiceDetailSection"; // shared invoice viewer

const containerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const sectionCard = {
  background: "var(--surface)",
  borderRadius: "20px",
  border: "1px solid var(--surface-light)",
  padding: "20px",
  boxShadow: "none",
};

const infoGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "12px",
};

const tabButtonStyle = (active) => ({
  padding: "10px 18px",
  borderRadius: "999px",
  border: active ? "1px solid var(--primary-dark)" : "1px solid var(--surface-light)",
  background: active ? "var(--primary-dark)" : "var(--surface-light)",
  color: active ? "var(--surface)" : "var(--primary-dark)",
  fontWeight: 600,
  cursor: "pointer",
});

const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return "£0.00";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
    year: "numeric",
  });
};

const orderStatusLabels = {
  draft: "Draft",
  booked: "Part Ordered",
  ready: "In Progress",
  complete: "Complete",
};

const deliveryStatusLabels = {
  pending: "Part Ordered",
  scheduled: "Arrived at dealership",
  dispatched: "Out for delivery",
  delivered: "Delivered",
};

const invoiceStatusLabels = {
  draft: "Invoice draft",
  issued: "Invoice issued",
  paid: "Invoice paid",
  cancelled: "Invoice cancelled",
};

const DELIVERY_STAGES = [
  { value: "pending", label: "Part ordered" },
  { value: "scheduled", label: "Arrived at dealership" },
  { value: "dispatched", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
];

const INVOICE_STAGES = [
  { value: "draft", label: "Not invoiced" },
  { value: "issued", label: "Invoice raised" },
  { value: "paid", label: "Paid" },
];

const formatDeliveryStatus = (value) => deliveryStatusLabels[value] || "Pending";
const formatInvoiceStatus = (value) => invoiceStatusLabels[value] || "Draft";
const formatOrderStatus = (value) => orderStatusLabels[value] || orderStatusLabels.draft;

const statusChip = (label, tone = "info") => {
  const tones = {
    info: { background: "rgba(var(--info-rgb),0.15)", color: "var(--info-dark)" },
    success: { background: "rgba(var(--success-rgb,34,139,34),0.2)", color: "var(--success, #297C3B)" },
    warning: { background: "rgba(var(--warning-rgb),0.2)", color: "var(--danger-dark)" },
  };
  const colors = tones[tone] || tones.info;
  return (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: "999px",
        fontSize: "0.8rem",
        fontWeight: 600,
        ...colors,
      }}
    >
      {label}
    </span>
  );
};

export default function PartsOrderDetail() {
  const router = useRouter();
  const { jobNumber: legacyJobNumber, orderNumber } = router.query;
  const resolvedOrderNumber =
    typeof orderNumber === "string" && orderNumber.trim().length > 0
      ? orderNumber
      : legacyJobNumber;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("parts");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const orderId = order?.id;
  const lastOrderRef = useRef(null);
  const hasPatchedDraftRef = useRef(false);

  useEffect(() => {
    if (!resolvedOrderNumber) return;
    const fetchJob = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: fetchError } = await supabase
          .from("parts_job_cards")
          .select("*, items:parts_job_card_items(*)")
          .eq("order_number", resolvedOrderNumber)
          .maybeSingle();
        if (fetchError) throw fetchError;
        setOrder(data || null);
      } catch (fetchErr) {
        console.error("Failed to load parts order:", fetchErr);
        setError(fetchErr.message || "Unable to load parts order.");
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [resolvedOrderNumber]);

  const updateOrderRecord = useCallback(
    async (updates = {}, { skipAutoComplete = false } = {}) => {
      if (!orderId) return null;
      setStatusError("");
      setStatusSaving(true);
      try {
        const { data, error: updateError } = await supabase
          .from("parts_job_cards")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", orderId)
          .select("*, items:parts_job_card_items(*)")
          .maybeSingle();
        if (updateError) throw updateError;
        let nextOrder = data || null;
        const shouldAutoComplete =
          !skipAutoComplete &&
          nextOrder?.delivery_status === "delivered" &&
          nextOrder?.invoice_status === "paid" &&
          nextOrder?.status !== "complete";
        if (shouldAutoComplete && nextOrder?.id) {
          const completionPayload = {
            status: "complete",
            updated_at: new Date().toISOString(),
          };
          if (Object.prototype.hasOwnProperty.call(nextOrder, "archived_at")) {
            completionPayload.archived_at = new Date().toISOString();
          }
          const { data: completedOrder, error: completionError } = await supabase
            .from("parts_job_cards")
            .update(completionPayload)
            .eq("id", nextOrder.id)
            .select("*, items:parts_job_card_items(*)")
            .maybeSingle();
          if (!completionError && completedOrder) {
            nextOrder = completedOrder;
          }
        }
        setOrder(nextOrder);
        return nextOrder;
      } catch (updateErr) {
        console.error("Failed to update parts order:", updateErr);
        setStatusError(updateErr.message || "Unable to update status.");
        return null;
      } finally {
        setStatusSaving(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    if (!order?.id) return;
    if (lastOrderRef.current !== order.id) {
      lastOrderRef.current = order.id;
      hasPatchedDraftRef.current = false;
    }
    if (order.status === "draft" && !hasPatchedDraftRef.current) {
      hasPatchedDraftRef.current = true;
      updateOrderRecord({ status: "booked" }, { skipAutoComplete: true });
    }
  }, [order, updateOrderRecord]);

  const deriveOrderStatusFromDelivery = (stageValue) => {
    if (order?.status === "complete") return "complete";
    if (stageValue === "pending") return "booked";
    if (stageValue === "delivered" && order?.invoice_status === "paid") return "complete";
    return "ready";
  };

  const handleDeliveryStatusChange = useCallback(
    async (nextValue) => {
      if (!order?.id || order.delivery_status === nextValue) return;
      await updateOrderRecord(
        {
          delivery_status: nextValue,
          status: deriveOrderStatusFromDelivery(nextValue),
        },
        { skipAutoComplete: nextValue === "pending" }
      );
    },
    [order, updateOrderRecord]
  );

  const handleInvoiceStatusChange = useCallback(
    async (nextValue) => {
      if (!order?.id || order.invoice_status === nextValue) return;
      await updateOrderRecord({ invoice_status: nextValue });
    },
    [order, updateOrderRecord]
  );

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
      subtotal,
    };
  }, [order]);

  return (
    <Layout>
      <div style={containerStyle}>
        <div style={sectionCard}>
          <p
            style={{
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--info-dark)",
              fontSize: "0.8rem",
            }}
          >
            Parts Order
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "10px",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h1 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>
                {order?.order_number || resolvedOrderNumber || "Loading…"}
              </h1>
              <p style={{ margin: 0, color: "var(--grey-accent-dark)" }}>
                {order?.customer_name || "Customer"} · {order?.vehicle_reg || "No registration"}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {statusChip(
                formatOrderStatus(order?.status),
                order?.status === "complete" ? "success" : order?.status === "draft" ? "warning" : "info"
              )}
              {statusChip(
                formatDeliveryStatus(order?.delivery_status),
                order?.delivery_status === "delivered" ? "success" : "info"
              )}
              {statusChip(
                formatInvoiceStatus(order?.invoice_status),
                order?.invoice_status === "paid" ? "success" : order?.invoice_status === "issued" ? "info" : "warning"
              )}
            </div>
          </div>
          <div style={{ marginTop: "12px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <SummaryPill label="Parts lines" value={totals.itemsCount} />
            <SummaryPill label="Subtotal" value={formatCurrency(totals.subtotal)} />
            <SummaryPill
              label="Invoice total"
              value={formatCurrency(order?.invoice_total || totals.subtotal)}
            />
          </div>
        </div>

        <div style={sectionCard}>
          <h2 style={{ margin: "0 0 12px", color: "var(--primary-dark)" }}>Customer & Vehicle</h2>
          <div style={infoGrid}>
            <InfoCell label="Customer" value={order?.customer_name || "—"} />
            <InfoCell label="Phone" value={order?.customer_phone || "—"} />
            <InfoCell label="Email" value={order?.customer_email || "—"} />
            <InfoCell label="Vehicle Reg" value={order?.vehicle_reg || "—"} />
            <InfoCell
              label="Vehicle"
              value={
                order?.vehicle_make || order?.vehicle_model
                  ? `${order.vehicle_make || ""} ${order.vehicle_model || ""}`.trim()
                  : "—"
              }
            />
            <InfoCell label="VIN" value={order?.vehicle_vin || "—"} />
          </div>
          <InfoCell label="Address" value={order?.customer_address || "—"} fullWidth />
          <InfoCell label="Notes" value={order?.notes || "No notes recorded"} fullWidth />
        </div>

        <div style={sectionCard}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
            <button
              type="button"
              onClick={() => setActiveTab("status")}
              style={tabButtonStyle(activeTab === "status")}
            >
              Status
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("parts")}
              style={tabButtonStyle(activeTab === "parts")}
            >
              Parts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("delivery")}
              style={tabButtonStyle(activeTab === "delivery")}
            >
              Delivery
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("invoice")}
              style={tabButtonStyle(activeTab === "invoice")}
            >
              Invoice
            </button>
          </div>

          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading…</p>
          ) : error ? (
            <p style={{ color: "var(--danger)" }}>{error}</p>
          ) : !order ? (
            <p style={{ color: "var(--info)" }}>Parts order not found.</p>
          ) : (
            <>
              {activeTab === "status" && order && (
                <StatusTab
                  order={order}
                  onDeliveryChange={handleDeliveryStatusChange}
                  onInvoiceChange={handleInvoiceStatusChange}
                  saving={statusSaving}
                  error={statusError}
                />
              )}
              {activeTab === "parts" && (
                <PartsTab items={order.items || []} orderNotes={order.notes} />
              )}
              {activeTab === "delivery" && <DeliveryTab order={order} />}
              {activeTab === "invoice" && (
                <InvoiceTab order={order} totals={totals} orderNumber={resolvedOrderNumber} /> // pass order number into invoice tab
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid var(--surface-light)",
        borderRadius: "14px",
        padding: "10px 14px",
        minWidth: "140px",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--info)" }}>{label}</p>
      <strong style={{ fontSize: "1.1rem", color: "var(--primary-dark)" }}>{value}</strong>
    </div>
  );
}

function InfoCell({ label, value, fullWidth = false }) {
  return (
    <div style={{ flex: fullWidth ? "1 1 100%" : undefined, marginTop: fullWidth ? "12px" : 0 }}>
      <p style={{ margin: 0, color: "var(--info)", fontSize: "0.8rem" }}>{label}</p>
      <div style={{ fontWeight: 600 }}>{value || "—"}</div>
    </div>
  );
}

function StatusTab({ order, onDeliveryChange, onInvoiceChange, saving, error }) {
  const deliveryStage = order?.delivery_status || "pending";
  const invoiceStage = order?.invoice_status || "draft";
  const deliveryIndex = Math.max(
    DELIVERY_STAGES.findIndex((stage) => stage.value === deliveryStage),
    0
  );
  const invoiceIndex = Math.max(
    INVOICE_STAGES.findIndex((stage) => stage.value === invoiceStage),
    0
  );
  const completionReady = deliveryStage === "delivered" && invoiceStage === "paid";
  const isArchived = order?.status === "complete";
  const archiveStamp =
    order?.archived_at ||
    (isArchived ? order?.updated_at : null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {error && (
        <div
          style={{
            border: "1px solid var(--danger)",
            borderRadius: "12px",
            padding: "10px 14px",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}
      {saving && <p style={{ color: "var(--info)" }}>Saving status…</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <h3 style={{ margin: 0, color: "var(--primary-dark)" }}>Delivery milestones</h3>
        <p style={{ margin: 0, color: "var(--grey-accent-dark)" }}>
          Update the live journey from part ordered through to delivery.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {DELIVERY_STAGES.map((stage, index) => (
            <StatusStageButton
              key={stage.value}
              label={stage.label}
              active={deliveryStage === stage.value}
              completed={index <= deliveryIndex}
              disabled={saving}
              onClick={() => onDeliveryChange(stage.value)}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <h3 style={{ margin: 0, color: "var(--primary-dark)" }}>Invoice progress</h3>
        <p style={{ margin: 0, color: "var(--grey-accent-dark)" }}>
          Track when the order has been invoiced and when payment clears.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {INVOICE_STAGES.map((stage, index) => (
            <StatusStageButton
              key={stage.value}
              label={stage.label}
              active={invoiceStage === stage.value}
              completed={index <= invoiceIndex}
              disabled={saving}
              onClick={() => onInvoiceChange(stage.value)}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          border: "1px dashed var(--surface-light)",
          borderRadius: "14px",
          padding: "14px",
          background: completionReady
            ? "rgba(var(--success-rgb,34,139,34),0.08)"
            : "var(--surface-light)",
        }}
      >
        <p style={{ margin: "0 0 6px", fontWeight: 600 }}>
          Current status: {formatOrderStatus(order?.status)}
        </p>
        {completionReady ? (
          <p style={{ margin: 0, color: "var(--success, #297C3B)" }}>
            Delivered and paid — order is marked complete and archived automatically.
          </p>
        ) : (
          <p style={{ margin: 0, color: "var(--grey-accent-dark)" }}>
            Once delivery is marked as delivered and the invoice is paid, we will complete and archive
            this order number automatically.
          </p>
        )}
        {isArchived && (
          <p style={{ margin: "8px 0 0", color: "var(--grey-accent)" }}>
            Archived {archiveStamp ? formatDate(archiveStamp) : "recently"} — still available via search.
          </p>
        )}
      </div>
    </div>
  );
}

function StatusStageButton({ label, active, completed, onClick, disabled }) {
  const background = active
    ? "var(--primary-dark)"
    : completed
    ? "rgba(var(--primary-rgb,99,52,255),0.12)"
    : "var(--surface-light)";
  const color = active ? "var(--surface)" : "var(--primary-dark)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: "12px",
        border: active ? "1px solid var(--primary-dark)" : "1px solid var(--surface-light)",
        padding: "10px 14px",
        minWidth: "160px",
        textAlign: "left",
        background,
        color,
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <span style={{ fontWeight: 600 }}>{label}</span>
      <small style={{ opacity: 0.75 }}>
        {active ? "Current stage" : completed ? "Completed" : "Select to update"}
      </small>
    </button>
  );
}

function PartsTab({ items, orderNotes }) {
  if (!items || items.length === 0) {
    return <p style={{ color: "var(--info)" }}>No parts have been recorded for this order.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            border: "1px solid var(--surface-light)",
            borderRadius: "16px",
            padding: "14px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
          }}
        >
          <InfoCell label="Part number" value={item.part_number || "—"} />
          <InfoCell label="Part name" value={item.part_name || "—"} />
          <InfoCell label="Quantity" value={item.quantity || 0} />
          <InfoCell label="Unit price" value={formatCurrency(item.unit_price)} />
          <InfoCell
            label="Line total"
            value={formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
          />
          {item.notes && <InfoCell label="Notes" value={item.notes} fullWidth />}
        </div>
      ))}
      {orderNotes && (
        <div
          style={{
            borderRadius: "16px",
            border: "1px solid var(--surface-light)",
            padding: "12px",
          }}
        >
          <InfoCell label="Order notes" value={orderNotes} fullWidth />
        </div>
      )}
    </div>
  );
}

function DeliveryTab({ order }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <InfoCell label="Delivery type" value={order.delivery_type || "—"} />
      <InfoCell label="Delivery status" value={formatDeliveryStatus(order.delivery_status)} />
      <InfoCell label="ETA" value={formatDate(order.delivery_eta)} />
      <InfoCell label="Time window" value={order.delivery_window || "—"} />
      <InfoCell label="Delivery contact" value={order.delivery_contact || order.customer_name || "—"} />
      <InfoCell label="Delivery phone" value={order.delivery_phone || order.customer_phone || "—"} />
      <InfoCell
        label="Delivery address"
        value={order.delivery_address || order.customer_address || "—"}
        fullWidth
      />
      <InfoCell label="Delivery notes" value={order.delivery_notes || "No delivery notes provided"} fullWidth />
    </div>
  );
}

function InvoiceTab({ orderNumber }) {
  if (!orderNumber) {
    return (
      <div style={{ border: "1px solid var(--surface-light)", borderRadius: "14px", padding: "12px" }}>
        <p style={{ margin: 0, color: "var(--danger-dark)" }}>Order number missing — cannot render invoice.</p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <InvoiceDetailSection orderNumber={orderNumber} />
    </div>
  );
}
