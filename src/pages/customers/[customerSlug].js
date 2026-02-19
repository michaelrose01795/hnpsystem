// file location: src/pages/customers/[customerSlug].js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import {
  getCustomerById,
  getCustomerBySlug,
  getCustomerVehicles,
  getCustomerJobs,
} from "@/lib/database/customers";
import { createCustomerDisplaySlug, normalizeCustomerSlug } from "@/lib/customers/slug";
import { isValidUuid } from "@/lib/utils/ids";
import { createOrUpdateVehicle } from "@/lib/database/vehicles";

const TAB_DEFINITIONS = [
  { id: "vehicles", label: "Vehicles" },
  { id: "history", label: "History" },
];

const INACTIVE_JOB_STATUSES = new Set(["complete", "collected", "cancelled", "invoiced"]);

const detailCardStyles = {
  container: {
    borderRadius: "24px",
    border: "1px solid var(--surface-light)",
    background: "var(--surface)",
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    boxShadow: "none",
  },
  identityBlock: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    alignItems: "flex-start",
  },
  name: {
    fontSize: "1.65rem",
    fontWeight: 700,
    margin: 0,
    color: "var(--text-primary)",
    wordBreak: "break-word",
  },
  metaItem: {
    borderRadius: "16px",
    border: "1px solid var(--surface-light)",
    background: "var(--surface-light)",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minHeight: "110px",
  },
  metaLabel: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "0.65rem",
    color: "var(--grey-accent-dark)",
  },
  metaValue: {
    fontWeight: 600,
    color: "var(--text-primary)",
  },
};

const tabsStyles = {
  container: {
    borderRadius: "999px",
    border: "1px solid var(--surface-light)",
    background: "var(--surface)",
    padding: "6px",
    display: "flex",
    gap: "6px",
    width: "100%",
    overflowX: "auto",
  },
  pill: (active) => ({
    flex: "0 0 auto",
    borderRadius: "999px",
    border: "1px solid transparent",
    padding: "10px 20px",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    background: active ? "var(--primary)" : "transparent",
    color: active ? "var(--text-inverse)" : "var(--text-primary)",
    transition: "all 0.15s ease",
  }),
};

const tabPanelStyles = {
  container: {
    borderRadius: "24px",
    border: "1px solid var(--surface-light)",
    background: "var(--surface)",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
};

const detailGridStyles = {
  grid: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
  item: {
    borderRadius: "16px",
    border: "1px solid var(--surface-light)",
    background: "var(--surface-light)",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minHeight: "110px",
  },
  label: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "0.65rem",
    color: "var(--text-secondary)",
  },
  value: {
    fontWeight: 600,
    color: "var(--text-primary)",
    wordBreak: "break-word",
  },
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
      day: "numeric",
    });
  } catch (_err) {
    return "—";
  }
};

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
  const parts = requests
    .map((request) => {
      if (!request) return null;
      if (typeof request === "string") return request;
      if (request?.title) return request.title;
      if (request?.description) return request.description;
      return null;
    })
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return null;
  return parts.join(" • ");
};

const VehiclesTab = ({ vehicles, customerId, onVehicleAdded }) => {
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
        body: JSON.stringify({ registration: trimmed }),
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
      customer_id: customerId,
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
    color: "var(--grey-accent)",
  };
  const previewValueStyle = {
    fontWeight: 600,
    color: "var(--text-primary)",
    fontSize: "13px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Add Vehicle controls */}
      {!showForm ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "var(--primary)",
              color: "var(--text-inverse)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Add Vehicle
          </button>
        </div>
      ) : (
        <div
          style={{
            borderRadius: "16px",
            border: "1px solid var(--surface-light)",
            background: "var(--surface-light)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <input
              type="text"
              value={newReg}
              onChange={(e) => { setNewReg(e.target.value); setFormMessage(""); setDvlaData(null); }}
              placeholder="Enter registration"
              autoFocus
              disabled={looking || saving}
              onKeyDown={(e) => { if (e.key === "Enter") handleLookup(); }}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(var(--grey-accent-rgb), 0.45)",
                fontSize: "13px",
                backgroundColor: "var(--surface)",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                width: "180px",
              }}
            />
            <button
              onClick={handleLookup}
              disabled={looking || saving || !newReg.trim()}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
                backgroundColor: "var(--surface)",
                color: looking || !newReg.trim() ? "var(--grey-accent)" : "var(--text-primary)",
                fontSize: "13px",
                fontWeight: "600",
                cursor: looking || saving || !newReg.trim() ? "not-allowed" : "pointer",
              }}
            >
              {looking ? "Looking up..." : "Lookup"}
            </button>
            <button
              onClick={resetForm}
              disabled={saving}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
                backgroundColor: "var(--surface)",
                color: "var(--grey-accent-dark)",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>

          {formMessage && !dvlaData && (
            <span style={{ fontSize: "12px", color: "var(--warning-dark)" }}>{formMessage}</span>
          )}

          {/* DVLA preview */}
          {dvlaData && (
            <div
              style={{
                borderRadius: "12px",
                border: "1px solid var(--surface-light)",
                background: "var(--surface)",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
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
          )}

          {/* Save / Save without DVLA */}
          {(dvlaData || newReg.trim()) && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                onClick={handleSave}
                disabled={saving || !newReg.trim()}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: saving || !newReg.trim() ? "var(--grey-accent)" : "var(--primary)",
                  color: "var(--text-inverse)",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: saving || !newReg.trim() ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving..." : dvlaData ? "Save Vehicle" : "Save Without Lookup"}
              </button>
              {formMessage && dvlaData && (
                <span style={{ fontSize: "12px", color: "var(--danger)" }}>{formMessage}</span>
              )}
            </div>
          )}
        </div>
      )}

      {!vehicles.length ? (
        <div
          style={{
            border: "1px dashed var(--surface-light)",
            borderRadius: "18px",
            padding: "24px",
            textAlign: "center",
            color: "var(--grey-accent)",
          }}
        >
          No vehicles linked to this customer yet.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "16px",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {vehicles.map((vehicle) => {
            const registration = vehicle.registration || vehicle.reg_number || "Unregistered";
            const makeModel =
              vehicle.make_model ||
              [vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
              "Vehicle";

            return (
              <div
                key={vehicle.vehicle_id}
                style={{
                  borderRadius: "20px",
                  border: "1px solid var(--surface-light)",
                  background: "var(--surface-light)",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      letterSpacing: "0.25em",
                      textTransform: "uppercase",
                      color: "var(--grey-accent)",
                      marginBottom: "4px",
                    }}
                  >
                    Registration
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "1.3rem",
                      fontWeight: 700,
                      color: "var(--info-dark)",
                    }}
                  >
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
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  }}
                >
                  <VehicleField label="Colour" value={vehicle.colour} />
                  <VehicleField label="VIN" value={vehicle.vin || vehicle.chassis} />
                  <VehicleField
                    label="Mileage"
                    value={vehicle.mileage ? `${vehicle.mileage} miles` : null}
                  />
                  <VehicleField label="Fuel" value={vehicle.fuel_type} />
                  <VehicleField label="Transmission" value={vehicle.transmission} />
                  <VehicleField label="MOT due" value={formatDate(vehicle.mot_due)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const VehicleField = ({ label, value }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
    <span
      style={{
        fontSize: "0.65rem",
        textTransform: "uppercase",
        letterSpacing: "0.2em",
        color: "var(--grey-accent)",
      }}
    >
      {label}
    </span>
    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value || "—"}</span>
  </div>
);

const HistoryTab = ({ jobs }) => {
  if (!jobs.length) {
    return (
      <div
        style={{
          border: "1px dashed var(--surface-light)",
          borderRadius: "18px",
          padding: "24px",
          textAlign: "center",
          color: "var(--grey-accent)",
        }}
      >
        No job history recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {jobs.map((job) => {
        const requestSummary = deriveRequestSummary(parseRequests(job.requests));
        return (
          <div
            key={job.id}
            style={{
              borderRadius: "18px",
              border: "1px solid var(--surface-light)",
              background: "var(--surface-light)",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--grey-accent)" }}>
                  Job number
                </p>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: "1.25rem",
                    color: "var(--info-dark)",
                  }}
                >
                  {job.job_number}
                </p>
              </div>
              <span
                style={{
                  borderRadius: "999px",
                  padding: "6px 16px",
                  border: "1px solid var(--surface)",
                  background: "var(--surface)",
                  color: "var(--primary-dark)",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {job.status || "unknown"}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: "12px",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <VehicleField
                label="Vehicle"
                value={job.vehicle_make_model || job.vehicle_reg}
              />
              <VehicleField
                label="Mileage at service"
                value={job.mileage_at_service ? `${job.mileage_at_service} miles` : null}
              />
              <VehicleField label="Created" value={formatDate(job.created_at)} />
              <VehicleField label="Updated" value={formatDate(job.updated_at)} />
              <VehicleField label="Source" value={job.job_source} />
            </div>

            {requestSummary && (
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>{requestSummary}</p>
            )}

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link
                href={`/job-cards/${encodeURIComponent(job.job_number)}`}
                style={{
                  borderRadius: "999px",
                  padding: "10px 18px",
                  background: "var(--primary)",
                  color: "var(--text-inverse)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View job card
              </Link>
              {job.vehicle_reg && (
                <span
                  style={{
                    borderRadius: "999px",
                    padding: "10px 18px",
                    border: "1px solid var(--surface)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Reg: {job.vehicle_reg}
                </span>
              )}
            </div>
          </div>
        );
      })}
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
  const slugFromRoute = getSlugParam(router.query.customerSlug);
  const [customer, setCustomer] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [activeTab, setActiveTab] = useState(TAB_DEFINITIONS[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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

        const [vehiclesForCustomer, jobsForCustomer] = await Promise.all([
          getCustomerVehicles(customerRecord.id),
          getCustomerJobs(customerRecord.id),
        ]);

        setCustomer(customerRecord);
        setVehicles(vehiclesForCustomer || []);
        setJobs(jobsForCustomer || []);
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
    { label: "Telephone", value: customer?.telephone },
  ].filter((entry) => entry.value);
  const formattedAddress = [customer?.address, customer?.postcode].filter(Boolean).join(", ");

  const { totalJobs, activeJobs } = useMemo(() => {
    const total = jobs.length;
    const active = jobs.filter(
      (job) => job?.status && !INACTIVE_JOB_STATUSES.has(String(job.status).toLowerCase())
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
      },
      {
        key: "contact-number",
        label: "Contact numbers",
        type: "list",
        items: contactNumbers,
      },
      {
        key: "address",
        label: "Address",
        value: formattedAddress || customer?.address || "",
      },
      {
        key: "vehicles",
        label: "Vehicles on file",
        value: vehicles.length,
      },
      {
        key: "total-jobs",
        label: "Total jobs",
        value: totalJobs,
      },
      {
        key: "open-jobs",
        label: "Open jobs",
        value: activeJobs,
      },
    ],
    [customer?.email, contactNumbers, formattedAddress, vehicles.length, totalJobs, activeJobs]
  );

  const renderTabContent = () => {
    if (activeTab === "vehicles") {
      return (
        <VehiclesTab
          vehicles={vehicles}
          customerId={customer?.id}
          onVehicleAdded={async () => {
            if (!customer?.id) return;
            const refreshed = await getCustomerVehicles(customer.id);
            setVehicles(refreshed || []);
          }}
        />
      );
    }
    if (activeTab === "history") {
      return <HistoryTab jobs={jobs} />;
    }
    return null;
  };

  return (
    <Layout>
      <main
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {isLoading && (
          <div
            style={{
              borderRadius: "18px",
              padding: "18px",
              textAlign: "center",
              border: "1px solid var(--surface-light)",
              background: "var(--surface)",
            }}
          >
            Loading customer…
          </div>
        )}

        {error && (
          <div
            style={{
              borderRadius: "18px",
              padding: "16px",
              border: "1px solid rgba(var(--danger-rgb), 0.35)",
              background: "var(--danger-surface)",
              color: "var(--danger-dark)",
            }}
          >
            {error}
          </div>
        )}

        {customer && !error && (
          <>
            <section style={detailCardStyles.container}>
              <div style={detailCardStyles.identityBlock}>
                <div style={detailCardStyles.nameGroup}>
                  <p
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: "0.3em",
                      color: "var(--grey-accent)",
                      margin: 0,
                    }}
                  >
                    Customer profile
                  </p>
                  <h1 style={detailCardStyles.name}>{customerName || customer.email || "Customer"}</h1>
                </div>
              </div>

              <div style={detailGridStyles.grid}>
                {profileGridItems.map((item) => (
                  <div key={item.key} style={detailGridStyles.item}>
                    <span style={detailGridStyles.label}>{item.label}</span>
                    {item.type === "list" ? (
                      item.items?.length ? (
                        <ul
                          style={{
                            listStyle: "none",
                            padding: 0,
                            margin: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {item.items.map((entry) => (
                            <li key={`${entry.label}-${entry.value}`}>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--text-secondary)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.2em",
                                }}
                              >
                                {entry.label}
                              </span>
                              <a
                                href={`tel:${entry.value}`}
                                style={{ color: "var(--primary)", fontWeight: 600 }}
                              >
                                {entry.value}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ color: "var(--text-secondary)" }}>No numbers on file</span>
                      )
                    ) : item.href ? (
                      <a href={item.href} style={{ color: "var(--primary)", fontWeight: 600 }}>
                        {item.value || "—"}
                      </a>
                    ) : (
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {item.value ?? "—"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <nav style={tabsStyles.container} aria-label="Customer data tabs">
              {TAB_DEFINITIONS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={tabsStyles.pill(activeTab === tab.id)}
                >
                  {tab.label}
                  {tab.id === "vehicles" ? ` (${vehicles.length})` : ""}
                  {tab.id === "history" ? ` (${jobs.length})` : ""}
                </button>
              ))}
            </nav>

            <section style={tabPanelStyles.container}>{renderTabContent()}</section>
          </>
        )}
      </main>
    </Layout>
  );
}
