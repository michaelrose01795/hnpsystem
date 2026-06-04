// file location: src/pages/customers/[customerSlug].js
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Link from "next/link";
import { useRouter } from "next/router";
import { isInactiveJobStatus } from "@/lib/status/statusHelpers";
import {
  getCustomerById,
  getCustomerBySlug,
  getCustomerPaymentMethods,
  getCustomerVehicles,
  getCustomerJobs,
  getCustomerActivityEvents,
  updateCustomer } from
"@/lib/database/customers";
import { normalizeContactPreference } from "@/lib/customers/contactPreference";
import { createCustomerDisplaySlug, normalizeCustomerSlug } from "@/lib/customers/slug";
import { isValidUuid } from "@/lib/utils/ids";
import { createOrUpdateVehicle } from "@/lib/database/vehicles";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { prefetchJob } from "@/lib/swr/prefetch";
import { getVehicleRegistration, pickMileageValue } from "@/lib/canonical/fields";
import { useUser } from "@/context/UserContext";
import {
  connectCustomerToThread,
  createThread,
  fetchMessageDirectory,
  fetchMessageThreads,
  fetchThreadMessages,
  sendThreadMessage } from
"@/lib/api/messages";
import { createJobNote } from "@/lib/database/notes";
import CustomerDetailWorkspaceUi from "@/components/page-ui/customers/customers-customer-slug-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";

const TAB_DEFINITIONS = [
{ id: "insights", label: "Insights" },
{ id: "history", label: "History" },
{ id: "payment", label: "Payment" },
{ id: "activity", label: "Activity" },
{ id: "messages", label: "Messages" }];


/** @see statusHelpers.isInactiveJobStatus — replaces inline Set */

const detailCardStyles = {
  container: {
    borderRadius: "var(--radius-md)",
    border: "none",
    background: "var(--theme)",
    padding: "var(--page-card-padding)",
    display: "flex",
    flexDirection: "column",
    gap: "24px"
  },
  identityBlock: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    alignItems: "flex-start"
  },
  name: {
    fontSize: "1.65rem",
    fontWeight: 700,
    margin: 0,
    color: "var(--text-1)",
    wordBreak: "break-word"
  },
  metaItem: {
    borderRadius: "var(--radius-md)",
    border: "none",
    background: "var(--surface)",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minHeight: "110px"
  },
  metaLabel: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "0.65rem",
    color: "var(--grey-accent-dark)"
  },
  metaValue: {
    fontWeight: 600,
    color: "var(--text-1)"
  }
};


const tabPanelStyles = {
  container: {
    borderRadius: "var(--radius-md)",
    border: "none",
    background: "var(--theme)",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  }
};

const detailGridStyles = {
  grid: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))"
  },
  item: {
    borderRadius: "var(--radius-md)",
    border: "none",
    background: "var(--surface)",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minHeight: "110px"
  },
  label: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "0.65rem",
    color: "var(--text-1)"
  },
  value: {
    fontWeight: 600,
    color: "var(--text-1)",
    wordBreak: "break-word"
  }
};

const formatDate = (value) => {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch (_err) {
    return "—";
  }
};

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (_err) {
    return "—";
  }
};

const formatCurrency = (value) =>
new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value || 0));

const buildAddressDisplay = (address, postcode) => {
  const rawAddress = String(address || "").trim();
  const rawPostcode = String(postcode || "").trim();
  if (!rawAddress) return rawPostcode;
  if (!rawPostcode) return rawAddress;
  return rawAddress.toLowerCase().includes(rawPostcode.toLowerCase()) ?
  rawAddress :
  `${rawAddress}, ${rawPostcode}`;
};

const buildMapLink = (address) => {
  const query = String(address || "").trim();
  if (!query) return {};
  const encoded = encodeURIComponent(query);
  return {
    href: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    nativeHref: `geo:0,0?q=${encoded}`
  };
};

const ContactPreferenceToggle = ({ label, checked, disabled, onChange }) =>
<label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: disabled ? "not-allowed" : "pointer" }}>
    <input
    type="checkbox"
    checked={Boolean(checked)}
    disabled={disabled}
    onChange={(event) => onChange?.(event.target.checked)}
    style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }} />

    <span style={{ fontSize: "13px", color: disabled ? "var(--text-1)" : "var(--text-1)", fontWeight: 600 }}>
      {label}
    </span>
  </label>;


const parseRequests = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.requests)) return parsed.requests;
      if (parsed && typeof parsed === "object") {
        return Object.values(parsed);
      }
    } catch (_err) {
      return [];
    }
  }
  if (typeof raw === "object") {
    const maybeArray = raw?.requests;
    if (Array.isArray(maybeArray)) return maybeArray;
    return Object.values(raw);
  }
  return [];
};

const deriveRequestSummary = (requests) => {
  const parts = requests.
  map((request) => {
    if (!request) return null;
    if (typeof request === "string") return request;
    if (request?.title) return request.title;
    if (request?.description) return request.description;
    return null;
  }).
  filter(Boolean).
  slice(0, 2);
  if (parts.length === 0) return null;
  return parts.join(" • ");
};

const VehiclesSection = ({ vehicles, customerId, onVehicleAdded }) => {
  const [showForm, setShowForm] = useState(false);
  const [newReg, setNewReg] = useState("");
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [dvlaData, setDvlaData] = useState(null);

  const resetForm = () => {
    setShowForm(false);
    setNewReg("");
    setDvlaData(null);
    setFormMessage("");
    setLooking(false);
    setSaving(false);
  };

  const handleLookup = async () => {
    const trimmed = newReg.trim().toUpperCase();
    if (!trimmed) return;
    setLooking(true);
    setFormMessage("");
    setDvlaData(null);
    try {
      const res = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: trimmed })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormMessage(err.message || err.error || "Vehicle not found. You can still save with registration only.");
        setDvlaData(null);
      } else {
        const data = await res.json();
        setDvlaData(data);
        setFormMessage("");
      }
    } catch {
      setFormMessage("DVLA lookup failed. You can still save with registration only.");
    }
    setLooking(false);
  };

  const handleSave = async () => {
    const trimmed = newReg.trim().toUpperCase();
    if (!trimmed) return;
    setSaving(true);
    setFormMessage("");
    const payload = {
      registration: trimmed,
      reg_number: trimmed,
      customer_id: customerId
    };
    if (dvlaData) {
      payload.make = dvlaData.make || undefined;
      payload.model = dvlaData.model || undefined;
      payload.make_model = dvlaData.make && dvlaData.model ? `${dvlaData.make} ${dvlaData.model}` : undefined;
      payload.year = dvlaData.yearOfManufacture || undefined;
      payload.colour = dvlaData.colour || undefined;
      payload.fuel_type = dvlaData.fuelType || undefined;
      payload.mot_due = dvlaData.motExpiryDate || undefined;
      payload.engine_capacity = dvlaData.engineCapacity || undefined;
      payload.co2_emissions = dvlaData.co2Emissions || undefined;
      payload.tax_status = dvlaData.taxStatus || undefined;
      payload.tax_due_date = dvlaData.taxDueDate || undefined;
      payload.marked_for_export = dvlaData.markedForExport || false;
      payload.wheelplan = dvlaData.wheelplan || undefined;
      payload.month_of_first_registration = dvlaData.monthOfFirstRegistration || undefined;
    }
    const result = await createOrUpdateVehicle(payload);
    if (result.success) {
      resetForm();
      if (onVehicleAdded) onVehicleAdded();
    } else {
      setFormMessage(result.error?.message || "Failed to add vehicle.");
    }
    setSaving(false);
  };

  const previewLabelStyle = {
    fontSize: "0.65rem",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    color: "var(--grey-accent)"
  };
  const previewValueStyle = {
    fontWeight: 600,
    color: "var(--text-1)",
    fontSize: "13px"
  };

  return (
    <LayerSurface as="section"

    data-dev-section="1"
    data-dev-section-key="customer-profile-insights-vehicles"
    data-dev-section-type="section-shell"
    data-dev-section-parent="customer-profile-tab-insights"
    data-dev-background-token="surface"
    style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "16px" }}>

      <LayerSurface as="div"

      data-dev-section="1"
      data-dev-section-key="customer-profile-insights-vehicle-grid"
      data-dev-section-type="section-shell"
      data-dev-section-parent="customer-profile-insights-vehicles"
      data-dev-background-token="transparent"
      data-dev-text-preview={`${vehicles.length} linked vehicle${vehicles.length === 1 ? "" : "s"}`}
      style={{
        background: "transparent",
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}>

        {!showForm &&
        <div
          data-dev-section="1"
          data-dev-section-key="customer-profile-insights-vehicle-add-toolbar"
          data-dev-section-type="toolbar"
          data-dev-section-parent="customer-profile-insights-vehicle-grid"
          data-dev-background-token="transparent"
          data-dev-text-preview="Vehicle add action"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <strong style={{ color: "var(--text-1)", fontSize: "0.95rem" }}>
              {vehicles.length} linked vehicle{vehicles.length === 1 ? "" : "s"}
            </strong>
            <button
            type="button"
            className="app-btn app-btn--primary app-btn--sm"
            onClick={() => setShowForm(true)}
            style={{
              cursor: "pointer"
            }}>

              Add Vehicle
            </button>
          </div>
        }

        {showForm &&
        <LayerSurface as="div"

      data-dev-section="1"
      data-dev-section-key="customer-profile-insights-vehicle-add-form"
      data-dev-section-type="content-card"
      data-dev-section-parent="customer-profile-insights-vehicle-grid"
      data-dev-background-token="accent-surface"
      style={{



        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px"
      }}>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <input
            className="app-input"
            type="text"
            value={newReg}
            onChange={(e) => {setNewReg(e.target.value);setFormMessage("");setDvlaData(null);}}
            placeholder="Enter registration"
            autoFocus
            disabled={looking || saving}
            onKeyDown={(e) => {if (e.key === "Enter") handleLookup();}}
            style={{
              textTransform: "uppercase",
              width: "180px"
            }} />

            <button
            type="button"
            className="app-btn app-btn--secondary app-btn--sm"
            onClick={handleLookup}
            disabled={looking || saving || !newReg.trim()}
            style={{
              cursor: looking || saving || !newReg.trim() ? "not-allowed" : "pointer"
            }}>

              {looking ? "Looking up..." : "Lookup"}
            </button>
            <button
            type="button"
            className="app-btn app-btn--ghost app-btn--sm"
            onClick={resetForm}
            disabled={saving}
            style={{
              cursor: "pointer"
            }}>

              Cancel
            </button>
          </div>

          {formMessage && !dvlaData &&
        <span style={{ fontSize: "12px", color: "var(--warning-dark)" }}>{formMessage}</span>
        }

          {/* DVLA preview */}
          {dvlaData &&
        <LayerSurface as="div"

        data-dev-section="1"
        data-dev-section-key="customer-profile-insights-vehicle-dvla-preview"
        data-dev-section-type="content-card"
        data-dev-section-parent="customer-profile-insights-vehicle-add-form"
        data-dev-background-token="accent-surface"
        data-dev-text-preview={`DVLA preview ${newReg.trim().toUpperCase() || "vehicle lookup"}`}
        style={{



          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--info-dark)", letterSpacing: "0.5px" }}>
                  {newReg.trim().toUpperCase()}
                </span>
                <span style={{ color: "var(--grey-accent)" }}>|</span>
                <span style={{ fontWeight: 600, color: "var(--text-1)" }}>
                  {[dvlaData.make, dvlaData.model].filter(Boolean).join(" ") || "Unknown"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                <div><span style={previewLabelStyle}>Year</span><div style={previewValueStyle}>{dvlaData.yearOfManufacture || "—"}</div></div>
                <div><span style={previewLabelStyle}>Colour</span><div style={previewValueStyle}>{dvlaData.colour || "—"}</div></div>
                <div><span style={previewLabelStyle}>Fuel</span><div style={previewValueStyle}>{dvlaData.fuelType || "—"}</div></div>
                <div><span style={previewLabelStyle}>MOT Due</span><div style={previewValueStyle}>{dvlaData.motExpiryDate ? formatDate(dvlaData.motExpiryDate) : "—"}</div></div>
                <div><span style={previewLabelStyle}>Tax Status</span><div style={previewValueStyle}>{dvlaData.taxStatus || "—"}</div></div>
                <div><span style={previewLabelStyle}>Engine</span><div style={previewValueStyle}>{dvlaData.engineCapacity ? `${dvlaData.engineCapacity} cc` : "—"}</div></div>
              </div>
            </LayerSurface>
        }

          {/* Save / Save without DVLA */}
          {(dvlaData || newReg.trim()) &&
        <div
          data-dev-section="1"
          data-dev-section-key="customer-profile-insights-vehicle-save-toolbar"
          data-dev-section-type="toolbar"
          data-dev-section-parent="customer-profile-insights-vehicle-add-form"
          data-dev-background-token="transparent"
          data-dev-text-preview="Vehicle save actions"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
            type="button"
            className="app-btn app-btn--primary app-btn--sm"
            onClick={handleSave}
            disabled={saving || !newReg.trim()}
            style={{
              cursor: saving || !newReg.trim() ? "not-allowed" : "pointer"
            }}>

                {saving ? "Saving..." : dvlaData ? "Save Vehicle" : "Save Without Lookup"}
              </button>
              {formMessage && dvlaData &&
          <span style={{ fontSize: "12px", color: "var(--danger)" }}>{formMessage}</span>
          }
            </div>
        }
        </LayerSurface>
      }

      {!vehicles.length ?
      <LayerSurface as="div"

      data-dev-section="1"
      data-dev-section-key="customer-profile-insights-vehicles-empty"
      data-dev-section-type="empty-state"
      data-dev-section-parent="customer-profile-insights-vehicle-grid"
      data-dev-background-token="transparent"
      style={{


        padding: "24px",

        textAlign: "center",
        color: "var(--grey-accent)"
      }}>

          No vehicles linked to this customer yet.
        </LayerSurface> :

      <>
          {vehicles.map((vehicle) => {
          const registration = getVehicleRegistration(vehicle, "Unregistered");
          const makeModel =
          vehicle.make_model ||
          [vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
          "Vehicle";

          return (
            <LayerTheme as="div"
            key={vehicle.vehicle_id}

            data-dev-section="1"
            data-dev-section-key={`customer-profile-insights-vehicle-${vehicle.vehicle_id}`}
            data-dev-section-type="content-card"
            data-dev-section-parent="customer-profile-insights-vehicle-grid"
            data-dev-background-token="theme"
            style={{
              padding: "20px",
              gap: "16px",
              width: "100%"
            }}>

                {/* Header row: number-plate reg block + make / model + year */}
                <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "16px"
                }}>

                  <LayerSurface as="div"
                  radius="var(--radius-sm)"
                  style={{
                    padding: "8px 16px",
                    minHeight: "48px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>

                    <span
                    style={{
                      fontSize: "1.45rem",
                      fontWeight: 800,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--info-dark)",
                      lineHeight: 1,
                      overflowWrap: "anywhere"
                    }}>

                      {registration}
                    </span>
                  </LayerSurface>

                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                    <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-1)", overflowWrap: "anywhere" }}>
                      {makeModel}
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "var(--grey-accent)" }}>
                      {vehicle.year ? `Year ${vehicle.year}` : "Year unknown"}
                    </span>
                  </div>
                </div>

                {/* Hairline divider between header and detail fields (--separating-line: the one allowed list rule) */}
                <div
                aria-hidden="true"
                style={{ height: "1px", width: "100%", background: "var(--separating-line)" }} />

                {/* Detail fields — evenly aligned responsive grid */}
                <div
                style={{
                  display: "grid",
                  gap: "16px 20px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))"
                }}>

                  <VehicleField label="Colour" value={vehicle.colour} />
                  <VehicleField label="VIN" value={vehicle.vin || vehicle.chassis} />
                  <VehicleField
                  label="Mileage"
                  value={vehicle.mileage ? `${vehicle.mileage} miles` : null} />

                  <VehicleField label="Fuel" value={vehicle.fuel_type} />
                  <VehicleField label="Transmission" value={vehicle.transmission} />
                  <VehicleField label="MOT due" value={formatDate(vehicle.mot_due)} />
                </div>
              </LayerTheme>);

        })}
        </>
      }
      </LayerSurface>
    </LayerSurface>);

};

const VehicleField = ({ label, value }) =>
<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
    <span
    style={{
      fontSize: "0.65rem",
      textTransform: "uppercase",
      letterSpacing: "0.2em",
      color: "var(--grey-accent)"
    }}>

      {label}
    </span>
    <span style={{ fontWeight: 600, color: "var(--text-1)" }}>{value || "—"}</span>
  </div>;


const CustomerDocumentsSection = ({ jobs }) => {
  const files = jobs.flatMap((job) =>
  (job.job_files || []).map((file) => ({ ...file, jobNumber: job.job_number }))
  );

  return (
    <LayerSurface as="section"

    data-dev-section="1"
    data-dev-section-key="customer-profile-insights-documents"
    data-dev-section-type="content-card"
    data-dev-section-parent="customer-profile-tab-insights"
    data-dev-background-token="surface"
    style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>

      <h3 style={{ margin: 0, color: "var(--text-1)", fontSize: "1rem" }}>Documents, photos and videos</h3>
      {!files.length ?
      <LayerSurface as="div"

      data-dev-section="1"
      data-dev-section-key="customer-profile-insights-documents-empty"
      data-dev-section-type="empty-state"
      data-dev-section-parent="customer-profile-insights-documents"
      data-dev-background-token="accent-surface"
      style={{ padding: "18px", color: "var(--text-1)" }}>

          No uploaded files across this customer's jobs yet.
        </LayerSurface> :

      <div
        data-dev-section="1"
        data-dev-section-key="customer-profile-insights-documents-grid"
        data-dev-section-type="section-shell"
        data-dev-section-parent="customer-profile-insights-documents"
        data-dev-background-token="transparent"
        style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(220px, 260px)", gap: "12px", overflowX: "auto", paddingBottom: "4px" }}>

          {files.map((file) => {
          const type = String(file.file_type || "").toLowerCase();
          const isImage = type.startsWith("image/");
          const isVideo = type.startsWith("video/");
          return (
            <LayerSurface as="a"

            key={`${file.jobNumber}-${file.file_id}`}
            href={file.file_url}
            target="_blank"
            rel="noreferrer"
            data-dev-section="1"
            data-dev-section-key={`customer-profile-insights-document-${file.file_id}`}
            data-dev-section-type="content-card"
            data-dev-section-parent="customer-profile-insights-documents-grid"
            data-dev-background-token="accent-surface"
            style={{ padding: "12px", minHeight: "160px", textDecoration: "none", color: "var(--text-1)", display: "flex", flexDirection: "column", gap: "10px" }}>

                <div style={{ height: "86px", borderRadius: "var(--radius-sm)", background: "var(--surface)", overflow: "hidden", display: "grid", placeItems: "center" }}>
                  {isImage ?
                <img src={file.file_url} alt={file.file_name || "Uploaded file"} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
                isVideo ?
                <video src={file.file_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted /> :

                <span style={{ color: "var(--text-1)", fontWeight: 700 }}>File</span>
                }
                </div>
                <strong style={{ fontSize: "13px", overflowWrap: "anywhere" }}>{file.file_name || "Uploaded file"}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-1)" }}>Job {file.jobNumber} · {formatDate(file.uploaded_at)}</span>
              </LayerSurface>);

        })}
        </div>
      }
    </LayerSurface>);

};

const CustomerScheduleSection = ({ jobs }) => {
  const appointments = jobs.flatMap((job) =>
  (job.appointments || []).map((appointment) => ({
    ...appointment,
    jobNumber: job.job_number,
    vehicle: job.vehicle_reg || job.vehicle_make_model || "Vehicle not set"
  }))
  ).sort((a, b) => new Date(b.scheduled_time || 0) - new Date(a.scheduled_time || 0));

  return (
    <LayerSurface as="section"

    data-dev-section="1"
    data-dev-section-key="customer-profile-insights-schedule"
    data-dev-section-type="content-card"
    data-dev-section-parent="customer-profile-tab-insights"
    data-dev-background-token="surface"
    style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>

      <h3 style={{ margin: 0, color: "var(--text-1)", fontSize: "1rem" }}>Schedule</h3>
      {!appointments.length ?
      <LayerSurface as="div"

      data-dev-section="1"
      data-dev-section-key="customer-profile-insights-schedule-empty"
      data-dev-section-type="empty-state"
      data-dev-section-parent="customer-profile-insights-schedule"
      data-dev-background-token="accent-surface"
      style={{ padding: "18px", color: "var(--text-1)" }}>

          No appointments recorded for this customer.
        </LayerSurface> :

      <div
        data-dev-section="1"
        data-dev-section-key="customer-profile-insights-schedule-list"
        data-dev-section-type="section-shell"
        data-dev-section-parent="customer-profile-insights-schedule"
        data-dev-background-token="transparent"
        style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

          {appointments.map((appointment) =>
        <LayerSurface as="div"
        key={appointment.appointment_id}

        data-dev-section="1"
        data-dev-section-key={`customer-profile-insights-appointment-${appointment.appointment_id}`}
        data-dev-section-type="content-card"
        data-dev-section-parent="customer-profile-insights-schedule-list"
        data-dev-background-token="theme"
        style={{ background: "var(--theme)", padding: "14px", display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>

              <VehicleField label="When" value={formatDateTime(appointment.scheduled_time)} />
              <VehicleField label="Status" value={appointment.status || "Booked"} />
              <VehicleField label="Vehicle" value={appointment.vehicle} />
              <VehicleField label="Notes" value={appointment.notes} />
            </LayerSurface>
        )}
        </div>
      }
    </LayerSurface>);

};

const InsightsTab = ({ vehicles, jobs, customerId, onVehicleAdded }) =>
<div
  data-dev-section="1"
  data-dev-section-key="customer-profile-insights-stack"
  data-dev-section-type="section-shell"
  data-dev-section-parent="customer-profile-tab-insights"
  data-dev-background-token="transparent"
  data-dev-text-preview="Insights tab stack"
  style={{ display: "flex", flexDirection: "column", gap: "22px" }}>

    <VehiclesSection vehicles={vehicles} customerId={customerId} onVehicleAdded={onVehicleAdded} />
    <CustomerDocumentsSection jobs={jobs} />
    <CustomerScheduleSection jobs={jobs} />
  </div>;


const HistoryTab = ({ jobs }) => {
  if (!jobs.length) {
    return (
      <LayerSurface as="div"

      data-dev-section="1"
      data-dev-section-key="customer-profile-history-empty"
      data-dev-section-type="content-card"
      data-dev-section-parent="customer-profile-tab-history"
      data-dev-background-token="accent-surface"
      style={{



        padding: "24px",
        textAlign: "center",
        color: "var(--grey-accent)"
      }}>

        No job history recorded yet.
      </LayerSurface>);

  }

  return (
    <div
      data-dev-section="1"
      data-dev-section-key="customer-profile-history-list"
      data-dev-section-type="section-shell"
      data-dev-section-parent="customer-profile-tab-history"
      data-dev-background-token="transparent"
      style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {jobs.map((job) => {
        const requestSummary = deriveRequestSummary(parseRequests(job.requests));
        return (
          <LayerSurface as="div"
          key={job.id}

          data-dev-section="1"
          data-dev-section-key={`customer-profile-history-job-${job.id}`}
          data-dev-section-type="content-card"
          data-dev-section-parent="customer-profile-history-list"
          data-dev-background-token="surface"
          style={{



            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px"
              }}>

              <div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--grey-accent)" }}>
                  Job number
                </p>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: "1.25rem",
                    color: "var(--info-dark)"
                  }}>

                  {job.job_number}
                </p>
              </div>
              <span
                style={{
                  borderRadius: "var(--radius-pill)",
                  padding: "6px 16px",
                  background: "var(--surface)",
                  color: "var(--primary-selected)",
                  fontWeight: 600,
                  textTransform: "capitalize"
                }}>

                {job.status || "unknown"}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: "12px",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
              }}>

              <VehicleField
                label="Vehicle"
                value={job.vehicle_make_model || job.vehicle_reg} />

              <VehicleField
                label="Mileage"
                value={pickMileageValue(job.mileage, job.milage) ? `${pickMileageValue(job.mileage, job.milage)} miles` : null} />

              <VehicleField label="Created" value={formatDate(job.created_at)} />
              <VehicleField label="Updated" value={formatDate(job.updated_at)} />
              <VehicleField label="Source" value={job.job_source} />
            </div>

            {requestSummary &&
            <p style={{ margin: 0, color: "var(--text-1)" }}>{requestSummary}</p>
            }

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link
                href={`/job-cards/${encodeURIComponent(job.job_number)}`}
                onMouseEnter={() => prefetchJob(job.job_number)} // warm SWR cache on hover
                className="app-btn app-btn--primary app-btn--sm"
                style={{
                  textDecoration: "none"
                }}>

                View job card
              </Link>
              {job.vehicle_reg &&
              <span
                style={{
                  borderRadius: "var(--radius-pill)",
                  padding: "10px 18px",
                  color: "var(--text-1)"
                }}>

                  Reg: {job.vehicle_reg}
                </span>
              }
            </div>
          </LayerSurface>);

      })}
    </div>);

};

const PaymentTab = ({ paymentMethods, jobs }) => {
  const invoices = jobs.flatMap((job) =>
  (job.invoices || []).map((invoice) => ({ ...invoice, jobNumber: job.job_number }))
  );
  const payments = invoices.flatMap((invoice) =>
  (invoice.invoice_payments || []).map((payment) => ({ ...payment, invoice }))
  ).sort((a, b) => new Date(b.payment_date || b.created_at || 0) - new Date(a.payment_date || a.created_at || 0));

  return (
    <div
      data-dev-section="1"
      data-dev-section-key="customer-profile-payment-grid"
      data-dev-section-type="section-shell"
      data-dev-section-parent="customer-profile-tab-payment"
      data-dev-background-token="transparent"
      style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>

      <LayerSurface as="section"

      data-dev-section="1"
      data-dev-section-key="customer-profile-payment-methods"
      data-dev-section-type="section-shell"
      data-dev-section-parent="customer-profile-tab-payment"
      data-dev-background-token="surface"
      style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>

        <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-1)" }}>Payment method</h3>
        {!paymentMethods.length ?
        <p style={{ margin: 0, color: "var(--text-1)" }}>No saved payment methods.</p> :

        paymentMethods.map((method) =>
        <LayerSurface as="div"
        key={method.method_id}

        data-dev-section="1"
        data-dev-section-key={`customer-profile-payment-method-${method.method_id}`}
        data-dev-section-type="content-card"
        data-dev-section-parent="customer-profile-payment-methods"
        data-dev-background-token="accent-surface"
        style={{ padding: "12px", display: "flex", justifyContent: "space-between", gap: "12px" }}>

              <div>
                <strong style={{ color: "var(--text-1)" }}>{method.nickname || method.card_brand || "Card"}</strong>
                <p style={{ margin: "4px 0 0", color: "var(--text-1)", fontSize: "13px" }}>
                  {method.card_brand || "Card"} ending {method.last4} · Expires {method.expiry_month}/{method.expiry_year}
                </p>
              </div>
              {method.is_default && <span style={{ color: "var(--primary)", fontWeight: 700, fontSize: "12px" }}>Default</span>}
            </LayerSurface>
        )
        }
      </LayerSurface>

      <LayerSurface as="section"

      data-dev-section="1"
      data-dev-section-key="customer-profile-payment-previous"
      data-dev-section-type="section-shell"
      data-dev-section-parent="customer-profile-tab-payment"
      data-dev-background-token="surface"
      style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>

        <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-1)" }}>Previous payments made</h3>
        {!payments.length ?
        <p style={{ margin: 0, color: "var(--text-1)" }}>No captured payments found.</p> :

        payments.map((payment) =>
        <LayerSurface as="div"
        key={payment.payment_id}

        data-dev-section="1"
        data-dev-section-key={`customer-profile-payment-${payment.payment_id}`}
        data-dev-section-type="content-card"
        data-dev-section-parent="customer-profile-payment-previous"
        data-dev-background-token="accent-surface"
        style={{ padding: "12px", display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>

              <VehicleField label="Amount" value={formatCurrency(payment.amount)} />
              <VehicleField label="Method" value={payment.payment_method || payment.invoice.payment_method} />
              <VehicleField label="Invoice" value={payment.invoice.invoice_number || payment.invoice.jobNumber} />
              <VehicleField label="Date" value={formatDate(payment.payment_date || payment.created_at)} />
            </LayerSurface>
        )
        }
      </LayerSurface>
    </div>);

};

const isCustomerProfileMember = (member) => {
  const role = String(member?.profile?.role || member?.role || "").toLowerCase();
  return role === "customer";
};

const isStaffDirectoryEntry = (entry) => {
  const role = String(entry?.role || entry?.profile?.role || "").toLowerCase();
  return role !== "customer";
};

const CustomerMessagesTab = ({ customerName, customerEmail, dbUserId }) => {
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const composerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const title = `Customer · ${customerName || "Customer"}`;

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "42px";
    const nextHeight = Math.min(Math.max(composer.scrollHeight, 42), 132);
    composer.style.height = `${nextHeight}px`;
    composer.style.overflowY = composer.scrollHeight > 132 ? "auto" : "hidden";
  }, [draft]);

  useEffect(() => {
    if (!dbUserId) return;
    let cancelled = false;
    const loadThread = async () => {
      setLoading(true);
      setError("");
      try {
        const threadsPayload = await fetchMessageThreads({ userId: dbUserId });
        const threads = threadsPayload?.data || [];
        let match =
        threads.find((item) => item.title === title && (item.members || []).some(isCustomerProfileMember)) ||
        threads.find((item) => item.title === title);
        const hasCustomerMember = (match?.members || []).some(isCustomerProfileMember);

        if (!match || !hasCustomerMember) {
          const directoryPayload = await fetchMessageDirectory({ limit: 500 });
          const memberIds = (directoryPayload?.data || []).
          filter(isStaffDirectoryEntry).
          map((entry) => entry.id).
          filter((id) => Number(id) !== Number(dbUserId));

          if (customerEmail || customerName) {
            const connected = await connectCustomerToThread({
              threadId: match?.id,
              actorId: dbUserId,
              customerQuery: customerEmail || customerName,
              memberIds,
              title
            });
            match = connected?.thread || connected?.data || match;
          } else if (!match) {
            const created = await createThread({
              type: "group",
              createdBy: dbUserId,
              memberIds,
              title
            });
            match = created?.data;
          }
        }

        if (cancelled) return;
        setThread(match);
        if (match?.id) {
          const messagePayload = await fetchThreadMessages(match.id, { userId: dbUserId, limit: 100 });
          if (!cancelled) setMessages(messagePayload?.data || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load customer messages.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadThread();
    return () => {
      cancelled = true;
    };
  }, [customerEmail, customerName, dbUserId, title]);

  const handleSend = async () => {
    if (!thread?.id || !dbUserId || !draft.trim()) return;
    setSending(true);
    setError("");
    try {
      const payload = await sendThreadMessage(thread.id, {
        senderId: dbUserId,
        content: draft.trim(),
        metadata: { customerProfile: true, customerName }
      });
      setMessages((current) => [...current, payload?.data].filter(Boolean));
      setDraft("");
    } catch (err) {
      setError(err.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  if (!dbUserId) {
    return <div style={{ color: "var(--text-1)" }}>Sign in to use customer messages.</div>;
  }

  return (
    <>

      {loading && <p style={{ margin: 0, color: "var(--text-1)" }}>Loading messages...</p>}
      {error && <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>}
      <div
        data-dev-section="1"
        data-dev-section-key="customer-profile-messages-feed"
        data-dev-section-type="section-shell"
        data-dev-section-parent="customer-profile-tab-messages"
        data-dev-background-token="surface"
        style={{ minHeight: "260px", maxHeight: "420px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", borderRadius: "var(--radius-md)", background: "var(--surface)", padding: "12px" }}>

        {!loading && !messages.length && <p style={{ margin: 0, color: "var(--text-1)" }}>No messages yet.</p>}
        {messages.map((message) => {
          const mine = Number(message.senderId) === Number(dbUserId);
          return (
            <LayerSurface as="div"
            key={message.id}

            data-dev-section="1"
            data-dev-section-key={`customer-profile-message-${message.id}`}
            data-dev-section-type="content-card"
            data-dev-section-parent="customer-profile-messages-feed"
            data-dev-background-token={mine ? "customer-profile-message-own" : "surface"}
            style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "min(680px, 88%)", padding: "10px 12px" }}>

              <div style={{ fontSize: "12px", color: "var(--text-1)", marginBottom: "4px" }}>{mine ? "You" : message.sender?.name || "Team member"} · {formatDateTime(message.createdAt)}</div>
              <div style={{ color: "var(--text-1)", whiteSpace: "pre-wrap" }}>{message.content}</div>
            </LayerSurface>);

        })}
      </div>
      <div
        data-dev-section="1"
        data-dev-section-key="customer-profile-messages-composer"
        data-dev-section-type="toolbar"
        data-dev-section-parent="customer-profile-tab-messages"
        data-dev-background-token="surface"
        style={{ display: "flex", gap: "10px", alignItems: "flex-end", border: "none", boxShadow: "none", outline: "none", borderRadius: "var(--radius-md)", background: "var(--surface)", padding: "12px" }}>

        <textarea
          ref={composerRef}
          rows={1}
          className="app-input app-input--textarea"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message the customer..."
          style={{ flex: 1, height: "42px", minHeight: "42px", maxHeight: "132px", resize: "none", overflowY: "hidden", lineHeight: "20px", border: "none", boxShadow: "none" }} />

        <button type="button" className="app-btn app-btn--primary" onClick={handleSend} disabled={sending || !draft.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </>);

};

const CustomerNotesTab = ({ jobs, dbUserId }) => {
  const firstJobId = jobs[0]?.id || "";
  const [selectedJobId, setSelectedJobId] = useState(firstJobId);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [localJobs, setLocalJobs] = useState(jobs);

  useEffect(() => {
    setLocalJobs(jobs);
    setSelectedJobId((current) => current || jobs[0]?.id || "");
  }, [jobs]);

  const notes = localJobs.flatMap((job) =>
  (job.job_notes || []).map((note) => ({ ...note, jobNumber: job.job_number }))
  ).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const handleAdd = async () => {
    if (!selectedJobId || !text.trim()) return;
    setSaving(true);
    const result = await createJobNote({
      job_id: selectedJobId,
      user_id: dbUserId,
      note_text: text.trim(),
      hidden_from_customer: true
    });
    if (result.success) {
      setLocalJobs((current) => current.map((job) =>
      String(job.id) === String(selectedJobId) ?
      { ...job, job_notes: [result.data, ...(job.job_notes || [])] } :
      job
      ));
      setText("");
    }
    setSaving(false);
  };

  return (
    <div
      data-dev-section="1"
      data-dev-section-key="customer-profile-notes-stack"
      data-dev-section-type="section-shell"
      data-dev-section-parent="customer-profile-tab-notes"
      data-dev-background-token="transparent"
      style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

      {jobs.length > 0 &&
      <LayerSurface as="div"

      data-dev-section="1"
      data-dev-section-key="customer-profile-notes-add"
      data-dev-section-type="toolbar"
      data-dev-section-parent="customer-profile-tab-notes"
      data-dev-background-token="surface"
      style={{ padding: "14px", display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>

          <DropdownField
          value={selectedJobId}
          onChange={(event) => setSelectedJobId(event.target.value)}
          options={jobs.map((job) => ({ value: job.id, label: `Job ${job.job_number}` }))}
          placeholder="Select job"
          className="customer-profile-notes-job-dropdown" />

          <textarea className="app-input app-input--textarea" value={text} onChange={(event) => setText(event.target.value)} placeholder="Add a job note..." style={{ minHeight: "44px" }} />
          <button type="button" className="app-btn app-btn--primary" onClick={handleAdd} disabled={saving || !text.trim()}>
            {saving ? "Saving..." : "Add"}
          </button>
        </LayerSurface>
      }
      {!notes.length ?
      <LayerSurface as="div"

      data-dev-section="1"
      data-dev-section-key="customer-profile-notes-empty"
      data-dev-section-type="content-card"
      data-dev-section-parent="customer-profile-tab-notes"
      data-dev-background-token="surface"
      style={{ padding: "18px", color: "var(--text-1)" }}>

          No notes recorded across this customer's jobs.
        </LayerSurface> :

      notes.map((note) => {
        const author = note.user ? [note.user.first_name, note.user.last_name].filter(Boolean).join(" ").trim() : "";
        return (
          <LayerSurface as="article"
          key={note.note_id}

          data-dev-section="1"
          data-dev-section-key={`customer-profile-note-${note.note_id}`}
          data-dev-section-type="content-card"
          data-dev-section-parent="customer-profile-notes-stack"
          data-dev-background-token="surface"
          style={{ padding: "14px" }}>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
                <strong style={{ color: "var(--text-1)" }}>Job {note.jobNumber}</strong>
                <span style={{ color: "var(--text-1)", fontSize: "12px" }}>{author || "Unknown"} · {formatDateTime(note.created_at)}</span>
              </div>
              <p style={{ margin: 0, color: "var(--text-1)", whiteSpace: "pre-wrap" }}>{note.note_text}</p>
            </LayerSurface>);

      })
      }
    </div>);

};

// Accounts tab removed per latest requirements. The Activity tab below surfaces
// customer_activity_events so portal requests + self-service actions made on
// /website/profile are visible to staff on the same customer record.

const ACTIVITY_TYPE_LABELS = {
  vehicle_added: "Vehicle added",
  mileage_self_reported: "Mileage reading submitted",
  notification_prefs_updated: "Notification preferences updated",
  booking_request: "Service booking requested",
  message_customer: "Message sent from portal",
  payment_link_requested: "Payment link requested",
  statement_requested: "Statement requested",
  invoice_pdf_requested: "Invoice PDF requested",
  service_history_requested: "Service history pack requested",
  data_export_requested: "Data export requested",
  account_deletion_requested: "Account deletion requested",
  valuation_request: "Valuation requested",
  body_repair_request: "Body repair quote requested",
  smart_repair_request: "SMART repair quote requested",
  valet_request: "Valet requested",
  parts_enquiry: "Parts enquiry",
  vehicle_callback_request: "Callback requested",
  finance_quote_request: "Finance quote requested",
  test_drive_request: "Test drive requested",
  motability_enquiry: "Motability enquiry",
  warranty_claim: "Warranty claim",
  vehicle_add_request: "Vehicle add request",
  vhc_reauthorise_request: "VHC re-authorisation requested",
  referral: "Friend referral"
};

const ACTIVITY_SOURCE_LABELS = {
  customer_portal: "Customer portal",
  staff: "Staff"
};

// Requests staff still need to action (vs passive log entries) carry a badge so
// they don't get lost in the feed.
const ACTIONABLE_ACTIVITY_TYPES = new Set([
  "booking_request",
  "message_customer",
  "payment_link_requested",
  "statement_requested",
  "invoice_pdf_requested",
  "service_history_requested",
  "data_export_requested",
  "account_deletion_requested",
  "valuation_request",
  "body_repair_request",
  "smart_repair_request",
  "valet_request",
  "parts_enquiry",
  "vehicle_callback_request",
  "finance_quote_request",
  "test_drive_request",
  "motability_enquiry",
  "warranty_claim",
  "vehicle_add_request",
  "vhc_reauthorise_request",
  "referral"]
);

const formatActivityType = (type) =>
ACTIVITY_TYPE_LABELS[type] ||
String(type || "Activity").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const formatActivitySource = (source) =>
ACTIVITY_SOURCE_LABELS[source] || (source ? String(source).replace(/_/g, " ") : "System");

const summarizeActivityPayload = (payload) => {
  if (!payload || typeof payload !== "object") return [];
  return Object.entries(payload).
  filter(
    ([key, value]) =>
    value !== null &&
    value !== undefined &&
    value !== "" &&
    key !== "job_id" &&
    key !== "vehicle_id"
  ).
  map(([key, value]) => ({
    label: key.replace(/_/g, " "),
    value:
    typeof value === "boolean" ?
    value ? "Yes" : "No" :
    typeof value === "object" ?
    JSON.stringify(value) :
    String(value)
  }));
};

const ActivityTab = ({ events, vehicles }) => {
  const regByVehicleId = useMemo(() => {
    const map = new Map();
    (vehicles || []).forEach((vehicle) => {
      if (vehicle?.vehicle_id != null) {
        map.set(String(vehicle.vehicle_id), getVehicleRegistration(vehicle, ""));
      }
    });
    return map;
  }, [vehicles]);

  if (!events?.length) {
    return (
      <LayerSurface as="div"

      data-dev-section="1"
      data-dev-section-key="customer-profile-activity-empty"
      data-dev-section-type="content-card"
      data-dev-section-parent="customer-profile-tab-activity"
      data-dev-background-token="accent-surface"
      style={{ padding: "24px", textAlign: "center", color: "var(--grey-accent)" }}>

        No portal activity or requests recorded for this customer yet.
      </LayerSurface>);

  }

  return (
    <div
      data-dev-section="1"
      data-dev-section-key="customer-profile-activity-list"
      data-dev-section-type="section-shell"
      data-dev-section-parent="customer-profile-tab-activity"
      data-dev-background-token="transparent"
      style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {events.map((event) => {
        const fields = summarizeActivityPayload(event.activity_payload);
        const reg = event.vehicle_id != null ? regByVehicleId.get(String(event.vehicle_id)) : "";
        const actionable = ACTIONABLE_ACTIVITY_TYPES.has(event.activity_type);
        return (
          <LayerSurface as="article"
          key={event.event_id}

          data-dev-section="1"
          data-dev-section-key={`customer-profile-activity-${event.event_id}`}
          data-dev-section-type="content-card"
          data-dev-section-parent="customer-profile-activity-list"
          data-dev-background-token="surface"
          style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <strong style={{ color: "var(--text-1)", fontSize: "0.98rem" }}>
                  {formatActivityType(event.activity_type)}
                </strong>
                {actionable &&
                <span style={{ borderRadius: "var(--radius-pill)", padding: "2px 10px", background: "var(--surface)", color: "var(--accentText)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Action needed
                  </span>
                }
              </div>
              <span style={{ fontSize: "12px", color: "var(--grey-accent)" }}>
                {formatActivitySource(event.activity_source)} · {formatDateTime(event.occurred_at)}
              </span>
            </div>
            {reg &&
            <span style={{ fontSize: "13px", color: "var(--info-dark)", fontWeight: 600 }}>{reg}</span>
            }
            {fields.length > 0 &&
            <div style={{ display: "grid", gap: "8px 16px", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                {fields.map((field) =>
              <div key={field.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--grey-accent)" }}>{field.label}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-1)", overflowWrap: "anywhere" }}>{field.value}</span>
                  </div>
              )}
              </div>
            }
          </LayerSurface>);

      })}
    </div>);

};

const getSlugParam = (rawSlug) => {
  if (!rawSlug) return "";
  if (Array.isArray(rawSlug)) return rawSlug[0] || "";
  return rawSlug;
};

const getTabParam = (rawTab) => {
  if (!rawTab) return "";
  if (Array.isArray(rawTab)) return rawTab[0] || "";
  return rawTab;
};

export default function CustomerDetailWorkspace() {
  const router = useRouter();
  const { dbUserId } = useUser();
  const slugFromRoute = getSlugParam(router.query.customerSlug);
  const tabFromRoute = getTabParam(router.query.tab);
  const [customer, setCustomer] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [activityEvents, setActivityEvents] = useState([]);
  const [activeTab, setActiveTab] = useState(TAB_DEFINITIONS[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingPreference, setSavingPreference] = useState("");

  useEffect(() => {
    if (!tabFromRoute) return;
    if (!TAB_DEFINITIONS.some((tab) => tab.id === tabFromRoute)) return;
    setActiveTab(tabFromRoute);
  }, [tabFromRoute]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!slugFromRoute) {
      setError("Customer not found.");
      setIsLoading(false);
      return;
    }

    const fetchCustomer = async () => {
      setIsLoading(true);
      setError("");
      try {
        let customerRecord = await getCustomerBySlug(slugFromRoute);

        if (!customerRecord && isValidUuid(slugFromRoute)) {
          customerRecord = await getCustomerById(slugFromRoute);
        }

        if (!customerRecord) {
          setCustomer(null);
          setVehicles([]);
          setJobs([]);
          setActivityEvents([]);
          setError("Customer record was not found.");
          return;
        }

        const [vehiclesForCustomer, jobsForCustomer, methodsForCustomer, activityForCustomer] = await Promise.all([
        getCustomerVehicles(customerRecord.id),
        getCustomerJobs(customerRecord.id),
        getCustomerPaymentMethods(customerRecord.id),
        getCustomerActivityEvents(customerRecord.id)]
        );

        setCustomer(customerRecord);
        setVehicles(vehiclesForCustomer || []);
        setJobs(jobsForCustomer || []);
        setPaymentMethods(methodsForCustomer || []);
        setActivityEvents(activityForCustomer || []);
      } catch (err) {
        console.error("Failed to load customer detail view:", err);
        setError("Unable to load customer data right now.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomer();
  }, [router.isReady, slugFromRoute]);

  useEffect(() => {
    if (isPresentationMode()) return;
    if (!router.isReady || !customer) return;
    const preferredSlug = createCustomerDisplaySlug(customer.firstname, customer.lastname);
    if (!preferredSlug) return;
    const desiredKey = normalizeCustomerSlug(preferredSlug);
    const currentKey = normalizeCustomerSlug(slugFromRoute);
    if (desiredKey && desiredKey !== currentKey) {
      router.replace(`/customers/${preferredSlug}`, undefined, { shallow: true });
    }
  }, [router, customer, slugFromRoute]);

  const customerName = [customer?.firstname, customer?.lastname].filter(Boolean).join(" ").trim();
  const contactNumbers = [
  { label: "Mob:", value: customer?.mobile },
  { label: "Tel:", value: customer?.telephone }].
  filter((entry) => entry.value);
  const formattedAddress = buildAddressDisplay(customer?.address, customer?.postcode);

  const { totalJobs, activeJobs } = useMemo(() => {
    const total = jobs.length;
    const active = jobs.filter(
      (job) => job?.status && !isInactiveJobStatus(job.status)
    ).length;
    return { totalJobs: total, activeJobs: active };
  }, [jobs]);

  // Normalise the stored contact_preference through the shared vocabulary so a
  // value set on the /website portal (email/phone/sms/post) maps onto the staff
  // toggles (email/mobile/telephone/sms/post) and stays in sync both ways.
  const contactPref = normalizeContactPreference(customer?.contact_preference);

  const profileGridItems = useMemo(
    () => {
      // contact_preference is a single mutually-exclusive value; each toggle sets
      // (or clears) it. One factory keeps all five channels consistent.
      const makeContactPreference = (value, label) => ({
        label,
        checked: contactPref === value,
        disabled: savingPreference === value,
        onChange: async (checked) => {
          if (!customer?.id) return;
          setSavingPreference(value);
          const result = await updateCustomer(customer.id, {
            contact_preference: checked ? value : null
          });
          if (result.success) setCustomer(result.data);
          setSavingPreference("");
        }
      });

      return [
      {
        key: "email",
        label: "Email",
        value: customer?.email,
        href: customer?.email ? `mailto:${customer.email}` : undefined,
        preference: makeContactPreference("email", "Email contacting")
      },
      {
        key: "contact-number",
        label: "Contact numbers",
        type: "list",
        items: contactNumbers,
        preferences: [
        makeContactPreference("mobile", "Mobile"),
        makeContactPreference("telephone", "Telephone"),
        makeContactPreference("sms", "SMS")]

      },
      {
        key: "address",
        label: "Address",
        value: formattedAddress || customer?.address || "",
        ...buildMapLink(formattedAddress || customer?.address),
        preference: makeContactPreference("post", "Post")
      },
      {
        key: "summary",
        label: "Customer file",
        type: "stats",
        stats: [
        { label: "Vehicles", value: vehicles.length },
        { label: "Total jobs", value: totalJobs },
        { label: "Open jobs", value: activeJobs }]

      }];
    },

    [customer?.email, customer?.id, customer?.address, contactPref, contactNumbers, formattedAddress, vehicles.length, totalJobs, activeJobs, savingPreference]
  );

  const renderTabContent = () => {
    if (activeTab === "insights") {
      return (
        <InsightsTab
          vehicles={vehicles}
          jobs={jobs}
          customerId={customer?.id}
          onVehicleAdded={async () => {
            if (!customer?.id) return;
            const refreshed = await getCustomerVehicles(customer.id);
            setVehicles(refreshed || []);
          }} />);


    }
    if (activeTab === "history") {
      return <HistoryTab jobs={jobs} />;
    }
    if (activeTab === "payment") {
      return <PaymentTab paymentMethods={paymentMethods} jobs={jobs} />;
    }
    if (activeTab === "activity") {
      return <ActivityTab events={activityEvents} vehicles={vehicles} />;
    }
    if (activeTab === "messages") {
      return <CustomerMessagesTab customerName={customerName} customerEmail={customer?.email} dbUserId={dbUserId} />;
    }
    return null;
  };

  return <CustomerDetailWorkspaceUi view="section1" ContactPreferenceToggle={ContactPreferenceToggle} PageSkeleton={PageSkeleton} activeTab={activeTab} activityEvents={activityEvents} customer={customer} customerName={customerName} detailCardStyles={detailCardStyles} detailGridStyles={detailGridStyles} error={error} isLoading={isLoading} jobs={jobs} profileGridItems={profileGridItems} renderTabContent={renderTabContent} setActiveTab={setActiveTab} TAB_DEFINITIONS={TAB_DEFINITIONS} TabGroup={TabGroup} tabPanelStyles={tabPanelStyles} vehicles={vehicles} />;



































































































































}
