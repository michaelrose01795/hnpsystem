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
  const day = new Date(value);
  if (Number.isNaN(day.getTime())) return value;
  return day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

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

  const runsByDate = useMemo(() => {
    const map = {};
    runs.forEach((run) => {
      const key = run.delivery_date || "unscheduled";
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(run);
    });
    return Object.entries(map).sort((a, b) => new Date(a[0]) - new Date(b[0]));
  }, [runs]);

  const totalMileage = runs.reduce((total, run) => total + (Number(run.mileage) || 0), 0);
  const totalFuel = runs.reduce((total, run) => total + (Number(run.fuel_cost) || 0), 0);

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
        </header>

        <section style={sectionStyle}>
          {loading ? (
            <p style={{ color: "#6b7280", margin: 0 }}>Loading delivery runs…</p>
          ) : error ? (
            <p style={{ color: "#ff4040", margin: 0 }}>{error}</p>
          ) : runsByDate.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No delivery runs scheduled yet.</p>
          ) : (
            runsByDate.map(([date, items]) => {
              const dayMileage = items.reduce((total, item) => total + (Number(item.mileage) || 0), 0);
              const dayFuel = items.reduce((total, item) => total + (Number(item.fuel_cost) || 0), 0);
              return (
                <div key={date} style={dayCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#a00000" }}>{formatDate(date)}</h3>
                      <p style={{ margin: "4px 0 0", color: "#555" }}>
                        {items.length} run{items.length === 1 ? "" : "s"} · {dayMileage} km · {formatCurrency(dayFuel)}
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
                      {items[0].status?.replace(/_/g, " ") || "Planned"}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {items.map((run) => {
                      const customer = run.customer;
                      const jobNumber = run.job?.job_number || `#${run.job_id}`;
                      const address =
                        run.destination_address || customer?.address || run.customer?.name || "Address TBC";
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
                              <strong>Fuel:</strong> {formatCurrency(run.fuel_cost)}
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
