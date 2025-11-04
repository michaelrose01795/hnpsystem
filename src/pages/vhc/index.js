// file location: src/pages/vhc/index.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "../../components/Layout";
import { useUser } from "../../context/UserContext";
import { usersByRole } from "../../config/users";
import { getAllJobs } from "../../lib/database/jobs";

export default function VHCDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debugInfo, setDebugInfo] = useState({}); // Debug information

  // ✅ Access check - who can access VHC page
  const username = user?.username;
  const allowedUsers = [
    ...(usersByRole["Workshop Manager"] || []),
    ...(usersByRole["Service Manager"] || []),
    ...(usersByRole["Techs"] || []),
    ...(usersByRole["Admin"] || []),
  ];
  const hasAccess = allowedUsers.includes(username);

  // ✅ Fetch all jobs on component mount
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    console.log("🔍 VHC Dashboard: Starting to fetch jobs...");
    
    try {
      // Call getAllJobs
      const fetchedJobs = await getAllJobs();
      
      // Detailed debug logging
      console.log("📊 RAW FETCHED JOBS:", fetchedJobs);
      console.log("📊 Total jobs fetched:", fetchedJobs?.length || 0);
      console.log("📊 Type of fetchedJobs:", typeof fetchedJobs);
      console.log("📊 Is Array?:", Array.isArray(fetchedJobs));
      
      if (fetchedJobs && fetchedJobs.length > 0) {
        console.log("📝 First job structure:", JSON.stringify(fetchedJobs[0], null, 2));
        console.log("📝 First job keys:", Object.keys(fetchedJobs[0]));
      } else {
        console.log("⚠️ No jobs returned from getAllJobs()");
      }
      
      // Filter to show only jobs that are active (not completed/closed)
      const activeJobs = fetchedJobs.filter(
        (job) => !["Completed", "Closed", "Invoiced", "Collected"].includes(job.status)
      );
      
      console.log("✅ Active jobs after filtering:", activeJobs.length);
      console.log("📊 Active jobs data:", activeJobs);
      
      // Store debug info
      setDebugInfo({
        totalFetched: fetchedJobs?.length || 0,
        totalActive: activeJobs.length,
        sampleJob: fetchedJobs[0] || null,
        isArray: Array.isArray(fetchedJobs),
        hasData: fetchedJobs && fetchedJobs.length > 0
      });
      
      setJobs(activeJobs);
      
    } catch (error) {
      console.error("❌ Error fetching jobs:", error);
      console.error("❌ Error stack:", error.stack);
      setDebugInfo({
        error: error.message,
        errorStack: error.stack
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Filter jobs based on search term
  const filteredJobs = jobs.filter((job) => {
    if (!searchTerm.trim()) return true;
    
    const lower = searchTerm.toLowerCase();
    
    return (
      job.jobNumber?.toLowerCase().includes(lower) ||
      job.reg?.toLowerCase().includes(lower) ||
      job.customer?.toLowerCase().includes(lower) ||
      job.make?.toLowerCase().includes(lower) ||
      job.model?.toLowerCase().includes(lower)
    );
  });

  // ✅ Access check
  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "20px" }}>
          <p style={{ color: "#ef4444", fontWeight: "600", fontSize: "16px" }}>
            You do not have access to the VHC page.
          </p>
          <div style={{ marginTop: "20px", padding: "20px", background: "#f5f5f5", borderRadius: "8px" }}>
            <p><strong>Current User:</strong> {username || "Not logged in"}</p>
            <p><strong>Allowed Users:</strong> {allowedUsers.join(", ") || "None"}</p>
          </div>
        </div>
      </Layout>
    );
  }

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
          <p style={{ color: "#666", fontSize: "16px" }}>Loading jobs...</p>
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
        padding: "20px",
        overflow: "hidden" 
      }}>
        {/* Header */}
        <div style={{ marginBottom: "24px", flexShrink: 0 }}>
          <h1 style={{ 
            fontSize: "32px", 
            fontWeight: "700", 
            color: "#1a1a1a", 
            margin: "0 0 8px 0" 
          }}>
            Vehicle Health Check Dashboard
          </h1>
          <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
            Select a job to perform VHC inspection
          </p>
        </div>

        {/* 🔍 DEBUG PANEL - Shows what's happening */}
        <div style={{
          background: "#fff3cd",
          border: "2px solid #ffc107",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "20px",
          flexShrink: 0
        }}>
          <h3 style={{ margin: "0 0 12px 0", color: "#856404" }}>🔍 Debug Information</h3>
          <div style={{ fontFamily: "monospace", fontSize: "13px", lineHeight: "1.6" }}>
            <p><strong>Total Jobs Fetched:</strong> {debugInfo.totalFetched || 0}</p>
            <p><strong>Active Jobs (filtered):</strong> {debugInfo.totalActive || 0}</p>
            <p><strong>Is Array:</strong> {debugInfo.isArray ? "✅ Yes" : "❌ No"}</p>
            <p><strong>Has Data:</strong> {debugInfo.hasData ? "✅ Yes" : "❌ No"}</p>
            {debugInfo.error && (
              <>
                <p style={{ color: "red" }}><strong>Error:</strong> {debugInfo.error}</p>
                <pre style={{ 
                  background: "#f5f5f5", 
                  padding: "10px", 
                  borderRadius: "4px",
                  overflow: "auto",
                  maxHeight: "200px"
                }}>
                  {debugInfo.errorStack}
                </pre>
              </>
            )}
            {debugInfo.sampleJob && (
              <details style={{ marginTop: "12px" }}>
                <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#856404" }}>
                  📄 Sample Job Data (click to expand)
                </summary>
                <pre style={{ 
                  background: "#f5f5f5", 
                  padding: "10px", 
                  borderRadius: "4px",
                  overflow: "auto",
                  maxHeight: "300px",
                  marginTop: "8px"
                }}>
                  {JSON.stringify(debugInfo.sampleJob, null, 2)}
                </pre>
              </details>
            )}
            <p style={{ marginTop: "12px", color: "#856404" }}>
              <strong>📝 Check browser console (F12) for detailed logs</strong>
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "24px",
          flexShrink: 0
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>Total Active Jobs</p>
            <p style={{ fontSize: "28px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
              {jobs.length}
            </p>
          </div>
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>Jobs with VHC</p>
            <p style={{ fontSize: "28px", fontWeight: "700", color: "#10b981", margin: 0 }}>
              {jobs.filter(j => j.vhcChecks && j.vhcChecks.length > 0).length}
            </p>
          </div>
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px 0" }}>Pending VHC</p>
            <p style={{ fontSize: "28px", fontWeight: "700", color: "#f59e0b", margin: 0 }}>
              {jobs.filter(j => !j.vhcChecks || j.vhcChecks.length === 0).length}
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ marginBottom: "20px", flexShrink: 0 }}>
          <input
            type="text"
            placeholder="🔍 Search by job number, reg, customer, make, or model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: "10px",
              border: "1px solid #e0e0e0",
              fontSize: "15px",
              outline: "none",
              transition: "border-color 0.2s"
            }}
            onFocus={(e) => e.target.style.borderColor = "#d10000"}
            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
          />
        </div>

        {/* No jobs found */}
        {filteredJobs.length === 0 && (
          <div style={{ 
            textAlign: "center", 
            padding: "60px 20px",
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid #e0e0e0"
          }}>
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>📋</div>
            <p style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a", margin: "0 0 8px 0" }}>
              {searchTerm.trim() ? "No jobs found" : "No active jobs"}
            </p>
            <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
              {searchTerm.trim() 
                ? "Try adjusting your search terms" 
                : "No active jobs in the database"}
            </p>
            <p style={{ fontSize: "14px", color: "#666", marginTop: "8px" }}>
              Total jobs fetched: {debugInfo.totalFetched || 0}
            </p>
          </div>
        )}

        {/* Jobs table */}
        {filteredJobs.length > 0 && (
          <div style={{
            flex: 1,
            overflowY: "auto",
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, backgroundColor: "#f9fafb", zIndex: 1 }}>
                <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                  <th style={{ 
                    padding: "16px", 
                    textAlign: "left", 
                    fontWeight: "600",
                    fontSize: "13px",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    Job Number
                  </th>
                  <th style={{ 
                    padding: "16px", 
                    textAlign: "left", 
                    fontWeight: "600",
                    fontSize: "13px",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    Registration
                  </th>
                  <th style={{ 
                    padding: "16px", 
                    textAlign: "left", 
                    fontWeight: "600",
                    fontSize: "13px",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    Vehicle
                  </th>
                  <th style={{ 
                    padding: "16px", 
                    textAlign: "left", 
                    fontWeight: "600",
                    fontSize: "13px",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    Customer
                  </th>
                  <th style={{ 
                    padding: "16px", 
                    textAlign: "left", 
                    fontWeight: "600",
                    fontSize: "13px",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    Status
                  </th>
                  <th style={{ 
                    padding: "16px", 
                    textAlign: "center", 
                    fontWeight: "600",
                    fontSize: "13px",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    VHC Checks
                  </th>
                  <th style={{ 
                    padding: "16px", 
                    textAlign: "center", 
                    fontWeight: "600",
                    fontSize: "13px",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job, index) => (
                  <tr
                    key={job.id || index}
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                  >
                    <td style={{ padding: "16px" }}>
                      <span style={{ fontWeight: "600", color: "#d10000", fontSize: "14px" }}>
                        {job.jobNumber || "N/A"}
                      </span>
                    </td>
                    <td style={{ padding: "16px", fontSize: "14px", color: "#1a1a1a", fontWeight: "500" }}>
                      {job.reg || "N/A"}
                    </td>
                    <td style={{ padding: "16px", fontSize: "14px", color: "#4b5563" }}>
                      {job.makeModel || `${job.make} ${job.model}` || "N/A"}
                    </td>
                    <td style={{ padding: "16px", fontSize: "14px", color: "#4b5563" }}>
                      {job.customer || "N/A"}
                    </td>
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        backgroundColor: getStatusColor(job.status),
                        color: "white"
                      }}>
                        {job.status || "N/A"}
                      </span>
                    </td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      {job.vhcChecks && job.vhcChecks.length > 0 ? (
                        <span style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          backgroundColor: "#d4edda",
                          color: "#155724"
                        }}>
                          ✓ {job.vhcChecks.length} checks
                        </span>
                      ) : (
                        <span style={{ 
                          fontSize: "13px", 
                          color: "#9ca3af",
                          fontStyle: "italic"
                        }}>
                          No checks
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <button
                        onClick={() => router.push(`/vhc/check?job=${job.jobNumber}`)}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "#d10000",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: "600",
                          transition: "background-color 0.2s"
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
                        onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
                      >
                        {job.vhcChecks && job.vhcChecks.length > 0 ? "View VHC" : "Start VHC"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Job count footer */}
        {filteredJobs.length > 0 && (
          <div style={{ 
            marginTop: "16px", 
            fontSize: "14px", 
            color: "#6b7280",
            textAlign: "center",
            flexShrink: 0
          }}>
            Showing {filteredJobs.length} of {jobs.length} active jobs
          </div>
        )}
      </div>
    </Layout>
  );
}

// Helper function to get status color
function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case "open":
      return "#3b82f6";
    case "assigned":
      return "#8b5cf6";
    case "in progress":
      return "#f59e0b";
    case "waiting":
      return "#ef4444";
    case "completed":
      return "#10b981";
    case "booked":
      return "#06b6d4";
    default:
      return "#6b7280";
  }
}