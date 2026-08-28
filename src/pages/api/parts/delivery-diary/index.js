// file location: src/pages/api/parts/delivery-diary/index.js
//
// The whole /deliveries day in one request: the route, its history, the day
// summary, the driver list, the delivery-vehicle list and the week strip.
//
// One endpoint rather than five keeps the page to a single SWR key, which is
// what stops the old page's "every state change refetches everything three
// times" behaviour. Everything here is a read; all writes live in the sibling
// routes.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { hasAllAccessRole, normalizeRoles } from "@/lib/auth/roles";
import {
  DELIVERY_DIARY_ROLES,
  resolveDeliveryCapabilities,
} from "@/features/deliveries/deliveryStatus";
import {
  isDeliveryDiaryMigrationPending,
  listDeliveriesForDate,
  listDeliveryDrivers,
  listDeliveryEventsForIds,
  listDeliveryVehicles,
  summariseDeliveries,
  summariseDeliveryWeek,
} from "@/lib/database/deliveries";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const todayIso = () => new Date().toISOString().slice(0, 10);

const shiftIsoDate = (isoDate, days) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// Monday-based week containing `isoDate`, matching how the parts desk plans a
// van week.
const weekBoundsFor = (isoDate) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const dayIndex = (date.getUTCDay() + 6) % 7; // 0 = Monday
  const startDate = shiftIsoDate(isoDate, -dayIndex);
  return { startDate, endDate: shiftIsoDate(startDate, 6) };
};

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  const roles = normalizeRoles(session?.user?.roles ?? []);
  const capabilities = resolveDeliveryCapabilities(roles, hasAllAccessRole(roles));
  if (!capabilities.view) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }

  const requestedDate = String(req.query.date || "").trim();
  const date = ISO_DATE_RE.test(requestedDate) ? requestedDate : todayIso();
  const driverId = parsePositiveInt(req.query.driverId);
  const includeWeek = req.query.week !== "0";

  try {
    const { startDate, endDate } = weekBoundsFor(date);

    const [deliveries, drivers, vehicles, week] = await Promise.all([
      listDeliveriesForDate({ date, driverId }),
      listDeliveryDrivers(),
      listDeliveryVehicles(),
      includeWeek ? summariseDeliveryWeek({ startDate, endDate }) : Promise.resolve({}),
    ]);

    // Fetched after the rows because it is keyed on their ids. One read for the
    // whole day means opening a delivery costs nothing.
    const events = await listDeliveryEventsForIds(deliveries.map((row) => row.id));

    res.status(200).json({
      success: true,
      data: {
        date,
        deliveries,
        events,
        summary: summariseDeliveries(deliveries),
        drivers,
        vehicles,
        week: { startDate, endDate, days: week },
        capabilities,
        // True on a database that has not had the delivery-diary migration
        // applied yet. The route still loads from the columns that have always
        // existed; the page uses this to explain why the workflow controls and
        // assignment fields are unavailable rather than failing outright.
        migrationPending: isDeliveryDiaryMigrationPending(),
      },
    });
  } catch (error) {
    console.error("Delivery diary load failed:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Unable to load the delivery diary",
    });
  }
}

export default withRoleGuard(handler, { allow: DELIVERY_DIARY_ROLES });
