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

/** Demo response for the route-map panel — deliberately "unavailable", since
 *  the presentation runs with no outbound postcode lookups. */
export function buildDeliveryRouteMapMock(requestedDate) {
  return {
    date: requestedDate || demoDay(),
    available: false,
    detail: "Postcode lookup is disabled during the presentation.",
    origin: null,
    stops: [],
    totalMiles: 0,
  };
}

export const rows = buildDeliveries(demoDay());

export default rows;
