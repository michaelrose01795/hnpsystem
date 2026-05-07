// file location: src/features/customerPortal/components/CustomerDetailsCard.js
import React, { useEffect, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

const CONTACT_OPTIONS = ["Email", "Phone", "SMS", "WhatsApp", "No Preference"];

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
      contactPreference: (customer.contact_preference || "Email").replace(
        /^\w/,
        (l) => l.toUpperCase()
      ),
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
        headers: { "Content-Type": "application/json" },
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
    <LayerSurface
      as="section"
      sectionKey="customer-details-card"
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
          My details
        </p>
        <h3
          style={{
            margin: 0,
            fontSize: "1.15rem",
            fontWeight: 600,
            color: "var(--text-2)",
          }}
        >
          Keep your profile up to date
        </h3>
      </header>

      <LayerTheme
        as="form"
        onSubmit={handleSubmit}
        radius="var(--radius-md)"
        padding="var(--space-4)"
        gap="var(--space-3)"
      >
        {(message || error) && (
          <div
            style={{
              margin: 0,
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              background: error ? "var(--danger-surface)" : "var(--success-surface)",
              color: error ? "var(--danger-dark)" : "var(--success-dark)",
              fontSize: "0.75rem",
            }}
          >
            {error || message}
          </div>
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
            First name
            <input
              type="text"
              value={formState.firstname}
              onChange={(event) => handleInputChange("firstname", event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Last name
            <input
              type="text"
              value={formState.lastname}
              onChange={(event) => handleInputChange("lastname", event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Email address
            <input
              type="email"
              value={formState.email}
              onChange={(event) => handleInputChange("email", event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Mobile phone
            <input
              type="tel"
              value={formState.mobile}
              onChange={(event) => handleInputChange("mobile", event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Landline
            <input
              type="tel"
              value={formState.telephone}
              onChange={(event) => handleInputChange("telephone", event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Postcode
            <input
              type="text"
              value={formState.postcode}
              onChange={(event) =>
                handleInputChange("postcode", event.target.value.toUpperCase())
              }
              style={inputStyle}
            />
          </label>
        </div>

        <label style={labelStyle}>
          Address
          <textarea
            value={formState.address}
            onChange={(event) => handleInputChange("address", event.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>

        <label style={labelStyle}>
          Contact preference
          <select
            value={formState.contactPreference}
            onChange={(event) =>
              handleInputChange("contactPreference", event.target.value)
            }
            style={inputStyle}
          >
            {CONTACT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={saving}
            className="app-btn app-btn--primary"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </LayerTheme>
    </LayerSurface>
  );
}
