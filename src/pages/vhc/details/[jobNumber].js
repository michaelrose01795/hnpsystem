// file location: src/pages/vhc/details/[jobNumber].js
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import Layout from "../../../components/Layout";
import { 
  getVHCChecksByJob, 
  createVHCCheck, 
  updateVHCCheck, 
  deleteVHCCheck 
} from "../../../lib/database/vhc";
import { getJobByNumber } from "../../../lib/database/jobs";

// ✅ Status color mapping
const STATUS_COLORS = {
  "Outstanding": "#9ca3af",
  "Accepted": "#d10000",
  "In Progress": "#3b82f6",
  "Awaiting Authorization": "#fbbf24",
  "Authorized": "#9333ea",
  "Ready": "#10b981",
  "Carry Over": "#f97316",
  "Complete": "#06b6d4",
  "Sent": "#8b5cf6",
  "Viewed": "#06b6d4",
};

// ✅ Helper function to get customer name
const getCustomerName = (customer) => {
  if (!customer) return "N/A";
  if (typeof customer === "string") return customer;
  if (typeof customer === "object") {
    return `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.email || "N/A";
  }
  return "N/A";
};

export default function VHCDetails() {
  const router = useRouter();
  const { jobNumber } = router.query;
  
  const [jobData, setJobData] = useState(null);
  const [vhcChecks, setVhcChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");
  const [selectedItems, setSelectedItems] = useState([]);
  const [vhcStatus, setVhcStatus] = useState("Outstanding");

  // ✅ Fetch job and VHC data
  useEffect(() => {
    if (!jobNumber) return;

    const fetchData = async () => {
      setLoading(true);
      console.log("🔍 Fetching VHC data for job:", jobNumber);

      try {
        // ✅ Fetch job details
        const { data: job, error: jobError } = await getJobByNumber(jobNumber);
        
        if (jobError || !job) {
          console.error("❌ Job not found:", jobError);
          setLoading(false);
          return;
        }

        console.log("✅ Job found:", job);
        setJobData(job);

        // ✅ Fetch VHC checks
        const checks = await getVHCChecksByJob(job.id);
        console.log("✅ VHC checks found:", checks.length);
        setVhcChecks(checks);

        // ✅ Determine VHC status based on checks
        if (checks.length === 0) {
          setVhcStatus("Outstanding");
        } else if (checks.some(c => c.section === "Brakes" || c.section === "Red")) {
          setVhcStatus("In Progress");
        } else {
          setVhcStatus("Complete");
        }

      } catch (error) {
        console.error("❌ Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jobNumber]);

  // ✅ Calculate totals from VHC checks
  const calculateTotals = () => {
    const redItems = vhcChecks.filter(c => c.section === "Brakes" && c.measurement);
    const amberItems = vhcChecks.filter(c => c.section === "Tyres" && c.measurement);
    
    const redTotal = redItems.reduce((sum, item) => {
      const price = parseFloat(item.measurement) || 0;
      return sum + price;
    }, 0);

    const amberTotal = amberItems.reduce((sum, item) => {
      const price = parseFloat(item.measurement) || 0;
      return sum + price;
    }, 0);

    return {
      redWork: redTotal.toFixed(2),
      amberWork: amberTotal.toFixed(2),
      authorized: "0.00",
      declined: "0.00"
    };
  };

  const totals = calculateTotals();

  // ✅ Handle send VHC
  const handleSendVHC = async () => {
    const incompleteItems = vhcChecks.filter(c => 
      (c.section === "Brakes" || c.section === "Tyres") && !c.measurement
    );

    if (incompleteItems.length > 0) {
      alert("⚠️ Please add measurements to all items before sending VHC");
      return;
    }

    const confirmed = confirm(
      `Send VHC to customer?\n\n` +
      `Job: ${jobNumber}\n` +
      `Customer: ${getCustomerName(jobData?.customer)}\n` +
      `Red Work: £${totals.redWork}\n` +
      `Amber Work: £${totals.amberWork}`
    );

    if (confirmed) {
      setVhcStatus("Sent");
      alert("✅ VHC sent to customer!");
    }
  };

  // ✅ Loading state
  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "100%",
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
          <p style={{ color: "#666", fontSize: "16px" }}>Loading VHC details...</p>
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

  // ✅ No data found
  if (!jobData) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center", 
          justifyContent: "center", 
          height: "100%",
          gap: "16px"
        }}>
          <div style={{ fontSize: "60px" }}>⚠️</div>
          <p style={{ color: "#666", fontSize: "18px", fontWeight: "600" }}>
            Job not found
          </p>
          <p style={{ color: "#999", fontSize: "14px" }}>
            Job #{jobNumber} could not be loaded
          </p>
          <button
            onClick={() => router.push("/vhc/dashboard")}
            style={{
              padding: "12px 24px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
          >
            Back to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  const statusColor = STATUS_COLORS[vhcStatus] || "#9ca3af";

  // ✅ Group checks by section
  const checksBySection = vhcChecks.reduce((acc, check) => {
    if (!acc[check.section]) {
      acc[check.section] = [];
    }
    acc[check.section].push(check);
    return acc;
  }, {});

  return (
    <Layout>
      <div style={{ 
        height: "100%", 
        display: "flex", 
        flexDirection: "column", 
        padding: "16px",
        overflow: "hidden" 
      }}>
        {/* Header */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "16px",
          flexShrink: 0
        }}>
          <button
            onClick={() => router.push("/vhc/dashboard")}
            style={{
              padding: "10px 20px",
              backgroundColor: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#f5f5f5";
              e.target.style.borderColor = "#d0d0d0";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#fff";
              e.target.style.borderColor = "#e0e0e0";
            }}
          >
            ← Back
          </button>
          
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
            VHC Details - {jobNumber}
          </h1>
          
          <button
            onClick={handleSendVHC}
            style={{
              padding: "12px 24px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
          >
            📤 Send VHC
          </button>
        </div>

        {/* Vehicle Info Card */}
        <div style={{
          background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
          border: "1px solid #ffe5e5",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: "16px",
          flexShrink: 0
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            {/* Left side */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{
                  backgroundColor: statusColor,
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  {vhcStatus}
                </div>
                <h2 style={{ fontSize: "32px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
                  {jobData.reg || "N/A"}
                </h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
                  <strong>Vehicle:</strong> {jobData.makeModel || "N/A"}
                </p>
                <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
                  <strong>Customer:</strong> {getCustomerName(jobData.customer)}
                </p>
                {jobData.mileage && (
                  <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
                    <strong>Mileage:</strong> {jobData.mileage.toLocaleString()} miles
                  </p>
                )}
              </div>
            </div>

            {/* Right side - Summary */}
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "14px", color: "#666", margin: "0 0 8px 0" }}>
                <strong>VHC Checks:</strong> {vhcChecks.length}
              </p>
              <p style={{ fontSize: "14px", color: "#666", margin: "0 0 8px 0" }}>
                <strong>Job Status:</strong> {jobData.status}
              </p>
              {jobData.appointment && (
                <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
                  <strong>Appointment:</strong> {jobData.appointment.date} {jobData.appointment.time}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Cost Summary Bar */}
        <div style={{
          background: "white",
          border: "1px solid #e0e0e0",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          flexShrink: 0
        }}>
          <div style={{
            backgroundColor: statusColor,
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "15px",
            fontWeight: "600"
          }}>
            VHC Status: {vhcStatus}
          </div>

          <div style={{ display: "flex", gap: "48px" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px", margin: 0 }}>Red Work</p>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#ef4444", margin: "4px 0 0 0" }}>
                £{totals.redWork}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px", margin: 0 }}>Amber Work</p>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#fbbf24", margin: "4px 0 0 0" }}>
                £{totals.amberWork}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px", margin: 0 }}>Authorized</p>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#10b981", margin: "4px 0 0 0" }}>
                £{totals.authorized}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          borderBottom: "2px solid #e0e0e0",
          flexShrink: 0
        }}>
          {["summary", "health-check", "photos", "videos"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "12px 20px",
                backgroundColor: activeTab === tab ? "#d10000" : "transparent",
                color: activeTab === tab ? "white" : "#666",
                border: "none",
                borderBottom: activeTab === tab ? "3px solid #d10000" : "3px solid transparent",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: activeTab === tab ? "600" : "500",
                textTransform: "capitalize",
                transition: "all 0.2s"
              }}
            >
              {tab.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ 
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          
          {activeTab === "summary" && (
            <>
              {vhcChecks.length === 0 ? (
                <div style={{
                  background: "white",
                  border: "1px solid #e0e0e0",
                  borderRadius: "16px",
                  padding: "40px",
                  textAlign: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
                  <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#333", marginBottom: "8px" }}>
                    No VHC Checks Yet
                  </h3>
                  <p style={{ fontSize: "14px", color: "#666", marginBottom: "24px" }}>
                    Start adding checks to build the vehicle health report
                  </p>
                  <button
                    onClick={() => router.push(`/vhc?job=${jobNumber}`)}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: "#d10000",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "600"
                    }}
                  >
                    Add VHC Checks
                  </button>
                </div>
              ) : (
                <div style={{
                  background: "white",
                  border: "1px solid #e0e0e0",
                  borderRadius: "16px",
                  padding: "24px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                }}>
                  <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>
                    VHC Check Results
                  </h3>
                  
                  {Object.entries(checksBySection).map(([section, checks]) => (
                    <div key={section} style={{ marginBottom: "24px" }}>
                      <h4 style={{ 
                        fontSize: "16px", 
                        fontWeight: "600", 
                        color: "#333",
                        marginBottom: "12px",
                        paddingBottom: "8px",
                        borderBottom: "2px solid #f0f0f0"
                      }}>
                        {section} ({checks.length})
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {checks.map(check => (
                          <div key={check.vhc_id} style={{
                            padding: "12px",
                            border: "1px solid #e0e0e0",
                            borderRadius: "8px",
                            backgroundColor: "#fafafa"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a", margin: "0 0 4px 0" }}>
                                  {check.issue_title}
                                </p>
                                <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>
                                  {check.issue_description}
                                </p>
                              </div>
                              {check.measurement && (
                                <div style={{
                                  padding: "6px 12px",
                                  backgroundColor: "#e0e0e0",
                                  borderRadius: "6px",
                                  fontSize: "13px",
                                  fontWeight: "600"
                                }}>
                                  £{parseFloat(check.measurement).toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "health-check" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>
                Add/Edit VHC Checks
              </h3>
              <button
                onClick={() => router.push(`/vhc?job=${jobNumber}`)}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#d10000",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600"
                }}
              >
                Go to VHC Builder
              </button>
            </div>
          )}

          {activeTab === "photos" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>
                Photos
              </h3>
              <div style={{
                padding: "40px",
                textAlign: "center",
                backgroundColor: "#fafafa",
                borderRadius: "8px"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📷</div>
                <p style={{ fontSize: "14px", color: "#666" }}>
                  No photos uploaded yet
                </p>
              </div>
            </div>
          )}

          {activeTab === "videos" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>
                Videos
              </h3>
              <div style={{
                padding: "40px",
                textAlign: "center",
                backgroundColor: "#fafafa",
                borderRadius: "8px"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎥</div>
                <p style={{ fontSize: "14px", color: "#666" }}>
                  No videos uploaded yet
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}