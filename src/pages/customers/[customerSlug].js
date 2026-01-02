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
  getCustomerActivityEvents,
  getCustomerAccounts,
} from "@/lib/database/customers";
import { createCustomerDisplaySlug, normalizeCustomerSlug } from "@/lib/customers/slug";
import { isValidUuid } from "@/lib/utils/ids";

const TAB_DEFINITIONS = [
  { id: "vehicles", label: "Vehicles" },
  { id: "history", label: "History" },
  { id: "activity", label: "Activity" },
  { id: "accounts", label: "Accounts" },
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
  nameGroup: {
    flex: "1 1 280px",
    minWidth: "240px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  name: {
    fontSize: "2.25rem",
    fontWeight: 700,
    margin: 0,
    color: "var(--text-primary)",
    wordBreak: "break-word",
  },
  metaGrid: {
    flex: "1 1 240px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  metaItem: {
    borderRadius: "16px",
    border: "1px solid var(--surface-light)",
    background: "var(--surface-light)",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
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
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "16px",
  },
  statCard: {
    borderRadius: "18px",
    border: "1px solid var(--surface-light)",
    background: "var(--surface-light)",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  statLabel: {
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.25em",
    color: "var(--grey-accent)",
  },
  statValue: {
    fontSize: "1.4rem",
    fontWeight: 700,
    color: "var(--info-dark)",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  item: {
    borderRadius: "16px",
    border: "1px solid var(--surface-light)",
    background: "var(--surface-light)",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
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
      minute: "2-digit",
    });
  } catch (_err) {
    return "—";
  }
};

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
});

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return currencyFormatter.format(Number(value));
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

const ActivityTab = ({ events }) => {
  if (!events.length) {
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
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {events.map((event) => (
        <div
          key={event.event_id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "16px",
            borderRadius: "18px",
            border: "1px solid var(--surface-light)",
            background: "var(--surface-light)",
            padding: "18px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--grey-accent)",
              }}
            >
              {event.activity_source || "System update"}
            </p>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>
              {event.activity_type || "Activity"}
            </h3>
            {event.activity_payload?.summary && (
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                {event.activity_payload.summary}
              </p>
            )}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "0.85rem" }}>
              {event.job_id && (
                <span style={{ color: "var(--primary-dark)" }}>Job #{event.job_id}</span>
              )}
              {event.vehicle_id && (
                <span style={{ color: "var(--text-secondary)" }}>
                  Vehicle #{event.vehicle_id}
                </span>
              )}
            </div>
          </div>
          <div
            style={{
              textAlign: "right",
              color: "var(--text-secondary)",
              fontSize: "0.85rem",
              minWidth: "150px",
            }}
          >
            {formatDateTime(event.occurred_at)}
          </div>
        </div>
      ))}
    </div>
  );
};

const AccountsTab = ({ accounts }) => {
  if (!accounts.length) {
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
        No workshop accounts on file for this customer.
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
      {accounts.map((account) => (
        <div
          key={account.account_id}
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
                margin: 0,
                fontSize: "0.75rem",
                color: "var(--grey-accent)",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
              }}
            >
              Account type
            </p>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1.2rem" }}>
              {account.account_type || "Retail"}
            </p>
          </div>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <AccountField label="Status" value={account.status} />
            <AccountField label="Balance" value={formatCurrency(account.balance)} />
            <AccountField label="Credit limit" value={formatCurrency(account.credit_limit)} />
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <AccountField label="Billing name" value={account.billing_name} stacked />
            <AccountField label="Billing email" value={account.billing_email} stacked />
            <AccountField label="Billing phone" value={account.billing_phone} stacked />
            <AccountField
              label="Updated"
              value={formatDate(account.updated_at)}
              stacked
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const AccountField = ({ label, value, stacked = false }) => (
  <div style={{ display: "flex", flexDirection: "column", minWidth: stacked ? "100%" : "auto" }}>
    <span
      style={{
        fontSize: "0.65rem",
        textTransform: "uppercase",
        letterSpacing: "0.25em",
        color: "var(--grey-accent)",
      }}
    >
      {label}
    </span>
    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value || "—"}</span>
  </div>
);

const DetailField = ({ label, value, href }) => {
  const content = value ? (
    href ? (
      <a href={href} style={{ color: "var(--primary)", fontWeight: 600 }}>
        {value}
      </a>
    ) : (
      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
    )
  ) : (
    <span style={{ color: "var(--text-secondary)" }}>—</span>
  );

  return (
    <div style={detailGridStyles.item}>
      <span style={detailGridStyles.label}>{label}</span>
      {content}
    </div>
  );
};

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
  const [activityEvents, setActivityEvents] = useState([]);
  const [accounts, setAccounts] = useState([]);
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
          setActivityEvents([]);
          setAccounts([]);
          setError("Customer record was not found.");
          return;
        }

        const [vehiclesForCustomer, jobsForCustomer, eventsForCustomer, accountsForCustomer] =
          await Promise.all([
            getCustomerVehicles(customerRecord.id),
            getCustomerJobs(customerRecord.id),
            getCustomerActivityEvents(customerRecord.id),
            getCustomerAccounts(customerRecord.id),
          ]);

        setCustomer(customerRecord);
        setVehicles(vehiclesForCustomer || []);
        setJobs(jobsForCustomer || []);
        setActivityEvents(eventsForCustomer || []);
        setAccounts(accountsForCustomer || []);
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

  const stats = useMemo(() => {
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(
      (job) => job?.status && !INACTIVE_JOB_STATUSES.has(String(job.status).toLowerCase())
    ).length;
    const lastVisitedJob = jobs[0];
    return [
      { label: "Vehicles on file", value: vehicles.length },
      { label: "Total jobs", value: totalJobs },
      { label: "Open jobs", value: activeJobs },
      { label: "Activity items", value: activityEvents.length },
      { label: "Accounts", value: accounts.length },
      { label: "Last booking", value: lastVisitedJob ? formatDate(lastVisitedJob.created_at) : "—" },
    ];
  }, [jobs, vehicles, activityEvents.length, accounts.length]);

  const renderTabContent = () => {
    if (activeTab === "vehicles") {
      return <VehiclesTab vehicles={vehicles} />;
    }
    if (activeTab === "history") {
      return <HistoryTab jobs={jobs} />;
    }
    if (activeTab === "activity") {
      return <ActivityTab events={activityEvents} />;
    }
    if (activeTab === "accounts") {
      return <AccountsTab accounts={accounts} />;
    }
    return null;
  };

  const customerName = [customer?.firstname, customer?.lastname].filter(Boolean).join(" ").trim();

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
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      color: "var(--text-secondary)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span>Customer ID: {customer.id}</span>
                    <span>Created {formatDate(customer.created_at)}</span>
                    <span>Updated {formatDate(customer.updated_at)}</span>
                  </div>
                </div>
                <div style={detailCardStyles.metaGrid}>
                  <div style={detailCardStyles.metaItem}>
                    <span style={detailCardStyles.metaLabel}>Preferred contact</span>
                    <span style={detailCardStyles.metaValue}>
                      {customer.contact_preference || "Not set"}
                    </span>
                  </div>
                  <div style={detailCardStyles.metaItem}>
                    <span style={detailCardStyles.metaLabel}>Email</span>
                    <span style={detailCardStyles.metaValue}>{customer.email || "—"}</span>
                  </div>
                  <div style={detailCardStyles.metaItem}>
                    <span style={detailCardStyles.metaLabel}>Mobile</span>
                    <span style={detailCardStyles.metaValue}>{customer.mobile || "—"}</span>
                  </div>
                  <div style={detailCardStyles.metaItem}>
                    <span style={detailCardStyles.metaLabel}>Telephone</span>
                    <span style={detailCardStyles.metaValue}>{customer.telephone || "—"}</span>
                  </div>
                </div>
              </div>

              <div style={detailGridStyles.grid}>
                <DetailField
                  label="Primary email"
                  value={customer.email}
                  href={customer.email ? `mailto:${customer.email}` : undefined}
                />
                <DetailField
                  label="Mobile"
                  value={customer.mobile}
                  href={customer.mobile ? `tel:${customer.mobile}` : undefined}
                />
                <DetailField
                  label="Telephone"
                  value={customer.telephone}
                  href={customer.telephone ? `tel:${customer.telephone}` : undefined}
                />
                <DetailField label="Preferred contact" value={customer.contact_preference} />
                <DetailField label="Address" value={customer.address} />
                <DetailField label="Postcode" value={customer.postcode} />
              </div>

              <div style={detailCardStyles.statsRow}>
                {stats.map((stat) => (
                  <div key={stat.label} style={detailCardStyles.statCard}>
                    <span style={detailCardStyles.statLabel}>{stat.label}</span>
                    <span style={detailCardStyles.statValue}>{stat.value ?? "—"}</span>
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
                  {tab.id === "activity" ? ` (${activityEvents.length})` : ""}
                  {tab.id === "accounts" ? ` (${accounts.length})` : ""}
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
