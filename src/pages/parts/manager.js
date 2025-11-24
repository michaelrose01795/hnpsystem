import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import PartsOpsDashboard from "@/components/dashboards/PartsOpsDashboard";
import { supabaseClient } from "@/lib/supabaseClient";

const containerStyle = {
  padding: "0 24px 48px",
  maxWidth: "1400px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
};

const sectionCardStyle = {
  borderRadius: "16px",
  background: "#fff",
  border: "1px solid #ffe0e0",
  padding: "20px",
  boxShadow: "0 18px 36px rgba(0,0,0,0.06)",
  height: "100%",
};

const sectionTitleStyle = {
  fontSize: "0.95rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  color: "#a00000",
  marginBottom: "14px",
  textTransform: "uppercase",
};

const performanceTableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const workloadStatusStyles = {
  awaiting_stock: { color: "#b45309", background: "rgba(245,158,11,0.18)" },
  pending: { color: "#a00000", background: "rgba(209,0,0,0.12)" },
  allocated: { color: "#047857", background: "rgba(16,185,129,0.16)" },
  picked: { color: "#1d4ed8", background: "rgba(59,130,246,0.16)" },
  fitted: { color: "#0369a1", background: "rgba(191,219,254,0.6)" },
};

const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return "£0";
  return `£${numeric.toFixed(2)}`;
};

const formatMarginValue = (cost, price) => {
  const unitCost = Number(cost || 0);
  const unitPrice = Number(price || 0);
  const diff = unitPrice - unitCost;
  const percent = unitPrice !== 0 ? (diff / unitPrice) * 100 : 0;
  return `${formatCurrency(diff)} (${percent.toFixed(0)}%)`;
};

const buildWorkloadRows = (items = []) =>
  items.map((item) => {
    const job = item.job || {};
    const part = item.part || {};
    const status = item.status || "pending";
    const colors = workloadStatusStyles[status] || workloadStatusStyles.pending;
    const monetaryValue = (Number(part.unit_price) || 0) * (Number(item.quantity_requested) || 0);

    return {
      jobNumber: job.job_number || "—",
      reg: job.vehicle_reg || "—",
      advisor: part.supplier || "Unknown supplier",
      neededBy: job.waiting_status || "—",
      status: status.replace(/_/g, " "),
      statusColor: colors.background,
      statusTextColor: colors.color,
      value: formatCurrency(monetaryValue),
    };
  });

const buildTeamBuckets = (items = []) => {
  const grouped = items.reduce((acc, item) => {
    const key = item.status || "pending";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped).map(([status, count]) => ({
    name: status.replace(/_/g, " "),
    role: "Job queue",
    status: `${count} line${count === 1 ? "" : "s"}`,
    window: "Updated just now",
  }));
};

const buildFocusItems = (alerts = []) =>
  alerts.slice(0, 3).map((alert) => ({
    title: `${alert.partNumber || ""} ${alert.name || ""}`.trim(),
    detail: `Stock ${alert.inStock}/${alert.reorderLevel} · On order ${alert.qtyOnOrder} · Jobs ${alert.openJobCount || 0}`,
    owner: alert.supplier ? `Supplier: ${alert.supplier}` : "",
  }));

const buildTeamPerformance = (queue = []) =>
  queue.slice(0, 5).map((item) => ({
    name: item.jobNumber,
    role: item.reg,
    fillRate: item.status,
    accuracy: item.advisor,
    picksPerHour: item.neededBy || "N/A",
    valuePerDay: item.value,
  }));

export default function PartsManagerDashboard() {
  const { user } = useUser();
  const userRoles = (user?.roles || []).map((role) => role.toLowerCase());
  const isManager = userRoles.includes("parts manager");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    summaryCards: [],
    workload: [],
    focusItems: [],
    inventoryAlerts: [],
    deliveries: [],
    teamAvailability: [],
  });

  useEffect(() => {
    if (!isManager) return;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const [summaryResponse, deliveriesResponse, jobItemsResponse] = await Promise.all([
          fetch("/api/parts/summary").then((res) => res.json()),
          fetch("/api/parts/deliveries?limit=5").then((res) => res.json()),
          supabaseClient
            .from("parts_job_items")
            .select(
              `id, status, quantity_requested, created_at, job:jobs(id, job_number, vehicle_reg, waiting_status), part:parts_catalog(part_number, name, supplier, unit_price)`
            )
            .in("status", ["pending", "awaiting_stock", "allocated", "picked"])
            .order("created_at", { ascending: false })
            .limit(8),
        ]);

        if (!summaryResponse.success) {
          throw new Error(summaryResponse.message || "Unable to load summary");
        }

        if (!deliveriesResponse.success) {
          throw new Error(deliveriesResponse.message || "Unable to load deliveries");
        }

        if (jobItemsResponse.error) {
          throw new Error(jobItemsResponse.error.message || "Unable to load job data");
        }

        const summary = summaryResponse.summary || {};
        const lowStock = summary.lowStockParts || [];
        const jobRows = jobItemsResponse.data || [];

        const summaryCards = [
          {
            label: "Active parts",
            value: summary.totalParts ?? 0,
            helper: `${summary.lowStockCount || 0} low stock`,
          },
          {
            label: "Inventory value",
            value: formatCurrency(summary.totalInventoryValue || 0),
            helper: "Cost basis",
          },
          {
            label: "Parts on order",
            value: summary.partsOnOrder ?? 0,
            helper: "Awaiting delivery",
          },
          {
            label: "Pending deliveries",
            value: summary.pendingDeliveries ?? 0,
            helper: `${summary.activeJobParts || 0} live job lines`,
          },
        ];

        const deliveries = (deliveriesResponse.deliveries || []).map((delivery) => ({
          supplier: delivery.supplier || "Unknown supplier",
          eta: delivery.expected_date || delivery.received_date || "TBC",
          items: (delivery.delivery_items || []).length,
          reference: delivery.order_reference || delivery.id,
        }));

        setDashboardData({
          summaryCards,
          workload: buildWorkloadRows(jobRows),
          focusItems: buildFocusItems(lowStock),
          inventoryAlerts: lowStock,
          deliveries,
          teamAvailability: buildTeamBuckets(jobRows),
        });
      } catch (err) {
        console.error("Failed to load parts manager data", err);
        setError(err.message || "Unable to load parts dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [isManager]);

  const teamPerformance = useMemo(() => buildTeamPerformance(dashboardData.workload), [
    dashboardData.workload,
  ]);

  const lowStockRows = useMemo(() => dashboardData.inventoryAlerts || [], [
    dashboardData.inventoryAlerts,
  ]);

  if (!isManager) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          Only the parts manager can view this dashboard.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {loading ? (
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          Loading parts manager dashboard…
        </div>
      ) : error ? (
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>{error}</div>
      ) : (
        <>
          <PartsOpsDashboard
            title="Parts Manager Dashboard"
            subtitle="Live queue, inbound deliveries and inventory status pulled from Supabase"
            data={dashboardData}
          />

          <div style={containerStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: "20px" }}>
              <div style={sectionCardStyle}>
                <div style={sectionTitleStyle}>Queue Snapshot</div>
                <table style={performanceTableStyle}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#777", fontSize: "0.85rem" }}>
                      <th style={{ paddingBottom: "10px" }}>Job</th>
                      <th style={{ paddingBottom: "10px" }}>Reg</th>
                      <th style={{ paddingBottom: "10px" }}>Supplier</th>
                      <th style={{ paddingBottom: "10px" }}>Status</th>
                      <th style={{ paddingBottom: "10px", textAlign: "right" }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.workload.map((row) => (
                      <tr key={`${row.jobNumber}-${row.advisor}`} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                        <td style={{ padding: "12px 0" }}>{row.jobNumber}</td>
                        <td style={{ padding: "12px 0" }}>{row.reg}</td>
                        <td style={{ padding: "12px 0" }}>{row.advisor}</td>
                        <td style={{ padding: "12px 0" }}>{row.status}</td>
                        <td style={{ padding: "12px 0", textAlign: "right", fontWeight: 600 }}>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={sectionCardStyle}>
                  <div style={sectionTitleStyle}>Status Buckets</div>
                  {dashboardData.teamAvailability.map((bucket) => (
                    <div
                      key={bucket.name}
                      style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}
                    >
                      <div style={{ fontWeight: 600 }}>{bucket.name}</div>
                      <div style={{ fontSize: "0.85rem", color: "#666" }}>{bucket.status}</div>
                      <div style={{ fontSize: "0.8rem", color: "#a00000", marginTop: "4px" }}>{bucket.window}</div>
                    </div>
                  ))}
                </div>

                <div style={sectionCardStyle}>
                  <div style={sectionTitleStyle}>Focus Items</div>
                  {dashboardData.focusItems.map((item) => (
                    <div key={item.title} style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                      <div style={{ fontWeight: 600 }}>{item.title}</div>
                      <div style={{ color: "#666", fontSize: "0.85rem" }}>{item.detail}</div>
                      <div style={{ fontSize: "0.8rem", color: "#a00000", marginTop: "4px" }}>{item.owner}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>Top Queue Lines</div>
              <table style={performanceTableStyle}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#777", fontSize: "0.85rem" }}>
                    <th style={{ paddingBottom: "10px" }}>Line</th>
                    <th style={{ paddingBottom: "10px" }}>Supplier</th>
                    <th style={{ paddingBottom: "10px" }}>Status</th>
                    <th style={{ paddingBottom: "10px", textAlign: "right" }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {teamPerformance.map((row) => (
                    <tr key={row.name} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                      <td style={{ padding: "12px 0" }}>{row.name}</td>
                      <td style={{ padding: "12px 0" }}>{row.accuracy}</td>
                      <td style={{ padding: "12px 0" }}>{row.fillRate}</td>
                      <td style={{ padding: "12px 0", textAlign: "right", fontWeight: 600 }}>{row.valuePerDay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>Low Stock Parts Overview</div>
              {lowStockRows.length === 0 ? (
                <div style={{ color: "#666" }}>No low stock parts currently.</div>
              ) : (
                <table style={performanceTableStyle}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#777", fontSize: "0.85rem" }}>
                      <th style={{ paddingBottom: "10px" }}>Part</th>
                      <th style={{ paddingBottom: "10px" }}>Supplier</th>
                      <th style={{ paddingBottom: "10px" }}>Cost</th>
                      <th style={{ paddingBottom: "10px" }}>Sell</th>
                      <th style={{ paddingBottom: "10px" }}>Margin</th>
                      <th style={{ paddingBottom: "10px" }}>Stock</th>
                      <th style={{ paddingBottom: "10px" }}>Min</th>
                      <th style={{ paddingBottom: "10px" }}>Status</th>
                      <th style={{ paddingBottom: "10px", textAlign: "right" }}>Linked Jobs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockRows.map((part) => (
                      <tr key={part.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                        <td style={{ padding: "12px 0" }}>
                          <div style={{ fontWeight: 600 }}>
                            {part.partNumber} · {part.name}
                          </div>
                        </td>
                        <td style={{ padding: "12px 0" }}>{part.supplier || "—"}</td>
                        <td style={{ padding: "12px 0" }}>{formatCurrency(part.unitCost)}</td>
                        <td style={{ padding: "12px 0" }}>{formatCurrency(part.unitPrice)}</td>
                        <td style={{ padding: "12px 0" }}>{formatMarginValue(part.unitCost, part.unitPrice)}</td>
                        <td style={{ padding: "12px 0" }}>{part.inStock}</td>
                        <td style={{ padding: "12px 0" }}>{part.reorderLevel}</td>
                        <td style={{ padding: "12px 0" }}>{(part.status || "in stock").replace(/_/g, " ")}</td>
                        <td style={{ padding: "12px 0", textAlign: "right" }}>{part.openJobCount || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
