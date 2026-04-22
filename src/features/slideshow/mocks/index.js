import { demoJobs } from "../demoData/demoJobs";
import { demoParts } from "../demoData/demoParts";
import { demoAppointments } from "../demoData/demoAppointments";
import { demoVehicles } from "../demoData/demoVehicles";
import { PageShell, KpiTile, StatusPill, Field, PrimaryBtn, GhostBtn, mockCellStyle, mockHeaderCellStyle } from "./shared";

/* ------------------------------------------------------------------ *
 * Slideshow page mocks                                               *
 * ---                                                                *
 * Each mock mirrors the structural shape of its real page counterpart*
 * (same section order, same filter bars, same column sets, same      *
 * button labels). They render with demo data only — no hooks, no     *
 * network, no auth — so they're safe to show in presentations.       *
 * ------------------------------------------------------------------ */

// ---------- Dashboard -----------------------------------------------------
function DashboardMock() {
  return (
    <PageShell title="Welcome back, Demo User" subtitle="Today — Monday, 22 April 2026">
      <div className="app-section-card" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <GhostBtn>Search</GhostBtn>
        <GhostBtn>Filters</GhostBtn>
      </div>
      <div className="app-section-card">
        <h3 style={{ marginTop: 0 }}>Jobs overview</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={mockHeaderCellStyle}>Job number</th>
            <th style={mockHeaderCellStyle}>Customer</th>
            <th style={mockHeaderCellStyle}>Vehicle</th>
            <th style={mockHeaderCellStyle}>Status</th>
            <th style={mockHeaderCellStyle}>Technician</th>
          </tr></thead>
          <tbody>
            {demoJobs.map((j) => (
              <tr key={j.id}>
                <td style={mockCellStyle}><strong>{j.job_number}</strong></td>
                <td style={mockCellStyle}>{j.customer_name}</td>
                <td style={mockCellStyle}>{j.make} {j.model} · {j.reg}</td>
                <td style={mockCellStyle}><StatusPill status={j.status} /></td>
                <td style={mockCellStyle}>{j.assigned_technician}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

// ---------- Job Cards List (manager view) --------------------------------
function DivisionBadge({ division }) {
  const c = division === "Sales" ? { bg: "rgba(99,102,241,0.12)", fg: "#4338ca" } : { bg: "rgba(220,38,38,0.10)", fg: "#991b1b" };
  return <span style={{ padding: "2px 10px", borderRadius: 999, background: c.bg, color: c.fg, fontSize: 12, fontWeight: 600 }}>{division}</span>;
}

function JobListCard({ job }) {
  return (
    <div style={{ padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface, #fff)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 15 }}>{job.job_number}</strong>
        <span style={{ color: "var(--text-secondary)" }}>{job.reg}</span>
        <StatusPill status={job.status} />
        <DivisionBadge division={job.division} />
        <div style={{ flex: 1 }} />
        <GhostBtn>Quick view</GhostBtn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(6.5rem, 1fr))", gap: 12 }}>
        <Field label="Customer" value={job.customer_name} />
        <Field label="Technician" value={job.tech} />
        <Field label="Job type" value={job.jobType} />
        <Field label="Appointment" value={job.appt} />
        <Field label="Customer status" value={job.custStatus} />
        <Field label="VHC" value={job.vhc} />
      </div>
      {job.requests?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 6 }}>Customer requests</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {job.requests.map((r, i) => (
              <span key={i} style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(220,38,38,0.08)", color: "var(--accentMain)", fontSize: 12, fontWeight: 500 }}>{r}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function JobCardsListMock() {
  const rows = [
    { job_number: "DEMO-1042", reg: "DE24 XYZ", status: "In Progress", division: "Retail", customer_name: "Alex Morgan", tech: "Demo Tech A", jobType: "Service + Diag", appt: "22/04 08:30", custStatus: "Waiting", vhc: "In progress", requests: ["Knocking noise", "Major service"] },
    { job_number: "DEMO-1043", reg: "TA23 ABC", status: "Awaiting Parts", division: "Retail", customer_name: "Priya Shah", tech: "Demo Tech B", jobType: "Diagnostic", appt: "21/04 10:00", custStatus: "Courtesy car", vhc: "Complete", requests: ["EML on"] },
    { job_number: "DEMO-1044", reg: "TV22 HNP", status: "Ready for Collection", division: "Retail", customer_name: "Tom Reynolds", tech: "Demo Tech A", jobType: "Service + MOT", appt: "22/04 07:45", custStatus: "Collecting 2pm", vhc: "Complete", requests: [] },
    { job_number: "DEMO-1045", reg: "DA72 OME", status: "Booked", division: "Sales", customer_name: "R. Patel (Sales)", tech: "—", jobType: "PDI", appt: "23/04 09:00", custStatus: "Prep for delivery", vhc: "Pending", requests: ["Full valet", "Fuel to full"] },
  ];

  return (
    <PageShell>
      <div className="app-section-card" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {["Today's workload", "Carry over", "Orders"].map((t, i) => (
            <button key={t} type="button" className={i === 0 ? "app-btn app-btn--primary" : "app-btn app-btn--ghost"} style={{ padding: "8px 16px" }}>{t}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <input
            data-slideshow="job-cards-search"
            placeholder="Search orders / jobs…"
            style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6 }}
          />
          <div data-slideshow="job-cards-division-filter" style={{ display: "flex", gap: 4, padding: 4, background: "var(--surface, #fff)", borderRadius: 6, border: "1px solid var(--border)" }}>
            {["All", "Retail", "Sales"].map((d, i) => (
              <button key={d} type="button" className={i === 0 ? "app-btn app-btn--primary" : "app-btn app-btn--ghost"} style={{ flex: 1, padding: "6px 8px", fontSize: 12 }}>{d}</button>
            ))}
          </div>
          <div data-slideshow="job-cards-status-filter" style={{ display: "flex", gap: 4, padding: 4, background: "var(--surface, #fff)", borderRadius: 6, border: "1px solid var(--border)", overflowX: "auto" }}>
            {["All", "In Progress", "Awaiting Parts", "Ready"].map((s, i) => (
              <button key={s} type="button" className={i === 0 ? "app-btn app-btn--primary" : "app-btn app-btn--ghost"} style={{ padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}>{s}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((j) => <JobListCard key={j.job_number} job={j} />)}
      </div>
    </PageShell>
  );
}

// ---------- Create Job ---------------------------------------------------
function JobCreateMock() {
  return (
    <PageShell title="Create job card" subtitle="Enter vehicle, customer and requested work">
      <div className="app-section-card">
        <h3 style={{ marginTop: 0 }}>Vehicle</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div data-slideshow="create-reg-lookup"><Field label="Registration" value="DE24 XYZ" /></div>
          <Field label="Make" value="Volkswagen" />
          <Field label="Model" value="Golf" />
          <Field label="Year" value="2022" />
          <Field label="VIN" value="WVWZZZ1KZDEMO0001" />
          <Field label="MOT expiry" value="14 Aug 2026" />
          <Field label="Mileage" value="41,280" />
          <Field label="Colour" value="Deep Black Pearl" />
        </div>
      </div>
      <div className="app-section-card">
        <h3 style={{ marginTop: 0 }}>Customer</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div data-slideshow="create-customer-lookup"><Field label="Customer" value="Alex Morgan" /></div>
          <Field label="Mobile" value="07700 900001" />
          <Field label="Email" value="alex.morgan@demo.invalid" />
          <Field label="Contact preference" value="SMS" />
          <Field label="Address" value="12 High Street, Exeter" full />
        </div>
      </div>
      <div className="app-section-card">
        <h3 style={{ marginTop: 0 }}>Requested work</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { text: "Investigate knocking noise front", time: "0.5h", pay: "Customer" },
            { text: "Major service + oil filter + air filter", time: "2.0h", pay: "Customer" },
          ].map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px", gap: 8, alignItems: "center" }}>
              <Field label={i === 0 ? "Request" : " "} value={r.text} />
              <Field label={i === 0 ? "Time" : " "} value={r.time} />
              <Field label={i === 0 ? "Payment" : " "} value={r.pay} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <GhostBtn>Cancel</GhostBtn>
          <div data-slideshow="create-submit"><PrimaryBtn>Create job card</PrimaryBtn></div>
        </div>
      </div>
    </PageShell>
  );
}

// ---------- Appointments -------------------------------------------------
function AppointmentsMock() {
  return (
    <PageShell title="Appointments" subtitle="Workshop & MOT bookings — week of 20 April 2026">
      <div className="app-section-card" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <GhostBtn>← Previous week</GhostBtn>
        <GhostBtn>Today</GhostBtn>
        <GhostBtn>Next week →</GhostBtn>
        <div style={{ flex: 1 }} />
        <input placeholder="Search…" style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, minWidth: 200 }} />
        <PrimaryBtn>+ New appointment</PrimaryBtn>
      </div>
      <div className="app-section-card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={mockHeaderCellStyle}>Start</th>
            <th style={mockHeaderCellStyle}>Customer</th>
            <th style={mockHeaderCellStyle}>Reg</th>
            <th style={mockHeaderCellStyle}>Bay</th>
            <th style={mockHeaderCellStyle}>Type</th>
            <th style={mockHeaderCellStyle}>Status</th>
          </tr></thead>
          <tbody>
            {demoAppointments.map((a) => (
              <tr key={a.id}>
                <td style={mockCellStyle}>{new Date(a.start).toLocaleString("en-GB")}</td>
                <td style={mockCellStyle}>{a.customer_name}</td>
                <td style={mockCellStyle}>{a.reg}</td>
                <td style={mockCellStyle}>{a.bay}</td>
                <td style={mockCellStyle}>{a.type}</td>
                <td style={mockCellStyle}><StatusPill status="Booked" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

// ---------- My Jobs (tech view) ------------------------------------------
function MyJobsMock() {
  const myJobs = [
    { job_number: "DEMO-1042", reg: "DE24 XYZ", customer_name: "Alex Morgan", vehicle: "VW Golf",        type: "Service",   status: "In Progress" },
    { job_number: "DEMO-1044", reg: "TV22 HNP", customer_name: "Tom Reynolds", vehicle: "BMW 3 Series", type: "Service+MOT", status: "Ready for Collection" },
    { job_number: "DEMO-1043", reg: "TA23 ABC", customer_name: "Priya Shah",  vehicle: "Ford Kuga",     type: "Diag",      status: "Awaiting Parts" },
  ];
  const filters = ["All jobs", "In Progress", "Waiting", "Complete"];

  return (
    <PageShell>
      <div className="app-section-card" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Search by job number, customer, reg, or vehicle…"
          style={{ flex: 1, minWidth: 240, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6 }}
        />
        {filters.map((f, i) => (
          <button key={f} type="button" className={i === 0 ? "app-btn app-btn--primary" : "app-btn app-btn--ghost"} style={{ padding: "8px 14px" }}>{f}</button>
        ))}
      </div>
      <div className="app-section-card" style={{ padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "110px 90px 80px 140px 1fr 80px", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surfaceMuted, rgba(0,0,0,0.03))", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
          <span>Status</span><span>Job</span><span>Reg</span><span>Customer</span><span>Make / Model</span><span>Type</span>
        </div>
        {myJobs.map((j) => (
          <div key={j.job_number} style={{ display: "grid", gridTemplateColumns: "110px 90px 80px 140px 1fr 80px", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
            <StatusPill status={j.status} />
            <strong>{j.job_number}</strong>
            <span style={{ color: "var(--text-secondary)" }}>{j.reg}</span>
            <span>{j.customer_name}</span>
            <span>{j.vehicle}</span>
            <span>{j.type}</span>
          </div>
        ))}
      </div>
      <div className="app-section-card">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <KpiTile label="Total jobs" value="3" />
          <KpiTile label="In progress" value="1" />
          <KpiTile label="Waiting" value="1" />
          <KpiTile label="Completed" value="1" />
        </div>
      </div>
    </PageShell>
  );
}

// ---------- Job Detail ---------------------------------------------------
function JobDetailMock() {
  const j = demoJobs[0];
  const tabs = ["Write-up", "VHC", "Parts", "Notes", "Documents"];
  return (
    <PageShell title={`Job ${j.job_number}`} subtitle={`${j.reg} · ${j.make} ${j.model} · ${j.customer_name}`}>
      <div data-slideshow="job-detail-status" className="app-section-card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <StatusPill status={j.status} />
        <DivisionBadge division="Retail" />
        <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Booked in {new Date(j.booked_in).toLocaleString("en-GB")}</span>
        <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>· ETA {new Date(j.estimated_completion).toLocaleString("en-GB")}</span>
        <div style={{ flex: 1 }} />
        <GhostBtn>Clock on</GhostBtn>
        <PrimaryBtn>Update status</PrimaryBtn>
      </div>
      <div data-slideshow="job-detail-tabs" className="app-section-card" style={{ padding: 0 }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
          {tabs.map((t, i) => (
            <div key={t} style={{
              padding: "12px 18px",
              borderBottom: i === 0 ? "3px solid var(--accentMain)" : "3px solid transparent",
              fontWeight: i === 0 ? 700 : 500,
              color: i === 0 ? "var(--accentMain)" : "var(--text-secondary)",
              whiteSpace: "nowrap",
            }}>{t}</div>
          ))}
        </div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Field label="Reg" value={j.reg} />
            <Field label="Make / Model" value={`${j.make} ${j.model}`} />
            <Field label="VIN" value="WVWZZZ1KZDEMO0001" />
            <Field label="Mileage in" value={j.mileage.toLocaleString()} />
            <Field label="Waiting status" value="Customer waiting" />
            <Field label="Appointment" value={new Date(j.booked_in).toLocaleString("en-GB")} />
          </div>
          <Field label="Customer complaint" value={j.complaint} full />
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 6 }}>Job categories</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["Diagnostic", "Service", "Brakes"].map((c) => (
                <span key={c} style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(220,38,38,0.08)", color: "var(--accentMain)", fontSize: 12, fontWeight: 500 }}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ---------- VHC (customer-facing layout) ---------------------------------
function VhcMock() {
  const checks = [
    { when: "Today, 10:14", reg: "DE24 XYZ", tech: "Demo Tech A", result: "Amber — advisories", color: "#ca8a04" },
    { when: "12 Mar 2026", reg: "DE24 XYZ", tech: "Demo Tech B", result: "Green — pass",       color: "#16a34a" },
    { when: "04 Nov 2025", reg: "DE24 XYZ", tech: "Demo Tech A", result: "Red — immediate",   color: "#dc2626" },
  ];
  return (
    <PageShell title="Vehicle Health Checks" subtitle="Latest results across your vehicles">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div className="app-section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Recent checks</h3>
            <div style={{ flex: 1 }} />
            <select style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6 }}>
              <option>All vehicles</option><option>DE24 XYZ</option><option>TA23 ABC</option>
            </select>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {checks.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{c.reg} · {c.when}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{c.tech} · {c.result}</div>
                </div>
                <GhostBtn>View report</GhostBtn>
              </div>
            ))}
          </div>
        </div>
        <div className="app-section-card">
          <h3 style={{ marginTop: 0 }}>Workshop contacts</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { name: "Service Desk", role: "Reception", note: "Mon–Fri 8am–6pm" },
              { name: "Demo Tech A", role: "Assigned technician", note: "Working on DE24 XYZ" },
              { name: "Parts Desk", role: "Parts enquiries", note: "Online stock lookup" },
            ].map((p) => (
              <div key={p.name} style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8 }}>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.role}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.note}</div>
              </div>
            ))}
            <PrimaryBtn>Send message</PrimaryBtn>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ---------- Parts: Create Order -----------------------------------------
function PartsCreateMock() {
  return (
    <PageShell title="Create parts order" subtitle={`Linked to job ${demoJobs[0].job_number} · ${demoJobs[0].reg}`}>
      <div className="app-section-card">
        <h3 style={{ marginTop: 0 }}>Customer & vehicle</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <Field label="Customer" value={demoJobs[0].customer_name} />
          <Field label="Vehicle" value={`${demoJobs[0].make} ${demoJobs[0].model}`} />
          <Field label="Reg" value={demoJobs[0].reg} />
          <Field label="VIN" value="WVWZZZ1KZDEMO0001" />
        </div>
      </div>
      <div className="app-section-card">
        <h3 style={{ marginTop: 0 }}>Delivery</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <Field label="Delivery type" value="Next-day courier" />
          <Field label="Address" value="HNP Service Centre" />
          <Field label="ETA" value="23 Apr, 9:00–11:00" />
          <Field label="Notes" value="Deliver to goods-in bay" />
        </div>
      </div>
      <div className="app-section-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Line items</h3>
          <div style={{ flex: 1 }} />
          <GhostBtn>Advanced lookup</GhostBtn>
          <PrimaryBtn>+ Add part</PrimaryBtn>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={mockHeaderCellStyle}>Part #</th>
            <th style={mockHeaderCellStyle}>Description</th>
            <th style={mockHeaderCellStyle}>Qty</th>
            <th style={mockHeaderCellStyle}>Unit</th>
            <th style={mockHeaderCellStyle}>Status</th>
            <th style={mockHeaderCellStyle}>Line total</th>
          </tr></thead>
          <tbody>
            {demoParts.filter(p => p.job_number === demoJobs[0].job_number).map((p) => (
              <tr key={p.id}>
                <td style={mockCellStyle}><strong>{p.part_number}</strong></td>
                <td style={mockCellStyle}>{p.description}</td>
                <td style={mockCellStyle}>{p.quantity}</td>
                <td style={mockCellStyle}>£{p.cost.toFixed(2)}</td>
                <td style={mockCellStyle}><StatusPill status={p.status} /></td>
                <td style={mockCellStyle}>£{(p.cost * p.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <GhostBtn>Save draft</GhostBtn>
          <PrimaryBtn>Submit order</PrimaryBtn>
        </div>
      </div>
    </PageShell>
  );
}

// ---------- Parts: Goods In ---------------------------------------------
function PartsGoodsInMock() {
  return (
    <PageShell title="Goods in" subtitle="Book inbound stock against open orders">
      <div className="app-section-card">
        <h3 style={{ marginTop: 0 }}>Header</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <Field label="Franchise" value="VAG (Volkswagen / Audi / Seat / Skoda)" />
          <Field label="Supplier" value="VAG Parts Ltd" />
          <Field label="Price level" value="Trade" />
          <Field label="VAT rate" value="20%" />
          <Field label="Bin location" value="A-12-3" />
          <Field label="Reference" value="INV-24819" />
        </div>
      </div>
      <div className="app-section-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Lines awaiting receipt</h3>
          <div style={{ flex: 1 }} />
          <GhostBtn>Part lookup</GhostBtn>
          <PrimaryBtn>Book all in</PrimaryBtn>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={mockHeaderCellStyle}>Order</th>
            <th style={mockHeaderCellStyle}>Part</th>
            <th style={mockHeaderCellStyle}>Supplier</th>
            <th style={mockHeaderCellStyle}>Qty ordered</th>
            <th style={mockHeaderCellStyle}>Qty received</th>
            <th style={mockHeaderCellStyle}>Action</th>
          </tr></thead>
          <tbody>
            {demoParts.map((p) => (
              <tr key={p.id}>
                <td style={mockCellStyle}>{p.job_number}</td>
                <td style={mockCellStyle}>{p.description} <span style={{ color: "var(--text-secondary)" }}>({p.part_number})</span></td>
                <td style={mockCellStyle}>{p.supplier}</td>
                <td style={mockCellStyle}>{p.quantity}</td>
                <td style={mockCellStyle}><input defaultValue={p.status === "Goods In" ? p.quantity : 0} style={{ width: 60, padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4 }} /></td>
                <td style={mockCellStyle}><PrimaryBtn>Book in</PrimaryBtn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

// ---------- Parts: Deliveries -------------------------------------------
function PartsDeliveriesMock() {
  const runs = [
    { job: "DEMO-D-4012", customer: "Alex Morgan",    addr: "12 High Street, Exeter",    eta: "10:30", status: "en_route",  label: "En route" },
    { job: "DEMO-D-4013", customer: "Priya Shah",     addr: "48 Oak Lane, Taunton",      eta: "11:45", status: "scheduled", label: "Scheduled" },
    { job: "DEMO-D-4011", customer: "Tom Reynolds",   addr: "7 Church Road, Tiverton",   eta: "09:00", status: "completed", label: "Completed" },
  ];
  const chipFor = (s) => ({
    en_route:  { bg: "rgba(59,130,246,0.12)", fg: "#1d4ed8" },
    scheduled: { bg: "rgba(234,179,8,0.15)",  fg: "#a16207" },
    completed: { bg: "rgba(34,197,94,0.15)",  fg: "#166534" },
  }[s] || { bg: "#eee", fg: "#333" });

  return (
    <PageShell title="Deliveries" subtitle="Driver routes for today — 22 April 2026">
      <div className="app-section-card" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="date" defaultValue="2026-04-22" style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6 }} />
        <GhostBtn>Previous</GhostBtn>
        <GhostBtn>Today</GhostBtn>
        <GhostBtn>Next</GhostBtn>
        <div style={{ flex: 1 }} />
        <PrimaryBtn>Plan new route</PrimaryBtn>
      </div>
      <div className="app-section-card" style={{ padding: 0 }}>
        {runs.map((r, i) => {
          const c = chipFor(r.status);
          const done = r.status === "completed";
          return (
            <div key={r.job} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i === runs.length - 1 ? "none" : "1px solid var(--border)", background: done ? "var(--surfaceMuted, rgba(0,0,0,0.02))" : "transparent" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{r.job} · {r.customer}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{r.addr} · ETA {r.eta}</div>
              </div>
              <span style={{ padding: "2px 10px", borderRadius: 999, background: c.bg, color: c.fg, fontSize: 12, fontWeight: 600 }}>{r.label}</span>
              <GhostBtn>↑</GhostBtn>
              <GhostBtn>↓</GhostBtn>
              {!done && <PrimaryBtn>Mark complete</PrimaryBtn>}
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}

// ---------- Valet --------------------------------------------------------
function ValetMock() {
  const rows = [
    { reg: "DE24 XYZ", job: "DEMO-1042", status: "In Progress", wash: "✓",  eta: "13:30", tech: "V. Smith", date: "22/04" },
    { reg: "TA23 ABC", job: "DEMO-1043", status: "Awaiting Parts", wash: "",  eta: "—",     tech: "—",        date: "22/04" },
    { reg: "TV22 HNP", job: "DEMO-1044", status: "Ready for Collection", wash: "✓", eta: "11:45", tech: "V. Smith", date: "22/04" },
    { reg: "DA72 OME", job: "DEMO-1045", status: "Booked", wash: "",  eta: "14:00", tech: "V. Smith", date: "23/04" },
  ];
  return (
    <PageShell title="Valet" subtitle="Today's jobs — 22 April 2026">
      <div className="app-section-card" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input placeholder="Search by reg / job number" style={{ flex: 1, minWidth: 220, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6 }} />
        <input type="date" defaultValue="2026-04-22" style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6 }} />
        <GhostBtn>All</GhostBtn><GhostBtn>Wash due</GhostBtn><GhostBtn>Done</GhostBtn>
      </div>
      <div className="app-section-card" style={{ padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "110px 110px 140px 80px 100px 130px 90px 120px", padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", background: "var(--surfaceMuted, rgba(0,0,0,0.03))" }}>
          <span>Reg</span><span>Job</span><span>Status</span><span>Wash</span><span>ETA</span><span>Valeter</span><span>Date</span><span>Actions</span>
        </div>
        {rows.map((r) => (
          <div key={r.job} style={{ display: "grid", gridTemplateColumns: "110px 110px 140px 80px 100px 130px 90px 120px", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid var(--border)", height: 64 }}>
            <strong>{r.reg}</strong>
            <span>{r.job}</span>
            <StatusPill status={r.status} />
            <span style={{ fontSize: 18, color: r.wash === "✓" ? "#16a34a" : "var(--text-secondary)" }}>{r.wash || "—"}</span>
            <span>{r.eta}</span>
            <span>{r.tech}</span>
            <span>{r.date}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <GhostBtn>Edit</GhostBtn>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

// ---------- Messages -----------------------------------------------------
function MessagesMock() {
  const threads = [
    { name: "Demo Tech A", preview: "DEMO-1042 — front arm fitted, ready for road test.", when: "09:42", unread: true },
    { name: "Parts Desk",  preview: "Crank sensor arrived for DEMO-1043.",                when: "09:28", unread: true },
    { name: "Reception",   preview: "Customer for DEMO-1044 calling at 11:30.",            when: "09:10", unread: false },
    { name: "Service Mgr", preview: "Quick question on carry-over list.",                  when: "Yesterday", unread: false },
  ];
  const messages = [
    { me: false, text: "DEMO-1042 write-up almost done, found two advisories.", when: "09:40" },
    { me: true,  text: "Great — add photos and push to customer VHC.",           when: "09:41" },
    { me: false, text: "Done. Front arm fitted, ready for road test.",          when: "09:42" },
  ];
  const colleagues = [
    { name: "Demo Tech A", role: "Technician", online: true },
    { name: "Demo Tech B", role: "MOT Tester", online: true },
    { name: "Parts Desk",  role: "Parts",      online: true },
    { name: "Reception",   role: "Service",    online: false },
  ];

  return (
    <PageShell>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 240px", gap: 12, minHeight: 520 }}>
        <div className="app-section-card" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
            <input placeholder="Search messages…" style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }} />
          </div>
          {threads.map((t, i) => (
            <div key={i} style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: i === 0 ? "rgba(220,38,38,0.06)" : "transparent", display: "flex", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surfaceMuted, rgba(0,0,0,0.06))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{t.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <strong style={{ fontSize: 13 }}>{t.name}</strong>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t.when}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.preview}</div>
              </div>
              {t.unread && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accentMain)", marginTop: 6 }} />}
            </div>
          ))}
        </div>
        <div className="app-section-card" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--border)", fontWeight: 700 }}>Demo Tech A</div>
          <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.me ? "flex-end" : "flex-start", maxWidth: "62%" }}>
                <div style={{ padding: "8px 12px", borderRadius: 10, background: m.me ? "var(--accentMain)" : "var(--surfaceMuted, rgba(0,0,0,0.04))", color: m.me ? "#fff" : "var(--text-primary)", fontSize: 13 }}>{m.text}</div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", textAlign: m.me ? "right" : "left", marginTop: 2 }}>{m.when}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
            <input placeholder="Type a message…" style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }} />
            <PrimaryBtn>Send</PrimaryBtn>
          </div>
        </div>
        <div className="app-section-card" style={{ padding: 0 }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--border)", fontWeight: 700 }}>Colleagues</div>
          {colleagues.map((c, i) => (
            <div key={i} style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surfaceMuted, rgba(0,0,0,0.06))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{c.name[0]}</div>
                <span style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: c.online ? "#16a34a" : "#9ca3af", border: "2px solid #fff" }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

// ---------- Accounts: Invoices ------------------------------------------
function AccountsInvoicesMock() {
  const rows = [
    { invoice_id: "INV-DEMO-5091", account_id: "ACC-041", customer_id: "demo-cust-001", job_number: "DEMO-1042", grand_total: "£482.40", payment_status: "Ready to send", due_date: "06 May 2026" },
    { invoice_id: "INV-DEMO-5090", account_id: "ACC-029", customer_id: "demo-cust-002", job_number: "DEMO-1043", grand_total: "£318.75", payment_status: "Sent",          due_date: "04 May 2026" },
    { invoice_id: "INV-DEMO-5089", account_id: "ACC-017", customer_id: "demo-cust-003", job_number: "DEMO-1044", grand_total: "£211.90", payment_status: "Paid",          due_date: "30 Apr 2026" },
  ];
  return (
    <PageShell title="Invoices" subtitle="Billing driven directly from job cards">
      <div className="app-section-card" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input placeholder="Search invoice / customer / job…" style={{ flex: 1, minWidth: 240, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6 }} />
        <select style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }}>
          <option>All statuses</option><option>Ready to send</option><option>Sent</option><option>Paid</option><option>Overdue</option>
        </select>
        <input type="date" defaultValue="2026-04-01" style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }} />
        <input type="date" defaultValue="2026-04-30" style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }} />
        <div style={{ flex: 1 }} />
        <GhostBtn>Export CSV</GhostBtn>
        <GhostBtn>Accounts</GhostBtn>
      </div>
      <div className="app-section-card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={mockHeaderCellStyle}>Invoice</th>
            <th style={mockHeaderCellStyle}>Account</th>
            <th style={mockHeaderCellStyle}>Customer</th>
            <th style={mockHeaderCellStyle}>Job</th>
            <th style={mockHeaderCellStyle}>Grand total</th>
            <th style={mockHeaderCellStyle}>Status</th>
            <th style={mockHeaderCellStyle}>Due</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.invoice_id}>
                <td style={mockCellStyle}><strong>{r.invoice_id}</strong></td>
                <td style={mockCellStyle}>{r.account_id}</td>
                <td style={mockCellStyle}>{r.customer_id}</td>
                <td style={mockCellStyle}>{r.job_number}</td>
                <td style={mockCellStyle}>{r.grand_total}</td>
                <td style={mockCellStyle}>{r.payment_status}</td>
                <td style={mockCellStyle}>{r.due_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 12, color: "var(--text-secondary)", fontSize: 12 }}>
          <span>Page 1 of 1 · 3 invoices</span>
          <GhostBtn>← Prev</GhostBtn><GhostBtn>Next →</GhostBtn>
        </div>
      </div>
    </PageShell>
  );
}

// ---------- HR Dashboard ------------------------------------------------
function HrDashboardMock() {
  const deptRows = [
    { dept: "Workshop",   prod: "92%", qual: "95%", team: "88%" },
    { dept: "Parts",      prod: "87%", qual: "90%", team: "92%" },
    { dept: "Reception",  prod: "95%", qual: "93%", team: "96%" },
    { dept: "Accounts",   prod: "90%", qual: "98%", team: "89%" },
  ];
  const renewals = [
    { course: "First Aid", employee: "Demo Tech B", due: "30 Apr 2026", status: "Overdue" },
    { course: "Forklift Operation", employee: "Parts Driver", due: "12 May 2026", status: "Due Soon" },
    { course: "Manual Handling", employee: "Demo Tech A", due: "01 Jul 2026", status: "Upcoming" },
  ];
  const statusColor = (s) => s === "Overdue" ? "#dc2626" : s === "Due Soon" ? "#ca8a04" : "#16a34a";

  return (
    <PageShell title="HR dashboard" subtitle="People operations — today's snapshot">
      <div className="app-section-card">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <KpiTile label="Headcount" value="34" hint="32 active / 2 inactive" />
          <KpiTile label="On leave today" value="3" hint="1 sickness, 2 annual" />
          <KpiTile label="Training due" value="5" hint="within 30 days" />
          <KpiTile label="Open roles" value="2" hint="1 interviewing" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <div className="app-section-card">
          <h3 style={{ marginTop: 0 }}>Department performance</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={mockHeaderCellStyle}>Department</th>
              <th style={mockHeaderCellStyle}>Productivity</th>
              <th style={mockHeaderCellStyle}>Quality</th>
              <th style={mockHeaderCellStyle}>Teamwork</th>
            </tr></thead>
            <tbody>
              {deptRows.map((d) => (
                <tr key={d.dept}>
                  <td style={mockCellStyle}><strong>{d.dept}</strong></td>
                  <td style={mockCellStyle}>{d.prod}</td>
                  <td style={mockCellStyle}>{d.qual}</td>
                  <td style={mockCellStyle}>{d.team}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="app-section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Training renewals</h3>
            <div style={{ flex: 1 }} />
            <GhostBtn>View all</GhostBtn>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {renewals.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{r.course}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.employee} · due {r.due}</div>
                </div>
                <span style={{ padding: "2px 10px", borderRadius: 999, background: "rgba(0,0,0,0.04)", color: statusColor(r.status), fontSize: 12, fontWeight: 600 }}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ---------- Customer Portal ---------------------------------------------
function CustomerPortalMock() {
  return (
    <PageShell title="Welcome back, Alex" subtitle="Here's what's happening with your vehicles">
      <div className="app-section-card" style={{ background: "linear-gradient(135deg, rgba(220,38,38,0.08), rgba(220,38,38,0.02))" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Next visit</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>DE24 XYZ — Service + Diag</div>
            <div style={{ color: "var(--text-secondary)" }}>Today, 22 April · 08:30 · Bay 2</div>
          </div>
          <PrimaryBtn>View progress</PrimaryBtn>
          <GhostBtn>Message workshop</GhostBtn>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <div className="app-section-card">
          <h3 style={{ marginTop: 0 }}>Your vehicles</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {demoVehicles.map((v) => (
              <div key={v.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8 }}>
                <strong style={{ width: 100 }}>{v.reg}</strong>
                <div style={{ flex: 1 }}>
                  <div>{v.year} {v.make} {v.model}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>MOT {v.mot_expiry}</div>
                </div>
                <GhostBtn>History</GhostBtn>
              </div>
            ))}
          </div>
        </div>
        <div className="app-section-card">
          <h3 style={{ marginTop: 0 }}>Latest VHC</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#ca8a04" }} />
            <strong>DE24 XYZ · Amber advisories</strong>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Front RH tyre 3.1mm — monitor. Front pads 4mm — advise.</div>
          <div style={{ marginTop: 12 }}><GhostBtn>Open full report</GhostBtn></div>
        </div>
        <div className="app-section-card">
          <h3 style={{ marginTop: 0 }}>Appointment timeline</h3>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 6 }}><strong>22 Apr · 08:30</strong><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Booked in · Service + Diag</div></div>
            <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 6 }}><strong>14 Jul</strong><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>MOT due</div></div>
            <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 6 }}><strong>22 Oct</strong><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Service interval</div></div>
          </div>
        </div>
        <div className="app-section-card">
          <h3 style={{ marginTop: 0 }}>Outstanding invoices</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>No outstanding invoices</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Last paid: £211.90 on 30 Mar 2026</div>
            </div>
            <GhostBtn>Payment methods</GhostBtn>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ---------- Archive ------------------------------------------------------
function ArchiveMock() {
  const rows = [
    { no: "DEMO-0981", reg: "EX20 PKL", customer: "M. Jennings", status: "Invoiced",  updated: "18 Apr 2026" },
    { no: "DEMO-0976", reg: "WR71 ATM", customer: "S. Keane",    status: "Complete",  updated: "17 Apr 2026" },
    { no: "DEMO-0972", reg: "DA72 OME", customer: "R. Patel",    status: "Released",  updated: "16 Apr 2026" },
    { no: "DEMO-0968", reg: "EA23 QRS", customer: "L. Brennan",  status: "Delivered", updated: "15 Apr 2026" },
    { no: "DEMO-0962", reg: "BH70 FLM", customer: "J. Owens",    status: "Archived",  updated: "12 Apr 2026" },
  ];
  const statusColor = (s) => ({
    Complete:  "#16a34a", Released: "#2563eb", Invoiced: "#7c3aed",
    Delivered: "#0ea5e9", Archived: "#6b7280",
  }[s] || "#6b7280");
  return (
    <PageShell title="Archive" subtitle="Completed jobs — seven-year retention, fully searchable">
      <div className="app-section-card" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input placeholder="Search by reg, job number, or customer name…" style={{ flex: 1, minWidth: 260, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6 }} />
        <select style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }}>
          <option>All statuses</option><option>Complete</option><option>Released</option><option>Invoiced</option><option>Delivered</option><option>Archived</option>
        </select>
        <select style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }}>
          <option>Updated (newest first)</option><option>Updated (oldest first)</option><option>Job number</option><option>Customer name</option>
        </select>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" /> Reg only
        </label>
      </div>
      <div className="app-section-card" style={{ padding: 0 }}>
        {rows.map((r, i) => (
          <div key={r.no} style={{ display: "grid", gridTemplateColumns: "140px 120px 1fr 140px 140px", padding: "12px 14px", borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--border)", alignItems: "center", gap: 10 }}>
            <strong>{r.no}</strong>
            <span style={{ color: "var(--text-secondary)" }}>{r.reg}</span>
            <span>{r.customer}</span>
            <span style={{ padding: "2px 10px", borderRadius: 999, background: "rgba(0,0,0,0.04)", color: statusColor(r.status), fontSize: 12, fontWeight: 600, justifySelf: "start" }}>{r.status}</span>
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{r.updated}</span>
          </div>
        ))}
      </div>
    </PageShell>
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
