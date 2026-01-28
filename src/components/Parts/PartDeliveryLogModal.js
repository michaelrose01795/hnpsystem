// file location: src/components/Parts/PartDeliveryLogModal.js
// Modal for logging part deliveries with auto-fill from last delivery

import React, { useState, useEffect, useCallback } from "react";
import { useUser } from "@/context/UserContext";
import { CalendarField } from "@/components/calendarAPI";
import ModalPortal from "@/components/popups/ModalPortal";

export default function PartDeliveryLogModal({ isOpen, onClose, selectedPart, onDeliveryLogged }) {
  const { dbUserId } = useUser();

  const [formData, setFormData] = useState({
    supplier: "",
    orderReference: "",
    qtyOrdered: "",
    qtyReceived: "",
    unitCost: "",
    deliveryDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [lastDelivery, setLastDelivery] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch last delivery info when modal opens
  useEffect(() => {
    if (!isOpen || !selectedPart?.id) {
      setLastDelivery(null);
      return;
    }

    const fetchLastDelivery = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/parts/delivery-logs/${selectedPart.id}`);
        const data = await response.json();

        if (response.ok && data.success && data.deliveryLog) {
          setLastDelivery(data.deliveryLog);

          // Auto-fill form with last delivery info
          setFormData({
            supplier: data.deliveryLog.supplier || "",
            orderReference: data.deliveryLog.order_reference || "",
            qtyOrdered: data.deliveryLog.qty_ordered || "",
            qtyReceived: data.deliveryLog.qty_ordered || "", // Default to qty_ordered but editable
            unitCost: data.deliveryLog.unit_cost || "",
            deliveryDate: new Date().toISOString().split("T")[0],
            notes: "",
          });
        } else {
          // No previous delivery, use part catalog defaults
          setFormData({
            supplier: selectedPart.supplier || "",
            orderReference: "",
            qtyOrdered: "",
            qtyReceived: "",
            unitCost: selectedPart.unit_cost || "",
            deliveryDate: new Date().toISOString().split("T")[0],
            notes: "",
          });
        }
      } catch (err) {
        console.error("Error fetching last delivery:", err);
        setError("Failed to fetch previous delivery information");
      } finally {
        setLoading(false);
      }
    };

    fetchLastDelivery();
  }, [isOpen, selectedPart]);

  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
    setSuccess("");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedPart?.id) return;

    // Validation
    if (!formData.qtyOrdered || Number.parseInt(formData.qtyOrdered, 10) <= 0) {
      setError("Quantity Ordered must be greater than 0");
      return;
    }

    if (!formData.qtyReceived || Number.parseInt(formData.qtyReceived, 10) < 0) {
      setError("Quantity Received cannot be negative");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/parts/delivery-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partId: selectedPart.id,
          supplier: formData.supplier,
          orderReference: formData.orderReference,
          qtyOrdered: formData.qtyOrdered,
          qtyReceived: formData.qtyReceived,
          unitCost: formData.unitCost,
          deliveryDate: formData.deliveryDate,
          notes: formData.notes,
          userNumericId: dbUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to log delivery");
      }

      setSuccess("Delivery logged successfully!");

      // Call parent callback if provided
      if (onDeliveryLogged) {
        onDeliveryLogged(data.deliveryLog);
      }

      // Close modal after brief delay
      setTimeout(() => {
        onClose();
        setSuccess("");
      }, 1500);
    } catch (err) {
      console.error("Error logging delivery:", err);
      setError(err.message || "Failed to log delivery");
    } finally {
      setSubmitting(false);
    }
  }, [selectedPart, formData, dbUserId, onDeliveryLogged, onClose]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(4px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1300,
          padding: "24px",
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: "600px",
            maxWidth: "95vw",
            maxHeight: "90vh",
            background: "var(--surface)",
            borderRadius: "18px",
            border: "1px solid var(--accent-purple-surface)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--accent-purple-surface)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--accent-purple)" }}>
              Log Part Delivery
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--info)" }}>
              {selectedPart?.part_number} · {selectedPart?.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--accent-purple-surface)",
              background: "var(--surface)",
              color: "var(--info-dark)",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: "24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {loading && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--info)" }}>
              Loading previous delivery information...
            </div>
          )}

          {!loading && lastDelivery && (
            <div
              style={{
                padding: "12px",
                borderRadius: "10px",
                background: "var(--info-surface)",
                border: "1px solid var(--accent-purple-surface)",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--info)", marginBottom: "8px" }}>
                Last Delivery Info (Auto-filled)
              </div>
              <div style={{ fontSize: "13px", color: "var(--info-dark)" }}>
                <div>Supplier: {lastDelivery.supplier || "—"}</div>
                <div>Order Ref: {lastDelivery.order_reference || "—"}</div>
                <div>Qty Ordered: {lastDelivery.qty_ordered} · Qty Received: {lastDelivery.qty_received}</div>
                <div>Unit Cost: £{Number(lastDelivery.unit_cost || 0).toFixed(2)}</div>
                <div>Date: {lastDelivery.delivery_date || "—"}</div>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--info-dark)", marginBottom: "6px" }}>
              Supplier
            </label>
            <input
              type="text"
              value={formData.supplier}
              onChange={(e) => handleChange("supplier", e.target.value)}
              placeholder="Enter supplier name"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--accent-purple-surface)",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--info-dark)", marginBottom: "6px" }}>
              Order Reference
            </label>
            <input
              type="text"
              value={formData.orderReference}
              onChange={(e) => handleChange("orderReference", e.target.value)}
              placeholder="Enter order reference number"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--accent-purple-surface)",
                fontSize: "14px",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--info-dark)", marginBottom: "6px" }}>
                Qty Ordered *
              </label>
              <input
                type="number"
                min="1"
                value={formData.qtyOrdered}
                onChange={(e) => handleChange("qtyOrdered", e.target.value)}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--accent-purple-surface)",
                  fontSize: "14px",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--info-dark)", marginBottom: "6px" }}>
                Qty Received *
              </label>
              <input
                type="number"
                min="0"
                value={formData.qtyReceived}
                onChange={(e) => handleChange("qtyReceived", e.target.value)}
                placeholder="0"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--accent-purple-surface)",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--info-dark)", marginBottom: "6px" }}>
              Unit Cost (£)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.unitCost}
              onChange={(e) => handleChange("unitCost", e.target.value)}
              placeholder="0.00"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--accent-purple-surface)",
                fontSize: "14px",
              }}
            />
          </div>

          <CalendarField
            label="Delivery Date"
            value={formData.deliveryDate}
            onChange={(value) => handleChange("deliveryDate", value)}
            name="deliveryDate"
          />

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--info-dark)", marginBottom: "6px" }}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Additional notes about this delivery..."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--accent-purple-surface)",
                fontSize: "14px",
                resize: "vertical",
              }}
            />
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "var(--danger-surface)",
                color: "var(--danger)",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "var(--success-surface)",
                color: "var(--success-dark)",
                fontSize: "13px",
              }}
            >
              {success}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--accent-purple-surface)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid var(--accent-purple-surface)",
              background: "var(--surface)",
              color: "var(--info-dark)",
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loading}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid var(--primary)",
              background: submitting || loading ? "var(--surface-light)" : "var(--primary)",
              color: submitting || loading ? "var(--info)" : "var(--surface)",
              fontWeight: 600,
              cursor: submitting || loading ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Logging..." : "Log Delivery"}
          </button>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
}
