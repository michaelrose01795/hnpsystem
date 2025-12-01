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
    <section className="rounded-3xl border border-[#ffe0e0] bg-white p-5 shadow-[0_12px_34px_rgba(209,0,0,0.08)]">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">My details</p>
          <h3 className="text-xl font-semibold text-slate-900">Keep your profile up to date</h3>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 text-sm">
        {(message || error) && (
          <div
            className={`rounded-2xl border px-3 py-2 text-xs ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            First name
            <input
              type="text"
              value={formState.firstname}
              onChange={(event) => handleInputChange("firstname", event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#ffdede] px-3 py-2 text-sm focus:border-[#d10000] focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Last name
            <input
              type="text"
              value={formState.lastname}
              onChange={(event) => handleInputChange("lastname", event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#ffdede] px-3 py-2 text-sm focus:border-[#d10000] focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Email address
            <input
              type="email"
              value={formState.email}
              onChange={(event) => handleInputChange("email", event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#ffdede] px-3 py-2 text-sm focus:border-[#d10000] focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Mobile phone
            <input
              type="tel"
              value={formState.mobile}
              onChange={(event) => handleInputChange("mobile", event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#ffdede] px-3 py-2 text-sm focus:border-[#d10000] focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Landline
            <input
              type="tel"
              value={formState.telephone}
              onChange={(event) => handleInputChange("telephone", event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#ffdede] px-3 py-2 text-sm focus:border-[#d10000] focus:outline-none"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Postcode
            <input
              type="text"
              value={formState.postcode}
              onChange={(event) => handleInputChange("postcode", event.target.value.toUpperCase())}
              className="mt-1 w-full rounded-xl border border-[#ffdede] px-3 py-2 text-sm focus:border-[#d10000] focus:outline-none"
            />
          </label>
        </div>

        <label className="text-xs font-semibold text-slate-600">
          Address
          <textarea
            value={formState.address}
            onChange={(event) => handleInputChange("address", event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-[#ffdede] px-3 py-2 text-sm focus:border-[#d10000] focus:outline-none"
          />
        </label>

        <label className="text-xs font-semibold text-slate-600">
          Contact preference
          <select
            value={formState.contactPreference}
            onChange={(event) => handleInputChange("contactPreference", event.target.value)}
            className="mt-1 w-full rounded-xl border border-[#ffdede] px-3 py-2 text-sm focus:border-[#d10000] focus:outline-none"
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
            className="rounded-full border border-[#ffd0d0] bg-[#d10000] px-5 py-2 text-sm font-semibold text-white shadow hover:bg-[#a00000] disabled:cursor-not-allowed disabled:bg-[#f4bebe]"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
