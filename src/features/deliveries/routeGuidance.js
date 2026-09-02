// Browser-safe route timing and Google Maps guidance helpers.

const MAX_GOOGLE_WAYPOINTS = 9;

const stopAddress = (delivery) =>
  [delivery?.addressLine || delivery?.address, delivery?.postcodeValue || delivery?.postcode]
    .filter(Boolean)
    .join(", ")
    .trim();

const directionsUrl = ({ origin, destination, waypoints, avoidMotorways }) => {
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  if (avoidMotorways) params.set("avoid", "highways");
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export function buildGoogleMapsRouteUrls(deliveries = [], originPostcode, avoidMotorways = false) {
  const origin = String(originPostcode || "").trim();
  const stops = deliveries.map(stopAddress).filter(Boolean);
  if (!origin || stops.length === 0) return [];

  const urls = [];
  let currentOrigin = origin;
  let remaining = [...stops];
  while (remaining.length > MAX_GOOGLE_WAYPOINTS) {
    const batch = remaining.slice(0, MAX_GOOGLE_WAYPOINTS + 1);
    const destination = batch[batch.length - 1];
    urls.push(
      directionsUrl({
        origin: currentOrigin,
        destination,
        waypoints: batch.slice(0, -1),
        avoidMotorways,
      })
    );
    currentOrigin = destination;
    remaining = remaining.slice(batch.length);
  }
  urls.push(
    directionsUrl({
      origin: currentOrigin,
      destination: origin,
      waypoints: remaining,
      avoidMotorways,
    })
  );
  return urls;
}

export function calculateRouteFinishTime(leaveTime, driveMinutes, stopCount, minutesPerStop) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(leaveTime || ""));
  if (!match || !Number.isFinite(driveMinutes)) return "";
  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const total = startMinutes + Math.max(0, driveMinutes) + stopCount * Math.max(0, minutesPerStop);
  const dayOffset = Math.floor(total / 1440);
  const clock = ((total % 1440) + 1440) % 1440;
  const value = `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
  return dayOffset > 0 ? `${value} (+${dayOffset} day)` : value;
}

export function formatRouteDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "Not available";
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
