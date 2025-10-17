// ✅ File location: src/pages/job-cards/[jobNumber]/write-up.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { getWriteUpByJobNumber, saveWriteUpToDatabase } from "../../../lib/database/jobs";

export default function WriteUpPage() {
  const router = useRouter();
  const { jobNumber } = router.query;

  const [writeUpData, setWriteUpData] = useState({
    fault: "",
    caused: "",
    ratification: "",
    warrantyClaim: "",
    tsrNumber: "",
    pwaNumber: "",
    technicalBulletins: "",
    technicalSignature: "",
    qualityControl: "",
    additionalParts: "",
    qty: Array(10).fill(false),
    booked: Array(10).fill(false),
  });

  const [loading, setLoading] = useState(true);

  // ✅ Fetch existing write-up if available
  useEffect(() => {
    if (!jobNumber) return;

    const fetchWriteUp = async () => {
      try {
        const data = await getWriteUpByJobNumber(jobNumber);
        if (data) {
          setWriteUpData((prev) => ({
            ...prev,
            ...data,
            qty: data.qty || Array(10).fill(false),
            booked: data.booked || Array(10).fill(false),
          }));
        }
      } catch (err) {
        console.error("Error fetching write-up:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWriteUp();
  }, [jobNumber]);

  // ✅ Handle text field updates
  const handleChange = (field, value) => {
    setWriteUpData((prev) => ({ ...prev, [field]: value }));
  };

  // ✅ Handle checkbox changes
  const handleCheckboxChange = (field, index) => {
    const updatedArray = [...writeUpData[field]];
    updatedArray[index] = !updatedArray[index];
    setWriteUpData((prev) => ({ ...prev, [field]: updatedArray }));
  };

  // ✅ Save data to database
  const handleSave = async () => {
    if (!jobNumber) return alert("Missing job number");

    try {
      const result = await saveWriteUpToDatabase(jobNumber, writeUpData);
      if (result?.success) {
        alert("✅ Write-up saved successfully!");
      } else {
        alert("❌ Failed to save write-up");
      }
    } catch (err) {
      console.error("Error saving write-up:", err);
      alert("❌ Error saving write-up");
    }
  };

  // ✅ Navigation helpers
  const goBackToJobCard = () => router.push(`/job-cards/${jobNumber}`);
  const goToCheckSheet = () => router.push(`/job-cards/${jobNumber}/check-box`);
  const goToVehicleDetails = () => router.push(`/job-cards/${jobNumber}/car-details`);

  if (loading)
    return (
      <Layout>
        <p style={{ padding: "20px" }}>Loading...</p>
      </Layout>
    );

  return (
    <Layout>
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "16px",
          display: "flex",
          gap: "16px",
        }}
      >
        {/* ✅ Left Section - Fault, Caused, Ratification */}
        <div style={{ flex: 3, display: "flex", flexDirection: "column", gap: "16px" }}>
          {["fault", "caused", "ratification"].map((field) => (
            <div
              key={field}
              style={{
                backgroundColor: "white",
                padding: "16px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#FF4040", textTransform: "capitalize" }}>
                {field}
              </h3>
              <textarea
                placeholder={`Enter ${field} details...`}
                value={writeUpData[field]}
                onChange={(e) => handleChange(field, e.target.value)}
                style={{ flex: 1, padding: "8px", width: "100%", resize: "none" }}
              />
            </div>
          ))}
        </div>

        {/* ✅ Right Section - Other details */}
        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Warranty / TSR / PWA */}
          {[
            { label: "Warranty Claim Number", field: "warrantyClaim" },
            { label: "TSR Number", field: "tsrNumber" },
            { label: "PWA Number", field: "pwaNumber" },
          ].map(({ label, field }) => (
            <div
              key={field}
              style={{
                backgroundColor: "white",
                padding: "16px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <label>
                {label}
                <input
                  type="text"
                  value={writeUpData[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  style={{ width: "100%", padding: "6px", marginTop: "4px" }}
                />
              </label>
            </div>
          ))}

          {/* Technical Bulletins */}
          <div
            style={{
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <label>
              Technical Bulletins
              <textarea
                value={writeUpData.technicalBulletins}
                onChange={(e) => handleChange("technicalBulletins", e.target.value)}
                style={{ width: "100%", padding: "6px", marginTop: "4px", resize: "none" }}
              />
            </label>
          </div>

          {/* Technical Signature & Quality Control */}
          {[
            { label: "Technical Signature", field: "technicalSignature" },
            { label: "Quality Control", field: "qualityControl" },
          ].map(({ label, field }) => (
            <div
              key={field}
              style={{
                backgroundColor: "white",
                padding: "16px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <label>
                {label}
                <input
                  type="text"
                  value={writeUpData[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  style={{ width: "100%", padding: "6px", marginTop: "4px" }}
                />
              </label>
            </div>
          ))}

          {/* Additional Parts */}
          <div
            style={{
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <label>
              Additional Parts
              <textarea
                value={writeUpData.additionalParts}
                onChange={(e) => handleChange("additionalParts", e.target.value)}
                style={{ width: "100%", padding: "6px", marginTop: "4px", resize: "none" }}
              />
            </label>
          </div>

          {/* Qty / Booked */}
          <div style={{ display: "flex", gap: "16px" }}>
            {["qty", "booked"].map((field) => (
              <div
                key={field}
                style={{
                  flex: 1,
                  backgroundColor: "white",
                  padding: "16px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                <h4 style={{ marginTop: 0 }}>{field.toUpperCase()}</h4>
                {writeUpData[field].map((checked, idx) => (
                  <label key={idx} style={{ display: "block" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleCheckboxChange(field, idx)}
                      style={{ marginRight: "8px" }}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ✅ Bottom Buttons */}
      <div
        style={{
          maxWidth: "1400px",
          margin: "24px auto 0 auto",
          display: "flex",
          gap: "12px",
        }}
      >
        <button onClick={goBackToJobCard} style={btnStyle}>
          Back to Job Card
        </button>
        <button onClick={goToCheckSheet} style={btnStyle}>
          Check Sheet
        </button>
        <button onClick={goToVehicleDetails} style={btnStyle}>
          Vehicle Details
        </button>
        <button onClick={handleSave} style={{ ...btnStyle, backgroundColor: "green" }}>
          Save Write-Up
        </button>
      </div>
    </Layout>
  );
}

// ✅ Reusable button style
const btnStyle = {
  flex: 1,
  padding: "12px",
  backgroundColor: "#FF4040",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
};