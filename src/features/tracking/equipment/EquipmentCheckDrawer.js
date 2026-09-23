// file location: src/features/tracking/equipment/EquipmentCheckDrawer.js
//
// Log Check. One drawer covers:
//   - a routine check or inspection of one asset, against its checklist
//   - the same check across several assets (bulk, managers only) — each asset
//     still gets its own record
//   - a service or calibration (managers only), with provider, certificate and
//     the report attached
// The user and time are recorded by the server from the session; the drawer
// only shows who it will be recorded as.

import React, { useEffect, useMemo, useState } from "react";
import { Button, InputField, StatusMessage } from "@/components/ui";
import { CalendarField } from "@/components/ui/calendarAPI";
import LayerTheme from "@/components/ui/LayerTheme";
import {
  EQUIPMENT_CHECK_RESULTS,
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_FAULT_SEVERITIES,
  EQUIPMENT_FAULT_USABILITY,
} from "@/config/equipmentTracking";
import {
  computeNextDue,
  evaluateChecklist,
  fromDateInputValue,
  resolveChecklistForAsset,
  toDateInputValue,
} from "@/features/tracking/equipment/equipmentModel";
import {
  ChoiceGroup,
  CheckboxField,
  EquipmentDrawer,
  FilePickerField,
  FormField,
  TextAreaField,
} from "@/features/tracking/equipment/EquipmentFormControls";
import {
  logEquipmentChecks,
  uploadEquipmentDocument,
  uploadEvidencePhotos,
} from "@/features/tracking/equipment/equipmentClient";

const OUTCOMES = [
  { key: "pass", label: "Pass" },
  { key: "fail", label: "Fail" },
  { key: "na", label: "N/A" },
];

const MODE_TITLES = {
  routine: "Log check",
  inspection: "Log inspection",
  service: "Record service",
  calibration: "Record calibration",
};

const nextDueFor = (asset, mode, performedDate) => {
  if (!asset) return "";
  if (mode === "calibration") return toDateInputValue(computeNextDue(performedDate, { intervalMonths: asset.calibrationIntervalMonths || 12 }));
  if (mode === "service") {
    return asset.serviceIntervalMonths ? toDateInputValue(computeNextDue(performedDate, { intervalMonths: asset.serviceIntervalMonths })) : "";
  }
  return toDateInputValue(computeNextDue(performedDate, asset));
};

export default function EquipmentCheckDrawer({
  assets,
  mode = "routine",
  checklists = [],
  actorName,
  onClose,
  onSaved,
}) {
  const single = assets.length === 1 ? assets[0] : null;
  const isMaintenance = mode === "service" || mode === "calibration";
  const checklist = useMemo(
    () => (single && !isMaintenance ? resolveChecklistForAsset(single, checklists) : null),
    [single, isMaintenance, checklists]
  );
  const items = useMemo(() => checklist?.items || [], [checklist]);

  const [responses, setResponses] = useState({});
  const [result, setResult] = useState("pass");
  const [resultTouched, setResultTouched] = useState(false);
  const [condition, setCondition] = useState("good");
  const [notes, setNotes] = useState("");
  const [performedOn, setPerformedOn] = useState(toDateInputValue(new Date()));
  const [nextDue, setNextDue] = useState(() => nextDueFor(single, mode, new Date()));
  const [nextDueTouched, setNextDueTouched] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [provider, setProvider] = useState(
    mode === "calibration" ? single?.calibrationCompany || "" : mode === "service" ? single?.serviceProvider || "" : ""
  );
  const [certificateRef, setCertificateRef] = useState("");
  const [cost, setCost] = useState("");
  const [reportFile, setReportFile] = useState([]);
  const [fault, setFault] = useState({ description: "", severity: "medium", usability: mode === "calibration" ? "unsafe" : "restricted", repairRequired: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const evaluation = useMemo(() => evaluateChecklist(items, responses), [items, responses]);

  // The checklist suggests the result until the user picks one themselves.
  useEffect(() => {
    if (!resultTouched && items.length) setResult(evaluation.suggestedResult);
  }, [evaluation.suggestedResult, items.length, resultTouched]);

  // Keep the proposed next due date in step with the date performed.
  useEffect(() => {
    if (!nextDueTouched) setNextDue(nextDueFor(single, mode, fromDateInputValue(performedOn) || new Date()));
  }, [performedOn, single, mode, nextDueTouched]);

  const raisesFault = result === "fail" || condition === "unsafe";
  const isBulk = assets.length > 1;

  useEffect(() => {
    if (raisesFault && !fault.description && evaluation.failed.length) {
      setFault((previous) => ({ ...previous, description: `Failed: ${evaluation.failed.join("; ")}` }));
    }
  }, [raisesFault, evaluation.failed, fault.description]);

  const setResponse = (itemId, patch) =>
    setResponses((previous) => ({ ...previous, [itemId]: { ...previous[itemId], ...patch } }));

  const markAllPass = () =>
    setResponses((previous) => {
      const next = { ...previous };
      for (const item of items) if (item.kind === "check") next[item.id] = { outcome: "pass" };
      return next;
    });

  const submit = async () => {
    setError("");
    if (!isBulk && evaluation.missing.length && !isMaintenance) {
      setError(`Complete the required checklist items: ${evaluation.missing.join(", ")}.`);
      return;
    }
    if (raisesFault && !fault.description.trim()) {
      setError("Describe the fault found.");
      return;
    }
    const performed = fromDateInputValue(performedOn);
    const today = toDateInputValue(new Date());
    setSaving(true);
    try {
      const saved = await logEquipmentChecks({
        equipmentIds: assets.map((asset) => asset.id),
        checkType: mode,
        result,
        condition: isMaintenance ? null : condition,
        checklistId: checklist?.id || null,
        checklistName: checklist?.name || null,
        checklistResults: evaluation.results,
        notes,
        // Today's checks carry the real time; a back-dated one is noon that day.
        performedAt: performedOn === today || !performed ? undefined : new Date(performed.setHours(12, 0, 0, 0)).toISOString(),
        nextDueAt: !isBulk && nextDue ? fromDateInputValue(nextDue)?.toISOString() : undefined,
        provider: isMaintenance ? provider : undefined,
        certificateRef: isMaintenance ? certificateRef : undefined,
        cost: isMaintenance ? cost : undefined,
        fault: raisesFault ? fault : undefined,
      });

      const failures = [];
      if (single && photos.length) {
        const checkId = saved.checks[0]?.id;
        failures.push(...(await uploadEvidencePhotos(photos, { equipmentId: single.id, checkId, faultId: saved.faults[0]?.id })));
      }
      if (single && reportFile.length) {
        try {
          await uploadEquipmentDocument({
            equipmentId: single.id,
            file: reportFile[0],
            docType: mode === "calibration" ? "calibration_certificate" : "service_report",
            title: certificateRef || undefined,
            expiresAt: mode === "calibration" ? nextDue || undefined : undefined,
            checkId: saved.checks[0]?.id,
          });
        } catch (uploadError) {
          failures.push(`${reportFile[0].name}: ${uploadError.message}`);
        }
      }
      onSaved(saved, failures);
    } catch (submitError) {
      setError(submitError.message);
      setSaving(false);
    }
  };

  const title = isBulk ? `${MODE_TITLES[mode]} — ${assets.length} assets` : `${MODE_TITLES[mode]} — ${single?.name || ""}`;

  return (
    <EquipmentDrawer
      title={title}
      description={single ? `${single.assetCode}` : "Each asset gets its own check record."}
      onClose={onClose}
      busy={saving}
      headerActions={
        <Button type="button" variant="primary" size="sm" busy={saving} disabled={saving} onClick={submit}>
          Save
        </Button>
      }
    >
      {error && <StatusMessage tone="danger">{error}</StatusMessage>}

      {isBulk && (
        <LayerTheme radius="var(--radius-sm)" padding="12px" gap="6px">
          <p className="app-record-note app-record-note--strong">
            Logging the same {mode === "routine" ? "check" : mode} for:
          </p>
          <p className="app-record-note">{assets.map((asset) => `${asset.name} (${asset.assetCode})`).join(", ")}</p>
          <p className="equipment-form__hint">
            A failed or unsafe check must be logged on its own so the fault is recorded against the right asset.
          </p>
        </LayerTheme>
      )}

      {!isBulk && !isMaintenance && items.length > 0 && (
        <LayerTheme radius="var(--radius-sm)" padding="12px" gap="8px">
          <div className="equipment-drawer__list-item">
            <h3 className="app-record-heading">{checklist.name}</h3>
            <Button type="button" variant="secondary" size="xs" onClick={markAllPass}>
              All pass
            </Button>
          </div>
          <ul className="equipment-checklist">
            {items.map((item) => (
              <li key={item.id} className="equipment-checklist__item">
                <span className="equipment-checklist__label">
                  {item.label}
                  {item.required ? " *" : ""}
                  {item.kind === "reading" && (item.min !== null || item.max !== null) && (
                    <span className="equipment-form__hint">
                      {" "}Expected {item.min ?? "…"}–{item.max ?? "…"} {item.unit}
                    </span>
                  )}
                </span>
                {item.kind === "reading" ? (
                  <div className="equipment-checklist__reading">
                    <InputField
                      type="number"
                      inputMode="decimal"
                      step="any"
                      aria-label={`${item.label} reading${item.unit ? ` (${item.unit})` : ""}`}
                      placeholder={item.unit || "Reading"}
                      value={responses[item.id]?.reading ?? ""}
                      onChange={(event) => setResponse(item.id, { reading: event.target.value })}
                    />
                  </div>
                ) : (
                  <div className="tracking-viewswitch" role="group" aria-label={item.label}>
                    {OUTCOMES.map((outcome) => (
                      <Button
                        key={outcome.key}
                        type="button"
                        size="xs"
                        variant={responses[item.id]?.outcome === outcome.key ? "primary" : "secondary"}
                        aria-pressed={responses[item.id]?.outcome === outcome.key}
                        onClick={() => setResponse(item.id, { outcome: outcome.key })}
                      >
                        {outcome.label}
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {evaluation.outOfRange.length > 0 && (
            <StatusMessage tone="warning">Out of range: {evaluation.outOfRange.join(", ")}</StatusMessage>
          )}
        </LayerTheme>
      )}

      <div className="equipment-form">
        <ChoiceGroup
          label="Result"
          options={isBulk ? EQUIPMENT_CHECK_RESULTS.filter((option) => option.key !== "fail") : EQUIPMENT_CHECK_RESULTS}
          value={result}
          onChange={(value) => {
            setResultTouched(true);
            setResult(value);
          }}
        />
        {!isMaintenance && (
          <ChoiceGroup
            label="Condition"
            options={isBulk ? EQUIPMENT_CONDITIONS.filter((option) => option.key !== "unsafe") : EQUIPMENT_CONDITIONS}
            value={condition}
            onChange={setCondition}
          />
        )}

        {isMaintenance && (
          <div className="equipment-form__grid">
            <InputField
              label={mode === "calibration" ? "Calibration company" : "Serviced by"}
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
            />
            <InputField
              label={mode === "calibration" ? "Certificate number" : "Report / job reference"}
              value={certificateRef}
              onChange={(event) => setCertificateRef(event.target.value)}
            />
            <InputField label="Cost (£)" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} />
          </div>
        )}

        <TextAreaField
          label="Notes"
          value={notes}
          onChange={setNotes}
          placeholder={isMaintenance ? "Work carried out, parts replaced, readings" : "Anything the next person should know"}
        />

        <div className="equipment-form__grid">
          <CalendarField
            label={isMaintenance ? "Date carried out" : "Date checked"}
            value={performedOn}
            onValueChange={(value) => setPerformedOn(value || toDateInputValue(new Date()))}
            size="md"
          />
          {!isBulk && (
            <CalendarField
              label={mode === "calibration" ? "Calibration expires" : mode === "service" ? "Next service due" : "Next due"}
              value={nextDue}
              onValueChange={(value) => {
                setNextDueTouched(true);
                setNextDue(value || "");
              }}
              size="md"
            />
          )}
        </div>
        {isBulk && (
          <p className="equipment-form__hint">Each asset&apos;s next due date is worked out from its own check interval.</p>
        )}

        {!isBulk && !isMaintenance && (
          <FilePickerField label="Photos" files={photos} onChange={setPhotos} capture buttonLabel="Add photos" />
        )}
        {!isBulk && isMaintenance && (
          <FilePickerField
            label={mode === "calibration" ? "Calibration certificate" : "Service report"}
            files={reportFile}
            onChange={setReportFile}
            multiple={false}
            buttonLabel="Attach file"
          />
        )}
      </div>

      {raisesFault && !isBulk && (
        <LayerTheme radius="var(--radius-sm)" padding="12px" gap="12px">
          <h3 className="app-record-heading">Fault found</h3>
          <TextAreaField
            label="Describe the fault"
            required
            value={fault.description}
            onChange={(value) => setFault((previous) => ({ ...previous, description: value }))}
          />
          <ChoiceGroup
            label="Severity"
            options={EQUIPMENT_FAULT_SEVERITIES}
            value={fault.severity}
            onChange={(value) => setFault((previous) => ({ ...previous, severity: value }))}
          />
          <ChoiceGroup
            label="Can it still be used?"
            options={EQUIPMENT_FAULT_USABILITY}
            value={condition === "unsafe" ? "unsafe" : fault.usability}
            onChange={(value) => setFault((previous) => ({ ...previous, usability: value }))}
            hint={
              condition === "unsafe" || fault.usability === "unsafe"
                ? "This equipment will be marked Out of Service."
                : EQUIPMENT_FAULT_USABILITY.find((option) => option.key === fault.usability)?.description
            }
          />
          <CheckboxField
            label="Repair required"
            checked={fault.repairRequired}
            onChange={(value) => setFault((previous) => ({ ...previous, repairRequired: value }))}
          />
        </LayerTheme>
      )}

      <FormField label="Recorded as">
        <p className="app-record-note app-record-note--strong">
          {actorName || "You"} · time recorded automatically when you save
        </p>
      </FormField>
    </EquipmentDrawer>
  );
}
