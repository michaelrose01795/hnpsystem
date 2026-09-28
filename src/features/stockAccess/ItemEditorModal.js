// file location: src/features/stockAccess/ItemEditorModal.js
//
// Create / edit a Stock Access item (capability: manage). Choosing a category
// fills in its sensible defaults (tools must be returned and have a loan
// period; oils are measured in litres in half-litre steps) which can then be
// overridden. The quantity is only set here on create — as the opening
// balance, booked as an adjustment — and changes afterwards only through
// movements, receipts and audited adjustments.

import React, { useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { Button, InputField, StatusMessage } from "@/components/ui";
import { CATEGORY_BY_VALUE, STOCK_ACCESS_CATEGORIES, UNIT_TYPES } from "@/features/stockAccess/stockAccessModel";
import { createAccessItem, updateAccessItem } from "@/features/stockAccess/stockAccessClient";
import styles from "@/features/stockAccess/stockAccess.module.css";

const asText = (value) => (value === null || value === undefined ? "" : String(value));
const blankToNull = (value) => (value === "" ? null : value);

const YES_NO = [
  { value: "yes", label: "Yes — must come back (tools)" },
  { value: "no", label: "No — used up (consumables, oil, parts)" },
];

export default function ItemEditorModal({ storeKey, item = null, locations = [], capabilities, onClose, onSaved }) {
  const creating = !item;
  const [form, setForm] = useState(() => ({
    name: item?.name || "",
    description: item?.description || "",
    sku: item?.sku || "",
    barcode: item?.barcode || "",
    category: item?.category || "consumables",
    subcategory: item?.subcategory || "",
    locationId: item?.locationId || locations.find((entry) => entry.key === "back_shed")?.id || "",
    bin: item?.bin || "",
    unitType: item?.unitType || "each",
    quantityStep: asText(item?.quantityStep ?? 1),
    returnRequired: item ? item.returnRequired : false,
    loanPeriodHours: asText(item?.loanPeriodHours),
    minQuantity: asText(item?.minQuantity),
    reorderQuantity: asText(item?.reorderQuantity),
    supplierName: item?.supplierName || "",
    supplierPartNumber: item?.supplierPartNumber || "",
    unitCost: asText(item?.unitCost),
    notes: item?.notes || "",
    openingQuantity: "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value?.target ? value.target.value : value }));

  const locationOptions = useMemo(
    () => locations.filter((entry) => entry.isActive || entry.id === form.locationId).map((entry) => ({ value: entry.id, label: entry.name })),
    [form.locationId, locations]
  );

  const chooseCategory = (value) => {
    const defaults = CATEGORY_BY_VALUE[value];
    if (!defaults) return;
    setForm((prev) => ({
      ...prev,
      category: value,
      // Only a new item takes the category defaults wholesale.
      ...(creating
        ? {
            returnRequired: defaults.returnRequired,
            unitType: defaults.unitType,
            quantityStep: String(defaults.quantityStep),
            loanPeriodHours: asText(defaults.loanPeriodHours),
          }
        : {}),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const body = {
      ...form,
      locationId: blankToNull(form.locationId),
      quantityStep: form.quantityStep || 1,
      loanPeriodHours: form.returnRequired ? blankToNull(form.loanPeriodHours) : null,
      minQuantity: blankToNull(form.minQuantity),
      reorderQuantity: blankToNull(form.reorderQuantity),
    };
    if (capabilities?.viewCosts) body.unitCost = blankToNull(form.unitCost);
    else delete body.unitCost;
    if (!creating) delete body.openingQuantity;
    try {
      const data = creating ? await createAccessItem(storeKey, body) : await updateAccessItem(item.id, body);
      onSaved?.(data.item);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  return (
    <PopupModal isOpen onClose={onClose} ariaLabel={creating ? "Add stock item" : `Edit ${item.name}`} cardClassName="app-settings-popup-card">
      <form className={`app-settings-popup ${styles.sheet}`} onSubmit={submit}>
        <header className="app-popup-compact-header">
          <h2 className={styles.sheetTitle}>{creating ? "Add stock item" : `Edit ${item.name}`}</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="submit" variant="primary" size="sm" symbol={false} busy={saving}>
              {creating ? "Create item" : "Save"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        {error && <StatusMessage tone="danger">{error}</StatusMessage>}

        <div className={styles.fieldGrid}>
          <InputField label="Name" required value={form.name} onChange={set("name")} autoFocus={creating} />
          <DropdownField
            label="Category"
            required
            options={STOCK_ACCESS_CATEGORIES.map((entry) => ({ value: entry.value, label: entry.label }))}
            value={form.category}
            onValueChange={(value) => chooseCategory(value)}
          />
          <InputField label="Subcategory" value={form.subcategory} onChange={set("subcategory")} placeholder="e.g. Torque, Gloves, 5W-30" />
        </div>
        <InputField label="Description" value={form.description} onChange={set("description")} placeholder="Optional" />

        <div className={styles.fieldGrid}>
          <InputField label="SKU / internal code" value={form.sku} onChange={set("sku")} placeholder="Optional, unique" />
          <InputField label="Barcode" value={form.barcode} onChange={set("barcode")} placeholder="Scan or type, unique" />
        </div>

        <div className={styles.fieldGrid}>
          <DropdownField label="Storage location" options={locationOptions} value={form.locationId} onValueChange={(value) => set("locationId")(value || "")} placeholder="Choose a location" />
          <InputField label="Area / bin" value={form.bin} onChange={set("bin")} placeholder="e.g. Rack B, shelf 2" />
        </div>

        <div className={styles.fieldGrid}>
          <DropdownField
            label="Unit"
            options={UNIT_TYPES.map((entry) => ({ value: entry.value, label: entry.label }))}
            value={form.unitType}
            onValueChange={(value) => set("unitType")(value || "each")}
          />
          <InputField label="Step per tap" type="number" inputMode="decimal" min="0" step="any" value={form.quantityStep} onChange={set("quantityStep")} hint="0.5 for oil in litres" />
          {creating && (
            <InputField label="Opening quantity" type="number" inputMode="decimal" min="0" step="any" value={form.openingQuantity} onChange={set("openingQuantity")} hint="Booked as an opening balance" />
          )}
        </div>

        <div className={styles.fieldGrid}>
          <DropdownField
            label="Must be returned?"
            options={YES_NO}
            value={form.returnRequired ? "yes" : "no"}
            onValueChange={(value) => set("returnRequired")(value === "yes")}
          />
          {form.returnRequired && (
            <InputField label="Overdue after (hours)" type="number" inputMode="numeric" min="1" step="1" value={form.loanPeriodHours} onChange={set("loanPeriodHours")} hint="Blank = never overdue" />
          )}
        </div>

        <div className={styles.fieldGrid}>
          <InputField label="Minimum quantity" type="number" inputMode="decimal" min="0" step="any" value={form.minQuantity} onChange={set("minQuantity")} hint="Low-stock warning at or below this" />
          <InputField label="Reorder quantity" type="number" inputMode="decimal" min="0" step="any" value={form.reorderQuantity} onChange={set("reorderQuantity")} hint="Suggested on restock requests" />
        </div>

        <div className={styles.fieldGrid}>
          <InputField label="Supplier" value={form.supplierName} onChange={set("supplierName")} placeholder="Optional" />
          <InputField label="Supplier part number" value={form.supplierPartNumber} onChange={set("supplierPartNumber")} placeholder="Optional" />
          {capabilities?.viewCosts && (
            <InputField label="Unit cost (£)" type="number" inputMode="decimal" min="0" step="0.01" value={form.unitCost} onChange={set("unitCost")} placeholder="Optional" />
          )}
        </div>

        <InputField label="Notes" value={form.notes} onChange={set("notes")} placeholder="Optional" />
      </form>
    </PopupModal>
  );
}
