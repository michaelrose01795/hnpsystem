// file location: src/pages/api/vehicles/dvla.js
import { createClient } from "@supabase/supabase-js"; // import Supabase SDK

// initialise Supabase client using environment variables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { reg } = req.query; // get reg from query string

  if (!reg) {
    return res.status(400).json({ error: "Missing registration number" }); // if no reg, return 400
  }

  try {
    // 1️⃣ Try to find the vehicle in Supabase first
    const { data: existingVehicle, error: lookupError } = await supabase
      .from("vehicles")
      .select("*")
      .ilike("reg_number", reg); // case-insensitive search using correct column name

    if (lookupError) {
      console.error("Supabase lookup error:", lookupError.message);
    }

    // If vehicle already exists, return it immediately
    if (existingVehicle && existingVehicle.length > 0) {
      console.log("✅ Vehicle found in Supabase, returning existing record");
      const vehicle = { 
        registration: existingVehicle[0].reg_number, // front-end expects `registration`
        make: existingVehicle[0].make,
        model: existingVehicle[0].model,
        year: existingVehicle[0].year,
        vin: existingVehicle[0].vin,
        engine_number: existingVehicle[0].engine || "", // front-end expects `engine_number`
        foundInDVLA: true
      };
      return res.status(200).json(vehicle);
    }

    // 2️⃣ If not found, fetch from DVLA API
    const API_KEY = process.env.DVLA_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "DVLA API key not set" });
    }

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

    let data;
    let foundInDVLA = true;

    if (!response.ok) {
      console.warn("⚠️ DVLA lookup failed, using fallback:", await response.text());
      data = {
        registrationNumber: reg.toUpperCase(),
        make: "Not Provided",
        model: "Not Provided",
        vin: "Not Provided",
        engineNumber: "Not Provided",
        yearOfManufacture: null,
      };
      foundInDVLA = false; // fallback data used
    } else {
      data = await response.json();
    }

    // 3️⃣ Normalise data to match your table columns
    const newVehicle = {
      reg_number: data.registrationNumber || reg.toUpperCase(),
      make: data.make || "Not Provided",
      model: data.model || "Not Provided",
      year: data.yearOfManufacture || null,
      vin: data.vin || "Not Provided",
      engine: data.engineNumber || "Not Provided",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      foundInDVLA, // flag to indicate if DVLA API returned valid data
    };

    // 4️⃣ Insert the vehicle into Supabase for future lookups
    const { error: insertError } = await supabase
      .from("vehicles")
      .insert([newVehicle]);

    if (insertError) {
      console.error("❌ Error inserting vehicle into Supabase:", insertError.message);
    } else {
      console.log("✅ Vehicle inserted into Supabase successfully");
    }

    // 5️⃣ Return the final data in front-end friendly format
    return res.status(200).json({
      registration: newVehicle.reg_number,
      make: newVehicle.make,
      model: newVehicle.model,
      year: newVehicle.year,
      vin: newVehicle.vin,
      engine_number: newVehicle.engine,
      foundInDVLA: newVehicle.foundInDVLA,
    });

  } catch (error) {
    console.error("💥 DVLA API fetch failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
