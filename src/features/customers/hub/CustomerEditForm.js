// file location: src/features/customers/hub/CustomerEditForm.js
//
// Inline editor for the customer's own details. Deliberately covers only the
// columns that exist on public.customers — name, the three contact channels,
// home and work address, and the internal notes field. Contact preference is
// its own control (CustomerContactPreference) because it has its own vocabulary.

import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import StatusMessage from "@/components/ui/StatusMessage";

const FIELDS = [
  { key: "firstname", label: "First name", autoComplete: "given-name" },
  { key: "lastname", label: "Last name", autoComplete: "family-name" },
  { key: "email", label: "Email", type: "email", autoComplete: "email" },
  { key: "mobile", label: "Mobile", type: "tel", autoComplete: "tel" },
  { key: "telephone", label: "Telephone", type: "tel" },
  { key: "postcode", label: "Postcode", autoComplete: "postal-code" },
  { key: "address", label: "Address", autoComplete: "street-address" },
  { key: "work_postcode", label: "Work postcode" },
  { key: "work_address", label: "Work address" },
];

const toFormState = (customer) =>
  FIELDS.reduce(
    (state, field) => ({ ...state, [field.key]: customer?.[field.key] ?? "" }),
    { notes: customer?.notes ?? "" }
  );

export default function CustomerEditForm({ customer, onSave, onCancel }) {
  const [values, setValues] = useState(() => toFormState(customer));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (key) => (event) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!String(values.firstname).trim() && !String(values.lastname).trim()) {
      setError("A customer needs at least a first or last name.");
      return;
    }
    setSaving(true);
    setError("");
    // Empty strings become null so a cleared field is actually cleared in the DB
    // rather than stored as "".
    const payload = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, String(value).trim() || null])
    );
    const ok = await onSave?.(payload);
    if (!ok) setError("Could not save those details. Try again.");
    setSaving(false);
  };

  return (
    <LayerSurface
      as="form"
      onSubmit={handleSubmit}
      sectionKey="customer-profile-edit"
      parentKey="customer-profile-summary"
    >
      <h2 className="app-record-heading">Edit customer</h2>

      {error && <StatusMessage tone="danger">{error}</StatusMessage>}

      <div className="app-card-grid" style={{ "--app-card-grid-min": "220px" }}>
        {FIELDS.map((field) => (
          <InputField
            key={field.key}
            label={field.label}
            id={`customer-edit-${field.key}`}
            type={field.type || "text"}
            autoComplete={field.autoComplete}
            value={values[field.key] ?? ""}
            onChange={setField(field.key)}
            disabled={saving}
          />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        <label className="app-record-field__label" htmlFor="customer-edit-notes">
          Internal notes (never shown to the customer)
        </label>
        <textarea
          id="customer-edit-notes"
          className="app-input app-input--textarea"
          rows={3}
          value={values.notes ?? ""}
          onChange={setField("notes")}
          disabled={saving}
          placeholder="Standing instructions, access notes, account arrangements…"
        />
      </div>

      <div className="app-record-actions">
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </LayerSurface>
  );
}
