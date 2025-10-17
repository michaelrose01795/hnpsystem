// src/pages/api/vehicles/dvla.js
import fetch from "node-fetch";

// Make sure you store your DVLA API key in an environment variable
// e.g., DVLA_API_KEY in .env.local

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { reg } = req.query;

  if (!reg) {
    return res.status(400).json({ error: "Registration number is required" });
  }

  try {
    // Replace with your actual DVLA API endpoint
    const dvlaApiUrl = `https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles?registrationNumber=${reg}`;
    
    const response = await fetch(dvlaApiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.DVLA_API_KEY,
      },
    });

    if (!response.ok) {
      console.error("DVLA API error:", response.statusText);
      return res.status(500).json({ error: "Failed to fetch data from DVLA" });
    }

    const data = await response.json();

    // Format the data to match your frontend state
    const vehicleData = {
      reg: reg.toUpperCase(),
      makeModel: data.make + " " + data.model,
      colour: data.primaryColour || "",
      chassis: data.vin || "",
      engine: data.engineSize ? data.engineSize.toString() : "",
      mileage: data.mileage || "",
    };

    return res.status(200).json(vehicleData);
  } catch (error) {
    console.error("Server error fetching DVLA data:", error);
    return res.status(500).json({ error: "Server error fetching DVLA data" });
  }
}