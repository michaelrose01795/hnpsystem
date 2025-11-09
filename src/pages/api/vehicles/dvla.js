import https from 'https';

function makeHttpsRequest(registration, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ registrationNumber: registration });
    
    const options = {
      hostname: 'driver-vehicle-licensing.api.gov.uk',
      port: 443,
      path: '/vehicle-enquiry/v1/vehicles',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000 // 30 second timeout
    };

    const req = https.request(options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        resolve({
          status: response.statusCode,
          statusText: response.statusMessage,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      const error = new Error('Request timeout after 30 seconds');
      error.code = 'ETIMEDOUT';
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { registration } = req.body;
  
  if (!registration) {
    return res.status(400).json({ error: "No registration provided" });
  }

  if (!process.env.DVLA_API_KEY) {
    return res.status(500).json({ 
      error: "API key not configured",
      message: "DVLA_API_KEY is missing from environment variables",
      suggestion: "Please add DVLA_API_KEY to your .env.local file"
    });
  }

  try {
    console.log("🚗 Fetching vehicle data from DVLA for:", registration);
    
    const dvlaRes = await makeHttpsRequest(registration, process.env.DVLA_API_KEY);
    
    console.log("📡 DVLA API response status:", dvlaRes.status);

    if (dvlaRes.status !== 200) {
      console.error("❌ DVLA API error:", dvlaRes.data);
      
      if (dvlaRes.status === 404) {
        return res.status(404).json({ 
          error: "Vehicle not found",
          message: "No vehicle found with registration: " + registration,
          suggestion: "Please check the registration number is correct"
        });
      } else if (dvlaRes.status === 403) {
        return res.status(403).json({ 
          error: "API Authentication failed",
          message: "Your DVLA API key is invalid or expired",
          suggestion: "Please check your DVLA_API_KEY in .env.local file"
        });
      } else if (dvlaRes.status === 429) {
        return res.status(429).json({ 
          error: "Rate limit exceeded",
          message: "Too many requests to DVLA API",
          suggestion: "Please wait a moment and try again"
        });
      } else if (dvlaRes.status === 400) {
        return res.status(400).json({ 
          error: "Bad request",
          message: "Invalid registration format",
          suggestion: "Registration should be in format: AB12CDE"
        });
      } else {
        return res.status(dvlaRes.status).json({ 
          error: "DVLA API error",
          message: dvlaRes.data,
          statusCode: dvlaRes.status
        });
      }
    }

    const data = JSON.parse(dvlaRes.data);
    console.log("✅ Successfully retrieved vehicle data");
    
    return res.status(200).json(data);
    
  } catch (err) {
    console.error("❌ Server error calling DVLA API:", err);
    
    if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
      return res.status(504).json({
        error: "Connection timeout",
        message: "Cannot connect to DVLA API - connection timed out after 30 seconds",
        suggestion: "This is likely a network/firewall issue. Check if your network is blocking access to driver-vehicle-licensing.api.gov.uk"
      });
    }
    
    if (err.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: "DNS lookup failed",
        message: "Cannot resolve DVLA API hostname",
        suggestion: "Please check your internet connection."
      });
    }
    
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: "Connection refused",
        message: "DVLA API refused the connection",
        suggestion: "The DVLA API may be temporarily down."
      });
    }
    
    return res.status(500).json({
      error: "Server error",
      message: err.message || "An unexpected error occurred",
      errorCode: err.code || 'UNKNOWN',
      suggestion: "Network/firewall may be blocking connection to DVLA API. Try from a different network."
    });
  }
}

export default handler;