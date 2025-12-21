"use client";

import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

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
  const { user } = useUser();
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasPartsAccess = roles.includes("parts") || roles.includes("parts manager");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("parts");

  useEffect(() => {
    if (!resolvedOrderNumber) return;
    if (!hasPartsAccess) return;
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
  }, [resolvedOrderNumber, hasPartsAccess]);

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

  if (!hasPartsAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>
          You do not have permission to view parts orders.
        </div>
      </Layout>
    );
  }

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
                order?.delivery_status ? order.delivery_status.replace(/_/g, " ") : "Pending",
                order?.delivery_status === "delivered" ? "success" : "info"
              )}
              {statusChip(
                order?.invoice_status ? order.invoice_status.replace(/_/g, " ") : "Draft",
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
              {activeTab === "parts" && (
                <PartsTab items={order.items || []} orderNotes={order.notes} />
              )}
              {activeTab === "delivery" && <DeliveryTab order={order} />}
              {activeTab === "invoice" && <InvoiceTab order={order} totals={totals} />}
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
      <InfoCell label="Delivery status" value={order.delivery_status || "pending"} />
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

function InvoiceTab({ order, totals }) {
  const netTotal = order.invoice_total || totals.subtotal;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <InfoCell label="Invoice reference" value={order.invoice_reference || "—"} />
      <InfoCell label="Invoice status" value={order.invoice_status || "draft"} />
      <InfoCell label="Invoice total" value={formatCurrency(netTotal)} />
      <InfoCell label="Invoice notes" value={order.invoice_notes || "No invoice notes"} fullWidth />
      <div>
        <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Items summary</p>
        <div style={{ border: "1px solid var(--surface-light)", borderRadius: "14px", padding: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Lines</span>
              <strong>{totals.itemsCount}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Subtotal</span>
              <strong>{formatCurrency(totals.subtotal)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Total</span>
              <strong>{formatCurrency(netTotal)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
