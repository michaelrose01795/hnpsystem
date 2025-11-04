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

  // ✅ State management
  const [jobData, setJobData] = useState(null);
  const [writeUpData, setWriteUpData] = useState({
    fault: "",
    caused: "",
    rectification: "",
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

  // ✅ Fetch job and write-up data on component mount
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

  // ✅ Handle checkbox changes for qty and booked arrays
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
        
        // Navigate based on user role
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

  // ✅ Navigation helpers
  const goBackToJobCard = () => {
    if (isTech) {
      router.push(`/job-cards/myjobs/${jobNumber}`);
    } else {
      router.push(`/job-cards/${jobNumber}`);
    }
  };

  const goToCheckSheet = () => router.push(`/job-cards/${jobNumber}/check-box`);
  const goToVehicleDetails = () => router.push(`/job-cards/${jobNumber}/car-details`);

  // ✅ Loading state with spinner animation
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
            borderTop: "4px solid #d10000",
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
      <div style={{ 
        height: "100%", 
        display: "flex", 
        flexDirection: "column", 
        padding: "8px 16px",
        overflow: "hidden" 
      }}>
        
        {/* ✅ Header Section */}
        {jobData && (
          <div style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginBottom: "12px",
            padding: "12px",
            backgroundColor: "#fff",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
            flexShrink: 0
          }}>
            <button
              onClick={goBackToJobCard}
              style={{
                padding: "10px 24px",
                backgroundColor: "#d10000",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                boxShadow: "0 4px 10px rgba(209,0,0,0.16)",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
            >
              ← Back
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{ 
                color: "#d10000", 
                fontSize: "28px", 
                fontWeight: "700",
                margin: "0 0 4px 0"
              }}>
                Write-Up - Job #{jobNumber}
              </h1>
              <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
                {jobData.customer?.firstName} {jobData.customer?.lastName} | {jobData.vehicle?.reg}
              </p>
            </div>
          </div>
        )}

        {/* ✅ Main Content Area with Scrolling */}
        <div style={{ 
          flex: 1,
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
          border: "1px solid #ffe5e5",
          background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
          padding: "24px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0
        }}>
          
          <div style={{ 
            flex: 1, 
            overflowY: "auto", 
            paddingRight: "8px", 
            minHeight: 0 
          }}>
            <div style={{ 
              display: "flex", 
              gap: "16px",
              height: "100%"
            }}>
              
              {/* ✅ Left Section - Fault, Caused, Rectification (Full Height) */}
              <div style={{ 
                flex: 3, 
                display: "flex", 
                flexDirection: "column", 
                gap: "16px",
                height: "100%"
              }}>
                {["fault", "caused", "rectification"].map((field, index) => (
                  <div
                    key={field}
                    style={{
                      backgroundColor: "white",
                      padding: "20px",
                      borderRadius: "8px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                      border: "1px solid #ffe5e5",
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      minHeight: 0
                    }}
                  >
                    <h3 style={{ 
                      marginTop: 0, 
                      marginBottom: "12px",
                      color: "#d10000", 
                      textTransform: "capitalize",
                      fontSize: "18px",
                      fontWeight: "600",
                      flexShrink: 0
                    }}>
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
                        resize: "none",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        outline: "none",
                        transition: "border-color 0.2s",
                        minHeight: 0
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "#d10000"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
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
                      boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                      border: "1px solid #ffe5e5"
                    }}
                  >
                    <label style={{ 
                      fontSize: "14px", 
                      fontWeight: "600", 
                      color: "#333", 
                      display: "block", 
                      marginBottom: "8px" 
                    }}>
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
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                        transition: "border-color 0.2s"
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "#d10000"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
                    />
                  </div>
                ))}

                {/* Technical Bulletins */}
                <div
                  style={{
                    backgroundColor: "white",
                    padding: "16px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                    border: "1px solid #ffe5e5"
                  }}
                >
                  <label style={{ 
                    fontSize: "14px", 
                    fontWeight: "600", 
                    color: "#333", 
                    display: "block", 
                    marginBottom: "8px" 
                  }}>
                    Technical Bulletins
                  </label>
                  <textarea
                    value={writeUpData.technicalBulletins}
                    onChange={(e) => handleChange("technicalBulletins", e.target.value)}
                    style={{ 
                      width: "100%", 
                      padding: "10px 12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      resize: "vertical",
                      minHeight: "80px",
                      fontFamily: "inherit",
                      outline: "none",
                      transition: "border-color 0.2s"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#d10000"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
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
                      boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                      border: "1px solid #ffe5e5"
                    }}
                  >
                    <label style={{ 
                      fontSize: "14px", 
                      fontWeight: "600", 
                      color: "#333", 
                      display: "block", 
                      marginBottom: "8px" 
                    }}>
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
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                        transition: "border-color 0.2s"
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "#d10000"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
                    />
                  </div>
                ))}

                {/* Additional Parts */}
                <div
                  style={{
                    backgroundColor: "white",
                    padding: "16px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                    border: "1px solid #ffe5e5"
                  }}
                >
                  <label style={{ 
                    fontSize: "14px", 
                    fontWeight: "600", 
                    color: "#333", 
                    display: "block", 
                    marginBottom: "8px" 
                  }}>
                    Additional Parts
                  </label>
                  <textarea
                    value={writeUpData.additionalParts}
                    onChange={(e) => handleChange("additionalParts", e.target.value)}
                    style={{ 
                      width: "100%", 
                      padding: "10px 12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      resize: "vertical",
                      minHeight: "80px",
                      fontFamily: "inherit",
                      outline: "none",
                      transition: "border-color 0.2s"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#d10000"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
                  />
                </div>

                {/* Qty / Booked Checkboxes */}
                <div style={{ display: "flex", gap: "16px" }}>
                  {["qty", "booked"].map((field) => (
                    <div
                      key={field}
                      style={{
                        flex: 1,
                        backgroundColor: "white",
                        padding: "16px",
                        borderRadius: "8px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                        border: "1px solid #ffe5e5"
                      }}
                    >
                      <h4 style={{ 
                        marginTop: 0, 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: "#d10000", 
                        marginBottom: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em"
                      }}>
                        {field}
                      </h4>
                      {writeUpData[field].map((checked, idx) => (
                        <label 
                          key={idx} 
                          style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            marginBottom: "8px",
                            cursor: "pointer"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleCheckboxChange(field, idx)}
                            style={{ 
                              marginRight: "8px", 
                              width: "16px", 
                              height: "16px",
                              cursor: "pointer",
                              accentColor: "#d10000"
                            }}
                          />
                          <span style={{ fontSize: "13px", color: "#666" }}>Item {idx + 1}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Bottom Action Bar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 2fr",
          gap: "12px",
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "2px solid #ffd6d6",
          flexShrink: 0
        }}>
          <button 
            onClick={goBackToJobCard} 
            style={{
              padding: "14px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 8px rgba(108,117,125,0.18)",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#5a6268")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#6c757d")}
          >
            ← Back to Job
          </button>
          
          <button 
            onClick={goToCheckSheet} 
            style={{
              padding: "14px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 8px rgba(209,0,0,0.18)",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
          >
            📋 Check Sheet
          </button>
          
          <button 
            onClick={goToVehicleDetails} 
            style={{
              padding: "14px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 8px rgba(209,0,0,0.18)",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
          >
            🚗 Vehicle Details
          </button>
          
          <button 
            onClick={handleSave} 
            style={{
              padding: "14px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 8px rgba(16,185,129,0.18)",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#059669")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#10b981")}
          >
            💾 Save Write-Up
          </button>
        </div>
      </div>
    </Layout>
  );
}