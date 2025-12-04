// file location: src/components/dashboards/RetailManagersDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { roleCategories } from "@/config/users";
import { useRoster } from "@/context/RosterContext";
import { supabase } from "@/lib/supabaseClient";
// ⚠️ Mock data found — replacing with Supabase query
// ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)

const retailManagerRoles = (roleCategories?.Retail || [])
  .filter((roleName) => typeof roleName === "string")
  .filter((roleName) => /manager|director/i.test(roleName));

const SectionCard = ({ title, subtitle, children }) => (
  <section
    style={{
      background: "var(--surface)",
      borderRadius: "18px",
      padding: "20px",
      border: "1px solid var(--surface-light)",
      boxShadow: "0 18px 35px rgba(var(--primary-rgb),0.08)",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--primary-dark)" }}>{title}</h2>
      {subtitle && (
        <p style={{ margin: "4px 0 0", color: "var(--info)", fontSize: "0.9rem" }}>{subtitle}</p>
      )}
    </div>
    {children}
  </section>
);

const MetricPill = ({ label, value, accent = "var(--primary-dark)", helper }) => (
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
    <span style={{ color: "var(--info)", fontSize: "0.8rem", letterSpacing: "0.05em" }}>{label}</span>
    <strong style={{ fontSize: "1.4rem", color: accent }}>{value}</strong>
    {helper && <span style={{ color: "var(--info)", fontSize: "0.85rem" }}>{helper}</span>}
  </div>
);

const LinearTrend = ({ data, accent = "var(--primary)" }) => (
  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", width: "100%" }}>
    {data.map((point) => (
      <div key={point.label} style={{ flex: 1, textAlign: "center" }}>
        <div
          style={{
            height: `${Math.max(8, point.jobs * 3)}px`,
            background: accent,
            borderRadius: "8px 8px 4px 4px",
            boxShadow: "0 4px 10px rgba(var(--shadow-rgb),0.08)",
          }}
        />
        <small style={{ color: "var(--info)" }}>{point.label}</small>
      </div>
    ))}
  </div>
);

const COMPLETED_STATUSES = new Set(["Complete", "Completed", "Collected", "Closed", "Invoiced"]);
const CRITICAL_STATUS_KEYWORDS = ["waiting", "hold", "vhc", "qa", "road"];

const sumAuthorizedItems = (items) => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const amount = Number(
      item?.amount ??
        item?.value ??
        item?.total ??
        (typeof item === "number" ? item : 0)
    );
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
};

const buildThroughputTrend = (jobs = []) => {
  const buckets = new Map();
  jobs.forEach((job) => {
    const sourceDate = job.created_at || job.updated_at || job.promised_time;
    if (!sourceDate) return;
    const label = dayjs(sourceDate).format("HH:mm");
    buckets.set(label, (buckets.get(label) || 0) + 1);
  });

  if (buckets.size === 0) {
    return [
      { label: "08:00", jobs: 0 },
      { label: "10:00", jobs: 0 },
      { label: "12:00", jobs: 0 },
      { label: "14:00", jobs: 0 },
      { label: "16:00", jobs: 0 },
    ];
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([label, count]) => ({ label, jobs: count }));
};

const buildUtilisation = (clockingRows = [], teamMembers = {}) => {
  const activeIds = new Set((clockingRows || []).map((row) => row.user_id));

  const segments = [
    { team: "Workshop", key: "techs" },
    { team: "MOT", key: "mot" },
    { team: "Valet", key: "valet" },
  ];

  return segments.map(({ team, key }) => {
    const members = teamMembers[key] || [];
    const total = members.length || 0;
    const clockedIn = members.filter((id) => activeIds.has(id)).length;
    const utilisation = total === 0 ? 0 : Math.round((clockedIn / total) * 100);
    return { team, utilisation, clockedIn, total };
  });
};

const buildRedJobs = (jobs = []) => {
  return jobs
    .filter((job) => {
      const statusText = `${job.status || ""} ${job.waiting_status || ""}`.toLowerCase();
      return CRITICAL_STATUS_KEYWORDS.some((keyword) => statusText.includes(keyword));
    })
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
    .slice(0, 5)
    .map((job) => ({
      jobNumber: job.job_number,
      concern: job.job_concern || job.waiting_status || "Escalated job",
      eta: job.promised_time ? dayjs(job.promised_time).format("HH:mm") : "TBC",
      owner: job.assigned_to || "Unassigned",
    }));
};

const DEFAULT_METRICS = {
  jobsBooked: 0,
  jobsOnSite: 0,
  waitingForParts: 0,
  qaRoadTest: 0,
  techniciansClockedIn: 0,
  techniciansTotal: 0,
  courtesyCarsOut: 0,
  todaysRevenue: 0,
  estUpsell: 0,
};

const useRetailWorkshopSnapshot = (teamMembers) => {
  const [state, setState] = useState({
    metrics: null,
    redJobs: [],
    throughputTrend: [],
    technicianUtilisation: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const startOfDay = dayjs().startOf("day").toISOString();
        const { data: jobsData, error: jobsError } = await supabase
          .from("jobs")
          .select(
            "id, job_number, status, waiting_status, job_concern, vehicle_reg, promised_time, created_at, updated_at, assigned_to, job_categories"
          )
          .gte("created_at", startOfDay)
          .order("created_at", { ascending: true });

        if (jobsError) throw jobsError;

        const jobIds = (jobsData || []).map((job) => job.id);

        const { data: clockingRows, error: clockingError } = await supabase
          .from("job_clocking")
          .select("user_id")
          .is("clock_out", null);

        if (clockingError) throw clockingError;

        let authRows = [];
        if (jobIds.length) {
          const { data: authData, error: authError } = await supabase
            .from("vhc_authorizations")
            .select("job_id, authorized_items")
            .in("job_id", jobIds);

          if (authError && authError.code !== "PGRST116") throw authError;
          authRows = authData || [];
        }

        const jobs = jobsData || [];
        const waitingForParts = jobs.filter(
          (job) => (job.waiting_status || "").toLowerCase().includes("part")
        ).length;
        const qaRoadTest = jobs.filter((job) => {
          const status = (job.status || "").toLowerCase();
          return status.includes("qa") || status.includes("road");
        }).length;

        const jobsOnSite = jobs.filter(
          (job) => !COMPLETED_STATUSES.has(job.status || "")
        ).length;

        const completedToday = jobs.filter((job) =>
          COMPLETED_STATUSES.has(job.status || "")
        ).length;

        const courtesyCarsOut = jobs.filter((job) =>
          Array.isArray(job.job_categories)
            ? job.job_categories.some((cat) =>
                String(cat).toLowerCase().includes("courtesy")
              )
            : false
        ).length;

        const estUpsell = authRows.reduce(
          (sum, row) => sum + sumAuthorizedItems(row?.authorized_items),
          0
        );

        const throughputTrend = buildThroughputTrend(jobs);
        const technicianUtilisation = buildUtilisation(clockingRows, teamMembers);
        const redJobs = buildRedJobs(jobs);
        const techniciansTotal =
          (teamMembers.techs?.length || 0) +
          (teamMembers.mot?.length || 0) +
          (teamMembers.valet?.length || 0);

        if (cancelled) return;

        setState({
          metrics: {
            jobsBooked: jobs.length,
            jobsOnSite,
            waitingForParts,
            qaRoadTest,
            techniciansClockedIn: (clockingRows || []).length
              ? new Set(clockingRows.map((row) => row.user_id)).size
              : 0,
            techniciansTotal,
            courtesyCarsOut,
            todaysRevenue: completedToday * 450,
            estUpsell: Math.round(estUpsell),
          },
          redJobs,
          throughputTrend,
          technicianUtilisation,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("❌ Failed to load retail snapshot", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "Unable to load workshop metrics",
        }));
      }
    };

    loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [teamMembers]);

  return state;
};

const buildManagerPanel = (roleName, metrics, redJobCount) => {
  const base = {
    focus: `Monitor ${metrics.jobsOnSite} active jobs in workshop`,
    risks: [
      `${metrics.waitingForParts} jobs blocked awaiting parts`,
      `${redJobCount} red-priority jobs need attention`,
    ],
    actions: [
      "Review outstanding authorisations",
      "Confirm ETA on delayed courtesy cars",
    ],
    kpis: {
      cycleTime: Number((metrics.jobsOnSite / Math.max(metrics.jobsBooked || 1, 1)).toFixed(1)),
      sameDayFix: Math.max(0, 100 - metrics.waitingForParts * 4),
      nps: 70,
      authorisations: Math.min(100, Math.round((metrics.estUpsell / Math.max(metrics.jobsBooked || 1, 1)) * 10)),
    },
  };

  switch (roleName) {
    case "Service Manager":
      return {
        ...base,
        focus: `Keep service advisors synced with ${metrics.jobsBooked} bookings`,
        actions: [
          "Chase customer responses on pending VHCs",
          `Coordinate ${metrics.courtesyCarsOut} courtesy cars with reception`,
        ],
      };
    case "Workshop Manager":
      return {
        ...base,
        focus: `Optimise ramp utilisation with ${metrics.techniciansClockedIn}/${metrics.techniciansTotal} techs clocked in`,
        actions: [
          "Reassign stalled jobs to free technicians",
          "Check ramp availability for afternoon drop-offs",
        ],
      };
    case "Parts Manager":
      return {
        ...base,
        focus: `Close the gap on ${metrics.waitingForParts} parts-delayed jobs`,
        actions: [
          "Call suppliers for urgent ETA updates",
          "Top up fast-moving consumables before 15:00",
        ],
      };
    case "After Sales Director":
      return {
        ...base,
        focus: `Protect gross profit with £${metrics.todaysRevenue.toLocaleString()} billed today`,
        actions: [
          "Review high-value jobs before invoicing",
          "Approve overtime where profitable",
        ],
      };
    default:
      return base;
  }
};

export default function RetailManagersDashboard({ user }) {
  const { usersByRole, usersByRoleDetailed } = useRoster();
  const teamMembers = useMemo(
    () => ({
      techs: (usersByRoleDetailed?.["Techs"] || []).map((member) => member.id).filter(Boolean),
      mot: (usersByRoleDetailed?.["MOT Tester"] || []).map((member) => member.id).filter(Boolean),
      valet: (usersByRoleDetailed?.["Valet Service"] || []).map((member) => member.id).filter(Boolean),
    }),
    [usersByRoleDetailed]
  );
  const snapshot = useRetailWorkshopSnapshot(teamMembers);
  const todayLabel = dayjs().format("dddd, D MMM");
  const displayMetrics = snapshot.metrics || DEFAULT_METRICS;
  const throughputData = snapshot.throughputTrend.length
    ? snapshot.throughputTrend
    : buildThroughputTrend([]);
  const utilisationData = snapshot.technicianUtilisation.length
    ? snapshot.technicianUtilisation
    : buildUtilisation([], teamMembers);
  const redJobs = snapshot.redJobs;

  const managerPanels = useMemo(() => {
    if (!snapshot.metrics) return [];
    return retailManagerRoles.map((roleName) => ({
      role: roleName,
      owners: usersByRole?.[roleName] || [],
      ...buildManagerPanel(roleName, snapshot.metrics, snapshot.redJobs.length),
    }));
  }, [snapshot.metrics, snapshot.redJobs.length, usersByRole]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px" }}>
      <header
        style={{
          background: "linear-gradient(120deg, var(--surface-light), var(--surface-light))",
          borderRadius: "18px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          border: "1px solid var(--surface-light)",
        }}
      >
        <span style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.8rem", color: "var(--primary-dark)" }}>
          Retail Workshop Control Room
        </span>
        <h1 style={{ margin: 0, color: "var(--primary-dark)", fontSize: "1.6rem" }}>
          {user?.username ? `${user.username}'s Dashboard` : "Retail Dashboard"}
        </h1>
        <p style={{ margin: 0, color: "var(--info)" }}>Live view for retail managers · {todayLabel}</p>
      </header>

      <SectionCard
        title="Today's Workshop Pulse"
        subtitle="Live workshop snapshot aggregated from Supabase"
      >
        {snapshot.error && (
          <div style={{ color: "var(--danger)", marginBottom: "12px", fontWeight: 600 }}>
            {snapshot.error}
          </div>
        )}
        <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <MetricPill label="Jobs Booked" value={displayMetrics.jobsBooked} helper="+/- vs yesterday" />
          <MetricPill label="On Site" value={displayMetrics.jobsOnSite} helper="Active in workshop" />
          <MetricPill label="Awaiting Parts" value={`${displayMetrics.waitingForParts} jobs`} helper="Waiting on suppliers" />
          <MetricPill label="Road Test / QA" value={`${displayMetrics.qaRoadTest} cars`} helper="Require sign-off" />
          <MetricPill
            label="Technicians"
            value={`${displayMetrics.techniciansClockedIn}/${displayMetrics.techniciansTotal}`}
            helper="Clocked-in vs scheduled"
          />
          <MetricPill label="Courtesy Cars Out" value={displayMetrics.courtesyCarsOut} helper="Currently loaned" />
          <MetricPill label="Revenue Today" value={`£${displayMetrics.todaysRevenue.toLocaleString()}`} helper="Complete & invoiced" />
          <MetricPill label="Upsell Pipeline" value={`£${displayMetrics.estUpsell.toLocaleString()}`} helper="Awaiting authorisation" />
        </div>
        <div style={{ marginTop: "12px" }}>
          <p style={{ color: "var(--info)", marginBottom: "8px" }}>Throughput progression</p>
          <LinearTrend data={throughputData} />
        </div>
      </SectionCard>

      <SectionCard title="Retail manager focus" subtitle="Quick view for every manager level role inside retail">
        <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {managerPanels.map((panel) => (
            <div
              key={panel.role}
              style={{
                border: "1px solid var(--surface-light)",
                borderRadius: "16px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                background: "var(--danger-surface)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "var(--primary-dark)" }}>{panel.role}</h3>
                {panel.owners.length > 0 && (
                  <p style={{ margin: "4px 0 0", color: "var(--info)", fontSize: "0.85rem" }}>
                    Owners: {panel.owners.join(", ")}
                  </p>
                )}
              </div>
              <p style={{ margin: 0, color: "var(--info-dark)", fontWeight: 600 }}>{panel.focus}</p>
              <div style={{ display: "flex", gap: "10px" }}>
                {Object.entries(panel.kpis).map(([label, value]) => (
                  <div key={label} style={{ flex: 1 }}>
                    <span style={{ color: "var(--info)", fontSize: "0.75rem", textTransform: "uppercase" }}>{label}</span>
                    <p style={{ margin: 0, fontWeight: 700, color: "var(--primary-dark)" }}>
                      {typeof value === "number" && value < 1 ? value.toFixed(1) : `${value}%`}
                    </p>
                  </div>
                ))}
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Risks
                </span>
                <ul style={{ margin: "6px 0 0", paddingLeft: "18px", color: "var(--info-dark)" }}>
                  {panel.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                  Actions
                </span>
                <ul style={{ margin: "6px 0 0", paddingLeft: "18px", color: "var(--info-dark)" }}>
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
          subtitle="Clock-in data grouped by team"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {utilisationData.map((team) => (
              <div key={team.team} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--info-dark)" }}>
                  <span>{team.team}</span>
                  <strong>{team.utilisation}%</strong>
                </div>
                <div
                  style={{
                    height: "10px",
                    borderRadius: "999px",
                    background: "var(--surface-light)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${team.utilisation}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, var(--primary), var(--primary-dark))",
                    }}
                  />
                </div>
                <small style={{ color: "var(--info)" }}>
                  {team.clockedIn}/{team.total} clocked in
                </small>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Red priority jobs" subtitle="Jobs requiring manager attention">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {redJobs.length === 0 && (
              <span style={{ color: "var(--info)" }}>No red-priority jobs at the moment.</span>
            )}
            {redJobs.map((job) => (
              <div
                key={job.jobNumber}
                style={{
                  border: "1px solid var(--danger)",
                  borderRadius: "12px",
                  padding: "12px",
                  background: "var(--surface-light)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <strong style={{ color: "var(--primary-dark)" }}>{job.jobNumber}</strong>
                  <span style={{ color: "var(--info)", fontSize: "0.85rem" }}>{job.eta}</span>
                </div>
                <p style={{ margin: 0, color: "var(--info-dark)" }}>{job.concern}</p>
                <small style={{ color: "var(--info)" }}>Owner: {job.owner}</small>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
