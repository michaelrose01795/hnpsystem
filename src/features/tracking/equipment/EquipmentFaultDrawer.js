// file location: src/features/tracking/equipment/EquipmentFaultDrawer.js
//
// Report a fault (anyone who can check equipment), or — for managers — move a
// fault into repair and resolve it. "Unsafe" takes the asset out of service on
// the server; resolving returns it to Awaiting Inspection unless the manager
// confirms it can go straight back into service.

import React, { useState } from "react";
import { Button, InputField, StatusMessage } from "@/components/ui";
import LayerTheme from "@/components/ui/LayerTheme";
import {
  EQUIPMENT_FAULT_SEVERITIES,
  EQUIPMENT_FAULT_USABILITY,
} from "@/config/equipmentTracking";
import { formatEquipmentDateTime } from "@/features/tracking/equipment/equipmentModel";
import {
  ChoiceGroup,
  CheckboxField,
  EquipmentDrawer,
  FilePickerField,
  FormField,
  TextAreaField,
} from "@/features/tracking/equipment/EquipmentFormControls";
import {
  reportEquipmentFault,
  updateEquipmentFault,
  uploadEquipmentDocument,
  uploadEvidencePhotos,
} from "@/features/tracking/equipment/equipmentClient";

const RETURN_OPTIONS = [
  { key: "awaiting_inspection", label: "Inspect before use" },
  { key: "in_service", label: "Back in service now" },
];

export default function EquipmentFaultDrawer({ asset, fault = null, mode = "report", actorName, onClose, onSaved }) {
  const [form, setForm] = useState({ description: "", severity: "medium", usability: "restricted", repairRequired: true });
  const [resolution, setResolution] = useState({ resolutionNotes: "", repairCost: "", repairedBy: "", returnTo: "awaiting_inspection" });
  const [photos, setPhotos] = useState([]);
  const [invoice, setInvoice] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field) => (value) => setForm((previous) => ({ ...previous, [field]: value }));
  const setResolutionField = (field) => (value) => setResolution((previous) => ({ ...previous, [field]: value }));

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      let saved;
      const failures = [];
      if (mode === "report") {
        if (!form.description.trim()) throw new Error("Describe the fault.");
        saved = await reportEquipmentFault({ equipmentId: asset.id, ...form });
        if (photos.length) {
          failures.push(...(await uploadEvidencePhotos(photos, { equipmentId: asset.id, faultId: saved.fault.id })));
        }
      } else if (mode === "start-repair") {
        saved = await updateEquipmentFault({ faultId: fault.id, action: "start-repair", repairedBy: resolution.repairedBy });
      } else {
        if (!resolution.resolutionNotes.trim()) throw new Error("Say how the fault was resolved.");
        saved = await updateEquipmentFault({ faultId: fault.id, action: "resolve", ...resolution });
        if (invoice.length) {
          try {
            await uploadEquipmentDocument({
              equipmentId: asset.id,
              file: invoice[0],
              docType: "repair_invoice",
              faultId: fault.id,
            });
          } catch (uploadError) {
            failures.push(`${invoice[0].name}: ${uploadError.message}`);
          }
        }
      }
      onSaved(saved, failures);
    } catch (submitError) {
      setError(submitError.message);
      setSaving(false);
    }
  };

  const title =
    mode === "report" ? `Report fault — ${asset.name}` : mode === "start-repair" ? "Start repair" : "Resolve fault";

  return (
    <EquipmentDrawer
      title={title}
      description={asset.assetCode}
      onClose={onClose}
      busy={saving}
      headerActions={
        <Button type="button" variant="primary" size="sm" busy={saving} disabled={saving} onClick={submit}>
          {mode === "report" ? "Report" : mode === "start-repair" ? "Start repair" : "Resolve"}
        </Button>
      }
    >
      {error && <StatusMessage tone="danger">{error}</StatusMessage>}

      {fault && (
        <LayerTheme radius="var(--radius-sm)" padding="12px" gap="4px">
          <p className="app-record-note app-record-note--strong">{fault.description}</p>
          <p className="equipment-form__hint">
            {fault.severity} severity · reported by {fault.reportedByName || "unknown"} ·{" "}
            {formatEquipmentDateTime(fault.reportedAt)}
          </p>
        </LayerTheme>
      )}

      {mode === "report" && (
        <div className="equipment-form">
          <TextAreaField
            label="What is wrong?"
            required
            value={form.description}
            onChange={setField("description")}
            placeholder="e.g. Arm lock on post 2 not engaging"
          />
          <ChoiceGroup label="Severity" options={EQUIPMENT_FAULT_SEVERITIES} value={form.severity} onChange={setField("severity")} />
          <ChoiceGroup
            label="Can it still be used?"
            options={EQUIPMENT_FAULT_USABILITY}
            value={form.usability}
            onChange={setField("usability")}
            hint={EQUIPMENT_FAULT_USABILITY.find((option) => option.key === form.usability)?.description}
          />
          <CheckboxField label="Repair required" checked={form.repairRequired} onChange={setField("repairRequired")} />
          <FilePickerField label="Photos" files={photos} onChange={setPhotos} capture />
        </div>
      )}

      {mode === "start-repair" && (
        <div className="equipment-form">
          <InputField
            label="Repaired by (engineer or company)"
            value={resolution.repairedBy}
            onChange={(event) => setResolutionField("repairedBy")(event.target.value)}
          />
          <p className="equipment-form__hint">The equipment will show as Under Repair until the fault is resolved.</p>
        </div>
      )}

      {mode === "resolve" && (
        <div className="equipment-form">
          <TextAreaField
            label="How was it resolved?"
            required
            value={resolution.resolutionNotes}
            onChange={setResolutionField("resolutionNotes")}
          />
          <div className="equipment-form__grid">
            <InputField
              label="Repaired by"
              value={resolution.repairedBy}
              onChange={(event) => setResolutionField("repairedBy")(event.target.value)}
            />
            <InputField
              label="Repair cost (£)"
              inputMode="decimal"
              value={resolution.repairCost}
              onChange={(event) => setResolutionField("repairCost")(event.target.value)}
            />
          </div>
          <ChoiceGroup
            label="After the repair"
            options={RETURN_OPTIONS}
            value={resolution.returnTo}
            onChange={setResolutionField("returnTo")}
            hint="Only applies when this was the last open fault. Unsafe faults still open keep it out of service."
          />
          <FilePickerField label="Repair invoice" files={invoice} onChange={setInvoice} multiple={false} buttonLabel="Attach invoice" />
        </div>
      )}

      <FormField label="Recorded as">
        <p className="app-record-note app-record-note--strong">
          {actorName || "You"} · time recorded automatically when you save
        </p>
      </FormField>
    </EquipmentDrawer>
  );
}
