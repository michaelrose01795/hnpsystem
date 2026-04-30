import ViewJobCardsUi from "@/components/page-ui/job-cards/view/job-cards-view-ui";
import { demoJobs } from "../demoData/demoJobs";
import { MockPage } from "./_helpers";

const sortedJobs = demoJobs.map((j) => ({
  id: j.id,
  jobNumber: j.job_number,
  reg: j.reg,
  customer: j.customer_name,
  makeModel: `${j.make} ${j.model}`,
  status: j.status,
  technician: j.assigned_technician,
  jobDivision: "Retail",
  jobType: "Service",
  appointment: j.booked_in,
  customerStatus: "Confirmed",
  vhc: "Pending",
  requests: ["Major service", "Investigate front-end knock"],
}));

// Mirror of the JobListCard defined inline in src/pages/job-cards/view/index.js
// so the presentation slide shows real job rows instead of empty stubs.
function JobListCard({ job, onClick }) {
  const isSales = (job.jobDivision || "Retail").toLowerCase() === "sales";
  return (
    <div
      onClick={onClick}
      style={{
        padding: "0.75rem 0.9rem",
        borderRadius: "var(--radius-sm)",
        backgroundColor: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--info-dark)" }}>{job.jobNumber}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--primary)" }}>{job.reg || "—"}</span>
          <span style={{ fontSize: 13, color: "var(--info)" }}>{job.makeModel || "Vehicle pending"}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{
            padding: "4px 12px",
            borderRadius: "var(--control-radius-xs)",
            fontWeight: 600,
            fontSize: 12,
            border: "1px solid currentColor",
            backgroundColor: isSales ? "var(--theme-colour)" : "var(--success-surface)",
            color: isSales ? "var(--info)" : "var(--success-dark)",
          }}>{job.jobDivision || "Retail"}</span>
          <span style={{
            padding: "4px 12px",
            borderRadius: "var(--control-radius-xs)",
            backgroundColor: "var(--theme-colour)",
            color: "var(--accent-purple)",
            fontWeight: 600,
            fontSize: 12,
            border: "1px solid currentColor",
          }}>{job.status || "Status pending"}</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(6.5rem, 1fr))", gap: "0.5rem", fontSize: "0.8rem" }}>
        {[
          ["Customer", job.customer || "Unknown"],
          ["Technician", job.technician || "Unassigned"],
          ["Job Type", job.jobType || "—"],
          ["Appointment", job.appointment || "—"],
          ["Customer Status", job.customerStatus || "—"],
          ["VHC", job.vhc || "Pending"],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10, color: "var(--info)", textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
            <span style={{ color: "var(--info-dark)", fontWeight: 500 }}>{value}</span>
          </div>
        ))}
      </div>
      {Array.isArray(job.requests) && job.requests.length > 0 && (
        <div style={{ padding: "8px 10px", borderRadius: "var(--radius-xs)", backgroundColor: "var(--theme-colour)" }}>
          <div style={{ fontSize: 10, color: "var(--warning)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
            Customer Requests ({job.requests.length})
          </div>
          <div style={{ fontSize: 12, color: "var(--info-dark)", lineHeight: 1.4 }}>
            {job.requests.join(" • ")}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderListCard({ order }) {
  return <JobListCard job={order} />;
}

export default function JobCardsListMock() {
  return (
    <MockPage
      Ui={ViewJobCardsUi}
      overrides={{
        view: "section2",
        sortedJobs,
        baseJobs: sortedJobs,
        JobListCard,
        OrderListCard,
        activeStatusFilter: "all",
        activeTab: "todays",
        combinedStatusOptions: [
          { value: "all", label: "All statuses" },
          { value: "in-progress", label: "In Progress" },
          { value: "awaiting-parts", label: "Awaiting Parts" },
          { value: "ready", label: "Ready for Collection" },
        ],
        divisionFilter: "All",
        emptyStateMessage: "No jobs match the current filter.",
        isOrdersTab: false,
        ordersLoading: false,
        searchPlaceholder: "Search by job, reg or customer",
        searchValues: { todays: "" },
        statusCounts: { "in-progress": 1, "awaiting-parts": 1, ready: 1 },
        statusTabs: [],
        tabOptions: [
          { id: "todays", label: "Today's Jobs" },
          { id: "upcoming", label: "Upcoming" },
        ],
      }}
    />
  );
}
