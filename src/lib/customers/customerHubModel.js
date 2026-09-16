// file location: src/lib/customers/customerHubModel.js
//
// Pure derivation layer for the customer record hub.
//
// Every figure, list, timeline and warning shown on /customers/[customerSlug]
// is produced here from the rows the DB helpers return. No React, no Supabase,
// no DOM — so the whole record can be unit-tested (see customerHubModel.test.js)
// and the components stay presentational (CLAUDE.md §4.3).

import { isInactiveJobStatus, isInvoiceSettled, isInvoiceCancelled } from "@/lib/status/statusHelpers";
import { getVehicleRegistration, pickMileageValue } from "@/lib/canonical/fields";
import { getVhcSummary } from "@/features/vhc/vhcStatusEngine";

export const EM_DASH = "—";

/**
 * Normalise an embedded Supabase relation to an array.
 *
 * PostgREST decides the shape from the foreign key: a to-MANY embed comes back
 * as an array, but a to-ONE embed comes back as a single object (or null).
 * `job_booking_requests.job_id` is UNIQUE, so that one arrives as an object
 * while `job_files`, `appointments` and the rest arrive as arrays — and the
 * shape flips if a constraint is ever added or dropped. Everything below reads
 * embedded relations through this, so neither shape can break the page.
 */
export const asRows = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

/* ==========================================================================
   Formatting
   ========================================================================== */

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value) => {
  const date = toDate(value);
  if (!date) return EM_DASH;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDateTime = (value) => {
  const date = toDate(value);
  if (!date) return EM_DASH;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatTime = (value) => {
  const date = toDate(value);
  if (!date) return EM_DASH;
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value || 0));

export const formatMileage = (value) => {
  const miles = Number(value);
  if (!Number.isFinite(miles) || miles <= 0) return EM_DASH;
  return `${new Intl.NumberFormat("en-GB").format(miles)} miles`;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const daysBetween = (value, now = new Date()) => {
  const date = toDate(value);
  if (!date) return null;
  return Math.round((date.getTime() - toDate(now).getTime()) / DAY_MS);
};

/** "in 4 days" / "12 days ago" / "today". Returns EM_DASH for no date. */
export const formatRelativeDay = (value, now = new Date()) => {
  const days = daysBetween(value, now);
  if (days === null) return EM_DASH;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
};

/* ==========================================================================
   Customer identity + contact
   ========================================================================== */

export const displayCustomerName = (customer) => {
  const joined = [customer?.firstname, customer?.lastname].filter(Boolean).join(" ").trim();
  return joined || String(customer?.name || "").trim() || customer?.email || "Customer";
};

export const buildAddressDisplay = (address, postcode) => {
  const rawAddress = String(address || "").trim();
  const rawPostcode = String(postcode || "").trim();
  if (!rawAddress) return rawPostcode;
  if (!rawPostcode) return rawAddress;
  return rawAddress.toLowerCase().includes(rawPostcode.toLowerCase())
    ? rawAddress
    : `${rawAddress}, ${rawPostcode}`;
};

export const buildMapLink = (address) => {
  const query = String(address || "").trim();
  if (!query) return {};
  const encoded = encodeURIComponent(query);
  return {
    href: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    nativeHref: `geo:0,0?q=${encoded}`,
  };
};

/** The channels we hold for this customer, in the order reception tries them. */
export const buildContactChannels = (customer, contactPreference) => {
  const channels = [
    { key: "mobile", label: "Mobile", value: customer?.mobile, href: (v) => `tel:${v}` },
    { key: "telephone", label: "Telephone", value: customer?.telephone, href: (v) => `tel:${v}` },
    { key: "email", label: "Email", value: customer?.email, href: (v) => `mailto:${v}` },
  ];

  return channels
    .filter((channel) => String(channel.value || "").trim())
    .map((channel) => ({
      key: channel.key,
      label: channel.label,
      value: String(channel.value).trim(),
      href: channel.href(String(channel.value).trim()),
      // "sms" is a preference on the mobile number, not a separate column.
      preferred:
        contactPreference === channel.key ||
        (channel.key === "mobile" && contactPreference === "sms"),
    }));
};

/* ==========================================================================
   Job requests
   ========================================================================== */

export const parseRequests = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.requests)) return parsed.requests;
      if (parsed && typeof parsed === "object") return Object.values(parsed);
    } catch (_err) {
      return [];
    }
    return [];
  }
  if (typeof raw === "object") {
    if (Array.isArray(raw.requests)) return raw.requests;
    return Object.values(raw);
  }
  return [];
};

const requestText = (request) => {
  if (!request) return null;
  if (typeof request === "string") return request;
  return request.description || request.title || request.note_text || null;
};

export const deriveRequestSummary = (requests, limit = 3) => {
  const parts = (requests || []).map(requestText).filter(Boolean).slice(0, limit);
  return parts.length ? parts.join(" • ") : null;
};

/** Prefers the structured job_requests rows, falls back to the jsonb blob. */
export const describeJobWork = (job) => {
  const structured = asRows(job?.job_requests).map((row) => row?.description).filter(Boolean);
  if (structured.length) return structured.join(" • ");
  return deriveRequestSummary(parseRequests(job?.requests)) || job?.description || null;
};

export const staffName = (person) =>
  [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim() || null;

/* ==========================================================================
   Invoices and money
   ========================================================================== */

export const getInvoiceTotal = (invoice) =>
  Number(invoice?.invoice_total ?? invoice?.grand_total ?? invoice?.total ?? 0) || 0;

export const getInvoicePaid = (invoice) =>
  asRows(invoice?.invoice_payments).reduce((sum, payment) => sum + (Number(payment?.amount) || 0), 0);

export const getInvoiceOutstanding = (invoice) => {
  if (isInvoiceCancelled(invoice?.payment_status)) return 0;
  if (invoice?.paid === true && !asRows(invoice?.invoice_payments).length) return 0;
  const outstanding = getInvoiceTotal(invoice) - getInvoicePaid(invoice);
  return outstanding > 0.005 ? outstanding : 0;
};

export const isInvoiceOverdue = (invoice, now = new Date()) => {
  if (getInvoiceOutstanding(invoice) <= 0) return false;
  const due = toDate(invoice?.due_date);
  if (!due) return false;
  return due.getTime() < toDate(now).getTime();
};

/**
 * One invoice ledger for the customer. `invoices` is the customer-level read
 * (which includes invoices raised without a job); the job-embedded invoices are
 * merged in so nothing is lost if a row is only reachable through its job.
 */
export const mergeCustomerInvoices = ({ jobs = [], invoices = [] } = {}) => {
  const byId = new Map();

  const add = (invoice, job) => {
    if (!invoice) return;
    const key = String(invoice.id || invoice.invoice_id || invoice.invoice_number);
    if (!key || key === "undefined") return;
    const existing = byId.get(key) || {};
    byId.set(key, {
      ...existing,
      ...invoice,
      jobId: invoice.job_id ?? job?.id ?? existing.jobId ?? null,
      jobNumber: invoice.job_number || job?.job_number || existing.jobNumber || null,
      vehicle: job?.vehicle_reg || job?.vehicle_make_model || existing.vehicle || null,
      // Never lose payments we already collected from the other source.
      invoice_payments: asRows(invoice.invoice_payments).length
        ? asRows(invoice.invoice_payments)
        : asRows(existing.invoice_payments),
    });
  };

  invoices.forEach((invoice) => add(invoice, null));
  jobs.forEach((job) => asRows(job.invoices).forEach((invoice) => add(invoice, job)));

  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.invoice_date || b.created_at || 0) - new Date(a.invoice_date || a.created_at || 0)
  );
};

export const collectPayments = (mergedInvoices = []) =>
  mergedInvoices
    .flatMap((invoice) =>
      asRows(invoice.invoice_payments).map((payment) => ({
        ...payment,
        invoiceId: invoice.id || invoice.invoice_id,
        invoiceNumber: invoice.invoice_number || null,
        jobNumber: invoice.jobNumber || null,
      }))
    )
    .sort(
      (a, b) =>
        new Date(b.payment_date || b.created_at || 0) - new Date(a.payment_date || a.created_at || 0)
    );

/* ==========================================================================
   Appointments
   ========================================================================== */

const appointmentVehicle = (job) =>
  job?.vehicle_reg || job?.vehicle_make_model || null;

/**
 * One appointment list from both sources (customer-level rows and the rows
 * embedded on each job), de-duplicated on appointment_id.
 */
export const buildAppointments = ({ jobs = [], appointments = [] } = {}) => {
  const byId = new Map();

  const add = (appointment, job) => {
    if (!appointment?.appointment_id) return;
    const key = String(appointment.appointment_id);
    const source = job || appointment.job || null;
    const booking = asRows(source?.job_booking_requests)[0] || null;
    const deliveryStop = asRows(source?.delivery_stops)[0] || null;
    const existing = byId.get(key);

    const entry = {
      id: key,
      appointmentId: appointment.appointment_id,
      scheduledTime: appointment.scheduled_time || null,
      status: appointment.status || "booked",
      notes: appointment.notes || null,
      createdAt: appointment.created_at || null,
      bookedBy: staffName(appointment.creator) || staffName(source?.advisor) || null,
      jobId: source?.id ?? appointment.job_id ?? null,
      jobNumber: source?.job_number || null,
      jobType: source?.type || null,
      jobStatus: source?.status || null,
      vehicle: appointmentVehicle(source),
      workRequested: source ? describeJobWork(source) : null,
      advisor: staffName(source?.advisor),
      technician: staffName(source?.technician),
      courtesyCar: booking?.loan_car_details || null,
      estimate: booking?.price_estimate ?? null,
      // A mobile job is a visit to the customer; a delivery stop is a
      // collection/delivery leg planned for this job.
      collectionDelivery:
        source?.service_mode === "mobile"
          ? `Mobile visit${source?.service_postcode ? ` · ${source.service_postcode}` : ""}`
          : deliveryStop
            ? `Collection / delivery · ${deliveryStop.status || "planned"}`
            : null,
    };

    // Prefer whichever source carried the richer job context.
    byId.set(key, existing && !entry.jobNumber ? existing : { ...existing, ...entry });
  };

  appointments.forEach((appointment) => add(appointment, appointment.job || null));
  jobs.forEach((job) => asRows(job.appointments).forEach((appointment) => add(appointment, job)));

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.scheduledTime || 0) - new Date(a.scheduledTime || 0)
  );
};

const CANCELLED_APPOINTMENT = /cancel|no.?show/i;

export const splitAppointments = (list = [], now = new Date()) => {
  const cutoff = toDate(now).getTime();
  const upcoming = [];
  const previous = [];

  list.forEach((appointment) => {
    const when = toDate(appointment.scheduledTime);
    const isCancelled = CANCELLED_APPOINTMENT.test(String(appointment.status || ""));
    if (when && when.getTime() >= cutoff && !isCancelled) upcoming.push(appointment);
    else previous.push(appointment);
  });

  upcoming.sort((a, b) => new Date(a.scheduledTime || 0) - new Date(b.scheduledTime || 0));
  return { upcoming, previous };
};

/* ==========================================================================
   Files
   ========================================================================== */

const fileKind = (file) => {
  const type = String(file?.file_type || "").toLowerCase();
  if (type.startsWith("image/")) return "photo";
  if (type.startsWith("video/")) return "video";
  return "document";
};

export const FILE_KIND_LABELS = {
  photo: "Photos",
  video: "Videos",
  document: "Documents",
};

export const buildCustomerFiles = (jobs = []) =>
  jobs
    .flatMap((job) =>
      asRows(job.job_files).map((file) => ({
        id: `${job.id}-${file.file_id}`,
        fileId: file.file_id,
        name: file.file_name || "Uploaded file",
        url: file.file_url,
        mimeType: file.file_type || null,
        kind: fileKind(file),
        folder: file.folder || null,
        uploadedAt: file.uploaded_at || null,
        uploadedBy: file.uploaded_by || null,
        jobId: job.id,
        jobNumber: job.job_number,
        vehicle: appointmentVehicle(job),
      }))
    )
    .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));

export const FILE_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "File name (A–Z)" },
  { value: "job", label: "Job number" },
];

export const filterCustomerFiles = (files = [], { search = "", kind = "all", job = "all", sort = "newest" } = {}) => {
  const term = search.trim().toLowerCase();

  const filtered = files.filter((file) => {
    if (kind !== "all" && file.kind !== kind) return false;
    if (job !== "all" && String(file.jobNumber) !== String(job)) return false;
    if (!term) return true;
    return [file.name, file.jobNumber, file.vehicle, file.folder]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const sorted = [...filtered];
  if (sort === "oldest") sorted.sort((a, b) => new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0));
  else if (sort === "name") sorted.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  else if (sort === "job") sorted.sort((a, b) => String(b.jobNumber || "").localeCompare(String(a.jobNumber || "")));
  else sorted.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));

  return sorted;
};

/** Group a file list by job number so a long list stays navigable. */
export const groupFilesByJob = (files = []) => {
  const groups = new Map();
  files.forEach((file) => {
    const key = file.jobNumber || "Unlinked";
    if (!groups.has(key)) groups.set(key, { jobNumber: key, vehicle: file.vehicle, files: [] });
    groups.get(key).files.push(file);
  });
  return Array.from(groups.values());
};

/* ==========================================================================
   Vehicles
   ========================================================================== */

export const describeVehicle = (vehicle) => ({
  id: vehicle?.vehicle_id,
  registration: getVehicleRegistration(vehicle, "Unregistered"),
  makeModel:
    vehicle?.make_model || [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle",
  year: vehicle?.year || null,
  colour: vehicle?.colour || null,
  vin: vehicle?.vin || vehicle?.chassis || null,
  mileage: vehicle?.mileage ?? null,
  fuel: vehicle?.fuel_type || null,
  transmission: vehicle?.transmission || null,
  bodyStyle: vehicle?.body_style || null,
  engine: vehicle?.engine || (vehicle?.engine_capacity ? `${vehicle.engine_capacity} cc` : null),
  motDue: vehicle?.mot_due || null,
  taxStatus: vehicle?.tax_status || null,
  taxDue: vehicle?.tax_due_date || null,
  serviceHistory: vehicle?.service_history || null,
  servicePlan:
    [vehicle?.service_plan_supplier, vehicle?.service_plan_type].filter(Boolean).join(" · ") || null,
  servicePlanExpiry: vehicle?.service_plan_expiry || null,
  warrantyType: vehicle?.warranty_type || null,
  warrantyExpiry: vehicle?.warranty_expiry || null,
  leaseCo: vehicle?.lease_co || null,
});

/** MOT / tax / warranty / service-plan warnings for one vehicle. */
export const buildVehicleWarnings = (vehicle, now = new Date()) => {
  const details = describeVehicle(vehicle);
  const warnings = [];

  const expiry = (value, label, warnWithinDays = 30) => {
    const days = daysBetween(value, now);
    if (days === null) return;
    if (days < 0) warnings.push({ tone: "danger", label: `${label} expired`, detail: formatDate(value) });
    else if (days <= warnWithinDays)
      warnings.push({ tone: "warning", label: `${label} due ${formatRelativeDay(value, now)}`, detail: formatDate(value) });
  };

  expiry(details.motDue, "MOT");
  expiry(details.taxDue, "Tax");
  expiry(details.warrantyExpiry, "Warranty", 60);
  expiry(details.servicePlanExpiry, "Service plan", 60);

  if (details.taxStatus && !/taxed/i.test(details.taxStatus)) {
    warnings.push({ tone: "warning", label: `Tax: ${details.taxStatus}`, detail: null });
  }

  return warnings;
};

/* ==========================================================================
   Summary figures
   ========================================================================== */

const jobDate = (job) => job?.completed_at || job?.checked_in_at || job?.created_at || null;

export const buildCustomerSummary = ({
  customer = null,
  vehicles = [],
  jobs = [],
  invoices = [],
  appointments = [],
  accounts = [],
  activityEvents = [],
  now = new Date(),
} = {}) => {
  const nowMs = toDate(now).getTime();

  const openJobs = jobs.filter((job) => job?.status && !isInactiveJobStatus(job.status));

  const lifetimeSpend = invoices.reduce((sum, invoice) => sum + getInvoicePaid(invoice), 0);
  const invoicedTotal = invoices.reduce(
    (sum, invoice) => sum + (isInvoiceCancelled(invoice.payment_status) ? 0 : getInvoiceTotal(invoice)),
    0
  );
  const outstandingBalance = invoices.reduce((sum, invoice) => sum + getInvoiceOutstanding(invoice), 0);
  const overdueInvoices = invoices.filter((invoice) => isInvoiceOverdue(invoice, now));

  const accountBalance = accounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
  const creditLimit = accounts.reduce((sum, account) => sum + (Number(account.credit_limit) || 0), 0);

  const pastJobs = jobs
    .map(jobDate)
    .filter((value) => {
      const date = toDate(value);
      return date && date.getTime() <= nowMs;
    })
    .sort((a, b) => new Date(b) - new Date(a));

  const nextBooking = appointments
    .filter((appointment) => {
      const when = toDate(appointment.scheduledTime);
      return when && when.getTime() >= nowMs && !CANCELLED_APPOINTMENT.test(String(appointment.status || ""));
    })
    .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))[0] || null;

  // Last contact = the most recent two-way touchpoint we have a record of:
  // a portal/staff activity event, or a note written on one of their jobs.
  const contactMoments = [
    ...activityEvents.map((event) => event.occurred_at),
    ...jobs.flatMap((job) => asRows(job.job_notes).map((note) => note.created_at)),
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a));

  return {
    customerSince: customer?.created_at || null,
    vehicleCount: vehicles.length,
    totalJobs: jobs.length,
    openJobs: openJobs.length,
    lifetimeSpend,
    invoicedTotal,
    outstandingBalance,
    overdueCount: overdueInvoices.length,
    accountBalance,
    creditLimit,
    accountNumbers: accounts.map((account) => account.account_id).filter(Boolean),
    accountType: accounts[0]?.account_type || null,
    accountStatus: accounts[0]?.status || null,
    lastVisit: pastJobs[0] || null,
    nextBooking,
    lastContact: contactMoments[0] || null,
    openJobList: openJobs,
  };
};

/* ==========================================================================
   Alerts
   ========================================================================== */

/** "1 overdue invoice" / "3 overdue invoices" — no "(s)" in staff-facing copy. */
const plural = (count, singular, pluralForm) =>
  `${count} ${count === 1 ? singular : pluralForm || `${singular}s`}`;

/** Sort order for the attention panel: act on danger before info. */
const ALERT_TONE_RANK = { danger: 0, warning: 1, info: 2, success: 3 };

export const buildCustomerAlerts = ({
  customer = null,
  vehicles = [],
  jobs = [],
  invoices = [],
  summary = null,
  duplicates = [],
  activityEvents = [],
  now = new Date(),
} = {}) => {
  const alerts = [];

  if (summary?.overdueCount) {
    alerts.push({
      id: "overdue-invoices",
      tone: "danger",
      category: "Money",
      title: plural(summary.overdueCount, "overdue invoice"),
      detail: `${formatCurrency(summary.outstandingBalance)} outstanding.`,
      action: { label: "Open payments", tab: "payments" },
    });
  } else if (summary?.outstandingBalance > 0) {
    alerts.push({
      id: "outstanding-balance",
      tone: "warning",
      category: "Money",
      title: "Balance outstanding",
      detail: `${formatCurrency(summary.outstandingBalance)} across ${plural(
        invoices.filter((invoice) => getInvoiceOutstanding(invoice) > 0).length,
        "invoice"
      )}.`,
      action: { label: "Open payments", tab: "payments" },
    });
  }

  if (summary?.creditLimit > 0 && summary.accountBalance > summary.creditLimit) {
    alerts.push({
      id: "credit-limit",
      tone: "danger",
      category: "Money",
      title: "Account over credit limit",
      detail: `${formatCurrency(summary.accountBalance)} against a ${formatCurrency(
        summary.creditLimit
      )} limit.`,
      action: { label: "Open payments", tab: "payments" },
    });
  }

  vehicles.forEach((vehicle) => {
    const details = describeVehicle(vehicle);
    buildVehicleWarnings(vehicle, now)
      .filter((warning) => warning.tone === "danger")
      .forEach((warning) => {
        alerts.push({
          id: `vehicle-${details.id}-${warning.label}`,
          tone: "danger",
          category: details.registration,
          title: warning.label,
          detail: warning.detail,
          // Send staff to this vehicle's own history rather than the whole record.
          action: { label: "Vehicle history", tab: "history", search: details.registration },
        });
      });
  });

  // VHC work the customer has been asked to authorise and has not answered.
  jobs.forEach((job) => {
    const checks = asRows(job?.vhc_checks);
    if (!checks.length) return;
    const vhc = getVhcSummary(checks, { job, partsJobItems: asRows(job.parts_job_items) });
    if (vhc.hasAwaitingCustomer) {
      alerts.push({
        id: `vhc-awaiting-${job.id}`,
        tone: "warning",
        category: `Job ${job.job_number}`,
        title: "VHC awaiting customer",
        detail: `${plural(vhc.counts.byWorkflow.awaiting_customer, "item")} not yet authorised.`,
        action: job.job_number
          ? { label: "Open job card", href: `/job-cards/${encodeURIComponent(job.job_number)}` }
          : null,
      });
    }
  });

  // Portal requests nobody has picked up.
  const openRequests = activityEvents.filter(
    (event) => ACTIONABLE_ACTIVITY_TYPES.has(event.activity_type) && event.activity_source === "customer_portal"
  );
  if (openRequests.length) {
    alerts.push({
      id: "portal-requests",
      tone: "info",
      category: "Portal",
      title: `${plural(openRequests.length, "request")} logged`,
      detail: "Raised by the customer online — check nothing is still to action.",
      action: { label: "Open activity", tab: "activity" },
    });
  }

  if (duplicates.length) {
    alerts.push({
      id: "duplicates",
      tone: "warning",
      category: "Record",
      title: `${plural(duplicates.length, "possible duplicate record")}`,
      detail: "Same email, phone number, or surname and postcode.",
      // The panel lists the matching records itself, so no action link here.
      action: null,
    });
  }

  const missing = [];
  if (!String(customer?.email || "").trim()) missing.push("email");
  if (!String(customer?.mobile || "").trim() && !String(customer?.telephone || "").trim())
    missing.push("phone number");
  if (!String(customer?.address || "").trim()) missing.push("address");
  if (missing.length) {
    alerts.push({
      id: "missing-contact",
      tone: "info",
      category: "Record",
      title: "Incomplete contact details",
      detail: `No ${missing.join(", ")} on file.`,
    });
  }

  // Most urgent first, so the panel reads top-down in the order staff should act.
  return alerts.sort((a, b) => ALERT_TONE_RANK[a.tone] - ALERT_TONE_RANK[b.tone]);
};

/* ==========================================================================
   Activity vocabulary
   ========================================================================== */

export const ACTIVITY_TYPE_LABELS = {
  vehicle_added: "Vehicle added",
  mileage_self_reported: "Mileage reading submitted",
  notification_prefs_updated: "Notification preferences updated",
  booking_request: "Service booking requested",
  message_customer: "Message sent from portal",
  payment_link_requested: "Payment link requested",
  statement_requested: "Statement requested",
  invoice_pdf_requested: "Invoice PDF requested",
  service_history_requested: "Service history pack requested",
  data_export_requested: "Data export requested",
  account_deletion_requested: "Account deletion requested",
  valuation_request: "Valuation requested",
  body_repair_request: "Body repair quote requested",
  smart_repair_request: "SMART repair quote requested",
  valet_request: "Valet requested",
  parts_enquiry: "Parts enquiry",
  vehicle_callback_request: "Callback requested",
  finance_quote_request: "Finance quote requested",
  test_drive_request: "Test drive requested",
  motability_enquiry: "Motability enquiry",
  warranty_claim: "Warranty claim",
  vehicle_add_request: "Vehicle add request",
  vhc_reauthorise_request: "VHC re-authorisation requested",
  referral: "Friend referral",
  // Staff-written entries (see logCustomerActivity).
  staff_contact_log: "Contact logged",
  staff_note: "Internal note",
  customer_details_updated: "Customer details updated",
  contact_preference_updated: "Preferred contact method changed",
  statement_sent: "Statement sent",
  payment_link_sent: "Payment link sent",
  receipt_sent: "Receipt sent",
};

export const ACTIVITY_SOURCE_LABELS = {
  customer_portal: "Customer portal",
  staff: "Staff",
  system: "System",
};

// Requests staff still need to action, as opposed to passive log entries.
export const ACTIONABLE_ACTIVITY_TYPES = new Set([
  "booking_request",
  "message_customer",
  "payment_link_requested",
  "statement_requested",
  "invoice_pdf_requested",
  "service_history_requested",
  "data_export_requested",
  "account_deletion_requested",
  "valuation_request",
  "body_repair_request",
  "smart_repair_request",
  "valet_request",
  "parts_enquiry",
  "vehicle_callback_request",
  "finance_quote_request",
  "test_drive_request",
  "motability_enquiry",
  "warranty_claim",
  "vehicle_add_request",
  "vhc_reauthorise_request",
  "referral",
]);

// The types the staff contact log writes. Kept separate so the Overview tab can
// show "recent contact" without the portal noise.
export const CONTACT_LOG_TYPES = new Set(["staff_contact_log", "staff_note"]);

export const formatActivityType = (type) =>
  ACTIVITY_TYPE_LABELS[type] ||
  String(type || "Activity").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const formatActivitySource = (source) =>
  ACTIVITY_SOURCE_LABELS[source] || (source ? String(source).replace(/_/g, " ") : "System");

export const summarizeActivityPayload = (payload) => {
  if (!payload || typeof payload !== "object") return [];
  return Object.entries(payload)
    .filter(
      ([key, value]) =>
        value !== null &&
        value !== undefined &&
        value !== "" &&
        key !== "job_id" &&
        key !== "vehicle_id" &&
        key !== "note"
    )
    .map(([key, value]) => ({
      label: key.replace(/_/g, " "),
      value:
        typeof value === "boolean"
          ? value
            ? "Yes"
            : "No"
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value),
    }));
};

/* ==========================================================================
   Timelines
   ========================================================================== */

export const HISTORY_FILTERS = [
  { value: "all", label: "Everything" },
  { value: "job", label: "Jobs" },
  { value: "appointment", label: "Appointments" },
  { value: "invoice", label: "Invoices" },
  { value: "payment", label: "Payments" },
  { value: "vhc", label: "VHC" },
  { value: "mot", label: "MOT" },
  { value: "warranty", label: "Warranty" },
  { value: "estimate", label: "Estimates" },
  { value: "vehicle", label: "Vehicle changes" },
];

const WARRANTY_RE = /warrant/i;
const MOT_RE = /\bmot\b/i;

/**
 * The full dealership history: everything that ever happened to this customer,
 * newest first, in one list the History tab can filter.
 *
 * Sources are all existing tables — jobs, appointments, invoices,
 * invoice_payments, vhc_checks, job_booking_requests (estimates), vehicles
 * (added / MOT recorded) and customer_activity_events.
 */
export const buildHistoryTimeline = ({
  jobs = [],
  invoices = [],
  appointments = [],
  vehicles = [],
  activityEvents = [],
} = {}) => {
  const entries = [];

  jobs.forEach((job) => {
    const vehicle = appointmentVehicle(job);
    const isWarranty = WARRANTY_RE.test(`${job.type || ""} ${job.job_division || ""}`);
    const isMot = MOT_RE.test(`${job.type || ""} ${describeJobWork(job) || ""}`);

    entries.push({
      id: `job-${job.id}`,
      kind: isWarranty ? "warranty" : isMot ? "mot" : "job",
      at: jobDate(job),
      tone: isInactiveJobStatus(job.status) ? "neutral" : "accent",
      title: `Job ${job.job_number}${job.type ? ` · ${job.type}` : ""}`,
      subtitle: describeJobWork(job),
      status: job.status || null,
      vehicle,
      jobNumber: job.job_number,
      jobId: job.id,
      fields: [
        { label: "Vehicle", value: vehicle },
        { label: "Mileage", value: formatMileage(pickMileageValue(job.mileage, job.milage)) },
        { label: "Advisor", value: staffName(job.advisor) },
        { label: "Technician", value: staffName(job.technician) },
        { label: "Source", value: job.job_source },
        { label: "Completed", value: job.completed_at ? formatDate(job.completed_at) : null },
      ],
    });

    // Estimates raised at booking.
    asRows(job.job_booking_requests).forEach((request) => {
      entries.push({
        id: `estimate-${request.request_id}`,
        kind: "estimate",
        at: request.submitted_at || request.created_at,
        tone: request.status === "approved" ? "success" : "warning",
        title: `Estimate for job ${job.job_number}`,
        subtitle: request.description,
        status: request.status,
        vehicle,
        jobNumber: job.job_number,
        jobId: job.id,
        fields: [
          { label: "Estimate", value: request.price_estimate != null ? formatCurrency(request.price_estimate) : null },
          { label: "Submitted by", value: request.submitted_by_name },
          { label: "Approved by", value: request.approved_by_name },
          { label: "Courtesy car", value: request.loan_car_details },
        ],
      });
    });

    // VHC: one entry per job, summarising the check.
    if (asRows(job.vhc_checks).length) {
      const vhc = getVhcSummary(asRows(job.vhc_checks), {
        job,
        partsJobItems: asRows(job.parts_job_items),
      });
      entries.push({
        id: `vhc-${job.id}`,
        kind: "vhc",
        at: job.vhc_completed_at || job.vhc_sent_at || jobDate(job),
        tone: vhc.hasAwaitingCustomer ? "warning" : "success",
        title: `Vehicle health check · job ${job.job_number}`,
        subtitle: `${vhc.counts.total} item(s) checked`,
        status: vhc.hasAwaitingCustomer ? "Awaiting customer" : "Complete",
        vehicle,
        jobNumber: job.job_number,
        jobId: job.id,
        fields: [
          { label: "Red", value: String(vhc.counts.byCondition.red) },
          { label: "Amber", value: String(vhc.counts.byCondition.amber) },
          { label: "Green", value: String(vhc.counts.byCondition.green) },
          { label: "Authorised", value: String(vhc.counts.byWorkflow.approved) },
          { label: "Declined", value: String(vhc.counts.byWorkflow.declined) },
        ],
      });
    }
  });

  appointments.forEach((appointment) => {
    entries.push({
      id: `appointment-${appointment.id}`,
      kind: "appointment",
      at: appointment.scheduledTime,
      tone: CANCELLED_APPOINTMENT.test(String(appointment.status || "")) ? "danger" : "accent",
      title: `Appointment${appointment.jobNumber ? ` · job ${appointment.jobNumber}` : ""}`,
      subtitle: appointment.workRequested || appointment.notes,
      status: appointment.status,
      vehicle: appointment.vehicle,
      jobNumber: appointment.jobNumber,
      jobId: appointment.jobId,
      fields: [
        { label: "Time", value: formatTime(appointment.scheduledTime) },
        { label: "Advisor", value: appointment.advisor },
        { label: "Technician", value: appointment.technician },
        { label: "Courtesy car", value: appointment.courtesyCar },
        { label: "Collection", value: appointment.collectionDelivery },
      ],
    });
  });

  invoices.forEach((invoice) => {
    entries.push({
      id: `invoice-${invoice.id || invoice.invoice_id}`,
      kind: "invoice",
      at: invoice.invoice_date || invoice.created_at,
      tone: getInvoiceOutstanding(invoice) > 0 ? "warning" : "success",
      title: `Invoice ${invoice.invoice_number || invoice.invoice_id || ""}`.trim(),
      subtitle: invoice.jobNumber ? `Job ${invoice.jobNumber}` : null,
      status: invoice.payment_status || (invoice.paid ? "Paid" : "Open"),
      vehicle: invoice.vehicle,
      jobNumber: invoice.jobNumber,
      jobId: invoice.jobId,
      invoiceId: invoice.id || invoice.invoice_id,
      fields: [
        { label: "Total", value: formatCurrency(getInvoiceTotal(invoice)) },
        { label: "Paid", value: formatCurrency(getInvoicePaid(invoice)) },
        { label: "Outstanding", value: formatCurrency(getInvoiceOutstanding(invoice)) },
        { label: "Due", value: invoice.due_date ? formatDate(invoice.due_date) : null },
      ],
    });

    asRows(invoice.invoice_payments).forEach((payment) => {
      entries.push({
        id: `payment-${payment.payment_id}`,
        kind: "payment",
        at: payment.payment_date || payment.created_at,
        tone: "success",
        title: `Payment received ${formatCurrency(payment.amount)}`,
        subtitle: invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : null,
        status: payment.payment_method || null,
        vehicle: invoice.vehicle,
        jobNumber: invoice.jobNumber,
        jobId: invoice.jobId,
        fields: [
          { label: "Method", value: payment.payment_method },
          { label: "Reference", value: payment.reference },
        ],
      });
    });
  });

  vehicles.forEach((vehicle) => {
    const details = describeVehicle(vehicle);
    entries.push({
      id: `vehicle-${details.id}`,
      kind: "vehicle",
      at: vehicle.created_at,
      tone: "neutral",
      title: `${details.registration} added to the record`,
      subtitle: details.makeModel,
      status: null,
      vehicle: details.registration,
      fields: [
        { label: "Year", value: details.year ? String(details.year) : null },
        { label: "Fuel", value: details.fuel },
        { label: "MOT due", value: details.motDue ? formatDate(details.motDue) : null },
      ],
    });

    if (details.motDue) {
      entries.push({
        id: `mot-${details.id}`,
        kind: "mot",
        at: details.motDue,
        tone: daysBetween(details.motDue) < 0 ? "danger" : "warning",
        title: `MOT expiry · ${details.registration}`,
        subtitle: details.makeModel,
        status: daysBetween(details.motDue) < 0 ? "Expired" : "Due",
        vehicle: details.registration,
        fields: [{ label: "Expires", value: formatDate(details.motDue) }],
      });
    }
  });

  // Anything the portal or staff recorded that is not already covered above.
  activityEvents
    .filter((event) => event.activity_type === "vehicle_added" || CONTACT_LOG_TYPES.has(event.activity_type))
    .forEach((event) => {
      entries.push({
        id: `activity-${event.event_id}`,
        kind: event.activity_type === "vehicle_added" ? "vehicle" : "job",
        at: event.occurred_at,
        tone: "neutral",
        title: formatActivityType(event.activity_type),
        subtitle: event.activity_payload?.note || null,
        status: formatActivitySource(event.activity_source),
        fields: summarizeActivityPayload(event.activity_payload).slice(0, 4),
      });
    });

  return entries
    .filter((entry) => entry.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
};

export const filterTimeline = (entries = [], { kind = "all", search = "" } = {}) => {
  const term = search.trim().toLowerCase();
  return entries.filter((entry) => {
    if (kind !== "all" && entry.kind !== kind) return false;
    if (!term) return true;
    return [entry.title, entry.subtitle, entry.vehicle, entry.jobNumber, entry.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });
};

export const ACTIVITY_FILTERS = [
  { value: "all", label: "All activity" },
  { value: "actionable", label: "Needs action" },
  { value: "customer_portal", label: "Customer portal" },
  { value: "staff", label: "Staff" },
];

export const buildActivityTimeline = ({ activityEvents = [], vehicles = [], jobs = [] } = {}) => {
  const regByVehicleId = new Map(
    vehicles
      .filter((vehicle) => vehicle?.vehicle_id != null)
      .map((vehicle) => [String(vehicle.vehicle_id), getVehicleRegistration(vehicle, "")])
  );
  const jobNumberById = new Map(jobs.map((job) => [String(job.id), job.job_number]));

  return activityEvents
    .map((event) => ({
      id: event.event_id,
      at: event.occurred_at,
      type: event.activity_type,
      title: formatActivityType(event.activity_type),
      source: event.activity_source || "system",
      sourceLabel: formatActivitySource(event.activity_source),
      actionable: ACTIONABLE_ACTIVITY_TYPES.has(event.activity_type),
      tone: ACTIONABLE_ACTIVITY_TYPES.has(event.activity_type)
        ? "warning"
        : event.activity_source === "staff"
          ? "accent"
          : "neutral",
      author: staffName(event.creator),
      note: event.activity_payload?.note || null,
      vehicle: event.vehicle_id != null ? regByVehicleId.get(String(event.vehicle_id)) || null : null,
      jobNumber: event.job_id != null ? jobNumberById.get(String(event.job_id)) || null : null,
      fields: summarizeActivityPayload(event.activity_payload),
    }))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
};

export const filterActivity = (entries = [], { filter = "all", search = "" } = {}) => {
  const term = search.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filter === "actionable" && !entry.actionable) return false;
    if (filter === "customer_portal" && entry.source !== "customer_portal") return false;
    if (filter === "staff" && entry.source !== "staff") return false;
    if (!term) return true;
    return [entry.title, entry.note, entry.vehicle, entry.jobNumber, entry.author]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });
};

/* ==========================================================================
   Payments tab
   ========================================================================== */

export const splitInvoicesByStatus = (invoices = [], now = new Date()) => {
  const outstanding = [];
  const settled = [];
  invoices.forEach((invoice) => {
    if (getInvoiceOutstanding(invoice) > 0) outstanding.push(invoice);
    else settled.push(invoice);
  });
  outstanding.sort((a, b) => {
    const overdueDiff = Number(isInvoiceOverdue(b, now)) - Number(isInvoiceOverdue(a, now));
    if (overdueDiff !== 0) return overdueDiff;
    return new Date(a.due_date || a.invoice_date || 0) - new Date(b.due_date || b.invoice_date || 0);
  });
  return { outstanding, settled };
};

export const describeInvoiceStatus = (invoice, now = new Date()) => {
  if (isInvoiceCancelled(invoice?.payment_status)) return { label: "Cancelled", tone: "neutral" };
  if (isInvoiceOverdue(invoice, now)) return { label: "Overdue", tone: "danger" };
  if (getInvoiceOutstanding(invoice) > 0) {
    return getInvoicePaid(invoice) > 0
      ? { label: "Part paid", tone: "warning" }
      : { label: invoice?.payment_status || "Unpaid", tone: "warning" };
  }
  if (isInvoiceSettled(invoice?.payment_status) || invoice?.paid) return { label: "Paid", tone: "success" };
  return { label: invoice?.payment_status || "Open", tone: "neutral" };
};
