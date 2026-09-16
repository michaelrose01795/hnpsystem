// file location: src/lib/customers/customerHubModel.test.js
// Unit tests for the customer record hub's derivation layer. Everything here is
// pure, so the whole record can be asserted without a database or a browser.

import { describe, expect, it } from "vitest";

import {
  asRows,
  buildAppointments,
  buildContactChannels,
  buildCustomerAlerts,
  buildCustomerFiles,
  buildCustomerSummary,
  buildHistoryTimeline,
  buildVehicleWarnings,
  describeInvoiceStatus,
  describeJobWork,
  filterActivity,
  filterCustomerFiles,
  filterTimeline,
  getInvoiceOutstanding,
  getInvoicePaid,
  getInvoiceTotal,
  isInvoiceOverdue,
  mergeCustomerInvoices,
  splitAppointments,
  splitInvoicesByStatus,
} from "./customerHubModel";

const NOW = new Date("2026-06-15T09:00:00.000Z");

const iso = (days, hours = 0) =>
  new Date(NOW.getTime() + days * 86400000 + hours * 3600000).toISOString();

const customer = {
  id: "11111111-2222-3333-4444-555555555555",
  firstname: "Dana",
  lastname: "Okafor",
  email: "dana@example.com",
  mobile: "07700900123",
  telephone: "01792000000",
  address: "1 Mill Lane",
  postcode: "SA1 1AA",
  contact_preference: "sms",
  created_at: "2021-03-02T10:00:00.000Z",
};

const vehicles = [
  {
    vehicle_id: 7,
    reg_number: "CV21 ABC",
    make: "Ford",
    model: "Kuga",
    year: 2021,
    vin: "WF0AXXTTGA",
    mileage: 41250,
    fuel_type: "Diesel",
    transmission: "Automatic",
    mot_due: iso(-4),
    tax_status: "Taxed",
    warranty_type: "Manufacturer",
    warranty_expiry: iso(20),
    created_at: "2021-03-02T10:05:00.000Z",
  },
];

const invoiceRows = [
  {
    id: "inv-1",
    invoice_number: "INV-1001",
    job_id: 900,
    invoice_total: 480,
    due_date: iso(-10),
    invoice_date: iso(-40),
    payment_status: "Unpaid",
    invoice_payments: [],
  },
  {
    id: "inv-2",
    invoice_number: "INV-1002",
    job_id: 901,
    invoice_total: 300,
    invoice_date: iso(-120),
    payment_status: "Paid",
    paid: true,
    invoice_payments: [
      { payment_id: "pay-1", amount: 300, payment_method: "Card", payment_date: iso(-119) },
    ],
  },
];

const jobs = [
  {
    id: 900,
    job_number: "J-900",
    type: "Service",
    status: "In Progress",
    vehicle_reg: "CV21 ABC",
    vehicle_make_model: "Ford Kuga",
    created_at: iso(-40),
    checked_in_at: iso(-40),
    job_requests: [{ description: "Full service" }, { description: "Brake pads" }],
    appointments: [{ appointment_id: 1, scheduled_time: iso(-40), status: "attended" }],
    job_files: [
      {
        file_id: 11,
        file_name: "brake-wear.jpg",
        file_url: "https://files.example/brake-wear.jpg",
        file_type: "image/jpeg",
        uploaded_at: iso(-39),
      },
      {
        file_id: 12,
        file_name: "invoice.pdf",
        file_url: "https://files.example/invoice.pdf",
        file_type: "application/pdf",
        uploaded_at: iso(-38),
      },
    ],
    invoices: [invoiceRows[0]],
    job_notes: [{ note_id: 5, created_at: iso(-2), note_text: "Called customer" }],
  },
  {
    id: 901,
    job_number: "J-901",
    type: "MOT",
    status: "Released",
    vehicle_reg: "CV21 ABC",
    completed_at: iso(-120),
    created_at: iso(-125),
    requests: JSON.stringify(["MOT test"]),
    invoices: [invoiceRows[1]],
  },
];

const customerAppointments = [
  {
    appointment_id: 2,
    job_id: 902,
    scheduled_time: iso(5, 2),
    status: "booked",
    notes: "Drop off 8am",
    job: {
      id: 902,
      job_number: "J-902",
      type: "Service",
      status: "Booked",
      service_mode: "workshop",
      vehicle_reg: "CV21 ABC",
      advisor: { first_name: "Sam", last_name: "Price" },
      technician: { first_name: "Ali", last_name: "Khan" },
      job_requests: [{ description: "Interim service" }],
      job_booking_requests: [{ request_id: 1, loan_car_details: "Fiesta courtesy car", price_estimate: 210 }],
    },
  },
];

describe("invoice arithmetic", () => {
  it("reads the total from whichever total column is populated", () => {
    expect(getInvoiceTotal({ invoice_total: 100, total: 5 })).toBe(100);
    expect(getInvoiceTotal({ grand_total: 60 })).toBe(60);
    expect(getInvoiceTotal({})).toBe(0);
  });

  it("sums payments and reports what is left", () => {
    const partial = { invoice_total: 200, invoice_payments: [{ amount: 75 }] };
    expect(getInvoicePaid(partial)).toBe(75);
    expect(getInvoiceOutstanding(partial)).toBe(125);
  });

  it("treats a cancelled invoice as owing nothing", () => {
    expect(getInvoiceOutstanding({ invoice_total: 500, payment_status: "Cancelled" })).toBe(0);
  });

  it("flags an unpaid invoice past its due date as overdue", () => {
    expect(isInvoiceOverdue(invoiceRows[0], NOW)).toBe(true);
    expect(isInvoiceOverdue(invoiceRows[1], NOW)).toBe(false);
  });

  it("describes status for the badge", () => {
    expect(describeInvoiceStatus(invoiceRows[0], NOW)).toEqual({ label: "Overdue", tone: "danger" });
    expect(describeInvoiceStatus(invoiceRows[1], NOW).tone).toBe("success");
  });

  it("splits outstanding from settled, overdue first", () => {
    const { outstanding, settled } = splitInvoicesByStatus(invoiceRows, NOW);
    expect(outstanding.map((row) => row.id)).toEqual(["inv-1"]);
    expect(settled.map((row) => row.id)).toEqual(["inv-2"]);
  });
});

describe("mergeCustomerInvoices", () => {
  it("de-duplicates the customer-level and job-embedded reads and keeps job context", () => {
    const merged = mergeCustomerInvoices({ jobs, invoices: invoiceRows });
    expect(merged).toHaveLength(2);
    const first = merged.find((row) => row.id === "inv-1");
    expect(first.jobNumber).toBe("J-900");
    expect(first.vehicle).toBe("CV21 ABC");
  });

  it("does not lose payments recorded on only one of the two sources", () => {
    const merged = mergeCustomerInvoices({
      jobs: [{ id: 1, job_number: "J-1", invoices: [{ id: "inv-3", invoice_payments: [] }] }],
      invoices: [{ id: "inv-3", invoice_payments: [{ payment_id: "p", amount: 40 }] }],
    });
    expect(getInvoicePaid(merged[0])).toBe(40);
  });
});

describe("appointments", () => {
  const merged = buildAppointments({ jobs, appointments: customerAppointments });

  it("merges both sources and pulls the job's detail through", () => {
    const upcoming = merged.find((row) => row.appointmentId === 2);
    expect(upcoming.vehicle).toBe("CV21 ABC");
    expect(upcoming.workRequested).toBe("Interim service");
    expect(upcoming.advisor).toBe("Sam Price");
    expect(upcoming.technician).toBe("Ali Khan");
    expect(upcoming.courtesyCar).toBe("Fiesta courtesy car");
  });

  it("splits future from past and excludes cancelled from upcoming", () => {
    const { upcoming, previous } = splitAppointments(
      [
        ...merged,
        { id: "x", appointmentId: 99, scheduledTime: iso(3), status: "cancelled" },
      ],
      NOW
    );
    expect(upcoming.map((row) => row.appointmentId)).toEqual([2]);
    expect(previous.some((row) => row.appointmentId === 99)).toBe(true);
  });
});

describe("files", () => {
  const files = buildCustomerFiles(jobs);

  it("classifies by mime type and carries job context", () => {
    expect(files.map((file) => file.kind).sort()).toEqual(["document", "photo"]);
    expect(files.every((file) => file.jobNumber === "J-900")).toBe(true);
  });

  it("filters by kind and search term", () => {
    expect(filterCustomerFiles(files, { kind: "photo" })).toHaveLength(1);
    expect(filterCustomerFiles(files, { search: "invoice" })).toHaveLength(1);
    expect(filterCustomerFiles(files, { search: "nothing-here" })).toHaveLength(0);
  });
});

describe("vehicles", () => {
  it("raises a danger warning for an expired MOT and a warning for a near warranty expiry", () => {
    const warnings = buildVehicleWarnings(vehicles[0], NOW);
    expect(warnings.some((w) => w.tone === "danger" && /MOT/.test(w.label))).toBe(true);
    expect(warnings.some((w) => w.tone === "warning" && /Warranty/.test(w.label))).toBe(true);
  });
});

describe("buildCustomerSummary", () => {
  const invoices = mergeCustomerInvoices({ jobs, invoices: invoiceRows });
  const appointments = buildAppointments({ jobs, appointments: customerAppointments });
  const summary = buildCustomerSummary({
    customer,
    vehicles,
    jobs,
    invoices,
    appointments,
    accounts: [{ account_id: "ACC-1", account_type: "Trade", status: "Active", balance: 480, credit_limit: 1000 }],
    activityEvents: [{ occurred_at: iso(-1), activity_type: "booking_request" }],
    now: NOW,
  });

  it("counts jobs and separates the live ones", () => {
    expect(summary.totalJobs).toBe(2);
    expect(summary.openJobs).toBe(1);
    expect(summary.openJobList[0].job_number).toBe("J-900");
  });

  it("reports lifetime spend as money actually received and the balance as money still owed", () => {
    expect(summary.lifetimeSpend).toBe(300);
    expect(summary.outstandingBalance).toBe(480);
    expect(summary.overdueCount).toBe(1);
  });

  it("finds the next booking and the last visit", () => {
    expect(summary.nextBooking.appointmentId).toBe(2);
    expect(new Date(summary.lastVisit).getTime()).toBeLessThan(NOW.getTime());
  });

  it("takes last contact from the most recent touchpoint of any kind", () => {
    // The job note at -2 days is older than the activity event at -1 day.
    expect(summary.lastContact).toBe(iso(-1));
  });
});

describe("buildCustomerAlerts", () => {
  const invoices = mergeCustomerInvoices({ jobs, invoices: invoiceRows });
  const summary = buildCustomerSummary({
    customer,
    vehicles,
    jobs,
    invoices,
    appointments: [],
    accounts: [],
    activityEvents: [],
    now: NOW,
  });

  it("warns about overdue money, an expired MOT and duplicate records", () => {
    const alerts = buildCustomerAlerts({
      customer,
      vehicles,
      jobs,
      invoices,
      summary,
      duplicates: [{ id: "other" }],
      activityEvents: [],
      now: NOW,
    });
    const ids = alerts.map((alert) => alert.id);
    expect(ids).toContain("overdue-invoices");
    expect(ids).toContain("duplicates");
    expect(ids.some((id) => id.startsWith("vehicle-7"))).toBe(true);
  });

  it("orders most urgent first and gives each alert the action that resolves it", () => {
    const alerts = buildCustomerAlerts({
      customer,
      vehicles,
      jobs,
      invoices,
      summary,
      duplicates: [],
      activityEvents: [
        { event_id: "e1", activity_type: "booking_request", activity_source: "customer_portal", occurred_at: iso(-1) },
      ],
      now: NOW,
    });

    const rank = { danger: 0, warning: 1, info: 2 };
    const ranks = alerts.map((alert) => rank[alert.tone]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);

    expect(alerts.find((a) => a.id === "overdue-invoices").action).toEqual({
      label: "Open payments",
      tab: "payments",
    });
    expect(alerts.find((a) => a.id === "portal-requests").action).toEqual({
      label: "Open activity",
      tab: "activity",
    });
    // A vehicle alert filters History to that registration rather than navigating away.
    const vehicleAlert = alerts.find((a) => a.id.startsWith("vehicle-7"));
    expect(vehicleAlert.action).toEqual({
      label: "Vehicle history",
      tab: "history",
      search: "CV21 ABC",
    });
    expect(vehicleAlert.category).toBe("CV21 ABC");
  });

  it("writes counts as real English, not '1 item(s)'", () => {
    const one = buildCustomerAlerts({
      customer,
      summary,
      duplicates: [{ id: "d1" }],
      activityEvents: [
        { event_id: "e1", activity_type: "booking_request", activity_source: "customer_portal", occurred_at: iso(-1) },
      ],
      now: NOW,
    });
    expect(one.find((a) => a.id === "overdue-invoices").title).toBe("1 overdue invoice");
    expect(one.find((a) => a.id === "portal-requests").title).toBe("1 request logged");
    expect(one.find((a) => a.id === "duplicates").title).toBe("1 possible duplicate record");

    const many = buildCustomerAlerts({
      customer,
      summary,
      duplicates: [{ id: "d1" }, { id: "d2" }],
      activityEvents: [
        { event_id: "e1", activity_type: "booking_request", activity_source: "customer_portal", occurred_at: iso(-1) },
        { event_id: "e2", activity_type: "valet_request", activity_source: "customer_portal", occurred_at: iso(-2) },
      ],
      now: NOW,
    });
    expect(many.find((a) => a.id === "portal-requests").title).toBe("2 requests logged");
    expect(many.find((a) => a.id === "duplicates").title).toBe("2 possible duplicate records");
  });

  it("flags missing contact details", () => {
    const alerts = buildCustomerAlerts({
      customer: { id: "x", firstname: "No", lastname: "Contact" },
      summary: { outstandingBalance: 0 },
      now: NOW,
    });
    const missing = alerts.find((alert) => alert.id === "missing-contact");
    expect(missing.detail).toContain("email");
    expect(missing.detail).toContain("phone number");
  });
});

describe("history timeline", () => {
  const invoices = mergeCustomerInvoices({ jobs, invoices: invoiceRows });
  const appointments = buildAppointments({ jobs, appointments: customerAppointments });
  const entries = buildHistoryTimeline({ jobs, invoices, appointments, vehicles, activityEvents: [] });

  it("includes every source and orders newest first", () => {
    const kinds = new Set(entries.map((entry) => entry.kind));
    expect(kinds.has("job")).toBe(true);
    expect(kinds.has("mot")).toBe(true);
    expect(kinds.has("invoice")).toBe(true);
    expect(kinds.has("payment")).toBe(true);
    expect(kinds.has("appointment")).toBe(true);
    expect(kinds.has("vehicle")).toBe(true);

    const times = entries.map((entry) => new Date(entry.at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("filters by kind and free text", () => {
    expect(filterTimeline(entries, { kind: "payment" }).every((e) => e.kind === "payment")).toBe(true);
    expect(filterTimeline(entries, { search: "CV21" }).length).toBeGreaterThan(0);
    expect(filterTimeline(entries, { search: "zzzz" })).toHaveLength(0);
  });
});

describe("activity", () => {
  const entries = [
    { id: "a", at: iso(-1), type: "booking_request", title: "Service booking requested", source: "customer_portal", actionable: true },
    { id: "b", at: iso(-2), type: "staff_note", title: "Internal note", source: "staff", actionable: false, note: "Left a message" },
  ];

  it("filters to what still needs doing, and by source", () => {
    expect(filterActivity(entries, { filter: "actionable" }).map((e) => e.id)).toEqual(["a"]);
    expect(filterActivity(entries, { filter: "staff" }).map((e) => e.id)).toEqual(["b"]);
    expect(filterActivity(entries, { search: "message" }).map((e) => e.id)).toEqual(["b"]);
  });
});

describe("to-one embedded relations", () => {
  // PostgREST returns a single object, not an array, for an embed whose foreign
  // key is UNIQUE — job_booking_requests.job_id is. Reading it as an array threw
  // "(job.job_booking_requests || []).forEach is not a function" on a real record.
  const bookingObject = {
    request_id: 77,
    status: 'approved',
    description: 'Second service',
    price_estimate: 310,
    loan_car_details: 'Ford Puma — CV24 HNP',
    submitted_by_name: 'Service Desk',
    submitted_at: iso(-2),
  };

  it("normalises objects, arrays, null and undefined", () => {
    expect(asRows([1, 2])).toEqual([1, 2]);
    expect(asRows({ a: 1 })).toEqual([{ a: 1 }]);
    expect(asRows(null)).toEqual([]);
    expect(asRows(undefined)).toEqual([]);
  });

  it("builds the estimate timeline entry when the booking arrives as an object", () => {
    const job = { ...jobs[0], job_booking_requests: bookingObject };
    const entries = buildHistoryTimeline({ jobs: [job] });
    const estimate = entries.find((entry) => entry.kind === "estimate");
    expect(estimate).toBeTruthy();
    expect(estimate.subtitle).toBe("Second service");
  });

  it("still reads the courtesy car off an object-shaped booking", () => {
    const job = { ...jobs[0], job_booking_requests: bookingObject };
    const [appointment] = buildAppointments({ jobs: [job] });
    expect(appointment.courtesyCar).toBe("Ford Puma — CV24 HNP");
    expect(appointment.estimate).toBe(310);
  });

  it("survives a whole record where every embed came back as a single object", () => {
    const job = {
      ...jobs[0],
      job_requests: { description: "Full service" },
      job_files: { file_id: 1, file_name: "a.jpg", file_type: "image/jpeg", uploaded_at: iso(-1) },
      job_notes: { note_id: 1, created_at: iso(-1) },
      appointments: { appointment_id: 41, scheduled_time: iso(-1), status: "attended" },
      invoices: { id: "inv-solo", invoice_total: 120, invoice_payments: { payment_id: "p1", amount: 120 } },
      job_booking_requests: bookingObject,
      delivery_stops: { id: "d1", status: "delivered" },
      vhc_checks: { vhc_id: 9, severity: "amber", approval_status: "pending" },
      parts_job_items: { id: "pj1", status: "on_order" },
    };

    expect(() => buildHistoryTimeline({ jobs: [job] })).not.toThrow();
    expect(describeJobWork(job)).toBe("Full service");
    expect(buildCustomerFiles([job])).toHaveLength(1);
    expect(buildAppointments({ jobs: [job] })).toHaveLength(1);

    const merged = mergeCustomerInvoices({ jobs: [job], invoices: [] });
    expect(merged).toHaveLength(1);
    expect(getInvoicePaid(merged[0])).toBe(120);

    expect(() =>
      buildCustomerAlerts({ customer, jobs: [job], invoices: merged, summary: { outstandingBalance: 0 }, now: NOW })
    ).not.toThrow();
  });
});

describe("misc derivations", () => {
  it("prefers structured job requests over the legacy jsonb blob", () => {
    expect(describeJobWork(jobs[0])).toBe("Full service • Brake pads");
    expect(describeJobWork(jobs[1])).toBe("MOT test");
  });

  it("marks the channel matching the stored preference, treating SMS as the mobile", () => {
    const channels = buildContactChannels(customer, "sms");
    expect(channels.find((channel) => channel.key === "mobile").preferred).toBe(true);
    expect(channels.find((channel) => channel.key === "email").preferred).toBe(false);
    expect(channels.find((channel) => channel.key === "email").href).toBe("mailto:dana@example.com");
  });
});
