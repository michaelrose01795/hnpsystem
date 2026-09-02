// file location: tools/scripts/seed-delivery-diary.js
//
// Seeds a realistic parts delivery diary for /deliveries — a full month of it.
//
//   npm run seed:deliveries                  write the diary
//   npm run seed:deliveries -- --days=45     write a longer horizon
//   npm run seed:deliveries -- --back=60     lay down more worked history
//   npm run seed:deliveries -- --plan        print what it would write, touch nothing
//   npm run seed:deliveries -- --clear       remove it again
//
// What lands in the database, one run per WORKING day — Saturday and Sunday are
// skipped throughout, because the vans do not run and a diary showing weekend
// stops is not one anybody trusts:
//
//   the last 4 weeks    worked history. Every day is closed out: signed for on
//                       the door with the contact's name against it, the odd
//                       drop that failed with a reason, the occasional one that
//                       came back on the van, cores collected. This is what
//                       makes scrolling back look like a business rather than
//                       an empty calendar.
//   yesterday + today   a hand-written day: deliveries completed, one failed
//                       with a reason, one returned, cores, missing lines,
//                       payment on the door, a collection. This is the day
//                       worth demoing.
//   tomorrow → horizon  the book of work still to do. Roughly five to nine
//                       stops a day, Monday and Friday heavier, with the near
//                       days picked/loaded and driver-allocated and the far
//                       days still just a list of drops.
//
// Everything is linked to real records: real customers with their real
// invoices (number, id, total, payment state), the workshop job and vehicle
// behind that invoice, real parts from parts_catalog, real trade accounts from
// company_accounts, and the real parts staff from users.
//
// The one thing it creates is the trade side. The customers table is mostly
// private owners, so a month of stops drawn only from it reads as a taxi
// service; ten business accounts (real Kent postcodes, so every one plots on
// the route map) are inserted into `customers` as ordinary records. They are
// invoiceable and searchable afterwards like any other customer, and --clear
// removes them.
//
// Reversible by construction: every row id is a deterministic UUIDv5 derived
// from a fixed namespace plus a slot key, so --clear deletes exactly what this
// script wrote and nothing else. The generated horizon moves with the calendar,
// so --clear sweeps a wide window of derived ids to catch days an earlier run
// wrote. Re-running replaces the seed rather than duplicating it, and because
// each day's plan is seeded off its own date, a re-run does not reshuffle days
// it wrote last time.

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
// Kept to accounts within van range of the parts desk — a Birmingham or
// Southampton account on the list would stretch the day's route map across the
// country. Five is enough that a busy day never delivers to the same trade
// counter twice.
const TRADE_ACCOUNTS = ["CA3771", "CA6790", "CA4865", "CA8674", "CA3606"];

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
    collection: true, useCollectionOrder: true,
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

  // Tomorrow onwards is generated (see "The forward month"), so the curated
  // list stops here. Yesterday and today are the hand-written story day.
];

// Slot keys this script used to write and no longer does. --clear still
// removes them, so an older seed does not leave orphans on the board.
const LEGACY_SLOT_KEYS = ["tmrw-1", "tmrw-2", "tmrw-3", "tmrw-4"];

// ---------------------------------------------------------------------------
// The forward month
// ---------------------------------------------------------------------------
// Everything from tomorrow to the end of the horizon is generated rather than
// hand-written, so the diary is a real month of work instead of three days
// followed by an empty board. Saturday and Sunday are skipped — the vans do not
// run at the weekend, and a diary that shows stops on a Sunday is not a diary
// anyone trusts.
const HORIZON_DAYS_DEFAULT = 30;

// How much worked history to lay down behind today. Four weeks means the week
// strip has a real day behind every tile the desk can scroll back to, and the
// current month is complete rather than starting mid-week.
const BACKFILL_DAYS_DEFAULT = 28;

// How far either side of today --clear sweeps. The generated horizon moves with
// the calendar, so clearing has to cover the days a previous run could have
// written; every id in the sweep is derived, so it can only ever match this
// script's own rows.
const CLEAR_BACK_DAYS = 120;
const CLEAR_FORWARD_DAYS = 200;
const MAX_STOPS_PER_DAY = 12;

const dayOfWeek = (isoDay) => new Date(`${isoDay}T00:00:00`).getDay();
const isWeekend = (isoDay) => dayOfWeek(isoDay) === 0 || dayOfWeek(isoDay) === 6;

/** Every weekday from `offset` days out to `throughOffset`, inclusive. */
function weekdaysAhead(offset, throughOffset) {
  const days = [];
  for (let index = offset; index <= throughOffset; index += 1) {
    const day = shiftDays(index);
    if (isWeekend(day)) continue;
    days.push({ day, offset: index });
  }
  return days;
}

// A seeded PRNG (mulberry32) keyed off the date, so the same day always plans
// the same run. Re-seeding tomorrow does not reshuffle next Tuesday, and the
// row ids stay stable because the plan behind them does.
function rngFor(seed) {
  let state = 0;
  for (let index = 0; index < seed.length; index += 1) {
    state = (state * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickChance = (rng, probability) => rng() < probability;
const pickOne = (rng, list) => list[Math.floor(rng() * list.length)];

// The reasons the failure modal offers — the column has a CHECK constraint on
// exactly these, so a seeded failure has to be one of them.
const FAILURE_REASONS = [
  "customer_closed",
  "unable_to_contact",
  "no_access",
  "refused",
  "wrong_address",
];

/** "09:40" plus (or minus) some minutes, clamped to the working day. */
const addMinutes = (time, delta) => {
  const [hh, mm] = time.split(":").map(Number);
  const total = Math.max(7 * 60, Math.min(18 * 60, hh * 60 + mm + delta));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

// Times run from the first drop after the morning pick to mid-afternoon, with
// an uneven gap between stops — a real run is not on a metronome.
function plannedTimes(count, rng) {
  let minutes = 8 * 60 + 15 + Math.floor(rng() * 30);
  return Array.from({ length: count }, () => {
    const value = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
    minutes += 25 + Math.floor(rng() * 35);
    return value;
  });
}

/**
 * One day's run.
 *
 * The further out the day, the less of it is decided: tomorrow is picked and
 * loading with a driver on it, the day after is allocated, and anything beyond
 * that is still just a list of drops. That is how the board actually fills.
 */
function planDay({ day, offset }, businessCount, tradeCount) {
  const rng = rngFor(`hnp:delivery-diary:${day}`);
  const weekday = dayOfWeek(day);
  // Monday catches the weekend's orders and Friday clears the week; midweek is
  // quieter.
  const busy = weekday === 1 || weekday === 5 ? 2 : 0;
  const count = Math.min(4 + busy + Math.floor(rng() * 4), MAX_STOPS_PER_DAY);
  const times = plannedTimes(count, rng);

  return Array.from({ length: count }, (_, index) => {
    const stop = index + 1;
    const roll = rng();

    // Roughly a fifth of the board is trade counters and business accounts,
    // which is what the mix looks like on a real parts run.
    const source =
      tradeCount > 0 && roll < 0.16
        ? { trade: Math.floor(rng() * tradeCount) }
        : businessCount > 0 && roll < 0.34
        ? { business: Math.floor(rng() * businessCount) }
        : {};

    const past = offset < 0;

    // A day that has been and gone is closed out: almost everything delivered,
    // the odd drop that failed on the door, and the occasional one that came
    // back on the van. A day still ahead is part-worked at most.
    const closedRoll = rng();
    const status = past
      ? closedRoll < 0.88
        ? "delivered"
        : closedRoll < 0.95
        ? "failed"
        : "returned"
      : offset === 1
      ? index === 0
        ? "loaded"
        : index < 3
        ? "ready"
        : index === 3
        ? "picking"
        : "planned"
      : offset === 2 && index < 2
      ? "ready"
      : "planned";

    const previousEvening = index < 4 && offset === 1;
    const times_ = {};
    if (past) {
      // The whole morning: picked and loaded before the van left, then each
      // drop signed for a few minutes either side of its planned time.
      times_.picked = "07:35";
      times_.ready = "07:55";
      times_.loaded = "08:05";
      times_.dispatched = "08:15";
      const onDoor = addMinutes(times[index], Math.floor(rng() * 14) - 4);
      if (status === "delivered") times_.completed = onDoor;
      else {
        times_.failed = onDoor;
        if (status === "returned") times_.returned = "15:40";
      }
    } else {
      if (status === "picking" || status === "ready" || status === "loaded") {
        times_.picked = previousEvening ? "16:10" : "07:40";
      }
      if (status === "ready" || status === "loaded") {
        times_.ready = previousEvening ? "16:45" : "08:05";
      }
      if (status === "loaded") times_.loaded = previousEvening ? "17:05" : "08:20";
    }

    const hasWindow = pickChance(rng, 0.3);
    const [hh, mm] = times[index].split(":").map(Number);
    const windowEnd = hasWindow ? `${pad(Math.min(hh + 2, 18))}:${pad(mm)}` : null;

    // An unpaid stop that was delivered was paid at the door; one that failed
    // never got that far.
    const unpaid = pickChance(rng, 0.22);

    return {
      slot: `gen:${day}#${stop}`,
      day: () => day,
      stop,
      status,
      plannedTime: times[index],
      windowEnd,
      // A day that has run had a van on it; ahead, only the next two working
      // days are allocated.
      driver: past || offset <= 2 ? Math.floor(rng() * 2) : null,
      van: past || offset <= 2 ? Math.floor(rng() * VANS.length) : null,
      packages: status === "planned" ? 0 : 1 + Math.floor(rng() * 3),
      urgent: pickChance(rng, 0.14),
      collection: !past && pickChance(rng, 0.08),
      coreExpected: pickChance(rng, 0.12),
      coreCollected: past && pickChance(rng, 0.7),
      surcharge: pickChance(rng, 0.12) ? 35 + Math.floor(rng() * 6) * 10 : 0,
      missingItems: pickChance(rng, 0.1)
        ? "1 line on back order — the rest can go on the van."
        : null,
      forceUnpaid: unpaid,
      paidOnDoorstep: past && unpaid && status === "delivered",
      // The driver captured a name on the door, as they would have done. Only
      // a day that has actually run carries a proof or a failure reason.
      podFromContact: past && status === "delivered",
      failedReason: past && status !== "delivered" ? pickOne(rng, FAILURE_REASONS) : null,
      failedNotes:
        !past || status === "delivered"
          ? null
          : status === "returned"
          ? "Nobody on site to take it — brought back to the counter."
          : "No answer on the mobile. Re-book with the customer.",
      times: times_,
      ...source,
    };
  });
}

/**
 * The generated half of the diary, weekdays only.
 *
 * Backwards from yesterday it is a worked history — days that ran, signed for,
 * with the odd failure — so the week strip and any date the desk scrolls back
 * to has a real day behind it rather than a blank. Forwards it is the book of
 * work still to do. The curated slots own yesterday and today, so the backfill
 * stops short of them.
 */
function generateSlots(horizonDays, backDays, businessCount, tradeCount) {
  const past = weekdaysAhead(-backDays, -2);
  const ahead = weekdaysAhead(1, horizonDays);
  return [...past, ...ahead].flatMap((entry) => planDay(entry, businessCount, tradeCount));
}

// ---------------------------------------------------------------------------
// Business accounts the diary delivers to
// ---------------------------------------------------------------------------
// The customers table is mostly private owners, so a month of stops drawn only
// from it reads as a taxi service rather than a parts department. These are
// written into `customers` as real records — deterministic ids, so --clear
// removes exactly them — with genuine Kent postcodes so every one of them plots
// on the route map. They are ordinary customers afterwards: quotable,
// invoiceable, searchable, not a fixture.
const BUSINESS_CUSTOMERS = [
  { key: "biz-1", name: "Maidstone Motor Works", contact: "Dean Whitlock", address: "Unit 7, Parkwood Industrial Estate, Maidstone", postcode: "ME15 9NJ", mobile: "01622 559 118", email: "parts@maidstonemotorworks.example" },
  { key: "biz-2", name: "Aylesford Tyre & Exhaust", contact: "Sara Nunes", address: "Forstal Road, Aylesford", postcode: "ME20 7AU", mobile: "01622 559 204", email: "counter@aylesfordtyre.example" },
  { key: "biz-3", name: "Kings Hill Vehicle Services", contact: "Owen Pratt", address: "Kings Hill Business Park, West Malling", postcode: "ME19 4YU", mobile: "01732 559 330", email: "workshop@khvs.example" },
  { key: "biz-4", name: "Snodland Commercials", contact: "Marta Kowal", address: "Holborough Road, Snodland", postcode: "ME6 5PG", mobile: "01634 559 412", email: "goodsin@snodlandcommercials.example" },
  { key: "biz-5", name: "Larkfield Fleet Care", contact: "Ryan Deacon", address: "New Hythe Lane, Larkfield", postcode: "ME20 6RR", mobile: "01732 559 507", email: "fleet@larkfieldcare.example" },
  { key: "biz-6", name: "Tonbridge Auto Electrics", contact: "Priya Nayar", address: "Vale Rise, Tonbridge", postcode: "TN9 1TB", mobile: "01732 559 660", email: "bookings@tonbridgeautoelec.example" },
  { key: "biz-7", name: "Sevenoaks Prestige Servicing", contact: "Iwan Davies", address: "Vestry Trading Estate, Sevenoaks", postcode: "TN14 5EL", mobile: "01732 559 771", email: "service@sevenoaksprestige.example" },
  { key: "biz-8", name: "Chatham Van Centre", contact: "Beth Ackland", address: "Medway City Estate, Rochester", postcode: "ME2 4DP", mobile: "01634 559 884", email: "parts@chathamvancentre.example" },
  { key: "biz-9", name: "Coxheath Garage", contact: "Nathan Reeve", address: "Heath Road, Coxheath", postcode: "ME17 4PH", mobile: "01622 559 926", email: "office@coxheathgarage.example" },
  { key: "biz-10", name: "Gravesend Truck & Trailer", contact: "Femi Adeyemi", address: "Imperial Business Estate, Gravesend", postcode: "DA11 0DL", mobile: "01474 559 038", email: "parts@gravesendtruck.example" },
];

const businessId = (key) => uuidv5(`hnp:delivery-diary:customer:${key}`, NAMESPACE);

const BUSINESS_NOTE = "Trade account seeded by tools/scripts/seed-delivery-diary.js.";

/**
 * Insert the business accounts, or leave them exactly as they are if someone
 * has since edited one. A seed should be able to run twice without quietly
 * reverting a phone number the parts desk corrected by hand.
 */
async function seedBusinessCustomers() {
  const ids = BUSINESS_CUSTOMERS.map((business) => businessId(business.key));
  const { data: existing, error: readError } = await db
    .from("customers")
    .select("id")
    .in("id", ids);
  if (readError) throw new Error(`Unable to read seeded customers: ${readError.message}`);

  const present = new Set((existing || []).map((row) => row.id));
  const missing = BUSINESS_CUSTOMERS.filter((business) => !present.has(businessId(business.key)));

  if (missing.length > 0) {
    const rows = missing.map((business) => ({
      id: businessId(business.key),
      firstname: null,
      lastname: null,
      name: business.name,
      email: business.email,
      mobile: business.mobile,
      telephone: business.mobile,
      address: business.address,
      postcode: business.postcode,
      contact_preference: "email",
      notes: BUSINESS_NOTE,
    }));
    const { error } = await db.from("customers").insert(rows);
    if (error) throw new Error(`Unable to insert business customers: ${error.message}`);
  }

  console.log(
    `Business accounts: ${BUSINESS_CUSTOMERS.length} in place (${missing.length} created this run).`
  );
  return BUSINESS_CUSTOMERS.map((business) => ({ ...business, id: businessId(business.key) }));
}

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

// How a customer is written on the board, and the key the same-day guard uses.
const customerDisplayName = (customer) =>
  customer?.name || [customer?.firstname, customer?.lastname].filter(Boolean).join(" ").trim();

const nameKey = (name) => `name:${String(name || "").trim().toLowerCase()}`;

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

  // Across a month the pools are walked more than once, which is fine — a
  // customer can order twice in four weeks — but the same name must not appear
  // twice on one day's run. Everyone already booked in for the day is in here,
  // keyed by customer id, or by account number for a trade stop (those carry no
  // customer id, so an id-only guard misses them entirely).
  const usedToday = cursors.byDay.get(day) || new Set();
  cursors.byDay.set(day, usedToday);

  let tradeAccount = null;
  if (typeof template.trade === "number" && trade.length > 0) {
    tradeAccount = trade[template.trade % trade.length];
    for (let attempt = 0; attempt < trade.length; attempt += 1) {
      const candidate = trade[(template.trade + attempt) % trade.length];
      if (!usedToday.has(candidate.account_number)) {
        tradeAccount = candidate;
        break;
      }
    }
  }

  // Draw from the pool that matches the scenario, so "payment due" stops are
  // backed by genuinely unpaid invoices.
  const wantsUnpaid = Boolean(template.forceUnpaid || template.paidOnDoorstep);
  const pool = wantsUnpaid && unpaidInvoices.length > 0 ? unpaidInvoices : paidInvoices;
  const cursorKey = pool === unpaidInvoices ? "unpaid" : "paid";

  let invoice = pool[cursors[cursorKey] % pool.length];
  for (let attempt = 0; attempt < pool.length; attempt += 1) {
    invoice = pool[cursors[cursorKey] % pool.length];
    cursors[cursorKey] += 1;
    if (
      !usedToday.has(invoice.customer.id) &&
      !usedToday.has(nameKey(customerDisplayName(invoice.customer)))
    ) {
      break;
    }
  }
  // Whoever the stop ends up belonging to is registered at the end of this
  // function, once the trade / business / collection overrides have had their
  // say — a business stop borrows an invoice for its value but is not delivered
  // to that invoice's customer.

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

  // A business stop is delivered to one of the seeded trade accounts rather
  // than to a private owner. It carries no invoice link — those parts are on
  // account and billed monthly — so its value is the basket itself, priced from
  // the real catalogue rather than scaled to someone else's bill.
  let business = null;
  if (typeof template.business === "number" && sources.businesses.length > 0) {
    const list = sources.businesses;
    business = list[template.business % list.length];
    // Two business drops on one day must be two different accounts.
    for (let attempt = 0; attempt < list.length; attempt += 1) {
      const candidate = list[(template.business + attempt) % list.length];
      if (!usedToday.has(candidate.id)) {
        business = candidate;
        break;
      }
    }
  }
  if (business) {
    const basket = buildItems(parts, index + 5, 0);
    const basketTotal = round2(basket.reduce((sum, item) => sum + item.total, 0));
    base.customer_id = business.id;
    base.customer_name = business.name;
    base.address = business.address;
    base.postcode = business.postcode;
    base.contact_name = business.contact;
    base.contact_phone = business.mobile;
    base.contact_email = business.email;
    base.invoice_id = null;
    base.invoice_number = null;
    base.job_id = null;
    base.order_reference = `TRD-${day.replace(/-/g, "")}-${pad(template.stop)}`;
    base.items = basket;
    base.part_name = basket[0]?.description || null;
    base.part_number = basket[0]?.part_number || null;
    base.quantity = basket.reduce((sum, item) => sum + item.quantity, 0);
    base.unit_price = basket[0]?.unit_price ?? 0;
    base.total_price = basketTotal;
    base.payment_method = "Account";
    base.is_paid = template.paidOnDoorstep ? true : !template.forceUnpaid;
  }

  // The collection stop is tied to the real parts order card that is already
  // flagged as a collection, so the reference on screen resolves to a record.
  if (template.useCollectionOrder && collectionOrder) {
    base.order_reference = collectionOrder.order_number;
    if (collectionOrder.customer_id) {
      base.customer_id = collectionOrder.customer_id;
      base.customer_name = collectionOrder.customer_name || base.customer_name;
      base.address = collectionOrder.customer_address || base.address;
      base.contact_phone = collectionOrder.customer_phone || base.contact_phone;
    }
  }

  // A delivered stop on a day that has already run was signed for by whoever
  // was on the counter — the contact the desk holds for that address. This
  // happens after the trade / business overrides so the name matches the place
  // the van actually went.
  if (template.podFromContact && times.completed) {
    base.pod_recipient_name = base.contact_name || base.customer_name || null;
    base.pod_captured_at = at(day, times.completed);
    base.pod_captured_by = driver?.user_id ?? null;
  }

  // Book the stop's final owner in for the day, so the next stop on this run
  // skips past them. A trade stop has no customer id, so it books its account,
  // and the name goes in as well: this database holds more than one record for
  // some people, and two rows an hour apart reading "Charlotte Hall" look like
  // a mistake on the board whether or not they are different records.
  if (base.customer_id) usedToday.add(base.customer_id);
  if (tradeAccount) usedToday.add(tradeAccount.account_number);
  if (base.customer_name) usedToday.add(nameKey(base.customer_name));

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
/**
 * Every id this script could have written, past or present.
 *
 * The generated horizon moves with the calendar, so a run from three weeks ago
 * wrote days this run does not plan. Sweeping a wide window of derived ids
 * clears those too, and because every id is a UUIDv5 of a slot key it can only
 * ever match rows this script wrote — a real delivery is never in the list.
 */
function allSeededIds() {
  const keys = [...SLOTS.map((slot) => slot.slot), ...LEGACY_SLOT_KEYS];
  for (let offset = -CLEAR_BACK_DAYS; offset <= CLEAR_FORWARD_DAYS; offset += 1) {
    const day = shiftDays(offset);
    if (isWeekend(day)) continue;
    for (let stop = 1; stop <= MAX_STOPS_PER_DAY; stop += 1) keys.push(`gen:${day}#${stop}`);
  }
  return keys.map(slotId);
}

// PostgREST puts `in` filters in the query string, so the sweep goes out in
// batches rather than one URL of several thousand ids.
const ID_BATCH = 150;

const chunk = (list, size) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, index) =>
    list.slice(index * size, index * size + size)
  );

async function clearSeed({ includeCustomers = false } = {}) {
  const ids = allSeededIds();
  let removed = 0;

  for (const batch of chunk(ids, ID_BATCH)) {
    const { error: eventError } = await db
      .from("parts_delivery_events")
      .delete()
      .in("delivery_job_id", batch);
    if (eventError && !/does not exist/i.test(eventError.message)) {
      throw new Error(`Unable to clear delivery events: ${eventError.message}`);
    }
    const { data, error } = await db
      .from("parts_delivery_jobs")
      .delete()
      .in("id", batch)
      .select("id");
    if (error) throw new Error(`Unable to clear seeded deliveries: ${error.message}`);
    removed += (data || []).length;
  }

  console.log(`Removed ${removed} seeded delivery row(s).`);

  // The business accounts stay put on a re-seed — the next run delivers to them
  // again — and only go on an explicit --clear.
  if (includeCustomers) {
    const customerIds = BUSINESS_CUSTOMERS.map((business) => businessId(business.key));
    const { data, error } = await db
      .from("customers")
      .delete()
      .in("id", customerIds)
      .select("id");
    if (error) {
      console.warn(
        `Seeded deliveries removed, but the business accounts could not be: ${error.message}`
      );
    } else {
      console.log(`Removed ${(data || []).length} seeded business customer(s).`);
    }
  }
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

// Rows go in a few hundred at a time; a month of stops is one payload
// PostgREST would rather not take in a single request.
const INSERT_BATCH = 200;

const numericArg = (flag, fallback) => {
  const match = process.argv.find((argument) => argument.startsWith(`${flag}=`));
  if (!match) return fallback;
  const value = Number(match.slice(flag.length + 1));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};

async function main() {
  const clear = process.argv.includes("--clear");

  if (clear) {
    await clearSeed({ includeCustomers: true });
    return;
  }

  const horizonDays = numericArg("--days", HORIZON_DAYS_DEFAULT);
  const backDays = numericArg("--back", BACKFILL_DAYS_DEFAULT);

  // --plan prints the run the seed would write and touches nothing. Useful for
  // checking the shape of the month (weekends out, weight of each day, the mix
  // of trade and business stops) before writing to a live database.
  if (process.argv.includes("--plan")) {
    const planned = generateSlots(
      horizonDays,
      backDays,
      BUSINESS_CUSTOMERS.length,
      TRADE_ACCOUNTS.length
    );
    const byDay = new Map();
    for (const slot of planned) {
      const day = slot.day();
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(slot);
    }
    console.log(
      `Plan: ${planned.length} generated stop(s) over ${byDay.size} working day(s), plus ${SLOTS.length} curated stop(s) on ${YESTERDAY} and ${TODAY}.`
    );
    for (const [day, slots] of [...byDay.entries()].sort()) {
      const label = new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" });
      const trade = slots.filter((slot) => typeof slot.trade === "number").length;
      const business = slots.filter((slot) => typeof slot.business === "number").length;
      const urgent = slots.filter((slot) => slot.urgent).length;
      console.log(
        `  ${day} ${label}: ${slots.length} stop(s) · ${trade} trade · ${business} business · ${urgent} urgent`
      );
    }
    return;
  }

  const sources = await loadSources();
  if (sources.invoices.length < 12) {
    throw new Error(
      `Only ${sources.invoices.length} linkable invoices found; need at least 12 to build a month.`
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

  // The business accounts have to exist before a stop can be linked to one.
  sources.businesses = await seedBusinessCustomers();

  // Yesterday and today are the curated story day; tomorrow to the horizon is
  // generated, weekdays only.
  const templates = [
    ...SLOTS,
    ...generateSlots(horizonDays, backDays, sources.businesses.length, sources.trade.length),
  ];

  // Shared cursors so each pool is walked without repeating a customer.
  const cursors = { paid: 0, unpaid: 0, byDay: new Map() };
  const built = templates.map((template, index) => buildRow(template, sources, index, cursors));

  // Replace any previous run first so re-seeding never leaves a stale event
  // trail behind a refreshed row.
  await clearSeed();
  await seedVanRoster();

  for (const batch of chunk(built.map((b) => b.row), INSERT_BATCH)) {
    const { error: insertError } = await db.from("parts_delivery_jobs").insert(batch);
    if (insertError) throw new Error(`Unable to insert deliveries: ${insertError.message}`);
  }

  const events = built.flatMap(buildEvents);
  for (const batch of chunk(events, INSERT_BATCH)) {
    const { error: eventError } = await db.from("parts_delivery_events").insert(batch);
    if (eventError) {
      console.warn(`Delivery rows inserted, but the history trail failed: ${eventError.message}`);
      break;
    }
  }

  const byDay = built.reduce((acc, b) => {
    acc[b.day] = (acc[b.day] || 0) + 1;
    return acc;
  }, {});
  const days = Object.keys(byDay);
  console.log(
    `Inserted ${built.length} deliveries and ${events.length} history entries across ${days.length} working day(s).`
  );
  for (const [day, count] of Object.entries(byDay).sort()) {
    const label = new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" });
    console.log(`  ${day} ${label}: ${count} stop(s)`);
  }
  console.log("Open /deliveries to see them. Re-run with --clear to remove.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
