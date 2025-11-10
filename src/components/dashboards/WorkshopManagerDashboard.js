// file location: src/components/dashboards/WorkshopManagerDashboard.js
import React, { useEffect, useMemo, useState } from "react"; // import React and hooks for stateful UI logic
import Link from "next/link"; // import Next.js Link for client-side navigation
import { getJobsByDate } from "../../lib/database/jobs";
import { useClockingContext } from "../../context/ClockingContext";
import dayjs from "dayjs";
import { consumableOrderHistory } from "../../lib/data/consumablesSample";

const monthKey = (dateString) => dayjs(dateString).format("YYYY-MM");
const monthLabel = (key) => dayjs(`${key}-01`).format("MMMM YYYY");
const availableConsumableMonths = Array.from(
  new Set(consumableOrderHistory.map((item) => monthKey(item.lastOrderedDate)))
).sort((a, b) => (a > b ? -1 : 1));

export default function WorkshopManagerDashboard() {
  const quickActions = [
    { label: "Create Job Card", href: "/job-cards/create" }, // jump to the job card creation flow
    { label: "Appointments", href: "/job-cards/appointments" }, // open the workshop appointment planner
    { label: "Check In", href: "/workshop/check-in" }, // launch the technician check-in screen
  ];
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
    <div style={{ padding: "24px" }}> {/* outer wrapper that matches dashboard padding */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginBottom: "24px",
        }}
      > {/* section for the quick access buttons */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
          }}
        > {/* row layout so buttons stay on a single visual line */}
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 18px",
                borderRadius: "999px",
                border: "1px solid #ffb3b3",
                backgroundColor: "#ffffff",
                color: "#b10000",
                fontWeight: 600,
                fontSize: "0.9rem",
                textDecoration: "none",
                boxShadow: "0 8px 16px rgba(209,0,0,0.08)",
                transition: "background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = "#b10000";
                event.currentTarget.style.color = "#ffffff";
                event.currentTarget.style.boxShadow = "0 16px 32px rgba(177,0,0,0.18)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = "#ffffff";
                event.currentTarget.style.color = "#b10000";
                event.currentTarget.style.boxShadow = "0 8px 16px rgba(209,0,0,0.08)";
              }}
            >
              {action.label} {/* button text with no emojis per requirements */}
            </Link>
          ))}
        </div>
      </section>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#FF4040", marginBottom: "16px" }}>
        Workshop Manager Dashboard
      </h1>

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
