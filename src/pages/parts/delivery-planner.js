"use client";

import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabaseClient } from "@/lib/supabaseClient";

const sectionStyle = {
  background: "#fff",
  borderRadius: "18px",
  border: "1px solid #ffe0e0",
  padding: "24px",
  boxShadow: "0 12px 28px rgba(0,0,0,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const dayCardStyle = {
  borderRadius: "14px",
  border: "1px solid #ffe5e5",
  background: "#fff7f7",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const runRowStyle = {
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid rgba(209,0,0,0.12)",
  background: "#ffffff",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(150px, 1fr)",
  gap: "12px",
  alignItems: "flex-start",
};

const formatTime = (value) => {
  if (!value) return "TBC";
  const candidate = new Date(`1970-01-01T${value}`);
  if (Number.isNaN(candidate.getTime())) {
    return value;
  }
  return candidate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
};

const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return "£0";
  return `£${numeric.toFixed(2)}`;
};

const formatDate = (value) => {
  if (!value) return "TBC";
  if (String(value).toLowerCase() === "unscheduled") return "Unscheduled";
  const day = new Date(value);
  if (Number.isNaN(day.getTime())) return value;
  return day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

const KM_PER_LITRE = 8;

const customerName = (customer) => {
  if (!customer) return "Customer";
  if (customer.name) return customer.name;
  return [customer.firstname, customer.lastname].filter(Boolean).join(" ") || "Customer";
};

export default function PartsDeliveryPlannerPage() {
  const { user } = useUser();
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasPartsAccess = roles.includes("parts") || roles.includes("parts manager");

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fuelRate, setFuelRate] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const pricePerLitre = fuelRate?.price_per_litre ?? 1.75;

  useEffect(() => {
    if (!hasPartsAccess) return;
    const loadRuns = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: fetchError } = await supabaseClient
          .from("parts_delivery_runs")
          .select(
            `id, job_id, customer_id, delivery_date, time_leave, time_arrive, mileage, fuel_cost, stops_count, destination_address, status, notes,
             job:jobs(job_number, vehicle_reg), customer:customers(firstname, lastname, name, address, postcode)`
          )
          .order("delivery_date", { ascending: true })
          .order("time_leave", { ascending: true });

        if (fetchError) throw fetchError;
        setRuns(data || []);
      } catch (fetchErr) {
        setError(fetchErr.message || "Unable to load delivery runs");
        setRuns([]);
      } finally {
        setLoading(false);
      }
    };

    loadRuns();
  }, [hasPartsAccess]);

  useEffect(() => {
    const loadFuelRate = async () => {
      const { data, error: rateError } = await supabaseClient
        .from("parts_delivery_settings")
        .select("fuel_type, price_per_litre, last_updated")
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!rateError && data) {
        setFuelRate(data);
      }
    };
    loadFuelRate();
  }, []);

  const runsByDate = useMemo(() => {
    const map = {};
    runs.forEach((run) => {
      const key = run.delivery_date || "unscheduled";
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(run);
    });
    return Object.entries(map).sort((a, b) => {
      const aKey = a[0] === "unscheduled" ? Number.MAX_SAFE_INTEGER : new Date(a[0]).getTime();
      const bKey = b[0] === "unscheduled" ? Number.MAX_SAFE_INTEGER : new Date(b[0]).getTime();
      return aKey - bKey;
    });
  }, [runs]);

  const computeFuelCost = (run) => ((Number(run.mileage) || 0) / KM_PER_LITRE) * pricePerLitre;
  const priceLabel = fuelRate?.fuel_type
    ? `${fuelRate.fuel_type} @ ${formatCurrency(pricePerLitre)} / L`
    : `Diesel @ ${formatCurrency(pricePerLitre)} / L`;
  const totalMileage = runs.reduce((total, run) => total + (Number(run.mileage) || 0), 0);
  const totalFuel = runs.reduce(
    (total, run) => total + (Number(run.fuel_cost) || computeFuelCost(run)),
    0
  );

  const filteredRunsByDate = useMemo(() => {
    if (!selectedDate) return runsByDate;
    return runsByDate.filter(([date]) => date === selectedDate);
  }, [runsByDate, selectedDate]);

  const dateOptions = runsByDate.map(([date]) => ({
    value: date,
    label: date === "unscheduled" ? "Unscheduled" : formatDate(date),
  }));

  if (!hasPartsAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          You do not have access to the delivery planner.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "22px" }}>
        <header style={{ ...sectionStyle, boxShadow: "0 14px 32px rgba(0,0,0,0.12)" }}>
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a00000" }}>
            Delivery planning
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>Outbound parts runs</h1>
          <p style={{ margin: "6px 0 0", color: "#555" }}>
            Review scheduled departure/arrival times, stops, mileage, and fuel for each delivery run.
          </p>
          <div
            style={{
              marginTop: "12px",
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "#a00000" }}>Upcoming runs</div>
              <strong style={{ fontSize: "1.6rem" }}>{runs.length}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#a00000" }}>Total mileage</div>
              <strong style={{ fontSize: "1.6rem" }}>{totalMileage} km</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#a00000" }}>Fuel estimate</div>
              <strong style={{ fontSize: "1.6rem" }}>{formatCurrency(totalFuel)}</strong>
            </div>
          </div>
          <div style={{ color: "#4b5563", fontSize: "0.85rem", marginTop: "6px" }}>
            Fuel rate: {priceLabel}
          </div>
        </header>

        <section style={sectionStyle}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <label style={{ fontSize: "0.85rem", color: "#4b5563" }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>Filter by day</span>
              <select
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #ffdede",
                  fontSize: "0.9rem",
                  color: "#a00000",
                }}
              >
                <option value="">All days</option>
                {dateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                style={{
                  padding: "8px 14px",
                  borderRadius: "999px",
                  border: "1px solid #ffdede",
                  background: "#fffbfb",
                  color: "#a00000",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Clear day filter
              </button>
            )}
          </div>
          {loading ? (
            <p style={{ color: "#6b7280", margin: 0 }}>Loading delivery runs…</p>
          ) : error ? (
            <p style={{ color: "#ff4040", margin: 0 }}>{error}</p>
          ) : filteredRunsByDate.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>
              {selectedDate
                ? `No delivery runs scheduled for ${formatDate(selectedDate)}.`
                : "No delivery runs scheduled yet."}
            </p>
          ) : (
            filteredRunsByDate.map(([date, items]) => {
              const dayMileage = items.reduce((total, item) => total + (Number(item.mileage) || 0), 0);
              const dayFuel = items.reduce(
                (total, item) => total + (Number(item.fuel_cost) || computeFuelCost(item)),
                0
              );
              const dayDrops = items.reduce((total, item) => total + (item.stops_count || 1), 0);
              const status = items[0]?.status?.replace(/_/g, " ") || "Planned";
              const cardLabel = date === "unscheduled" ? "Unscheduled" : formatDate(date);
              return (
                <div key={`${date}-${status}`} style={dayCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#a00000" }}>{cardLabel}</h3>
                      <p style={{ margin: "4px 0 0", color: "#555" }}>
                        {items.length} run{items.length === 1 ? "" : "s"} · {dayMileage} km ·{" "}
                        {formatCurrency(dayFuel)} · {dayDrops} drop{dayDrops === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#a00000",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {status}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {items.map((run) => {
                      const customer = run.customer;
                      const jobNumber = run.job?.job_number || `#${run.job_id}`;
                      const address =
                        run.destination_address || customer?.address || run.customer?.name || "Address TBC";
                      const fuelExpense = Number(run.fuel_cost) || computeFuelCost(run);
                      return (
                        <article key={run.id} style={runRowStyle}>
                          <div>
                            <div style={{ fontWeight: 600, color: "#a00000" }}>{jobNumber}</div>
                            <div style={{ fontSize: "0.9rem", color: "#4b5563" }}>
                              {customerName(customer)} · {address}
                            </div>
                            {run.notes ? (
                              <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
                                {run.notes}
                              </p>
                            ) : null}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.85rem" }}>
                            <div>
                              <strong>Departure:</strong> {formatTime(run.time_leave)}
                            </div>
                            <div>
                              <strong>Arrival:</strong> {formatTime(run.time_arrive)}
                            </div>
                            <div>
                              <strong>Stops:</strong> {run.stops_count || 1}
                            </div>
                            <div>
                              <strong>Mileage:</strong> {run.mileage ?? 0} km
                            </div>
                            <div>
                              <strong>Fuel:</strong> {formatCurrency(fuelExpense)}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </Layout>
  );
}
