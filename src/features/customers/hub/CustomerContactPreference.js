// file location: src/features/customers/hub/CustomerContactPreference.js
//
// Preferred contact method. `customers.contact_preference` holds exactly one
// value, so this is a single choice control rather than the five independent
// checkboxes it used to be — five checkboxes for one mutually exclusive value
// is a control that lies about the data.
//
// The vocabulary comes from src/lib/customers/contactPreference.js, which the
// /website portal writes through too, so a choice made on either side reads
// back correctly on the other.

import React from "react";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { CONTACT_PREFERENCE_OPTIONS } from "@/lib/customers/contactPreference";

const OPTIONS = [
  { value: "", label: "Not set" },
  ...CONTACT_PREFERENCE_OPTIONS,
];

export default function CustomerContactPreference({ value, saving, disabled, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px", minWidth: 0 }}>
      <div style={{ flex: "0 1 260px", minWidth: 0 }}>
        <DropdownField
          label="Preferred contact method"
          value={value || ""}
          options={OPTIONS}
          disabled={disabled || Boolean(saving)}
          onChange={(event) => onChange?.(event.target.value || null)}
          className="customer-profile-contact-preference"
        />
      </div>
      {saving && <span className="app-record-note">Saving…</span>}
      {disabled && !saving && (
        <span className="app-record-note">Your role can view this but not change it.</span>
      )}
    </div>
  );
}
