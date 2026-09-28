// file location: src/features/stockAccess/WarrantyStoreSheet.js
//
// Log a part into warranty storage from /access: what it is, the job or
// vehicle it came off, where it is kept. Who stored it and the exact time are
// taken from the session and the server clock. Storing never changes shelf
// stock — the part in the bag is the one removed from the vehicle.

import React, { useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { Button, InputField, StatusMessage } from "@/components/ui";
import { formatDateTime } from "@/features/stockAccess/stockAccessModel";
import { newRequestId, storeWarrantyPart } from "@/features/stockAccess/stockAccessClient";
import { QuantityStepper } from "@/features/stockAccess/AccessBits";
import styles from "@/features/stockAccess/stockAccess.module.css";

const WHOLE_UNITS = { unitType: "each", quantityStep: 1 };

export default function WarrantyStoreSheet({ storeKey, item = null, locations = [], onClose, onRecorded }) {
  const activeLocations = useMemo(() => locations.filter((entry) => entry.isActive), [locations]);
  const defaultLocation = activeLocations.find((entry) => entry.key === "warranty_store") || activeLocations[0] || null;
  const [form, setForm] = useState({
    partDescription: item?.name || "",
    partNumber: item?.supplierPartNumber || item?.sku || "",
    quantity: "1",
    jobNumber: "",
    vehicleReg: "",
    claimReference: "",
    locationId: defaultLocation?.id || "",
    bin: "",
    notes: "",
  });
  const [requestId, setRequestId] = useState(newRequestId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event?.target ? event.target.value : event }));

  const missing = !form.partDescription.trim() ? "Describe the part." : !form.jobNumber.trim() && !form.vehicleReg.trim() ? "Enter the job number or vehicle reg." : null;

  const submit = async (event) => {
    event.preventDefault();
    if (saving || missing) return;
    setSaving(true);
    setError(null);
    try {
      const data = await storeWarrantyPart(storeKey, { ...form, itemId: item?.id || null, clientRequestId: requestId });
      setResult({ message: data.message, storedAt: data.record?.storedAt });
      onRecorded?.();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const another = () => {
    setResult(null);
    setRequestId(newRequestId());
    setForm((prev) => ({ ...prev, partDescription: item?.name || "", partNumber: item?.supplierPartNumber || item?.sku || "", quantity: "1", claimReference: "", bin: "", notes: "" }));
  };

  return (
    <PopupModal isOpen onClose={onClose} ariaLabel="Store a warranty part" cardClassName="app-settings-popup-card">
      <form className={`app-settings-popup ${styles.sheet}`} onSubmit={submit}>
        <header className="app-popup-compact-header">
          <h2 className={styles.sheetTitle}>Warranty Store</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        {result ? (
          <div className={styles.confirm} role="status" aria-live="polite">
            <span className={styles.confirmMark} aria-hidden="true">✓</span>
            <p className={styles.confirmText}>{result.message}</p>
            {result.storedAt && <span className={styles.muted}>{formatDateTime(result.storedAt)}</span>}
            <div className={styles.submitRow}>
              <Button type="button" variant="secondary" symbol={false} onClick={another}>
                Store another
              </Button>
              <Button type="button" variant="primary" symbol={false} onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.fieldGrid}>
              <InputField label="Job number" inputMode="numeric" value={form.jobNumber} onChange={set("jobNumber")} autoFocus />
              <InputField label="Vehicle reg" value={form.vehicleReg} onChange={(event) => set("vehicleReg")(event.target.value.toUpperCase())} autoCapitalize="characters" />
            </div>
            <div className={styles.fieldGrid}>
              <InputField label="Part" required value={form.partDescription} onChange={set("partDescription")} placeholder="e.g. Turbocharger" />
              <InputField label="Part number" value={form.partNumber} onChange={set("partNumber")} placeholder="Optional" />
            </div>
            <QuantityStepper item={WHOLE_UNITS} value={form.quantity} onChange={set("quantity")} id="warranty-quantity" />
            <div className={styles.fieldGrid}>
              <DropdownField
                label="Stored in"
                options={activeLocations.map((entry) => ({ value: entry.id, label: entry.name }))}
                value={form.locationId}
                onValueChange={(value) => set("locationId")(value || "")}
                placeholder="Choose a location"
              />
              <InputField label="Shelf / bin" value={form.bin} onChange={set("bin")} placeholder="Optional" />
              <InputField label="Claim reference" value={form.claimReference} onChange={set("claimReference")} placeholder="Optional" />
            </div>
            <InputField label="Notes" value={form.notes} onChange={set("notes")} placeholder="Optional" />
            {error && <StatusMessage tone="danger">{error}</StatusMessage>}
            <Button type="submit" variant="primary" symbol={false} busy={saving} disabled={Boolean(missing)} title={missing || undefined}>
              Store for warranty
            </Button>
          </>
        )}
      </form>
    </PopupModal>
  );
}
