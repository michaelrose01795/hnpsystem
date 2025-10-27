// file location: src/pages/api/vehicles/dvla.js

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { registration } = req.body;
  
  if (!registration) {
    return res.status(400).json({ error: "No registration provided" });
  }

  if (!process.env.DVLA_API_KEY) {
    console.warn("⚠️ DVLA_API_KEY not found - returning mock data");
    
    return res.status(200).json({
      registrationNumber: registration.toUpperCase(),
      make: "FORD",
      model: "FOCUS ZETEC",
      colour: "BLUE",
      vin: "WF0AXXGCDA" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      engineNumber: "AB" + Math.floor(Math.random() * 100000),
      motTests: [
        {
          odometerValue: "45000",
          completedDate: "2024-01-15",
          testResult: "PASSED"
        }
      ],
      yearOfManufacture: 2018,
      engineCapacity: 1499,
      fuelType: "PETROL",
      _isMockData: true
    });
  }

  try {
    console.log("🚗 Fetching vehicle data from DVLA for:", registration);
    
    const dvlaRes = await fetch(
      "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
      {
        method: "POST",
        headers: {
          "x-api-key": process.env.DVLA_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ registrationNumber: registration }),
      }
    );

    console.log("📡 DVLA API response status:", dvlaRes.status);

    if (!dvlaRes.ok) {
      const text = await dvlaRes.text();
      console.error("❌ DVLA API error:", text);
      
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
          message: text,
          statusCode: dvlaRes.status
        });
      }
    }

    const data = await dvlaRes.json();
    console.log("✅ Successfully retrieved vehicle data");
    
    return res.status(200).json(data);
    
  } catch (err) {
    console.error("❌ Server error calling DVLA API:", err);
    console.error("Error details:", {
      message: err.message,
      stack: err.stack
    });
    
    return res.status(500).json({ 
      error: "Server error",
      message: err.message || "An unexpected error occurred",
      suggestion: "Check server console logs for more details"
    });
  }
}

export default handler;