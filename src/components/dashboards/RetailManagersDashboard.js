// file location: src/components/dashboards/RetailManagersDashboard.js
import React, { useMemo } from "react";
import dayjs from "dayjs";
import { roleCategories, usersByRole } from "@/config/users";

const retailManagerRoles = (roleCategories?.Retail || [])
  .filter((roleName) => typeof roleName === "string")
  .filter((roleName) => /manager|director/i.test(roleName));

const baseWorkshopSnapshot = {
  jobsBooked: 42,
  jobsOnSite: 31,
  waitingForParts: 7,
  qaRoadTest: 5,
  techniciansClockedIn: 14,
  techniciansTotal: 16,
  courtesyCarsOut: 11,
  todaysRevenue: 18600,
  estUpsell: 4200,
  throughputTrend: [
    { label: "08:00", jobs: 4 },
    { label: "09:30", jobs: 11 },
    { label: "11:00", jobs: 18 },
    { label: "13:00", jobs: 24 },
    { label: "15:00", jobs: 28 },
    { label: "16:30", jobs: 31 },
  ],
  technicianUtilisation: [
    { team: "Techs", utilisation: 82, clockedIn: 11, total: 13 },
    { team: "MOT", utilisation: 68, clockedIn: 2, total: 3 },
    { team: "Valet", utilisation: 74, clockedIn: 3, total: 4 },
  ],
  redJobs: [
    { jobNumber: "JC1428", concern: "Engine Management", eta: "2 hrs", owner: "Darrell" },
    { jobNumber: "JC1433", concern: "Brake Pipes", eta: "Waiting Parts", owner: "Glen" },
    { jobNumber: "JC1436", concern: "Gearbox Fault", eta: "Build Slot 15:00", owner: "Nicola" },
  ],
};

const mockManagerNotes = {
  "Service Manager": {
    focus: "Keep service advisors in sync with ramp capacity",
    risks: [
      "Afternoon drop-offs exceeding available courtesy cars",
      "Two VIP customers waiting in lounge",
    ],
    actions: [
      "Push authorisations for JC1428 & JC1433",
      "Reconfirm 16:30 collections with reception",
    ],
    kpis: {
      cycleTime: 2.6,
      sameDayFix: 78,
      nps: 64,
      authorisations: 86,
    },
  },
  "Workshop Manager": {
    focus: "Ramp allocation and technician utilisation",
    risks: [
      "Brake lathe offline until 14:00",
      "Tyre delivery ETA 13:45 for three jobs",
    ],
    actions: [
      "Reassign Darrell to JC1441 when ramp frees at 12:30",
      "Book overtime slot for clutch carry-over",
    ],
    kpis: {
      cycleTime: 3.1,
      sameDayFix: 71,
      nps: 58,
      authorisations: 79,
    },
  },
  "Parts Manager": {
    focus: "Parts promise vs. reality tracking",
    risks: [
      "Courier delays from TPS running 45 mins late",
      "Consumables stock for brake cleaner down to 18 cans",
    ],
    actions: [
      "Flag any jobs exceeding promise by >30 mins",
      "Raise emergency order for fast-fit bay",
    ],
    kpis: {
      cycleTime: 1.9,
      sameDayFix: 84,
      nps: 51,
      authorisations: 91,
    },
  },
  "After Sales Director": {
    focus: "Daily gross profit run rate and CSI",
    risks: [
      "Month-to-date upsell 6% short of stretch target",
      "EV charger on bay 5 intermittently tripping",
    ],
    actions: [
      "Approve overtime for Saturday AM shift",
      "Review finance packs before 16:00 sign-off",
    ],
    kpis: {
      cycleTime: 2.4,
      sameDayFix: 81,
      nps: 69,
      authorisations: 88,
    },
  },
};

const SectionCard = ({ title, subtitle, children }) => (
  <section
    style={{
      background: "#fff",
      borderRadius: "18px",
      padding: "20px",
      border: "1px solid #ffe0e0",
      boxShadow: "0 18px 35px rgba(209,0,0,0.08)",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#a00000" }}>{title}</h2>
      {subtitle && (
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.9rem" }}>{subtitle}</p>
      )}
    </div>
    {children}
  </section>
);

const MetricPill = ({ label, value, accent = "#a00000", helper }) => (
  <div
    style={{
      borderRadius: "14px",
      padding: "14px 16px",
      border: `1px solid ${accent}33`,
      background: `${accent}0f`,
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    }}
  >
    <span style={{ color: "#6b7280", fontSize: "0.8rem", letterSpacing: "0.05em" }}>{label}</span>
    <strong style={{ fontSize: "1.4rem", color: accent }}>{value}</strong>
    {helper && <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>{helper}</span>}
  </div>
);

const LinearTrend = ({ data, accent = "#d10000" }) => (
  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", width: "100%" }}>
    {data.map((point) => (
      <div key={point.label} style={{ flex: 1, textAlign: "center" }}>
        <div
          style={{
            height: `${Math.max(8, point.jobs * 3)}px`,
            background: accent,
            borderRadius: "8px 8px 4px 4px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
          }}
        />
        <small style={{ color: "#6b7280" }}>{point.label}</small>
      </div>
    ))}
  </div>
);

export default function RetailManagersDashboard({ user }) {
  const todayLabel = dayjs().format("dddd, D MMM");
  const managerPanels = useMemo(() => {
    if (!retailManagerRoles.length) return [];
    return retailManagerRoles.map((roleName) => {
      const details = mockManagerNotes[roleName] || mockManagerNotes["Service Manager"];
      const owners = usersByRole?.[roleName] || [];
      return {
        role: roleName,
        owners,
        ...details,
      };
    });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px" }}>
      <header
        style={{
          background: "linear-gradient(120deg, #ffdddd, #ffecec)",
          borderRadius: "18px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          border: "1px solid #ffd4d4",
        }}
      >
        <span style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.8rem", color: "#a00000" }}>
          Retail Workshop Control Room
        </span>
        <h1 style={{ margin: 0, color: "#a00000", fontSize: "1.6rem" }}>
          {user?.username ? `${user.username}'s Dashboard` : "Retail Dashboard"}
        </h1>
        <p style={{ margin: 0, color: "#6b7280" }}>Live view for retail managers · {todayLabel}</p>
      </header>

      <SectionCard title="Today's Workshop Pulse" subtitle="Mock data snapshot synthesised from booking feed">
        <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <MetricPill label="Jobs Booked" value={baseWorkshopSnapshot.jobsBooked} helper="+6 vs last Wed" />
          <MetricPill label="On Site" value={baseWorkshopSnapshot.jobsOnSite} helper="11 waiting bay" />
          <MetricPill label="Awaiting Parts" value={`${baseWorkshopSnapshot.waitingForParts} jobs`} helper="TPS van ETA 13:15" />
          <MetricPill label="Road Test / QA" value={`${baseWorkshopSnapshot.qaRoadTest} cars`} helper="2 require sign off" />
          <MetricPill
            label="Technicians"
            value={`${baseWorkshopSnapshot.techniciansClockedIn}/${baseWorkshopSnapshot.techniciansTotal}`}
            helper="Clocked-in vs scheduled"
          />
          <MetricPill label="Courtesy Cars Out" value={baseWorkshopSnapshot.courtesyCarsOut} helper="of 12 available" />
          <MetricPill label="Revenue Today" value={`£${baseWorkshopSnapshot.todaysRevenue.toLocaleString()}`} helper="Incl. upsell" />
          <MetricPill label="Upsell Pipeline" value={`£${baseWorkshopSnapshot.estUpsell.toLocaleString()}`} helper="Awaiting auth" />
        </div>
        <div style={{ marginTop: "12px" }}>
          <p style={{ color: "#6b7280", marginBottom: "8px" }}>Throughput progression</p>
          <LinearTrend data={baseWorkshopSnapshot.throughputTrend} />
        </div>
      </SectionCard>

      <SectionCard title="Retail manager focus" subtitle="Quick view for every manager level role inside retail">
        <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {managerPanels.map((panel) => (
            <div
              key={panel.role}
              style={{
                border: "1px solid #ffd4d4",
                borderRadius: "16px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                background: "#fff7f7",
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "#a00000" }}>{panel.role}</h3>
                {panel.owners.length > 0 && (
                  <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
                    Owners: {panel.owners.join(", ")}
                  </p>
                )}
              </div>
              <p style={{ margin: 0, color: "#374151", fontWeight: 600 }}>{panel.focus}</p>
              <div style={{ display: "flex", gap: "10px" }}>
                {Object.entries(panel.kpis).map(([label, value]) => (
                  <div key={label} style={{ flex: 1 }}>
                    <span style={{ color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase" }}>{label}</span>
                    <p style={{ margin: 0, fontWeight: 700, color: "#a00000" }}>
                      {typeof value === "number" && value < 1 ? value.toFixed(1) : `${value}%`}
                    </p>
                  </div>
                ))}
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af" }}>
                  Risks
                </span>
                <ul style={{ margin: "6px 0 0", paddingLeft: "18px", color: "#374151" }}>
                  {panel.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af" }}>
                  Actions
                </span>
                <ul style={{ margin: "6px 0 0", paddingLeft: "18px", color: "#374151" }}>
                  {panel.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <SectionCard
          title="Technician utilisation"
          subtitle="Based on mock time-clock feed"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {baseWorkshopSnapshot.technicianUtilisation.map((team) => (
              <div key={team.team} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#374151" }}>
                  <span>{team.team}</span>
                  <strong>{team.utilisation}%</strong>
                </div>
                <div
                  style={{
                    height: "10px",
                    borderRadius: "999px",
                    background: "#ffe0e0",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${team.utilisation}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #d10000, #a00000)",
                    }}
                  />
                </div>
                <small style={{ color: "#6b7280" }}>
                  {team.clockedIn}/{team.total} clocked in
                </small>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Red priority jobs" subtitle="Jobs requiring manager attention">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {baseWorkshopSnapshot.redJobs.map((job) => (
              <div
                key={job.jobNumber}
                style={{
                  border: "1px solid #ffc9c9",
                  borderRadius: "12px",
                  padding: "12px",
                  background: "#fff5f5",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <strong style={{ color: "#a00000" }}>{job.jobNumber}</strong>
                  <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>{job.eta}</span>
                </div>
                <p style={{ margin: 0, color: "#374151" }}>{job.concern}</p>
                <small style={{ color: "#6b7280" }}>Owner: {job.owner}</small>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
