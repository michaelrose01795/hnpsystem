// file location: src/features/stockControl/StockItemEditor.js
//
// Create / edit a stock item: identity, measurement (counted, tank level or
// dipstick tank with its own calibration table), stock levels, supplier and
// check interval. The current quantity is only set on create; afterwards it
// changes through a check, movement, receipt or stocktake so the ledger stays
// complete. Archiving (never deleting) lives in the header.

import React, { useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { Button, InputField, StatusMessage } from "@/components/ui";
import {
  CHECK_INTERVAL_OPTIONS,
  DIPSTICK_UNITS,
  LEVEL_BANDS,
  MEASUREMENT_MODES,
  STOCK_UNITS,
  formatQuantity,
  normaliseCalibration,
  suggestReplenishment,
  toNumber,
  volumeFromDipstick,
} from "@/features/stockControl/stockModel";
import { TextAreaField } from "@/features/stockControl/StockFields";

const numberText = (value) => (value === null || value === undefined ? "" : String(value));

const buildForm = (item) => ({
  title: item?.title || "",
  categoryId: item?.categoryId || "",
  locationId: item?.locationId || "",
  oilGrade: item?.oilGrade || "",
  stockCode: item?.stockCode || "",
  barcode: item?.barcode || "",
  measurementMode: item?.measurementMode || "count",
  unit: item?.unit || "units",
  customUnitLabel: item?.customUnitLabel || "",
  currentQuantity: "",
  levelBand: null,
  minLevel: numberText(item?.minLevel),
  criticalLevel: numberText(item?.criticalLevel),
  targetLevel: numberText(item?.targetLevel),
  reorderQuantity: numberText(item?.reorderQuantity),
  maxCapacity: numberText(item?.maxCapacity),
  preferredSupplier: item?.preferredSupplier || "",
  supplierProductCode: item?.supplierProductCode || "",
  leadTimeDays: numberText(item?.leadTimeDays),
  unitCost: numberText(item?.unitCost),
  intervalDays: item?.intervalDays || 7,
  dipstickUnit: item?.dipstickUnit || "cm",
  calibration: (item?.calibration || []).map((point) => ({ reading: numberText(point.reading), volume: numberText(point.volume) })),
  notes: item?.notes || "",
});

function CalibrationEditor({ form, setField, previewItem }) {
  const [testReading, setTestReading] = useState("");
  const points = form.calibration;
  const update = (index, key, value) => setField("calibration", points.map((point, i) => (i === index ? { ...point, [key]: value } : point)));
  const valid = normaliseCalibration(points);
  const test = testReading === "" ? null : volumeFromDipstick(testReading, {
    calibration: points,
    capacity: toNumber(form.maxCapacity),
    dipstickUnit: form.dipstickUnit,
  });
  const readingUnit = form.dipstickUnit === "percent" ? "%" : form.dipstickUnit;

  return (
    <div className="stock-calibration">
      <p className="stock-hint">
        Add pairs from this tank's dip chart. Readings between points are interpolated; readings past the chart use its nearest end.
        {form.dipstickUnit === "percent" ? " Without a chart, a percentage gauge scales the capacity." : ""}
      </p>
      {points.map((point, index) => (
        <div key={index} className="stock-calibration__row">
          <InputField
            label={index === 0 ? `Reading (${readingUnit})` : undefined}
            aria-label={`Calibration reading ${index + 1}`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={point.reading}
            onChange={(event) => update(index, "reading", event.target.value)}
          />
          <InputField
            label={index === 0 ? `Volume (${previewItem.unit === "custom" ? form.customUnitLabel || "units" : STOCK_UNITS.find((u) => u.value === form.unit)?.short})` : undefined}
            aria-label={`Calibration volume ${index + 1}`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={point.volume}
            onChange={(event) => update(index, "volume", event.target.value)}
          />
          <Button type="button" variant="secondary" size="sm" symbol={false} onClick={() => setField("calibration", points.filter((_, i) => i !== index))}>
            Remove
          </Button>
        </div>
      ))}
      <div className="stock-inline-actions">
        <Button type="button" variant="secondary" size="sm" symbol={false} onClick={() => setField("calibration", [...points, { reading: "", volume: "" }])}>
          Add calibration point
        </Button>
      </div>
      {points.length > 0 && valid.length < points.filter((point) => point.reading !== "" && point.volume !== "").length && (
        <StatusMessage tone="warning">Some points were ignored: each reading needs one volume, and volumes must rise with the reading.</StatusMessage>
      )}
      <div className="stock-form__grid">
        <InputField
          label={`Test a reading (${readingUnit})`}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={testReading}
          onChange={(event) => setTestReading(event.target.value)}
        />
        {test && (
          <div className="stock-callout">
            <span>Estimated quantity</span>
            <strong>{test.volume !== null ? `≈ ${formatQuantity(test.volume, previewItem)}` : "Needs two or more points"}</strong>
            {test.clamped && <span>Outside the chart — clamped.</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StockItemEditor({
  item = null,
  categories = [],
  locations = [],
  capabilities,
  onClose,
  onSave,
  onArchive,
  onShowQr,
  onOpenExisting,
}) {
  const [form, setForm] = useState(() => buildForm(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const isNew = !item?.id;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const categoryOptions = useMemo(
    () => [{ value: "", label: "No category" }, ...categories.filter((c) => c.isActive || c.id === form.categoryId).map((c) => ({ value: c.id, label: c.name }))],
    [categories, form.categoryId]
  );
  const locationOptions = useMemo(
    () => [
      { value: "", label: "No location" },
      ...locations
        .filter((l) => l.isActive || l.id === form.locationId)
        .map((l) => ({ value: l.id, label: l.name, description: l.department || undefined })),
    ],
    [locations, form.locationId]
  );
  const previewItem = { ...form, currentQuantity: isNew ? toNumber(form.currentQuantity) : item.currentQuantity };
  const suggestion = suggestReplenishment({
    currentQuantity: previewItem.currentQuantity,
    targetLevel: toNumber(form.targetLevel),
    maxCapacity: toNumber(form.maxCapacity),
    reorderQuantity: toNumber(form.reorderQuantity),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError({ message: "Name is required." });
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      intervalDays: form.intervalDays || null,
      calibration: form.measurementMode === "tank" ? form.calibration : [],
    };
    if (!capabilities.viewCosts) delete payload.unitCost;
    if (!isNew) {
      delete payload.currentQuantity;
      delete payload.levelBand;
    } else if (form.measurementMode === "count") {
      delete payload.levelBand;
    }
    try {
      await onSave(payload);
    } catch (saveError) {
      setError(saveError);
      setSaving(false);
    }
  };

  return (
    <PopupModal
      isOpen
      onClose={onClose}
      ariaLabel={isNew ? "Add stock item" : `Edit ${item.title}`}
      cardClassName="app-settings-popup-card stock-popup stock-popup--wide"
    >
      <form className="app-settings-popup stock-form" onSubmit={handleSubmit}>
        <header className="app-popup-compact-header">
          <h2>{isNew ? "Add Stock Item" : `Edit ${item.title}`}</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="submit" variant="primary" size="sm" busy={saving}>
              {isNew ? "Add" : "Save"}
            </Button>
            {!isNew && onShowQr && (
              <Button type="button" variant="secondary" size="sm" symbol={false} onClick={() => onShowQr(item)}>
                QR Label
              </Button>
            )}
            {!isNew && capabilities.archive && (
              <Button
                type="button"
                variant={item.archivedAt ? "secondary" : "danger"}
                size="sm"
                symbol={false}
                onClick={() => (item.archivedAt ? onArchive(item, false) : setConfirmArchive(true))}
              >
                {item.archivedAt ? "Restore" : "Archive"}
              </Button>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        {error && (
          <StatusMessage tone="danger">
            {error.message}{" "}
            {error.duplicateId && onOpenExisting && (
              <Button type="button" variant="secondary" size="xs" symbol={false} onClick={() => onOpenExisting(error.duplicateId)}>
                Open existing item
              </Button>
            )}
          </StatusMessage>
        )}
        {item?.archivedAt && <StatusMessage tone="info">This item is archived. Its history is kept; restore it to record stock again.</StatusMessage>}

        <h3 className="stock-form__section">Item</h3>
        <div className="stock-form__grid">
          <InputField label="Name" required value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="e.g. 5W-30 Long Life bulk oil" />
          <DropdownField label="Category" options={categoryOptions} value={form.categoryId} onValueChange={(value) => setField("categoryId", value || "")} />
          <DropdownField label="Location" options={locationOptions} value={form.locationId} onValueChange={(value) => setField("locationId", value || "")} />
          <InputField label="Oil grade / spec" value={form.oilGrade} onChange={(e) => setField("oilGrade", e.target.value)} placeholder="e.g. 5W-30 VW 504.00" />
          <InputField label="Stock ID" value={form.stockCode} onChange={(e) => setField("stockCode", e.target.value)} placeholder="Internal code" />
          <InputField label="Barcode" value={form.barcode} onChange={(e) => setField("barcode", e.target.value)} placeholder="Scan or type" />
        </div>
        <p className="stock-hint">One item per product per location. The same product kept in two places is two items, shown side by side as "Also stocked at".</p>

        <h3 className="stock-form__section">Measurement</h3>
        <div className="stock-form__grid">
          <DropdownField
            label="How it is measured"
            options={MEASUREMENT_MODES.map((mode) => ({ value: mode.value, label: mode.label, description: mode.description }))}
            value={form.measurementMode}
            onValueChange={(value) => setField("measurementMode", value || "count")}
          />
          <DropdownField label="Unit" options={STOCK_UNITS.map((unit) => ({ value: unit.value, label: unit.label }))} value={form.unit} onValueChange={(value) => setField("unit", value || "units")} />
          {form.unit === "custom" && (
            <InputField label="Custom unit name" required value={form.customUnitLabel} onChange={(e) => setField("customUnitLabel", e.target.value)} placeholder="e.g. drums" />
          )}
          {isNew && (
            <InputField
              label={form.measurementMode === "count" ? "Opening quantity" : "Opening quantity (optional)"}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={form.currentQuantity}
              onChange={(e) => setField("currentQuantity", e.target.value)}
            />
          )}
          {isNew && form.measurementMode !== "count" && (
            <DropdownField
              label="Opening level"
              options={[{ value: "", label: "Not recorded" }, ...LEVEL_BANDS.map((band) => ({ value: band.value, label: band.label }))]}
              value={form.levelBand || ""}
              onValueChange={(value) => setField("levelBand", value || null)}
            />
          )}
        </div>
        {form.measurementMode === "tank" && (
          <>
            <div className="stock-form__grid">
              <DropdownField
                label="Dipstick unit"
                options={DIPSTICK_UNITS}
                value={form.dipstickUnit}
                onValueChange={(value) => setField("dipstickUnit", value || "cm")}
              />
            </div>
            <CalibrationEditor form={form} setField={setField} previewItem={previewItem} />
          </>
        )}

        <h3 className="stock-form__section">Stock levels</h3>
        <div className="stock-form__grid">
          {[
            ["minLevel", "Minimum level", "Low below this"],
            ["criticalLevel", "Critical level", "Defaults to half the minimum"],
            ["targetLevel", "Target level", "Orders top up to this"],
            ["reorderQuantity", "Reorder quantity", "Pack / drum size ordered"],
            ["maxCapacity", "Maximum capacity", "Tank or shelf capacity"],
          ].map(([key, label, hint]) => (
            <InputField
              key={key}
              label={label}
              hint={hint}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={form[key]}
              onChange={(e) => setField(key, e.target.value)}
            />
          ))}
          <DropdownField
            label="Check every"
            options={CHECK_INTERVAL_OPTIONS}
            value={form.intervalDays}
            onValueChange={(value) => setField("intervalDays", value ? Number(value) : null)}
          />
        </div>
        {suggestion.quantity > 0 && (
          <div className="stock-callout">
            <span>Suggested order at the current level</span>
            <strong>{formatQuantity(suggestion.quantity, previewItem)}</strong>
            <span>{suggestion.basis}</span>
          </div>
        )}

        <h3 className="stock-form__section">Supplier</h3>
        <div className="stock-form__grid">
          <InputField label="Preferred supplier" value={form.preferredSupplier} onChange={(e) => setField("preferredSupplier", e.target.value)} />
          <InputField label="Supplier product code" value={form.supplierProductCode} onChange={(e) => setField("supplierProductCode", e.target.value)} />
          <InputField label="Lead time (days)" type="number" inputMode="numeric" min="0" step="1" value={form.leadTimeDays} onChange={(e) => setField("leadTimeDays", e.target.value)} />
          {capabilities.viewCosts && (
            <InputField label="Unit cost (£)" type="number" inputMode="decimal" min="0" step="0.01" value={form.unitCost} onChange={(e) => setField("unitCost", e.target.value)} />
          )}
        </div>

        <TextAreaField label="Notes" value={form.notes} onChange={(value) => setField("notes", value)} />
      </form>

      <ConfirmationDialog
        isOpen={confirmArchive}
        message={`Archive ${item?.title || "this item"}? It leaves the active list, but its checks, orders and usage history are kept.`}
        cancelLabel="Cancel"
        confirmLabel="Archive"
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() => {
          setConfirmArchive(false);
          onArchive(item, true);
        }}
      />
    </PopupModal>
  );
}
