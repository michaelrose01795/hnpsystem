// file location: src/features/customerPortal/components/PaymentMethodsCard.js
import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

const brandOptions = ["Visa", "Mastercard", "Amex", "Discover"];

const inputStyle = {
  width: "100%",
  marginTop: "6px",
  padding: "10px 12px",
  borderRadius: "var(--radius-md)",
  background: "var(--theme)",
  border: "var(--input-ring)",
  fontSize: "0.875rem",
  color: "var(--text-1)",
  outline: "none",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--text-1)",
};

export default function PaymentMethodsCard({
  paymentMethods = [],
  customerId,
  onPaymentMethodSaved = () => {},
}) {
  const [formState, setFormState] = useState({
    nickname: "",
    brand: "Visa",
    last4: "",
    expiryMonth: "",
    expiryYear: "",
    isDefault: paymentMethods.length === 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!customerId) {
      setError("Customer profile missing. Please reload the portal.");
      return;
    }
    if (!formState.last4 || formState.last4.length !== 4) {
      setError("Please enter the last 4 digits of your card.");
      return;
    }
    if (!formState.expiryMonth || !formState.expiryYear) {
      setError("Provide a valid expiry month and year.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/customer/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          nickname: formState.nickname,
          cardBrand: formState.brand,
          last4: formState.last4,
          expiryMonth: Number(formState.expiryMonth),
          expiryYear: Number(formState.expiryYear),
          isDefault: formState.isDefault,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save card");
      }

      setFormState({
        nickname: "",
        brand: "Visa",
        last4: "",
        expiryMonth: "",
        expiryYear: "",
        isDefault: false,
      });
      onPaymentMethodSaved();
    } catch (err) {
      setError(err.message || "Unable to save card.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <LayerSurface
      as="section"
      sectionKey="customer-payment-methods"
      sectionType="content-card"
      radius="var(--page-card-radius)"
      padding="var(--section-card-padding)"
      gap="var(--space-4)"
    >
      <header
        style={{
          background: "var(--primary)",
          color: "var(--text-2)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.3em",
            color: "var(--text-2)",
            opacity: 0.9,
          }}
        >
          Payment methods
        </p>
        <h3
          style={{
            margin: 0,
            fontSize: "1.15rem",
            fontWeight: 600,
            color: "var(--text-2)",
          }}
        >
          Saved debit / credit cards
        </h3>
      </header>

      <div
        style={{
          display: "grid",
          gap: "var(--space-3)",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
        }}
      >
        {paymentMethods.map((method) => (
          <LayerTheme
            key={method.id}
            radius="var(--radius-md)"
            padding="var(--space-4)"
            gap="var(--space-1)"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "var(--text-1)",
                }}
              >
                {method.nickname || `${method.brand} •••• ${method.last4}`}
              </p>
              {method.isDefault && (
                <span className="app-badge app-badge--accent-soft">Default</span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-1)" }}>
              Expires {String(method.expiryMonth).padStart(2, "0")}/
              {String(method.expiryYear).slice(-2)}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.7rem",
                color: "var(--text-1)",
                opacity: 0.7,
              }}
            >
              Added {new Date(method.savedAt).toLocaleDateString()}
            </p>
          </LayerTheme>
        ))}
        {paymentMethods.length === 0 && (
          <p
            style={{
              margin: 0,
              padding: "var(--space-4) var(--space-3)",
              textAlign: "center",
              fontSize: "0.875rem",
              color: "var(--text-1)",
              background: "var(--theme)",
              borderRadius: "var(--radius-md)",
              gridColumn: "1 / -1",
            }}
          >
            No cards saved yet. Add one below to speed up checkout.
          </p>
        )}
      </div>

      <LayerTheme
        as="form"
        onSubmit={handleSubmit}
        radius="var(--radius-md)"
        padding="var(--space-4)"
        gap="var(--space-3)"
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.7rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "var(--text-accent)",
          }}
        >
          Add a payment method
        </p>
        {error && (
          <p
            style={{
              margin: 0,
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              background: "var(--danger-surface)",
              color: "var(--danger-dark)",
              fontSize: "0.75rem",
            }}
          >
            {error}
          </p>
        )}

        <div
          style={{
            display: "grid",
            gap: "var(--space-3)",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          }}
        >
          <label style={labelStyle}>
            Nickname
            <input
              type="text"
              value={formState.nickname}
              onChange={(event) => handleInputChange("nickname", event.target.value)}
              placeholder="E.g. Personal Visa"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Card brand
            <select
              value={formState.brand}
              onChange={(event) => handleInputChange("brand", event.target.value)}
              style={inputStyle}
            >
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gap: "var(--space-3)",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
          }}
        >
          <label style={labelStyle}>
            Last 4 digits
            <input
              type="text"
              maxLength={4}
              value={formState.last4}
              onChange={(event) =>
                handleInputChange("last4", event.target.value.replace(/\D/g, ""))
              }
              placeholder="1234"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Expiry month
            <input
              type="number"
              min={1}
              max={12}
              value={formState.expiryMonth}
              onChange={(event) => handleInputChange("expiryMonth", event.target.value)}
              placeholder="MM"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Expiry year
            <input
              type="number"
              min={new Date().getFullYear()}
              value={formState.expiryYear}
              onChange={(event) => handleInputChange("expiryYear", event.target.value)}
              placeholder="YYYY"
              style={inputStyle}
            />
          </label>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--text-1)",
          }}
        >
          <input
            type="checkbox"
            checked={formState.isDefault}
            onChange={(event) => handleInputChange("isDefault", event.target.checked)}
            style={{ width: "16px", height: "16px" }}
          />
          Set as default payment method
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={saving}
            className="app-btn app-btn--primary"
          >
            {saving ? "Saving..." : "Save card"}
          </button>
        </div>
      </LayerTheme>
    </LayerSurface>
  );
}
