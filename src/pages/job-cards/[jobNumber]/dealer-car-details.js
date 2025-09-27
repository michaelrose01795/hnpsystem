// src/pages/job-cards/[jobNumber]/dealer-car-details.js
"use client";

import React, { useState } from "react";
import Layout from "../../../components/Layout";
import { useRouter } from "next/router";

export default function DealerCarDetailsPage({ userRole = "staff" }) {
  const router = useRouter();
  const { jobNumber } = router.query;

  // Form state for dealer car details
  const [formData, setFormData] = useState({
    registration: "",
    make: "",
    model: "",
    year: "",
    colour: "",
    vin: "",
    engineNumber: "",
    mileage: "",
    fuelType: "",
    transmission: "",
    bodyStyle: "",
    MOTDue: "",
    serviceHistory: "",
    ownerName: "",
    address: "",
    email: "",
    phone: "",
    contactPreference: "",
    warrantyType: "",
    warrantyExpiry: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    engineOil: "",
    brakesCondition: "",
    tyresCondition: "",
    batteryStatus: "",
    suspension: "",
    electronics: "",
    airCon: "",
    warningLights: "",
    comments: ""
  });

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    console.log("Dealer Car Details Saved:", formData);
    // Redirect to job card page
    router.push(`/job-cards/${jobNumber}`);
  };

  const sectionStyle = {
    backgroundColor: "white",
    padding: "16px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    marginBottom: "24px"
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "16px"
  };

  const fieldStyle = { marginBottom: "8px" };
  const inputStyle = {
    width: "100%",
    padding: "6px 8px",
    borderRadius: "4px",
    border: "1px solid #ccc"
  };

  const buttonStyle = {
    flex: 1,
    padding: "12px",
    backgroundColor: "#FF4040",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1rem"
  };

  return (
    <Layout>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040", marginBottom: "16px" }}>
          Add Dealer Car Details – Job #{jobNumber}
        </h1>

        <div style={gridStyle}>
          {/* Vehicle Information */}
          <section style={sectionStyle}>
            <h2>Vehicle Information</h2>
            {[
              ["Registration", "registration"],
              ["Make", "make"],
              ["Model", "model"],
              ["Year", "year"],
              ["Colour", "colour"],
              ["VIN", "vin"],
              ["Engine Number", "engineNumber"],
              ["Mileage", "mileage"],
              ["Fuel Type", "fuelType"],
              ["Transmission", "transmission"],
              ["Body Style", "bodyStyle"],
              ["MOT Due", "MOTDue"],
              ["Service History", "serviceHistory"]
            ].map(([label, key]) => (
              <div key={key} style={fieldStyle}>
                <label><strong>{label}:</strong></label>
                <input
                  type="text"
                  style={inputStyle}
                  value={formData[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  disabled={userRole !== "tech"}
                />
              </div>
            ))}
          </section>

          {/* Owner / Customer Information */}
          <section style={sectionStyle}>
            <h2>Owner / Customer Information</h2>
            {[
              ["Full Name", "ownerName"],
              ["Address", "address"],
              ["Email", "email"],
              ["Phone", "phone"],
              ["Contact Preference", "contactPreference"]
            ].map(([label, key]) => (
              <div key={key} style={fieldStyle}>
                <label><strong>{label}:</strong></label>
                <input
                  type="text"
                  style={inputStyle}
                  value={formData[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  disabled={userRole !== "tech"}
                />
              </div>
            ))}
          </section>

          {/* Insurance & Warranty */}
          <section style={sectionStyle}>
            <h2>Insurance & Warranty</h2>
            {[
              ["Warranty Type", "warrantyType"],
              ["Warranty Expiry", "warrantyExpiry"],
              ["Insurance Provider", "insuranceProvider"],
              ["Insurance Policy Number", "insurancePolicyNumber"]
            ].map(([label, key]) => (
              <div key={key} style={fieldStyle}>
                <label><strong>{label}:</strong></label>
                <input
                  type="text"
                  style={inputStyle}
                  value={formData[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  disabled={userRole !== "tech"}
                />
              </div>
            ))}
          </section>

          {/* Technical / Engine */}
          <section style={sectionStyle}>
            <h2>Technical / Engine</h2>
            {[
              ["Engine Oil", "engineOil"],
              ["Brakes Condition", "brakesCondition"],
              ["Tyres Condition", "tyresCondition"],
              ["Battery Status", "batteryStatus"],
              ["Suspension", "suspension"],
              ["Electronics", "electronics"],
              ["Air Conditioning", "airCon"],
              ["Warning Lights", "warningLights"]
            ].map(([label, key]) => (
              <div key={key} style={fieldStyle}>
                <label><strong>{label}:</strong></label>
                <input
                  type="text"
                  style={inputStyle}
                  value={formData[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  disabled={userRole !== "tech"}
                />
              </div>
            ))}
          </section>
        </div>

        {/* Additional Comments */}
        <section style={sectionStyle}>
          <h2>Additional Comments / Notes</h2>
          <textarea
            style={{ ...inputStyle, minHeight: "80px" }}
            value={formData.comments}
            onChange={(e) => handleChange("comments", e.target.value)}
            disabled={userRole !== "tech"}
          />
        </section>

        {/* Bottom Navigation Buttons */}
        <div style={{ display: "flex", gap: "16px", marginTop: "24px" }}>
          {userRole === "tech" && (
            <button
              onClick={() => router.push(`/job-cards/${jobNumber}/vhc`)}
              style={buttonStyle}
            >
              Go to VHC
            </button>
          )}
          <button
            onClick={handleSave}
            style={buttonStyle}
          >
            Save Dealer Car Details
          </button>
        </div>
      </div>
    </Layout>
  );
}
