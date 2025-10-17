// ✅ File: src/pages/api/vehicles/dvla.js
export default async function handler(req, res) {
  const { reg } = req.query;

  if (!reg) {
    return res.status(400).json({ error: "Missing registration number" });
  }

  try {
    // ✅ Use your DVLA API key from .env.local
    const API_KEY = process.env.DVLA_API_KEY;

    if (!API_KEY) {
      return res
        .status(500)
        .json({ error: "DVLA API key not set in environment" });
    }

    // ✅ Use built-in fetch (no need for node-fetch)
    const response = await fetch(
      "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
      {
        method: "POST",
        headers: {
          "x-api-key": API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ registrationNumber: reg }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: "DVLA API request failed",
        details: errorText,
      });
    }

    const data = await response.json();

    return res.status(200).json({
      registration: data.registrationNumber || "",
      make: data.make || "",
      model: data.model || "",
      colour: data.colour || "",
      vin: data.vin || "",
      engine_number: data.engineNumber || "",
      fuelType: data.fuelType || "",
      motExpiry: data.motExpiryDate || "",
      taxDue: data.taxDueDate || "",
    });
  } catch (error) {
    console.error("DVLA API fetch failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
