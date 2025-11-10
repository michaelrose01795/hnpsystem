// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/dashboards/WorkshopManagerDashboard.js
import React, { useEffect, useMemo, useState } from "react"; // import React and hooks for stateful UI logic
import Link from "next/link";
import { getJobsByDate } from "@/lib/database/jobs";
import { useClockingContext } from "@/context/ClockingContext";
import dayjs from "dayjs";
import { consumableOrderHistory } from "@/lib/data/consumablesSample";

const monthKey = (dateString) => dayjs(dateString).format("YYYY-MM");
const monthLabel = (key) => dayjs(`${key}-01`).format("MMMM YYYY");
const availableConsumableMonths = Array.from(
  new Set(consumableOrderHistory.map((item) => monthKey(item.lastOrderedDate)))
).sort((a, b) => (a > b ? -1 : 1));

const quickActions = [
  { label: "Create Job Card", href: "/job-cards/create" },
  { label: "Appointments", href: "/job-cards/appointments" },
  { label: "Check In", href: "/workshop/check-in" },
];

const workflowMetrics = [
  { label: "Jobs On Site", value: "18", helper: "4 awaiting triage", accent: "#d10000" },
  { label: "Technicians Clocked In", value: "11 / 14", helper: "2 due back 13:00", accent: "#a00000" },
  { label: "Awaiting Parts", value: "6", helper: "TPS van ETA 12:45", accent: "#ff6b6b" },
  { label: "QC / Road Test", value: "3", helper: "2 require sign off", accent: "#ef4444" },
];

const technicianFocus = [
  { tech: "Jordan P", job: "JC1421 • VHC", next: "Awaiting authorisation", color: "#d10000" },
  { tech: "Aisha L", job: "JC1430 • Timing belt", next: "Parts eta 30 mins", color: "#a00000" },
  { tech: "Liam S", job: "JC1427 • MOT & service", next: "Road test 14:15", color: "#ef4444" },
];

const bayReadiness = [
  { bay: "EV Bay", status: "Charging fault", action: "Mobile charger connected", tone: "#f97316" },
  { bay: "Alignment", status: "Ready", action: "Next slot 13:30", tone: "#16a34a" },
  { bay: "Fast Fit", status: "Full", action: "Clear JC1409 ASAP", tone: "#dc2626" },
];

export default function WorkshopManagerDashboard() {
  const [pendingJobs, setPendingJobs] = useState([]);
  const { allUsersClocking, fetchAllUsersClocking, loading } = useClockingContext();
  const today = dayjs().format("YYYY-MM-DD");
  const [isConsumablesModalOpen, setConsumablesModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    availableConsumableMonths[0] || dayjs().format("YYYY-MM")
  );

  useEffect(() => {
    const fetchJobs = async () => {
      const jobsToday = await getJobsByDate(today);
      setPendingJobs(jobsToday.filter((j) => j.job.status === "Booked"));
    };
    fetchJobs();
    fetchAllUsersClocking?.();
  }, [fetchAllUsersClocking, today]);

  const consumablesForMonth = useMemo(
    () =>
      consumableOrderHistory.filter(
        (item) => monthKey(item.lastOrderedDate) === selectedMonth
      ),
    [selectedMonth]
  );

  if (loading && !Array.isArray(allUsersClocking)) return <p>Loading dashboard...</p>;

  const clockingList = Array.isArray(allUsersClocking) ? allUsersClocking : [];
  const techsClockedIn = clockingList.filter((u) => u.roles?.includes("Techs") && u.clockedIn).length;
  const totalTechs = clockingList.filter((u) => u.roles?.includes("Techs")).length;
  const monthOptions = availableConsumableMonths.length ? availableConsumableMonths : [selectedMonth];

  const modalOverlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 1000,
  };

  const modalCardStyle = {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "24px",
    width: "min(960px, 100%)",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 30px 60px rgba(0,0,0,0.2)",
  };

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
      <header
        style={{
          borderRadius: "18px",
          padding: "24px",
          border: "1px solid #ffd4d4",
          background: "linear-gradient(120deg, #fff5f5, #ffecec)",
          boxShadow: "0 24px 45px rgba(209,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <span style={{ textTransform: "uppercase", letterSpacing: "0.15em", fontSize: "0.78rem", color: "#b10000" }}>
          Workshop Manager Command Room
        </span>
        <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#8c0000" }}>Technical Flow Control</h1>
        <p style={{ margin: 0, color: "#6b7280" }}>
          {dayjs().format("dddd, D MMM")} • {pendingJobs.length} pending • {techsClockedIn}/{totalTechs} techs clocked in
        </p>
      </header>

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          background: "#fff",
          padding: "14px 20px",
          borderRadius: "16px",
          border: "1px solid #ffe0e0",
          boxShadow: "0 18px 40px rgba(209,0,0,0.08)",
        }}
      >
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 20px",
              borderRadius: "999px",
              border: "1px solid #ffb3b3",
              backgroundColor: "#ffffff",
              color: "#b10000",
              fontWeight: 600,
              fontSize: "0.9rem",
              textDecoration: "none",
              boxShadow: "0 10px 24px rgba(209,0,0,0.12)",
            }}
          >
            {action.label}
          </Link>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {workflowMetrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              borderRadius: "18px",
              padding: "18px",
              background: "#fff",
              border: `1px solid ${metric.accent}22`,
              boxShadow: "0 18px 35px rgba(209,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.78rem", color: "#6b7280" }}>
              {metric.label}
            </span>
            <strong style={{ fontSize: "1.8rem", color: metric.accent }}>{metric.value}</strong>
            <span style={{ color: "#4b5563", fontSize: "0.85rem" }}>{metric.helper}</span>
          </div>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.2fr) minmax(280px, 0.9fr)",
          gap: "18px",
        }}
      >
        <article
          style={{
            background: "#fff",
            borderRadius: "18px",
            padding: "20px",
            border: "1px solid #ffd4d4",
            boxShadow: "0 22px 45px rgba(209,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#b10000" }}>Technician Focus</h2>
            <p style={{ margin: "4px 0 0", color: "#6b7280" }}>Live callouts from the floor</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {technicianFocus.map((item) => (
              <div
                key={item.tech}
                style={{
                  border: `1px solid ${item.color}33`,
                  borderRadius: "14px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  background: "#fff7f7",
                }}
              >
                <strong style={{ color: item.color }}>{item.tech}</strong>
                <span style={{ fontWeight: 600, color: "#111827" }}>{item.job}</span>
                <small style={{ color: "#6b7280" }}>{item.next}</small>
              </div>
            ))}
          </div>
        </article>

        <article
          style={{
            background: "#fff",
            borderRadius: "18px",
            padding: "20px",
            border: "1px solid #ffd4d4",
            boxShadow: "0 22px 45px rgba(209,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#b10000" }}>Bay Readiness</h2>
            <p style={{ margin: "4px 0 0", color: "#6b7280" }}>Next actions per specialist bay</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {bayReadiness.map((bay) => (
              <div
                key={bay.bay}
                style={{
                  padding: "12px 14px",
                  borderRadius: "14px",
                  border: `1px solid ${bay.tone}33`,
                  background: "#fffafa",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <strong style={{ color: bay.tone }}>{bay.bay}</strong>
                <span style={{ color: "#111827", fontWeight: 600 }}>{bay.status}</span>
                <small style={{ color: "#6b7280" }}>{bay.action}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "12px" }}>Pending Jobs</h2>
        <div style={{ padding: "12px", backgroundColor: "#FFF0F0", borderRadius: "6px" }}>
          <p>{pendingJobs.length} vehicles are waiting for inspection.</p>
        </div>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "12px" }}>Clocking Overview</h2>
        <div style={{ padding: "12px", backgroundColor: "#FFF0F0", borderRadius: "6px" }}>
          <p>Technicians clocked in: {techsClockedIn} / {totalTechs}</p>
        </div>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "12px" }}>Consumables</h2>
        <div style={{ padding: "12px", backgroundColor: "#FFF0F0", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <p style={{ margin: 0 }}>Review recent consumable orders and spend by month.</p>
          <button
            type="button"
            onClick={() => setConsumablesModalOpen(true)}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #d10000, #940000)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 12px 24px rgba(209,0,0,0.2)",
            }}
          >
            View Consumable Orders
          </button>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "12px" }}>Important Notices</h2>
        <div style={{ padding: "12px", backgroundColor: "#FFF0F0", borderRadius: "6px" }}>
          <p>Remember to review workshop safety guidelines.</p>
        </div>
      </section>

      {isConsumablesModalOpen && (
        <div style={modalOverlayStyle} role="dialog" aria-modal="true">
          <div style={modalCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
              <div>
                <h2 style={{ margin: 0, color: "#b10000" }}>Workshop Consumable Orders</h2>
                <p style={{ margin: "6px 0 0", color: "#555" }}>
                  Month view so you can see when each consumable was last ordered, quantities, and cost impact.
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
                  color: "#b10000",
                }}
                aria-label="Close consumables modal"
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: "20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <label htmlFor="consumable-month" style={{ fontWeight: 600, color: "#b10000" }}>
                Month
              </label>
              <select
                id="consumable-month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid #ffb3b3",
                  fontSize: "0.95rem",
                }}
              >
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {monthLabel(month)}
                  </option>
                ))}
              </select>
              <span style={{ color: "#777", fontSize: "0.9rem" }}>
                Showing orders from {monthLabel(selectedMonth)}.
              </span>
            </div>

            <div style={{ marginTop: "20px", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px", color: "#a00000", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Name
                    </th>
                    <th style={{ textAlign: "left", padding: "8px", color: "#a00000", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Last Ordered
                    </th>
                    <th style={{ textAlign: "left", padding: "8px", color: "#a00000", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Avg. Order Gap
                    </th>
                    <th style={{ textAlign: "left", padding: "8px", color: "#a00000", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Qty Ordered
                    </th>
                    <th style={{ textAlign: "left", padding: "8px", color: "#a00000", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Total Cost
                    </th>
                    <th style={{ textAlign: "left", padding: "8px", color: "#a00000", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Supplier
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {consumablesForMonth.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "16px", textAlign: "center", color: "#777" }}>
                        No consumable orders recorded for this month.
                      </td>
                    </tr>
                  ) : (
                    consumablesForMonth.map((item) => {
                      const frequencyWeeks = (item.reorderFrequencyDays / 7).toFixed(1);
                      const totalCost = item.quantityPerOrder * item.unitCost;
                      return (
                        <tr key={item.id} style={{ backgroundColor: "#fff7f7", borderRadius: "12px" }}>
                          <td style={{ padding: "12px", fontWeight: 600, color: "#333" }}>{item.name}</td>
                          <td style={{ padding: "12px", color: "#555" }}>{dayjs(item.lastOrderedDate).format("DD MMM YYYY")}</td>
                          <td style={{ padding: "12px", color: "#555" }}>{frequencyWeeks} weeks</td>
                          <td style={{ padding: "12px", color: "#555" }}>{item.quantityPerOrder}</td>
                          <td style={{ padding: "12px", color: "#555" }}>£{totalCost.toFixed(2)}</td>
                          <td style={{ padding: "12px", color: "#555" }}>{item.supplier}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
