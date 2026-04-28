// file location: src/pages/customers/[customerSlug].js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { isInactiveJobStatus } from "@/lib/status/statusHelpers";
import {
  getCustomerById,
  getCustomerBySlug,
  getCustomerPaymentMethods,
  getCustomerVehicles,
  getCustomerJobs,
  updateCustomer } from
"@/lib/database/customers";
import { createCustomerDisplaySlug, normalizeCustomerSlug } from "@/lib/customers/slug";
import { isValidUuid } from "@/lib/utils/ids";
import { createOrUpdateVehicle } from "@/lib/database/vehicles";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { prefetchJob } from "@/lib/swr/prefetch";
import { getVehicleRegistration, pickMileageValue } from "@/lib/canonical/fields";
import { useUser } from "@/context/UserContext";
import {
  createThread,
  fetchMessageDirectory,
  fetchMessageThreads,
  fetchThreadMessages,
  sendThreadMessage
} from "@/lib/api/messages";
import { createJobNote } from "@/lib/database/notes";
import CustomerDetailWorkspaceUi from "@/components/page-ui/customers/customers-customer-slug-ui"; // Extracted presentation layer.

const TAB_DEFINITIONS = [
{ id: "insights", label: "Insights" },
{ id: "history", label: "History" },
{ id: "payment", label: "Payment" },
{ id: "messages", label: "Messages" },
{ id: "notes", label: "Notes" }];


/** @see statusHelpers.isInactiveJobStatus — replaces inline Set */

const detailCardStyles = {
  container: {
    borderRadius: "var(--radius-md)",
    border: "none",
    background: "var(--layer-section-level-1)",
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
    color: "var(--text-primary)",
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
    color: "var(--text-primary)"
  }
};


const tabPanelStyles = {
  container: {
    borderRadius: "var(--radius-md)",
    border: "none",
    background: "var(--surface)",
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
    color: "var(--text-secondary)"
  },
  value: {
    fontWeight: 600,
    color: "var(--text-primary)",
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
  return rawAddress.toLowerCase().includes(rawPostcode.toLowerCase())
    ? rawAddress
    : `${rawAddress}, ${rawPostcode}`;
};

const ContactPreferenceToggle = ({ label, checked, disabled, onChange }) => (
  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: disabled ? "not-allowed" : "pointer" }}>
    <input
      type="checkbox"
      checked={Boolean(checked)}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.checked)}
      style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
    />
    <span style={{ fontSize: "13px", color: disabled ? "var(--text-secondary)" : "var(--text-primary)", fontWeight: 600 }}>
      {label}
    </span>
  </label>
);

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
    color: "var(--text-primary)",
    fontSize: "13px"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Add Vehicle controls */}
      {!showForm ?
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
          onClick={() => setShowForm(true)}
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius-xs)",
            border: "none",
            backgroundColor: "var(--primary)",
            color: "var(--text-inverse)",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer"
          }}>
          
            Add Vehicle
          </button>
        </div> :

      <div
        style={{
          borderRadius: "var(--radius-md)",
          border: "none",
          background: "var(--layer-section-level-1)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px"
        }}>
        
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <input
            type="text"
            value={newReg}
            onChange={(e) => {setNewReg(e.target.value);setFormMessage("");setDvlaData(null);}}
            placeholder="Enter registration"
            autoFocus
            disabled={looking || saving}
            onKeyDown={(e) => {if (e.key === "Enter") handleLookup();}}
            style={{
              padding: "8px 12px",
              borderRadius: "var(--radius-xs)",
              border: "none",
              fontSize: "13px",
              backgroundColor: "var(--surface)",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              width: "180px"
            }} />
          
            <button
            onClick={handleLookup}
            disabled={looking || saving || !newReg.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-xs)",
              border: "none",
              backgroundColor: "var(--surface)",
              color: looking || !newReg.trim() ? "var(--grey-accent)" : "var(--text-primary)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: looking || saving || !newReg.trim() ? "not-allowed" : "pointer"
            }}>
            
              {looking ? "Looking up..." : "Lookup"}
            </button>
            <button
            onClick={resetForm}
            disabled={saving}
            style={{
              padding: "8px 12px",
              borderRadius: "var(--radius-xs)",
              border: "none",
              backgroundColor: "var(--surface)",
              color: "var(--grey-accent-dark)",
              fontSize: "13px",
              fontWeight: "500",
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
        <div
          style={{
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "var(--surface)",
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
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
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
            </div>
        }

          {/* Save / Save without DVLA */}
          {(dvlaData || newReg.trim()) &&
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
            onClick={handleSave}
            disabled={saving || !newReg.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-xs)",
              border: "none",
              backgroundColor: saving || !newReg.trim() ? "var(--grey-accent)" : "var(--primary)",
              color: "var(--text-inverse)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: saving || !newReg.trim() ? "not-allowed" : "pointer"
            }}>
            
                {saving ? "Saving..." : dvlaData ? "Save Vehicle" : "Save Without Lookup"}
              </button>
              {formMessage && dvlaData &&
          <span style={{ fontSize: "12px", color: "var(--danger)" }}>{formMessage}</span>
          }
            </div>
        }
        </div>
      }

      {!vehicles.length ?
      <div
        style={{
          border: "1px dashed var(--surface-light)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          textAlign: "center",
          color: "var(--grey-accent)"
        }}>
        
          No vehicles linked to this customer yet.
        </div> :

      <div
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))"
        }}>
        
          {vehicles.map((vehicle) => {
          const registration = getVehicleRegistration(vehicle, "Unregistered");
          const makeModel =
          vehicle.make_model ||
          [vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
          "Vehicle";

          return (
            <div
              key={vehicle.vehicle_id}
              style={{
                borderRadius: "var(--radius-lg)",
                border: "none",
                background: "var(--layer-section-level-1)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
              
                <div>
                  <p
                  style={{
                    fontSize: "0.75rem",
                    letterSpacing: "0.25em",
                    textTransform: "uppercase",
                    color: "var(--grey-accent)",
                    marginBottom: "4px"
                  }}>
                  
                    Registration
                  </p>
                  <p
                  style={{
                    margin: 0,
                    fontSize: "1.3rem",
                    fontWeight: 700,
                    color: "var(--info-dark)"
                  }}>
                  
                    {registration}
                  </p>
                </div>

                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)" }}>
                    {makeModel}
                  </p>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    {vehicle.year ? `Year ${vehicle.year}` : "Year unknown"}
                  </p>
                </div>

                <div
                style={{
                  display: "grid",
                  gap: "12px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))"
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
              </div>);

        })}
        </div>
      }
    </div>);

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
    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value || "—"}</span>
  </div>;


const CustomerDocumentsSection = ({ jobs }) => {
  const files = jobs.flatMap((job) =>
    (job.job_files || []).map((file) => ({ ...file, jobNumber: job.job_number }))
  );

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1rem" }}>Documents, photos and videos</h3>
      {!files.length ? (
        <div style={{ borderRadius: "var(--radius-md)", background: "var(--layer-section-level-1)", padding: "18px", color: "var(--text-secondary)" }}>
          No uploaded files across this customer's jobs yet.
        </div>
      ) : (
        <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(220px, 260px)", gap: "12px", overflowX: "auto", paddingBottom: "4px" }}>
          {files.map((file) => {
            const type = String(file.file_type || "").toLowerCase();
            const isImage = type.startsWith("image/");
            const isVideo = type.startsWith("video/");
            return (
              <a key={`${file.jobNumber}-${file.file_id}`} href={file.file_url} target="_blank" rel="noreferrer" style={{ borderRadius: "var(--radius-md)", background: "var(--layer-section-level-1)", padding: "12px", minHeight: "160px", textDecoration: "none", color: "var(--text-primary)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ height: "86px", borderRadius: "var(--radius-sm)", background: "var(--surface)", overflow: "hidden", display: "grid", placeItems: "center" }}>
                  {isImage ? (
                    <img src={file.file_url} alt={file.file_name || "Uploaded file"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : isVideo ? (
                    <video src={file.file_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                  ) : (
                    <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>File</span>
                  )}
                </div>
                <strong style={{ fontSize: "13px", overflowWrap: "anywhere" }}>{file.file_name || "Uploaded file"}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Job {file.jobNumber} · {formatDate(file.uploaded_at)}</span>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
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
    <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1rem" }}>Schedule</h3>
      {!appointments.length ? (
        <div style={{ borderRadius: "var(--radius-md)", background: "var(--layer-section-level-1)", padding: "18px", color: "var(--text-secondary)" }}>
          No appointments recorded for this customer.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {appointments.map((appointment) => (
            <div key={appointment.appointment_id} style={{ borderRadius: "var(--radius-md)", background: "var(--layer-section-level-1)", padding: "14px", display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
              <VehicleField label="When" value={formatDateTime(appointment.scheduled_time)} />
              <VehicleField label="Status" value={appointment.status || "Booked"} />
              <VehicleField label="Vehicle" value={appointment.vehicle} />
              <VehicleField label="Notes" value={appointment.notes} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const InsightsTab = ({ vehicles, jobs, customerId, onVehicleAdded }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
    <VehiclesSection vehicles={vehicles} customerId={customerId} onVehicleAdded={onVehicleAdded} />
    <CustomerDocumentsSection jobs={jobs} />
    <CustomerScheduleSection jobs={jobs} />
  </div>
);

const HistoryTab = ({ jobs }) => {
  if (!jobs.length) {
    return (
      <div
        style={{
          border: "1px dashed var(--surface-light)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          textAlign: "center",
          color: "var(--grey-accent)"
        }}>
        
        No job history recorded yet.
      </div>);

  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {jobs.map((job) => {
        const requestSummary = deriveRequestSummary(parseRequests(job.requests));
        return (
          <div
            key={job.id}
            style={{
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "var(--layer-section-level-1)",
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
                  border: "1px solid var(--surface)",
                  background: "var(--surface)",
                  color: "var(--primary-dark)",
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
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>{requestSummary}</p>
            }

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link
                href={`/job-cards/${encodeURIComponent(job.job_number)}`}
                onMouseEnter={() => prefetchJob(job.job_number)} // warm SWR cache on hover
                style={{
                  borderRadius: "var(--radius-pill)",
                  padding: "10px 18px",
                  background: "var(--primary)",
                  color: "var(--text-inverse)",
                  fontWeight: 600,
                  textDecoration: "none"
                }}>
                
                View job card
              </Link>
              {job.vehicle_reg &&
              <span
                style={{
                  borderRadius: "var(--radius-pill)",
                  padding: "10px 18px",
                  border: "1px solid var(--surface)",
                  color: "var(--text-secondary)"
                }}>
                
                  Reg: {job.vehicle_reg}
                </span>
              }
            </div>
          </div>);

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
    <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      <section style={{ borderRadius: "var(--radius-md)", background: "var(--layer-section-level-1)", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)" }}>Payment method</h3>
        {!paymentMethods.length ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>No saved payment methods.</p>
        ) : (
          paymentMethods.map((method) => (
            <div key={method.method_id} style={{ borderRadius: "var(--radius-sm)", background: "var(--surface)", padding: "12px", display: "flex", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <strong style={{ color: "var(--text-primary)" }}>{method.nickname || method.card_brand || "Card"}</strong>
                <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "13px" }}>
                  {method.card_brand || "Card"} ending {method.last4} · Expires {method.expiry_month}/{method.expiry_year}
                </p>
              </div>
              {method.is_default && <span style={{ color: "var(--primary)", fontWeight: 700, fontSize: "12px" }}>Default</span>}
            </div>
          ))
        )}
      </section>

      <section style={{ borderRadius: "var(--radius-md)", background: "var(--layer-section-level-1)", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)" }}>Previous payments made</h3>
        {!payments.length ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>No captured payments found.</p>
        ) : (
          payments.map((payment) => (
            <div key={payment.payment_id} style={{ borderRadius: "var(--radius-sm)", background: "var(--surface)", padding: "12px", display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
              <VehicleField label="Amount" value={formatCurrency(payment.amount)} />
              <VehicleField label="Method" value={payment.payment_method || payment.invoice.payment_method} />
              <VehicleField label="Invoice" value={payment.invoice.invoice_number || payment.invoice.jobNumber} />
              <VehicleField label="Date" value={formatDate(payment.payment_date || payment.created_at)} />
            </div>
          ))
        )}
      </section>
    </div>
  );
};

const CustomerMessagesTab = ({ customerName, dbUserId }) => {
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const title = `Customer · ${customerName || "Customer"}`;

  useEffect(() => {
    if (!dbUserId) return;
    let cancelled = false;
    const loadThread = async () => {
      setLoading(true);
      setError("");
      try {
        const threadsPayload = await fetchMessageThreads({ userId: dbUserId });
        const threads = threadsPayload?.data || [];
        let match = threads.find((item) => item.title === title);

        if (!match) {
          const directoryPayload = await fetchMessageDirectory({ limit: 100 });
          const memberIds = (directoryPayload?.data || [])
            .map((entry) => entry.id)
            .filter((id) => Number(id) !== Number(dbUserId));
          const created = await createThread({
            type: "group",
            createdBy: dbUserId,
            memberIds,
            title
          });
          match = created?.data;
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
  }, [dbUserId, title]);

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
    return <div style={{ color: "var(--text-secondary)" }}>Sign in to use customer messages.</div>;
  }

  return (
    <div style={{ borderRadius: "var(--radius-md)", background: "var(--layer-section-level-1)", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
      {loading && <p style={{ margin: 0, color: "var(--text-secondary)" }}>Loading messages...</p>}
      {error && <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>}
      <div style={{ minHeight: "260px", maxHeight: "420px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
        {!loading && !messages.length && <p style={{ margin: 0, color: "var(--text-secondary)" }}>No messages yet.</p>}
        {messages.map((message) => {
          const mine = Number(message.senderId) === Number(dbUserId);
          return (
            <div key={message.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "min(680px, 88%)", borderRadius: "var(--radius-md)", background: mine ? "rgba(var(--primary-rgb), 0.14)" : "var(--surface)", padding: "10px 12px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>{mine ? "You" : message.sender?.name || "Team member"} · {formatDateTime(message.createdAt)}</div>
              <div style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{message.content}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Message the company..." style={{ flex: 1, minHeight: "46px", maxHeight: "140px", resize: "vertical", border: "none", borderRadius: "var(--radius-sm)", background: "var(--surface)", color: "var(--text-primary)", padding: "12px" }} />
        <button type="button" onClick={handleSend} disabled={sending || !draft.trim()} style={{ border: "none", borderRadius: "var(--radius-sm)", background: "var(--primary)", color: "var(--text-inverse)", padding: "12px 18px", fontWeight: 700, opacity: sending || !draft.trim() ? 0.6 : 1 }}>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
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
        String(job.id) === String(selectedJobId)
          ? { ...job, job_notes: [result.data, ...(job.job_notes || [])] }
          : job
      ));
      setText("");
    }
    setSaving(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {jobs.length > 0 && (
        <div style={{ borderRadius: "var(--radius-md)", background: "var(--layer-section-level-1)", padding: "14px", display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} style={{ border: "none", borderRadius: "var(--radius-sm)", background: "var(--surface)", color: "var(--text-primary)", padding: "10px" }}>
            {jobs.map((job) => <option key={job.id} value={job.id}>Job {job.job_number}</option>)}
          </select>
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Add a job note..." style={{ minHeight: "44px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--surface)", color: "var(--text-primary)", padding: "10px" }} />
          <button type="button" onClick={handleAdd} disabled={saving || !text.trim()} style={{ border: "none", borderRadius: "var(--radius-sm)", background: "var(--primary)", color: "var(--text-inverse)", padding: "10px 16px", fontWeight: 700, opacity: saving || !text.trim() ? 0.6 : 1 }}>
            {saving ? "Saving..." : "Add"}
          </button>
        </div>
      )}
      {!notes.length ? (
        <div style={{ borderRadius: "var(--radius-md)", background: "var(--layer-section-level-1)", padding: "18px", color: "var(--text-secondary)" }}>No notes recorded across this customer's jobs.</div>
      ) : (
        notes.map((note) => {
          const author = note.user ? [note.user.first_name, note.user.last_name].filter(Boolean).join(" ").trim() : "";
          return (
            <article key={note.note_id} style={{ borderRadius: "var(--radius-md)", background: "var(--layer-section-level-1)", padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
                <strong style={{ color: "var(--text-primary)" }}>Job {note.jobNumber}</strong>
                <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{author || "Unknown"} · {formatDateTime(note.created_at)}</span>
              </div>
              <p style={{ margin: 0, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{note.note_text}</p>
            </article>
          );
        })
      )}
    </div>
  );
};

// Activity and Accounts tabs removed per latest requirements.

const getSlugParam = (rawSlug) => {
  if (!rawSlug) return "";
  if (Array.isArray(rawSlug)) return rawSlug[0] || "";
  return rawSlug;
};

export default function CustomerDetailWorkspace() {
  const router = useRouter();
  const { dbUserId } = useUser();
  const slugFromRoute = getSlugParam(router.query.customerSlug);
  const [customer, setCustomer] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [activeTab, setActiveTab] = useState(TAB_DEFINITIONS[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingPreference, setSavingPreference] = useState("");

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
          setError("Customer record was not found.");
          return;
        }

        const [vehiclesForCustomer, jobsForCustomer, methodsForCustomer] = await Promise.all([
        getCustomerVehicles(customerRecord.id),
        getCustomerJobs(customerRecord.id),
        getCustomerPaymentMethods(customerRecord.id)]
        );

        setCustomer(customerRecord);
        setVehicles(vehiclesForCustomer || []);
        setJobs(jobsForCustomer || []);
        setPaymentMethods(methodsForCustomer || []);
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
  { label: "Mobile", value: customer?.mobile },
  { label: "Telephone", value: customer?.telephone }].
  filter((entry) => entry.value);
  const formattedAddress = buildAddressDisplay(customer?.address, customer?.postcode);

  const { totalJobs, activeJobs } = useMemo(() => {
    const total = jobs.length;
    const active = jobs.filter(
      (job) => job?.status && !isInactiveJobStatus(job.status)
    ).length;
    return { totalJobs: total, activeJobs: active };
  }, [jobs]);

  const profileGridItems = useMemo(
    () => [
    {
      key: "email",
      label: "Email",
      value: customer?.email,
      href: customer?.email ? `mailto:${customer.email}` : undefined,
      preference: {
        label: "Email contacting",
        checked: customer?.contact_preference === "email",
        disabled: savingPreference === "email",
        onChange: async (checked) => {
          if (!customer?.id) return;
          const nextPreference = checked ? "email" : "";
          setSavingPreference("email");
          const result = await updateCustomer(customer.id, { contact_preference: nextPreference || null });
          if (result.success) {
            setCustomer(result.data);
          }
          setSavingPreference("");
        }
      }
    },
    {
      key: "contact-number",
      label: "Contact numbers",
      type: "list",
      items: contactNumbers,
      preferences: [
        {
          label: "Mobile",
          checked: customer?.contact_preference === "mobile",
          disabled: savingPreference === "mobile",
          onChange: async (checked) => {
            if (!customer?.id) return;
            setSavingPreference("mobile");
            const result = await updateCustomer(customer.id, { contact_preference: checked ? "mobile" : null });
            if (result.success) setCustomer(result.data);
            setSavingPreference("");
          }
        },
        {
          label: "Telephone",
          checked: customer?.contact_preference === "telephone",
          disabled: savingPreference === "telephone",
          onChange: async (checked) => {
            if (!customer?.id) return;
            setSavingPreference("telephone");
            const result = await updateCustomer(customer.id, { contact_preference: checked ? "telephone" : null });
            if (result.success) setCustomer(result.data);
            setSavingPreference("");
          }
        }
      ]
    },
    {
      key: "address",
      label: "Address",
      value: formattedAddress || customer?.address || ""
    },
    {
      key: "summary",
      label: "Customer file",
      type: "stats",
      stats: [
        { label: "Vehicles on file", value: vehicles.length },
        { label: "Total jobs", value: totalJobs },
        { label: "Open jobs", value: activeJobs }
      ]
    }],

    [customer?.email, customer?.id, customer?.contact_preference, contactNumbers, formattedAddress, vehicles.length, totalJobs, activeJobs, savingPreference]
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
    if (activeTab === "messages") {
      return <CustomerMessagesTab customerName={customerName} dbUserId={dbUserId} />;
    }
    if (activeTab === "notes") {
      return <CustomerNotesTab jobs={jobs} dbUserId={dbUserId} />;
    }
    return null;
  };

  return <CustomerDetailWorkspaceUi view="section1" ContactPreferenceToggle={ContactPreferenceToggle} PageSkeleton={PageSkeleton} activeTab={activeTab} customer={customer} customerName={customerName} detailCardStyles={detailCardStyles} detailGridStyles={detailGridStyles} error={error} isLoading={isLoading} jobs={jobs} profileGridItems={profileGridItems} renderTabContent={renderTabContent} setActiveTab={setActiveTab} TAB_DEFINITIONS={TAB_DEFINITIONS} TabGroup={TabGroup} tabPanelStyles={tabPanelStyles} vehicles={vehicles} />;



































































































































}
