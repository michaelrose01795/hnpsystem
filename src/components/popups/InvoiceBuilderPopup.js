import React, { useState, useEffect, useMemo } from "react";
import Popup from "./Popup";
import { normalizeRequests } from "@/lib/jobcards/utils";

const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  return `£${amount.toFixed(2)}`;
};

const DEFAULT_VAT_RATE = 0.2;

export default function InvoiceBuilderPopup({
  isOpen,
  onClose,
  jobData,
  onConfirm,
  isSubmitting = false
}) {
  const [requestLines, setRequestLines] = useState([]);
  const [labourTotal, setLabourTotal] = useState(0);
  const [vatRate, setVatRate] = useState(DEFAULT_VAT_RATE);
  const [previewOpen, setPreviewOpen] = useState(true);

  useEffect(() => {
    const normalized = normalizeRequests(jobData?.requests).map((entry, index) => ({
      id: entry.id || index,
      description:
        entry.text ||
        entry.description ||
        entry.label ||
        `Request ${index + 1}`,
      quantity: Number(entry.quantity || entry.qty || 1),
      paymentType: entry.paymentType || entry.payment_type || "Customer"
    }));
    setRequestLines(normalized);
    setLabourTotal(Number(jobData?.writeUp?.labour_time || 0));
  }, [jobData]);

  const partLines = useMemo(() => {
    const allocations = Array.isArray(jobData?.partsAllocations)
      ? jobData.partsAllocations
      : [];

    return allocations
      .filter((item) => item && item.part)
      .map((item) => ({
        id: item.id,
        partNumber: item.part.partNumber || item.part_number || "Part",
        name: item.part?.name || "Part",
        quantity: Number(item.quantityAllocated || item.quantityRequested || 0),
        unitPrice:
          Number(item.unitPrice) ||
          Number(item.part?.unitPrice) ||
          Number(item.part?.unit_price) ||
          0,
        source: item.origin || item.source || "VHC"
      }));
  }, [jobData?.partsAllocations]);

  const partsSubtotal = useMemo(() => {
    return partLines.reduce((total, line) => {
      return total + line.quantity * line.unitPrice;
    }, 0);
  }, [partLines]);

  const labourValue = Number(labourTotal) || 0;
  const vatBase = partsSubtotal + labourValue;
  const vatTotal = vatBase * vatRate;
  const invoiceTotal = vatBase + vatTotal;

  const handleDescriptionChange = (id, value) => {
    setRequestLines((prev) =>
      prev.map((line) =>
        line.id === id ? { ...line, description: value } : line
      )
    );
  };

  const handleConfirm = () => {
    if (typeof onConfirm === "function") {
      onConfirm({
        partsTotal: partsSubtotal,
        labourTotal: labourValue,
        vatTotal,
        total: invoiceTotal,
        requests: requestLines.map((line) => ({
          ...line
        }))
      });
    }
  };

  return (
    <Popup isOpen={isOpen} onClose={onClose}>
      <div style={{ maxWidth: "900px" }}>
        <header style={{ marginBottom: "16px" }}>
          <h2 style={{ margin: "0 0 4px 0" }}>Invoice Builder (Pro Forma)</h2>
          <p style={{ margin: 0, color: "#4b5563", fontSize: "14px" }}>
            Edit request descriptions, verify VHC/parts pricing, and preview totals before dispatching.
          </p>
        </header>

        <section style={{ marginBottom: "18px" }}>
          <h3 style={{ marginBottom: "8px" }}>Job Requests</h3>
          {requestLines.map((line) => (
            <div
              key={line.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "12px",
                marginBottom: "10px",
                background: "#fafafa"
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "#6b7280",
                  marginBottom: "6px"
                }}
              >
                Editable Description
              </label>
              <input
                value={line.description}
                onChange={(event) =>
                  handleDescriptionChange(line.id, event.target.value)
                }
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  padding: "8px 10px",
                  fontSize: "14px"
                }}
              />
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "12px",
                  color: "#4b5563",
                  display: "flex",
                  gap: "14px"
                }}
              >
                <span>Qty: {line.quantity}</span>
                <span>Payment Type: {line.paymentType}</span>
              </div>
            </div>
          ))}
        </section>

        <section style={{ marginBottom: "18px" }}>
          <h3 style={{ marginBottom: "12px" }}>Parts & VHC Items</h3>
          {partLines.length === 0 ? (
            <p style={{ color: "#6b7280" }}>
              No priced parts yet; VHC additions populate here automatically.
            </p>
          ) : (
            <div
              style={{
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  padding: "10px 12px",
                  background: "#f8fafc",
                  fontSize: "13px",
                  fontWeight: 600
                }}
              >
                <span>Part / Item</span>
                <span>Qty</span>
                <span>Unit Price</span>
                <span>Total</span>
              </div>
              {partLines.map((line) => (
                <div
                  key={line.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr",
                    padding: "12px",
                    borderTop: "1px solid #eef2f7",
                    fontSize: "14px"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{line.name}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>
                      {line.partNumber} · {line.source}
                    </div>
                  </div>
                  <span>{line.quantity}</span>
                  <span>{formatCurrency(line.unitPrice)}</span>
                  <span>{formatCurrency(line.unitPrice * line.quantity)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            marginBottom: "18px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px"
          }}
        >
          <div
            style={{
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              padding: "12px",
              background: "#fff"
            }}
          >
            <label style={{ fontSize: "12px", color: "#6b7280" }}>
              Labour total
            </label>
            <input
              type="number"
              value={labourTotal}
              min="0"
              onChange={(event) => setLabourTotal(Number(event.target.value))}
              style={{
                width: "100%",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                padding: "10px",
                fontSize: "14px",
                marginTop: "6px"
              }}
            />
          </div>

          <div
            style={{
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              padding: "12px",
              background: "#fff"
            }}
          >
            <label style={{ fontSize: "12px", color: "#6b7280" }}>
              VAT rate
            </label>
            <select
              value={vatRate}
              onChange={(event) => setVatRate(Number(event.target.value))}
              style={{
                width: "100%",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                padding: "10px",
                fontSize: "14px",
                marginTop: "6px",
                background: "white"
              }}
            >
              <option value={0}>0%</option>
              <option value={0.05}>5%</option>
              <option value={0.2}>20%</option>
            </select>
          </div>
        </section>

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px"
            }}
          >
            <h3 style={{ margin: 0 }}>Pro Forma Preview</h3>
            <button
              type="button"
              onClick={() => setPreviewOpen((prev) => !prev)}
              style={{
                background: "transparent",
                border: "1px solid #d1d5db",
                borderRadius: "999px",
                padding: "6px 12px",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              {previewOpen ? "Hide" : "Show"} summary
            </button>
          </div>
          <div
            style={{
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "14px",
              background: "#f9fafb",
              display: previewOpen ? "block" : "none"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px"
              }}
            >
              <span>Parts (incl. VHC items)</span>
              <strong>{formatCurrency(partsSubtotal)}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px"
              }}
            >
              <span>Labour</span>
              <strong>{formatCurrency(labourValue)}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px",
                fontSize: "12px",
                color: "#6b7280"
              }}
            >
              <span>VAT ({(vatRate * 100).toFixed(0)}%)</span>
              <strong>{formatCurrency(vatTotal)}</strong>
            </div>
            <div
              style={{
                borderTop: "1px solid #d1d5db",
                marginTop: "8px",
                paddingTop: "8px",
                display: "flex",
                justifyContent: "space-between",
                fontSize: "16px"
              }}
            >
              <span>Total</span>
              <strong>{formatCurrency(invoiceTotal)}</strong>
            </div>
          </div>
        </section>

        <footer
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px"
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              background: "#0d9488",
              color: "white",
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer"
            }}
          >
            {isSubmitting ? "Submitting..." : "Confirm & Invoicing"}
          </button>
        </footer>
      </div>
    </Popup>
  );
}
