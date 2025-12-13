const ADDRESS_API_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_HEADERS = {
  "User-Agent": "HNPSystem/1.0 (Business Application; contact@hnpsystem.com)",
  Accept: "application/json",
  "Accept-Language": "en",
};

const mapSuggestion = (entry, fallbackPostcode, rawQuery) => {
  const address = entry?.address || {};
  const line1 = [address.house_number, address.road, address.pedestrian, address.suburb]
    .filter(Boolean)
    .join(" ")
    .trim();
  const town =
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.suburb ||
    "";
  const county = address.county || address.state_district || address.state || "";
  const postcode = address.postcode || fallbackPostcode || rawQuery?.toUpperCase() || "";
  const country = address.country || "United Kingdom";

  const summaryParts = [line1, town, county, postcode].filter(Boolean);
  const summary = summaryParts.length ? summaryParts.join(", ") : entry.display_name;

  return {
    id: entry.place_id,
    label: summary,
    line1,
    town,
    county,
    country,
    postcode,
    fullAddress: entry.display_name,
    latitude: entry.lat,
    longitude: entry.lon,
  };
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const postcode = String(req.query.postcode || "").trim();
  if (!postcode) {
    return res.status(400).json({ success: false, error: "postcode query parameter is required" });
  }

  try {
    const sanitized = postcode.replace(/\s+/g, " ").trim();

    // Try method 1: Search by postcode parameter
    let query = new URLSearchParams({
      format: "json",
      addressdetails: "1",
      limit: "10",
      countrycodes: "gb",
      postalcode: sanitized,
    }).toString();

    let response = await fetch(`${ADDRESS_API_URL}?${query}`, {
      headers: DEFAULT_HEADERS,
    });

    // If first method fails or returns 403, try alternative search query
    if (!response.ok || response.status === 403) {
      console.log(`First method failed with status ${response.status}, trying alternative search...`);
      query = new URLSearchParams({
        format: "json",
        addressdetails: "1",
        limit: "10",
        countrycodes: "gb",
        q: sanitized,
      }).toString();

      response = await fetch(`${ADDRESS_API_URL}?${query}`, {
        headers: DEFAULT_HEADERS,
      });
    }

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("Access denied by address service. Please try again in a moment.");
      }
      if (response.status === 429) {
        throw new Error("Too many requests. Please wait a moment and try again.");
      }
      throw new Error(`Address lookup failed with status ${response.status}`);
    }

    const payload = await response.json();
    const suggestions = Array.isArray(payload)
      ? payload.map((entry) => mapSuggestion(entry, sanitized.toUpperCase(), postcode))
      : [];

    if (suggestions.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No address matches were found for that postcode",
        suggestions: [],
      });
    }

    return res.status(200).json({ success: true, suggestions });
  } catch (error) {
    console.error("❌ postcode-lookup error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unable to search postcode at this time",
    });
  }
}
