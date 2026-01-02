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
    color: "var(--grey-accent-dark)",
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

const VehiclesTab = ({ vehicles }) => {
  if (!vehicles.length) {
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
        No vehicles linked to this customer yet.
      </div>
    );
  }

  return (
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
      return <VehiclesTab vehicles={vehicles} />;
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
                                  color: "var(--grey-accent)",
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
