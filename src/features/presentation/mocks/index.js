import { useState } from "react";
import { demoJobs } from "../demoData/demoJobs";
import { demoParts } from "../demoData/demoParts";
import { demoVehicles } from "../demoData/demoVehicles";
import { StatusPill, Field, PrimaryBtn, mockCellStyle, mockHeaderCellStyle } from "./shared";
import { SearchBar } from "@/components/ui/searchBarAPI";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { CalendarField } from "@/components/ui/calendarAPI";
import Button from "@/components/ui/Button";
import { SectionCard } from "@/components/Section";
import { MetricCard, StatusTag } from "@/components/HR/MetricCard";
import InvoiceTable from "@/components/accounts/InvoiceTable";
import VHCSummaryList from "@/features/customerPortal/components/VHCSummaryList";
import MessagingHub from "@/features/customerPortal/components/MessagingHub";
import CustomerHero from "@/features/customerPortal/components/CustomerHero";
import VehicleGarageCard from "@/features/customerPortal/components/VehicleGarageCard";
import AppointmentTimeline from "@/features/customerPortal/components/AppointmentTimeline";

/* ------------------------------------------------------------------ *
 * Presentation page mocks                                            *
 * ---                                                                *
 * Each mock mirrors the structural shape of its real page counterpart*
 * (same section order, same filter bars, same column sets, same      *
 * button labels). They render with demo data only — no hooks, no     *
 * network, no auth — so they're safe to show in presentations.       *
 * ------------------------------------------------------------------ */

// ---------- Dashboard -----------------------------------------------------
// Mirrors src/pages/dashboard.js fallback view: right-aligned primary Search
// button, danger-surface backdrop with welcome line, and the job overview
// table with danger-coloured header row and primary-light cell borders.
function DashboardMock() {
  return (
    <div>
      <div
        className="app-section-card"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "12px 20px",
        }}
      >
        <button
          type="button"
          style={{
            padding: "10px 16px",
            backgroundColor: "var(--primary)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-xs)",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </div>

      <div
        style={{
          backgroundColor: "var(--danger-surface)",
          padding: "var(--section-card-padding)",
          borderRadius: "var(--radius-xs)",
          minHeight: "70vh",
        }}
      >
        <p>Welcome Demo User! Here&rsquo;s your current jobs overview.</p>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--danger)" }}>
              <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Job Number</th>
              <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Customer</th>
              <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Vehicle</th>
              <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Status</th>
              <th style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>Technician</th>
            </tr>
          </thead>
          <tbody>
            {demoJobs.map((j) => (
              <tr key={j.id}>
                <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>{j.job_number}</td>
                <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>{j.customer_name}</td>
                <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>
                  {j.make} {j.model} ({j.reg})
                </td>
                <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>{j.status}</td>
                <td style={{ padding: "8px", border: "1px solid var(--primary-light)" }}>{j.assigned_technician}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Job Cards List (manager view) --------------------------------
// Mirrors src/pages/job-cards/view/index.js JobListCard layout exactly:
// primary-tinted filter shell with tab strip + search + division/status
// dropdown filters, and list rows built to the real JobListCard shape
// (header with job# / reg / makeModel + division + status badges, 6-cell
// info grid, and the info-surface customer requests block).
function RealJobListCard({ job }) {
  const isSales = (job.jobDivision || "Retail").toLowerCase() === "sales";
  const divisionBadgeStyles = {
    backgroundColor: isSales ? "var(--info-surface)" : "var(--success-surface)",
    color: isSales ? "var(--info)" : "var(--success-dark)",
  };
  const customerRequests = job.requests || [];

  return (
    <div
      style={{
        border: "none",
        padding: "0.75rem 0.9rem",
        borderRadius: "var(--radius-sm)",
        backgroundColor: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: "0.65rem",
        cursor: "pointer",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--info-dark)" }}>{job.jobNumber}</span>
          <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--primary)" }}>{job.reg || "—"}</span>
          <span style={{ fontSize: "13px", color: "var(--info)" }}>{job.makeModel || "Vehicle pending"}</span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: "var(--control-radius-xs)",
              fontWeight: 600,
              fontSize: "12px",
              textTransform: "capitalize",
              border: "1px solid currentColor",
              letterSpacing: "0.3px",
              ...divisionBadgeStyles,
            }}
          >
            {job.jobDivision || "Retail"}
          </span>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: "var(--control-radius-xs)",
              backgroundColor: "var(--accent-purple-surface)",
              color: "var(--accent-purple)",
              fontWeight: 600,
              fontSize: "12px",
              textTransform: "capitalize",
              border: "1px solid currentColor",
              letterSpacing: "0.3px",
            }}
          >
            {job.status || "Status pending"}
          </span>
        </div>
      </div>

      {/* Info grid (6 cells) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(6.5rem, 1fr))", gap: "0.5rem", fontSize: "0.8rem" }}>
        {[
          ["Customer",        job.customer || "Unknown"],
          ["Technician",      job.technician || "Unassigned"],
          ["Job Type",        job.jobType || "—"],
          ["Appointment",     job.appointment || "—"],
          ["Customer Status", job.customerStatus || "—"],
          ["VHC",             job.vhc || "Pending"],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "10px", color: "var(--info)", textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
            <span style={{ color: "var(--info-dark)", fontWeight: 500 }}>{value}</span>
          </div>
        ))}
      </div>

      {customerRequests.length > 0 && (
        <div style={{ padding: "8px 10px", borderRadius: "var(--radius-xs)", backgroundColor: "var(--info-surface)", border: "none" }}>
          <div style={{ fontSize: "10px", color: "var(--warning)", textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>
            Customer Requests ({customerRequests.length})
          </div>
          <div style={{ fontSize: "12px", color: "var(--info-dark)", lineHeight: "1.4" }}>
            {customerRequests.join(" • ")}
          </div>
        </div>
      )}
    </div>
  );
}

function JobCardsListMock() {
  const [activeTab, setActiveTab] = useState("todays");
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const tabOptions = [
    { value: "todays", label: "Today's workload" },
    { value: "carry",  label: "Carry over" },
    { value: "orders", label: "Orders" },
  ];
  const rows = [
    { jobNumber: "DEMO-1042", reg: "DE24 XYZ", makeModel: "Volkswagen Golf",     status: "In Progress",         jobDivision: "Retail", customer: "Alex Morgan",        technician: "Demo Tech A", jobType: "Service + Diag", appointment: "22/04 08:30", customerStatus: "Waiting",        vhc: "In progress", requests: ["Knocking noise front", "Major service"] },
    { jobNumber: "DEMO-1043", reg: "TA23 ABC", makeModel: "Ford Kuga",           status: "Awaiting Parts",      jobDivision: "Retail", customer: "Priya Shah",         technician: "Demo Tech B", jobType: "Diagnostic",    appointment: "21/04 10:00", customerStatus: "Courtesy car",   vhc: "Complete",    requests: ["EML on, power loss"] },
    { jobNumber: "DEMO-1044", reg: "TV22 HNP", makeModel: "BMW 3 Series",        status: "Ready for Collection",jobDivision: "Retail", customer: "Tom Reynolds",       technician: "Demo Tech A", jobType: "Service + MOT", appointment: "22/04 07:45", customerStatus: "Collecting 2pm", vhc: "Complete",    requests: [] },
    { jobNumber: "DEMO-1045", reg: "DA72 OME", makeModel: "Mini Cooper S",       status: "Booked",              jobDivision: "Sales",  customer: "R. Patel",           technician: "Unassigned",  jobType: "PDI",           appointment: "23/04 09:00", customerStatus: "Delivery prep",  vhc: "Pending",     requests: ["Full valet", "Fuel to full"] },
  ];

  return (
    <div className="app-page-stack">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: "rgba(var(--primary-rgb), 0.10)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid rgba(var(--primary-rgb), 0.18)",
          padding: "12px",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
          {/* Tab strip */}
          <div className="tab-api" style={{ display: "flex", gap: "0.375rem", padding: "0.35rem 0.5rem", flexWrap: "nowrap" }}>
            {tabOptions.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`tab-api__item${activeTab === t.value ? " is-active" : ""}`}
                onClick={() => setActiveTab(t.value)}
                style={{
                  minHeight: "var(--control-height-sm)",
                  padding: "0.45rem 0.7rem",
                  fontSize: "0.78rem",
                  background: activeTab === t.value ? "var(--primary)" : "var(--surface)",
                  color: activeTab === t.value ? "var(--surface)" : "var(--primary)",
                  border: "1px solid var(--primary)",
                  borderRadius: "var(--input-radius)",
                  cursor: "pointer",
                  fontWeight: activeTab === t.value ? 600 : 500,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search + 2 filter dropdowns (3-col grid) */}
          <div
            className="app-layout-card"
            style={{
              flex: "1 1 auto",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(7.2rem, 8.4rem) minmax(7.2rem, 8.4rem)",
              alignItems: "center",
              gap: "0.45rem",
              padding: "0.35rem 0.5rem",
            }}
          >
            <div data-presentation="job-cards-search" style={{ minWidth: 0 }}>
              <SearchBar
                placeholder="Search by reg, customer, or job #"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                style={{ width: "100%" }}
              />
            </div>
            <div data-presentation="job-cards-division-filter" style={{ minWidth: 0 }}>
              <DropdownField
                className="job-cards-filter"
                value={division}
                options={[
                  { value: "All",    label: "Division filter: All" },
                  { value: "Retail", label: "Division filter: Retail" },
                  { value: "Sales",  label: "Division filter: Sales" },
                ]}
                onChange={(e) => setDivision(e.target.value)}
              />
            </div>
            <div data-presentation="job-cards-status-filter" style={{ minWidth: 0 }}>
              <DropdownField
                className="job-cards-filter"
                value={statusFilter}
                options={[
                  { value: "All",                  label: "Status filter: All" },
                  { value: "In Progress",          label: "Status filter: In Progress" },
                  { value: "Awaiting Parts",       label: "Status filter: Awaiting Parts" },
                  { value: "Ready for Collection", label: "Status filter: Ready" },
                  { value: "Booked",               label: "Status filter: Booked" },
                ]}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {rows.map((j) => <RealJobListCard key={j.jobNumber} job={j} />)}
      </div>
    </div>
  );
}

// ---------- Create Job Card ----------------------------------------------
// Mirrors src/pages/job-cards/create/index.js: header with job tab strip +
// source badge + Save button, three equal cards (Job Information / Vehicle
// Details / Customer Details), Job Requests section, and bottom row of four
// small cards (Cosmetic Damage / Wash / VHC Required / Documents).
function RadioRow({ label, options, selectedIndex = 0 }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((o, i) => (
          <button
            key={o}
            type="button"
            className={i === selectedIndex ? "app-btn app-btn--primary" : "app-btn app-btn--ghost"}
            style={{ padding: "6px 12px", fontSize: 13 }}
          >{o}</button>
        ))}
      </div>
    </div>
  );
}

function YesNoHeaderCard({ title, extra }) {
  return (
    <div className="app-section-card" style={{ flex: "1 1 220px", minWidth: 220 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
        <div style={{ flex: 1 }} />
        {extra ?? (
          <>
            <button type="button" className="app-btn app-btn--ghost" style={{ padding: "4px 12px", fontSize: 12 }}>Yes</button>
            <button type="button" className="app-btn app-btn--primary" style={{ padding: "4px 12px", fontSize: 12 }}>No</button>
          </>
        )}
      </div>
    </div>
  );
}

function JobCreateMock() {
  return (
    <div className="app-page-stack">
          {/* Header — tabs left, source badge + Save on right */}
          <div className="app-section-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div className="tab-api" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button type="button" className="tab-api__item is-active app-btn app-btn--primary" style={{ padding: "6px 14px" }}>Job 1</button>
              <button type="button" className="app-btn app-btn--ghost" style={{ padding: "6px 10px" }}>+</button>
              <button type="button" className="app-btn app-btn--ghost" style={{ padding: "6px 10px" }}>Remove selected</button>
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>No detected requests yet</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ padding: "4px 12px", borderRadius: 999, background: "rgba(34,197,94,0.15)", color: "#166534", fontWeight: 600, fontSize: 12 }}>Retail</span>
              <div data-presentation="create-submit"><PrimaryBtn>Save Job Card</PrimaryBtn></div>
            </div>
          </div>

          {/* Top row — three equal cards */}
          <div className="app-section-card" style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
            {/* Job Information */}
            <div className="app-section-card" style={{ flex: "1 1 260px", display: "grid", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Job Information</h3>
              <RadioRow label="Customer Status" options={["Waiting", "Loan Car", "Collection", "Neither"]} selectedIndex={0} />
              <RadioRow label="Job Source" options={["Retail", "Warranty"]} selectedIndex={0} />
              <RadioRow label="Mobile Mechanic Eligibility" options={["Yes", "No"]} selectedIndex={1} />
            </div>

            {/* Vehicle Details */}
            <div className="app-section-card" style={{ flex: "1 1 260px", display: "grid", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Vehicle Details</h3>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 4, fontWeight: 600 }}>Registration Number</div>
                <div style={{ display: "flex", gap: 6 }} data-presentation="create-reg-lookup">
                  <input defaultValue="DE24 XYZ" style={{ flex: 1, padding: "8px 10px", borderRadius: 6, background: "var(--surface, #fff)" }} />
                  <button type="button" className="app-btn app-btn--primary" style={{ padding: "6px 14px" }}>Search</button>
                </div>
              </div>
              <Field label="Colour" value="Deep Black Pearl" />
              <Field label="Make & Model" value="Volkswagen Golf" />
              <Field label="Chassis Number" value="WVWZZZ1KZDEMO0001" />
              <Field label="Engine Number" value="CDAB-DEMO-002" />
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 4, fontWeight: 600 }}>Current Mileage</div>
                <input type="number" placeholder="Enter mileage" defaultValue={41280} className="app-input" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "var(--surface, #fff)" }} />
              </div>
            </div>

            {/* Customer Details (customer selected, read-only view) */}
            <div className="app-section-card" style={{ flex: "1 1 260px", display: "grid", gap: 12 }} data-presentation="create-customer-lookup">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Customer Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                <Field label="First Name" value="Alex" />
                <Field label="Last Name" value="Morgan" />
                <Field label="Email" value="alex.morgan@demo.invalid" full />
                <Field label="Mobile" value="07700 900001" />
                <Field label="Telephone" value="—" />
                <Field label="Address" value="12 High Street, Exeter" full />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="app-btn app-btn--primary" style={{ flex: 1 }}>Edit Customer</button>
                <button type="button" className="app-btn app-btn--ghost" style={{ flex: 1 }}>Clear Customer</button>
              </div>
            </div>
          </div>

          {/* Job Requests — full width */}
          <div className="app-section-card">
            <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 600 }}>Job Requests</h3>
            <div style={{ display: "grid", gap: 10, maxHeight: 360, overflowY: "auto" }}>
              {[
                { text: "Investigate knocking noise from front suspension", hours: "0.50", pay: "Customer" },
                { text: "Major service + oil filter + air filter",          hours: "2.00", pay: "Customer" },
              ].map((r, i) => (
                <div key={i} style={{ padding: "12px 14px", background: "var(--surface, #fff)", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>Request {i + 1}</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <input defaultValue={r.text} placeholder="Enter job request (MOT, Service, Diagnostic)" style={{ flex: "2 1 250px", minWidth: 250, padding: "8px 10px", borderRadius: 6 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="number" min="0" step="0.01" defaultValue={r.hours} placeholder="0.00" className="app-input" style={{ width: 90, padding: "8px 10px", borderRadius: 6 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>h</span>
                    </div>
                    <select className="job-request-payment-dropdown" defaultValue={r.pay} style={{ padding: "8px 10px", borderRadius: 6, minWidth: 120 }}>
                      <option>Customer</option><option>Warranty</option><option>Internal</option>
                    </select>
                    <button type="button" className="app-btn app-btn--secondary app-btn--sm">Question Prompts</button>
                    <button type="button" className="app-btn app-btn--danger app-btn--sm">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="button" className="app-btn app-btn--primary">+ Add Request</button>
            </div>
          </div>

          {/* Bottom row — four small cards */}
          <div className="job-cards-create-bottom-row" style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <YesNoHeaderCard title="Cosmetic Damage" />
            <YesNoHeaderCard title="Wash" />
            <YesNoHeaderCard title="VHC Required?" />
            <YesNoHeaderCard
              title="Documents"
              extra={<button type="button" className="app-btn app-btn--primary" style={{ padding: "4px 12px", fontSize: 12 }}>Manage Documents</button>}
            />
          </div>
    </div>
  );
}

// ---------- Appointments -------------------------------------------------
// Mirrors src/pages/appointments/index.js: primary-tinted 4-column search bar,
// 10-column availability diary with colour-coded severity rows, and a side
// jobs panel with tabs (All Jobs / Tech Hours) + sticky jobs table.
function AppointmentsMock() {
  const days = [
    { date: "Mon 22 Apr", techs: "6", pct: 82, hours: "48", jobs: 12, finish: "17:30", svc: 5, mot: 2, diag: 3, other: 2, off: 1, severity: "high", selected: true },
    { date: "Tue 23 Apr", techs: "6", pct: 45, hours: "27", jobs: 7,  finish: "14:45", svc: 3, mot: 1, diag: 1, other: 2, off: 0, severity: "mid",  selected: false },
    { date: "Wed 24 Apr", techs: "5", pct: 30, hours: "18", jobs: 4,  finish: "12:30", svc: 2, mot: 1, diag: 0, other: 1, off: 1, severity: "low",  selected: false },
    { date: "Thu 25 Apr", techs: "6", pct: 65, hours: "39", jobs: 9,  finish: "16:15", svc: 4, mot: 2, diag: 2, other: 1, off: 0, severity: "mid",  selected: false },
    { date: "Fri 26 Apr", techs: "6", pct: 92, hours: "55", jobs: 14, finish: "18:00", svc: 6, mot: 3, diag: 4, other: 1, off: 0, severity: "high", selected: false },
    { date: "Sat 27 Apr", techs: "3", pct: 25, hours: "9",  jobs: 3,  finish: "12:00", svc: 2, mot: 1, diag: 0, other: 0, off: 2, severity: "low",  selected: false },
  ];
  const borderFor = (sev) => ({ high: "#dc2626", mid: "#ca8a04", low: "#16a34a" }[sev] || "#16a34a");
  const rowBgFor  = (sev, selected) => selected ? "rgba(220,38,38,0.10)" : ({ high: "rgba(220,38,38,0.04)", mid: "rgba(234,179,8,0.05)", low: "rgba(34,197,94,0.04)" }[sev] || "transparent");

  const jobsToday = [
    { time: "08:00", job: "DEMO-1042", reg: "DE24 XYZ", vehicle: "VW Golf",     customer: "Alex Morgan",    type: "Service+Diag", cstat: "Waiting",       est: "3.5h", check: "✓" },
    { time: "08:30", job: "DEMO-1044", reg: "TV22 HNP", vehicle: "BMW 3",        customer: "Tom Reynolds",   type: "MOT",          cstat: "Collecting",    est: "1.0h", check: "✓" },
    { time: "10:00", job: "DEMO-1043", reg: "TA23 ABC", vehicle: "Ford Kuga",    customer: "Priya Shah",     type: "Diagnostic",   cstat: "Courtesy car",  est: "2.5h", check: "—" },
    { time: "13:00", job: "DEMO-1046", reg: "EA23 QRS", vehicle: "Peugeot 3008", customer: "L. Brennan",     type: "Service",      cstat: "Waiting",       est: "1.5h", check: "—" },
  ];

  const thStyle = {
    padding: "10px 10px",
    background: "var(--accentMain)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    textAlign: "center",
  };
  const stickyThStyle = {
    padding: "10px 12px",
    background: "var(--surfaceMuted, rgba(0,0,0,0.03))",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-secondary)",
    position: "sticky",
    top: 0,
  };

  return (
    <div className="app-page-stack" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Top control bar — primary-tinted 4-col grid */}
      <div className="app-section-card" data-presentation="appointments-booking-toolbar" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, alignItems: "center", background: "rgba(220,38,38,0.10)" }}>
        <input type="search" placeholder="Search by Job #, Name, Reg, or Vehicle..." style={{ padding: "8px 12px", borderRadius: 6, background: "var(--surface, #fff)" }} />
        <input type="text" placeholder="Job Number" style={{ padding: "8px 12px", borderRadius: 6, background: "var(--surface, #fff)" }} />
        <select defaultValue="" style={{ padding: "8px 10px", borderRadius: 6, background: "var(--surface, #fff)" }}>
          <option value="" disabled>Select time</option>
          <option>08:00</option><option>08:30</option><option>09:00</option><option>09:30</option><option>10:00</option>
        </select>
        <button type="button" className="app-btn app-btn--primary">Book Appointment</button>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
        {/* Availability diary — 10 columns */}
        <div data-presentation="appointments-capacity-table" style={{ flex: "1 1 auto", borderRadius: 8, overflow: "hidden", background: "var(--surface, #fff)" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "15%" }} /><col style={{ width: "19%" }} /><col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} /><col style={{ width: "9%" }} /><col style={{ width: "9%" }} />
              <col style={{ width: "7%" }} /><col style={{ width: "10%" }} /><col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: "left" }}>Date</th>
                <th style={{ ...thStyle, textAlign: "left" }}>Availability</th>
                <th style={thStyle}>Hours</th>
                <th style={thStyle}>Jobs</th>
                <th style={thStyle}>Finish</th>
                <th style={thStyle}>Services</th>
                <th style={thStyle}>MOT</th>
                <th style={thStyle}>Diagnosis</th>
                <th style={thStyle}>Other</th>
                <th style={thStyle}>Staff Off</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} style={{ background: rowBgFor(d.severity, d.selected) }}>
                  <td style={{ padding: "10px 10px", borderLeft: `4px solid ${borderFor(d.severity)}`, fontSize: 13, fontWeight: d.selected ? 700 : 600, color: "var(--accentMain)" }}>{d.date}</td>
                  <td style={{ padding: "10px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13 }}>{d.techs} tech{d.techs === "1" ? "" : "s"}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 999, background: "var(--surfaceMuted, rgba(0,0,0,0.06))", fontSize: 11, fontWeight: 700 }}>{d.pct}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "center" }}>{d.hours}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: 600 }}>{d.jobs}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center" }}>{d.finish}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: d.svc > 0 ? 700 : 400 }}>{d.svc}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: d.mot > 0 ? 700 : 400 }}>{d.mot}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: d.diag > 0 ? 700 : 400 }}>{d.diag}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: d.other > 0 ? 700 : 400 }}>{d.other}</td>
                  <td style={{ padding: "10px 10px", textAlign: "center", color: d.off > 0 ? "#dc2626" : "var(--text-secondary)", fontWeight: d.off > 0 ? 700 : 400 }}>{d.off > 0 ? d.off : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Jobs for selected day panel */}
        <div className="app-section-card" data-presentation="appointments-day-jobs" style={{ flex: "0 0 40%", background: "var(--surfaceMuted, rgba(0,0,0,0.02))", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Jobs for Mon 22 Apr</h3>
            <span style={{ padding: "2px 8px", borderRadius: 999, background: "var(--surface, #fff)", fontSize: 12, fontWeight: 700 }}>12</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={{ padding: "6px 12px", border: "2px solid var(--accentMain)", background: "var(--surface, #fff)", color: "var(--accentMain)", fontWeight: 700, borderRadius: 6, fontSize: 13 }}>All Jobs (12)</button>
            <button type="button" style={{ padding: "6px 12px", background: "var(--surface, #fff)", color: "var(--text-secondary)", borderRadius: 6, fontSize: 13 }}>Tech Hours</button>
          </div>
          <div style={{ overflowX: "auto", background: "var(--surface, #fff)", borderRadius: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={stickyThStyle}>Time</th>
                  <th style={stickyThStyle}>Job #</th>
                  <th style={stickyThStyle}>Reg</th>
                  <th style={stickyThStyle}>Vehicle</th>
                  <th style={stickyThStyle}>Customer</th>
                  <th style={stickyThStyle}>Job Type</th>
                  <th style={stickyThStyle}>Customer Status</th>
                  <th style={stickyThStyle}>EST Time</th>
                  <th style={{ ...stickyThStyle, textAlign: "center" }}>Check-In</th>
                </tr>
              </thead>
              <tbody>
                {jobsToday.map((j, i) => (
                  <tr key={j.job} style={{ background: i % 2 === 0 ? "transparent" : "var(--surfaceMuted, rgba(0,0,0,0.02))" }}>
                    <td style={{ padding: "12px 14px" }}>{j.time}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 700 }}>{j.job}</td>
                    <td style={{ padding: "12px 14px" }}>{j.reg}</td>
                    <td style={{ padding: "12px 14px" }}>{j.vehicle}</td>
                    <td style={{ padding: "12px 14px" }}>{j.customer}</td>
                    <td style={{ padding: "12px 14px" }}>{j.type}</td>
                    <td style={{ padding: "12px 14px" }}>{j.cstat}</td>
                    <td style={{ padding: "12px 14px" }}>{j.est}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center", color: j.check === "✓" ? "#16a34a" : "var(--text-secondary)" }}>{j.check}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- My Jobs (tech view) ------------------------------------------
// Mirrors src/pages/job-cards/myjobs/index.js exactly: outer .app-page-stack
// shell, accent-surface filter toolbar with SearchBar + 4 primary-outline
// filter buttons, results shell (accent-surface, radius-xl) with the
// 6-column header strip and row layout (Status / Job / Reg / Customer /
// Make/Model / Type), and the 4-tile summary stats.
const MYJOBS_STATUS_STYLES = {
  Waiting:      { background: "var(--warning-surface)", color: "var(--danger-dark)" },
  "In Progress":{ background: "var(--info-surface)",    color: "var(--accent-purple)" },
  Complete:     { background: "var(--success-surface)", color: "var(--success-dark)" },
};

function MyJobsRow({ job }) {
  const style = MYJOBS_STATUS_STYLES[job.status] || { background: "var(--info-surface)", color: "var(--info-dark)" };
  return (
    <div
      className="myjobs-row"
      style={{
        border: "none",
        padding: "12px 16px",
        borderRadius: "var(--radius-sm)",
        backgroundColor: "var(--surface)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        position: "relative",
      }}
    >
      <div style={{ backgroundColor: style.background, color: style.color, padding: "6px 12px", borderRadius: "var(--radius-xs)", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap", minWidth: "110px", textAlign: "center" }}>
        {job.status}
      </div>
      <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", minWidth: "90px" }}>{job.job_number}</span>
      <span style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 600, minWidth: "80px" }}>{job.reg}</span>
      <span style={{ fontSize: "13px", color: "var(--text-primary)", minWidth: "140px", flex: "0 0 auto" }}>{job.customer}</span>
      <span style={{ fontSize: "13px", color: "var(--text-secondary)", minWidth: "160px", flex: "1 1 auto" }}>{job.makeModel}</span>
      <span style={{ fontSize: "12px", color: "var(--text-secondary)", minWidth: "80px" }}>{job.type}</span>
    </div>
  );
}

function MyJobsMock() {
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const myJobs = [
    { job_number: "DEMO-1042", reg: "DE24 XYZ", customer: "Alex Morgan",   makeModel: "Volkswagen Golf",    type: "Service",   status: "In Progress" },
    { job_number: "DEMO-1044", reg: "TV22 HNP", customer: "Tom Reynolds",  makeModel: "BMW 3 Series",        type: "Svc + MOT", status: "Complete"    },
    { job_number: "DEMO-1043", reg: "TA23 ABC", customer: "Priya Shah",    makeModel: "Ford Kuga",           type: "Diag",      status: "Waiting"     },
    { job_number: "DEMO-1046", reg: "EA23 QRS", customer: "L. Brennan",    makeModel: "Peugeot 3008",        type: "Service",   status: "Waiting"     },
  ];
  const filterButtons = [
    { value: "all",         label: "All Jobs" },
    { value: "in-progress", label: "In Progress" },
    { value: "pending",     label: "Waiting" },
    { value: "complete",    label: "Complete" },
  ];
  const count = (s) => myJobs.filter(j => j.status === s).length;

  return (
    <div className="app-page-stack" style={{ minHeight: "100%" }}>
      {/* Header (intentionally empty — mirrors real page) */}
      <div className="myjobs-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div />
      </div>

      {/* Filter toolbar */}
      <div
        data-presentation="my-jobs-filters"
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "12px",
          backgroundColor: "var(--accent-surface)",
          border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
          borderRadius: "var(--radius-sm)",
          color: "var(--search-text)",
        }}
      >
        <SearchBar
          placeholder="Search by job number, customer, reg, or vehicle..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm("")}
          style={{ flex: 1, minWidth: "220px" }}
        />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {filterButtons.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              style={{
                minHeight: "var(--control-height-md)",
                padding: "0 16px",
                backgroundColor: filter === value ? "var(--primary)" : "var(--surface)",
                color: filter === value ? "var(--surface)" : "var(--primary)",
                border: "1px solid var(--primary)",
                borderRadius: "var(--input-radius)",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: filter === value ? 600 : 500,
                whiteSpace: "nowrap",
                transition: "all 0.2s",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results shell */}
      <div
        data-presentation="my-jobs-results"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRadius: "var(--radius-xl)",
          border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
          background: "var(--accent-surface)",
          padding: "var(--page-card-padding)",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            paddingRight: "8px",
            minHeight: 0,
          }}
        >
          {/* Column header strip */}
          <div
            className="myjobs-header"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--accent-surface-hover)",
              border: "none",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--primary-dark)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            <div style={{ minWidth: "110px", textAlign: "center" }}>Status</div>
            <div style={{ minWidth: "90px" }}>Job</div>
            <div style={{ minWidth: "80px" }}>Reg</div>
            <div style={{ minWidth: "140px", flex: "0 0 auto" }}>Customer</div>
            <div style={{ minWidth: "160px", flex: "1 1 auto" }}>Make/Model</div>
            <div style={{ minWidth: "80px" }}>Type</div>
          </div>

          {myJobs.map((j) => <MyJobsRow key={j.job_number} job={j} />)}
        </div>
      </div>

      {/* Summary stats */}
      <div
        className="app-section-card"
        style={{
          border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
          background: "var(--accent-surface)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px", textAlign: "center" }}>
          <div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--primary)", marginBottom: "4px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "34px" }}>{myJobs.length}</div>
            <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Total Jobs</div>
          </div>
          <div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--info)", marginBottom: "4px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "34px" }}>{count("In Progress")}</div>
            <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}>In Progress</div>
          </div>
          <div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--danger)", marginBottom: "4px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "34px" }}>{count("Waiting")}</div>
            <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Waiting</div>
          </div>
          <div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--info)", marginBottom: "4px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "34px" }}>{count("Complete")}</div>
            <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}>Completed</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Job Detail ---------------------------------------------------
// Mirrors src/pages/job-cards/[jobNumber].js: page stack (gap 16), header
// section with "Job Card #N" h1 + status + division badges + action buttons,
// 4-card summary grid (Vehicle+mileage / Customer / VHC Declined-Authorised /
// Key+Car location), tab-scroll-row with the full tab set from
// features/jobCards/workflow/permissions.js, then the Write Up tab content.
function JobDetailMock() {
  const sharedShell = "var(--tab-container-bg)";
  const tabs = [
    { id: "customer-requests", label: "Customer Requests" },
    { id: "contact",           label: "Contact" },
    { id: "scheduling",        label: "Scheduling" },
    { id: "service-history",   label: "Service History" },
    { id: "notes",             label: "Notes", badge: "2" },
    { id: "parts",             label: "Parts" },
    { id: "write-up",          label: "Write Up" },
    { id: "vhc",               label: "VHC" },
    { id: "warranty",          label: "Warranty" },
    { id: "clocking",          label: "Clocking" },
    { id: "messages",          label: "Messages" },
    { id: "documents",         label: "Documents" },
    { id: "invoice",           label: "Invoice" },
  ];
  const [activeTab, setActiveTab] = useState("write-up");
  const summaryPrimary = { fontSize: "16px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const summarySecondary = { fontSize: "13px", color: "var(--grey-accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header Section */}
      <section style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "20px", backgroundColor: sharedShell, borderRadius: "var(--radius-sm)", border: "none", flexShrink: 0 }} data-presentation="job-detail-status">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, color: "var(--primary)", fontSize: "28px", fontWeight: 700 }}>Job Card #DEMO-1042</h1>
            <span style={{ padding: "6px 16px", backgroundColor: "var(--success-surface)", color: "var(--success-dark)", borderRadius: "var(--control-radius-xs)", fontWeight: 600, fontSize: "13px", border: "1px solid currentColor", letterSpacing: "0.3px" }}>Open</span>
            <span style={{ padding: "6px 16px", backgroundColor: "var(--success-surface)", color: "var(--success-dark)", borderRadius: "var(--control-radius-xs)", fontWeight: 600, fontSize: "13px", border: "1px solid currentColor", letterSpacing: "0.3px" }}>Retail</span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
            <button type="button" className="app-btn app-btn--sm app-btn--primary">#DEMO-1042</button>
            <button type="button" className="app-btn app-btn--sm app-btn--primary">Link Job</button>
            <button type="button" style={{ padding: "var(--control-padding)", backgroundColor: "var(--primary)", color: "var(--text-inverse)", border: "none", borderRadius: "var(--control-radius)", cursor: "pointer", fontWeight: 600, fontSize: "var(--control-font-size)", minHeight: "var(--control-height)" }}>Create Invoice</button>
            <button type="button" style={{ padding: "var(--control-padding)", backgroundColor: "var(--success)", color: "var(--text-inverse)", border: "none", borderRadius: "var(--control-radius)", cursor: "pointer", fontWeight: 600, fontSize: "var(--control-font-size)", minHeight: "var(--control-height)" }}>Release Vehicle</button>
          </div>
        </div>
      </section>

      {/* Summary Grid */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "10px", flexShrink: 0, backgroundColor: sharedShell, borderRadius: "var(--radius-sm)", padding: "8px" }}>
        <div style={{ padding: "12px 14px", backgroundColor: "var(--surface)", borderRadius: "var(--radius-sm)", minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start", columnGap: "10px", marginBottom: "4px" }}>
            <div style={{ ...summaryPrimary, marginBottom: 0 }}>DE24 XYZ</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>Mileage</span>
              <span style={{ width: "64px", textAlign: "right", fontSize: "13px", color: "var(--grey-accent)", fontWeight: 500 }}>41,280</span>
            </div>
          </div>
          <div style={summarySecondary}>Volkswagen Golf</div>
        </div>
        <div style={{ padding: "12px 14px", backgroundColor: "var(--surface)", borderRadius: "var(--radius-sm)", minWidth: 0, overflow: "hidden" }}>
          <div style={summaryPrimary}>Alex Morgan</div>
          <div style={summarySecondary}>07700 900001</div>
        </div>
        <div style={{ padding: "12px 14px", backgroundColor: "var(--surface)", borderRadius: "var(--radius-sm)", minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "11px", color: "var(--danger)", marginBottom: "4px" }}>DECLINED</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--danger)", marginBottom: "4px" }}>£0.00</div>
            </div>
            <div style={{ width: "1px", backgroundColor: "var(--surface-light)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "var(--success)", marginBottom: "4px" }}>AUTHORISED</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--success)", marginBottom: "4px" }}>£142.50</div>
            </div>
          </div>
        </div>
        <div style={{ padding: "12px 14px", backgroundColor: "var(--surface)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "row", alignItems: "stretch", minWidth: 0, overflow: "hidden" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>Key location</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Key cabinet — Bay 2</div>
          </div>
          <div style={{ width: "1px", backgroundColor: "var(--surface-light)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>Car location</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Bay 2 — on ramp</div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section style={{ backgroundColor: "transparent", borderRadius: 0, padding: 0 }} data-presentation="job-detail-tabs">
        <div className="tab-scroll-row" style={{ backgroundColor: sharedShell, borderRadius: "var(--radius-sm)", padding: "8px", display: "flex", gap: "4px", overflowX: "auto" }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`tab-api__item${isActive ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "0.55rem 0.85rem",
                  fontSize: "0.82rem",
                  borderRadius: "var(--radius-xs)",
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "var(--primary)" : "transparent",
                  color: isActive ? "var(--surface)" : "var(--text-primary)",
                  fontWeight: isActive ? 700 : 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="app-badge app-badge--control app-badge--danger-strong" style={{ padding: "1px 6px", borderRadius: 999, background: "var(--danger)", color: "var(--text-inverse)", fontSize: "10px", fontWeight: 700 }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Tab content */}
      <section style={{ backgroundColor: sharedShell, borderRadius: "var(--radius-sm)", padding: "8px" }}>
        <div className="app-section-card">
          <h3 style={{ marginTop: 0, fontSize: "16px", fontWeight: 600 }}>Write Up</h3>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <Field label="Reg" value="DE24 XYZ" />
              <Field label="Make / Model" value="Volkswagen Golf" />
              <Field label="VIN" value="WVWZZZ1KZDEMO0001" />
              <Field label="Mileage in" value="41,280" />
              <Field label="Waiting status" value="Customer waiting" />
              <Field label="Appointment" value="22/04/2026, 08:30" />
            </div>
            <Field label="Customer complaint" value="Knocking noise from front suspension, also due for major service." full />
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>Job categories</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Diagnostic", "Service", "Brakes"].map((c) => (
                  <span key={c} style={{ padding: "4px 10px", borderRadius: "var(--control-radius-xs)", background: "var(--info-surface)", color: "var(--info-dark)", fontSize: 12, fontWeight: 600, border: "1px solid currentColor" }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------- VHC (customer-facing layout) ---------------------------------
// Mirrors src/features/customerPortal/pages/VhcPage.js exactly: a 2-column
// responsive grid (lg:grid-cols-2, gap-6) with the real VHCSummaryList +
// MessagingHub components driven by demo data — identical to what a real
// customer sees.
function VhcMock() {
  // MessagingHub expects { id, label, name } shape
  const contacts = [
    { id: 1, label: "Service Desk",           name: "Reception · Mon-Fri 8am–6pm" },
    { id: 2, label: "Your technician",        name: "Demo Tech A · Working on DE24 XYZ" },
    { id: 3, label: "Parts enquiries",        name: "Parts Desk · Live stock lookup" },
  ];
  // VHCSummaryList expects summaries { id, vehicleId, createdAt, status, redItems, amberItems, media }
  const summaries = [
    { id: "vhc-demo-001", vehicleId: "demo-veh-001", createdAt: "22 Apr 2026", status: "Amber advisories", redItems: 1, amberItems: 2, media: 4 },
    { id: "vhc-demo-002", vehicleId: "demo-veh-001", createdAt: "12 Mar 2026", status: "Green — pass",     redItems: 0, amberItems: 0, media: 0 },
  ];
  return (
    <div className="customer-portal-shell">
      <div className="customer-portal-stack">
        <div className="grid gap-6 lg:grid-cols-2">
          <div data-presentation="vhc-summary-list">
            <VHCSummaryList summaries={summaries} vehicles={demoVehicles.map(v => ({ id: v.id, reg: v.reg, makeModel: `${v.make} ${v.model}` }))} />
          </div>
          <div data-presentation="vhc-customer-messages">
            <MessagingHub contacts={contacts} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Parts: Create Order -----------------------------------------
// Mirrors src/pages/parts/create-order/index.js: outer 24px-padded stack,
// single `.app-section-card` form with Customer details sub-section (header
// row showing strong title + Edit / Clear buttons, followed by a read-only
// customer info card + 2-column form grid), then Vehicle details, Delivery,
// and Line items sections with the same spacing tokens as the real page.
function PartsCreateMock() {
  const inputStyle = {
    padding: "10px 12px",
    border: "1px solid var(--surface-light)",
    borderRadius: "var(--radius-sm)",
    background: "var(--surface)",
    color: "var(--text-primary)",
    fontSize: "0.95rem",
    width: "100%",
  };
  const fieldStyle = { display: "flex", flexDirection: "column", gap: "6px" };
  const twoColumnGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" };
  const sectionCardStyle = {
    border: "1px solid var(--surface-light)",
    borderRadius: "var(--radius-md)",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    background: "var(--layer-section-level-2, var(--surface))",
  };
  const sectionHeaderStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  };
  const editBtn = {
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--primary)",
    background: "var(--primary)",
    color: "var(--surface)",
    padding: "8px 14px",
    fontWeight: 600,
    cursor: "pointer",
  };
  const clearBtn = {
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--danger)",
    background: "var(--danger-surface)",
    color: "var(--danger)",
    padding: "8px 14px",
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <section className="app-section-card" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Customer details */}
          <div data-presentation="parts-customer-context" style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <strong style={{ fontSize: "1.05rem" }}>Customer details</strong>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" style={editBtn}>Edit customer details</button>
                <button type="button" style={clearBtn}>Clear customer</button>
              </div>
            </div>
            <div style={{ border: "none", borderRadius: "var(--radius-md)", padding: "12px", background: "var(--surface)" }}>
              <strong>{demoJobs[0].customer_name}</strong>
              <div style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                alex.morgan@demo.invalid · 07700 900001
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                12 High Street, Exeter, EX1 1AA
              </div>
            </div>
            <div style={twoColumnGrid}>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Customer name</span>
                <input type="text" disabled value={demoJobs[0].customer_name} style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Customer phone</span>
                <input type="tel" disabled value="07700 900001" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Customer email</span>
                <input type="email" disabled value="alex.morgan@demo.invalid" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Account / trade</span>
                <input type="text" disabled value="Retail" style={inputStyle} />
              </label>
            </div>
          </div>

          {/* Vehicle details */}
          <div style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <strong style={{ fontSize: "1.05rem" }}>Vehicle details</strong>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" style={editBtn}>Search vehicle</button>
              </div>
            </div>
            <div style={twoColumnGrid}>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Registration</span>
                <input type="text" defaultValue={demoJobs[0].reg} style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Make &amp; model</span>
                <input type="text" defaultValue={`${demoJobs[0].make} ${demoJobs[0].model}`} style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>VIN</span>
                <input type="text" defaultValue="WVWZZZ1KZDEMO0001" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Engine code</span>
                <input type="text" defaultValue="CDAB" style={inputStyle} />
              </label>
            </div>
          </div>

          {/* Delivery */}
          <div style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <strong style={{ fontSize: "1.05rem" }}>Delivery</strong>
            </div>
            <div style={twoColumnGrid}>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Delivery type</span>
                <DropdownField
                  value="courier"
                  onChange={() => {}}
                  options={[
                    { value: "courier",    label: "Next-day courier" },
                    { value: "collection", label: "Collection" },
                    { value: "walk_in",    label: "Walk-in" },
                  ]}
                />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Delivery ETA</span>
                <CalendarField value="2026-04-23" onChange={() => {}} name="deliveryEta" />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Delivery address</span>
                <input type="text" defaultValue="HNP Service Centre · Goods-in bay" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Delivery window</span>
                <input type="text" defaultValue="09:00 – 11:00" style={inputStyle} />
              </label>
              <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
                <span style={{ fontWeight: 600 }}>Notes for driver</span>
                <textarea
                  defaultValue="Leave with parts desk — ask for Demo Tech A if no answer."
                  style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                />
              </label>
            </div>
          </div>

          {/* Line items */}
          <div data-presentation="parts-line-items" style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <strong style={{ fontSize: "1.05rem" }}>Line items</strong>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" style={{ ...editBtn, background: "var(--surface)", color: "var(--primary)" }}>Advanced lookup</button>
                <button type="button" style={editBtn}>+ Add part</button>
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...mockHeaderCellStyle, textAlign: "left" }}>Part #</th>
                  <th style={{ ...mockHeaderCellStyle, textAlign: "left" }}>Description</th>
                  <th style={{ ...mockHeaderCellStyle, textAlign: "center" }}>Qty</th>
                  <th style={{ ...mockHeaderCellStyle, textAlign: "right" }}>Unit</th>
                  <th style={{ ...mockHeaderCellStyle, textAlign: "center" }}>Status</th>
                  <th style={{ ...mockHeaderCellStyle, textAlign: "right" }}>Line total</th>
                </tr>
              </thead>
              <tbody>
                {demoParts.filter((p) => p.job_number === demoJobs[0].job_number).map((p) => (
                  <tr key={p.id}>
                    <td style={mockCellStyle}><strong>{p.part_number}</strong></td>
                    <td style={mockCellStyle}>{p.description}</td>
                    <td style={{ ...mockCellStyle, textAlign: "center" }}>{p.quantity}</td>
                    <td style={{ ...mockCellStyle, textAlign: "right" }}>£{p.cost.toFixed(2)}</td>
                    <td style={{ ...mockCellStyle, textAlign: "center" }}><StatusPill status={p.status} /></td>
                    <td style={{ ...mockCellStyle, textAlign: "right" }}>£{(p.cost * p.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={{ ...editBtn, background: "var(--surface)", color: "var(--primary)" }}>Save draft</button>
            <button type="submit" style={editBtn}>Submit order</button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ---------- Parts: Goods In ---------------------------------------------
// Mirrors src/pages/parts/goods-in.js: 12px-padded stack, 9-tab TabGroup
// (Global / Dealer / Stock / User Defined / Links / Sales History / Audi /
// Additional Fields / Online Store), Invoice details section with
// Supplier search + Scan doc toolbar and the field-grid shell, and the
// Add part section with 4+3 field grids.
function GoodsInLabel({ children }) {
  return (
    <label style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", fontWeight: 600, display: "block", marginBottom: 4 }}>
      {children}
    </label>
  );
}

function GoodsInInput(props) {
  const { style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{
        width: "100%",
        padding: "8px 10px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        background: "var(--surface)",
        ...(style || {}),
      }}
    />
  );
}

function PartsGoodsInMock() {
  const [activeTab, setActiveTab] = useState("global");
  const advancedTabs = [
    { id: "global",     label: "Global" },
    { id: "dealer",     label: "Dealer" },
    { id: "stock",      label: "Stock" },
    { id: "user",       label: "User Defined" },
    { id: "links",      label: "Links" },
    { id: "sales",      label: "Sales History" },
    { id: "audi",       label: "Audi" },
    { id: "additional", label: "Additional Fields" },
    { id: "online",     label: "Online Store" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", padding: "12px" }}>
      <div className="tab-api" style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: 4, background: "var(--surface-light)", borderRadius: "var(--radius-sm)" }}>
        {advancedTabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`tab-api__item${isActive ? " is-active" : ""}`}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "8px 14px",
                border: "1px solid var(--primary)",
                borderRadius: "var(--input-radius)",
                background: isActive ? "var(--primary)" : "var(--surface)",
                color: isActive ? "var(--surface)" : "var(--primary)",
                fontWeight: isActive ? 600 : 500,
                fontSize: "0.85rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <section className="app-section-card invoice-details-section" data-presentation="goods-in-invoice" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Invoice details</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <Button type="button" variant="secondary">Supplier search</Button>
            <Button type="button" variant="secondary">Scan doc</Button>
          </div>
        </div>
        <div style={{ border: "1px solid var(--surface-light)", borderRadius: "var(--control-radius)", padding: 12, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <div><GoodsInLabel>Supplier</GoodsInLabel><GoodsInInput defaultValue="VAG Parts Ltd" /></div>
            <div><GoodsInLabel>Invoice number</GoodsInLabel><GoodsInInput defaultValue="INV-24819" /></div>
            <div><GoodsInLabel>Delivery note number</GoodsInLabel><GoodsInInput defaultValue="DN-88102" /></div>
            <div><GoodsInLabel>Invoice date</GoodsInLabel><GoodsInInput type="date" defaultValue="2026-04-22" /></div>
            <div>
              <GoodsInLabel>Price level</GoodsInLabel>
              <select defaultValue="trade" style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface)" }}>
                <option value="trade">Trade</option><option value="retail">Retail</option><option value="internal">Internal</option>
              </select>
            </div>
            <div>
              <GoodsInLabel>Franchise</GoodsInLabel>
              <select defaultValue="vag" style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface)" }}>
                <option value="vag">VAG (VW / Audi / Seat / Skoda)</option><option value="ford">Ford</option><option value="bmw">BMW</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}><GoodsInLabel>Supplier address</GoodsInLabel><GoodsInInput defaultValue="Unit 12, Parts Trade Park, Bristol, BS3 4DF" /></div>
            <div style={{ gridColumn: "1 / -1" }}>
              <GoodsInLabel>Notes</GoodsInLabel>
              <textarea
                defaultValue="2 lines on backorder, expected next delivery 24 Apr."
                style={{ width: "100%", minHeight: 80, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface)", fontFamily: "inherit", resize: "vertical" }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="app-section-card add-part-section" data-presentation="goods-in-add-part" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Add part</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <Button type="button" variant="secondary">Part lookup</Button>
            <Button type="button" variant="primary">+ Add line</Button>
          </div>
        </div>
        <div style={{ border: "1px solid var(--surface-light)", borderRadius: "var(--control-radius)", padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 10 }}>
            <div><GoodsInLabel>Part #</GoodsInLabel><GoodsInInput defaultValue="1K0-407-366-C" /></div>
            <div><GoodsInLabel>Description</GoodsInLabel><GoodsInInput defaultValue="Front lower suspension arm" /></div>
            <div><GoodsInLabel>Quantity</GoodsInLabel><GoodsInInput type="number" defaultValue={1} /></div>
            <div><GoodsInLabel>Bin location</GoodsInLabel><GoodsInInput defaultValue="A-12-3" /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: 10, marginTop: 10 }}>
            <div><GoodsInLabel>Unit cost</GoodsInLabel><GoodsInInput defaultValue="82.40" /></div>
            <div><GoodsInLabel>VAT rate</GoodsInLabel><GoodsInInput defaultValue="20%" /></div>
            <div><GoodsInLabel>Line total</GoodsInLabel><GoodsInInput defaultValue="£82.40" readOnly /></div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------- Parts: Deliveries -------------------------------------------
// Mirrors src/pages/parts/deliveries.js: outer container padding 20px, then
// a header card (Driver view eyebrow + h1 + caption, Selected day label +
// Previous day / CalendarField / Next day dark button row, and the Queued /
// Completed count stats), then a list card (heading + caption + job rows
// with primary-dark invoice number + uppercase status chip + address/ETA +
// reorder arrows + primary "Mark delivered" button).
function PartsDeliveriesChip({ status }) {
  const variants = {
    scheduled: { background: "rgba(var(--warning-rgb),0.15)", color: "var(--danger-dark)" },
    en_route:  { background: "rgba(var(--info-rgb),0.2)",     color: "var(--accent-purple)" },
    completed: { background: "rgba(var(--success-rgb,34,139,34),0.25)", color: "var(--success, #297C3B)" },
  };
  const v = variants[status] || variants.scheduled;
  return (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: "var(--radius-pill)",
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        ...v,
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function PartsDeliveriesMock() {
  const [selectedDate, setSelectedDate] = useState("2026-04-22");
  const jobs = [
    { id: 1, invoice_number: "INV-DEMO-5091", customer: "Alex Morgan",   address: "12 High Street, Exeter",  eta: "10:30", status: "en_route",  paid: true,  qty: 2 },
    { id: 2, invoice_number: "INV-DEMO-5092", customer: "Priya Shah",    address: "48 Oak Lane, Taunton",    eta: "11:45", status: "scheduled", paid: false, qty: 1 },
    { id: 3, invoice_number: "INV-DEMO-5088", customer: "Tom Reynolds",  address: "7 Church Road, Tiverton", eta: "09:00", status: "completed", paid: true,  qty: 3 },
  ];
  const pendingCount = jobs.filter((j) => j.status !== "completed").length;
  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const adjustDay = (delta) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + delta);
    setSelectedDate(date.toISOString().slice(0, 10));
  };
  const formatDate = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <section className="app-section-card" data-presentation="deliveries-day-controls" style={{ gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary-dark)", fontSize: "0.85rem" }}>Driver view</p>
          <h1 style={{ margin: 0, color: "var(--primary)" }}>Parts deliveries</h1>
          <p style={{ margin: 0, color: "var(--info)" }}>
            Quickly review today&rsquo;s drop offs, mark jobs as delivered, and reorder the list for the van.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--primary-dark)" }}>Selected day</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{formatDate(selectedDate)}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => adjustDay(-1)}
              style={{ borderRadius: "var(--radius-sm)", border: "none", background: "var(--surface)", color: "var(--primary-dark)", padding: "var(--control-padding)", cursor: "pointer", fontWeight: 600 }}
            >
              Previous day
            </button>
            <CalendarField value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} name="selectedDate" />
            <button
              type="button"
              onClick={() => adjustDay(1)}
              style={{ borderRadius: "var(--radius-sm)", border: "none", background: "var(--primary-dark)", color: "var(--surface)", padding: "var(--control-padding)", cursor: "pointer", fontWeight: 600 }}
            >
              Next day
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--info)" }}>Queued jobs</div>
            <strong style={{ fontSize: "1.6rem" }}>{pendingCount}</strong>
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--info)" }}>Completed</div>
            <strong style={{ fontSize: "1.6rem" }}>{completedCount}</strong>
          </div>
        </div>
      </section>

      <section className="app-section-card" data-presentation="deliveries-list" style={{ gap: "14px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <h2 style={{ margin: 0, color: "var(--primary-dark)" }}>Delivery list</h2>
          <p style={{ margin: 0, color: "var(--grey-accent-dark)" }}>
            Tap a job to view invoice details. Use the arrows to change the drive order.
          </p>
        </div>

        {jobs.map((job) => {
          const isCompleted = job.status === "completed";
          return (
            <article
              key={job.id}
              style={{
                border: "none",
                borderRadius: "var(--radius-md)",
                padding: "var(--section-card-padding)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                background: isCompleted ? "rgba(var(--success-rgb,34,139,34),0.08)" : "var(--surface)",
                width: "100%",
              }}
            >
              <button
                type="button"
                style={{ border: "none", background: "transparent", padding: 0, textAlign: "left", display: "flex", flexDirection: "column", gap: "8px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                  <div style={{ fontWeight: 700, color: "var(--primary-dark)" }}>{job.invoice_number}</div>
                  <PartsDeliveriesChip status={job.status} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", color: "var(--info)", fontSize: "0.9rem" }}>
                  <span>{job.customer} · {job.qty} item{job.qty === 1 ? "" : "s"}</span>
                  <span>{job.paid ? "Paid" : "Awaiting payment"}</span>
                </div>
                <div style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{job.address}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--grey-accent-dark)" }}>ETA {job.eta}</div>
              </button>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "stretch", justifyContent: "space-between" }}>
                <button
                  type="button"
                  disabled={isCompleted}
                  style={{
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    padding: "var(--control-padding)",
                    fontWeight: 600,
                    cursor: isCompleted ? "default" : "pointer",
                    background: isCompleted ? "rgba(var(--success-rgb,34,139,34),0.2)" : "var(--primary)",
                    color: isCompleted ? "var(--success, #297C3B)" : "var(--surface)",
                    flex: "1 1 180px",
                    textAlign: "center",
                  }}
                >
                  {isCompleted ? "Delivered" : "Mark delivered"}
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "160px" }}>
                  <button type="button" style={{ borderRadius: "var(--radius-sm)", border: "none", background: "var(--danger-surface)", padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}>↑ Move up</button>
                  <button type="button" style={{ borderRadius: "var(--radius-sm)", border: "none", background: "var(--danger-surface)", padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}>↓ Move down</button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

// ---------- Valet --------------------------------------------------------
// Mirrors src/pages/valet/index.js: page shell with 20px padding, filter row
// (SearchBar + CalendarField-style date + Today + All days buttons + count),
// the 8-column VALET_TABLE_COLUMNS grid header, and accent-purple-surface
// row cards with the exact column contents (Job # | Reg | Customer | Vehicle
// Here | Workshop | MOT | Wash | EST Tech Completion).
const VALET_TABLE_COLUMNS = "minmax(0, 0.8fr) minmax(0, 0.72fr) minmax(0, 1.45fr) repeat(4, minmax(84px, 0.62fr)) minmax(0, 1fr)";

function ValetRow({ job }) {
  return (
    <div
      style={{
        border: "none",
        padding: "12px 16px",
        borderRadius: "var(--radius-sm)",
        backgroundColor: "var(--accent-purple-surface)",
        boxShadow: "none",
        display: "grid",
        gridTemplateColumns: VALET_TABLE_COLUMNS,
        gap: "6px",
        alignItems: "center",
        width: "100%",
        minHeight: "84px",
        boxSizing: "border-box",
      }}
    >
      <button
        type="button"
        style={{
          fontSize: "14px", fontWeight: 700, color: "var(--accent-purple)",
          minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer",
        }}
      >
        {job.jobNumber}
      </button>
      <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent-purple)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {job.reg}
      </span>
      <span style={{ fontSize: "14px", color: "var(--text-primary)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {job.customer}
      </span>
      {["vehicleHere", "workshop", "mot", "wash"].map((field) => (
        <div key={field} style={{ display: "flex", justifyContent: "center", alignItems: "center", minWidth: 0, width: "100%" }}>
          <input
            type="checkbox"
            defaultChecked={Boolean(job[field])}
            style={{ width: 20, height: 20, accentColor: "var(--accent-purple)", cursor: "pointer" }}
          />
        </div>
      ))}
      <span style={{ fontSize: "13px", color: "var(--text-primary)", textAlign: "right", whiteSpace: "nowrap" }}>
        {job.estCompletion}
      </span>
    </div>
  );
}

function ValetMock() {
  const [searchTerm, setSearchTerm] = useState("");
  const jobs = [
    { jobNumber: "DEMO-1042", reg: "DE24 XYZ", customer: "Alex Morgan",   vehicleHere: true,  workshop: true,  mot: false, wash: true,  estCompletion: "Today · 13:30" },
    { jobNumber: "DEMO-1043", reg: "TA23 ABC", customer: "Priya Shah",    vehicleHere: true,  workshop: true,  mot: false, wash: false, estCompletion: "Tomorrow · 15:00" },
    { jobNumber: "DEMO-1044", reg: "TV22 HNP", customer: "Tom Reynolds",  vehicleHere: true,  workshop: true,  mot: true,  wash: true,  estCompletion: "Today · 11:45" },
    { jobNumber: "DEMO-1045", reg: "DA72 OME", customer: "R. Patel",      vehicleHere: false, workshop: false, mot: false, wash: false, estCompletion: "23/04 · 14:00" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "20px", gap: "16px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div data-presentation="valet-filters" style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <SearchBar
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm("")}
            placeholder="Search by reg, job number, customer, or vehicle"
            style={{ flex: 1, minWidth: "240px" }}
          />
          <div style={{ minWidth: "220px", flex: "0 0 220px" }}>
            <input
              type="date"
              defaultValue="2026-04-22"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid rgba(var(--grey-accent-rgb), 0.3)",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <button
            type="button"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(var(--grey-accent-rgb), 0.3)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Today
          </button>
          <button
            type="button"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(var(--grey-accent-rgb), 0.3)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            All days
          </button>
          <span style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
            Showing {jobs.length} jobs
          </span>
        </div>

        {/* Column header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: VALET_TABLE_COLUMNS,
            gap: "10px",
            width: "100%",
            padding: "0 16px 4px",
            alignItems: "center",
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          <span style={{ minWidth: 0 }}>Job Number</span>
          <span style={{ minWidth: 0 }}>Reg</span>
          <span style={{ minWidth: 0 }}>Customer</span>
          <span style={{ textAlign: "center", minWidth: 0 }}>Vehicle Here</span>
          <span style={{ textAlign: "center", minWidth: 0 }}>Workshop</span>
          <span style={{ textAlign: "center", minWidth: 0 }}>MOT</span>
          <span style={{ textAlign: "center", minWidth: 0 }}>Wash</span>
          <span style={{ textAlign: "right" }}>EST TECH COMPLETION</span>
        </div>
      </div>

      <div data-presentation="valet-table" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {jobs.map((j) => <ValetRow key={j.jobNumber} job={j} />)}
      </div>
    </div>
  );
}

// ---------- Messages -----------------------------------------------------
// Mirrors src/pages/messages/index.js: 2-column grid (360px threads panel +
// flex message panel), threads card uses --accent-purple-surface background,
// toolbar with System + Select + `+` pill buttons, message bubbles aligned
// left/right with 62% max-width.
function MessagesMock() {
  const threads = [
    { name: "Demo Tech A",  preview: "DEMO-1042 — front arm fitted, ready for road test.", when: "09:42", unread: true, selected: true },
    { name: "Parts Desk",   preview: "Crank sensor arrived for DEMO-1043.",                when: "09:28", unread: true, selected: false },
    { name: "Reception",    preview: "Customer for DEMO-1044 calling at 11:30.",            when: "09:10", unread: false, selected: false },
    { name: "Service Mgr",  preview: "Quick question on carry-over list.",                  when: "Yesterday", unread: false, selected: false },
    { name: "MOT Tester",   preview: "TV22 HNP passed MOT, emailed certificate.",           when: "Yesterday", unread: false, selected: false },
  ];
  const messages = [
    { me: false, text: "DEMO-1042 write-up almost done, found two advisories.", when: "09:40" },
    { me: true,  text: "Great — add photos and push to customer VHC.",           when: "09:41" },
    { me: false, text: "Done. Front arm fitted, ready for road test.",          when: "09:42" },
  ];

  return (
    <div
      className="app-page-stack"
      style={{
        display: "grid",
        gridTemplateColumns: "360px minmax(0, 1fr)",
        gap: "20px",
        minHeight: "520px",
      }}
    >
      {/* Threads panel */}
      <div data-presentation="messages-thread-list" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div
          style={{
            background: "var(--accent-purple-surface)",
            borderRadius: "var(--radius-sm)",
            padding: "16px",
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>Messages</div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <Button type="button" variant="secondary" size="sm" pill>System</Button>
              <Button type="button" variant="secondary" size="sm" pill>Select</Button>
              <Button type="button" variant="primary"   size="sm" pill aria-label="Start new chat">+</Button>
            </div>
          </div>

          <SearchBar
            placeholder="Search messages…"
            value=""
            onChange={() => {}}
            onClear={() => {}}
            style={{ width: "100%" }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflow: "auto", paddingRight: 4 }}>
            {threads.map((t, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  background: t.selected ? "var(--surface)" : "rgba(255,255,255,0.45)",
                  borderRadius: "var(--radius-sm)",
                  border: t.selected ? "1px solid var(--primary)" : "1px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 40, height: 40,
                    borderRadius: "50%",
                    background: "var(--primary-surface)",
                    color: "var(--primary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 15,
                  }}
                >
                  {t.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>{t.name}</strong>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t.when}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.preview}</div>
                </div>
                {t.unread && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accentMain)" }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conversation panel */}
      <div data-presentation="messages-conversation" style={{ display: "flex", flexDirection: "column", gap: "18px", minHeight: 0 }}>
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-sm)",
            padding: 16,
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10 }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "var(--primary-surface)", color: "var(--primary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700,
              }}
            >
              D
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>Demo Tech A</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Technician · Online</div>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.me ? "flex-end" : "flex-start", maxWidth: "62%" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: m.me ? "var(--primary)" : "var(--surface-light)",
                    color: m.me ? "var(--text-inverse)" : "var(--text-primary)",
                    fontSize: 14,
                  }}
                >
                  {m.text}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", textAlign: m.me ? "right" : "left", marginTop: 4 }}>{m.when}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, paddingTop: 10 }}>
            <input
              placeholder="Type a message…"
              style={{ flex: 1, padding: "10px 12px", borderRadius: "var(--radius-sm)" }}
            />
            <Button type="button" variant="primary">Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Accounts: Invoices ------------------------------------------
// Mirrors src/pages/accounts/invoices/index.js — uses the real InvoiceTable
// component with demo invoice records. The real page is just this table +
// the Export / Accounts button row, so the mock renders identically.
function AccountsInvoicesMock() {
  const [filters, setFilters] = useState({ search: "", status: "", from: "", to: "", accountId: "" });
  const invoices = [
    { invoice_id: "INV-DEMO-5091", invoice_number: "INV-DEMO-5091", account_id: "ACC-041", customer_id: "demo-cust-001", customer_name: "Alex Morgan",   job_number: "DEMO-1042", invoice_total: 482.40, payment_status: "pending",  invoice_date: "2026-04-22" },
    { invoice_id: "INV-DEMO-5090", invoice_number: "INV-DEMO-5090", account_id: "ACC-029", customer_id: "demo-cust-002", customer_name: "Priya Shah",    job_number: "DEMO-1043", invoice_total: 318.75, payment_status: "sent",     invoice_date: "2026-04-20" },
    { invoice_id: "INV-DEMO-5089", invoice_number: "INV-DEMO-5089", account_id: "ACC-017", customer_id: "demo-cust-003", customer_name: "Tom Reynolds",  job_number: "DEMO-1044", invoice_total: 211.90, payment_status: "paid",     invoice_date: "2026-04-18" },
    { invoice_id: "INV-DEMO-5088", invoice_number: "INV-DEMO-5088", account_id: "ACC-092", customer_id: "demo-cust-004", customer_name: "M. Jennings",   job_number: "DEMO-0981", invoice_total: 612.00, payment_status: "overdue",  invoice_date: "2026-03-18" },
  ];
  const pagination = { page: 1, pageSize: 20, total: invoices.length };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div data-presentation="invoices-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <Button type="button" variant="secondary">Export</Button>
          <Button
            type="button"
            variant="secondary"
            style={{
              background: "rgba(var(--primary-rgb), 0.12)",
              borderColor: "rgba(var(--primary-rgb), 0.28)",
              color: "var(--primary-dark)",
            }}
          >
            Accounts
          </Button>
        </div>
        <div data-presentation="invoices-table">
          <InvoiceTable
            invoices={invoices}
            filters={filters}
            onFilterChange={setFilters}
            pagination={pagination}
            onPageChange={() => {}}
            onExport={() => {}}
            loading={false}
            accentSurface
            navigationDisabled
          />
        </div>
      </div>
    </div>
  );
}

// ---------- HR Dashboard ------------------------------------------------
// Mirrors src/pages/hr/index.js exactly: MetricCard grid at top, then two
// 2-column sections (Department Performance + Training Renewals, then
// Upcoming Holidays + Active Warnings). Uses the real MetricCard / StatusTag
// / SectionCard components.
function HrDashboardMock() {
  const metrics = [
    { icon: "👥", label: "Total Employees", primary: "34", secondary: "32 active / 2 inactive", trend: null },
    { icon: "📅", label: "On Leave Today",  primary: "3",  secondary: null, trend: { direction: "flat",  value: "—" } },
    { icon: "🎓", label: "Training Due",    primary: "5",  secondary: null, trend: { direction: "up",    value: "+2 vs last week" } },
    { icon: "📄", label: "Open Roles",      primary: "2",  secondary: null, trend: { direction: "down",  value: "-1 vs last week" } },
  ];
  const departmentPerformance = [
    { id: "workshop",  department: "Workshop",   productivity: 92, quality: 95, teamwork: 88 },
    { id: "parts",     department: "Parts",      productivity: 87, quality: 90, teamwork: 92 },
    { id: "reception", department: "Reception",  productivity: 95, quality: 93, teamwork: 96 },
    { id: "accounts",  department: "Accounts",   productivity: 90, quality: 98, teamwork: 89 },
  ];
  const trainingRenewals = [
    { id: 1, course: "First Aid at Work",  employee: "Demo Tech B",  dueDate: "2026-04-30", status: "Overdue"   },
    { id: 2, course: "Forklift Operation", employee: "Parts Driver", dueDate: "2026-05-12", status: "Due Soon"  },
    { id: 3, course: "Manual Handling",    employee: "Demo Tech A",  dueDate: "2026-07-01", status: "Scheduled" },
  ];
  const upcomingAbsences = [
    { id: 1, employee: "S. Keane",    department: "Reception", type: "Annual leave", startDate: "2026-04-24", endDate: "2026-04-30" },
    { id: 2, employee: "Demo Tech A", department: "Workshop",  type: "Training",     startDate: "2026-04-28", endDate: "2026-04-28" },
    { id: 3, employee: "Demo Driver", department: "Parts",     type: "Sickness",     startDate: "2026-04-22", endDate: "2026-04-23" },
  ];
  const activeWarnings = [
    { id: 1, employee: "Demo Tech C", department: "Workshop", level: "Verbal Warning",  issuedOn: "2026-03-12", notes: "Late arrival on three consecutive mornings." },
    { id: 2, employee: "Demo Valet",  department: "Valet",    level: "Final Warning",   issuedOn: "2026-02-28", notes: "Repeated procedural non-compliance despite previous written warning." },
  ];

  return (
    <div className="app-page-stack" style={{ padding: "8px 8px 32px" }}>
      <section data-presentation="hr-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--layout-card-gap)" }}>
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} accentColor="var(--accentMain)" />
        ))}
      </section>

      <section data-presentation="hr-compliance" style={{ display: "grid", gap: "var(--layout-card-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <SectionCard
          title="Department Performance Snapshot"
          subtitle="Productivity, quality, and teamwork scoring (rolling 30 days)"
        >
          <div style={{ overflowX: "auto" }}>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Productivity</th>
                  <th>Quality</th>
                  <th>Teamwork</th>
                </tr>
              </thead>
              <tbody>
                {departmentPerformance.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.department}</td>
                    <td>{d.productivity}%</td>
                    <td>{d.quality}%</td>
                    <td>{d.teamwork}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Training Renewals"
          subtitle="Upcoming expiries across mandatory certifications"
          action={<span style={{ fontSize: "var(--text-label)", fontWeight: 600, color: "var(--accentText)" }}>View all</span>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {trainingRenewals.map((r) => {
              const tone = r.status === "Overdue" ? "danger" : r.status === "Due Soon" ? "warning" : "default";
              return (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: "var(--space-3)",
                    gap: "var(--space-3)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.course}</span>
                    <span style={{ fontSize: "var(--text-label)", color: "var(--text-secondary)" }}>{r.employee}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--space-1)" }}>
                    <span style={{ fontSize: "var(--text-label)", color: "var(--text-secondary)" }}>Due {new Date(r.dueDate).toLocaleDateString()}</span>
                    <StatusTag label={r.status} tone={tone} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </section>

      <section style={{ display: "grid", gap: "var(--layout-card-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <SectionCard
          title="Upcoming Holidays & Absences"
          subtitle="Next 14 days across the business"
          action={<span style={{ fontSize: "var(--text-label)", fontWeight: 600, color: "var(--accentText)" }}>Manage leave</span>}
        >
          <div style={{ overflowX: "auto" }}>
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Dates</th>
                </tr>
              </thead>
              <tbody>
                {upcomingAbsences.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.employee}</td>
                    <td>{a.department}</td>
                    <td>{a.type}</td>
                    <td>{new Date(a.startDate).toLocaleDateString()} - {new Date(a.endDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Active Warnings"
          subtitle="Summary of open disciplinary notices"
          action={<span style={{ fontSize: "var(--text-label)", fontWeight: 600, color: "var(--accentText)" }}>Review log</span>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {activeWarnings.map((w) => (
              <div
                key={w.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-1)",
                  paddingBottom: "var(--space-3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{w.employee}</span>
                  <StatusTag label={w.level} tone={w.level.includes("Final") ? "danger" : "warning"} />
                </div>
                <span style={{ fontSize: "var(--text-label)", color: "var(--text-secondary)" }}>{w.department}</span>
                <span style={{ fontSize: "var(--text-label)", color: "var(--text-secondary)" }}>Issued {new Date(w.issuedOn).toLocaleDateString()}</span>
                <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-primary)" }}>{w.notes}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

// ---------- Customer Portal ---------------------------------------------
// Mirrors src/features/customerPortal/pages/DashboardPage.js widget grid,
// using the real CustomerHero / VehicleGarageCard / VHCSummaryList /
// AppointmentTimeline / MessagingHub components. The customer-portal-shell
// class provides the canonical background / spacing for the portal area.
function CustomerPortalMock() {
  const vehicles = demoVehicles.map((v) => ({
    id: v.id,
    reg: v.reg,
    makeModel: `${v.year} ${v.make} ${v.model}`,
    vin: v.vin,
    nextService: "22 Oct 2026",
    motExpiry: v.mot_expiry,
    colour: v.colour,
    latestVhc: { mediaItems: [] },
  }));
  const vhcSummaries = [
    { id: "vhc-demo-001", vehicleId: "demo-veh-001", createdAt: "22 Apr 2026", status: "Amber advisories", redItems: 1, amberItems: 2, media: 4 },
  ];
  const timelineEvents = [
    { id: 1, timestamp: "22 Apr 2026 · 08:30", label: "Booked in",          description: "Service + diagnostic at Bay 2" },
    { id: 2, timestamp: "22 Apr 2026 · 09:40", label: "VHC in progress",    description: "Demo Tech A started the health check" },
    { id: 3, timestamp: "22 Apr 2026 · 10:14", label: "VHC shared",         description: "Advisories shared for your approval" },
    { id: 4, timestamp: "14 Jul 2026",         label: "MOT due",            description: "Book in via the portal or give us a call" },
  ];
  const contacts = [
    { id: 1, label: "Service Desk",      name: "Reception · Mon-Fri 8am–6pm" },
    { id: 2, label: "Your technician",   name: "Demo Tech A" },
    { id: 3, label: "Parts enquiries",   name: "Parts Desk" },
  ];

  return (
    <div className="customer-portal-shell">
      <div className="customer-portal-stack">
        <div data-presentation="customer-hero">
          <CustomerHero nextVisit="Today, 22 Apr · 08:30 · Bay 2" lastUpdated="VHC shared 10:14" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2" data-presentation="customer-history">
          <VehicleGarageCard vehicles={vehicles} />
          <VHCSummaryList summaries={vhcSummaries} vehicles={vehicles} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <AppointmentTimeline events={timelineEvents} />
          <MessagingHub contacts={contacts} />
        </div>
      </div>
    </div>
  );
}

// ---------- Archive ------------------------------------------------------
// Mirrors src/pages/job-cards/archive/index.js: app-page-stack shell,
// transparent toolbar form (SearchBar + DropdownField status + DropdownField
// sort + Search + Registration Only + Clear filters buttons), then the
// accentSurfaceSubtle results panel containing the table with the exact
// status badges (--success-surface / --info-surface / --warning-surface).
const ARCHIVE_STATUS_BADGES = {
  Complete:  { bg: "var(--success-surface)", color: "var(--success-text)" },
  Released:  { bg: "var(--success-surface)", color: "var(--success-dark)" },
  Invoiced:  { bg: "var(--info-surface)",    color: "var(--accentText)" },
  Delivered: { bg: "var(--warning-surface)", color: "var(--warning-text)" },
  Archived:  { bg: "var(--info-surface)",    color: "var(--accentText)" },
};
const ARCHIVE_DEFAULT_BADGE = { bg: "var(--info-surface)", color: "var(--accentText)" };

function ArchiveMock() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("updated-desc");
  const [regOnly, setRegOnly] = useState(false);
  const rows = [
    { id: 1, jobNumber: "DEMO-0981", customer: "M. Jennings", vehicleMakeModel: "Audi A3",        vehicleReg: "EX20 PKL", status: "Invoiced",  updatedAt: "2026-04-18" },
    { id: 2, jobNumber: "DEMO-0976", customer: "S. Keane",    vehicleMakeModel: "Skoda Octavia",  vehicleReg: "WR71 ATM", status: "Complete",  updatedAt: "2026-04-17" },
    { id: 3, jobNumber: "DEMO-0972", customer: "R. Patel",    vehicleMakeModel: "Mini Cooper S",  vehicleReg: "DA72 OME", status: "Released",  updatedAt: "2026-04-16" },
    { id: 4, jobNumber: "DEMO-0968", customer: "L. Brennan",  vehicleMakeModel: "Peugeot 3008",   vehicleReg: "EA23 QRS", status: "Delivered", updatedAt: "2026-04-15" },
    { id: 5, jobNumber: "DEMO-0962", customer: "J. Owens",    vehicleMakeModel: "Vauxhall Astra", vehicleReg: "BH70 FLM", status: "Archived",  updatedAt: "2026-04-12" },
  ];
  const availableStatuses = ["all", ...Array.from(new Set(rows.map((r) => r.status)))];

  return (
    <div className="app-page-stack" style={{ gap: "24px" }}>
      <form
        className="app-toolbar-row"
        data-presentation="archive-filters"
        onSubmit={(e) => e.preventDefault()}
        style={{
          display: "flex",
          width: "100%",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
          padding: 0,
          background: "transparent",
          border: "none",
          boxShadow: "none",
          borderRadius: 0,
          color: "var(--search-text)",
        }}
      >
        <div style={{ flex: "1 1 260px" }}>
          <SearchBar
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="Search by reg, job number, or customer name"
            style={{ flex: "1 1 260px" }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          <DropdownField
            aria-label="Filter archive results by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={availableStatuses.map((s) => ({ value: s, label: s === "all" ? "All statuses" : s }))}
            placeholder="All statuses"
            style={{ minWidth: "150px", width: "auto" }}
          />
          <DropdownField
            aria-label="Sort archive results"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            options={[
              { value: "updated-desc", label: "Newest completed" },
              { value: "updated-asc",  label: "Oldest completed" },
              { value: "job-asc",      label: "Job number A-Z" },
              { value: "job-desc",     label: "Job number Z-A" },
              { value: "customer-asc", label: "Customer A-Z" },
            ]}
            placeholder="Sort archive"
            style={{ minWidth: "180px", width: "auto" }}
          />
          <Button type="submit" variant="primary" style={{ minWidth: "120px" }}>Search</Button>
          <Button
            type="button"
            variant={regOnly ? "primary" : "secondary"}
            onClick={() => setRegOnly((c) => !c)}
            aria-pressed={regOnly}
          >
            Registration Only
          </Button>
          <Button type="button" variant="secondary">Clear filtes</Button>
        </div>
      </form>

      <section
        data-presentation="archive-results"
        style={{
          background: "var(--accentSurfaceSubtle)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--accentSurface)", color: "var(--surfaceText)" }}>
              <tr style={{ textAlign: "left", color: "var(--surfaceText)", fontSize: "0.85rem" }}>
                <th style={{ padding: "10px 18px" }}>Job #</th>
                <th style={{ padding: "10px 18px" }}>Customer</th>
                <th style={{ padding: "10px 18px" }}>Vehicle</th>
                <th style={{ padding: "10px 18px" }}>Status</th>
                <th style={{ padding: "10px 18px" }}>Completed</th>
                <th style={{ padding: "10px 18px" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => {
                const badge = ARCHIVE_STATUS_BADGES[job.status] || ARCHIVE_DEFAULT_BADGE;
                return (
                  <tr key={job.id} style={{ background: "var(--surface)" }}>
                    <td style={{ padding: "12px 18px", fontWeight: 600, color: "var(--accentText)" }}>{job.jobNumber}</td>
                    <td style={{ padding: "12px 18px", color: "var(--surfaceText)" }}>{job.customer || "—"}</td>
                    <td style={{ padding: "12px 18px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ fontWeight: 600, color: "var(--surfaceText)" }}>{job.vehicleMakeModel || "—"}</span>
                        <span style={{ color: "var(--surfaceTextMuted)" }}>{job.vehicleReg || "—"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 18px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 12px",
                          borderRadius: "var(--control-radius)",
                          background: badge.bg,
                          color: badge.color,
                          fontSize: "0.85rem",
                          fontWeight: 600,
                        }}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 18px", color: "var(--info-dark)" }}>
                      {new Date(job.updatedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "12px 18px" }}>
                      <span
                        style={{
                          textDecoration: "none",
                          padding: "8px 14px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--info)",
                          color: "var(--accent-purple)",
                          fontWeight: 600,
                          display: "inline-block",
                          cursor: "default",
                        }}
                      >
                        View archive
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------- Registry ----------------------------------------------------
export const MOCKS_BY_SLIDE_ID = {
  "dashboard": DashboardMock,
  "job-cards-list": JobCardsListMock,
  "job-create": JobCreateMock,
  "appointments": AppointmentsMock,
  "my-jobs": MyJobsMock,
  "job-detail": JobDetailMock,
  "vhc": VhcMock,
  "parts-create-order": PartsCreateMock,
  "parts-goods-in": PartsGoodsInMock,
  "parts-deliveries": PartsDeliveriesMock,
  "valet": ValetMock,
  "messages": MessagesMock,
  "accounts-invoices": AccountsInvoicesMock,
  "hr-dashboard": HrDashboardMock,
  "customer-portal": CustomerPortalMock,
  "archive": ArchiveMock,
};
