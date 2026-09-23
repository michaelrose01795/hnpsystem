// file location: src/features/tracking/equipment/EquipmentDetailDrawer.js
//
// One asset, everything about it: status and actions, asset / schedule /
// service / calibration / purchase details, the activity timeline, faults and
// documents. Opened by clicking a card, "View History" (History tab) or a
// scanned QR label.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, InputField, StatusMessage } from "@/components/ui";
import { CalendarField } from "@/components/ui/calendarAPI";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import LayerTheme from "@/components/ui/LayerTheme";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import {
  RecordFieldGrid,
  StatusBadge,
  Timeline,
  TimelineHead,
} from "@/features/customers/hub/RecordPrimitives";
import {
  EQUIPMENT_CHECK_RESULTS,
  EQUIPMENT_DOCUMENT_TYPES,
  EQUIPMENT_DOCUMENT_TYPE_BY_KEY,
  EQUIPMENT_FAULT_SEVERITIES,
  EQUIPMENT_FAULT_STATUSES,
  EQUIPMENT_FAULT_USABILITY,
  EQUIPMENT_OPERATIONAL_STATUSES,
} from "@/config/equipmentTracking";
import {
  EQUIPMENT_TIMELINE_FILTERS,
  deriveEquipmentStatus,
  describeInterval,
  formatEquipmentDate,
  formatEquipmentDateTime,
  getCategoryLabel,
  getDepartmentLabel,
  getDueSoonDays,
  getEventTone,
  getLastCheckedByLabel,
  getLocationLabel,
  getOpenFaults,
  resolveChecklistForAsset,
} from "@/features/tracking/equipment/equipmentModel";
import {
  ChoiceGroup,
  EquipmentDrawer,
  FilePickerField,
  toOptions,
} from "@/features/tracking/equipment/EquipmentFormControls";
import EquipmentQrLabel from "@/features/tracking/equipment/EquipmentQrLabel";
import {
  changeEquipmentStatus,
  fetchEquipmentDetail,
  openEquipmentDocument,
  removeEquipmentDocument,
  uploadEquipmentDocument,
} from "@/features/tracking/equipment/equipmentClient";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "history", label: "History" },
  { value: "faults", label: "Faults" },
  { value: "documents", label: "Documents" },
];

const toneOf = (list, key) => list.find((item) => item.key === key)?.tone || "neutral";
const labelOf = (list, key) => list.find((item) => item.key === key)?.label || key;
const money = (value) => (value === null || value === undefined || value === "" ? "" : `£${Number(value).toFixed(2)}`);

function Block({ title, children, actions }) {
  return (
    <LayerTheme radius="var(--radius-sm)" padding="12px" gap="10px">
      <div className="equipment-drawer__list-item">
        <h3 className="app-record-heading">{title}</h3>
        {actions}
      </div>
      {children}
    </LayerTheme>
  );
}

/* ------------------------------------------------------------ Overview */
function StatusChangeForm({ asset, onChanged }) {
  const options = EQUIPMENT_OPERATIONAL_STATUSES.filter(
    (status) => status.key !== asset.operationalStatus && status.key !== "retired" && asset.operationalStatus !== "retired"
  );
  const [status, setStatus] = useState(options[0]?.key || "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!options.length) return null;
  const apply = async () => {
    setSaving(true);
    setError("");
    try {
      onChanged(await changeEquipmentStatus(asset.id, status, reason));
      setReason("");
    } catch (applyError) {
      setError(applyError.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="equipment-form">
      {error && <StatusMessage tone="danger">{error}</StatusMessage>}
      <div className="equipment-form__grid">
        <DropdownField label="Set status" options={toOptions(options)} value={status} onValueChange={setStatus} size="md" />
        <InputField label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
      <div className="app-record-actions">
        <Button type="button" variant="secondary" size="sm" busy={saving} disabled={saving} onClick={apply}>
          Apply status
        </Button>
      </div>
    </div>
  );
}

function RetireForm({ asset, onChanged }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const retired = asset.operationalStatus === "retired";
  const apply = async () => {
    setSaving(true);
    setError("");
    try {
      onChanged(await changeEquipmentStatus(asset.id, retired ? "awaiting_inspection" : "retired", reason));
    } catch (applyError) {
      setError(applyError.message);
      setSaving(false);
    }
  };
  return (
    <div className="equipment-form">
      {error && <StatusMessage tone="danger">{error}</StatusMessage>}
      <p className="equipment-form__hint">
        {retired
          ? "Reinstating returns it to the register as Awaiting Inspection."
          : "Retired equipment leaves the active register but keeps its full history. Nothing is deleted."}
      </p>
      {!retired && <InputField label="Reason" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Replaced by EQ-0042" />}
      <div className="app-record-actions">
        <Button type="button" variant={retired ? "secondary" : "danger"} size="sm" busy={saving} disabled={saving} onClick={apply}>
          {retired ? "Reinstate" : "Retire equipment"}
        </Button>
      </div>
    </div>
  );
}

function Overview({ detail, capabilities, checklists, onAction, onAssetChanged }) {
  const { asset } = detail;
  const status = deriveEquipmentStatus(asset);
  const openFaults = getOpenFaults(asset);
  const retired = asset.operationalStatus === "retired";
  const checklist = resolveChecklistForAsset(asset, checklists);
  const [panel, setPanel] = useState("");
  const togglePanel = (name) => setPanel((current) => (current === name ? "" : name));

  return (
    <>
      <div className="equipment-drawer__status">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        {status.detail !== status.label && <span className="app-record-note app-record-note--strong">{status.detail}</span>}
      </div>
      {asset.statusReason && ["out_of_service", "under_repair", "awaiting_inspection", "retired"].includes(asset.operationalStatus) && (
        <p className="app-record-note">
          {asset.statusReason}
          {asset.statusChangedAt ? ` · ${formatEquipmentDateTime(asset.statusChangedAt)}` : ""}
        </p>
      )}
      {openFaults.length > 0 && (
        <StatusMessage tone={openFaults.some((fault) => fault.usability === "unsafe") ? "danger" : "warning"}>
          {openFaults.length} open fault{openFaults.length === 1 ? "" : "s"}: {openFaults.map((fault) => fault.description).join("; ")}
        </StatusMessage>
      )}

      {!retired && (
        <div className="app-record-actions">
          {capabilities.check && (
            <Button type="button" variant="primary" size="sm" onClick={() => onAction({ type: "check", mode: "routine" })}>
              Log check
            </Button>
          )}
          {capabilities.reportFault && (
            <Button type="button" variant="secondary" size="sm" onClick={() => onAction({ type: "fault", mode: "report" })}>
              Report fault
            </Button>
          )}
          {capabilities.recordMaintenance && (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => onAction({ type: "check", mode: "inspection" })}>
                Log inspection
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onAction({ type: "check", mode: "service" })}>
                Record service
              </Button>
              {asset.requiresCalibration && (
                <Button type="button" variant="secondary" size="sm" onClick={() => onAction({ type: "check", mode: "calibration" })}>
                  Record calibration
                </Button>
              )}
            </>
          )}
        </div>
      )}
      <div className="app-record-actions">
        <Button type="button" variant={panel === "qr" ? "primary" : "secondary"} size="sm" aria-expanded={panel === "qr"} onClick={() => togglePanel("qr")}>
          QR label
        </Button>
        {capabilities.manage && !retired && (
          <Button type="button" variant={panel === "status" ? "primary" : "secondary"} size="sm" aria-expanded={panel === "status"} onClick={() => togglePanel("status")}>
            Change status
          </Button>
        )}
        {capabilities.retire && (
          <Button type="button" variant={panel === "retire" ? "primary" : "secondary"} size="sm" aria-expanded={panel === "retire"} onClick={() => togglePanel("retire")}>
            {retired ? "Reinstate" : "Retire"}
          </Button>
        )}
      </div>
      {panel === "qr" && (
        <LayerTheme radius="var(--radius-sm)" padding="12px" gap="8px">
          <EquipmentQrLabel asset={asset} />
        </LayerTheme>
      )}
      {panel === "status" && (
        <LayerTheme radius="var(--radius-sm)" padding="12px" gap="8px">
          <StatusChangeForm asset={asset} onChanged={(next) => { setPanel(""); onAssetChanged(next); }} />
        </LayerTheme>
      )}
      {panel === "retire" && (
        <LayerTheme radius="var(--radius-sm)" padding="12px" gap="8px">
          <RetireForm asset={asset} onChanged={(next) => { setPanel(""); onAssetChanged(next); }} />
        </LayerTheme>
      )}

      <Block title="Inspection schedule">
        <RecordFieldGrid
          keepEmpty
          fields={[
            { label: "Last checked", value: formatEquipmentDateTime(asset.lastChecked) },
            { label: "Last checked by", value: getLastCheckedByLabel(asset) },
            { label: "Last result", value: asset.lastCheckResult ? labelOf(EQUIPMENT_CHECK_RESULTS, asset.lastCheckResult) : "" },
            { label: "Next due", value: formatEquipmentDate(asset.nextDue) },
            { label: "Check interval", value: describeInterval(asset) },
            { label: "Due Soon warning", value: `${getDueSoonDays(asset)} days${asset.dueSoonDays === null || asset.dueSoonDays === undefined ? " (automatic)" : ""}` },
            { label: "Checklist", value: checklist?.name || "None" },
          ]}
        />
      </Block>

      <Block title="Asset" actions={capabilities.manage && (
        <Button type="button" variant="secondary" size="xs" onClick={() => onAction({ type: "edit" })}>Edit</Button>
      )}>
        <RecordFieldGrid
          keepEmpty
          fields={[
            { label: "Asset ID", value: asset.assetCode },
            { label: "Category", value: getCategoryLabel(asset) },
            { label: "Department", value: getDepartmentLabel(asset) },
            { label: "Location", value: getLocationLabel(asset) },
            { label: "Manufacturer", value: asset.manufacturer },
            { label: "Model", value: asset.model },
            { label: "Serial number", value: asset.serialNumber },
          ]}
        />
      </Block>

      <Block title="Service">
        <RecordFieldGrid
          keepEmpty
          fields={[
            { label: "Last service", value: formatEquipmentDate(asset.lastServiceAt) },
            { label: "Next service due", value: formatEquipmentDate(asset.nextServiceDue) },
            { label: "Service interval", value: asset.serviceIntervalMonths ? `${asset.serviceIntervalMonths} months` : "Not scheduled" },
            { label: "Provider", value: asset.serviceProvider },
          ]}
        />
      </Block>

      {asset.requiresCalibration && (
        <Block title="Calibration">
          <RecordFieldGrid
            keepEmpty
            fields={[
              { label: "Last calibrated", value: formatEquipmentDate(asset.lastCalibratedAt) },
              { label: "Calibration expires", value: formatEquipmentDate(asset.calibrationDue) },
              { label: "Interval", value: `${asset.calibrationIntervalMonths || 12} months` },
              { label: "Company", value: asset.calibrationCompany },
              { label: "Certificate", value: asset.calibrationCertificateRef },
            ]}
          />
        </Block>
      )}

      <Block title="Purchase & warranty">
        <RecordFieldGrid
          keepEmpty
          fields={[
            { label: "Purchased", value: formatEquipmentDate(asset.purchaseDate) },
            { label: "Price", value: money(asset.purchasePrice) },
            { label: "Supplier", value: asset.supplier },
            { label: "Order / invoice", value: asset.purchaseReference },
            { label: "Warranty expires", value: formatEquipmentDate(asset.warrantyExpiry) },
            { label: "Warranty provider", value: asset.warrantyProvider },
          ]}
        />
      </Block>

      {asset.notes && (
        <Block title="Notes">
          <p className="app-record-note">{asset.notes}</p>
        </Block>
      )}
    </>
  );
}

/* ------------------------------------------------------------- History */
function EventDetail({ event }) {
  const detail = event.detail || {};
  const lines = [];
  if (detail.checklistName) lines.push(`Checklist: ${detail.checklistName}`);
  if (detail.condition) lines.push(`Condition: ${detail.condition}`);
  if (detail.failedItems?.length) lines.push(`Failed: ${detail.failedItems.join("; ")}`);
  if (detail.readings?.length) {
    lines.push(`Readings: ${detail.readings.map((reading) => `${reading.label} ${reading.reading}${reading.unit ? ` ${reading.unit}` : ""}${reading.inRange === false ? " (out of range)" : ""}`).join("; ")}`);
  }
  if (detail.provider) lines.push(`By: ${detail.provider}`);
  if (detail.certificateRef) lines.push(`Certificate / ref: ${detail.certificateRef}`);
  if (detail.nextDue) lines.push(`Next due: ${formatEquipmentDate(detail.nextDue)}`);
  if (detail.severity) lines.push(`Severity: ${detail.severity}${detail.usability ? ` · ${labelOf(EQUIPMENT_FAULT_USABILITY, detail.usability)}` : ""}`);
  if (detail.resolution) lines.push(`Resolution: ${detail.resolution}`);
  if (detail.repairCost) lines.push(`Repair cost: ${money(detail.repairCost)}`);
  if (detail.repairedBy) lines.push(`Repaired by: ${detail.repairedBy}`);
  if (detail.reason) lines.push(`Reason: ${detail.reason}`);
  if (detail.fields?.length) lines.push(`Changed: ${detail.fields.join(", ")}`);
  if (detail.batchSize) lines.push(`Part of a bulk check of ${detail.batchSize} assets`);
  if (detail.note) lines.push(detail.note);
  if (detail.notes) lines.push(`Notes: ${detail.notes}`);
  return (
    <>
      {lines.map((line) => (
        <p key={line} className="app-record-note">{line}</p>
      ))}
    </>
  );
}

function History({ events }) {
  const [filter, setFilter] = useState("all");
  const types = EQUIPMENT_TIMELINE_FILTERS.find((option) => option.key === filter)?.types;
  const shown = useMemo(
    () =>
      events
        .filter((event) => !types || types.includes(event.eventType))
        .map((event) => ({ ...event, tone: getEventTone(event) })),
    [events, types]
  );
  return (
    <>
      <ChoiceGroup label="Show" options={EQUIPMENT_TIMELINE_FILTERS} value={filter} onChange={setFilter} size="xs" />
      {shown.length === 0 ? (
        <p className="app-record-note">Nothing recorded yet.</p>
      ) : (
        <Timeline
          entries={shown}
          renderEntry={(event) => (
            <>
              <TimelineHead title={event.summary} time={formatEquipmentDateTime(event.occurredAt)} />
              <div className="app-timeline__meta">
                <span className="app-record-note app-record-note--strong">{event.actorName || "System"}</span>
              </div>
              <EventDetail event={event} />
            </>
          )}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------- Faults */
function Faults({ faults, capabilities, onAction }) {
  if (!faults.length) return <p className="app-record-note">No faults have been reported.</p>;
  const ordered = [...faults].sort((a, b) => (a.status === "resolved") - (b.status === "resolved"));
  return ordered.map((fault) => (
    <LayerTheme key={fault.id} radius="var(--radius-sm)" padding="12px" gap="6px">
      <div className="equipment-drawer__status">
        <StatusBadge tone={toneOf(EQUIPMENT_FAULT_STATUSES, fault.status)}>{labelOf(EQUIPMENT_FAULT_STATUSES, fault.status)}</StatusBadge>
        <StatusBadge tone={toneOf(EQUIPMENT_FAULT_SEVERITIES, fault.severity)}>{labelOf(EQUIPMENT_FAULT_SEVERITIES, fault.severity)}</StatusBadge>
        <span className="app-record-note">{labelOf(EQUIPMENT_FAULT_USABILITY, fault.usability)}</span>
      </div>
      <p className="app-record-note app-record-note--strong">{fault.description}</p>
      <p className="equipment-form__hint">
        Reported by {fault.reportedByName || "unknown"} · {formatEquipmentDateTime(fault.reportedAt)}
        {fault.repairRequired ? " · repair required" : ""}
      </p>
      {fault.status === "resolved" && (
        <p className="app-record-note">
          Resolved by {fault.resolvedByName || "unknown"} · {formatEquipmentDateTime(fault.resolvedAt)} — {fault.resolutionNotes}
          {fault.repairCost ? ` · ${money(fault.repairCost)}` : ""}
        </p>
      )}
      {capabilities.manageFaults && fault.status !== "resolved" && (
        <div className="app-record-actions">
          {fault.status === "open" && (
            <Button type="button" variant="secondary" size="xs" onClick={() => onAction({ type: "fault", mode: "start-repair", fault })}>
              Start repair
            </Button>
          )}
          <Button type="button" variant="primary" size="xs" onClick={() => onAction({ type: "fault", mode: "resolve", fault })}>
            Resolve
          </Button>
        </div>
      )}
    </LayerTheme>
  ));
}

/* ----------------------------------------------------------- Documents */
function DocumentUpload({ assetId, onUploaded }) {
  const [docType, setDocType] = useState("inspection_certificate");
  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const upload = async () => {
    if (!files.length) {
      setError("Choose a file.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await uploadEquipmentDocument({ equipmentId: assetId, file: files[0], docType, title, expiresAt });
      setFiles([]);
      setTitle("");
      setExpiresAt("");
      onUploaded();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Block title="Add a document">
      {error && <StatusMessage tone="danger">{error}</StatusMessage>}
      <div className="equipment-form__grid">
        <DropdownField label="Type" options={toOptions(EQUIPMENT_DOCUMENT_TYPES)} value={docType} onValueChange={setDocType} size="md" />
        <InputField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional" />
        <CalendarField label="Expires" value={expiresAt} onValueChange={(value) => setExpiresAt(value || "")} size="md" />
      </div>
      <FilePickerField files={files} onChange={setFiles} multiple={false} buttonLabel="Choose file" hint="PDF or image, up to 15 MB." />
      <div className="app-record-actions">
        <Button type="button" variant="primary" size="sm" busy={saving} disabled={saving} onClick={upload}>
          Upload
        </Button>
      </div>
    </Block>
  );
}

function Documents({ detail, capabilities, onChanged }) {
  const [error, setError] = useState("");
  const open = async (document) => {
    setError("");
    // Open the window inside the click so pop-up blockers allow it, then
    // point it at the signed URL once the server has minted one.
    const win = window.open("", "_blank");
    try {
      const url = await openEquipmentDocument(document.id);
      if (win) win.location.href = url;
      else window.location.assign(url);
    } catch (openError) {
      win?.close();
      setError(openError.message);
    }
  };
  const remove = async (document) => {
    setError("");
    try {
      await removeEquipmentDocument(document.id);
      onChanged();
    } catch (removeError) {
      setError(removeError.message);
    }
  };
  const today = new Date();
  return (
    <>
      {error && <StatusMessage tone="danger">{error}</StatusMessage>}
      {detail.documents.length === 0 && <p className="app-record-note">No documents or photos yet.</p>}
      {detail.documents.length > 0 && (
        <LayerTheme radius="var(--radius-sm)" padding="12px" gap="8px">
          <ul className="equipment-drawer__list">
            {detail.documents.map((document) => {
              const expired = document.expiresAt && new Date(document.expiresAt) < today;
              return (
                <li key={document.id} className="equipment-drawer__list-item">
                  <div className="equipment-table__name">
                    <span className="equipment-table__primary">{document.title || document.fileName}</span>
                    <span className="equipment-table__secondary">
                      {EQUIPMENT_DOCUMENT_TYPE_BY_KEY[document.docType]?.label || document.docType} ·{" "}
                      {document.uploadedByName || "unknown"} · {formatEquipmentDate(document.uploadedAt)}
                      {document.expiresAt ? ` · ${expired ? "expired" : "expires"} ${formatEquipmentDate(document.expiresAt)}` : ""}
                    </span>
                  </div>
                  <div className="app-record-actions">
                    <Button type="button" variant="secondary" size="xs" onClick={() => open(document)}>
                      Open
                    </Button>
                    {capabilities.manageDocuments && (
                      <Button type="button" variant="secondary" size="xs" onClick={() => remove(document)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </LayerTheme>
      )}
      {capabilities.manageDocuments && <DocumentUpload assetId={detail.asset.id} onUploaded={onChanged} />}
    </>
  );
}

/* -------------------------------------------------------------- Drawer */
export default function EquipmentDetailDrawer({
  assetRef,
  initialTab = "overview",
  capabilities,
  checklists,
  refreshToken = 0,
  onAction,
  onAssetChanged,
  onClose,
}) {
  const [tab, setTab] = useState(initialTab);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError("");
    fetchEquipmentDetail(assetRef)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        onAssetChanged?.(data.asset, { silent: true });
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      });
    return () => {
      cancelled = true;
    };
    // onAssetChanged is a stable callback from the panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetRef, refreshToken, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const asset = detail?.asset;
  const act = (action) => onAction({ ...action, asset });

  return (
    <EquipmentDrawer
      title={asset ? asset.name : "Equipment record"}
      description={asset ? `${asset.assetCode} · ${getCategoryLabel(asset)}` : ""}
      onClose={onClose}
    >
      {error && <StatusMessage tone="danger">{error}</StatusMessage>}
      {!detail && !error && (
        <div className="equipment-drawer" role="status" aria-live="polite" aria-busy="true" aria-label="Loading equipment record">
          <SkeletonKeyframes />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {["88px", "72px", "64px", "96px"].map((width) => (
              <SkeletonBlock key={width} width={width} height="36px" />
            ))}
          </div>
          <div className="equipment-drawer__status">
            <SkeletonBlock width="96px" height="24px" borderRadius="999px" />
            <SkeletonBlock width="180px" height="14px" />
          </div>
          <div className="app-record-actions">
            {["92px", "108px", "84px"].map((width) => (
              <SkeletonBlock key={width} width={width} height="32px" />
            ))}
          </div>
          {[7, 5].map((fieldCount, block) => (
            <LayerTheme key={block} radius="var(--radius-sm)" padding="12px" gap="10px">
              <SkeletonBlock width={block ? "64px" : "150px"} height="16px" />
              <div className="app-record-grid">
                {Array.from({ length: fieldCount }, (_, index) => (
                  <div key={index} className="app-record-field">
                    <SkeletonBlock width="80px" height="11px" />
                    <SkeletonBlock width={index % 3 === 0 ? "70%" : index % 3 === 1 ? "52%" : "60%"} height="14px" />
                  </div>
                ))}
              </div>
            </LayerTheme>
          ))}
        </div>
      )}
      {detail && (
        <>
          <TabGroup items={TABS} value={tab} onChange={setTab} ariaLabel="Equipment record sections" />
          <div className="equipment-drawer">
            {tab === "overview" && (
              <Overview
                detail={detail}
                capabilities={capabilities}
                checklists={checklists}
                onAction={act}
                onAssetChanged={(next) => {
                  onAssetChanged?.(next);
                  reload();
                }}
              />
            )}
            {tab === "history" && <History events={detail.events} />}
            {tab === "faults" && <Faults faults={detail.faults} capabilities={capabilities} onAction={act} />}
            {tab === "documents" && <Documents detail={detail} capabilities={capabilities} onChanged={reload} />}
          </div>
        </>
      )}
    </EquipmentDrawer>
  );
}
