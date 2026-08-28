// file location: tools/scripts/seed-delivery-diary.js
//
// Seeds a realistic parts delivery diary for /deliveries.
//
//   npm run seed:deliveries          insert (or refresh) the seeded rows
//   npm run seed:deliveries -- --clear   remove them again
//
// Everything is linked to records that already exist: real customers (address,
// postcode, mobile), their real invoices (number, id, total, payment state),
// the workshop job and vehicle behind that invoice, real parts from
// parts_catalog, real trade accounts from company_accounts, and the real parts
// staff from users. Nothing here invents a customer or an invoice.
//
// Reversible by construction: every row id is a deterministic UUIDv5 derived
// from a fixed namespace plus a slot key, so --clear deletes exactly what this
// script wrote and nothing else. Re-running is an upsert, not a duplicate.

/* eslint-disable no-console */
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Deterministic ids
// ---------------------------------------------------------------------------
// UUIDv5 (SHA-1, name-based) so the same slot key always produces the same id.
// The namespace is arbitrary but fixed — it is what makes --clear exact.
const NAMESPACE = "6f1b5c9e-2f43-4a91-9c33-0d1a7a5e4b20";

function uuidv5(name, namespace) {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = crypto.createHash("sha1").update(nsBytes).update(Buffer.from(name, "utf8")).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const slotId = (slot) => uuidv5(`hnp:delivery-diary:${slot}`, NAMESPACE);

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
const pad = (value) => String(value).padStart(2, "0");
const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const shiftDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoDate(date);
};

const TODAY = isoDate(new Date());
const YESTERDAY = shiftDays(-1);
const TOMORROW = shiftDays(1);

// A local wall-clock timestamp on a given day, written as ISO with the offset
// the machine is in, so "delivered at 08:52" reads as 08:52 on the board.
const at = (day, time) => {
  const [hh, mm] = time.split(":").map(Number);
  const date = new Date(`${day}T00:00:00`);
  date.setHours(hh, mm, 0, 0);
  return date.toISOString();
};

// ---------------------------------------------------------------------------
// The van roster
// ---------------------------------------------------------------------------
// Written into the existing company_settings key the diary reads first, so the
// vehicle dropdown offers three vans rather than falling back to every
// registration ever typed into a delivery run.
const VANS = [
  { reg: "HN71 VAN", label: "HN71 VAN — Transit Custom" },
  { reg: "HP20 PTS", label: "HP20 PTS — Vivaro" },
  { reg: "GK19 HNP", label: "GK19 HNP — Caddy" },
];

// ---------------------------------------------------------------------------
// Trade stops — real rows from company_accounts
// ---------------------------------------------------------------------------
const TRADE_ACCOUNTS = ["CA3771", "CA6790", "CA4865", "CA8674"];

// ---------------------------------------------------------------------------
// Scenario templates
// ---------------------------------------------------------------------------
// Each slot describes one stop: where it is in the workflow, when it was
// planned, and the facts that make the board worth looking at (urgent, cores,
// missing items, payment due on the door, a failure with a reason).
const SLOTS = [
  // ---- today: a full day's run, mid-morning -----------------------------
  {
    slot: "today-1", day: () => TODAY, stop: 1, status: "delivered",
    plannedTime: "08:15", driver: 0, van: 0, packages: 1,
    podRecipient: "S. Hammond", podNotes: "Left with the service reception.",
    times: { picked: "07:35", ready: "07:50", loaded: "08:00", dispatched: "08:05", completed: "08:19" },
  },
  {
    slot: "today-2", day: () => TODAY, stop: 2, status: "delivered",
    plannedTime: "09:00", windowEnd: "10:00", driver: 0, van: 0, packages: 2,
    forceUnpaid: true, paidOnDoorstep: true,
    podRecipient: "J. Whitfield", podNotes: "Card payment taken on the door.",
    times: { picked: "07:35", ready: "07:52", loaded: "08:00", dispatched: "08:05", completed: "09:12" },
  },
  {
    slot: "today-3", day: () => TODAY, stop: 3, status: "failed",
    plannedTime: "09:40", driver: 0, van: 0, packages: 1, forceUnpaid: true,
    failedReason: "customer_closed",
    failedNotes: "Shutters down, no answer on the mobile. Re-book for tomorrow morning.",
    times: { picked: "07:35", ready: "07:55", loaded: "08:00", dispatched: "08:05", failed: "09:48" },
  },
  {
    slot: "today-4", day: () => TODAY, stop: 4, status: "out_for_delivery",
    plannedTime: "10:30", windowEnd: "11:30", driver: 0, van: 0, packages: 2,
    urgent: true, forceUnpaid: true,
    notes: "Customer is waiting on this one — car is on the ramp.",
    times: { picked: "07:35", ready: "07:58", loaded: "08:00", dispatched: "08:05" },
  },
  {
    slot: "today-5", day: () => TODAY, stop: 5, status: "out_for_delivery",
    plannedTime: "11:15", driver: 0, van: 0, packages: 1,
    coreExpected: true, surcharge: 85,
    notes: "Collect the old caliper — surcharge is on the invoice.",
    times: { picked: "07:35", ready: "08:00", loaded: "08:02", dispatched: "08:05" },
  },
  {
    slot: "today-6", day: () => TODAY, stop: 6, status: "loaded",
    trade: 0, plannedTime: "12:00", windowEnd: "14:00", driver: 1, van: 1, packages: 4,
    times: { picked: "09:10", ready: "09:40", loaded: "10:05" },
  },
  {
    slot: "today-7", day: () => TODAY, stop: 7, status: "ready",
    trade: 2, plannedTime: "13:00", driver: 1, van: 1, packages: 3,
    missingItems: "1 × front discs on back order — ETA Friday.",
    times: { picked: "09:15", ready: "09:55" },
  },
  {
    slot: "today-8", day: () => TODAY, stop: 8, status: "ready",
    plannedTime: "13:30", driver: null, van: null, packages: 1,
    collection: true,
    notes: "Customer collecting from the trade counter — do not load.",
    times: { picked: "09:20", ready: "10:00" },
  },
  {
    slot: "today-9", day: () => TODAY, stop: 9, status: "picking",
    trade: 1, plannedTime: "14:15", driver: 1, van: 1, packages: 0, urgent: true,
    times: { picked: "10:20" },
  },
  {
    slot: "today-10", day: () => TODAY, stop: 10, status: "planned",
    plannedTime: "15:00", windowEnd: "17:00", driver: 1, van: 1, packages: 0,
  },
  {
    slot: "today-11", day: () => TODAY, stop: 11, status: "planned",
    plannedTime: "16:00", driver: null, van: null, packages: 0, forceUnpaid: true,
    notes: "Awaiting payment before it goes on the van.",
  },

  // ---- yesterday: a closed-out day -------------------------------------
  {
    slot: "yday-1", day: () => YESTERDAY, stop: 1, status: "delivered",
    plannedTime: "08:30", driver: 0, van: 0, packages: 2, podRecipient: "L. Chapman",
    times: { picked: "07:40", ready: "07:55", loaded: "08:05", dispatched: "08:10", completed: "08:41" },
  },
  {
    slot: "yday-2", day: () => YESTERDAY, stop: 2, status: "delivered",
    trade: 3, plannedTime: "10:00", driver: 0, van: 0, packages: 5,
    podRecipient: "Trade counter", podNotes: "Signed for by the goods-in desk.",
    times: { picked: "07:40", ready: "08:00", loaded: "08:05", dispatched: "08:10", completed: "10:06" },
  },
  {
    slot: "yday-3", day: () => YESTERDAY, stop: 3, status: "returned",
    plannedTime: "11:30", driver: 0, van: 0, packages: 1, forceUnpaid: true,
    failedReason: "refused", failedNotes: "Customer had already sourced the part elsewhere.",
    times: { picked: "07:40", ready: "08:02", loaded: "08:05", dispatched: "08:10", failed: "11:35", returned: "15:20" },
  },
  {
    slot: "yday-4", day: () => YESTERDAY, stop: 4, status: "delivered",
    plannedTime: "14:00", windowEnd: "16:00", driver: 1, van: 1, packages: 1,
    coreExpected: true, coreCollected: true, surcharge: 42.5, podRecipient: "D. Okafor",
    times: { picked: "12:10", ready: "12:30", loaded: "12:45", dispatched: "12:55", completed: "14:22" },
  },

  // ---- tomorrow: the next run, still being built -------------------------
  {
    slot: "tmrw-1", day: () => TOMORROW, stop: 1, status: "planned",
    plannedTime: "08:30", driver: 0, van: 0, packages: 0, urgent: true,
    notes: "Re-book of the failed drop from today.",
  },
  {
    slot: "tmrw-2", day: () => TOMORROW, stop: 2, status: "planned",
    trade: 0, plannedTime: "09:30", windowEnd: "11:00", driver: 0, van: 0, packages: 0,
  },
  {
    slot: "tmrw-3", day: () => TOMORROW, stop: 3, status: "ready",
    plannedTime: "11:00", driver: 0, van: 0, packages: 2,
    times: { picked: "16:20", ready: "16:45" },
  },
  {
    slot: "tmrw-4", day: () => TOMORROW, stop: 4, status: "planned",
    plannedTime: "14:30", driver: null, van: null, packages: 0, forceUnpaid: true,
  },
];

// ---------------------------------------------------------------------------
// Postcode validation
// ---------------------------------------------------------------------------
// Most customer postcodes in this database are synthetic and do not resolve, so
// a stop built on one cannot be plotted on the route panel or drive-estimated.
// The seed prefers customers whose postcode is a real UK postcode, checked
// against postcodes.io — the same free, key-less service /api/location/drive-time
// and the route panel already use. If the lookup is unavailable the seed carries
// on unfiltered rather than failing.
async function filterToRealPostcodes(invoices) {
  const codes = [...new Set(invoices.map((i) => normalisePostcode(i.customer.postcode)))].filter(Boolean);
  const valid = new Set();

  for (let index = 0; index < codes.length; index += 100) {
    const batch = codes.slice(index, index + 100);
    let response;
    try {
      response = await fetch("https://api.postcodes.io/postcodes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postcodes: batch }),
      });
    } catch {
      console.warn("Postcode lookup unavailable — seeding without the map-friendly filter.");
      return invoices;
    }
    if (!response.ok) {
      console.warn(`Postcode lookup returned ${response.status} — seeding without the filter.`);
      return invoices;
    }
    const payload = await response.json().catch(() => null);
    for (const entry of payload?.result || []) {
      if (entry?.result) valid.add(normalisePostcode(entry.query));
    }
  }

  const matched = invoices.filter((i) => valid.has(normalisePostcode(i.customer.postcode)));
  console.log(`Postcodes: ${valid.size} of ${codes.length} resolve; ${matched.length} usable stops.`);
  return matched.length >= SLOTS.length ? matched : invoices;
}

const normalisePostcode = (value) => String(value || "").toUpperCase().replace(/\s+/g, "");

// ---------------------------------------------------------------------------
// Source data
// ---------------------------------------------------------------------------
async function loadSources() {
  const [invoiceResult, partsResult, staffResult, tradeResult, collectionResult] = await Promise.all([
    db
      .from("invoices")
      .select(
        `id, invoice_number, job_id, job_number, customer_id, grand_total, invoice_total,
         parts_total, total_parts, paid, payment_method,
         customer:customers(id, firstname, lastname, name, address, postcode, mobile, telephone, email),
         job:jobs(id, job_number, vehicle_reg, vehicle_id)`
      )
      .not("customer_id", "is", null)
      .not("job_id", "is", null)
      .not("invoice_number", "is", null)
      .order("invoice_number", { ascending: true })
      .limit(1200),
    db.from("parts_catalog").select("id, part_number, name, unit_price").order("part_number").limit(40),
    db
      .from("users")
      .select("user_id, first_name, last_name, role")
      .in("role", ["Parts Driver", "Parts", "Parts Manager"])
      .eq("is_active", true)
      .order("user_id"),
    db
      .from("company_accounts")
      .select("account_number, company_name, trading_name, contact_name, contact_phone, billing_address_line1, billing_city, billing_postcode")
      .in("account_number", TRADE_ACCOUNTS),
    db
      .from("parts_order_cards")
      .select("id, order_number, customer_id, customer_name, customer_address, customer_phone")
      .eq("delivery_type", "collection")
      .limit(1),
  ]);

  for (const [label, result] of [
    ["invoices", invoiceResult],
    ["parts_catalog", partsResult],
    ["users", staffResult],
    ["company_accounts", tradeResult],
    ["parts_order_cards", collectionResult],
  ]) {
    if (result.error) throw new Error(`Unable to read ${label}: ${result.error.message}`);
  }

  // One invoice per customer, so the board does not show the same person four
  // times, and only customers whose address is complete enough to drive to.
  const seenCustomers = new Set();
  const invoices = [];
  for (const invoice of invoiceResult.data || []) {
    const customer = invoice.customer;
    if (!customer?.postcode || !customer?.address) continue;
    if (!invoice.job?.vehicle_reg) continue;
    if (seenCustomers.has(customer.id)) continue;
    seenCustomers.add(customer.id);
    invoices.push(invoice);
  }

  // Keep only stops the route panel can actually place on a map.
  const plottable = await filterToRealPostcodes(invoices);

  const vehicleIds = [...new Set(plottable.map((i) => i.job?.vehicle_id).filter(Boolean))];
  const vehicles = new Map();
  for (let index = 0; index < vehicleIds.length; index += 200) {
    const { data } = await db
      .from("vehicles")
      .select("vehicle_id, registration, make, model")
      .in("vehicle_id", vehicleIds.slice(index, index + 200));
    for (const row of data || []) vehicles.set(row.vehicle_id, row);
  }

  const trade = new Map((tradeResult.data || []).map((row) => [row.account_number, row]));

  // Split the pool by payment state. A stop that is meant to show "payment due
  // on the door" has to be linked to an invoice that is genuinely unpaid — the
  // page treats a settled invoice as settled, so pointing an unpaid scenario at
  // a paid invoice would render it as Paid and the seeded story would be a lie.
  return {
    invoices: plottable,
    paidInvoices: plottable.filter((invoice) => invoice.paid),
    unpaidInvoices: plottable.filter((invoice) => !invoice.paid),
    parts: partsResult.data || [],
    staff: staffResult.data || [],
    trade: TRADE_ACCOUNTS.map((n) => trade.get(n)).filter(Boolean),
    collectionOrder: (collectionResult.data || [])[0] || null,
    vehicles,
  };
}

// ---------------------------------------------------------------------------
// Row building
// ---------------------------------------------------------------------------
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

// A believable basket for a stop, drawn from the real catalogue and scaled so
// the line values add up to the invoice total the row is linked to.
function buildItems(parts, index, targetTotal) {
  const count = (index % 3) + 1;
  const picked = Array.from({ length: count }, (_, offset) => parts[(index * 3 + offset) % parts.length]);
  const rawTotal = picked.reduce((sum, part) => sum + Number(part.unit_price || 0), 0) || 1;
  const scale = targetTotal > 0 ? targetTotal / rawTotal : 1;
  return picked.map((part) => {
    const unit = round2(Number(part.unit_price || 0) * scale);
    return {
      key: part.id,
      part_number: part.part_number,
      description: part.name,
      quantity: 1,
      unit_price: unit,
      total: unit,
    };
  });
}

const staffName = (row) =>
  [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || `User ${row.user_id}`;

function buildRow(template, sources, index, cursors) {
  const { paidInvoices, unpaidInvoices, parts, staff, trade, collectionOrder, vehicles } = sources;
  const day = template.day();
  const id = slotId(template.slot);

  const tradeAccount = typeof template.trade === "number" ? trade[template.trade % trade.length] : null;

  // Draw from the pool that matches the scenario, so "payment due" stops are
  // backed by genuinely unpaid invoices.
  const wantsUnpaid = Boolean(template.forceUnpaid || template.paidOnDoorstep);
  const pool = wantsUnpaid && unpaidInvoices.length > 0 ? unpaidInvoices : paidInvoices;
  const cursorKey = pool === unpaidInvoices ? "unpaid" : "paid";
  const invoice = pool[cursors[cursorKey] % pool.length];
  cursors[cursorKey] += 1;

  const customer = invoice.customer;
  const vehicle = vehicles.get(invoice.job?.vehicle_id);

  // The delivery is worth the PARTS on the invoice, not the whole bill — the
  // labour stayed in the workshop. parts_total is the invoice's own figure;
  // invoice_total is only a fallback for rows that never had it split out.
  const total =
    round2(invoice.parts_total || invoice.total_parts || 0) ||
    round2(invoice.invoice_total ?? invoice.grand_total ?? 0) ||
    round2(80 + index * 37);
  const items = buildItems(parts, index, total);

  const driver = template.driver === null || template.driver === undefined ? null : staff[template.driver % staff.length];
  const van = template.van === null || template.van === undefined ? null : VANS[template.van % VANS.length];

  // A stop that was paid on the doorstep is unpaid up to the point of
  // delivery; anything forced unpaid stays unpaid.
  const isPaid = template.paidOnDoorstep
    ? true
    : template.forceUnpaid
    ? false
    : Boolean(invoice.paid);

  const times = template.times || {};

  const base = {
    id,
    delivery_date: day,
    sort_order: template.stop,
    status: template.status,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    job_id: invoice.job_id,
    customer_id: customer.id,
    customer_name: customer.name || [customer.firstname, customer.lastname].filter(Boolean).join(" "),
    part_name: items[0]?.description || null,
    part_number: items[0]?.part_number || null,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    unit_price: items[0]?.unit_price ?? 0,
    total_price: total,
    items,
    payment_method: isPaid ? invoice.payment_method || "Account" : null,
    is_paid: isPaid,
    address: customer.address,
    postcode: customer.postcode,
    contact_name: customer.name || null,
    contact_phone: customer.mobile || customer.telephone || null,
    contact_email: customer.email || null,
    notes: template.notes || null,
    driver_id: driver?.user_id ?? null,
    driver_name: driver ? staffName(driver) : null,
    vehicle_reg: van?.reg ?? null,
    planned_time: template.plannedTime || null,
    window_start: template.windowEnd ? template.plannedTime : null,
    window_end: template.windowEnd || null,
    is_urgent: Boolean(template.urgent),
    is_collection: Boolean(template.collection),
    package_count: template.packages ?? 0,
    missing_items: template.missingItems || null,
    order_reference: null,
    surcharge_value: template.surcharge || 0,
    core_return_expected: Boolean(template.coreExpected),
    core_return_collected: Boolean(template.coreCollected),
    core_return_notes: template.coreExpected ? "Old unit to come back on the van." : null,
    pod_recipient_name: template.podRecipient || null,
    pod_notes: template.podNotes || null,
    pod_captured_at: template.podRecipient && times.completed ? at(day, times.completed) : null,
    pod_captured_by: template.podRecipient && driver ? driver.user_id : null,
    failed_reason: template.failedReason || null,
    failed_notes: template.failedNotes || null,
    picked_at: times.picked ? at(day, times.picked) : null,
    ready_at: times.ready ? at(day, times.ready) : null,
    loaded_at: times.loaded ? at(day, times.loaded) : null,
    dispatched_at: times.dispatched ? at(day, times.dispatched) : null,
    completed_at: times.completed ? at(day, times.completed) : null,
    failed_at: times.failed ? at(day, times.failed) : null,
    returned_at: times.returned ? at(day, times.returned) : null,
  };

  // A trade stop replaces the private customer's contact details with the real
  // account's, but keeps the invoice link so the money is still traceable.
  if (tradeAccount) {
    base.customer_name = tradeAccount.trading_name || tradeAccount.company_name;
    base.address = [tradeAccount.billing_address_line1, tradeAccount.billing_city]
      .filter(Boolean)
      .join(", ");
    base.postcode = tradeAccount.billing_postcode;
    base.contact_name = tradeAccount.contact_name;
    base.contact_phone = tradeAccount.contact_phone;
    base.contact_email = null;
    base.customer_id = null;
    base.order_reference = tradeAccount.account_number;
    base.payment_method = "Account";
    base.is_paid = true;
  }

  // The collection stop is tied to the real parts order card that is already
  // flagged as a collection, so the reference on screen resolves to a record.
  if (template.collection && collectionOrder) {
    base.order_reference = collectionOrder.order_number;
    if (collectionOrder.customer_id) {
      base.customer_id = collectionOrder.customer_id;
      base.customer_name = collectionOrder.customer_name || base.customer_name;
      base.address = collectionOrder.customer_address || base.address;
      base.contact_phone = collectionOrder.customer_phone || base.contact_phone;
    }
  }

  return { row: base, vehicle, driver, day, times, template };
}

// One history entry per workflow timestamp, so the detail panel's trail is
// populated the way it would be if the day had been worked through the UI.
function buildEvents({ row, driver, day, times, template }) {
  const steps = [
    ["picked", "delivery.start_picking", "Planned → Picking", "planned", "picking"],
    ["ready", "delivery.mark_ready", "Picking → Ready", "picking", "ready"],
    ["loaded", "delivery.mark_loaded", "Ready → Loaded", "ready", "loaded"],
    ["dispatched", "delivery.dispatch", "Loaded → Out for delivery", "loaded", "out_for_delivery"],
    ["completed", "delivery.mark_delivered", "Out for delivery → Delivered", "out_for_delivery", "delivered"],
    ["failed", "delivery.mark_failed", "Out for delivery → Failed", "out_for_delivery", "failed"],
    ["returned", "delivery.mark_returned", "Failed → Returned", "failed", "returned"],
  ];

  return steps
    .filter(([key]) => times[key])
    .map(([key, eventType, summary, from, to], order) => ({
      id: undefined, // identity column
      delivery_job_id: row.id,
      event_type: eventType,
      from_status: from,
      to_status: to,
      actor_user_id: driver?.user_id ?? null,
      actor_name: driver ? staffName(driver) : "Parts desk",
      summary:
        key === "completed" && row.pod_recipient_name
          ? `${summary} · Received by ${row.pod_recipient_name}`
          : key === "failed" && template.failedNotes
          ? `${summary} · ${template.failedNotes}`
          : summary,
      detail: { seeded: true, slot: template.slot, step: order + 1 },
      created_at: at(day, times[key]),
    }))
    .map(({ id, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
async function clearSeed() {
  const ids = SLOTS.map((slot) => slotId(slot.slot));
  const { error: eventError } = await db.from("parts_delivery_events").delete().in("delivery_job_id", ids);
  if (eventError && !/does not exist/i.test(eventError.message)) {
    throw new Error(`Unable to clear delivery events: ${eventError.message}`);
  }
  const { data, error } = await db.from("parts_delivery_jobs").delete().in("id", ids).select("id");
  if (error) throw new Error(`Unable to clear seeded deliveries: ${error.message}`);
  console.log(`Removed ${(data || []).length} seeded delivery row(s).`);
}

async function seedVanRoster() {
  const { error } = await db
    .from("company_settings")
    .upsert(
      {
        setting_key: "parts_delivery_vehicles",
        setting_value: JSON.stringify(VANS),
        setting_type: "json",
        description: "Registrations offered when assigning a delivery vehicle on /deliveries.",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setting_key" }
    );
  if (error) throw new Error(`Unable to write the van roster: ${error.message}`);
  console.log(`Van roster set to: ${VANS.map((v) => v.reg).join(", ")}`);
}

async function main() {
  const clear = process.argv.includes("--clear");

  if (clear) {
    await clearSeed();
    return;
  }

  const sources = await loadSources();
  if (sources.invoices.length < SLOTS.length) {
    throw new Error(
      `Only ${sources.invoices.length} linkable invoices found; need at least ${SLOTS.length}.`
    );
  }
  if (sources.unpaidInvoices.length === 0) {
    console.warn("No unpaid invoices available — the payment-due stops will show as paid.");
  }
  if (sources.staff.length === 0) throw new Error("No active parts staff found to assign as drivers.");
  if (sources.trade.length === 0) throw new Error("No trade accounts found in company_accounts.");

  console.log(
    `Sources: ${sources.invoices.length} invoices (${sources.paidInvoices.length} paid / ${sources.unpaidInvoices.length} unpaid), ${sources.parts.length} parts, ` +
      `${sources.staff.length} staff, ${sources.trade.length} trade accounts.`
  );

  // Shared cursors so each pool is walked without repeating a customer.
  const cursors = { paid: 0, unpaid: 0 };
  const built = SLOTS.map((template, index) => buildRow(template, sources, index, cursors));

  // Replace any previous run first so re-seeding never leaves a stale event
  // trail behind a refreshed row.
  await clearSeed();
  await seedVanRoster();

  const { error: insertError } = await db.from("parts_delivery_jobs").insert(built.map((b) => b.row));
  if (insertError) throw new Error(`Unable to insert deliveries: ${insertError.message}`);

  const events = built.flatMap(buildEvents);
  if (events.length > 0) {
    const { error: eventError } = await db.from("parts_delivery_events").insert(events);
    if (eventError) {
      console.warn(`Delivery rows inserted, but the history trail failed: ${eventError.message}`);
    }
  }

  const byDay = built.reduce((acc, b) => {
    acc[b.day] = (acc[b.day] || 0) + 1;
    return acc;
  }, {});
  console.log(`Inserted ${built.length} deliveries and ${events.length} history entries.`);
  for (const [day, count] of Object.entries(byDay).sort()) {
    console.log(`  ${day}: ${count} stop(s)`);
  }
  console.log("Open /deliveries to see them. Re-run with --clear to remove.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
