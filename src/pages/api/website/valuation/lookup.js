// file location: src/pages/api/website/valuation/lookup.js
//
// POST /api/website/valuation/lookup -> { registration } -> the small, public
// slice of the DVLA vehicle record that /website/valuation needs to prefill its
// first step.
//
// WHY NOT REUSE /api/vehicles/dvla
// --------------------------------
// That route is wrapped in withRoleGuard: it is the STAFF lookup and requires a
// signed-in DMS user. This one is deliberately unauthenticated, because the
// whole point of the valuation page is that a stranger can use it. Two things
// follow from that, and both are implemented below:
//
//   1. Rate limiting. The DVLA key is a metered credential; an open proxy in
//      front of it is an invitation. Sliding window per IP, reusing the pure
//      limiter from src/lib/support/rateLimit.js.
//   2. A response allowlist. DVLA returns export markers, revenue weight, V5C
//      issue dates and tax status. None of that belongs on a public endpoint
//      that anyone can point at any registration, so only the fields the
//      estimate actually consumes are echoed back.
//
// MOT and tax status are NOT returned for the same reason - they are personal
// to the keeper and the wizard asks the customer about the MOT instead.

export const runtime = "nodejs"; // https module needs the Node runtime on Vercel

import https from "https";

import { getClientIp } from "@/lib/auth/rateLimit";
import {
  checkRateLimit,
  createRateStore,
  pruneRateStore,
  rateLimitKey,
} from "@/lib/support/rateLimit";
import { normaliseReg, isPlausibleReg } from "@/lib/valuation/vehicleValuation";

// Process-local, like the support store: one Vercel instance shares it across
// warm invocations. Not a distributed limiter, and does not need to be - it
// exists to stop a single script hammering the DVLA key, not to be a WAF.
const store = createRateStore();

// A person valuing their car looks up one or two registrations. Ten a minute is
// generous for a household with several vehicles and useless for a scraper.
const LIMIT = { windowMs: 60 * 1000, max: 10, abuseThreshold: 40, retainMs: 10 * 60 * 1000 };

function dvlaLookup(registration, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ registrationNumber: registration });

    const req = https.request(
      {
        hostname: "driver-vehicle-licensing.api.gov.uk",
        port: 443,
        path: "/vehicle-enquiry/v1/vehicles",
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        // Shorter than the staff route's 30s: this one sits in front of a
        // customer watching a spinner, and the wizard has a manual fallback.
        timeout: 12000,
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => resolve({ status: response.statusCode, data }));
      },
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      const error = new Error("DVLA request timed out");
      error.code = "ETIMEDOUT";
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

// The allowlist. Everything the estimate engine reads, and nothing else.
function publicVehicle(dvla, registration) {
  return {
    registration,
    make: dvla.make || null,
    year: dvla.yearOfManufacture || null,
    monthOfFirstRegistration: dvla.monthOfFirstRegistration || null,
    fuelType: dvla.fuelType || null,
    engineCapacity: dvla.engineCapacity || null,
    colour: dvla.colour || null,
    wheelplan: dvla.wheelplan || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const registration = normaliseReg(req.body?.registration);

  if (!isPlausibleReg(registration)) {
    return res.status(400).json({
      success: false,
      code: "invalid_registration",
      message: "That does not look like a UK registration. Try again, for example AB12 CDE.",
    });
  }

  pruneRateStore(store, Date.now(), LIMIT);
  const gate = checkRateLimit({
    key: rateLimitKey({ ip: getClientIp(req) }),
    store,
    limit: LIMIT,
  });

  if (!gate.allowed) {
    res.setHeader("Retry-After", Math.ceil(gate.retryAfterMs / 1000));
    return res.status(429).json({
      success: false,
      code: "rate_limited",
      message: "That is a lot of lookups in one go. Wait a moment and try again, or give us a call.",
    });
  }

  if (!process.env.DVLA_API_KEY) {
    // Not the customer's problem, and not something to expose. The wizard
    // treats "unavailable" as "carry on by hand".
    return res.status(503).json({
      success: false,
      code: "unavailable",
      message: "Our registration lookup is unavailable right now. You can enter the details yourself.",
    });
  }

  try {
    const response = await dvlaLookup(registration, process.env.DVLA_API_KEY);

    if (response.status === 404) {
      return res.status(404).json({
        success: false,
        code: "not_found",
        message: "We could not find that registration with DVLA. Check it, or enter the details yourself.",
      });
    }

    if (response.status !== 200) {
      // 403 (bad key), 429 (DVLA throttling us) and anything else all land the
      // customer in the same place: enter it by hand. The detail is logged for
      // us, not returned to them.
      console.error("DVLA public valuation lookup failed:", response.status, response.data);
      return res.status(502).json({
        success: false,
        code: "unavailable",
        message: "Our registration lookup is unavailable right now. You can enter the details yourself.",
      });
    }

    const dvla = JSON.parse(response.data);
    return res.status(200).json({ success: true, vehicle: publicVehicle(dvla, registration) });
  } catch (error) {
    console.error("DVLA public valuation lookup error:", error?.code || error?.message);
    return res.status(502).json({
      success: false,
      code: "unavailable",
      message: "Our registration lookup is unavailable right now. You can enter the details yourself.",
    });
  }
}
