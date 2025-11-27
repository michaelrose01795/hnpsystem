import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

const STATUS_META = {
  planned: { label: "Planned", background: "rgba(251, 191, 36, 0.15)", color: "#92400e" },
  en_route: { label: "En Route", background: "rgba(59, 130, 246, 0.15)", color: "#1d4ed8" },
  delivered: { label: "Delivered", background: "rgba(16, 185, 129, 0.25)", color: "#047857" },
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

const stopCardStyle = {
  borderRadius: "18px",
  border: "1px solid #ffe0e0",
  background: "#ffffff",
  padding: "18px",
  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.08)",
};

const buttonStyle = {
  borderRadius: "12px",
  padding: "10px 16px",
  border: "none",
  fontWeight: 600,
  cursor: "pointer",
};

export default function DeliveryRoutePage() {
  const router = useRouter();
  const { deliveryId } = router.query;
  const isReady = router.isReady;
  const { user } = useUser();
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = roles.includes("parts") || roles.includes("parts manager");

  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDelivery = useCallback(async () => {
    if (!isReady || !deliveryId) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase
        .from("deliveries")
        .select(
          `*, stops:delivery_stops(
            *,
            customer:customers(firstname, lastname, name, address, postcode),
            job:jobs(id, job_number)
          )`
        )
        .eq("id", deliveryId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setDelivery(data || null);
    } catch (fetchErr) {
      console.error("Failed to load delivery:", fetchErr);
      setError(fetchErr?.message || "Unable to load delivery route");
    } finally {
      setLoading(false);
    }
  }, [deliveryId, isReady]);

  useEffect(() => {
    loadDelivery();
  }, [loadDelivery]);

  const orderedStops = useMemo(() => {
    if (!delivery?.stops) return [];
    return [...delivery.stops].sort((a, b) => a.stop_number - b.stop_number);
  }, [delivery]);

  const activeStop = orderedStops.find((stop) => stop.status === "en_route");
  const nextPlannedStop = orderedStops.find((stop) => stop.status === "planned");

  const handleStatusUpdate = async (stopIds, status) => {
    if (!stopIds.length) return;
    setActionLoading(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("delivery_stops")
        .update({ status })
        .in("id", stopIds);
      if (updateError) throw updateError;
      await loadDelivery();
    } catch (actionErr) {
      console.error("Status update failed:", actionErr);
      setError(actionErr?.message || "Unable to update stop status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartRoute = () => {
    if (!nextPlannedStop) {
      return;
    }
    handleStatusUpdate([nextPlannedStop.id], "en_route");
  };

  const handleMarkDelivered = () => {
    const target = activeStop || nextPlannedStop;
    if (!target) {
      return;
    }
    handleStatusUpdate([target.id], "delivered");
  };

  const handleCompleteRoute = () => {
    const pendingIds = orderedStops
      .filter((stop) => stop.status !== "delivered")
      .map((stop) => stop.id);
    if (!pendingIds.length) {
      return;
    }
    handleStatusUpdate(pendingIds, "delivered");
  };

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          You do not have access to delivery planning.
        </div>
      </Layout>
    );
  }

  const driverLabel = delivery?.driver_id ? `Driver ${delivery.driver_id.slice(0, 8)}` : "Driver unassigned";
  const vehicleLabel = delivery?.vehicle_reg || "Vehicle TBC";

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <Link href="/parts/deliveries" style={{ color: "#a00000", fontWeight: 600 }}>
            ← Back to deliveries
          </Link>
          <p style={{ margin: 0, color: "#6b7280" }}>
            Delivery ID: {delivery?.id || deliveryId || "—"}
          </p>
        </div>

        <section
          style={{
            borderRadius: "20px",
            border: "1px solid #ffe1e1",
            background: "#ffffff",
            padding: "22px",
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a00000" }}>
            Route overview
          </p>
          <h1 style={{ margin: "4px 0 0", color: "#d10000" }}>Stops & delivery details</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>Driver</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{driverLabel}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>Vehicle</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{vehicleLabel}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>Fuel type</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
                {delivery?.fuel_type || "Not specified"}
              </p>
            </div>
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleStartRoute}
              disabled={actionLoading || !nextPlannedStop}
              style={{
                ...buttonStyle,
                background: "#ffffff",
                border: "1px solid #ffd1d1",
                color: "#a00000",
                opacity: actionLoading || !nextPlannedStop ? 0.6 : 1,
              }}
            >
              Start Route
            </button>
            <button
              type="button"
              onClick={handleMarkDelivered}
              disabled={actionLoading || (!activeStop && !nextPlannedStop)}
              style={{
                ...buttonStyle,
                background: "#d10000",
                color: "#ffffff",
                opacity: actionLoading || (!activeStop && !nextPlannedStop) ? 0.6 : 1,
              }}
            >
              Mark Stop as Delivered
            </button>
            <button
              type="button"
              onClick={handleCompleteRoute}
              disabled={actionLoading || orderedStops.every((stop) => stop.status === "delivered")}
              style={{
                ...buttonStyle,
                background: "#0f766e",
                color: "#ffffff",
                opacity: actionLoading || orderedStops.every((stop) => stop.status === "delivered") ? 0.6 : 1,
              }}
            >
              Complete Route
            </button>
          </div>
          {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}
        </section>

        {loading && <p style={{ color: "#6b7280" }}>Loading route stops…</p>}

        {!loading && !orderedStops.length && (
          <p style={{ color: "#6b7280" }}>No stops have been planned for this route yet.</p>
        )}

        {!loading && orderedStops.length > 0 && (
          <ol style={{ display: "flex", flexDirection: "column", gap: "16px", padding: 0 }}>
            {orderedStops.map((stop) => {
              const customerName =
                stop?.customer?.name ||
                [stop?.customer?.firstname, stop?.customer?.lastname].filter(Boolean).join(" ") ||
                "Customer";
              const statusMeta = STATUS_META[stop.status] || STATUS_META.planned;
              return (
                <li key={stop.id} style={{ listStyle: "none" }}>
                  <div style={stopCardStyle}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem" }}>
                          {stop.stop_number}. {customerName}
                        </p>
                        <p style={{ margin: "4px 0 0", color: "#6b7280" }}>{stop.customer?.address || "Address TBC"}</p>
                        <p style={{ margin: "2px 0 0", color: "#6b7280" }}>
                          {stop.customer?.postcode || "Postcode TBC"}
                        </p>
                      </div>
                      <span
                        style={{
                          padding: "6px 14px",
                          borderRadius: "999px",
                          background: statusMeta.background,
                          color: statusMeta.color,
                          fontWeight: 600,
                          fontSize: "0.85rem",
                        }}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: "12px",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "10px",
                        color: "#4b5563",
                      }}
                    >
                      {stop.job?.job_number && (
                        <div>
                          <p style={{ margin: 0, fontSize: "0.75rem" }}>Job number</p>
                          <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{stop.job.job_number}</p>
                        </div>
                      )}
                      <div>
                        <p style={{ margin: 0, fontSize: "0.75rem" }}>Mileage for leg</p>
                        <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
                          {Number(stop.mileage_for_leg || 0).toLocaleString()} km
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "0.75rem" }}>Estimated fuel</p>
                        <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
                          {formatCurrency(stop.estimated_fuel_cost)}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "0.75rem" }}>Status</p>
                        <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{stop.status || "planned"}</p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Layout>
  );
}
