// file location: src/customers/components/PaymentMethodsCard.js
import React, { useState } from "react";

const brandOptions = ["Visa", "Mastercard", "Amex", "Discover"];

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
        headers: {
          "Content-Type": "application/json",
        },
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
    <section className="rounded-3xl border border-[var(--surface-light)] bg-white p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--primary)]">Payment methods</p>
          <h3 className="text-xl font-semibold text-slate-900">Saved debit / credit cards</h3>
        </div>
      </header>

      <div className="mt-4 space-y-3">
        {paymentMethods.map((method) => (
          <div
            key={method.id}
            className="rounded-2xl border border-[var(--surface-light)] bg-[var(--background)] px-4 py-3 text-sm text-slate-700 "
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {method.nickname || `${method.brand} •••• ${method.last4}`}
                </p>
                <p className="text-xs text-slate-500">
                  Expires {String(method.expiryMonth).padStart(2, "0")}/{String(method.expiryYear).slice(-2)}
                </p>
                <p className="text-[11px] text-slate-400">
                  Added {new Date(method.savedAt).toLocaleDateString()}
                </p>
              </div>
              {method.isDefault && (
                <span className="rounded-full bg-[var(--surface-light)] px-3 py-1 text-[11px] font-semibold text-[var(--danger)]">
                  Default
                </span>
              )}
            </div>
          </div>
        ))}
        {paymentMethods.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--surface-light)] px-4 py-6 text-center text-sm text-slate-500">
            No cards saved yet. Add one below to speed up checkout.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-[var(--surface-light)] bg-white/70 p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">Add a payment method</p>
        {error && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Nickname
            <input
              type="text"
              value={formState.nickname}
              onChange={(event) => handleInputChange("nickname", event.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--surface-light)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
              placeholder="E.g. Personal Visa"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Card brand
            <select
              value={formState.brand}
              onChange={(event) => handleInputChange("brand", event.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--surface-light)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
            >
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">
            Last 4 digits
            <input
              type="text"
              maxLength={4}
              value={formState.last4}
              onChange={(event) => handleInputChange("last4", event.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-lg border border-[var(--surface-light)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
              placeholder="1234"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Expiry month
            <input
              type="number"
              min={1}
              max={12}
              value={formState.expiryMonth}
              onChange={(event) => handleInputChange("expiryMonth", event.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--surface-light)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
              placeholder="MM"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Expiry year
            <input
              type="number"
              min={new Date().getFullYear()}
              value={formState.expiryYear}
              onChange={(event) => handleInputChange("expiryYear", event.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--surface-light)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
              placeholder="YYYY"
            />
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={formState.isDefault}
            onChange={(event) => handleInputChange("isDefault", event.target.checked)}
            className="h-4 w-4 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
          />
            Set as default payment method
        </label>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full border border-[var(--surface-light)] bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save card"}
          </button>
        </div>
      </form>
    </section>
  );
}
