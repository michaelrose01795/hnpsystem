// file location: src/pages/api/vehicles/dvla.js
export const runtime = "nodejs"; // Ensure Vercel executes this API route in the Node.js runtime for HTTPS support

import https from "https"; // Node.js HTTPS module used to communicate with the DVLA API securely

// Helper that performs the DVLA POST request and resolves with the raw response payload
function makeHttpsRequest(registration, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ registrationNumber: registration }); // DVLA endpoint expects the registration number in a JSON payload

    const options = {
      hostname: "driver-vehicle-licensing.api.gov.uk", // Official DVLA hostname for vehicle lookups
      port: 443, // HTTPS port
      path: "/vehicle-enquiry/v1/vehicles", // DVLA vehicle enquiry endpoint path
      method: "POST", // DVLA endpoint requires POST
      headers: {
        "x-api-key": apiKey, // Provide caller DVLA API key
        "Content-Type": "application/json", // Inform DVLA we are sending JSON payload
        "Content-Length": Buffer.byteLength(postData), // Exact byte length required for Node HTTPS
      },
      timeout: 30000, // 30 second timeout to avoid hanging requests
    };

    const req = https.request(options, (response) => {
      let data = ""; // Accumulate streamed response data

      response.on("data", (chunk) => {
        data += chunk; // Append each chunk into a single string
      });

      response.on("end", () => {
        resolve({
          status: response.statusCode, // Numeric DVLA status code
          statusText: response.statusMessage, // Human readable status
          data, // Raw response body string for downstream parsing
        });
      });
    });

    req.on("error", (error) => {
      reject(error); // Bubble up network or request errors
    });

    req.on("timeout", () => {
      req.destroy(); // Abort the request when the timeout triggers
      const error = new Error("Request timeout after 30 seconds"); // Provide descriptive timeout error
      error.code = "ETIMEDOUT"; // Align with Node timeout error conventions
      reject(error); // Reject promise with timeout error so caller can respond
    });

    req.write(postData); // Send JSON payload to DVLA
    req.end(); // Finalise the request stream
  });
}

// Primary API route handler consumed by the Next.js runtime
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" }); // Restrict the endpoint to POST requests only
  }

  const { registration } = req.body; // Extract vehicle registration from the request body

  if (!registration) {
    return res.status(400).json({ error: "No registration provided" }); // Guard against missing registration input
  }

  if (!process.env.DVLA_API_KEY) {
    return res.status(500).json({
      error: "API key not configured", // Inform caller the API key is missing
      message: "DVLA_API_KEY is missing from environment variables", // Helpful message describing the issue
      suggestion: "Please add DVLA_API_KEY to your .env.local file", // Guidance on how to resolve
    });
  }

  try {
    console.log("🚗 Fetching vehicle data from DVLA for:", registration); // Log outbound DVLA lookup for observability

    const dvlaRes = await makeHttpsRequest(registration, process.env.DVLA_API_KEY); // Perform the HTTPS request to DVLA

    console.log("📡 DVLA API response status:", dvlaRes.status); // Record returned status code for debugging

    if (dvlaRes.status !== 200) {
      console.error("❌ DVLA API error:", dvlaRes.data); // Emit the raw response when the call fails

      if (dvlaRes.status === 404) {
        return res.status(404).json({
          error: "Vehicle not found", // DVLA indicates registration unknown
          message: "No vehicle found with registration: " + registration, // Include attempted registration
          suggestion: "Please check the registration number is correct", // Provide next steps for user
        });
      } else if (dvlaRes.status === 403) {
        return res.status(403).json({
          error: "API Authentication failed", // DVLA rejected API key
          message: "Your DVLA API key is invalid or expired", // Clarify cause of failure
          suggestion: "Please check your DVLA_API_KEY in .env.local file", // Suggest corrective action
        });
      } else if (dvlaRes.status === 429) {
        return res.status(429).json({
          error: "Rate limit exceeded", // DVLA throttle triggered
          message: "Too many requests to DVLA API", // Describe issue to caller
          suggestion: "Please wait a moment and try again", // Encourage retry after delay
        });
      } else if (dvlaRes.status === 400) {
        return res.status(400).json({
          error: "Bad request", // DVLA flagged input format issue
          message: "Invalid registration format", // Provide reason for failure
          suggestion: "Registration should be in format: AB12CDE", // Share expected format for UK registrations
        });
      }

      return res.status(dvlaRes.status).json({
        error: "DVLA API error", // Fallback error descriptor for unhandled DVLA statuses
        message: dvlaRes.data, // Forward raw DVLA response for debugging
        statusCode: dvlaRes.status, // Include DVLA status code for reference
      });
    }

    const data = JSON.parse(dvlaRes.data); // Parse the successful DVLA JSON payload into an object
    console.log("✅ Successfully retrieved vehicle data"); // Log success for observability

    return res.status(200).json(data); // Respond with the DVLA payload to the client
  } catch (err) {
    console.error("❌ Server error calling DVLA API:", err); // Capture unexpected server-side errors

    if (err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT") {
      return res.status(504).json({
        error: "Connection timeout", // Timeout reaching DVLA
        message: "Cannot connect to DVLA API - connection timed out after 30 seconds", // Provide context for user
        suggestion: "This is likely a network/firewall issue. Check if your network is blocking access to driver-vehicle-licensing.api.gov.uk", // Suggest remediation steps
      });
    }

    if (err.code === "ENOTFOUND") {
      return res.status(503).json({
        error: "DNS lookup failed", // DNS resolution failure
        message: "Cannot resolve DVLA API hostname", // Explain the root cause
        suggestion: "Please check your internet connection.", // Provide action for caller
      });
    }

    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "Connection refused", // DVLA host rejected the connection
        message: "DVLA API refused the connection", // Summarise the issue
        suggestion: "The DVLA API may be temporarily down.", // Suggest potential cause
      });
    }

    return res.status(500).json({
      error: "Server error", // Default fallback error descriptor
      message: err.message || "An unexpected error occurred", // Provide best available error message
      errorCode: err.code || "UNKNOWN", // Include Node error code when available
      suggestion: "Network/firewall may be blocking connection to DVLA API. Try from a different network.", // Offer troubleshooting tip
    });
  }
}
