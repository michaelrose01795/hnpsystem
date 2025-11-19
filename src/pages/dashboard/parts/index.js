"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

const Section = ({ title, subtitle, children }) => (
  <section
    style={{
      background: "#fff",
      borderRadius: "18px",
      padding: "24px",
      border: "1px solid #ffe0e0",
      boxShadow: "0 18px 30px rgba(0,0,0,0.05)",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#a00000" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", color: "#6b7280" }}>{subtitle}</p>}
    </div>
    {children}
  </section>
);

const MetricCard = ({ label, value, helper }) => (
  <div
    style={{
      minWidth: 180,
      borderRadius: "14px",
      padding: "16px",
      background: "#fff",
      border: "1px solid #ffe0e0",
      boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
    }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "#a00000" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}>{helper}</p>}
  </div>
);

export default function PartsDashboard() {
  const { user } = useUser();
  const roleLabels = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = roleLabels.includes("parts") || roleLabels.includes("parts manager");

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          You do not have access to the Parts dashboard.
        </div>
      </Layout>
    );
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [partsRequests, setPartsRequests] = useState(0);
  const [prePicked, setPrePicked] = useState(0);
  const [partsOnOrder, setPartsOnOrder] = useState(0);
  const [delayedOrders, setDelayedOrders] = useState(0);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [requestsByStatus, setRequestsByStatus] = useState({});

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);
      try {
        const [requestsData, deliveryItems, catalogData] = await Promise.all([
          supabase
            .from("parts_requests")
            .select("request_id,status,pre_pick_location,created_at")
            .order("created_at", { ascending: true }),
          supabase
            .from("parts_delivery_items")
            .select("id,delivery_id,status,quantity_ordered,quantity_received")
            .neq("status", "cancelled"),
          supabase
            .from("parts_catalog")
            .select("id,name,part_number,qty_in_stock,reorder_level,qty_on_order")
            .order("qty_in_stock", { ascending: true })
            .limit(8),
        ]);

        const requestStatusMap = (requestsData || []).reduce((acc, request) => {
          const status = (request.status || "pending").trim() || "pending";
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        const onOrderQuantity = (catalogData || []).reduce(
          (total, part) => total + (Number(part.qty_on_order) || 0),
          0
        );

        const prePickedCount = (requestsData || []).filter((request) => Boolean(request.pre_pick_location)).length;
        const delayedCount = (deliveryItems || []).filter(
          (item) => (Number(item.quantity_received) || 0) < (Number(item.quantity_ordered) || 0)
        ).length;

        const stockAlertRows = (catalogData || [])
          .map((part) => ({
            id: part.id,
            label: part.name || part.part_number || "Part",
            qty: Number(part.qty_in_stock) || 0,
            reorder: Number(part.reorder_level) || 0,
          }))
          .sort((a, b) => (a.qty - a.reorder) - (b.qty - b.reorder))
          .slice(0, 5);

        setPartsRequests(requestsData?.length || 0);
        setPrePicked(prePickedCount);
        setPartsOnOrder(onOrderQuantity);
        setDelayedOrders(delayedCount);
        setStockAlerts(stockAlertRows);
        setRequestsByStatus(requestStatusMap);
      } catch (fetchError) {
        console.error("Failed to load parts dashboard", fetchError);
        setError(fetchError.message || "Unable to load parts metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "linear-gradient(120deg, #f8fafc, #fff)",
            borderRadius: "18px",
            border: "1px solid #dce4eb",
            padding: "24px",
            boxShadow: "0 16px 30px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a00000" }}>Parts desk</p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>Parts operations</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Live stock, inbound, and request telemetry from the parts catalogue.
          </p>
        </header>

        <Section title="Request snapshot" subtitle="New and pre-picks today">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading request counts…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard label="Parts requests" value={partsRequests} helper="Open request queue" />
              <MetricCard label="Parts on order" value={partsOnOrder} helper="Units currently on order" />
              <MetricCard label="Pre picked" value={prePicked} helper="Assigned to service racks" />
              <MetricCard label="Delayed orders" value={delayedOrders} helper="Deliveries missing quantities" />
            </div>
          )}
        </Section>

        <Section title="Stock levels" subtitle="Lowest availability items">
          {stockAlerts.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>Book no low stock alerts yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {stockAlerts.map((part) => (
                <div
                  key={part.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #ffe0e0",
                    background: "#fff",
                  }}
                >
                  <div>
                    <strong>{part.label}</strong>
                    <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
                      Reorder threshold {part.reorder}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, color: "#a00000" }}>{part.qty}</p>
                    <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#6b7280" }}>In stock</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Requests by status" subtitle="Provides a quick glance at queue health">
          {Object.keys(requestsByStatus).length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No requests to show yet.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {Object.entries(requestsByStatus).map(([status, count]) => (
                <div
                  key={status}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: "1px solid #ffe0e0",
                    background: "#fff",
                    minWidth: 150,
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>{status}</p>
                  <strong style={{ color: "#a00000" }}>{count}</strong>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </Layout>
  );
}
