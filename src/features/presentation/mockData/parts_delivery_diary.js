// file location: src/features/presentation/mockData/parts_delivery_diary.js
//
// Demo payload for /api/parts/delivery-diary, shaped exactly like the real
// route's response (see src/lib/database/deliveries.js -> shapeDeliveryRow) so
// the /deliveries presentation slide walks a full day's route rather than an
// empty board.
//
// Kept separate from parts_deliveries.js because that fixture models supplier
// goods-in deliveries, which is a different concept from the customer delivery
// diary this page runs.

import { DELIVERY_STATUS } from "@/features/deliveries/deliveryStatus";

const pad = (value) => String(value).padStart(2, "0");

const isoDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// The deck is shown on whatever day it is shown, so the demo route is always
// "today" relative to the presenter.
const demoDay = () => isoDate(new Date());

const stamp = (day, time) => `${day}T${time}:00.000Z`;

const STOPS = [
  {
    key: "planned",
    customer: "Alex Morgan",
    address: "Unit 4, Kings Hill Business Park, West Malling",
    postcode: "ME19 4AE",
    latitude: 51.2837,
    longitude: 0.4004,
    phone: "01732 555 118",
    invoice: "INV-20418",
    job: "J-10422",
    vehicle: "DE24 XYZ · Volkswagen Golf",
    status: DELIVERY_STATUS.PLANNED,
    time: "09:00",
    windowEnd: "10:00",
    value: 428.9,
    paid: true,
    items: 3,
    packages: 1,
    urgent: false,
  },
  {
    key: "ready",
    customer: "Priya Shah",
    address: "12 Tonbridge Road, Maidstone",
    postcode: "ME16 8RL",
    latitude: 51.2734,
    longitude: 0.5064,
    phone: "01622 555 240",
    invoice: "INV-20419",
    job: "J-10430",
    vehicle: "TA23 ABC · Ford Transit",
    status: DELIVERY_STATUS.READY,
    time: "09:45",
    windowEnd: "11:00",
    value: 96.4,
    paid: false,
    items: 2,
    packages: 1,
    urgent: true,
  },
  {
    key: "loaded",
    customer: "Reynolds Motor Services",
    address: "Aylesford Trade Centre, Aylesford",
    postcode: "ME20 7SL",
    latitude: 51.3041,
    longitude: 0.4772,
    phone: "01622 555 771",
    invoice: "INV-20421",
    job: null,
    vehicle: "",
    status: DELIVERY_STATUS.LOADED,
    time: "11:15",
    windowEnd: null,
    value: 1284.0,
    paid: true,
    items: 8,
    packages: 3,
    urgent: false,
  },
  {
    key: "out",
    customer: "James Holt",
    address: "Larkfield Retail Park, Larkfield",
    postcode: "ME20 6SW",
    latitude: 51.3013,
    longitude: 0.4402,
    phone: "07700 555 903",
    invoice: "INV-20423",
    job: "J-10441",
    vehicle: "TV22 HNP · BMW 320d",
    status: DELIVERY_STATUS.OUT_FOR_DELIVERY,
    time: "13:00",
    windowEnd: "15:00",
    value: 312.75,
    paid: false,
    items: 4,
    packages: 2,
    urgent: false,
  },
  {
    key: "delivered",
    customer: "Snodland Auto Centre",
    address: "Holborough Road, Snodland",
    postcode: "ME6 5PG",
    latitude: 51.3281,
    longitude: 0.4463,
    phone: "01634 555 016",
    invoice: "INV-20415",
    job: null,
    vehicle: "",
    status: DELIVERY_STATUS.DELIVERED,
    time: "08:15",
    windowEnd: null,
    value: 214.2,
    paid: true,
    items: 2,
    packages: 1,
    urgent: false,
  },
  {
    key: "failed",
    customer: "Coxheath Garage",
    address: "Heath Road, Coxheath",
    postcode: "ME17 4PH",
    latitude: 51.2447,
    longitude: 0.4934,
    phone: "01622 555 442",
    invoice: "INV-20416",
    job: null,
    vehicle: "",
    status: DELIVERY_STATUS.FAILED,
    time: "10:30",
    windowEnd: null,
    value: 88.5,
    paid: false,
    items: 1,
    packages: 1,
    urgent: false,
  },
];

const DRIVERS = [
  { userId: 9001, name: "Demo Driver A", role: "Parts Driver", phone: "07700 900 101" },
  { userId: 9002, name: "Demo Driver B", role: "Parts Driver", phone: "07700 900 102" },
];

const VEHICLES = [
  { reg: "HN71 VAN", label: "HN71 VAN" },
  { reg: "HP20 PTS", label: "HP20 PTS" },
];

function buildDeliveries(day) {
  return STOPS.map((stop, index) => {
    const driver = DRIVERS[index % DRIVERS.length];
    const isClosed =
      stop.status === DELIVERY_STATUS.DELIVERED || stop.status === DELIVERY_STATUS.FAILED;
    return {
      id: `demo-delivery-${stop.key}`,
      delivery_date: day,
      sort_order: index + 1,
      status: stop.status,
      rawStatus: stop.status,
      invoice_number: stop.invoice,
      order_reference: null,
      job_id: stop.job ? 10000 + index : null,
      customer_id: `demo-customer-${index}`,
      customer_name: stop.customer,
      customerDisplayName: stop.customer,
      address: stop.address,
      addressLine: stop.address,
      postcode: stop.postcode,
      postcodeValue: stop.postcode,
      contact_phone: stop.phone,
      contactPhone: stop.phone,
      contactEmail: "",
      notes: index === 1 ? "Ask for Priya at the trade counter." : "",
      planned_time: stop.time,
      window_start: stop.time,
      window_end: stop.windowEnd,
      is_urgent: stop.urgent,
      is_collection: false,
      quantity: stop.items,
      itemCount: stop.items,
      package_count: stop.packages,
      packageCount: stop.packages,
      missing_items: index === 1 ? "1 × wiper blade on back order" : null,
      total_price: stop.value,
      value: stop.value,
      surcharge_value: 0,
      surchargeValue: 0,
      core_return_expected: index === 2,
      core_return_collected: false,
      is_paid: stop.paid,
      isPaid: stop.paid,
      payment_method: stop.paid ? "Account" : "Card on delivery",
      driver_id: driver.userId,
      driver_name: driver.name,
      vehicle_reg: VEHICLES[index % VEHICLES.length].reg,
      jobNumber: stop.job,
      vehicleDetails: stop.vehicle,
      invoice_id: `demo-invoice-${index}`,
      items: Array.from({ length: stop.items }).map((_, itemIndex) => ({
        key: `${stop.key}-item-${itemIndex}`,
        description: ["Front brake pad set", "Service filter kit", "Oil 5W-30 5L", "Wiper blade pair"][
          itemIndex % 4
        ],
        quantity: 1,
        total: Math.round((stop.value / stop.items) * 100) / 100,
      })),
      picked_at: isClosed || index < 3 ? stamp(day, "07:40") : null,
      ready_at: index < 3 || isClosed ? stamp(day, "07:55") : null,
      loaded_at: index >= 2 || isClosed ? stamp(day, "08:05") : null,
      dispatched_at:
        stop.status === DELIVERY_STATUS.OUT_FOR_DELIVERY || isClosed ? stamp(day, "08:20") : null,
      completed_at: stop.status === DELIVERY_STATUS.DELIVERED ? stamp(day, "08:52") : null,
      failed_at: stop.status === DELIVERY_STATUS.FAILED ? stamp(day, "10:44") : null,
      returned_at: null,
      eta_at: null,
      failed_reason: stop.status === DELIVERY_STATUS.FAILED ? "customer_closed" : null,
      failed_notes:
        stop.status === DELIVERY_STATUS.FAILED ? "Shutters down, no answer on the mobile." : null,
      pod_recipient_name: stop.status === DELIVERY_STATUS.DELIVERED ? "S. Hammond" : null,
      pod_notes: null,
      pod_photo_url: null,
      pod_signature_url: null,
      pod_captured_at: stop.status === DELIVERY_STATUS.DELIVERED ? stamp(day, "08:52") : null,
      customer: null,
      job: stop.job ? { id: 10000 + index, job_number: stop.job } : null,
      invoice: null,
    };
  });
}

function summarise(deliveries) {
  const counts = {};
  let totalValue = 0;
  let unpaidValue = 0;
  let urgentCount = 0;
  for (const delivery of deliveries) {
    counts[delivery.status] = (counts[delivery.status] || 0) + 1;
    totalValue += delivery.value;
    if (!delivery.isPaid) unpaidValue += delivery.value;
    if (delivery.is_urgent) urgentCount += 1;
  }
  return { counts, totalValue, unpaidValue, urgentCount, total: deliveries.length };
}

function weekBounds(day) {
  const date = new Date(`${day}T00:00:00Z`);
  const dayIndex = (date.getUTCDay() + 6) % 7;
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - dayIndex);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

/** The full /api/parts/delivery-diary payload for the demo day. */
export function buildDeliveryDiaryMock(requestedDate) {
  const day = requestedDate || demoDay();
  const deliveries = buildDeliveries(day);
  const { startDate, endDate } = weekBounds(day);
  const summary = summarise(deliveries);

  const days = {};
  for (let offset = 0; offset < 7; offset += 1) {
    const cursor = new Date(`${startDate}T00:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + offset);
    const key = cursor.toISOString().slice(0, 10);
    days[key] =
      key === day
        ? {
            total: summary.total,
            open: summary.total - (summary.counts.delivered || 0) - (summary.counts.failed || 0),
            delivered: summary.counts.delivered || 0,
            failed: summary.counts.failed || 0,
            urgent: summary.urgentCount,
            value: summary.totalValue,
          }
        : { total: 0, open: 0, delivered: 0, failed: 0, urgent: 0, value: 0 };
  }

  return {
    date: day,
    deliveries,
    events: {
      "demo-delivery-delivered": [
        {
          id: 1,
          delivery_job_id: "demo-delivery-delivered",
          event_type: "delivery.mark_delivered",
          summary: "Out for delivery → Delivered",
          actor_name: "Demo Driver A",
          created_at: stamp(day, "08:52"),
        },
      ],
    },
    summary,
    drivers: DRIVERS,
    vehicles: VEHICLES,
    week: { startDate, endDate, days },
    capabilities: {
      view: true,
      pick: true,
      load: true,
      drive: true,
      assign: true,
      reorder: true,
      manage: true,
    },
  };
}

// The parts desk (ME19 4NY, Kings Hill) — the same origin the live route uses,
// so the demo route has the real shape a Kent run has.
const DEMO_ORIGIN = {
  postcode: "ME19 4NY",
  latitude: 51.2861,
  longitude: 0.4033,
  label: "Humphries & Parks",
};

// The real driving route round the six demo stops and back to the desk, as
// OSRM returns it for these exact coordinates — [latitude, longitude] pairs,
// simplified geometry, baked in because the presentation makes no outbound
// calls of any kind. Without it the demo would fall back to the dashed
// straight-line drawing and caption itself "live routing is unavailable",
// which is a fault message, not a demonstration.
const DEMO_DRIVE_GEOMETRY = [
  [51.28715, 0.40264], [51.28462, 0.39827], [51.28271, 0.40076], [51.28343, 0.39985],
  [51.28462, 0.39827], [51.27993, 0.39513], [51.28042, 0.39904], [51.28257, 0.40450],
  [51.29042, 0.41924], [51.29465, 0.42038], [51.29935, 0.41685], [51.30602, 0.41513],
  [51.30895, 0.41699], [51.30847, 0.42345], [51.30986, 0.42554], [51.30610, 0.43507],
  [51.30223, 0.46031], [51.29709, 0.48491], [51.29234, 0.48423], [51.29102, 0.48758],
  [51.28519, 0.49417], [51.28185, 0.50394], [51.27968, 0.50653], [51.27519, 0.50975],
  [51.27341, 0.50635], [51.27094, 0.50502], [51.27007, 0.50603], [51.27017, 0.51190],
  [51.27219, 0.51293], [51.27151, 0.51754], [51.27578, 0.51839], [51.27848, 0.51748],
  [51.28086, 0.51874], [51.29275, 0.51703], [51.29614, 0.51353], [51.29648, 0.51040],
  [51.29934, 0.50615], [51.30452, 0.47616], [51.30398, 0.47724], [51.30313, 0.48327],
  [51.30046, 0.47312], [51.30187, 0.46307], [51.29877, 0.45552], [51.29971, 0.45079],
  [51.29850, 0.44205], [51.30167, 0.44197], [51.30131, 0.43985], [51.30022, 0.43944],
  [51.30106, 0.43198], [51.31220, 0.43520], [51.31334, 0.42777], [51.31809, 0.43423],
  [51.31845, 0.43952], [51.32020, 0.44344], [51.32321, 0.44564], [51.32810, 0.44633],
  [51.33140, 0.44695], [51.33743, 0.44557], [51.33096, 0.44695], [51.32157, 0.44488],
  [51.31880, 0.44116], [51.31649, 0.43147], [51.31370, 0.42817], [51.30961, 0.42627],
  [51.30610, 0.43507], [51.30223, 0.46031], [51.29691, 0.48518], [51.29238, 0.48364],
  [51.29220, 0.47660], [51.28847, 0.47618], [51.27964, 0.47885], [51.27497, 0.48210],
  [51.25864, 0.48300], [51.25619, 0.48480], [51.25244, 0.48413], [51.25163, 0.48485],
  [51.25016, 0.49922], [51.24431, 0.49361], [51.24165, 0.49169], [51.23591, 0.48298],
  [51.23933, 0.46587], [51.24456, 0.46562], [51.24603, 0.45374], [51.25057, 0.45364],
  [51.25445, 0.44458], [51.25456, 0.42706], [51.25694, 0.41611], [51.25601, 0.40150],
  [51.25878, 0.38343], [51.25822, 0.38054], [51.26352, 0.38181], [51.26781, 0.38582],
  [51.27121, 0.38697], [51.28484, 0.39849], [51.28715, 0.40264],
];

// Per-leg road miles and minutes from the same OSRM answer. Index 0 is the desk
// to the first stop; the last entry is the run home.
const DEMO_LEG_MILES = [0.5, 8.6, 4.6, 2.6, 3, 10.5, 8.5];
const DEMO_LEG_MINUTES = [2, 15, 13, 7, 7, 19, 17];
const DEMO_TOTAL_MILES = 38.3;
const DEMO_TOTAL_MINUTES = 80;

/** Demo response for the route-map panel.
 *
 *  The presentation makes no outbound postcode lookups or routing calls, so the
 *  coordinates are carried on the fixture stops themselves and the drive is the
 *  baked OSRM answer above. They are the real positions of those Kent postcodes
 *  and the real roads between them, which means the demo draws the same map the
 *  live page does — basemap tiles and routed line included — instead of an
 *  apology. */
export function buildDeliveryRouteMapMock(requestedDate) {
  const stops = STOPS.map((stop, index) => ({
    id: `demo-delivery-${stop.key}`,
    stopNumber: index + 1,
    located: true,
    label: stop.customer,
    postcode: stop.postcode,
    latitude: stop.latitude,
    longitude: stop.longitude,
    legMiles: DEMO_LEG_MILES[index],
    legMinutes: DEMO_LEG_MINUTES[index],
    status: stop.status,
    isUrgent: Boolean(stop.urgent),
  }));

  return {
    date: requestedDate || demoDay(),
    available: true,
    provider: "osrm",
    routed: true,
    geometry: DEMO_DRIVE_GEOMETRY.map(([latitude, longitude]) => ({ latitude, longitude })),
    origin: DEMO_ORIGIN,
    stops,
    returnMiles: DEMO_LEG_MILES[DEMO_LEG_MILES.length - 1],
    totalMiles: DEMO_TOTAL_MILES,
    totalMinutes: DEMO_TOTAL_MINUTES,
  };
}

export const rows = buildDeliveries(demoDay());

export default rows;
