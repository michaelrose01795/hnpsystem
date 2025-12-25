import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import PartsOpsDashboard from "@/components/dashboards/PartsOpsDashboard";
import { supabaseClient } from "@/lib/supabaseClient";
import { summarizePartsPipeline } from "@/lib/partsPipeline";
import DeliverySchedulerModal from "@/components/Parts/DeliverySchedulerModal";

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
  background: "var(--surface)",
  border: "1px solid var(--surface-light)",
  padding: "20px",
  boxShadow: "none",
  height: "100%",
};

const sectionTitleStyle = {
  fontSize: "0.95rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  color: "var(--primary-dark)",
  marginBottom: "14px",
  textTransform: "uppercase",
};

const performanceTableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const STATUS_COLOR_MAP = {
  waiting_authorisation: { background: "rgba(var(--warning-rgb), 0.2)", color: "var(--danger-dark)" },
  awaiting_stock: { background: "rgba(var(--warning-rgb), 0.4)", color: "var(--danger-dark)" },
  on_order: { background: "rgba(var(--info-rgb), 0.6)", color: "var(--accent-purple)" },
  pre_picked: { background: "rgba(var(--accent-purple-rgb), 0.6)", color: "var(--accent-purple)" },
  stock: { background: "rgba(var(--success-rgb), 0.8)", color: "var(--info-dark)" },
  pending: { background: "rgba(var(--grey-accent-rgb), 0.8)", color: "var(--info-dark)" },
  allocated: { background: "rgba(var(--info-rgb), 0.8)", color: "var(--info-dark)" },
  picked: { background: "rgba(var(--accent-purple-rgb), 0.8)", color: "var(--accent-purple)" },
  fitted: { background: "rgba(var(--success-rgb), 0.8)", color: "var(--info-dark)" },
};

const SOURCE_META = {
  vhc_red: { label: "VHC Red", background: "rgba(var(--danger-rgb), 0.2)", color: "var(--danger)" },
  vhc_amber: { label: "VHC Amber", background: "rgba(var(--warning-rgb), 0.25)", color: "var(--danger-dark)" },
  vhc: { label: "VHC", background: "rgba(var(--danger-rgb), 0.15)", color: "var(--danger)" },
  vhc_auto: { label: "VHC Auto-Order", background: "rgba(var(--danger-rgb), 0.15)", color: "var(--danger)" },
  tech_request: { label: "Tech Request", background: "rgba(var(--info-rgb), 0.18)", color: "var(--accent-purple)" },
  parts_workspace: { label: "Manual", background: "rgba(var(--grey-accent-rgb), 0.3)", color: "var(--info-dark)" },
  manual: { label: "Manual", background: "rgba(var(--grey-accent-rgb), 0.3)", color: "var(--info-dark)" },
};

const EMPTY_PIPELINE_SUMMARY = summarizePartsPipeline([]);

const OPEN_REQUEST_STATUSES = ["waiting_authorisation", "pending", "awaiting_stock", "on_order"];

const formatStatusLabel = (status) =>
  status ? status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "Unknown";

const resolveStatusStyles = (status) => STATUS_COLOR_MAP[status] || { background: "rgba(var(--grey-accent-rgb), 0.8)", color: "var(--info-dark)" };

const resolveSourceMeta = (origin = "") => {
  const normalized = typeof origin === "string" ? origin.toLowerCase() : "";
  if (SOURCE_META[normalized]) return SOURCE_META[normalized];
  if (normalized.includes("vhc")) return SOURCE_META.vhc;
  if (normalized.includes("tech")) return SOURCE_META.tech_request;
  return SOURCE_META.manual;
};

const needsDeliveryScheduling = (waitingStatus = "") => {
  const normalized = String(waitingStatus || "").toLowerCase();
  return /collect|delivery/.test(normalized);
};

const SourceBadge = ({ label, background, color }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 10px",
      borderRadius: "999px",
      fontSize: "0.75rem",
      fontWeight: 600,
      background,
      color,
    }}
  >
    {label}
  </span>
);

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

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString(undefined, { hour12: false }) : "—";

const buildWorkloadRows = (items = []) =>
  items.map((item) => {
    const job = item.job || {};
    const part = item.part || {};
    const status = item.status || "pending";
    const statusStyles = resolveStatusStyles(status);
    const sourceMeta = resolveSourceMeta(item.origin);
    const monetaryValue = (Number(part.unit_price) || 0) * (Number(item.quantity_requested) || 0);
    const partLabel = part.part_number ? `${part.part_number} · ${part.name || "Part"}` : part.name || "Part";

    return {
      jobId: job.id,
      jobNumber: job.job_number || "—",
      reg: job.vehicle_reg || "—",
      waitingStatus: job.waiting_status || job.status || "",
      advisor: (
        <div>
          <div style={{ fontWeight: 600 }}>{partLabel}</div>
          <div style={{ marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
            <SourceBadge label={sourceMeta.label} background={sourceMeta.background} color={sourceMeta.color} />
          </div>
        </div>
      ),
      neededBy: job.waiting_status || job.status || "—",
      status: formatStatusLabel(status),
      statusColor: statusStyles.background,
      statusTextColor: statusStyles.color,
      value: formatCurrency(monetaryValue),
    };
  });

const groupByJobId = (items = []) =>
  items.reduce((acc, stop) => {
    const jobId = stop.job_id;
    if (!jobId) return acc;
    if (!acc[jobId]) acc[jobId] = [];
    acc[jobId].push(stop);
    return acc;
  }, {});

const buildTeamBuckets = (items = []) => {
  const grouped = items.reduce((acc, item) => {
    const key = item.status || "pending";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped).map(([status, count]) => ({
    name: formatStatusLabel(status),
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

const buildTeamPerformance = (items = []) =>
  items.slice(0, 5).map((item) => {
    const job = item.job || {};
    const part = item.part || {};
    const sourceMeta = resolveSourceMeta(item.origin);
    return {
      name: job.job_number || "—",
      role: part.part_number ? `${part.part_number} · ${part.name || "Part"}` : part.name || "Part",
      fillRate: formatStatusLabel(item.status || "pending"),
      accuracy: sourceMeta.label,
      picksPerHour: job.waiting_status || job.status || "N/A",
      valuePerDay: formatCurrency((Number(part.unit_price) || 0) * (Number(item.quantity_requested) || 0)),
    };
  });

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
    teamPerformance: [],
    techRequests: [],
    pipelineSummary: EMPTY_PIPELINE_SUMMARY,
  });
  const [deliveryRoutes, setDeliveryRoutes] = useState([]);
  const [jobDeliveryMap, setJobDeliveryMap] = useState({});
  const [scheduleModalJob, setScheduleModalJob] = useState(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const refreshJobDeliveryMap = useCallback(
    async (jobIds = []) => {
      if (!jobIds.length) {
        setJobDeliveryMap({});
        return;
      }
      const { data, error } = await supabaseClient
        .from("delivery_stops")
        .select("job_id, status, stop_number, delivery:deliveries(id, delivery_date, vehicle_reg)")
        .in("job_id", jobIds)
        .in("status", ["planned", "en_route"])
        .order("stop_number", { ascending: true });
      if (error) {
        console.error("Failed to load delivery stops for jobs:", error);
        return;
      }
      setJobDeliveryMap(groupByJobId(data || []));
    },
    []
  );

  const openScheduleModalForRow = useCallback((row) => {
    if (!row?.jobId) return;
    setScheduleModalJob({
      id: row.jobId,
      job_number: row.jobNumber,
      waiting_status: row.waitingStatus,
    });
    setIsScheduleModalOpen(true);
  }, []);

  const closeScheduleModal = useCallback(() => {
    setIsScheduleModalOpen(false);
    setScheduleModalJob(null);
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!isManager) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, deliveriesResponse, jobItemsResponse, techRequestsResponse] = await Promise.all([
        fetch("/api/parts/summary").then((res) => res.json()),
        fetch("/api/parts/deliveries?limit=5").then((res) => res.json()),
        supabaseClient
          .from("parts_job_items")
          .select(
            `id, status, origin, quantity_requested, created_at, job:jobs(id, job_number, vehicle_reg, waiting_status, status), part:parts_catalog(part_number, name, supplier, unit_price)`
          )
          .in("status", [
            "waiting_authorisation",
            "pending",
            "awaiting_stock",
            "on_order",
            "pre_picked",
            "stock",
            "allocated",
            "picked",
          ])
          .order("created_at", { ascending: false })
          .limit(8),
        supabaseClient
          .from("parts_requests")
          .select(
            `request_id, part_id, job_id, quantity, status, source, description, created_at,
             job:jobs!inner(job_number, waiting_status),
             part:parts_catalog(part_number, name)`
          )
          .in("status", OPEN_REQUEST_STATUSES)
          .order("created_at", { ascending: false })
          .limit(10),
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

      if (techRequestsResponse.error) {
        throw new Error(techRequestsResponse.error.message || "Unable to load tech requests");
      }

      const summary = summaryResponse.summary || {};
      const lowStock = summary.lowStockParts || [];
      const jobRows = jobItemsResponse.data || [];
      const techRequests = techRequestsResponse.data || [];
      const pipelineSummary = summarizePartsPipeline(jobRows, {
        quantityField: "quantity_requested",
      });

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

      setDeliveryRoutes(deliveriesResponse.deliveries || []);
      await refreshJobDeliveryMap(jobRows.map((row) => row.job?.id).filter(Boolean));

      setDashboardData({
        summaryCards,
        workload: buildWorkloadRows(jobRows),
        focusItems: buildFocusItems(lowStock),
        inventoryAlerts: lowStock,
        deliveries: (deliveriesResponse.deliveries || []).map((delivery) => ({
          supplier: delivery.supplier || "Unknown supplier",
          eta: delivery.expected_date || delivery.received_date || "TBC",
          items: (delivery.delivery_items || []).length,
          reference: delivery.order_reference || delivery.id,
        })),
        teamAvailability: buildTeamBuckets(jobRows),
        teamPerformance: buildTeamPerformance(jobRows),
        pipelineSummary,
        techRequests,
      });
    } catch (err) {
      console.error("Failed to load parts manager data", err);
      setError(err.message || "Unable to load parts dashboard");
    } finally {
      setLoading(false);
    }
  }, [isManager, refreshJobDeliveryMap]);

  useEffect(() => {
    loadDashboard();
  }, [isManager, loadDashboard]);

  const pipelineSummary = dashboardData.pipelineSummary || { stageSummary: [], totalCount: 0 };
  const pipelineStages = pipelineSummary.stageSummary || [];
  const teamPerformance = dashboardData.teamPerformance || [];

  const lowStockRows = useMemo(() => dashboardData.inventoryAlerts || [], [
    dashboardData.inventoryAlerts,
  ]);
  const techRequests = dashboardData.techRequests || [];

  if (!isManager) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>
          Only the parts manager can view this dashboard.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {loading ? (
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>
          Loading parts manager dashboard…
        </div>
      ) : error ? (
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>{error}</div>
      ) : (
        <>
          <PartsOpsDashboard
            title="Parts Manager Dashboard"
            subtitle="Live queue, inbound deliveries and inventory status pulled from Supabase"
            data={dashboardData}
          />

          <div style={sectionCardStyle}>
            <div style={sectionTitleStyle}>Parts Pipeline</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              {pipelineStages.map((stage) => (
                <div
                  key={stage.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid rgba(var(--primary-rgb),0.2)",
                    background: "rgba(var(--danger-rgb), 0.4)",
                    minHeight: "100px",
                  }}
                >
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)" }}>
                    {stage.count}
                  </div>
                  <div style={{ fontWeight: 600 }}>{stage.label}</div>
                  <p style={{ margin: "6px 0 0 0", fontSize: "0.8rem", color: "var(--grey-accent-dark)" }}>
                    {stage.description}
                  </p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "12px", fontSize: "0.9rem", color: "var(--grey-accent-dark)" }}>
              {pipelineSummary.totalCount} part line
              {pipelineSummary.totalCount === 1 ? "" : "s"} currently tracked in the pipeline.
            </div>
          </div>

          <div style={containerStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: "20px" }}>
              <div style={sectionCardStyle}>
                <div style={sectionTitleStyle}>Queue Snapshot</div>
                <table style={performanceTableStyle}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--grey-accent)", fontSize: "0.85rem" }}>
                      <th style={{ paddingBottom: "10px" }}>Job</th>
                      <th style={{ paddingBottom: "10px" }}>Delivery</th>
                      <th style={{ paddingBottom: "10px" }}>Reg</th>
                      <th style={{ paddingBottom: "10px" }}>Supplier</th>
                      <th style={{ paddingBottom: "10px" }}>Status</th>
                      <th style={{ paddingBottom: "10px", textAlign: "right" }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.workload.map((row) => {
                      const deliveryInfo = jobDeliveryMap[row.jobId || ""]?.[0] || null;
                      const deliveryDate = deliveryInfo?.delivery?.delivery_date;
                      const needsSchedule = needsDeliveryScheduling(row.waitingStatus);
                      return (
                        <tr
                          key={`${row.jobNumber}-${row.advisor}-${row.jobId}`}
                          style={{ borderTop: "1px solid rgba(var(--shadow-rgb),0.06)" }}
                        >
                          <td style={{ padding: "12px 0" }}>{row.jobNumber}</td>
                          <td style={{ padding: "12px 0" }}>
                            {deliveryInfo ? (
                              <div>
                                <div style={{ fontWeight: 600 }}>Stop {deliveryInfo.stop_number}</div>
                                <div style={{ fontSize: "0.8rem", color: "var(--grey-accent-dark)" }}>
                                  {deliveryDate ? new Date(deliveryDate).toLocaleDateString() : "Delivery scheduled"}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "var(--info)" }}>None</span>
                            )}
                            {needsSchedule && (
                              <button
                                type="button"
                                onClick={() => openScheduleModalForRow(row)}
                                style={{
                                  marginTop: "6px",
                                  borderRadius: "8px",
                                  border: "1px solid var(--accent-purple)",
                                  background: "var(--surface)",
                                  color: "var(--accent-purple)",
                                  padding: "4px 10px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  fontSize: "0.75rem",
                                }}
                              >
                                Schedule Delivery
                              </button>
                            )}
                          </td>
                          <td style={{ padding: "12px 0" }}>{row.reg}</td>
                          <td style={{ padding: "12px 0" }}>{row.advisor}</td>
                          <td style={{ padding: "12px 0" }}>{row.status}</td>
                          <td style={{ padding: "12px 0", textAlign: "right", fontWeight: 600 }}>{row.value}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={sectionCardStyle}>
                  <div style={sectionTitleStyle}>Status Buckets</div>
                  {dashboardData.teamAvailability.map((bucket) => (
                    <div
                      key={bucket.name}
                      style={{ padding: "10px 0", borderBottom: "1px solid rgba(var(--shadow-rgb),0.06)" }}
                    >
                      <div style={{ fontWeight: 600 }}>{bucket.name}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--grey-accent)" }}>{bucket.status}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--primary-dark)", marginTop: "4px" }}>{bucket.window}</div>
                    </div>
                  ))}
                </div>

                <div style={sectionCardStyle}>
                  <div style={sectionTitleStyle}>Focus Items</div>
                  {dashboardData.focusItems.map((item) => (
                    <div key={item.title} style={{ padding: "10px 0", borderBottom: "1px solid rgba(var(--shadow-rgb),0.06)" }}>
                      <div style={{ fontWeight: 600 }}>{item.title}</div>
                      <div style={{ color: "var(--grey-accent)", fontSize: "0.85rem" }}>{item.detail}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--primary-dark)", marginTop: "4px" }}>{item.owner}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>Top Queue Lines</div>
              <table style={performanceTableStyle}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--grey-accent)", fontSize: "0.85rem" }}>
                    <th style={{ paddingBottom: "10px" }}>Line</th>
                    <th style={{ paddingBottom: "10px" }}>Supplier</th>
                    <th style={{ paddingBottom: "10px" }}>Status</th>
                    <th style={{ paddingBottom: "10px", textAlign: "right" }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {teamPerformance.map((row) => (
                    <tr key={row.name} style={{ borderTop: "1px solid rgba(var(--shadow-rgb),0.06)" }}>
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
                <div style={{ color: "var(--grey-accent)" }}>No low stock parts currently.</div>
              ) : (
                <table style={performanceTableStyle}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--grey-accent)", fontSize: "0.85rem" }}>
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
                      <tr key={part.id} style={{ borderTop: "1px solid rgba(var(--shadow-rgb),0.06)" }}>
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

          <div style={sectionCardStyle}>
            <div style={sectionTitleStyle}>Tech Requests</div>
            {techRequests.length === 0 ? (
              <div style={{ color: "var(--grey-accent)" }}>No open technician requests.</div>
            ) : (
              <table style={performanceTableStyle}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--grey-accent)", fontSize: "0.85rem" }}>
                      <th style={{ paddingBottom: "10px" }}>Job</th>
                      <th style={{ paddingBottom: "10px" }}>Request</th>
                      <th style={{ paddingBottom: "10px" }}>Qty</th>
                      <th style={{ paddingBottom: "10px" }}>Source</th>
                      <th style={{ paddingBottom: "10px" }}>Status</th>
                      <th style={{ paddingBottom: "10px" }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {techRequests.map((request) => {
                      const sourceMeta = resolveSourceMeta(request.source);
                      const statusMeta = resolveStatusStyles(request.status || "waiting_authorisation");
                      return (
                        <tr key={request.request_id} style={{ borderTop: "1px solid rgba(var(--shadow-rgb),0.06)" }}>
                          <td style={{ padding: "12px 0" }}>{request.job?.job_number || `#${request.job_id}`}</td>
                          <td style={{ padding: "12px 0" }}>
                            <div style={{ fontWeight: 600 }}>{request.description || "Part request"}</div>
                            {request.part ? (
                              <div style={{ fontSize: "0.8rem", color: "var(--info)" }}>
                                {request.part.part_number} · {request.part.name}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ padding: "12px 0" }}>{request.quantity || 1}</td>
                          <td style={{ padding: "12px 0" }}>
                            <SourceBadge
                              label={sourceMeta.label}
                              background={sourceMeta.background}
                              color={sourceMeta.color}
                            />
                          </td>
                          <td style={{ padding: "12px 0" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "2px 10px",
                                borderRadius: "999px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                background: statusMeta.background,
                                color: statusMeta.color,
                              }}
                            >
                              {formatStatusLabel(request.status || "waiting_authorisation")}
                            </span>
                          </td>
                          <td style={{ padding: "12px 0" }}>{formatDateTime(request.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
              </table>
            )}
          </div>
        </div>
      </>
    )}
      <DeliverySchedulerModal
        open={isScheduleModalOpen}
        onClose={closeScheduleModal}
        job={scheduleModalJob}
        deliveries={deliveryRoutes}
        onScheduled={() => loadDashboard()}
      />
  </Layout>
);
}
