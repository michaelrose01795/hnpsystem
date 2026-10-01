// file location: src/features/stockAccess/LocationsModal.js
//
// Storage locations for Stock Access (capability: manage): add, rename, set
// the department, retire / restore. Retiring keeps the location on existing
// items and in history; it only stops it being offered for new ones.

import React, { useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import { Button, InputField, LayerTheme, StatusMessage } from "@/components/ui";
import { saveAccessLocation } from "@/features/stockAccess/stockAccessClient";
import { StatusBadge } from "@/features/stockAccess/AccessBits";
import styles from "@/features/stockAccess/stockAccess.module.css";

function LocationRow({ storeKey, location, onSaved }) {
  const [name, setName] = useState(location.name);
  const [department, setDepartment] = useState(location.department || "workshop");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async (patch = {}) => {
    setSaving(true);
    setError(null);
    try {
      await saveAccessLocation(storeKey, { id: location.id, name, department, description: location.description, isActive: location.isActive, ...patch });
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const dirty = name !== location.name || department !== (location.department || "workshop");

  return (
    // One storage location: editable name and department, an active or retired badge and Save and Retire / Restore buttons.
    <LayerTheme>
      <div className={styles.fieldGrid}>
        <InputField label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <InputField label="Department" value={department} onChange={(event) => setDepartment(event.target.value)} />
      </div>
      <div className={styles.rowActions}>
        <StatusBadge tone={location.isActive ? "success" : "neutral"}>{location.isActive ? "Active" : "Retired"}</StatusBadge>
        <Button type="button" size="sm" variant="primary" symbol={false} busy={saving} disabled={!dirty || !name.trim()} onClick={() => save()}>
          Save
        </Button>
        <Button type="button" size="sm" variant="secondary" symbol={false} disabled={saving} onClick={() => save({ isActive: !location.isActive })}>
          {location.isActive ? "Retire" : "Restore"}
        </Button>
      </div>
      {error && <StatusMessage tone="danger">{error}</StatusMessage>}
    </LayerTheme>
  );
}

export default function LocationsModal({ storeKey, locations = [], onClose, onChanged }) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("workshop");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const add = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveAccessLocation(storeKey, { name, department });
      setName("");
      onChanged();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    // Storage locations pop-up: every existing location followed by a form to add a new one.
    <PopupModal isOpen onClose={onClose} ariaLabel="Storage locations" cardClassName="app-settings-popup-card">
      <div className={`app-settings-popup ${styles.sheet}`}>
        <header className="app-popup-compact-header">
          <h2 className={styles.sheetTitle}>Storage locations</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>
        {locations.map((location) => (
          // An existing storage location, editable in place.
          <LocationRow storeKey={storeKey} key={`${location.id}-${location.name}-${location.isActive}`} location={location} onSaved={onChanged} />
        ))}
        <form className={styles.sheet} onSubmit={add}>
          <div className={styles.fieldGrid}>
            <InputField label="New location" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Tyre bay store" />
            <InputField label="Department" value={department} onChange={(event) => setDepartment(event.target.value)} />
          </div>
          {error && <StatusMessage tone="danger">{error}</StatusMessage>}
          <Button type="submit" variant="primary" symbol={false} busy={saving} disabled={!name.trim()}>
            Add location
          </Button>
        </form>
      </div>
    </PopupModal>
  );
}
