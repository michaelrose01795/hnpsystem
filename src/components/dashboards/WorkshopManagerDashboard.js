// file location: src/components/dashboards/WorkshopManagerDashboard.js
import React, { useEffect, useMemo, useState } from "react";import LayerSurface from "@/components/ui/LayerSurface";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { supabase } from "@/lib/database/supabaseClient";
import { getWorkshopDashboardData } from "@/lib/database/dashboard/workshop";
import { listConsumablesForTracker } from "@/lib/database/consumables";
import ModalPortal from "@/components/popups/ModalPortal";
import { SectionCard } from "@/components/Section"; // section card layout — ghost chain removed
import { formatCurrency } from "@/components/dashboards/DashboardPrimitives"; // currency formatter
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

dayjs.extend(relativeTime);

const defaultDashboardData = {
  dailySummary: { inProgress: 0, checkedInToday: 0, completedToday: 0 },
  technicianAvailability: { totalTechnicians: 0, onJobs: 0, available: 0 },
  progress: { completed: 0, scheduled: 1 },
  queue: [],
  outstandingVhc: [],
  trends: { checkInsLast7: [] },
  latestStatusUpdates: []
};

const monthKey = (value) => value ? dayjs(value).format("YYYY-MM") : "";
const monthLabel = (key) => dayjs(`${key}-01`).format("MMMM YYYY");
const formatTime = (value) => value ? dayjs(value).format("HH:mm") : "—";
const formatTechnicianName = (tech) =>
`${tech?.first_name || ""} ${tech?.last_name || ""}`.trim() || "Technician";
const formatNoticeMessage = (message = "") =>
  String(message).replace(/^\s*(?:ℹ️|ℹ|ⓘ|i)\s*/i, "").trim();

const findStatusTone = (text = "") => {
  const normalized = text.toLowerCase();
  if (normalized.includes("ready") || normalized.includes("clear")) {
    return "var(--text-accent)";
  }
  if (normalized.includes("wait") || normalized.includes("hold")) {
    return "var(--text-accent)";
  }
  return "var(--text-accent)";
};

export default function WorkshopManagerDashboard() {
  const [dashboardData, setDashboardData] = useState(defaultDashboardData);
  const [dashboardError, setDashboardError] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [activeClocking, setActiveClocking] = useState([]);
  const [clockingError, setClockingError] = useState("");
  const [clockingLoading, setClockingLoading] = useState(true);

  const [consumableOrders, setConsumableOrders] = useState([]);
  const [consumableError, setConsumableError] = useState("");
  const [consumableLoading, setConsumableLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [isConsumablesModalOpen, setConsumablesModalOpen] = useState(false);

  const [notices, setNotices] = useState([]);
  const [noticesError, setNoticesError] = useState("");
  const [noticesLoading, setNoticesLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setDashboardLoading(true);
      setDashboardError("");
      try {
        const data = await getWorkshopDashboardData();
        setDashboardData(data ?? defaultDashboardData);
      } catch (err) {
        console.error("Failed to load workshop dashboard data", err);
        setDashboardError(err?.message || "Unable to load workshop data.");
        setDashboardData(defaultDashboardData);
      } finally {
        setDashboardLoading(false);
      }
    };
    loadDashboard();
  }, []);

  useEffect(() => {
    const loadTechnicianActivity = async () => {
      setClockingLoading(true);
      setClockingError("");
      try {
        const { data, error } = await supabase.
        from("job_clocking").
        select(
          `
            id,
            job_number,
            job_id,
            clock_in,
            work_type,
            job:job_id (
              job_number,
              status,
              vehicle_reg,
              vehicle_make_model
            ),
            technician:user_id (
              user_id,
              first_name,
              last_name,
              role
            )
          `
        ).
        is("clock_out", null).
        order("clock_in", { ascending: true });

        if (error) {
          throw error;
        }

        const mapped = (data || []).map((entry) => ({
          id: entry.id,
          techName: formatTechnicianName(entry.technician),
          jobNumber: entry.job?.job_number || entry.job_number || "—",
          vehicle:
          entry.job?.vehicle_make_model ||
          entry.job?.vehicle_reg ||
          "Workshop job",
          status: entry.job?.status || "In progress",
          startedAt: entry.clock_in
        }));

        setActiveClocking(mapped);
      } catch (err) {
        console.error("Failed to load technician focus data", err);
        setClockingError(err?.message || "Unable to load live technician data.");
        setActiveClocking([]);
      } finally {
        setClockingLoading(false);
      }
    };

    loadTechnicianActivity();
  }, []);

  useEffect(() => {
    const loadConsumables = async () => {
      setConsumableLoading(true);
      setConsumableError("");
      try {
        const tracker = await listConsumablesForTracker();
        const orders = (tracker.items || []).flatMap((item) =>
        (item.orderHistory || []).map((order, index) => ({
          id: `${item.id}-${order.date}-${index}`,
          name: item.name,
          lastOrderedDate: order.date,
          reorderFrequencyDays: item.reorderFrequencyDays,
          quantity: order.quantity,
          totalCost: order.totalCost,
          supplier: order.supplier || item.supplier || "—",
          monthKey: monthKey(order.date)
        }))
        );

        orders.sort(
          (a, b) =>
          new Date(b.lastOrderedDate).getTime() -
          new Date(a.lastOrderedDate).getTime()
        );

        setConsumableOrders(orders);
        if (!selectedMonth && orders.length > 0) {
          setSelectedMonth(orders[0].monthKey);
        }
      } catch (err) {
        console.error("Failed to load consumable orders", err);
        setConsumableError(err?.message || "Unable to load consumable data.");
        setConsumableOrders([]);
        if (!selectedMonth) {
          setSelectedMonth(monthKey(new Date().toISOString()));
        }
      } finally {
        setConsumableLoading(false);
      }
    };

    loadConsumables();
  }, []);

  useEffect(() => {
    const loadNotices = async () => {
      setNoticesLoading(true);
      setNoticesError("");
      try {
        const { data, error } = await supabase.
        from("notifications").
        select("notification_id,message,target_role,created_at").
        or("target_role.is.null,target_role.ilike.%workshop%").
        order("created_at", { ascending: false }).
        limit(5);

        if (error) {
          throw error;
        }

        setNotices(data || []);
      } catch (err) {
        console.error("Failed to load workshop notices", err);
        setNoticesError(err?.message || "Unable to load notices.");
        setNotices([]);
      } finally {
        setNoticesLoading(false);
      }
    };

    loadNotices();
  }, []);

  const monthOptions = useMemo(() => {
    const months = Array.from(
      new Set(consumableOrders.map((order) => order.monthKey))
    ).sort((a, b) => a > b ? -1 : 1);
    return months.length > 0 ?
    months :
    [monthKey(new Date().toISOString())];
  }, [consumableOrders]);

  useEffect(() => {
    if (!selectedMonth && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[0]);
    }
  }, [monthOptions, selectedMonth]);

  const consumablesForMonth = useMemo(
    () => consumableOrders.filter((order) => order.monthKey === selectedMonth),
    [consumableOrders, selectedMonth]
  );

  const metrics = useMemo(() => {
    const queue = dashboardData.queue || [];
    const awaitingParts = queue.filter((job) => {
      const text = `${job.waiting_status || ""} ${job.status || ""}`.toLowerCase();
      return text.includes("part");
    }).length;
    const qcOrRoadTest = queue.filter((job) => {
      const text = `${job.waiting_status || ""} ${job.status || ""}`.toLowerCase();
      return text.includes("qc") || text.includes("road");
    }).length;

    return [
    {
      label: "Jobs On Site",
      value: dashboardData.dailySummary.inProgress,
      helper: `${queue.length} waiting in queue`,
      accent: "var(--text-accent)"
    },
    {
      label: "Technicians Clocked In",
      value: `${dashboardData.technicianAvailability.onJobs} / ${dashboardData.technicianAvailability.totalTechnicians}`,
      helper: `${dashboardData.technicianAvailability.available} available`,
      accent: "var(--text-accent)"
    },
    {
      label: "Awaiting Parts",
      value: awaitingParts,
      helper: awaitingParts ? "Waiting on suppliers" : "All parts allocated",
      accent: "var(--text-accent)"
    },
    {
      label: "QC / Road Test",
      value: qcOrRoadTest,
      helper: qcOrRoadTest ? "Needs inspection" : "No QC backlog",
      accent: "var(--text-accent)"
    }];

  }, [dashboardData]);

  const technicianFocus = useMemo(() => {
    const liveEntries = activeClocking.slice(0, 3).map((entry) => ({
      key: entry.id,
      tech: entry.techName,
      job: entry.jobNumber,
      next: entry.vehicle,
      status: entry.status,
      startedAt: entry.startedAt,
      accent: "var(--text-accent)"
    }));

    if (liveEntries.length >= 3) {
      return liveEntries;
    }

    const queueFallback = (dashboardData.queue || []).
    slice(0, 3 - liveEntries.length).
    map((job, index) => ({
      key: `queue-${job.id || index}`,
      tech: job.waiting_status || job.status || "Queue",
      job: job.job_number || "Job",
      next: job.vehicle_reg || job.vehicle_make_model || "Awaiting assignment",
      status: job.status || "Pending",
      startedAt: job.checked_in_at,
      accent: "var(--text-accent)"
    }));

    return [...liveEntries, ...queueFallback];
  }, [activeClocking, dashboardData.queue]);

  const bayReadiness = useMemo(() => {
    const source =
    (dashboardData.outstandingVhc?.length ?
    dashboardData.outstandingVhc :
    dashboardData.queue) || [];
    return source.slice(0, 3).map((job, index) => {
      const descriptor = job.waiting_status || job.status || "In queue";
      return {
        key: job.id || index,
        bay: job.job_number || job.vehicle_reg || "Workshop Bay",
        status: descriptor,
        action: job.checked_in_at ?
        `Checked in ${formatTime(job.checked_in_at)}` :
        "Awaiting check-in",
        tone: findStatusTone(descriptor)
      };
    });
  }, [dashboardData.outstandingVhc, dashboardData.queue]);

  const formattedNotices = useMemo(
    () =>
    (notices || []).map((notice) => ({
      id: notice.notification_id,
      message: formatNoticeMessage(notice.message),
      targetRole: notice.target_role,
      createdAt: notice.created_at
    })),
    [notices]
  );

  return (
    <DevLayoutSection sectionKey="dashboard-workshop-shell" sectionType="page-shell" shell style={{ color: "var(--text-1)", display: "flex", flexDirection: "column", gap: "10px" }}>
      <DevLayoutSection
        as="section"
        sectionKey="dashboard-workshop-metrics-grid"
        parentKey="dashboard-workshop-shell"
        sectionType="grid-card"
        backgroundToken="accent"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "10px",
          background: "var(--theme)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          border: "none",
          boxShadow: "none"
        }}>

        {dashboardLoading ?
        <LayerSurface as="div"

        style={{
          gridColumn: "1 / -1",
          padding: "18px",
          color: "var(--text-1)"
        }}>

            Loading live workshop metrics…
          </LayerSurface> :
        dashboardError ?
        <LayerSurface as="div"

        style={{
          gridColumn: "1 / -1",
          padding: "18px",

          color: "var(--danger)"
        }}>

            {dashboardError}
          </LayerSurface> :

        metrics.map((metric, index) =>
        <div
          key={metric.label}
          data-dev-section="1"
          data-dev-section-key={`dashboard-workshop-metric-${index + 1}`}
          data-dev-section-type="stat-card"
          data-dev-section-parent="dashboard-workshop-metrics-grid"
          style={{
            borderRadius: "var(--radius-md)",
            padding: "18px",
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}>

              <span
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontSize: "0.78rem",
              color: "var(--text-1)"
            }}>

                {metric.label}
              </span>
              <strong style={{ fontSize: "1.8rem", color: metric.accent }}>
                {metric.value}
              </strong>
              <span style={{ color: "var(--text-1)", fontSize: "0.85rem" }}>
                {metric.helper}
              </span>
            </div>
        )
        }
      </DevLayoutSection>

      <DevLayoutSection
        as="section"
        sectionKey="dashboard-workshop-focus-row"
        parentKey="dashboard-workshop-shell"
        sectionType="grid-card"
        backgroundToken="accent"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "10px",
          alignItems: "stretch",
          background: "var(--theme)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          border: "none",
          boxShadow: "none"
        }}>

        <DevLayoutSection sectionKey="dashboard-workshop-technician-focus" parentKey="dashboard-workshop-focus-row" sectionType="content-card">
          <SectionCard title="Technician Focus" style={{ gap: "12px", height: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {clockingLoading ?
              <p style={{ color: "var(--text-1)" }}>Loading technician activity…</p> :
              clockingError ?
              <p style={{ color: "var(--danger)" }}>{clockingError}</p> :
              technicianFocus.length === 0 ?
              <p style={{ color: "var(--text-1)" }}>No live technician activity recorded.</p> :

              technicianFocus.map((item) =>
              <div
                key={item.key}
                style={{
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  background: "var(--theme)",
                  border: "none",
                  boxShadow: "none"
                }}>

                  <strong style={{ color: item.accent, fontSize: "0.95rem", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {item.tech}
                  </strong>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-1)", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", flexShrink: 0 }}>
                    Job {item.job}
                  </span>
                  <span style={{ color: "var(--text-1)", fontSize: "0.85rem", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.next}
                  </span>
                  {item.startedAt && (
                    <small style={{ color: "var(--text-1)", opacity: 0.65, whiteSpace: "nowrap", flexShrink: 0 }}>
                      Since {formatTime(item.startedAt)}
                    </small>
                  )}
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: "var(--surface)",
                    color: item.accent,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                    flexShrink: 0
                  }}>
                    {item.status}
                  </span>
                </div>
              )
              }
          </div>
          </SectionCard>
        </DevLayoutSection>

        <DevLayoutSection sectionKey="dashboard-workshop-bay-readiness" parentKey="dashboard-workshop-focus-row" sectionType="content-card">
          <SectionCard title="Bay Readiness" style={{ gap: "12px", height: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {dashboardLoading ?
              <p style={{ color: "var(--text-1)" }}>Loading bay readiness…</p> :
              bayReadiness.length === 0 ?
              <p style={{ color: "var(--text-1)" }}>No bays waiting for work.</p> :

              bayReadiness.map((bay) =>
              <div
                key={bay.key}
                style={{
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  background: "var(--theme)",
                  border: "none",
                  boxShadow: "none"
                }}>

                  <strong style={{ color: bay.tone, fontSize: "1rem", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {bay.bay}
                  </strong>
                  <small style={{ color: "var(--text-1)", opacity: 0.85, fontSize: "0.82rem", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {bay.action}
                  </small>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: "var(--surface)",
                    color: bay.tone,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                    flexShrink: 0
                  }}>
                    {bay.status}
                  </span>
                </div>
              )
              }
          </div>
          </SectionCard>
        </DevLayoutSection>
      </DevLayoutSection>

      <DevLayoutSection
        as="section"
        sectionKey="dashboard-workshop-clocking-overview"
        parentKey="dashboard-workshop-shell"
        sectionType="section-shell"
        shell
        backgroundToken="accent"
        style={{
          background: "var(--theme)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          border: "none",
          boxShadow: "none"
        }}>

        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "12px", color: "var(--text-accent)" }}>
          Clocking Overview
        </h2>
        {dashboardLoading ?
        <div
          style={{
            padding: "12px",
            backgroundColor: "var(--surface)",
            borderRadius: "var(--radius-xs)",
            color: "var(--text-1)"
          }}>

            Loading technician availability…
          </div> :

        <div
          style={{
            padding: "12px",
            backgroundColor: "var(--surface)",
            borderRadius: "var(--radius-xs)"
          }}>

            <p style={{ margin: "0 0 6px", color: "var(--text-accent)", fontWeight: 600 }}>
              {dashboardData.technicianAvailability.onJobs} technicians clocked in
            </p>
            <p style={{ margin: 0, color: "var(--text-1)" }}>
              {dashboardData.technicianAvailability.available} available •{" "}
              {dashboardData.technicianAvailability.totalTechnicians} total technicians
            </p>
          </div>
        }
      </DevLayoutSection>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "10px",
          alignItems: "stretch"
        }}>

      <DevLayoutSection
        as="section"
        sectionKey="dashboard-workshop-consumables"
        parentKey="dashboard-workshop-shell"
        sectionType="section-shell"
        shell
        backgroundToken="accent"
        style={{
          background: "var(--theme)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          border: "none",
          boxShadow: "none",
          height: "100%"
        }}>

        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "12px", color: "var(--text-accent)" }}>
          Consumables
        </h2>
        <div
          style={{
            padding: "12px",
            backgroundColor: "var(--surface)",
            borderRadius: "var(--radius-xs)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}>

          <p style={{ margin: 0, color: "var(--text-1)" }}>
            {consumableLoading ?
            "Loading consumable orders…" :
            consumableError || "Review recent consumable orders and spend by month."}
          </p>
          <button
            type="button"
            onClick={() => setConsumablesModalOpen(true)}
            disabled={consumableLoading || !!consumableError && consumableOrders.length === 0}
            style={{
              padding: "10px 18px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: consumableLoading ? "rgba(var(--text-1-rgb), 0.3)" : "var(--text-accent)",
              color: "var(--text-2)",
              fontWeight: 600,
              cursor: consumableLoading ? "not-allowed" : "pointer"
            }}>

            View Consumable Orders
          </button>
        </div>
      </DevLayoutSection>

      <DevLayoutSection
        as="section"
        sectionKey="dashboard-workshop-important-notices"
        parentKey="dashboard-workshop-shell"
        sectionType="section-shell"
        shell
        backgroundToken="accent"
        style={{
          background: "var(--theme)",
          borderRadius: "var(--radius-md)",
          padding: "24px",
          border: "none",
          boxShadow: "none",
          height: "100%"
        }}>

        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "12px", color: "var(--text-accent)" }}>
          Important Notices
        </h2>
        <div
          style={{
            padding: "14px",
            backgroundColor: "var(--surface)",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}>

          {noticesLoading ?
          <p style={{ margin: 0, color: "var(--text-1)" }}>Loading notices…</p> :
          noticesError ?
          <p style={{ margin: 0, color: "var(--danger)" }}>{noticesError}</p> :
          formattedNotices.length === 0 ?
          <p style={{ margin: 0, color: "var(--text-1)" }}>No notices at the moment.</p> :

          formattedNotices.map((notice) =>
          <div
            key={notice.id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(118px, auto) minmax(0, 1fr)",
              gap: "10px 14px",
              alignItems: "center",
              padding: "12px 14px",
              borderRadius: "var(--radius-sm)",
              background: "var(--theme)",
              border: "none",
              boxShadow: "none"
            }}>

                <time
                  dateTime={notice.createdAt}
                  style={{
                    color: "var(--text-accent)",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap"
                  }}>

                  {dayjs(notice.createdAt).format("DD MMM HH:mm")}
                </time>
                <span
                  style={{
                    color: "var(--text-1)",
                    fontSize: "0.92rem",
                    lineHeight: 1.45,
                    overflowWrap: "anywhere"
                  }}>

                  {notice.message || "Workshop notice"}
                </span>
              </div>
          )
          }
        </div>
      </DevLayoutSection>
      </div>

      {isConsumablesModalOpen &&
      <DevLayoutSection sectionKey="dashboard-workshop-consumables-modal-overlay" parentKey="dashboard-workshop-shell" sectionType="floating-action">
          <ModalPortal>
            <div className="popup-backdrop" role="dialog" aria-modal="true">
            <div
              className="popup-card"
              data-dev-section="1"
              data-dev-section-key="dashboard-workshop-consumables-modal-card"
              data-dev-section-type="content-card"
              data-dev-section-parent="dashboard-workshop-consumables-modal-overlay"
              style={{
                borderRadius: "var(--radius-xl)",
                width: "100%",
                maxWidth: "960px",
                maxHeight: "90vh",
                overflowY: "auto",
                border: "none"
              }}>

              <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px"
                  }}>

              <div>
                <h2 style={{ margin: 0, color: "var(--text-accent)" }}>
                  Workshop Consumable Orders
                </h2>
                <p style={{ margin: "6px 0 0", color: "var(--text-1)" }}>
                  Month view showing actual orders recorded in the tracker.
                </p>
              </div>
              <button
                    type="button"
                    onClick={() => setConsumablesModalOpen(false)}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: "1.2rem",
                      cursor: "pointer",
                      color: "var(--text-accent)"
                    }}
                    aria-label="Close consumables modal">

                ✕
              </button>
            </div>

            <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                    alignItems: "center"
                  }}>

              <label
                    htmlFor="consumable-month"
                    style={{ fontWeight: 600, color: "var(--text-accent)" }}>

                Month
              </label>
              <select
                    id="consumable-month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--control-radius-xs)",
                      border: "none",
                      fontSize: "0.95rem",
                      background: "var(--surface)"
                    }}>

                {monthOptions.map((month) =>
                    <option key={month} value={month}>
                    {monthLabel(month)}
                  </option>
                    )}
              </select>
              <span style={{ color: "var(--text-1)", fontSize: "0.9rem" }}>
                Showing orders from {monthLabel(selectedMonth)}.
              </span>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              <table
                    style={{
                      width: "100%",
                      borderCollapse: "separate",
                      borderSpacing: "0 10px"
                    }}>

                <thead>
                  <tr>
                    {["Name", "Ordered", "Qty", "Total Cost", "Supplier"].map((header) =>
                        <th
                          key={header}
                          style={{
                            textAlign: "left",
                            padding: "8px",
                            color: "var(--text-accent)",
                            fontSize: "0.8rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em"
                          }}>

                        {header}
                      </th>
                        )}
                  </tr>
                </thead>
                <tbody>
                  {consumableLoading ?
                      <tr>
                      <td
                          colSpan={5}
                          style={{
                            padding: "16px",
                            textAlign: "center",
                            color: "var(--text-1)"
                          }}>

                        Loading consumable orders…
                      </td>
                    </tr> :
                      consumablesForMonth.length === 0 ?
                      <tr>
                      <td
                          colSpan={5}
                          style={{
                            padding: "16px",
                            textAlign: "center",
                            color: "var(--text-1)"
                          }}>

                        No consumable orders recorded for this month.
                      </td>
                    </tr> :

                      consumablesForMonth.map((item) =>
                      <tr
                        key={item.id}
                        style={{
                          backgroundColor: "var(--theme)",
                          borderRadius: "var(--radius-sm)"
                        }}>

                        <td style={{ padding: "12px", fontWeight: 600, color: "var(--text-1)" }}>
                          {item.name}
                        </td>
                        <td style={{ padding: "12px", color: "var(--text-1)" }}>
                          {dayjs(item.lastOrderedDate).format("DD MMM YYYY")}
                        </td>
                        <td style={{ padding: "12px", color: "var(--text-1)" }}>
                          {item.quantity}
                        </td>
                        <td style={{ padding: "12px", color: "var(--text-1)" }}>
                          {formatCurrency(item.totalCost)}
                        </td>
                        <td style={{ padding: "12px", color: "var(--text-1)" }}>
                          {item.supplier}
                        </td>
                      </tr>
                      )
                      }
                </tbody>
              </table>
              </div>
            </div>
          </div>
          </div>
          </ModalPortal>
        </DevLayoutSection>
      }
    </DevLayoutSection>);

}
