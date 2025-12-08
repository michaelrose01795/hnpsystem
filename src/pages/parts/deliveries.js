import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

const pageStyles = {
  container: {
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "16px",
  },
  dateControl: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  cardGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  card: {
    backgroundColor: "var(--surface)",
    borderRadius: "20px",
    padding: "24px",
    border: "1px solid var(--danger-surface)",
    boxShadow: "none",
    width: "100%",
  },
  cardRow: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "16px",
  },
  cardColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  smallText: {
    color: "var(--info)",
    fontSize: "0.85rem",
  },
  badge: {
    padding: "6px 14px",
    borderRadius: "999px",
    fontWeight: 600,
    fontSize: "0.85rem",
    letterSpacing: "0.04em",
  },
};

const statusVariants = {
  planned: { label: "Planned", background: "rgba(var(--info-rgb), 0.12)", color: "var(--info-dark)" },
  in_progress: { label: "In Progress", background: "rgba(var(--info-rgb), 0.15)", color: "var(--accent-purple)" },
  completed: { label: "Completed", background: "rgba(var(--info-rgb), 0.25)", color: "var(--info-dark)" },
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

const formatIsoDate = (value) => {
  try {
    const date = value ? new Date(value) : new Date();
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return "—";
  }
};

const deriveStatus = (stops = []) => {
  if (!Array.isArray(stops) || stops.length === 0) {
    return "planned";
  }
  const statuses = new Set(stops.map((stop) => stop.status));
  if (Array.from(statuses).every((value) => value === "delivered")) {
    return "completed";
  }
  if (statuses.has("en_route") || statuses.has("delivered")) {
    return "in_progress";
  }
  return "planned";
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const adjustIsoDate = (isoDate, delta) => {
  const base = isoDate ? new Date(isoDate) : new Date();
  base.setDate(base.getDate() + delta);
  return base.toISOString().slice(0, 10);
};

export default function PartsDeliveriesPage() {
  const { user } = useUser();
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = roles.includes("parts") || roles.includes("parts manager");

  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let query = supabase
        .from("deliveries")
        .select("*, stops:delivery_stops(*)")
        .order("delivery_date", { ascending: false });

      if (selectedDate) {
        query = query.eq("delivery_date", selectedDate);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) {
        throw fetchError;
      }
      setDeliveries(data || []);
    } catch (loadError) {
      console.error("Failed to load deliveries:", loadError);
      setError(loadError?.message || "Unable to load delivery routes");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const summaryForDelivery = (delivery) => {
    const stops = delivery?.stops || [];
    const totalMileage = stops.reduce(
      (acc, stop) => acc + Number(stop.mileage_for_leg || 0),
      0
    );
    const totalFuelCost = stops.reduce(
      (acc, stop) => acc + Number(stop.estimated_fuel_cost || 0),
      0
    );
    return {
      stopsCount: stops.length,
      totalMileage,
      totalFuelCost,
      status: deriveStatus(stops),
    };
  };

  const displayDate = useMemo(() => formatIsoDate(selectedDate), [selectedDate]);

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>
          You do not have access to delivery planning.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={pageStyles.container}>
        <div style={pageStyles.header}>
          <p
            style={{
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--primary-dark)",
              fontSize: "0.85rem",
            }}
          >
            Parts Deliveries
          </p>
          <h1 style={{ margin: 0, color: "var(--primary)" }}>Delivery Routes</h1>
          <p style={{ margin: 0, color: "var(--info)" }}>
            Plan multi-stop runs, capture mileage/fuel, and confirm deliveries in a single workspace.
          </p>
        </div>

        <div style={pageStyles.controls}>
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--primary-dark)" }}>Selected day</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{displayDate}</div>
          </div>
          <div style={pageStyles.dateControl}>
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => adjustIsoDate(prev, -1))}
              style={{
                borderRadius: "10px",
                border: "1px solid var(--surface-light)",
                background: "var(--surface)",
                color: "var(--primary-dark)",
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Previous day
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              style={{
                borderRadius: "10px",
                border: "1px solid var(--surface-light)",
                padding: "10px 12px",
                fontWeight: 600,
                color: "var(--primary-dark)",
              }}
            />
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => adjustIsoDate(prev, 1))}
              style={{
                borderRadius: "10px",
                border: "1px solid var(--surface-light)",
                background: "var(--primary-dark)",
                color: "var(--surface)",
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Next day
            </button>
          </div>
        </div>

        <div style={pageStyles.cardGrid}>
          {error && (
            <div style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</div>
          )}
          {loading && <div style={{ color: "var(--info)" }}>Loading delivery routes…</div>}
          {!loading && deliveries.length === 0 && (
            <div style={{ color: "var(--info)" }}>
              No planned deliveries found for the selected day. Adjust the date to keep planning.
            </div>
          )}
          {!loading &&
            deliveries.map((delivery) => {
              const { stopsCount, totalMileage, totalFuelCost, status } =
                summaryForDelivery(delivery);
              const statusMeta = statusVariants[status] || statusVariants.planned;
              const driverLabel = delivery.driver_id
                ? `Driver ${delivery.driver_id.slice(0, 8)}`
                : "Driver unassigned";

              return (
                <div key={delivery.id} style={pageStyles.card}>
                  <div style={pageStyles.cardRow}>
                    <div style={pageStyles.cardColumn}>
                      <span style={{ color: "var(--info)", fontSize: "0.85rem" }}>
                        Delivery date
                      </span>
                      <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                        {formatIsoDate(delivery.delivery_date)}
                      </span>
                    </div>
                    <span
                      style={{
                        ...pageStyles.badge,
                        background: statusMeta.background,
                        color: statusMeta.color,
                      }}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  <div style={{ ...pageStyles.cardRow, marginTop: "16px" }}>
                    <div style={{ flex: "1 1 250px" }}>
                      <div style={{ fontWeight: 600 }}>{driverLabel}</div>
                      <p style={pageStyles.smallText}>
                        Vehicle · {delivery.vehicle_reg || "TBC"}
                      </p>
                      <p style={pageStyles.smallText}>{delivery.notes || ""}</p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.75rem", color: "var(--info)" }}>Stops</div>
                        <div style={{ fontWeight: 700, fontSize: "1.3rem" }}>{stopsCount}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.75rem", color: "var(--info)" }}>Mileage</div>
                        <div style={{ fontWeight: 700, fontSize: "1.3rem" }}>
                          {totalMileage.toLocaleString()} km
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.75rem", color: "var(--info)" }}>Fuel cost</div>
                        <div style={{ fontWeight: 700, fontSize: "1.3rem" }}>
                          {formatCurrency(totalFuelCost)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div style={pageStyles.smallText}>
                      {delivery.fuel_type ? `Fuel: ${delivery.fuel_type}` : "Fuel not set"}
                    </div>
                    <Link
                      href={`/parts/delivery-planner?deliveryId=${delivery.id}`}
                      style={{
                        textDecoration: "none",
                        background: "var(--primary)",
                        color: "var(--surface)",
                        padding: "10px 18px",
                        borderRadius: "12px",
                        fontWeight: 600,
                        boxShadow: "none",
                      }}
                    >
                      View route
                    </Link>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </Layout>
  );
}
