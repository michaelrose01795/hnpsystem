// file location: src/features/tracking/equipment/EquipmentEditorDrawer.js
//
// Add or edit an asset (managers). Replaces the old name + dates modal. Dates
// changed here are corrections — a real check is logged through Log Check so
// it gets its own record.

import React, { useEffect, useMemo, useState } from "react";
import { Button, InputField, StatusMessage } from "@/components/ui";
import { CalendarField } from "@/components/ui/calendarAPI";
import { DropdownField } from "@/components/ui/dropdownAPI";
import LayerTheme from "@/components/ui/LayerTheme";
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_BY_KEY,
  EQUIPMENT_DEPARTMENTS,
  EQUIPMENT_INTERVALS,
  EQUIPMENT_LOCATIONS,
  EQUIPMENT_LOCATION_BY_KEY,
} from "@/config/equipmentTracking";
import {
  computeNextDue,
  dueSoonDaysForInterval,
  fromDateInputValue,
  getIntervalKey,
  intervalFieldsFromKey,
  toDateInputValue,
} from "@/features/tracking/equipment/equipmentModel";
import {
  CheckboxField,
  EquipmentDrawer,
  TextAreaField,
  toOptions,
} from "@/features/tracking/equipment/EquipmentFormControls";
import { saveEquipment } from "@/features/tracking/equipment/equipmentClient";

const MONTH_OPTIONS = [
  { key: "none", value: "", label: "Not scheduled" },
  ...[1, 3, 6, 12, 24, 36].map((months) => ({
    key: `m${months}`,
    value: String(months),
    label: months % 12 === 0 ? `${months / 12} year${months === 12 ? "" : "s"}` : `${months} month${months === 1 ? "" : "s"}`,
  })),
];

const buildForm = (asset) => ({
  name: asset?.name || "",
  assetCode: asset?.assetCode || "",
  category: asset?.category || "workshop-tools",
  department: asset?.department || "",
  location: asset?.location || "",
  locationDetail: asset?.locationDetail || "",
  manufacturer: asset?.manufacturer || "",
  model: asset?.model || "",
  serialNumber: asset?.serialNumber || "",
  intervalKey: asset ? getIntervalKey(asset) || "m6" : "m6",
  lastChecked: toDateInputValue(asset?.lastChecked),
  nextDue: toDateInputValue(asset?.nextDue),
  dueSoonDays: asset?.dueSoonDays ?? "",
  checklistId: asset?.checklistId || "",
  serviceIntervalMonths: asset?.serviceIntervalMonths ? String(asset.serviceIntervalMonths) : "",
  lastServiceAt: toDateInputValue(asset?.lastServiceAt),
  nextServiceDue: toDateInputValue(asset?.nextServiceDue),
  serviceProvider: asset?.serviceProvider || "",
  requiresCalibration: Boolean(asset?.requiresCalibration),
  calibrationIntervalMonths: asset?.calibrationIntervalMonths ? String(asset.calibrationIntervalMonths) : "12",
  lastCalibratedAt: toDateInputValue(asset?.lastCalibratedAt),
  calibrationDue: toDateInputValue(asset?.calibrationDue),
  calibrationCompany: asset?.calibrationCompany || "",
  calibrationCertificateRef: asset?.calibrationCertificateRef || "",
  purchaseDate: toDateInputValue(asset?.purchaseDate),
  purchasePrice: asset?.purchasePrice ?? "",
  supplier: asset?.supplier || "",
  purchaseReference: asset?.purchaseReference || "",
  warrantyExpiry: toDateInputValue(asset?.warrantyExpiry),
  warrantyProvider: asset?.warrantyProvider || "",
  notes: asset?.notes || "",
});

const isoOrNull = (value) => fromDateInputValue(value)?.toISOString() || null;

function Section({ title, children }) {
  return (
    <LayerTheme radius="var(--radius-sm)" padding="12px" gap="12px">
      <h3 className="app-record-heading">{title}</h3>
      {children}
    </LayerTheme>
  );
}

export default function EquipmentEditorDrawer({ asset = null, checklists = [], onClose, onSaved }) {
  const [form, setForm] = useState(() => buildForm(asset));
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isNew = !asset;

  const set = (field) => (value) => {
    setTouched((previous) => ({ ...previous, [field]: true }));
    setForm((previous) => ({ ...previous, [field]: value }));
  };
  const setInput = (field) => (event) => set(field)(event.target.value);

  // New assets pick up their type's usual interval, area and calibration flag.
  useEffect(() => {
    if (!isNew) return;
    const category = EQUIPMENT_CATEGORY_BY_KEY[form.category];
    if (!category) return;
    setForm((previous) => ({
      ...previous,
      intervalKey: touched.intervalKey ? previous.intervalKey : category.defaultIntervalKey,
      department: touched.department ? previous.department : category.department || previous.department,
      requiresCalibration: touched.requiresCalibration ? previous.requiresCalibration : Boolean(category.requiresCalibration),
    }));
  }, [form.category, isNew, touched.intervalKey, touched.department, touched.requiresCalibration]);

  // Next due follows last checked + interval, unless set by hand.
  useEffect(() => {
    if (touched.nextDue) return;
    const interval = intervalFieldsFromKey(form.intervalKey);
    const last = fromDateInputValue(form.lastChecked);
    if (!interval || !last) return;
    setForm((previous) => ({ ...previous, nextDue: toDateInputValue(computeNextDue(last, interval)) }));
  }, [form.intervalKey, form.lastChecked, touched.nextDue]);

  useEffect(() => {
    if (touched.calibrationDue || !form.requiresCalibration) return;
    const last = fromDateInputValue(form.lastCalibratedAt);
    if (!last) return;
    setForm((previous) => ({
      ...previous,
      calibrationDue: toDateInputValue(computeNextDue(last, { intervalMonths: Number(previous.calibrationIntervalMonths) || 12 })),
    }));
  }, [form.lastCalibratedAt, form.calibrationIntervalMonths, form.requiresCalibration, touched.calibrationDue]);

  useEffect(() => {
    if (touched.nextServiceDue || !form.serviceIntervalMonths) return;
    const last = fromDateInputValue(form.lastServiceAt);
    if (!last) return;
    setForm((previous) => ({
      ...previous,
      nextServiceDue: toDateInputValue(computeNextDue(last, { intervalMonths: Number(previous.serviceIntervalMonths) })),
    }));
  }, [form.lastServiceAt, form.serviceIntervalMonths, touched.nextServiceDue]);

  const locationOptions = useMemo(() => {
    const list = form.department
      ? EQUIPMENT_LOCATIONS.filter((location) => location.department === form.department)
      : EQUIPMENT_LOCATIONS;
    return [{ key: "none", value: "", label: "Not set" }, ...toOptions(list)];
  }, [form.department]);

  const checklistOptions = useMemo(
    () => [
      { key: "auto", value: "", label: "Automatic (by category)" },
      ...checklists
        .filter((checklist) => checklist.isActive || checklist.id === form.checklistId)
        .map((checklist) => ({ key: checklist.id, value: checklist.id, label: checklist.name })),
    ],
    [checklists, form.checklistId]
  );

  const intervalFields = intervalFieldsFromKey(form.intervalKey);
  const defaultDueSoon = dueSoonDaysForInterval(intervalFields?.intervalDays);

  const submit = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("Enter the equipment name.");
      return;
    }
    if (!intervalFields) {
      setError("Choose how often it is checked.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveEquipment({
        id: asset?.id,
        name: form.name,
        assetCode: form.assetCode || null,
        category: form.category,
        department: form.department || null,
        location: form.location || null,
        locationDetail: form.locationDetail,
        manufacturer: form.manufacturer,
        model: form.model,
        serialNumber: form.serialNumber,
        ...intervalFields,
        lastChecked: isoOrNull(form.lastChecked),
        nextDue: isoOrNull(form.nextDue),
        dueSoonDays: form.dueSoonDays === "" ? null : Number(form.dueSoonDays),
        checklistId: form.checklistId || null,
        serviceIntervalMonths: form.serviceIntervalMonths ? Number(form.serviceIntervalMonths) : null,
        lastServiceAt: isoOrNull(form.lastServiceAt),
        nextServiceDue: isoOrNull(form.nextServiceDue),
        serviceProvider: form.serviceProvider,
        requiresCalibration: form.requiresCalibration,
        calibrationIntervalMonths: form.requiresCalibration ? Number(form.calibrationIntervalMonths) || 12 : null,
        lastCalibratedAt: form.requiresCalibration ? isoOrNull(form.lastCalibratedAt) : null,
        calibrationDue: form.requiresCalibration ? isoOrNull(form.calibrationDue) : null,
        calibrationCompany: form.calibrationCompany,
        calibrationCertificateRef: form.calibrationCertificateRef,
        purchaseDate: form.purchaseDate || null,
        purchasePrice: form.purchasePrice === "" ? null : form.purchasePrice,
        supplier: form.supplier,
        purchaseReference: form.purchaseReference,
        warrantyExpiry: form.warrantyExpiry || null,
        warrantyProvider: form.warrantyProvider,
        notes: form.notes,
      });
      onSaved(saved);
    } catch (submitError) {
      setError(submitError.message);
      setSaving(false);
    }
  };

  return (
    <EquipmentDrawer
      title={isNew ? "Add Equipment/Tools" : `Edit ${asset.name}`}
      description={isNew ? "An asset ID is issued automatically if you leave it blank." : asset.assetCode}
      onClose={onClose}
      busy={saving}
      headerActions={
        <Button type="button" variant="primary" size="sm" busy={saving} disabled={saving} onClick={submit}>
          {isNew ? "Add" : "Save"}
        </Button>
      }
    >
      {error && <StatusMessage tone="danger">{error}</StatusMessage>}

      <Section title="Asset">
        <div className="equipment-form__grid">
          <InputField label="Name" required value={form.name} onChange={setInput("name")} placeholder="e.g. 2-post lift" />
          <InputField label="Asset ID" value={form.assetCode} onChange={setInput("assetCode")} placeholder="Automatic" />
          <DropdownField label="Category" options={toOptions(EQUIPMENT_CATEGORIES)} value={form.category} onValueChange={set("category")} size="md" />
          <InputField label="Manufacturer" value={form.manufacturer} onChange={setInput("manufacturer")} />
          <InputField label="Model" value={form.model} onChange={setInput("model")} />
          <InputField label="Serial number" value={form.serialNumber} onChange={setInput("serialNumber")} />
        </div>
      </Section>

      <Section title="Location">
        <div className="equipment-form__grid">
          <DropdownField
            label="Department"
            options={[{ key: "none", value: "", label: "Not set" }, ...toOptions(EQUIPMENT_DEPARTMENTS)]}
            value={form.department}
            onValueChange={(value) => {
              set("department")(value);
              if (value && form.location && EQUIPMENT_LOCATION_BY_KEY[form.location]?.department !== value) set("location")("");
            }}
            size="md"
          />
          <DropdownField
            label="Location"
            options={locationOptions}
            value={form.location}
            onValueChange={(value) => {
              set("location")(value);
              const department = EQUIPMENT_LOCATION_BY_KEY[value]?.department;
              if (department && !form.department) set("department")(department);
            }}
            size="md"
          />
          <InputField label="Where exactly" value={form.locationDetail} onChange={setInput("locationDetail")} placeholder="e.g. Cabinet 3, top shelf" />
        </div>
      </Section>

      <Section title="Inspection schedule">
        <div className="equipment-form__grid">
          <DropdownField
            label="Check every"
            required
            options={toOptions(EQUIPMENT_INTERVALS)}
            value={form.intervalKey}
            onValueChange={set("intervalKey")}
            size="md"
          />
          <CalendarField label="Last checked" value={form.lastChecked} onValueChange={(value) => set("lastChecked")(value || "")} size="md" />
          <CalendarField label="Next due" value={form.nextDue} onValueChange={(value) => set("nextDue")(value || "")} size="md" />
          <InputField
            label="Due Soon warning (days)"
            type="number"
            min="0"
            max="365"
            value={form.dueSoonDays}
            onChange={setInput("dueSoonDays")}
            placeholder={`${defaultDueSoon} (automatic)`}
            hint="Leave blank to follow the check interval."
          />
          <DropdownField label="Checklist" options={checklistOptions} value={form.checklistId} onValueChange={set("checklistId")} size="md" />
        </div>
        {isNew && !form.lastChecked && (
          <p className="equipment-form__hint">
            With no last check it shows as Awaiting Inspection until the first check is logged.
          </p>
        )}
      </Section>

      <Section title="Service">
        <div className="equipment-form__grid">
          <DropdownField label="Service every" options={MONTH_OPTIONS} value={form.serviceIntervalMonths} onValueChange={set("serviceIntervalMonths")} size="md" />
          <CalendarField label="Last service" value={form.lastServiceAt} onValueChange={(value) => set("lastServiceAt")(value || "")} size="md" />
          <CalendarField label="Next service due" value={form.nextServiceDue} onValueChange={(value) => set("nextServiceDue")(value || "")} size="md" />
          <InputField label="Service provider" value={form.serviceProvider} onChange={setInput("serviceProvider")} />
        </div>
      </Section>

      <Section title="Calibration">
        <CheckboxField label="Track calibration for this equipment" checked={form.requiresCalibration} onChange={set("requiresCalibration")} />
        {form.requiresCalibration && (
          <div className="equipment-form__grid">
            <DropdownField
              label="Calibrate every"
              options={MONTH_OPTIONS.filter((option) => option.value)}
              value={form.calibrationIntervalMonths}
              onValueChange={set("calibrationIntervalMonths")}
              size="md"
            />
            <CalendarField label="Last calibrated" value={form.lastCalibratedAt} onValueChange={(value) => set("lastCalibratedAt")(value || "")} size="md" />
            <CalendarField label="Calibration expires" value={form.calibrationDue} onValueChange={(value) => set("calibrationDue")(value || "")} size="md" />
            <InputField label="Calibration company" value={form.calibrationCompany} onChange={setInput("calibrationCompany")} />
            <InputField label="Certificate number" value={form.calibrationCertificateRef} onChange={setInput("calibrationCertificateRef")} />
          </div>
        )}
      </Section>

      <Section title="Purchase & warranty">
        <div className="equipment-form__grid">
          <CalendarField label="Purchase date" value={form.purchaseDate} onValueChange={(value) => set("purchaseDate")(value || "")} size="md" />
          <InputField label="Price (£)" inputMode="decimal" value={form.purchasePrice} onChange={setInput("purchasePrice")} />
          <InputField label="Supplier" value={form.supplier} onChange={setInput("supplier")} />
          <InputField label="Order / invoice ref" value={form.purchaseReference} onChange={setInput("purchaseReference")} />
          <CalendarField label="Warranty expires" value={form.warrantyExpiry} onValueChange={(value) => set("warrantyExpiry")(value || "")} size="md" />
          <InputField label="Warranty provider" value={form.warrantyProvider} onChange={setInput("warrantyProvider")} />
        </div>
      </Section>

      <TextAreaField label="Notes" value={form.notes} onChange={set("notes")} />
    </EquipmentDrawer>
  );
}
