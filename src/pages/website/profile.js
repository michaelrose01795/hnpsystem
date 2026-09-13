import { buildCustomerReportUrl } from "@/lib/vhc/shareCode";
// file location: src/pages/website/profile.js
// Customer-facing portal page. Pulls one bundled payload from
// /api/website/profile (vehicles + jobs + invoices + appointments +
// account + payment methods + booking requests + service history +
// VHC summaries + activity timeline + messages) and surfaces it as a
// set of cards. Actions that need staff intervention (book service,
// pay invoice, request statement / PDF / data export / deletion,
// send a message) are written to public.customer_activity_events via
// /api/website/actions so existing staff workflows can pick them up.
//
// Styling: this page renders inside html.website-scope (applied by
// useWebsiteScope) so every raw <button>, <input>, <textarea>, <select>
// inherits the liquid-glass control system defined in custglobal.css.
// All card / row / badge / tracker / bubble chrome is the ws-portal-*
// family (@family portal in custglobal.css), so the page reads the same
// tokens as the rest of /website and repaints with the theme cycle
// without carrying any inline paint of its own.

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTheme } from "@/styles/themeProvider";
import { siteContent } from "@/features/website/data/siteContent";
import useWebsiteScope from "@/features/website/hooks/useWebsiteScope";
import WebsiteNativeSelect from "@/features/website/components/WebsiteNativeSelect";
import WebsiteNativeDateTimeInput from "@/features/website/components/WebsiteNativeDateTimeInput";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import {
  CONTACT_PREFERENCE_OPTIONS,
  normalizeContactPreference,
  contactPreferenceLabel,
} from "@/lib/customers/contactPreference";

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
};

const daysUntil = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
};

// /website light/dark/system theme cycle. The choice is persisted to
// localStorage and applied by writing data-website-theme onto <html>;
// custglobal.css repaints the customer surface for whichever concrete
// theme is written. "system" is resolved to a real light/dark value
// here before the attribute is set, so the stylesheet only ever sees one
// of the two themes.
const WEBSITE_THEME_KEY = "hnp-website-theme";
const WEBSITE_THEME_CYCLE = ["light", "dark", "system"];

const resolveWebsiteTheme = (preference) => {
  if (preference === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    return "dark";
  }
  return preference;
};

const getTrackerStages = (job) => {
  const stages = [
    { key: "booked", label: "Booked", reached: !!job.created_at },
    { key: "checked_in", label: "Checked in", reached: !!job.checked_in_at },
    { key: "in_workshop", label: "In workshop", reached: !!job.workshop_started_at },
  ];
  if (job.vhc_required) {
    stages.push({ key: "vhc", label: "VHC done", reached: !!job.vhc_completed_at });
  }
  const washDone =
    !!job.wash_completed_by ||
    (job.completed_at &&
      job.wash_started_at &&
      new Date(job.completed_at).getTime() >= new Date(job.wash_started_at).getTime());
  stages.push({ key: "wash", label: "Wash done", reached: washDone });
  const status = (job.status || "").toLowerCase();
  const ready =
    !!job.completed_at ||
    ["ready", "completed", "collected", "invoiced"].some((s) => status.includes(s));
  stages.push({ key: "ready", label: "Ready", reached: ready });
  return stages;
};

const getActiveStageIndex = (stages) => {
  for (let i = stages.length - 1; i >= 0; i -= 1) {
    if (stages[i].reached) return i;
  }
  return 0;
};

const humaniseActivity = (event) => {
  const t = (event.activity_type || "").replace(/_/g, " ");
  const payload = event.activity_payload || {};
  if (payload.summary) return payload.summary;
  if (payload.description) return payload.description;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "ownership", label: "Ownership" },
  { id: "tracker", label: "Tracker" },
  { id: "vehicles", label: "Vehicles" },
  { id: "jobs", label: "Jobs" },
  { id: "history", label: "History" },
  { id: "mot", label: "MOT" },
  { id: "recalls", label: "Recalls" },
  { id: "inspections", label: "Inspections" },
  { id: "vhc-extras", label: "VHC hub" },
  { id: "invoices", label: "Money" },
  { id: "payments-extras", label: "Payments" },
  { id: "documents", label: "Documents" },
  { id: "messages", label: "Messages" },
  { id: "book", label: "Book" },
  { id: "services", label: "Services" },
  { id: "sell", label: "Sell" },
  { id: "showroom", label: "Showroom" },
  { id: "sales-hub", label: "Sales hub" },
  { id: "parts-hub", label: "Parts" },
  { id: "bodyshop", label: "Bodyshop" },
  { id: "valet", label: "Valet" },
  { id: "family", label: "Family" },
  { id: "self-service", label: "Self serve" },
  { id: "assistant", label: "Assistant" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
];

const SERVICE_TYPES = [
  { id: "body_repair", title: "Body work", hint: "Dents, scratches, panel repair, paint.", action: "request_body_repair" },
  { id: "smart_repair", title: "SMART repair", hint: "Small / medium area repair — fast turnaround.", action: "request_smart_repair" },
  { id: "valet", title: "Valet", hint: "Mini, full or deep-clean valet packages.", action: "request_valet" },
  { id: "parts", title: "Parts", hint: "Genuine parts & accessories enquiry.", action: "request_parts_enquiry" },
  { id: "warranty", title: "Warranty claim", hint: "Open a claim against your manufacturer warranty.", action: "request_warranty_claim" },
  { id: "motability", title: "Motability", hint: "Motability scheme advice & applications.", action: "request_motability" },
  { id: "finance", title: "Finance quote", hint: "PCP, HP or lease quote on a vehicle.", action: "request_finance_quote" },
  { id: "test_drive", title: "Test drive", hint: "Book a test drive in a specific model.", action: "request_test_drive" },
];

// ── Styling ──────────────────────────────────────────────────────
// Every card / row / badge / tracker / bubble / toggle is a ws-portal-*
// class in the @family portal block of src/styles/custglobal.css, shown
// on /website/dev by src/features/website/showcase/sections/PortalShowcase.js.
// State travels as data-tone / data-state / data-author / data-enabled /
// aria-pressed / aria-checked; measured values (bar widths, the score
// ring angle, the tracker column count) are the runtime custom properties
// --ws-portal-pct, --ws-portal-score and --ws-portal-steps. No colour,
// padding or type is set inline here.

const PORTAL_DONE_STATUSES = ["delivered", "closed", "completed", "collected", "invoiced"];
const REPAIR_TIMELINE_STAGES = [
  { key: "booked", label: "Booked" },
  { key: "checked_in", label: "Checked in" },
  { key: "workshop", label: "Workshop" },
  { key: "vhc", label: "VHC" },
  { key: "wash", label: "Wash" },
  { key: "ready", label: "Ready" },
];
const VHC_PRESENTATION_LINKS = {
  preview: "/presentation/customer/vhc-customer-preview-jobNumber/8",
  customerView: "/presentation/customer/vhc-customer-view-jobNumber/9",
  share: "/presentation/customer/vhc-share-jobNumber-linkCode/10",
  customer: "/presentation/customer/vhc-customer-jobNumber-linkCode/11",
};
const ASSISTANT_SUGGESTIONS = [
  "When is my car next due?",
  "How much did my last service cost?",
  "What were my last VHC advisories?",
  "Book me a valet for Saturday morning.",
];

const portalIsOpenJob = (job) => {
  const status = String(job.status || job.completion_status || "").toLowerCase();
  return !PORTAL_DONE_STATUSES.some((token) => status.includes(token)) && !job.completed_at;
};

const portalIsCompletedJob = (job) => {
  const status = String(job.status || job.completion_status || "").toLowerCase();
  return PORTAL_DONE_STATUSES.some((token) => status.includes(token)) || Boolean(job.completed_at);
};

const portalVehicleTitle = (vehicle) =>
  vehicle.make_model ||
  vehicle.makeModel ||
  [vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
  "Vehicle";

const portalVehicleReg = (vehicle) =>
  vehicle.reg_number || vehicle.reg || vehicle.registration || "Registration TBC";

const getHealthScore = (vehicle) => {
  let score = 100;
  const motDue = vehicle.mot_due || vehicle.motDue;
  if (motDue) {
    const days = daysUntil(motDue);
    if (Number.isFinite(days) && days < 0) score -= 35;
    else if (Number.isFinite(days) && days <= 30) score -= 20;
    else if (Number.isFinite(days) && days <= 60) score -= 10;
  }
  if (!vehicle.mileage) score -= 5;
  if (!vehicle.service_history && !vehicle.service_plan_type) score -= 8;
  return Math.max(0, Math.min(100, score));
};

const getProgressPct = (job) => {
  const checks = [
    job.created_at,
    job.checked_in_at,
    job.workshop_started_at,
    job.vhc_required ? job.vhc_completed_at : true,
    job.wash_started_at || job.wash_completed_by,
    job.completed_at,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

const partTitle = (item) =>
  item.part_name_snapshot ||
  item.row_description ||
  item.description ||
  item.part?.name ||
  item.part?.part_number ||
  "Part";

const isBodyshopRequest = (request) =>
  /body|smart|paint|scratch|dent|repair/i.test(
    `${request.description || ""} ${request.confirmation_notes || ""}`,
  );

const isValetRequest = (request) =>
  /valet|detail|clean|wash/i.test(`${request.description || ""} ${request.confirmation_notes || ""}`);

function PortalCardHeader({ eyebrow, title, count, action }) {
  return (
    <div className="ws-portal-card__header">
      <div>
        {eyebrow ? <div className="ws-portal-eyebrow">{eyebrow}</div> : null}
        <h2 className="ws-portal-card__title">{title}</h2>
      </div>
      <div className="ws-portal-action-row">
        {count !== undefined && count !== null ? <span className="ws-portal-count">{count}</span> : null}
        {action}
      </div>
    </div>
  );
}

function PortalCard({ id, eyebrow, title, count, action, todo, wide = false, children }) {
  return (
    <section id={id} className={wide ? "ws-portal-card ws-portal-card--wide" : "ws-portal-card"}>
      <PortalCardHeader eyebrow={eyebrow} title={title} count={count} action={action} />
      {todo ? (
        <div className="ws-portal-todo">
          <span className="ws-portal-subhead">TODO · {todo.label}</span>
          {todo.detail ? <p className="ws-portal-empty">{todo.detail}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function PortalButtonLink({ href, children, style }) {
  return (
    <a className="app-btn" href={href} style={style}>
      {children}
    </a>
  );
}

function ScoreRing({ score = 0 }) {
  return (
    <div className="ws-portal-score" style={{ "--ws-portal-score": `${score * 3.6}deg` }}>
      <div className="ws-portal-score__inner">
        <span className="ws-portal-score__value">{score}</span>
        <span className="ws-portal-score__label">
          health
        </span>
      </div>
    </div>
  );
}

function DetailFieldGrid({ children }) {
  return <div className="ws-portal-details">{children}</div>;
}

function NotificationDot({ enabled, label }) {
  return (
    <span className="ws-portal-notify" data-enabled={enabled ? "true" : "false"}>
      <span className="ws-portal-notify__dot" />
      {label}
    </span>
  );
}

function MediaThumb({ item }) {
  const type = String(item.mime_type || item.media_type || "");
  const isVideo = type.startsWith("video") || type === "video";
  const url = item.public_url;
  return (
    <div className="ws-portal-thumb">
      {url && isVideo ? (
        <video src={url} muted playsInline loop className="ws-portal-media__fill" />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="ws-portal-media__fill" />
      ) : null}
    </div>
  );
}

function OwnershipDashboardCard({ vehicles = [] }) {
  return (
    <PortalCard
      id="ownership"
      eyebrow="Ownership hub"
      title="Vehicle health overview"
      count={`${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}`}
      todo={{
        label: "Recall API, tyre status and battery telemetry not linked yet",
        detail:
          "MOT, warranty, service plan and mileage are live. Recall, tyre and battery connections still require third-party APIs.",
      }}
    >
      {vehicles.length === 0 ? <p className="ws-portal-empty">No vehicles are linked to this account yet.</p> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {vehicles.map((vehicle) => (
          <div key={vehicle.vehicle_id || vehicle.id || portalVehicleReg(vehicle)} className="ws-portal-tile">
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <ScoreRing score={getHealthScore(vehicle)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="ws-portal-item-title">{portalVehicleTitle(vehicle)}</span>
                <span className="ws-portal-badge">{portalVehicleReg(vehicle)}</span>
              </div>
            </div>
            <DetailFieldGrid>
              <DetailField label="MOT due" value={formatDate(vehicle.mot_due || vehicle.motDue)} />
              <DetailField
                label="Warranty"
                value={[vehicle.warranty_type, formatDate(vehicle.warranty_expiry)].filter(Boolean).join(" · ")}
              />
              <DetailField
                label="Service plan"
                value={[vehicle.service_plan_supplier, vehicle.service_plan_type, formatDate(vehicle.service_plan_expiry)]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <DetailField label="Fuel / gearbox" value={[vehicle.fuel_type, vehicle.transmission].filter(Boolean).join(" · ")} />
              <DetailField label="Mileage" value={vehicle.mileage ? `${vehicle.mileage} miles` : null} />
            </DetailFieldGrid>
            <div>
              <h3 className="ws-portal-subhead">Service notes</h3>
              <p className="ws-portal-note">
                {vehicle.service_history || "No service-history note has been stored for this vehicle yet."}
              </p>
            </div>
          </div>
        ))}
      </div>
    </PortalCard>
  );
}

function LiveProgressTrackerCard({ jobs = [], customer }) {
  const active = (jobs || []).find(portalIsOpenJob);
  const contactPreference = normalizeContactPreference(customer?.contact_preference);
  const smsEnabled = ["sms", "mobile"].includes(contactPreference) || Boolean(customer?.mobile);
  const emailEnabled = contactPreference === "email" || Boolean(customer?.email);

  return (
    <PortalCard id="tracker" eyebrow="Tracker" title="Live progress">
      {!active ? (
        <p className="ws-portal-empty">No active workshop job is currently linked to this account.</p>
      ) : (
        <div className="ws-portal-tile">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span className="ws-portal-item-title">{active.job_number || active.id}</span>
            <span className="ws-portal-badge" data-tone="open">{active.status || "Booked"}</span>
            {active.service_mode === "mobile" ? <span className="ws-portal-badge" data-tone="ok">Mobile service</span> : null}
            {String(active.status || "").toLowerCase().includes("ready") ? <span className="ws-portal-badge" data-tone="ok">Ready for collection</span> : null}
          </div>
          <div className="ws-portal-progress">
            <div className="ws-portal-progress__fill"
              style={{ "--ws-portal-pct": `${Math.max(0, Math.min(100, getProgressPct(active)))}%` }} />
          </div>
          <DetailFieldGrid>
            <DetailField label="Vehicle" value={active.vehicle_reg || active.vehicle_make_model} />
            <DetailField label="Job type" value={active.type || active.description} />
            <DetailField label="Service postcode" value={active.service_postcode} />
          </DetailFieldGrid>
          <div>
            <h3 className="ws-portal-subhead">Notifications</h3>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
              <NotificationDot enabled={smsEnabled} label="SMS" />
              <NotificationDot enabled={emailEnabled} label="Email" />
              <NotificationDot enabled={false} label="Push" />
            </div>
          </div>
        </div>
      )}
    </PortalCard>
  );
}

function RepairApprovalTimelineCard({ jobs = [], jobStatusHistory = [] }) {
  const job = jobs.find(portalIsOpenJob) || jobs[0];
  const history = job ? jobStatusHistory.filter((row) => row.job_id === job.id) : [];
  const events = {
    booked: job?.created_at,
    checked_in: job?.checked_in_at,
    workshop: job?.workshop_started_at,
    vhc: job?.vhc_completed_at,
    wash: job?.wash_started_at || job?.wash_completed_by,
    ready: job?.completed_at,
  };
  const activeIndex = Math.max(
    0,
    REPAIR_TIMELINE_STAGES.reduce((last, stage, index) => (events[stage.key] ? index : last), 0),
  );

  return (
    <PortalCard id="tracker-timeline" eyebrow="Live repair" title="Repair approval timeline">
      {!job ? (
        <p className="ws-portal-empty">No job timeline is available for this account yet.</p>
      ) : (
        <div className="ws-portal-tile">
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span className="ws-portal-item-title">{job.job_number}</span>
            <span className="ws-portal-item-meta">{[job.vehicle_make_model, job.vehicle_reg].filter(Boolean).join(" · ")}</span>
          </div>
          <div className="ws-portal-tracker" style={{ "--ws-portal-steps": String(REPAIR_TIMELINE_STAGES.length) }}>
            {REPAIR_TIMELINE_STAGES.map((stage, idx) => {
              const state = idx < activeIndex ? "done" : idx === activeIndex && events[stage.key] ? "active" : "todo";
              return (
                <div key={stage.key} className="ws-portal-step" data-state={state}>
                  <span className="ws-portal-step__dot" />
                  <span>{stage.label}</span>
                </div>
              );
            })}
          </div>
          <ul className="ws-portal-list">
            {REPAIR_TIMELINE_STAGES.map((stage) => {
              const matchingHistory = history.find((row) =>
                String(row.to_status || "").toLowerCase().includes(stage.key.replace("_", " ")),
              );
              return (
                <li key={stage.key} className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">{stage.label}</div>
                    {matchingHistory?.reason ? <div className="ws-portal-item-meta">{matchingHistory.reason}</div> : null}
                  </div>
                  <span className="ws-portal-when">{formatDateTime(events[stage.key] || matchingHistory?.changed_at) || "Pending"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </PortalCard>
  );
}

function DigitalServiceHistoryCard({ jobs = [], jobHistory = [], invoices = [], vhcByJob = {} }) {
  const invoiceByJobNumber = new Map(invoices.map((invoice) => [String(invoice.job_number || ""), invoice]));
  const history = jobHistory.length
    ? jobHistory.map((row) => {
        const invoice = invoiceByJobNumber.get(String(row.job_number || ""));
        const vhc = vhcByJob?.[row.job_id] || {};
        return {
          id: row.history_id || row.job_id || row.job_number,
          date: row.recorded_at,
          mileage: row.mileage_at_service,
          type: row.status_snapshot || row.vehicle_make_model || "Workshop visit",
          invoice: invoice?.invoice_number || invoice?.invoice_id || "—",
          red: vhc.red || 0,
          amber: vhc.amber || 0,
          note: row.vehicle_reg ? `${row.vehicle_reg} · ${row.vehicle_make_model || "vehicle"}` : null,
        };
      })
    : jobs.filter(portalIsCompletedJob).map((job) => {
        const invoice = invoiceByJobNumber.get(String(job.job_number || ""));
        const vhc = vhcByJob?.[job.id] || {};
        return {
          id: job.id || job.job_number,
          date: job.completed_at || job.updated_at || job.created_at,
          mileage: null,
          type: job.description || job.type || "Workshop visit",
          invoice: invoice?.invoice_number || invoice?.invoice_id || "—",
          red: vhc.red || 0,
          amber: vhc.amber || 0,
          note: job.vehicle_reg ? `${job.vehicle_reg} · ${job.vehicle_make_model || "vehicle"}` : null,
        };
      });

  return (
    <PortalCard
      id="history"
      eyebrow="Service log"
      title="Digital service history"
      count={`${history.length} visit${history.length === 1 ? "" : "s"}`}
      action={<PortalButtonLink href="#messages">Request PDF</PortalButtonLink>}
    >
      {history.length === 0 ? (
        <p className="ws-portal-empty">No completed service history has been recorded for this account yet.</p>
      ) : (
        <ul className="ws-portal-list">
          {history.map((visit) => (
            <li key={visit.id} className="ws-portal-row">
              <div>
                <div className="ws-portal-item-title">{visit.type}</div>
                <div className="ws-portal-item-meta">
                  {formatDate(visit.date)} · {visit.mileage ? `${visit.mileage} miles` : "mileage not recorded"} · {visit.invoice}
                </div>
                {visit.note ? <div className="ws-portal-item-meta ws-portal-item-meta--spaced">{visit.note}</div> : null}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {visit.red > 0 ? <span className="ws-portal-badge" data-tone="open">{visit.red} red</span> : null}
                {visit.amber > 0 ? <span className="ws-portal-badge">{visit.amber} amber</span> : null}
                {visit.red === 0 && visit.amber === 0 ? <span className="ws-portal-badge" data-tone="ok">No red/amber</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PortalCard>
  );
}

function MotHistoryCard({ vehicles = [] }) {
  return (
    <PortalCard
      id="mot"
      eyebrow="MOT record"
      title="MOT history"
      todo={{
        label: "DVLA MOT History API not linked yet",
        detail: "Stored MOT due dates are live. Full test history, advisories and failures still require the DVLA MOT History connection.",
      }}
    >
      {vehicles.length === 0 ? <p className="ws-portal-empty">No vehicles are linked to this account yet.</p> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {vehicles.map((vehicle) => {
          const days = daysUntil(vehicle.mot_due);
          const status = days == null ? "Unknown" : days < 0 ? "Overdue" : days <= 30 ? "Due soon" : "Current";
          return (
            <div key={vehicle.vehicle_id || vehicle.reg_number} className="ws-portal-tile">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="ws-portal-item-title">{portalVehicleTitle(vehicle)}</span>
                <span className="ws-portal-badge">{portalVehicleReg(vehicle)}</span>
              </div>
              <ul className="ws-portal-list">
                <li className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">Current MOT due date</div>
                    <div className="ws-portal-item-meta">{formatDate(vehicle.mot_due) || "Not recorded"}</div>
                  </div>
                  <span className="ws-portal-badge" data-tone={status === "Current" ? "ok" : "open"}>{status}</span>
                </li>
              </ul>
            </div>
          );
        })}
      </div>
    </PortalCard>
  );
}

function RecallCheckerCard({ vehicles = [] }) {
  return (
    <PortalCard
      id="recalls"
      eyebrow="Manufacturer alerts"
      title="Recall checker"
      todo={{ label: "Manufacturer / DVSA recall API not linked yet" }}
    >
      {vehicles.length === 0 ? <p className="ws-portal-empty">No vehicles are linked to this account yet.</p> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {vehicles.map((vehicle) => (
          <div key={vehicle.vehicle_id || vehicle.reg_number} className="ws-portal-tile">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="ws-portal-item-title">{portalVehicleTitle(vehicle)}</span>
              <span className="ws-portal-badge">{portalVehicleReg(vehicle)}</span>
              {vehicle.vin ? <span className="ws-portal-item-meta">VIN {vehicle.vin}</span> : null}
            </div>
            <p className="ws-portal-empty">Recall status will appear here once the manufacturer / DVSA API connection is in place.</p>
          </div>
        ))}
      </div>
    </PortalCard>
  );
}

function VhcEnhancementsCard({ jobs = [], vhcByJob = {}, vhcDeclinations = [], vhcMedia = [], vhcShareLinks = [] }) {
  const [presentationMode, setPresentationMode] = useState(false);

  useEffect(() => {
    setPresentationMode(isPresentationMode());
  }, []);

  const getVhcSummary = (job) => vhcByJob[job.id] || vhcByJob[job.job_number];
  const jobsWithVhc = jobs.filter((job) => getVhcSummary(job));
  const latestJob = jobsWithVhc[0];
  const latestSummary = latestJob ? getVhcSummary(latestJob) : null;
  const latestShareLink = latestJob
    ? vhcShareLinks.find(
        (link) =>
          String(link.job_id || "") === String(latestJob.id || "") ||
          String(link.job_number || "") === String(latestJob.job_number || ""),
      )
    : null;
  const customerReportUrl = latestShareLink?.link_code ? buildCustomerReportUrl(latestShareLink.link_code) : null;
  const getRouteHref = (kind, liveHref) => (presentationMode ? VHC_PRESENTATION_LINKS[kind] : liveHref);
  const latestMedia = latestJob
    ? vhcMedia.filter((item) => item.job_number === latestJob.job_number).slice(0, 6)
    : vhcMedia.slice(0, 6);
  const declined = latestJob ? vhcDeclinations.filter((row) => row.job_id === latestJob.id) : vhcDeclinations;

  return (
    <PortalCard
      id="vhc-extras"
      eyebrow="Inspection"
      title="VHC hub"
      action={
        latestJob ? (
          <div className="ws-portal-action-row">
            {customerReportUrl || presentationMode ? (
              <PortalButtonLink href={getRouteHref("customer", customerReportUrl)}>View and share VHC</PortalButtonLink>
            ) : null}
          </div>
        ) : null
      }
    >
      {!latestSummary ? (
        <p className="ws-portal-empty">No live VHC is linked to this account yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="ws-portal-split">
            <div className="ws-portal-tile">
              <div className="ws-portal-balance">
                <span className="ws-portal-label">Authorised total this visit</span>
                <span className="ws-portal-balance__figure">{formatCurrency(latestJob.vhc_authorized_total || 0)}</span>
              </div>
              <span className="ws-portal-item-meta">
                {latestSummary.green || 0} green · {latestSummary.amber || 0} amber · {latestSummary.red || 0} red.
              </span>
            </div>
            <div className="ws-portal-tile">
              <h3 className="ws-portal-subhead">Declined items to revisit</h3>
              {declined.length === 0 ? (
                <p className="ws-portal-empty">Nothing declined on the linked VHC.</p>
              ) : (
                <ul className="ws-portal-list">
                  {declined.map((item) => (
                    <li key={item.vhc_id || `${item.job_id}-${item.issue_title}`} className="ws-portal-row">
                      <div>
                        <div className="ws-portal-item-title">{item.issue_title || item.section || "VHC item"}</div>
                        {item.issue_description ? <div className="ws-portal-item-meta">{item.issue_description}</div> : null}
                      </div>
                      <span className="ws-portal-badge" data-tone="open">{item.display_status || item.approval_status || "Declined"}</span>
                    </li>
                  ))}
                </ul>
              )}
              <PortalButtonLink href="#messages" style={{ alignSelf: "flex-start" }}>Ask us to re-quote</PortalButtonLink>
            </div>
          </div>
          <div className="ws-portal-tile">
            <h3 className="ws-portal-subhead">Inspection media</h3>
            {latestMedia.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {latestMedia.map((item) => <MediaThumb key={item.id} item={item} />)}
              </div>
            ) : (
              <p className="ws-portal-empty">Media will appear once the technician uploads customer-visible VHC photos or video.</p>
            )}
          </div>
        </div>
      )}
    </PortalCard>
  );
}

function InvoicesPaymentsExtrasCard({ invoicePayments = [], paymentPlans = [], transactions = [] }) {
  return (
    <PortalCard
      id="payments-extras"
      eyebrow="Account"
      title="Payments, finance & signatures"
      todo={{
        label: "Signature ledger not wired yet",
        detail:
          "Payment history, payment plans and account transactions are live where records exist. Digital signature capture still needs a customer-facing workflow.",
      }}
    >
      <div className="ws-portal-tile">
        <h3 className="ws-portal-subhead">Payment history</h3>
        {invoicePayments.length === 0 ? (
          <p className="ws-portal-empty">No invoice payments have been recorded for this account yet.</p>
        ) : (
          <ul className="ws-portal-list">
            {invoicePayments.map((payment) => (
              <li key={payment.payment_id} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{formatCurrency(payment.amount)} · {payment.payment_method || "Payment"}</div>
                  <div className="ws-portal-item-meta">{formatDate(payment.payment_date)} · {payment.reference || "No reference"}</div>
                </div>
                <span className="ws-portal-badge" data-tone="ok">Paid</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ws-portal-split">
        <div className="ws-portal-tile">
          <h3 className="ws-portal-subhead">Payment plans</h3>
          {paymentPlans.length === 0 ? (
            <p className="ws-portal-empty">No active payment plans are linked to this account.</p>
          ) : (
            <ul className="ws-portal-list">
              {paymentPlans.map((plan) => (
                <li key={plan.plan_id} className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">{plan.name || plan.description || "Payment plan"}</div>
                    <div className="ws-portal-item-meta">{formatCurrency(plan.balance_due)} balance · next {formatDate(plan.next_payment_date)}</div>
                  </div>
                  <span className="ws-portal-badge" data-tone={String(plan.status).toLowerCase() === "active" ? "ok" : undefined}>{plan.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="ws-portal-tile">
          <h3 className="ws-portal-subhead">Digital signatures</h3>
          <p className="ws-portal-empty">Digital signature records will appear once the signature ledger is connected.</p>
        </div>
        <div className="ws-portal-tile">
          <h3 className="ws-portal-subhead">Account statement</h3>
          {transactions.length === 0 ? (
            <p className="ws-portal-empty">No account transactions are linked to this account.</p>
          ) : (
            <ul className="ws-portal-list">
              {transactions.slice(0, 5).map((transaction) => (
                <li key={transaction.transaction_id} className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">{transaction.description || transaction.type}</div>
                    <div className="ws-portal-item-meta">{formatDate(transaction.transaction_date)} · {transaction.job_number || "Account"}</div>
                  </div>
                  <span className="ws-portal-badge">{formatCurrency(transaction.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <PortalButtonLink href="#messages" style={{ alignSelf: "flex-start" }}>Request full statement</PortalButtonLink>
        </div>
      </div>
    </PortalCard>
  );
}

function DocumentsCentreCard({ invoices = [], vhcMedia = [] }) {
  const docs = [
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.invoice_id || invoice.id}`,
      name: invoice.invoice_number || invoice.invoice_id || "Invoice",
      meta: `Invoice · ${formatDate(invoice.created_at)} · ${invoice.payment_status || "Draft"}`,
      href: invoice.invoice_id ? `/accounts/invoices/${invoice.invoice_id}` : null,
    })),
    ...vhcMedia.map((item) => ({
      id: `media-${item.id}`,
      name: item.context_label || `${item.media_type || "VHC"} media`,
      meta: `Inspection media · ${formatDate(item.created_at)}`,
      href: item.public_url,
    })),
  ];

  return (
    <PortalCard
      id="documents"
      eyebrow="Files"
      title="Documents centre"
      action={<PortalButtonLink href="#messages">Request upload</PortalButtonLink>}
      todo={{
        label: "Customer documents API + upload endpoint not wired yet",
        detail: "Invoices and VHC media are live. Customer-uploaded documents still need a customer-scoped index and upload route.",
      }}
    >
      <div className="ws-portal-tile">
        {docs.length === 0 ? (
          <p className="ws-portal-empty">No invoice or VHC media documents are linked to this account yet.</p>
        ) : (
          <ul className="ws-portal-list">
            {docs.map((doc) => (
              <li key={doc.id} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{doc.name}</div>
                  <div className="ws-portal-item-meta">{doc.meta}</div>
                </div>
                {doc.href ? <PortalButtonLink href={doc.href}>Open</PortalButtonLink> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ws-portal-tile">
        <h3 className="ws-portal-subhead">Upload zone</h3>
        <div className="ws-portal-upload ws-portal-upload--auto">
          Customer uploads will appear here once the upload endpoint is connected.
        </div>
      </div>
    </PortalCard>
  );
}

function SalesShowroomCard() {
  return (
    <PortalCard
      id="sales-hub"
      eyebrow="Sales"
      title="Showroom & orders"
      todo={{ label: "Customer-side sales tables for watchlists, reservations, PX and orders not built yet" }}
    >
      <div className="ws-portal-split">
        <div className="ws-portal-tile">
          <h3 className="ws-portal-subhead">Saved cars & price alerts</h3>
          <p className="ws-portal-empty">Saved cars will appear here once the customer watchlist table is connected.</p>
          <PortalButtonLink href="/website#cars" style={{ alignSelf: "flex-start" }}>Browse cars</PortalButtonLink>
        </div>
        <div className="ws-portal-tile">
          <h3 className="ws-portal-subhead">Reservations and orders</h3>
          <p className="ws-portal-empty">Reservations, vehicle orders and delivery countdowns will appear once customer sales records are available.</p>
        </div>
        <div className="ws-portal-tile">
          <h3 className="ws-portal-subhead">Part-exchange offers</h3>
          <p className="ws-portal-empty">Part-exchange valuations will appear once the sales enquiry workflow is linked to the portal.</p>
        </div>
      </div>
    </PortalCard>
  );
}

function PartsPortalExtrasCard({ partsJobItems = [], partsRequests = [], partsOrderCards = [] }) {
  return (
    <PortalCard
      id="parts-hub"
      eyebrow="Parts"
      title="Parts portal"
      todo={{
        label: "VIN-driven parts catalogue and accessory upsell API not wired yet",
        detail: "Job parts, parts requests and order cards are live where records exist. VIN fitment and accessory recommendations still require a catalogue API.",
      }}
    >
      <div className="ws-portal-tile">
        <h3 className="ws-portal-subhead">VIN lookup</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" placeholder="Enter VIN or registration" disabled style={{ flex: "1 1 220px", minWidth: 0 }} />
          <button type="button">Find parts</button>
        </div>
      </div>
      <div className="ws-portal-split">
        <div className="ws-portal-tile">
          <h3 className="ws-portal-subhead">Job parts</h3>
          {partsJobItems.length === 0 ? (
            <p className="ws-portal-empty">No job parts are currently linked to this account.</p>
          ) : (
            <ul className="ws-portal-list">
              {partsJobItems.slice(0, 8).map((item) => (
                <li key={item.id} className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">{partTitle(item)}</div>
                    <div className="ws-portal-item-meta">Qty {item.quantity_requested || 1} · ETA {formatDate(item.eta_date) || "TBC"}</div>
                  </div>
                  <span className="ws-portal-badge" data-tone={String(item.status).includes("fitted") ? "ok" : "open"}>{item.status || "Pending"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="ws-portal-tile">
          <h3 className="ws-portal-subhead">Parts requests</h3>
          {partsRequests.length === 0 ? (
            <p className="ws-portal-empty">No parts requests are awaiting action.</p>
          ) : (
            <ul className="ws-portal-list">
              {partsRequests.slice(0, 8).map((request) => (
                <li key={request.request_id} className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">{partTitle(request)}</div>
                    <div className="ws-portal-item-meta">Qty {request.quantity || 1} · {formatDate(request.updated_at || request.created_at) || "TBC"}</div>
                  </div>
                  <span className="ws-portal-badge" data-tone={String(request.status).includes("approved") ? "ok" : "open"}>{request.status || "Pending"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="ws-portal-tile">
        <h3 className="ws-portal-subhead">Order tracking</h3>
        {partsOrderCards.length === 0 ? (
          <p className="ws-portal-empty">No customer parts orders are linked to this account.</p>
        ) : (
          <ul className="ws-portal-list">
            {partsOrderCards.slice(0, 8).map((order) => (
              <li key={order.id} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{order.order_number || "Parts order"}</div>
                  <div className="ws-portal-item-meta">
                    {order.vehicle_reg || "Vehicle TBC"} · ETA {formatDate(order.delivery_eta) || "TBC"}
                    {order.delivery_window ? ` · ${order.delivery_window}` : ""}
                  </div>
                </div>
                <span className="ws-portal-badge" data-tone={String(order.delivery_status).includes("delivered") ? "ok" : "open"}>
                  {order.delivery_status || order.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalCard>
  );
}

function SmartRepairCard({ bookingRequests = [] }) {
  const requests = bookingRequests.filter(isBodyshopRequest);
  return (
    <PortalCard
      id="bodyshop"
      eyebrow="Bodyshop"
      title="SMART repair & estimates"
      todo={{ label: "Bodyshop estimate workflow and before/after media bucket not wired yet" }}
    >
      <div className="ws-portal-tile">
        <p className="ws-portal-lead">
          Send us photos of scuffs, scratches or dents and we'll respond from the workshop workflow.
        </p>
        <div className="ws-portal-split">
          <div className="ws-portal-upload">Upload connection required</div>
          <div className="ws-portal-upload">Upload connection required</div>
          <div className="ws-portal-upload">Upload connection required</div>
        </div>
        <PortalButtonLink href="#messages" style={{ alignSelf: "flex-start" }}>Request estimate</PortalButtonLink>
      </div>
      <div className="ws-portal-tile">
        <h3 className="ws-portal-subhead">Repair requests</h3>
        {requests.length === 0 ? (
          <p className="ws-portal-empty">No bodyshop or SMART repair requests are currently linked to this account.</p>
        ) : (
          <ul className="ws-portal-list">
            {requests.map((request) => (
              <li key={request.request_id} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{request.description || "Repair request"}</div>
                  <div className="ws-portal-item-meta">{formatDate(request.submitted_at)}</div>
                </div>
                <span className="ws-portal-badge" data-tone="open">{request.status || "Pending"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalCard>
  );
}

function ValetDetailingCard({ bookingRequests = [] }) {
  const requests = bookingRequests.filter(isValetRequest);
  return (
    <PortalCard
      id="valet"
      eyebrow="Valeting"
      title="Valet & detailing"
      todo={{ label: "Valet packages and subscription model not in schema yet" }}
    >
      <div className="ws-portal-tile">
        <h3 className="ws-portal-subhead">Your subscription</h3>
        <p className="ws-portal-empty">No valet subscription is linked to this account.</p>
      </div>
      <div className="ws-portal-tile">
        <h3 className="ws-portal-subhead">Valet requests</h3>
        {requests.length === 0 ? (
          <p className="ws-portal-empty">No valet or detailing requests are currently linked to this account.</p>
        ) : (
          <ul className="ws-portal-list">
            {requests.map((request) => (
              <li key={request.request_id} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{request.description || "Valet request"}</div>
                  <div className="ws-portal-item-meta">{formatDate(request.submitted_at)}</div>
                </div>
                <span className="ws-portal-badge" data-tone="open">{request.status || "Pending"}</span>
              </li>
            ))}
          </ul>
        )}
        <PortalButtonLink href="#messages" style={{ alignSelf: "flex-start" }}>Ask about valet options</PortalButtonLink>
      </div>
    </PortalCard>
  );
}

function FamilyGarageCard({ customer, vehicles = [] }) {
  const customerName =
    [customer?.firstname, customer?.lastname].filter(Boolean).join(" ") ||
    customer?.name ||
    customer?.email ||
    "Account holder";

  return (
    <PortalCard
      id="family"
      eyebrow="Household"
      title="Family & shared garage"
      action={<PortalButtonLink href="#messages">Request shared access</PortalButtonLink>}
      todo={{ label: "Shared accounts / household schema not built yet" }}
    >
      <div className="ws-portal-tile">
        <h3 className="ws-portal-subhead">Members</h3>
        <ul className="ws-portal-list">
          <li className="ws-portal-row">
            <div>
              <div className="ws-portal-item-title">{customerName}</div>
              <div className="ws-portal-item-meta">
                {customer?.email || "No email stored"} · {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
              </div>
            </div>
            <span className="ws-portal-badge" data-tone="ok">Owner</span>
          </li>
        </ul>
      </div>
      <div className="ws-portal-tile">
        <h3 className="ws-portal-subhead">Shared vehicles</h3>
        {vehicles.length === 0 ? (
          <p className="ws-portal-empty">No vehicles are linked to this account yet.</p>
        ) : (
          <ul className="ws-portal-list">
            {vehicles.map((vehicle) => (
              <li key={vehicle.vehicle_id || vehicle.reg_number} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{portalVehicleReg(vehicle)}</div>
                  <div className="ws-portal-item-meta">{portalVehicleTitle(vehicle)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalCard>
  );
}

function SelfServiceToolsCard({ vehicles = [], vhcDeclinations = [] }) {
  const servicePlans = vehicles.filter(
    (vehicle) => vehicle.service_plan_supplier || vehicle.service_plan_type || vehicle.service_plan_expiry,
  );

  return (
    <PortalCard
      id="self-service"
      eyebrow="Self service"
      title="Reminders, plans & loyalty"
      todo={{
        label: "Seasonal reminders and loyalty programme not in schema yet",
        detail:
          "Service-plan fields and VHC advisory reminders are live where records exist. Seasonal reminder automation and loyalty still require tables/workflows.",
      }}
    >
      <div className="ws-portal-split">
        <div className="ws-portal-tile">
          <h3 className="ws-portal-subhead">Seasonal reminders</h3>
          <p className="ws-portal-empty">Seasonal reminders will appear once reminder rules are connected.</p>
        </div>
        <div className="ws-portal-tile">
          <h3 className="ws-portal-subhead">Service plans</h3>
          {servicePlans.length === 0 ? (
            <p className="ws-portal-empty">No service plan is linked to your vehicles.</p>
          ) : (
            <ul className="ws-portal-list">
              {servicePlans.map((vehicle) => (
                <li key={vehicle.vehicle_id || vehicle.reg_number} className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">
                      {[vehicle.service_plan_supplier, vehicle.service_plan_type].filter(Boolean).join(" · ") || "Service plan"}
                    </div>
                    <div className="ws-portal-item-meta">{portalVehicleReg(vehicle)} · expires {formatDate(vehicle.service_plan_expiry) || "Not recorded"}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="ws-portal-tile">
          <h3 className="ws-portal-subhead">Loyalty & referral</h3>
          <p className="ws-portal-empty">Loyalty points and referral rewards will appear once the programme schema is connected.</p>
          <PortalButtonLink href="#settings" style={{ alignSelf: "flex-start" }}>Refer a friend</PortalButtonLink>
        </div>
        <div className="ws-portal-tile">
          <h3 className="ws-portal-subhead">Advisory reminders</h3>
          {vhcDeclinations.length === 0 ? (
            <p className="ws-portal-empty">No declined VHC advisories are waiting to be revisited.</p>
          ) : (
            <ul className="ws-portal-list">
              {vhcDeclinations.slice(0, 5).map((item) => (
                <li key={item.vhc_id || `${item.job_id}-${item.issue_title}`} className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">{item.issue_title || item.section || "VHC advisory"}</div>
                    <div className="ws-portal-item-meta">{item.issue_description || item.customer_description}</div>
                  </div>
                  <span className="ws-portal-badge" data-tone="open">Revisit</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PortalCard>
  );
}

function AiAssistantCard() {
  const [draft, setDraft] = useState("");
  return (
    <PortalCard
      id="assistant"
      eyebrow="Help"
      title="Ownership assistant"
      todo={{ label: "Customer-facing AI assistant endpoint not wired yet" }}
    >
      <div className="ws-portal-tile">
        <p className="ws-portal-lead">
          Ask anything about your vehicle, history or upcoming visits. The assistant will be wired up to live data soon.
        </p>
        <div className="ws-portal-action-row">
          {ASSISTANT_SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => setDraft(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Type a question..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{ flex: "1 1 220px", minWidth: 0 }}
          />
          <button type="button">Ask</button>
        </div>
      </div>
    </PortalCard>
  );
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const { setTemporaryOverride } = useTheme();
  useWebsiteScope();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstname: "",
    lastname: "",
    mobile: "",
    telephone: "",
    address: "",
    postcode: "",
    contact_preference: "email",
  });
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionFlash, setActionFlash] = useState({});
  // Theme cycle preference: "light" | "dark" | "system". Defaults to dark
  // (the historic /website look) until the stored choice loads on mount.
  const [websiteThemePref, setWebsiteThemePref] = useState("dark");

  useEffect(() => {
    // Force dark mode + red accent for the whole /website/profile experience.
    // The setAttribute is applied immediately (no wait for the themeProvider
    // effect cycle) so there is no flash of the user's previous theme on
    // navigation. setTemporaryOverride then writes the red-accent CSS vars
    // via the provider, and the cleanup restores the user's preference on
    // navigation away.
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    setTemporaryOverride({ mode: "dark", accent: "red" });
    return () => setTemporaryOverride(null);
  }, [setTemporaryOverride]);

  // Load the saved /website theme preference once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(WEBSITE_THEME_KEY);
    if (stored && WEBSITE_THEME_CYCLE.includes(stored)) {
      setWebsiteThemePref(stored);
    }
  }, []);

  // Apply the resolved theme to <html> via data-website-theme, and when
  // the preference is "system" keep it in sync with the OS scheme. The
  // attribute is removed on navigation away so other /website pages keep
  // their dark default.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const apply = () => {
      document.documentElement.setAttribute(
        "data-website-theme",
        resolveWebsiteTheme(websiteThemePref),
      );
    };
    apply();
    let media;
    if (websiteThemePref === "system" && window.matchMedia) {
      media = window.matchMedia("(prefers-color-scheme: light)");
      media.addEventListener("change", apply);
    }
    return () => {
      if (media) media.removeEventListener("change", apply);
      document.documentElement.removeAttribute("data-website-theme");
    };
  }, [websiteThemePref]);

  const cycleWebsiteTheme = () => {
    setWebsiteThemePref((prev) => {
      const idx = WEBSITE_THEME_CYCLE.indexOf(prev);
      const next = WEBSITE_THEME_CYCLE[(idx + 1) % WEBSITE_THEME_CYCLE.length];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(WEBSITE_THEME_KEY, next);
      }
      return next;
    });
  };

  const refresh = () =>
    fetch("/api/website/profile", { credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/website/login");
          return null;
        }
        return r.json();
      })
      .then((payload) => {
        if (!payload) return;
        if (!payload.success) {
          setStatus("error");
          return;
        }
        setData(payload);
        setEditForm({
          firstname: payload.customer.firstname || "",
          lastname: payload.customer.lastname || "",
          mobile: payload.customer.mobile || "",
          telephone: payload.customer.telephone || "",
          address: payload.customer.address || "",
          postcode: payload.customer.postcode || "",
          contact_preference:
            normalizeContactPreference(payload.customer.contact_preference) || "email",
        });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (key, message) => {
    setActionFlash((prev) => ({ ...prev, [key]: message }));
    setTimeout(() => {
      setActionFlash((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 3500);
  };

  const handleLogout = async () => {
    await fetch("/api/website/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    router.replace("/website");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    try {
      const res = await fetch("/api/website/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(editForm),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.message || "Could not save profile.");
      }
      setData((prev) =>
        prev ? { ...prev, customer: { ...prev.customer, ...payload.customer } } : prev,
      );
      setEditing(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const callAction = async (action, payload, flashKey, flashMessage) => {
    try {
      const res = await fetch("/api/website/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action, payload }),
      });
      const out = await res.json();
      if (!res.ok || !out.success) throw new Error(out.message || "Failed.");
      if (flashKey) flash(flashKey, flashMessage || "Request sent — we'll be in touch.");
      refresh();
    } catch (err) {
      if (flashKey) flash(flashKey, err.message);
    }
  };

  const customer = data?.customer;
  const vehicles = useMemo(() => data?.vehicles || [], [data?.vehicles]);
  const jobs = useMemo(() => data?.jobs || [], [data?.jobs]);
  const invoices = useMemo(() => data?.invoices || [], [data?.invoices]);
  const appointments = useMemo(() => data?.appointments || [], [data?.appointments]);
  const accounts = useMemo(() => data?.accounts || [], [data?.accounts]);
  const paymentMethods = useMemo(() => data?.paymentMethods || [], [data?.paymentMethods]);
  const bookingRequests = useMemo(() => data?.bookingRequests || [], [data?.bookingRequests]);
  const jobHistory = useMemo(() => data?.jobHistory || [], [data?.jobHistory]);
  const vhcByJob = useMemo(() => data?.vhcByJob || {}, [data?.vhcByJob]);
  const vhcDeclinations = useMemo(() => data?.vhcDeclinations || [], [data?.vhcDeclinations]);
  const vhcMedia = useMemo(() => data?.vhcMedia || [], [data?.vhcMedia]);
  const transactions = useMemo(() => data?.transactions || [], [data?.transactions]);
  const jobStatusHistory = useMemo(() => data?.jobStatusHistory || [], [data?.jobStatusHistory]);
  const invoicePayments = useMemo(() => data?.invoicePayments || [], [data?.invoicePayments]);
  const paymentPlans = useMemo(() => data?.paymentPlans || [], [data?.paymentPlans]);
  const partsJobItems = useMemo(() => data?.partsJobItems || [], [data?.partsJobItems]);
  const partsRequests = useMemo(() => data?.partsRequests || [], [data?.partsRequests]);
  const partsOrderCards = useMemo(() => data?.partsOrderCards || [], [data?.partsOrderCards]);
  const timeline = useMemo(() => data?.timeline || [], [data?.timeline]);
  const messages = useMemo(() => data?.messages || [], [data?.messages]);

  const fullName = useMemo(() => {
    if (!customer) return "";
    return (
      [customer.firstname, customer.lastname].filter(Boolean).join(" ") ||
      customer.name ||
      customer.email ||
      "Your account"
    );
  }, [customer]);

  const outstandingInvoices = useMemo(
    () =>
      invoices.filter(
        (i) =>
          !(
            i.paid === true ||
            (i.payment_status || "").toLowerCase() === "paid"
          ),
      ),
    [invoices],
  );
  const outstandingTotal = useMemo(
    () =>
      outstandingInvoices.reduce(
        (sum, i) => sum + Number(i.grand_total ?? i.total ?? 0),
        0,
      ),
    [outstandingInvoices],
  );

  const motSoonest = useMemo(() => {
    let best = null;
    for (const v of vehicles) {
      const days = daysUntil(v.mot_due);
      if (days == null) continue;
      if (!best || days < best.days) best = { vehicle: v, days };
    }
    return best;
  }, [vehicles]);

  const serviceDue = useMemo(() => {
    const lastByVehicle = new Map();
    for (const h of jobHistory) {
      if (!h.vehicle_reg) continue;
      if (!lastByVehicle.has(h.vehicle_reg)) {
        lastByVehicle.set(h.vehicle_reg, h);
      }
    }
    for (const v of vehicles) {
      const last = v.reg_number ? lastByVehicle.get(v.reg_number) : null;
      if (!last) continue;
      const monthsSince =
        (Date.now() - new Date(last.recorded_at).getTime()) /
        (1000 * 60 * 60 * 24 * 30);
      if (monthsSince >= 11) {
        return { vehicle: v, last, months: Math.round(monthsSince) };
      }
    }
    return null;
  }, [jobHistory, vehicles]);

  const activeJob = useMemo(() => {
    return (
      jobs.find((j) => {
        const s = (j.status || "").toLowerCase();
        return !s.includes("completed") && !s.includes("collected");
      }) || jobs[0]
    );
  }, [jobs]);

  const mileageRows = useMemo(() => {
    const max = Math.max(
      1,
      ...jobHistory
        .map((h) => Number(h.mileage_at_service))
        .filter((n) => Number.isFinite(n) && n > 0),
    );
    return jobHistory
      .filter((h) => Number(h.mileage_at_service) > 0)
      .slice(0, 10)
      .map((h) => ({
        ...h,
        pct: Math.min(100, (Number(h.mileage_at_service) / max) * 100),
      }));
  }, [jobHistory]);

  return (
    <>
      <Head>
        <title>{`Your account - ${siteContent.brand.name}`}</title>
      </Head>
      <div
        data-presentation="website-profile"
        className="ws-portal-shell"
      >
        <main className="ws-portal-main">
          {status === "loading" ? (
            <p className="ws-portal-status">
              Loading your account…
            </p>
          ) : status === "error" || !customer ? (
            <p className="ws-portal-status">
              Could not load your account.{" "}
              <Link href="/website/login" className="ws-portal-link">
                Sign in again
              </Link>
              .
            </p>
          ) : (
            <>
              <header data-presentation="website-profile-header" className="ws-portal-header">
                <div>
                  <span className="ws-portal-eyebrow">Customer portal</span>
                  <h1 className="ws-portal-title">Hello, {fullName}</h1>
                  <p className="ws-portal-subtitle">
                    Your vehicles, jobs, invoices, messages and account
                    settings — all in one place.
                  </p>
                </div>
                <div className="ws-portal-header__actions">
                  <button
                    type="button"
                    onClick={cycleWebsiteTheme}
                    aria-label={`Theme: ${websiteThemePref}. Click to cycle light, dark, system.`}
                  >
                    {`Theme: ${websiteThemePref.charAt(0).toUpperCase()}${websiteThemePref.slice(1)}`}
                  </button>
                  <Link href="/website" role="button">
                    Back to site
                  </Link>
                  <button type="button" className="app-btn" onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              </header>

              <div className="ws-portal-layout">
                <aside data-presentation="website-profile-nav" className="ws-portal-nav" aria-label="Sections">
                  <span className="ws-portal-nav__heading">Jump to</span>
                  {SECTIONS.map((s) => (
                    <a key={s.id} href={`#${s.id}`} className="ws-portal-nav__link">
                      {s.label}
                    </a>
                  ))}
                </aside>

                <div className="ws-portal-stack">
                  {/* ───────── Summary banners ───────── */}
                  <div id="summary" data-presentation="website-profile-summary" className="ws-portal-split">
                    {motSoonest ? (
                      <section
                        className="website-banner ws-portal-banner">
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span className="ws-portal-banner__title">
                            {motSoonest.days < 0
                              ? `MOT overdue on ${motSoonest.vehicle.reg_number}`
                              : `MOT due in ${motSoonest.days} day${motSoonest.days === 1 ? "" : "s"} — ${motSoonest.vehicle.reg_number}`}
                          </span>
                          <span className="ws-portal-banner__meta">
                            Expires {formatDate(motSoonest.vehicle.mot_due)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            callAction(
                              "book_service",
                              {
                                description: `MOT booking request for ${motSoonest.vehicle.reg_number}`,
                                vehicle_id: motSoonest.vehicle.vehicle_id,
                              },
                              "mot",
                              "MOT request sent — we'll confirm by email.",
                            )
                          }
                        >
                          Book MOT
                        </button>
                        {actionFlash.mot ? (
                          <p className="ws-portal-flash">{actionFlash.mot}</p>
                        ) : null}
                      </section>
                    ) : null}

                    {serviceDue ? (
                      <section
                        className="website-banner ws-portal-banner">
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span className="ws-portal-banner__title">
                            Service due — {serviceDue.vehicle.reg_number}
                          </span>
                          <span className="ws-portal-banner__meta">
                            Last service {serviceDue.months} months ago.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            callAction(
                              "book_service",
                              {
                                description: `Service booking request for ${serviceDue.vehicle.reg_number}`,
                                vehicle_id: serviceDue.vehicle.vehicle_id,
                              },
                              "svc",
                              "Service request sent — we'll be in touch.",
                            )
                          }
                        >
                          Book service
                        </button>
                        {actionFlash.svc ? (
                          <p className="ws-portal-flash">{actionFlash.svc}</p>
                        ) : null}
                      </section>
                    ) : null}

                    {/* Live job tracker */}
                    {activeJob ? (
                      <PortalCard
                        eyebrow="Live job"
                        title={`Live status - ${activeJob.job_number || `Job #${activeJob.id}`}`}
                        action={<span className="ws-portal-badge">{activeJob.status || "-"}</span>}
                        wide
                      >
                        <p className="ws-portal-hint">
                          {[activeJob.vehicle_reg, activeJob.vehicle_make_model]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <ActiveJobTags
                          job={activeJob}
                          bookingRequest={bookingRequests.find(
                            (r) => r.job_id === activeJob.id,
                          )}
                          vhcSent={
                            (data.vhcSendHistory || []).find(
                              (s) => s.job_id === activeJob.id,
                            ) || null
                          }
                        />
                        {(() => {
                          const stages = getTrackerStages(activeJob);
                          const active = getActiveStageIndex(stages);
                          return (
                            <div
                              className="ws-portal-tracker"
                              style={{ "--ws-portal-steps": String(stages.length), marginTop: 6 }}
                            >
                              {stages.map((stage, idx) => {
                                const state =
                                  idx < active
                                    ? "done"
                                    : idx === active && stage.reached
                                    ? "active"
                                    : "todo";
                                return (
                                  <div key={stage.key} className="ws-portal-step" data-state={state}>
                                    <span className="ws-portal-step__dot" />
                                    <span>{stage.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </PortalCard>
                    ) : null}
                  </div>

                  {/* ───────── Personal details ───────── */}
                  <section className="ws-portal-card ws-portal-card--wide">
                    <PortalCardHeader
                      eyebrow="Account"
                      title="Personal details"
                      action={!editing ? (
                        <button type="button" onClick={() => setEditing(true)}>
                          Edit
                        </button>
                      ) : null}
                    />

                    {editing ? (
                      <form className="ws-portal-form" onSubmit={handleSaveProfile}>
                        {saveError ? <p className="ws-portal-error">{saveError}</p> : null}
                        <div className="ws-portal-form-row">
                          <FieldInput
                            label="First name"
                            value={editForm.firstname}
                            onChange={(v) => setEditForm({ ...editForm, firstname: v })}
                          />
                          <FieldInput
                            label="Last name"
                            value={editForm.lastname}
                            onChange={(v) => setEditForm({ ...editForm, lastname: v })}
                          />
                        </div>
                        <div className="ws-portal-form-row">
                          <FieldInput
                            label="Mobile"
                            value={editForm.mobile}
                            onChange={(v) => setEditForm({ ...editForm, mobile: v })}
                          />
                          <FieldInput
                            label="Telephone"
                            value={editForm.telephone}
                            onChange={(v) => setEditForm({ ...editForm, telephone: v })}
                          />
                        </div>
                        <FieldInput
                          label="Address"
                          value={editForm.address}
                          onChange={(v) => setEditForm({ ...editForm, address: v })}
                        />
                        <div className="ws-portal-form-row">
                          <FieldInput
                            label="Postcode"
                            value={editForm.postcode}
                            onChange={(v) => setEditForm({ ...editForm, postcode: v })}
                          />
                          <div className="ws-portal-field">
                            <label className="ws-portal-label">Contact preference</label>
                            <WebsiteNativeSelect
                              value={editForm.contact_preference}
                              onChange={(value) =>
                                setEditForm({ ...editForm, contact_preference: value })
                              }
                              options={CONTACT_PREFERENCE_OPTIONS}
                            />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button
                            type="submit"
                            className="app-btn"
                            disabled={saving}
                            style={{ flex: 1, minWidth: 160 }}
                          >
                            {saving ? "Saving…" : "Save changes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(false);
                              setSaveError("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="ws-portal-details">
                        <DetailField label="Name" value={fullName} />
                        <DetailField label="Email" value={customer.email} />
                        <DetailField label="Mobile" value={customer.mobile} />
                        <DetailField label="Telephone" value={customer.telephone} />
                        <DetailField label="Address" value={customer.address} />
                        <DetailField label="Postcode" value={customer.postcode} />
                        <DetailField
                          label="Preferred contact"
                          value={contactPreferenceLabel(customer.contact_preference) || customer.contact_preference}
                        />
                      </div>
                    )}
                  </section>

                  {/* ───────── Vehicles ───────── */}
                  <section id="vehicles" className="ws-portal-card">
                    <PortalCardHeader eyebrow="Garage" title="Your vehicles" count={vehicles.length} />
                    {vehicles.length === 0 ? (
                      <p className="ws-portal-empty">
                        No vehicles linked to your account yet. Get in touch and we'll
                        add them.
                      </p>
                    ) : (
                      <ul className="ws-portal-list">
                        {vehicles.map((v) => {
                          const motDays = daysUntil(v.mot_due);
                          const warrantyDays = daysUntil(v.warranty_expiry);
                          return (
                            <li
                              key={v.vehicle_id}
                              className="ws-portal-row ws-portal-row--single"
                            >
                              <div>
                                <div className="ws-portal-item-title">
                                  {v.reg_number || "—"} ·{" "}
                                  {[v.make, v.model].filter(Boolean).join(" ") ||
                                    "Vehicle"}
                                </div>
                                <div className="ws-portal-item-meta">
                                  {[
                                    v.year && `${v.year}`,
                                    v.colour,
                                    v.fuel_type,
                                    v.transmission,
                                    v.mileage && `${v.mileage} mi`,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                                <div className="ws-portal-item-meta ws-portal-item-meta--spaced">
                                  {v.mot_due
                                    ? `MOT ${motDays != null && motDays < 0 ? `overdue (${formatDate(v.mot_due)})` : `due ${formatDate(v.mot_due)}`}`
                                    : "MOT date on file: —"}
                                  {v.warranty_expiry
                                    ? ` · Warranty ${warrantyDays != null && warrantyDays < 0 ? "expired" : `until ${formatDate(v.warranty_expiry)}`}`
                                    : ""}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>

                  {/* Add vehicle + update mileage */}
                  <section className="ws-portal-card">
                    <PortalCardHeader eyebrow="Garage tools" title="Update your vehicles" />
                    <UpdateMileageRow
                      vehicles={vehicles}
                      onSaved={() => {
                        flash("mileage", "Mileage updated.");
                        refresh();
                      }}
                      flash={actionFlash.mileage}
                    />
                    <AddVehicleRow
                      onSubmit={async (payload) => {
                        try {
                          const res = await fetch("/api/website/actions/add-vehicle", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "same-origin",
                            body: JSON.stringify(payload),
                          });
                          const out = await res.json();
                          if (!res.ok || !out.success) {
                            throw new Error(out.message || "Could not add vehicle.");
                          }
                          flash("addveh", "Vehicle added.");
                          refresh();
                          return { success: true };
                        } catch (err) {
                          flash("addveh", err.message);
                          return { success: false, message: err.message };
                        }
                      }}
                      flash={actionFlash.addveh}
                    />
                  </section>

                  {/* Mileage history */}
                  {mileageRows.length > 0 ? (
                    <section className="ws-portal-card">
                      <PortalCardHeader eyebrow="Mileage" title="Mileage history" />
                      <div className="ws-portal-mileage">
                        {mileageRows.map((row) => (
                          <div key={row.history_id} className="ws-portal-mileage__row">
                            <span>{formatDate(row.recorded_at)}</span>
                            <span className="ws-portal-mileage__bar">
                              <span className="ws-portal-mileage__fill" style={{ "--ws-portal-pct": `${row.pct}%` }} />
                            </span>
                            <span className="ws-portal-mileage__value">
                              {Number(row.mileage_at_service).toLocaleString()} mi
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {/* ───────── Jobs + VHC ───────── */}
                  <section id="jobs" className="ws-portal-card">
                    <PortalCardHeader eyebrow="Workshop" title="Jobs & service history" count={jobs.length} />
                    {jobs.length === 0 ? (
                      <p className="ws-portal-empty">No jobs on file yet.</p>
                    ) : (
                      <ul className="ws-portal-list">
                        {jobs.slice(0, 20).map((j) => {
                          const vhc = vhcByJob[j.id];
                          return (
                            <li key={j.id} className="ws-portal-row">
                              <div>
                                <div className="ws-portal-item-title">
                                  {j.job_number || `Job #${j.id}`} · {j.type || "Service"}
                                </div>
                                <div className="ws-portal-item-meta">
                                  {[j.vehicle_reg, j.vehicle_make_model, formatDate(j.created_at)]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                                {vhc ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: 6,
                                      marginTop: 6,
                                    }}
                                  >
                                    {vhc.red ? (
                                      <span className="ws-portal-light" data-tone="red">
                                        <span className="ws-portal-light__dot" />
                                        {vhc.red}
                                      </span>
                                    ) : null}
                                    {vhc.amber ? (
                                      <span className="ws-portal-light" data-tone="amber">
                                        <span className="ws-portal-light__dot" />
                                        {vhc.amber}
                                      </span>
                                    ) : null}
                                    {vhc.green ? (
                                      <span className="ws-portal-light" data-tone="green">
                                        <span className="ws-portal-light__dot" />
                                        {vhc.green}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                              <span className="ws-portal-badge">{j.status || "—"}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>

                  {appointments.length > 0 ? (
                    <section className="ws-portal-card">
                      <PortalCardHeader eyebrow="Bookings" title="Appointments" count={appointments.length} />
                      <ul className="ws-portal-list">
                        {appointments.map((a) => (
                          <li key={a.appointment_id} className="ws-portal-row">
                            <div>
                              <div className="ws-portal-item-title">
                                {formatDateTime(a.scheduled_time)}
                              </div>
                              <div className="ws-portal-item-meta">
                                {a.job_id ? `Job #${a.job_id} · ` : ""}
                                {a.status || "Booked"}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {/* ───────── Inspections (VHC media + items you declined) ───────── */}
                  {(data.vhcMedia?.length || 0) > 0 ||
                  (data.vhcDeclinations?.length || 0) > 0 ? (
                    <section id="inspections" className="ws-portal-card">
                      <PortalCardHeader eyebrow="Inspection" title="Inspection photos & video" count={data.vhcMedia?.length || 0} />
                      {(data.vhcMedia?.length || 0) === 0 ? (
                        <p className="ws-portal-empty">
                          No media yet — uploaded inspection photos will appear here.
                        </p>
                      ) : (
                        <div className="ws-portal-media-grid">
                          {(data.vhcMedia || []).slice(0, 16).map((m) => (
                            <a
                              key={m.id}
                              href={m.public_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ws-portal-media"
                            >
                              {m.media_type === "video" ? (
                                <video
                                  src={m.public_url}
                                  muted
                                  preload="metadata"
                                  className="ws-portal-media__fill"
                                />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={m.public_url}
                                  alt={m.context_label || ""}
                                  className="ws-portal-media__fill"
                                />
                              )}
                              <span className="ws-portal-media__tag">
                                {m.media_type === "video" ? "Video" : "Photo"}
                              </span>
                              {m.context_label ? (
                                <span className="ws-portal-media__caption">{m.context_label}</span>
                              ) : null}
                            </a>
                          ))}
                        </div>
                      )}

                      {(data.vhcDeclinations?.length || 0) > 0 ? (
                        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                          <p className="ws-portal-hint">
                            Items you previously declined — want to revisit?
                          </p>
                          <ul className="ws-portal-list">
                            {(data.vhcDeclinations || [])
                              .slice(0, 8)
                              .map((d, idx) => (
                                <li key={`${d.job_id}-${idx}`} className="ws-portal-row">
                                  <div>
                                    <div className="ws-portal-item-title">
                                      {d.issue_title || d.section || "Item"}
                                    </div>
                                    {d.issue_description ? (
                                      <div className="ws-portal-item-meta">{d.issue_description}</div>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      callAction(
                                        "authorise_vhc_item",
                                        {
                                          job_id: d.job_id,
                                          issue_title: d.issue_title,
                                          issue_description: d.issue_description,
                                        },
                                        `reauth-${d.job_id}-${idx}`,
                                        "Sent — we'll be in touch to schedule.",
                                      )
                                    }
                                  >
                                    Authorise now
                                  </button>
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {/* ───────── Money / Account / Invoices ───────── */}
                  <div id="invoices" className="ws-portal-split">
                    {accounts.length > 0
                      ? accounts.map((a) => (
                          <section key={a.account_id} className="ws-portal-card">
                            <PortalCardHeader
                              eyebrow="Account"
                              title={`${a.account_type || "Account"} #${a.account_id}`}
                              action={<span className="ws-portal-badge">{a.status || "Active"}</span>}
                            />
                            <div className="ws-portal-balance">
                              <span className="ws-portal-balance__figure">
                                {formatCurrency(a.balance)}
                              </span>
                              <span className="ws-portal-hint">
                                Credit limit {formatCurrency(a.credit_limit)} ·{" "}
                                {a.credit_terms ?? 30}-day terms
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() =>
                                  callAction(
                                    "request_statement",
                                    { account_id: a.account_id },
                                    `stmt-${a.account_id}`,
                                    "Statement requested.",
                                  )
                                }
                              >
                                Request statement
                              </button>
                            </div>
                            {actionFlash[`stmt-${a.account_id}`] ? (
                              <p className="ws-portal-flash">
                                {actionFlash[`stmt-${a.account_id}`]}
                              </p>
                            ) : null}
                          </section>
                        ))
                      : null}

                    <section className="ws-portal-card">
                      <PortalCardHeader eyebrow="Billing" title="Invoices" count={invoices.length} />
                      <div className="ws-portal-balance">
                        <span className="ws-portal-balance__figure">
                          {formatCurrency(outstandingTotal)}
                        </span>
                        <span className="ws-portal-hint">
                          Outstanding across {outstandingInvoices.length} invoice
                          {outstandingInvoices.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {invoices.length === 0 ? (
                        <p className="ws-portal-empty">
                          You don't have any invoices on your account yet.
                        </p>
                      ) : (
                        <ul className="ws-portal-list">
                          {invoices.slice(0, 12).map((i) => {
                            const total = i.grand_total ?? i.total;
                            const isPaid =
                              i.paid === true ||
                              (i.payment_status || "").toLowerCase() === "paid";
                            return (
                              <li key={i.invoice_id} className="ws-portal-row">
                                <div>
                                  <div className="ws-portal-item-title">
                                    {i.invoice_number ||
                                      `Invoice ${i.invoice_id?.slice?.(0, 8) || ""}`}
                                    {i.job_number ? ` · ${i.job_number}` : ""}
                                  </div>
                                  <div className="ws-portal-item-meta">
                                    {formatDate(i.created_at)} · {formatCurrency(total)}
                                    {i.due_date ? ` · Due ${formatDate(i.due_date)}` : ""}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <span className="ws-portal-badge" data-tone={isPaid ? "ok" : "open"}>
                                    {isPaid ? "Paid" : i.payment_status || "Open"}
                                  </span>
                                  {!isPaid ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        callAction(
                                          "request_payment_link",
                                          { invoice_id: i.invoice_id },
                                          `pay-${i.invoice_id}`,
                                          "Payment link requested.",
                                        )
                                      }
                                    >
                                      Pay
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      callAction(
                                        "request_invoice_pdf",
                                        { invoice_id: i.invoice_id },
                                        `pdf-${i.invoice_id}`,
                                        "PDF requested — we'll email it.",
                                      )
                                    }
                                  >
                                    PDF
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>

                    <section className="ws-portal-card">
                      <PortalCardHeader eyebrow="Payments" title="Saved payment methods" count={paymentMethods.length} />
                      {paymentMethods.length === 0 ? (
                        <p className="ws-portal-empty">No saved cards on file.</p>
                      ) : (
                        <ul className="ws-portal-list">
                          {paymentMethods.map((p) => (
                            <li key={p.method_id} className="ws-portal-detail">
                              <span className="ws-portal-chip__brand">
                                {p.card_brand || "Card"} {p.is_default ? "· Default" : ""}
                              </span>
                              <span className="ws-portal-chip__line">
                                •••• {p.last4 || "----"} · expires{" "}
                                {String(p.expiry_month || "").padStart(2, "0")}/
                                {String(p.expiry_year || "").slice(-2)}
                              </span>
                              {p.nickname ? (
                                <span className="ws-portal-chip__line">{p.nickname}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>

                  {/* Account statement (transactions) */}
                  {(data.transactions?.length || 0) > 0 ? (
                    <section className="ws-portal-card">
                      <PortalCardHeader eyebrow="Ledger" title="Account statement" count={data.transactions.length} />
                      <div className="ws-portal-ledger">
                        {data.transactions.slice(0, 40).map((t) => {
                          const isCredit =
                            (t.type || "").toLowerCase() === "credit" ||
                            Number(t.amount) < 0;
                          return (
                            <div
                              key={t.transaction_id}
                              className="ws-portal-ledger__row"
                            >
                              <span className="ws-portal-ledger__meta">
                                {formatDate(t.transaction_date)}
                              </span>
                              <span>
                                <div>{t.description || t.type}</div>
                                {t.job_number ? (
                                  <div className="ws-portal-ledger__meta">
                                    {t.job_number}
                                    {t.payment_method ? ` · ${t.payment_method}` : ""}
                                  </div>
                                ) : null}
                              </span>
                              <span className="ws-portal-ledger__amount" data-tone={isCredit ? "credit" : "debit"}>
                                {isCredit ? "−" : ""}
                                {formatCurrency(Math.abs(Number(t.amount)))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {/* ───────── Messages ───────── */}
                  <section id="messages" className="ws-portal-card ws-portal-card--wide">
                    <PortalCardHeader eyebrow="Inbox" title="Messages" count={messages.length} />
                    <div className="ws-portal-thread">
                      {messages.length === 0 ? (
                        <p className="ws-portal-empty">
                          No messages yet — drop us a note below and we'll get back to you.
                        </p>
                      ) : (
                        messages.map((m) => {
                          const isCustomer = m.activity_type === "message_customer";
                          const body =
                            m.activity_payload?.body ||
                            m.activity_payload?.summary ||
                            "(empty)";
                          return (
                            <div
                              key={m.event_id}
                              className="ws-portal-bubble"
                              data-author={isCustomer ? "customer" : "staff"}
                            >
                              {body}
                              <span className="ws-portal-bubble__meta">
                                {isCustomer ? "You" : "Humphries & Parks"} ·{" "}
                                {formatDateTime(m.occurred_at)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <MessageComposer
                      onSend={(body) =>
                        callAction("send_message", { body }, "msg", "Message sent.")
                      }
                      flash={actionFlash.msg}
                    />
                  </section>

                  {/* ───────── Book a service ───────── */}
                  <section id="book" className="ws-portal-card">
                    <PortalCardHeader eyebrow="Workshop" title="Book a service" />
                    <BookServiceForm
                      vehicles={vehicles}
                      onSubmit={(payload) =>
                        callAction(
                          "book_service",
                          payload,
                          "book",
                          "Booking request sent — we'll confirm soon.",
                        )
                      }
                      flash={actionFlash.book}
                    />
                    {bookingRequests.length > 0 ? (
                      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                        <p className="ws-portal-hint">Recent requests</p>
                        <ul className="ws-portal-list">
                          {bookingRequests.slice(0, 5).map((r) => (
                            <li key={r.request_id} className="ws-portal-row">
                              <div>
                                <div className="ws-portal-item-title">
                                  {r.description || "Booking request"}
                                </div>
                                <div className="ws-portal-item-meta">
                                  {formatDate(r.submitted_at)}
                                  {r.estimated_completion
                                    ? ` · ETA ${formatDate(r.estimated_completion)}`
                                    : ""}
                                </div>
                              </div>
                              <span className="ws-portal-badge">{r.status || "Pending"}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>

                  {/* ───────── Our services ───────── */}
                  <section id="services" className="ws-portal-card ws-portal-card--wide">
                    <PortalCardHeader eyebrow="Requests" title="Our services" />
                    <p className="ws-portal-hint">
                      Anything we do — pick what you need and we'll come back to you
                      with a quote or callback.
                    </p>
                    <ServiceQuoteRow
                      vehicles={vehicles}
                      onSubmit={(action, payload, label) =>
                        callAction(action, payload, "svcq", `${label} request sent.`)
                      }
                      flash={actionFlash.svcq}
                    />
                  </section>

                  {/* ───────── Sell your car ───────── */}
                  <section id="sell" className="ws-portal-card">
                    <PortalCardHeader eyebrow="Valuation" title="Sell your car" />
                    <p className="ws-portal-hint">
                      Any age, any mileage, any make or model. Free valuation, no
                      obligation.
                    </p>
                    <SellCarForm
                      onSubmit={(payload) =>
                        callAction(
                          "request_valuation",
                          payload,
                          "sell",
                          "Valuation request sent.",
                        )
                      }
                      flash={actionFlash.sell}
                    />
                  </section>

                  {/* ───────── Showroom / callback ───────── */}
                  <section id="showroom" className="ws-portal-card">
                    <PortalCardHeader eyebrow="Sales" title="Showroom" />
                    <p className="ws-portal-hint">
                      See something you like? Tell us which car and we'll arrange a
                      callback or test drive.
                    </p>
                    <ShowroomCallbackForm
                      onSubmit={(payload) =>
                        callAction(
                          "request_vehicle_callback",
                          payload,
                          "show",
                          "Callback request sent.",
                        )
                      }
                      flash={actionFlash.show}
                    />
                    <div style={{ marginTop: 12 }}>
                      <Link href="/website#cars">Browse all cars</Link>
                    </div>
                  </section>

                  {/* ───────── Activity timeline ───────── */}
                  <section id="activity" className="ws-portal-card">
                    <PortalCardHeader eyebrow="Timeline" title="Activity" count={timeline.length} />
                    {timeline.length === 0 ? (
                      <p className="ws-portal-empty">
                        Once you've booked in or had work done, your activity will
                        appear here.
                      </p>
                    ) : (
                      <div className="ws-portal-timeline">
                        {timeline.slice(0, 30).map((event) => (
                          <div key={event.event_id} className="ws-portal-timeline__row">
                            <span className="ws-portal-when">
                              {formatDate(event.occurred_at)}
                            </span>
                            <span className="ws-portal-timeline__what">
                              {humaniseActivity(event)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* ───────── Expanded ownership-hub sections ─────────
                      Each card renders its own card surface using whatever
                      classes the component decides — they're left alone here
                      so the rest of /website/profile follows custglobal.css
                      without touching shared portal cards. */}
                  <OwnershipDashboardCard vehicles={vehicles} />
                  <LiveProgressTrackerCard jobs={jobs} customer={customer} />
                  <RepairApprovalTimelineCard jobs={jobs} jobStatusHistory={jobStatusHistory} />
                  <DigitalServiceHistoryCard jobs={jobs} jobHistory={jobHistory} invoices={invoices} vhcByJob={vhcByJob} />
                  <MotHistoryCard vehicles={vehicles} />
                  <RecallCheckerCard vehicles={vehicles} />
                  <VhcEnhancementsCard jobs={jobs} vhcByJob={vhcByJob} vhcDeclinations={vhcDeclinations} vhcMedia={vhcMedia} vhcShareLinks={data?.vhcShareLinks || []} />
                  <InvoicesPaymentsExtrasCard invoicePayments={invoicePayments} paymentPlans={paymentPlans} transactions={transactions} />
                  <DocumentsCentreCard invoices={invoices} vhcMedia={vhcMedia} />
                  <SalesShowroomCard />
                  <PartsPortalExtrasCard partsJobItems={partsJobItems} partsRequests={partsRequests} partsOrderCards={partsOrderCards} />
                  <SmartRepairCard bookingRequests={bookingRequests} />
                  <ValetDetailingCard bookingRequests={bookingRequests} />
                  <FamilyGarageCard customer={customer} vehicles={vehicles} />
                  <SelfServiceToolsCard vehicles={vehicles} vhcDeclinations={vhcDeclinations} />
                  <AiAssistantCard />

                  {/* ───────── Settings / security ───────── */}
                  <section id="settings" className="ws-portal-card ws-portal-card--wide">
                    <PortalCardHeader eyebrow="Security" title="Account & security" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <ChangePasswordRow
                        onSuccess={() => flash("pw", "Password updated.")}
                        flash={actionFlash.pw}
                      />
                      <ChangeEmailRow
                        currentEmail={customer.email}
                        onSuccess={() => {
                          flash("email", "Email updated.");
                          refresh();
                        }}
                        flash={actionFlash.email}
                      />
                      <NotificationPrefsRow
                        initial={customer}
                        onSuccess={() => flash("prefs", "Preferences saved.")}
                        flash={actionFlash.prefs}
                      />
                      <ReferralRow
                        onSubmit={(payload) =>
                          callAction(
                            "refer_friend",
                            payload,
                            "ref",
                            "Thanks — we'll be in touch with your friend.",
                          )
                        }
                        flash={actionFlash.ref}
                      />
                      <DataActionsRow
                        onExport={() =>
                          callAction(
                            "request_data_export",
                            {},
                            "exp",
                            "Data export requested — we'll email it.",
                          )
                        }
                        onDelete={() =>
                          callAction(
                            "request_account_deletion",
                            {},
                            "del",
                            "Deletion request submitted.",
                          )
                        }
                        flashExp={actionFlash.exp}
                        flashDel={actionFlash.del}
                      />
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="ws-portal-detail">
      <span className="ws-portal-label">{label}</span>
      <span className="ws-portal-detail__value">{value || "—"}</span>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = "text" }) {
  return (
    <div className="ws-portal-field">
      <label className="ws-portal-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function MessageComposer({ onSend, flash }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          placeholder="Type a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="app-btn"
          disabled={sending || !body.trim()}
          onClick={async () => {
            setSending(true);
            await onSend(body.trim());
            setBody("");
            setSending(false);
          }}
        >
          Send
        </button>
      </div>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </>
  );
}

function BookServiceForm({ vehicles, onSubmit, flash }) {
  const [vehicleId, setVehicleId] = useState("");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="ws-portal-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!description.trim()) return;
        setSubmitting(true);
        await onSubmit({
          vehicle_id: vehicleId || null,
          description: description.trim(),
          preferred_date: preferredDate || null,
        });
        setDescription("");
        setPreferredDate("");
        setSubmitting(false);
      }}
    >
      <div className="ws-portal-form-row">
        <div className="ws-portal-field">
          <label className="ws-portal-label">Vehicle</label>
          <WebsiteNativeSelect
            value={vehicleId}
            onChange={setVehicleId}
            placeholder="Select..."
            options={vehicles.map((v) => ({
              value: String(v.vehicle_id),
              label: `${v.reg_number || "—"} · ${[v.make, v.model].filter(Boolean).join(" ")}`,
            }))}
          />
        </div>
        <div className="ws-portal-field">
          <label className="ws-portal-label">Preferred date</label>
          <WebsiteNativeDateTimeInput
            type="date"
            value={preferredDate}
            onChange={setPreferredDate}
            placeholder="Pick a date"
          />
        </div>
      </div>
      <div className="ws-portal-field">
        <label className="ws-portal-label">What do you need?</label>
        <textarea
          placeholder="e.g. annual service + brake check"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <button
        type="submit"
        className="app-btn"
        disabled={submitting || !description.trim()}
      >
        {submitting ? "Sending…" : "Request booking"}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </form>
  );
}

function ChangePasswordRow({ onSuccess, flash }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Password</div>
          <p className="ws-portal-hint">
            Change the password you use to sign in here.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Change"}
        </button>
      </div>
      {open ? (
        <form
          className="ws-portal-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setSaving(true);
            try {
              const res = await fetch("/api/website/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  currentPassword: current,
                  newPassword: next,
                }),
              });
              const data = await res.json();
              if (!res.ok || !data.success) {
                throw new Error(data.message || "Could not update password.");
              }
              setCurrent("");
              setNext("");
              setOpen(false);
              onSuccess();
            } catch (err) {
              setError(err.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {error ? <p className="ws-portal-error">{error}</p> : null}
          <FieldInput
            label="Current password"
            type="password"
            value={current}
            onChange={setCurrent}
          />
          <FieldInput
            label="New password (min. 12 characters)"
            type="password"
            value={next}
            onChange={setNext}
          />
          <button type="submit" className="app-btn" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      ) : null}
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </div>
  );
}

function ChangeEmailRow({ currentEmail, onSuccess, flash }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Email</div>
          <p className="ws-portal-hint">{currentEmail || "—"}</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Change"}
        </button>
      </div>
      {open ? (
        <form
          className="ws-portal-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setSaving(true);
            try {
              const res = await fetch("/api/website/auth/change-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  currentPassword: pw,
                  newEmail: next,
                }),
              });
              const data = await res.json();
              if (!res.ok || !data.success) {
                throw new Error(data.message || "Could not change email.");
              }
              setPw("");
              setNext("");
              setOpen(false);
              onSuccess();
            } catch (err) {
              setError(err.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {error ? <p className="ws-portal-error">{error}</p> : null}
          <FieldInput label="New email" value={next} onChange={setNext} />
          <FieldInput
            label="Current password"
            type="password"
            value={pw}
            onChange={setPw}
          />
          <button type="submit" className="app-btn" disabled={saving}>
            {saving ? "Saving…" : "Update email"}
          </button>
        </form>
      ) : null}
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </div>
  );
}

function NotificationPrefsRow({ initial, onSuccess, flash }) {
  const [channel, setChannel] = useState(
    normalizeContactPreference(initial.contact_preference) || "email"
  );
  const [marketingEmail, setMarketingEmail] = useState(false);
  const [marketingSms, setMarketingSms] = useState(false);
  const [serviceReminders, setServiceReminders] = useState(true);
  const [motReminders, setMotReminders] = useState(true);
  const [saving, setSaving] = useState(false);
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Notifications</div>
          <p className="ws-portal-hint">How and when we contact you.</p>
        </div>
      </div>
      <div className="ws-portal-field">
        <label className="ws-portal-label">Preferred channel</label>
        <WebsiteNativeSelect
          value={channel}
          onChange={setChannel}
          options={CONTACT_PREFERENCE_OPTIONS}
        />
      </div>
      <Toggle
        label="MOT reminders"
        checked={motReminders}
        onChange={setMotReminders}
      />
      <Toggle
        label="Service reminders"
        checked={serviceReminders}
        onChange={setServiceReminders}
      />
      <Toggle
        label="Marketing email (offers, news)"
        checked={marketingEmail}
        onChange={setMarketingEmail}
      />
      <Toggle label="Marketing SMS" checked={marketingSms} onChange={setMarketingSms} />
      <button
        type="button"
        className="app-btn"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            const res = await fetch("/api/website/auth/notification-prefs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({
                contact_preference: channel,
                optIns: {
                  marketingEmail,
                  marketingSms,
                  serviceReminders,
                  motReminders,
                },
              }),
            });
            const data = await res.json();
            if (res.ok && data.success) onSuccess();
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Save preferences"}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  // Custom switch — custglobal.css explicitly avoids checkbox styling on
  // /website, so we render a role=switch element with onClick / onKeyDown
  // instead of a native <input type="checkbox">.
  const toggle = () => onChange(!checked);
  return (
    <div
      className="ws-portal-toggle"
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <span className="ws-portal-toggle__label">{label}</span>
      <span className="ws-portal-toggle__track">
        <span className="ws-portal-toggle__knob" />
      </span>
    </div>
  );
}

function DataActionsRow({ onExport, onDelete, flashExp, flashDel }) {
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Your data</div>
          <p className="ws-portal-hint">
            Request a copy of everything we hold, or ask us to remove your
            account.
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={onExport}>
          Request data export
        </button>
        <button
          type="button"
          className="app-btn"
          onClick={() => {
            if (
              window.confirm(
                "Send an account deletion request? Our team will be in touch to confirm before anything is removed.",
              )
            ) {
              onDelete();
            }
          }}
        >
          Request account deletion
        </button>
      </div>
      {flashExp ? <p className="ws-portal-flash">{flashExp}</p> : null}
      {flashDel ? <p className="ws-portal-flash">{flashDel}</p> : null}
    </div>
  );
}

function ActiveJobTags({ job, bookingRequest, vhcSent }) {
  if (!job) return null;
  const tags = [];
  if ((job.service_mode || "").toLowerCase() === "mobile") {
    tags.push({
      key: "mobile",
      label: `Mobile visit${job.service_postcode ? ` · ${job.service_postcode}` : ""}`,
      tone: "accent",
    });
  }
  if (bookingRequest?.estimated_completion) {
    tags.push({
      key: "eta",
      label: `ETA ${formatDate(bookingRequest.estimated_completion)}`,
      tone: "default",
    });
  }
  if (bookingRequest?.loan_car_details) {
    tags.push({
      key: "loan",
      label: `Courtesy car · ${bookingRequest.loan_car_details}`,
      tone: "ok",
    });
  }
  if (Number(job.vhc_authorized_total) > 0) {
    tags.push({
      key: "vhc-auth",
      label: `Authorised ${formatCurrency(job.vhc_authorized_total)}`,
      tone: "ok",
    });
  }
  if (Number(job.vhc_declined_total) > 0) {
    tags.push({
      key: "vhc-dec",
      label: `Declined ${formatCurrency(job.vhc_declined_total)}`,
      tone: "default",
    });
  }
  if (vhcSent?.sent_at) {
    tags.push({
      key: "vhc-sent",
      label: `Report sent ${formatDate(vhcSent.sent_at)}`,
      tone: "default",
    });
  }
  if (tags.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {tags.map((t) => (
        <span
          key={t.key}
          className="ws-portal-tag"
          data-tone={t.tone}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function UpdateMileageRow({ vehicles, onSaved, flash }) {
  const [vehicleId, setVehicleId] = useState("");
  const [mileage, setMileage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Update mileage</div>
          <p className="ws-portal-hint">
            Help us flag the next service at the right time.
          </p>
        </div>
      </div>
      {error ? <p className="ws-portal-error">{error}</p> : null}
      <div className="ws-portal-form-row">
        <div className="ws-portal-field">
          <label className="ws-portal-label">Vehicle</label>
          <WebsiteNativeSelect
            value={vehicleId}
            onChange={setVehicleId}
            placeholder="Select..."
            options={vehicles.map((v) => ({
              value: String(v.vehicle_id),
              label: `${v.reg_number || "—"} · ${[v.make, v.model].filter(Boolean).join(" ")}`,
            }))}
          />
        </div>
        <div className="ws-portal-field">
          <label className="ws-portal-label">Current mileage</label>
          <input
            type="number"
            inputMode="numeric"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="e.g. 48250"
          />
        </div>
      </div>
      <button
        type="button"
        className="app-btn"
        disabled={saving || !vehicleId || !mileage}
        onClick={async () => {
          setError("");
          setSaving(true);
          try {
            const res = await fetch("/api/website/actions/update-mileage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({
                vehicle_id: Number(vehicleId),
                mileage: Number(mileage),
              }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.message || "Could not update mileage.");
            }
            setMileage("");
            onSaved();
          } catch (err) {
            setError(err.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Save mileage"}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </div>
  );
}

function AddVehicleRow({ onSubmit, flash }) {
  const [reg, setReg] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const handleFetchVehicleData = async () => {
    if (!reg.trim()) {
      setLookupError("Please enter a registration number");
      return;
    }
    setIsLoadingVehicle(true);
    setLookupError("");
    try {
      const regUpper = reg.trim().toUpperCase();
      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: regUpper }),
      });
      const responseText = await response.text();
      if (!response.ok) {
        let parsed;
        try { parsed = JSON.parse(responseText); } catch { parsed = null; }
        throw new Error(
          parsed?.message || parsed?.error || responseText ||
          `DVLA lookup failed with status ${response.status}`,
        );
      }
      let data = {};
      if (responseText) {
        try { data = JSON.parse(responseText); }
        catch { throw new Error("DVLA API returned malformed data"); }
      }
      if (!data || Object.keys(data).length === 0) {
        throw new Error("No vehicle data found for that registration from DVLA");
      }
      const normalizedReg = (
        data.registrationNumber || data.registration || regUpper || ""
      ).toString().toUpperCase();
      const detectedMake = data.make || data.vehicleMake || "";
      const detectedModel = data.model || data.vehicleModel || "";
      const combined = `${detectedMake} ${detectedModel}`.trim();
      setReg(normalizedReg);
      setMakeModel(combined || detectedMake || "");
    } catch (err) {
      setLookupError(err.message || "Could not look up vehicle");
    } finally {
      setIsLoadingVehicle(false);
    }
  };

  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Add a vehicle</div>
          <p className="ws-portal-hint">
            We'll add this to your account straight away.
          </p>
        </div>
      </div>
      <div className="ws-portal-form-row">
        <div className="ws-portal-field">
          <label className="ws-portal-label">Registration</label>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={reg}
              onChange={(e) => setReg(e.target.value)}
              placeholder="e.g. AB12 CDE"
              className="ws-portal-reg-input"
            />
            <button
              type="button"
              className="app-btn"
              onClick={handleFetchVehicleData}
              disabled={isLoadingVehicle || !reg.trim()}
            >
              {isLoadingVehicle ? "Loading…" : "Search"}
            </button>
          </div>
        </div>
        <FieldInput
          label="Make & model"
          value={makeModel}
          onChange={setMakeModel}
        />
      </div>
      {lookupError ? <p className="ws-portal-error">{lookupError}</p> : null}
      <div className="ws-portal-form-row">
        <FieldInput
          label="Mileage (optional)"
          value={mileage}
          onChange={setMileage}
          type="number"
        />
        <FieldInput label="Notes (optional)" value={notes} onChange={setNotes} />
      </div>
      <button
        type="button"
        className="app-btn"
        disabled={submitting || !reg.trim()}
        onClick={async () => {
          setSubmitting(true);
          await onSubmit({
            reg: reg.trim(),
            make_model: makeModel.trim(),
            mileage: mileage ? Number(mileage) : null,
            notes: notes.trim(),
          });
          setReg("");
          setMakeModel("");
          setMileage("");
          setNotes("");
          setSubmitting(false);
        }}
      >
        {submitting ? "Adding…" : "Add"}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </div>
  );
}

function ServiceQuoteRow({ vehicles, onSubmit, flash }) {
  const [picked, setPicked] = useState(SERVICE_TYPES[0]);
  const [vehicleId, setVehicleId] = useState("");
  const [details, setDetails] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <>
      <div className="ws-portal-services">
        {SERVICE_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="ws-portal-service"
            aria-pressed={picked.id === t.id}
            onClick={() => setPicked(t)}
          >
            <span className="ws-portal-service__title">{t.title}</span>
            <span className="ws-portal-service__hint">{t.hint}</span>
          </button>
        ))}
      </div>
      <form
        className="ws-portal-form"
        style={{ marginTop: 14 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!details.trim()) return;
          setSubmitting(true);
          await onSubmit(
            picked.action,
            {
              service_type: picked.id,
              vehicle_id: vehicleId || null,
              description: details.trim(),
              preferred_date: preferredDate || null,
            },
            picked.title,
          );
          setDetails("");
          setPreferredDate("");
          setSubmitting(false);
        }}
      >
        <div className="ws-portal-form-row">
          <div className="ws-portal-field">
            <label className="ws-portal-label">Vehicle (optional)</label>
            <WebsiteNativeSelect
              value={vehicleId}
              onChange={setVehicleId}
              placeholder="Not specific to a vehicle"
              options={vehicles.map((v) => ({
                value: String(v.vehicle_id),
                label: `${v.reg_number || "—"} · ${[v.make, v.model].filter(Boolean).join(" ")}`,
              }))}
            />
          </div>
          <div className="ws-portal-field">
            <label className="ws-portal-label">Preferred date</label>
            <WebsiteNativeDateTimeInput
              type="date"
              value={preferredDate}
              onChange={setPreferredDate}
            />
          </div>
        </div>
        <div className="ws-portal-field">
          <label className="ws-portal-label">Tell us a bit more</label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={`e.g. ${picked.hint.toLowerCase()}`}
          />
        </div>
        <button
          type="submit"
          className="app-btn"
          disabled={submitting || !details.trim()}
        >
          {submitting ? "Sending…" : `Request ${picked.title.toLowerCase()}`}
        </button>
        {flash ? <p className="ws-portal-flash">{flash}</p> : null}
      </form>
    </>
  );
}

function SellCarForm({ onSubmit, flash }) {
  const [reg, setReg] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [condition, setCondition] = useState("Excellent");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="ws-portal-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!reg.trim()) return;
        setSubmitting(true);
        await onSubmit({
          reg: reg.trim(),
          make_model: makeModel.trim(),
          mileage: mileage ? Number(mileage) : null,
          condition,
          notes: notes.trim(),
        });
        setReg("");
        setMakeModel("");
        setMileage("");
        setNotes("");
        setSubmitting(false);
      }}
    >
      <div className="ws-portal-form-row">
        <FieldInput label="Registration" value={reg} onChange={setReg} />
        <FieldInput
          label="Make & model"
          value={makeModel}
          onChange={setMakeModel}
        />
      </div>
      <div className="ws-portal-form-row">
        <FieldInput
          label="Mileage"
          value={mileage}
          onChange={setMileage}
          type="number"
        />
        <div className="ws-portal-field">
          <label className="ws-portal-label">Condition</label>
          <WebsiteNativeSelect
            value={condition}
            onChange={setCondition}
            options={[
              { value: "Excellent", label: "Excellent" },
              { value: "Good", label: "Good" },
              { value: "Average", label: "Average" },
              { value: "Below average", label: "Below average" },
            ]}
          />
        </div>
      </div>
      <div className="ws-portal-field">
        <label className="ws-portal-label">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Service history, modifications, anything else we should know."
        />
      </div>
      <button
        type="submit"
        className="app-btn"
        disabled={submitting || !reg.trim()}
      >
        {submitting ? "Sending…" : "Get free valuation"}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </form>
  );
}

function ShowroomCallbackForm({ onSubmit, flash }) {
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="ws-portal-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!interest.trim()) return;
        setSubmitting(true);
        await onSubmit({
          vehicle_interest: interest.trim(),
          notes: notes.trim(),
          callback_date: callbackDate || null,
        });
        setInterest("");
        setNotes("");
        setCallbackDate("");
        setSubmitting(false);
      }}
    >
      <FieldInput label="Which vehicle?" value={interest} onChange={setInterest} />
      <div className="ws-portal-form-row">
        <div className="ws-portal-field">
          <label className="ws-portal-label">Preferred callback</label>
          <WebsiteNativeDateTimeInput
            type="date"
            value={callbackDate}
            onChange={setCallbackDate}
          />
        </div>
        <FieldInput label="Notes" value={notes} onChange={setNotes} />
      </div>
      <button
        type="submit"
        className="app-btn"
        disabled={submitting || !interest.trim()}
      >
        {submitting ? "Sending…" : "Request callback"}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </form>
  );
}

function ReferralRow({ onSubmit, flash }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Refer a friend</div>
          <p className="ws-portal-hint">
            Send us a friend who needs us — we'll take it from there.
          </p>
        </div>
      </div>
      <div className="ws-portal-form-row">
        <FieldInput label="Their name" value={name} onChange={setName} />
        <FieldInput label="Their email" value={email} onChange={setEmail} />
      </div>
      <FieldInput label="Their phone (optional)" value={phone} onChange={setPhone} />
      <button
        type="button"
        className="app-btn"
        disabled={submitting || !name.trim() || !email.trim()}
        onClick={async () => {
          setSubmitting(true);
          await onSubmit({
            referred_name: name.trim(),
            referred_email: email.trim(),
            referred_phone: phone.trim(),
          });
          setName("");
          setEmail("");
          setPhone("");
          setSubmitting(false);
        }}
      >
        {submitting ? "Sending…" : "Send referral"}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </div>
  );
}

CustomerProfilePage.getLayout = (page) => page;
