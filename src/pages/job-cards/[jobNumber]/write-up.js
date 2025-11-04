// file location: src/pages/job-cards/[jobNumber]/write-up.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { 
  getWriteUpByJobNumber, 
  saveWriteUpToDatabase,
  getJobByNumber 
} from "../../../lib/database/jobs";
import { useUser } from "../../../context/UserContext";
import { usersByRole } from "../../../config/users";

export default function WriteUpPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const { user } = useUser();

  const [jobData, setJobData] = useState(null);
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

  const username = user?.username;
  const techsList = usersByRole["Techs"] || [];
  const isTech = techsList.includes(username);

  // ✅ Fetch job and write-up data
  useEffect(() => {
    if (!jobNumber) return;

    const fetchData = async () => {
      try {
        // Fetch job details
        const { data: job } = await getJobByNumber(jobNumber);
        if (job) {
          setJobData(job);
        }

        // Fetch existing write-up if available
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
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
        
        // ✅ UPDATED: Navigate based on user role
        if (isTech) {
          router.push(`/job-cards/myjobs/${jobNumber}`);
        } else {
          router.push(`/job-cards/${jobNumber}`);
        }
      } else {
        alert("❌ Failed to save write-up");
      }
    } catch (err) {
      console.error("Error saving write-up:", err);
      alert("❌ Error saving write-up");
    }
  };

  // ✅ Navigation helpers - UPDATED
  const goBackToJobCard = () => {
    if (isTech) {
      router.push(`/job-cards/myjobs/${jobNumber}`);
    } else {
      router.push(`/job-cards/${jobNumber}`);
    }
  };

  const goToCheckSheet = () => router.push(`/job-cards/${jobNumber}/check-box`);
  const goToVehicleDetails = () => router.push(`/job-cards/${jobNumber}/car-details`);

  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "80vh",
          flexDirection: "column",
          gap: "16px"
        }}>
          <div style={{
            width: "60px",
            height: "60px",
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #FF4040",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "#666" }}>Loading write-up...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header with job info */}
      {jobData && (
        <div style={{
          maxWidth: "1400px",
          margin: "0 auto 16px auto",
          padding: "16px 16px 0 16px"
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "16px 24px",
            borderRadius: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            border: "1px solid #e0e0e0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#FF4040", margin: "0 0 4px 0" }}>
                Write-Up - Job #{jobNumber}
              </h2>
              <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
                {jobData.customer?.firstName} {jobData.customer?.lastName} | {jobData.vehicle?.reg}
              </p>
            </div>
            <button
              onClick={goBackToJobCard}
              style={{
                padding: "10px 20px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}
            >
              ← Back to Job
            </button>
          </div>
        </div>
      )}

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
                style={{ 
                  flex: 1, 
                  padding: "12px", 
                  width: "100%", 
                  resize: "vertical",
                  minHeight: "150px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontFamily: "inherit"
                }}
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
              <label style={{ fontSize: "14px", fontWeight: "600", color: "#333", display: "block", marginBottom: "8px" }}>
                {label}
              </label>
              <input
                type="text"
                value={writeUpData[field]}
                onChange={(e) => handleChange(field, e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px 12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "6px",
                  fontSize: "14px"
                }}
              />
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
            <label style={{ fontSize: "14px", fontWeight: "600", color: "#333", display: "block", marginBottom: "8px" }}>
              Technical Bulletins
            </label>
            <textarea
              value={writeUpData.technicalBulletins}
              onChange={(e) => handleChange("technicalBulletins", e.target.value)}
              style={{ 
                width: "100%", 
                padding: "10px 12px",
                border: "1px solid #e0e0e0",
                borderRadius: "6px",
                fontSize: "14px",
                resize: "vertical",
                minHeight: "80px",
                fontFamily: "inherit"
              }}
            />
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
              <label style={{ fontSize: "14px", fontWeight: "600", color: "#333", display: "block", marginBottom: "8px" }}>
                {label}
              </label>
              <input
                type="text"
                value={writeUpData[field]}
                onChange={(e) => handleChange(field, e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px 12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "6px",
                  fontSize: "14px"
                }}
              />
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
            <label style={{ fontSize: "14px", fontWeight: "600", color: "#333", display: "block", marginBottom: "8px" }}>
              Additional Parts
            </label>
            <textarea
              value={writeUpData.additionalParts}
              onChange={(e) => handleChange("additionalParts", e.target.value)}
              style={{ 
                width: "100%", 
                padding: "10px 12px",
                border: "1px solid #e0e0e0",
                borderRadius: "6px",
                fontSize: "14px",
                resize: "vertical",
                minHeight: "80px",
                fontFamily: "inherit"
              }}
            />
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
                <h4 style={{ marginTop: 0, fontSize: "14px", fontWeight: "600", color: "#333", marginBottom: "12px" }}>
                  {field.toUpperCase()}
                </h4>
                {writeUpData[field].map((checked, idx) => (
                  <label key={idx} style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleCheckboxChange(field, idx)}
                      style={{ marginRight: "8px", width: "16px", height: "16px" }}
                    />
                    <span style={{ fontSize: "13px", color: "#666" }}>Item {idx + 1}</span>
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
          padding: "0 16px 16px 16px",
          display: "flex",
          gap: "12px",
        }}
      >
        <button 
          onClick={goBackToJobCard} 
          style={{
            ...btnStyle,
            backgroundColor: "#6c757d"
          }}
        >
          Back to My Jobs {/* ✅ UPDATED: Changed button text */}
        </button>
        <button 
          onClick={goToCheckSheet} 
          style={btnStyle}
        >
          Check Sheet
        </button>
        <button 
          onClick={goToVehicleDetails} 
          style={btnStyle}
        >
          Vehicle Details
        </button>
        <button 
          onClick={handleSave} 
          style={{ 
            ...btnStyle, 
            backgroundColor: "#10b981",
            flex: 2
          }}
        >
          💾 Save Write-Up
        </button>
      </div>
    </Layout>
  );
}

// ✅ Reusable button style
const btnStyle = {
  flex: 1,
  padding: "14px 20px",
  backgroundColor: "#FF4040",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "600",
  transition: "background-color 0.2s"
};