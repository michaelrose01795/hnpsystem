// file location: src/pages/job-cards/create/index.js
"use client";

import React, { useState } from "react";

export default function CreateJobCardPage() {
  const [vehicle, setVehicle] = useState({
    make: "",
    model: "",
    year: "",
    registration: "",
    mileage: "",
    vin: "",
  });
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchVehicleDetails = async () => {
    if (!vehicle.registration.trim()) {
      setError("Please enter a registration number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api//vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: vehicle.registration }),
      });

      if (!res.ok) throw new Error("Failed to fetch vehicle details");

      const data = await res.json();

      setVehicle({
        make: data.make || "No data provided",
        model: data.model || "No data provided",
        year: data.yearOfManufacture || "No data provided",
        registration: vehicle.registration,
        mileage: data.motTests?.[0]?.odometerValue || "",
        vin: data.vin || "No data provided",
      });
    } catch (err) {
      console.error(err);
      setError("Error fetching vehicle details. Check registration or API key.");

      // Fill fields with fallback text except mileage
      setVehicle({
        make: "No data provided",
        model: "No data provided",
        year: "No data provided",
        registration: vehicle.registration,
        mileage: vehicle.mileage || "",
        vin: "No data provided",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setVehicle({ ...vehicle, [e.target.name]: e.target.value });
  };

  const handleSaveJob = () => {
    if (!vehicle.registration.trim()) return alert("Enter vehicle registration!");
    if (!customerName.trim()) return alert("Enter customer name!");
    alert(`Job saved for ${customerName}, vehicle: ${vehicle.make} ${vehicle.model}`);
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ color: "#FF4040", marginBottom: "1rem" }}>Create Job Card</h1>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "10px" }}>
        <input
          type="text"
          name="registration"
          value={vehicle.registration}
          onChange={handleChange}
          style={{
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            flex: 1,
            textTransform: "uppercase",
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

      <div style={{ marginBottom: "1rem" }}>
        <label>
          Customer Name:
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "4px" }}
          />
        </label>
      </div>

      <form style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "400px" }}>
        <label>
          Make:
          <input type="text" name="make" value={vehicle.make} onChange={handleChange} />
        </label>

        <label>
          Model:
          <input type="text" name="model" value={vehicle.model} onChange={handleChange} />
        </label>

        <label>
          Year:
          <input type="text" name="year" value={vehicle.year} onChange={handleChange} />
        </label>

        <label>
          Mileage:
          <input type="text" name="mileage" value={vehicle.mileage} onChange={handleChange} />
        </label>

        <label>
          VIN:
          <input type="text" name="vin" value={vehicle.vin} onChange={handleChange} />
        </label>
      </form>

      <div style={{ marginTop: "1.5rem" }}>
        <button
          onClick={handleSaveJob}
          style={{
            padding: "12px 24px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Save Job
        </button>
      </div>
    </div>
  );
}
