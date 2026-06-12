// file location: src/components/page-ui/job-cards/contact/CustomerPreferencesSection.js
// "Customer Notes & Preferences" section of the redesigned Contact tab. Quick
// toggle buttons (VIP / Do Not Wash / Waiting / Courtesy Car) + a full multiselect
// preference list + a free-text customer notes field. All persist to the customer
// profile via the shared onSaveCustomerDetails handler.
import React, { useEffect, useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import Button from "@/components/ui/Button";
import StatusMessage from "@/components/ui/StatusMessage";
import MultiSelectDropdown from "@/components/ui/dropdownAPI/MultiSelectDropdown";
import { PREFERENCE_OPTIONS, QUICK_PREFERENCES } from "./contactConstants";

const labelStyle = {
  fontSize: "0.65rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-1)",
  opacity: 0.7,
  fontWeight: 700,
  marginBottom: "6px",
  display: "block",
};

const sameSet = (a, b) => {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
};

export default function CustomerPreferencesSection({
  jobData,
  canEdit,
  onSaveCustomerDetails,
  customerSaving,
}) {
  const initialPrefs = useMemo(
    () => (Array.isArray(jobData.customerPreferences) ? jobData.customerPreferences : []),
    [jobData.customerPreferences]
  );
  const initialNotes = jobData.customerNotes || "";

  const [prefs, setPrefs] = useState(initialPrefs);
  const [notes, setNotes] = useState(initialNotes);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setPrefs(initialPrefs);
    setNotes(initialNotes);
    setSaveError("");
  }, [initialPrefs, initialNotes]);

  const isDirty = !sameSet(prefs, initialPrefs) || notes !== initialNotes;

  const togglePref = (value) => {
    if (!canEdit) return;
    setPrefs((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));
  };

  const handleSave = async () => {
    setSaveError("");
    const result = await onSaveCustomerDetails?.({ preferences: prefs, notes });
    if (result?.success) {
      setSaveError("");
    } else if (result?.error?.message) {
      setSaveError(result.error.message);
    }
  };

  return (
    <LayerSurface
      sectionKey="jobcard-contact-preferences"
      sectionType="section-shell"
      parentKey="jobcard-tab-contact"
      shell
      gap="var(--space-4)"
    >
      <div className="app-layout-header-row">
        <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text-1)" }}>Notes &amp; Preferences</h3>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!isDirty || customerSaving}>
            {customerSaving ? "Saving…" : "Save Preferences"}
          </Button>
        )}
      </div>

      {saveError && <StatusMessage tone="danger">{saveError}</StatusMessage>}

      {/* Quick toggles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        {QUICK_PREFERENCES.map((pref) => {
          const active = prefs.includes(pref.value);
          return (
            <Button
              key={pref.value}
              variant={active ? "primary" : "secondary"}
              size="sm"
              disabled={!canEdit}
              onClick={() => togglePref(pref.value)}
            >
              <span style={{ marginRight: "6px" }}>{active ? "✓" : "＋"}</span>
              {pref.label}
            </Button>
          );
        })}
      </div>

      {/* Full preference multiselect */}
      <div>
        <span style={labelStyle}>All preferences</span>
        <MultiSelectDropdown
          options={PREFERENCE_OPTIONS}
          value={prefs}
          onChange={setPrefs}
          disabled={!canEdit}
          placeholder="Select preferences"
          searchPlaceholder="Search preferences"
        />
      </div>

      {/* Customer notes */}
      <div>
        <span style={labelStyle}>Customer notes</span>
        <textarea
          className="app-input"
          rows={4}
          value={notes}
          disabled={!canEdit}
          placeholder="Notes that follow this customer across all their jobs…"
          onChange={(e) => setNotes(e.target.value)}
          style={{ resize: "vertical" }}
        />
      </div>
    </LayerSurface>
  );
}
