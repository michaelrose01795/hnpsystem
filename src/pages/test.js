// file location: src/pages/test.js
"use client";

import React, { useState } from "react";

export default function TestPage() {
  const [vehicleDetails, setVehicleDetails] = useState({
    make: "",
    model: "",
    year: "",
    registration: "",
    mileage: "",
    vin: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch vehicle details from your server API
  const fetchVehicleDetails = async () => {
    if (!vehicleDetails.registration) {
      setError("Please enter a registration number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: vehicleDetails.registration }),
      });

      if (!res.ok) throw new Error("Failed to fetch vehicle details");

      const data = await res.json();

      setVehicleDetails({
        make: data.make || "",
        model: data.model || "",
        year: data.yearOfManufacture || "",
        registration: vehicleDetails.registration,
        mileage: data.motTests?.[0]?.odometerValue || "",
        vin: data.vin || "",
      });
    } catch (err) {
      console.error(err);
      setError("Error fetching vehicle details. Check registration or API key.");
    } finally {
      setLoading(false);
    }
  };

  // Handle manual changes
  const handleChange = (e) => {
    setVehicleDetails({ ...vehicleDetails, [e.target.name]: e.target.value });
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ color: "#FF4040", marginBottom: "1rem" }}>Test Vehicle Details</h1>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="Enter registration number"
          name="registration"
          value={vehicleDetails.registration}
          onChange={handleChange}
          style={{
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            flex: 1,
          }}
        />
        <button
          onClick={fetchVehicleDetails}
          style={{
            padding: "10px 20px",
            backgroundColor: "#FF4040",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {loading ? "Loading..." : "Fetch Vehicle Details"}
        </button>
      </div>

      {error && <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>}

      <form style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "400px" }}>
        <label>
          Make:
          <input
            type="text"
            name="make"
            value={vehicleDetails.make}
            onChange={handleChange}
            style={{ width: "100%", padding: "8px", borderRadius: "4px" }}
          />
        </label>

        <label>
          Model:
          <input
            type="text"
            name="model"
            value={vehicleDetails.model}
            onChange={handleChange}
            style={{ width: "100%", padding: "8px", borderRadius: "4px" }}
          />
        </label>

        <label>
          Year:
          <input
            type="text"
            name="year"
            value={vehicleDetails.year}
            onChange={handleChange}
            style={{ width: "100%", padding: "8px", borderRadius: "4px" }}
          />
        </label>

        <label>
          Mileage:
          <input
            type="text"
            name="mileage"
            value={vehicleDetails.mileage}
            onChange={handleChange}
            style={{ width: "100%", padding: "8px", borderRadius: "4px" }}
          />
        </label>

        <label>
          VIN:
          <input
            type="text"
            name="vin"
            value={vehicleDetails.vin}
            onChange={handleChange}
            style={{ width: "100%", padding: "8px", borderRadius: "4px" }}
          />
        </label>
      </form>
    </div>
  );
}
