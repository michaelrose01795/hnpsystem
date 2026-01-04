// file location: src/customers/components/CustomerDetailsCard.js
import React, { useEffect, useState } from "react";

const CONTACT_OPTIONS = ["Email", "Phone", "SMS", "WhatsApp", "No Preference"];

export default function CustomerDetailsCard({ customer, onDetailsSaved = () => {} }) {
  const [formState, setFormState] = useState({
    firstname: "",
    lastname: "",
    email: "",
    mobile: "",
    telephone: "",
    address: "",
    postcode: "",
    contactPreference: "Email",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!customer) return;
    setFormState({
      firstname: customer.firstname || "",
      lastname: customer.lastname || "",
      email: customer.email || "",
      mobile: customer.mobile || "",
      telephone: customer.telephone || "",
      address: customer.address || "",
      postcode: customer.postcode || "",
      contactPreference: (customer.contact_preference || "Email")
        .replace(/^\w/, (l) => l.toUpperCase()),
    });
  }, [customer]);

  const handleInputChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setMessage("");
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!customer?.id) {
      setError("Unable to resolve your customer record. Please reload the portal.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/customer/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: customer.id,
          firstname: formState.firstname,
          lastname: formState.lastname,
          email: formState.email,
          mobile: formState.mobile,
          telephone: formState.telephone,
          address: formState.address,
          postcode: formState.postcode,
          contactPreference: formState.contactPreference,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update details");
      }

      setMessage("Details saved successfully.");
      onDetailsSaved();
    } catch (err) {
      setError(err.message || "Unable to save your details right now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] p-5">
      <header className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-white">
        <p className="text-xs uppercase tracking-[0.35em] text-white">My details</p>
        <h3 className="text-xl font-semibold text-white">Keep your profile up to date</h3>
      </header>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 text-sm">
        {(message || error) && (
          <div
            className={`rounded-2xl border px-3 py-2 text-xs ${
              error
                ? "border-[var(--danger)] bg-[var(--danger-surface)] text-[var(--danger-dark)]"
                : "border-[var(--success)] bg-[var(--success-surface)] text-[var(--success-dark)]"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            First name
            <input
              type="text"
              value={formState.firstname}
              onChange={(event) => handleInputChange("firstname", event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Last name
            <input
              type="text"
              value={formState.lastname}
              onChange={(event) => handleInputChange("lastname", event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Email address
            <input
              type="email"
              value={formState.email}
              onChange={(event) => handleInputChange("email", event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Mobile phone
            <input
              type="tel"
              value={formState.mobile}
              onChange={(event) => handleInputChange("mobile", event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Landline
            <input
              type="tel"
              value={formState.telephone}
              onChange={(event) => handleInputChange("telephone", event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Postcode
            <input
              type="text"
              value={formState.postcode}
              onChange={(event) => handleInputChange("postcode", event.target.value.toUpperCase())}
              className="mt-1 w-full rounded-xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
        </div>

        <label className="text-xs font-semibold text-[var(--text-secondary)]">
          Address
          <textarea
            value={formState.address}
            onChange={(event) => handleInputChange("address", event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
          />
        </label>

        <label className="text-xs font-semibold text-[var(--text-secondary)]">
          Contact preference
          <select
            value={formState.contactPreference}
            onChange={(event) => handleInputChange("contactPreference", event.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
          >
            {CONTACT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full border border-[var(--surface-light)] bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--danger)]"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
