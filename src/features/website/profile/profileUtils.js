// file location: src/features/website/profile/profileUtils.js
//
// Pure helpers shared by the /website/profile portal views. Everything here is
// derived from the single bundled payload /api/website/profile returns — no
// component in src/features/website/profile/ fetches anything of its own.
//
// Three groups:
//   • formatters      — UK date / money rendering used in every view
//   • vehicle helpers — title, registration, health score, MOT state
//   • job helpers     — open/closed classification, tracker stages, progress
//
// Moved out of src/pages/website/profile.js when the page was split into the
// seven portal views, so the views and the page read the same derivations.

export const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTime = (value) => {
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

export const formatCurrency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
};

export const daysUntil = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

// ── Vehicles ────────────────────────────────────────────────────────────

export const vehicleKey = (vehicle) =>
  String(vehicle?.vehicle_id ?? vehicle?.id ?? vehicle?.reg_number ?? "");

export const vehicleTitle = (vehicle) =>
  vehicle?.make_model ||
  vehicle?.makeModel ||
  [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") ||
  "Vehicle";

export const vehicleReg = (vehicle) =>
  vehicle?.reg_number || vehicle?.reg || vehicle?.registration || "Registration TBC";

// Rough ownership score shown on the vehicle header ring. Built only from
// fields the payload really carries, so it never implies data we have not got.
export const getHealthScore = (vehicle) => {
  let score = 100;
  const motDue = vehicle?.mot_due || vehicle?.motDue;
  if (motDue) {
    const days = daysUntil(motDue);
    if (Number.isFinite(days) && days < 0) score -= 35;
    else if (Number.isFinite(days) && days <= 30) score -= 20;
    else if (Number.isFinite(days) && days <= 60) score -= 10;
  }
  if (!vehicle?.mileage) score -= 5;
  if (!vehicle?.service_history && !vehicle?.service_plan_type) score -= 8;
  return Math.max(0, Math.min(100, score));
};

// Customer-facing MOT wording plus the badge tone the portal paints it with.
export const getMotState = (vehicle) => {
  const due = vehicle?.mot_due || vehicle?.motDue;
  const days = daysUntil(due);
  if (days == null) return { label: "MOT date not on file", tone: undefined, days: null, due: null };
  if (days < 0) return { label: "MOT overdue", tone: "open", days, due };
  if (days <= 30) return { label: `MOT due in ${days} day${days === 1 ? "" : "s"}`, tone: "open", days, due };
  return { label: "MOT valid", tone: "ok", days, due };
};

// ── Jobs ────────────────────────────────────────────────────────────────

const DONE_STATUSES = ["delivered", "closed", "completed", "collected", "invoiced"];

export const isOpenJob = (job) => {
  const status = String(job?.status || job?.completion_status || "").toLowerCase();
  return !DONE_STATUSES.some((token) => status.includes(token)) && !job?.completed_at;
};

export const isCompletedJob = (job) => {
  const status = String(job?.status || job?.completion_status || "").toLowerCase();
  return DONE_STATUSES.some((token) => status.includes(token)) || Boolean(job?.completed_at);
};

// The one stage calculation for the whole portal — the Overview card and the
// Workshop tracker both read it, so a customer never sees two different
// answers for "where is my car".
export const getTrackerStages = (job) => {
  if (!job) return [];
  const stages = [
    { key: "booked", label: "Booked", reached: !!job.created_at },
    { key: "checked_in", label: "Checked in", reached: !!job.checked_in_at },
    { key: "in_workshop", label: "In workshop", reached: !!job.workshop_started_at },
  ];
  if (job.vhc_required) {
    stages.push({ key: "vhc", label: "Health check", reached: !!job.vhc_completed_at });
  }
  const washDone =
    !!job.wash_completed_by ||
    (job.completed_at &&
      job.wash_started_at &&
      new Date(job.completed_at).getTime() >= new Date(job.wash_started_at).getTime());
  stages.push({ key: "wash", label: "Cleaned", reached: Boolean(washDone) });
  const status = String(job.status || "").toLowerCase();
  const ready =
    !!job.completed_at ||
    ["ready", "completed", "collected", "invoiced"].some((s) => status.includes(s));
  stages.push({ key: "ready", label: "Ready", reached: ready });
  return stages;
};

export const getActiveStageIndex = (stages) => {
  for (let i = stages.length - 1; i >= 0; i -= 1) {
    if (stages[i].reached) return i;
  }
  return 0;
};

export const getProgressPct = (job) => {
  const stages = getTrackerStages(job);
  if (!stages.length) return 0;
  return Math.round((stages.filter((s) => s.reached).length / stages.length) * 100);
};

// Plain-English version of the stage a job has reached, so the portal never
// prints a raw workshop status string at a customer.
export const getJobStageLabel = (job) => {
  const stages = getTrackerStages(job);
  if (!stages.length) return "Booked in";
  const stage = stages[getActiveStageIndex(stages)];
  if (!stage?.reached) return "Booked in";
  switch (stage.key) {
    case "booked":
      return "Booked in";
    case "checked_in":
      return "With us, waiting to go in";
    case "in_workshop":
      return "In the workshop";
    case "vhc":
      return "Health check complete";
    case "wash":
      return "Being cleaned";
    case "ready":
      return "Ready for collection";
    default:
      return "In progress";
  }
};

export const jobVehicleLine = (job) =>
  [job?.vehicle_make_model, job?.vehicle_reg].filter(Boolean).join(" · ") || "Your vehicle";

export const jobRef = (job) => job?.job_number || (job?.id ? `Job #${job.id}` : "Workshop visit");

// The timestamp a customer would read as "last update" on a live job.
export const jobLastUpdate = (job) =>
  job?.completed_at ||
  job?.wash_started_at ||
  job?.vhc_completed_at ||
  job?.workshop_started_at ||
  job?.checked_in_at ||
  job?.updated_at ||
  job?.created_at ||
  null;

// ── Invoices ────────────────────────────────────────────────────────────

export const isPaidInvoice = (invoice) =>
  invoice?.paid === true || String(invoice?.payment_status || "").toLowerCase() === "paid";

export const invoiceTotal = (invoice) => Number(invoice?.grand_total ?? invoice?.total ?? 0);

export const invoiceRef = (invoice) =>
  invoice?.invoice_number || `Invoice ${String(invoice?.invoice_id || "").slice(0, 8)}`;

// ── Activity, parts and requests ────────────────────────────────────────

// Customer activity rows are stored with internal activity_type values. Prefer
// whatever human summary staff wrote; only fall back to a de-underscored type.
export const humaniseActivity = (event) => {
  const payload = event?.activity_payload || {};
  if (payload.summary) return payload.summary;
  if (payload.description) return payload.description;
  const t = String(event?.activity_type || "").replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const partTitle = (item) =>
  item?.part_name_snapshot ||
  item?.row_description ||
  item?.description ||
  item?.part?.name ||
  item?.part?.part_number ||
  "Part";

export const isBodyshopRequest = (request) =>
  /body|smart|paint|scratch|dent|repair/i.test(
    `${request?.description || ""} ${request?.confirmation_notes || ""}`,
  );

export const isValetRequest = (request) =>
  /valet|detail|clean|wash/i.test(`${request?.description || ""} ${request?.confirmation_notes || ""}`);
