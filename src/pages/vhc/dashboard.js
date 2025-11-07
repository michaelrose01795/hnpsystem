// file location: src/pages/vhc/dashboard.js
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Layout from "../../components/Layout";
import CustomLoader from "../../components/Loading/CustomLoader";
import { useRouter } from "next/router";
import { getAllJobs } from "../../lib/database/jobs";
import { getVHCChecksByJob } from "../../lib/database/vhc";

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
  "Parts Request": "#f97316",
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

// ✅ Get last visit bubble color
const getLastVisitColor = (lastVisitDate) => {
  if (!lastVisitDate || lastVisitDate === "First visit") return null;
  
  const visitDate = new Date(lastVisitDate);
  const today = new Date();
  const monthsDiff = (today - visitDate) / (1000 * 60 * 60 * 24 * 30);
  
  if (monthsDiff <= 4) return "#10b981";
  return "#fbbf24";
};

// ✅ Get next service bubble color
const getNextServiceColor = (nextServiceDate) => {
  if (!nextServiceDate || nextServiceDate === "Not scheduled") return null;
  
  const serviceDate = new Date(nextServiceDate);
  const today = new Date();
  const monthsDiff = (serviceDate - today) / (1000 * 60 * 60 * 24 * 30);
  
  if (monthsDiff <= 1) return "#ef4444";
  if (monthsDiff <= 3) return "#fbbf24";
  return "#10b981";
};

// ✅ Get MOT expiry bubble color
const getMOTColor = (motExpiry) => {
  if (!motExpiry) return null;
  
  const expiryDate = new Date(motExpiry);
  const today = new Date();
  const monthsDiff = (expiryDate - today) / (1000 * 60 * 60 * 24 * 30);
  
  if (monthsDiff < 1) return "#ef4444";
  if (monthsDiff < 3) return "#fbbf24";
  if (monthsDiff >= 4) return "#10b981";
  return "#fbbf24";
};

// ✅ VHC Job Card Component
const VHCJobCard = ({ job, onClick }) => {
  const lastVisitColor = getLastVisitColor(job.lastVisit);
  const nextServiceColor = getNextServiceColor(job.nextService);
  const motColor = getMOTColor(job.motExpiry);
  const statusColor = STATUS_COLORS[job.vhcStatus] || "#9ca3af";
  const isPartsOnly = job.vhcStatus === "Parts Request";
  const counterValue = isPartsOnly ? job.partsCount || 0 : job.vhcChecksCount || 0;
  const counterLabel = isPartsOnly ? "Parts" : "Checks";
  const counterBackground = counterValue > 0
    ? isPartsOnly ? "#fef3c7" : "#e0f2fe"
    : "#f5f5f5";
  const counterColor = counterValue > 0
    ? isPartsOnly ? "#b45309" : "#0369a1"
    : "#999";

  return (
    <div
      onClick={onClick}
      style={{
        border: "1px solid #ffe5e5",
        padding: "16px 20px",
        borderRadius: "12px",
        backgroundColor: "white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        cursor: "pointer",
        transition: "all 0.3s ease",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(209,0,0,0.15)";
        e.currentTarget.style.borderColor = "#ffb3b3";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
        e.currentTarget.style.borderColor = "#ffe5e5";
      }}
    >
      {/* Left Side */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", width: "600px", flexShrink: 0 }}>
        <div style={{
          backgroundColor: statusColor,
          color: "white",
          padding: "8px 14px",
          borderRadius: "8px",
          fontSize: "12px",
          fontWeight: "600",
          whiteSpace: "nowrap",
          minWidth: "160px",
          textAlign: "center"
        }}>
          {job.vhcStatus}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ 
              fontSize: "18px", 
              fontWeight: "700", 
              color: "#1a1a1a",
              whiteSpace: "nowrap"
            }}>
              {job.reg || "N/A"}
            </span>
            <span style={{ 
              fontSize: "14px", 
              color: "#666",
              whiteSpace: "nowrap"
            }}>
              {getCustomerName(job.customer)}
            </span>
          </div>
          <span style={{ 
            fontSize: "13px", 
            color: "#999",
            whiteSpace: "nowrap"
          }}>
            {job.makeModel || "N/A"}
          </span>
        </div>
      </div>

      {/* Right Side */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "20px",
        flex: 1,
        justifyContent: "flex-end"
      }}>
        <div style={{ textAlign: "center", minWidth: "90px" }}>
          {lastVisitColor ? (
            <div style={{
              backgroundColor: lastVisitColor,
              color: "white",
              padding: "6px 12px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: "600"
            }}>
              {job.lastVisit}
            </div>
          ) : (
            <span style={{ fontSize: "11px", color: "#ccc" }}>First visit</span>
          )}
        </div>

        <div style={{ textAlign: "center", minWidth: "90px" }}>
          {nextServiceColor ? (
            <div style={{
              backgroundColor: nextServiceColor,
              color: "white",
              padding: "6px 12px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: "600"
            }}>
              {job.nextService}
            </div>
          ) : (
            <span style={{ fontSize: "11px", color: "#ccc" }}>-</span>
          )}
        </div>

        <div style={{ textAlign: "center", minWidth: "90px" }}>
          {motColor ? (
            <div style={{
              backgroundColor: motColor,
              color: "white",
              padding: "6px 12px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: "600"
            }}>
              {job.motExpiry || "N/A"}
            </div>
          ) : (
            <span style={{ fontSize: "11px", color: "#ccc" }}>-</span>
          )}
        </div>

        <div style={{ width: "1px", height: "35px", backgroundColor: "#e5e5e5" }}></div>

        <div style={{ textAlign: "center", minWidth: "80px" }}>
          <div style={{
            backgroundColor: counterBackground,
            color: counterColor,
            padding: "6px 12px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "600",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            alignItems: "center"
          }}>
            <span>{counterValue}</span>
            <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {counterLabel}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "center", minWidth: "70px" }}>
          <span style={{ 
            fontSize: "14px", 
            fontWeight: "600",
            color: job.redWork !== "0.00" ? "#ef4444" : "#999" 
          }}>
            £{job.redWork || "0.00"}
          </span>
        </div>

        <div style={{ textAlign: "center", minWidth: "70px" }}>
          <span style={{ 
            fontSize: "14px", 
            fontWeight: "600",
            color: job.amberWork !== "0.00" ? "#fbbf24" : "#999" 
          }}>
            £{job.amberWork || "0.00"}
          </span>
        </div>

        <div style={{ width: "1px", height: "35px", backgroundColor: "#e5e5e5" }}></div>

        <div style={{ 
          textAlign: "center", 
          minWidth: "120px",
          fontSize: "11px",
          color: "#999"
        }}>
          {job.createdAt ? new Date(job.createdAt).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
          }) : "N/A"}
        </div>
      </div>
    </div>
  );
};

// ✅ Status filter tabs
const STATUS_TABS = [
  "All",
  "Outstanding",
  "Accepted",
  "In Progress",
  "Awaiting Authorization",
  "Authorized",
  "Ready",
  "Carry Over",
  "Parts Request",
  "Complete",
];

export default function VHCDashboard() {
  const router = useRouter();
  const [vhcJobs, setVhcJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState({ reg: "", jobNumber: "", customer: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchVhcJobs = async () => {
      setLoading(true);
      console.log("📋 Fetching VHC dashboard data...");

      try {
        const jobs = await getAllJobs();
        console.log("✅ Jobs fetched:", jobs.length);

        const vhcEligibleJobs = jobs.filter((job) => job.vhcRequired === true);
        console.log("✅ Jobs requiring VHC:", vhcEligibleJobs.length);

        const jobsWithVhc = await Promise.all(
          vhcEligibleJobs.map(async (job) => {
            const checks = await getVHCChecksByJob(job.id);

            const partsCount = job.partsRequests?.length || 0;
            const effectiveChecksCount = checks.length > 0 ? checks.length : partsCount;
            
            let vhcStatus = "Outstanding";
            if (checks.length > 0) {
              const hasRed = checks.some(c => c.section === "Brakes");
              const hasAmber = checks.some(c => c.section === "Tyres");
              
              if (hasRed) {
                vhcStatus = "In Progress";
              } else if (hasAmber) {
                vhcStatus = "Awaiting Authorization";
              } else if (checks.length > 5) {
                vhcStatus = "Complete";
              }
            } else if (partsCount > 0) {
              vhcStatus = "Parts Request";
            }

            const redWork = checks
              .filter(c => c.section === "Brakes")
              .reduce((sum, c) => sum + (parseFloat(c.measurement) || 0), 0)
              .toFixed(2);

            const amberWork = checks
              .filter(c => c.section === "Tyres")
              .reduce((sum, c) => sum + (parseFloat(c.measurement) || 0), 0)
              .toFixed(2);

            return {
              id: job.id,
              jobNumber: job.jobNumber,
              reg: job.reg,
              customer: job.customer,
              makeModel: job.makeModel,
              vhcStatus,
              vhcChecksCount: effectiveChecksCount,
              partsCount,
              redWork,
              amberWork,
              lastVisit: job.lastVisit || "First visit",
              nextService: job.nextService || "Not scheduled",
              motExpiry: job.motExpiry || null,
              createdAt: job.createdAt
            };
          })
        );

        console.log("✅ VHC data processed for", jobsWithVhc.length, "jobs");
        setVhcJobs(jobsWithVhc);

      } catch (error) {
        console.error("❌ Error fetching VHC data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVhcJobs();
  }, []);

  const filteredJobs = vhcJobs
    .filter((job) => filter === "All" || job.vhcStatus === filter)
    .filter((job) => {
      const customerName = getCustomerName(job.customer).toLowerCase();
      return (
        job.reg?.toLowerCase().includes(search.reg.toLowerCase()) &&
        job.jobNumber?.toString().includes(search.jobNumber) &&
        customerName.includes(search.customer.toLowerCase())
      );
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentJobs = filteredJobs.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  const handleJobClick = (jobNumber) => {
    router.push(`/vhc/details/${jobNumber}`);
  };

  return (
    <Layout>
      <CustomLoader isVisible={loading} />
      <div style={{ 
        height: "100%", 
        display: "flex", 
        flexDirection: "column", 
        padding: "8px 16px",
        overflow: "hidden" 
      }}>
        
        {/* Search Section */}
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
          <input
            type="text"
            placeholder="Search Registration"
            value={search.reg}
            onChange={(e) => setSearch({ ...search, reg: e.target.value })}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              outline: "none"
            }}
          />
          <input
            type="text"
            placeholder="Search Job Number"
            value={search.jobNumber}
            onChange={(e) => setSearch({ ...search, jobNumber: e.target.value })}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              outline: "none"
            }}
          />
          <input
            type="text"
            placeholder="Search Customer"
            value={search.customer}
            onChange={(e) => setSearch({ ...search, customer: e.target.value })}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              outline: "none"
            }}
          />
        </div>

        {/* Status Filter Tabs */}
        <div style={{ 
          display: "flex", 
          gap: "12px", 
          marginBottom: "12px",
          overflowX: "auto",
          paddingBottom: "4px",
          flexShrink: 0
        }}>
          {STATUS_TABS.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: "8px 16px",
                border: filter === status ? "2px solid #d10000" : "1px solid #d10000",
                color: filter === status ? "#fff" : "#d10000",
                backgroundColor: filter === status ? "#d10000" : "#fff",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: filter === status ? "600" : "500",
                fontSize: "14px",
                whiteSpace: "nowrap",
                transition: "all 0.2s"
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Job List Section */}
        <div style={{ 
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRadius: "24px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          border: "1px solid #ffe5e5",
          background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
          padding: "24px",
          overflow: "hidden",
          minHeight: 0
        }}>
          {loading ? null : filteredJobs.length === 0 ? (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              flex: 1,
              flexDirection: "column",
              gap: "16px"
            }}>
              <div style={{ fontSize: "64px" }}>🔍</div>
              <p style={{ color: "#666", fontSize: "18px", fontWeight: "600" }}>
                No VHC reports found
              </p>
            </div>
          ) : (
            <>
              {/* Column Headers */}
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between",
                paddingBottom: "16px",
                marginBottom: "16px",
                borderBottom: "2px solid #ffd6d6",
                flexShrink: 0
              }}>
                <div style={{ width: "600px", flexShrink: 0 }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#000" }}>
                    VEHICLE DETAILS
                  </span>
                </div>
                <div style={{ 
                  display: "flex", 
                  gap: "20px", 
                  flex: 1, 
                  justifyContent: "flex-end"
                }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "90px", textAlign: "center" }}>Last Visit</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "90px", textAlign: "center" }}>Next Service</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "90px", textAlign: "center" }}>MOT</span>
                  <div style={{ width: "1px" }}></div>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "70px", textAlign: "center" }}>Checks</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "70px", textAlign: "center" }}>Red</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "70px", textAlign: "center" }}>Amber</span>
                  <div style={{ width: "1px" }}></div>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "120px", textAlign: "center" }}>Time</span>
                </div>
              </div>

              {/* Job Cards */}
              <div style={{ 
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                paddingRight: "8px",
                marginBottom: "16px",
                minHeight: 0
              }}>
                {currentJobs.map((job) => (
                  <VHCJobCard
                    key={job.id}
                    job={job}
                    onClick={() => handleJobClick(job.jobNumber)}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div style={{ 
                flexShrink: 0,
                paddingTop: "16px",
                borderTop: "2px solid #ffd6d6"
              }}>
                <div style={{ 
                  display: "flex", 
                  justifyContent: "center", 
                  gap: "12px",
                  marginBottom: "12px"
                }}>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                      backgroundColor: currentPage === 1 ? "#f5f5f5" : "#fff",
                      color: currentPage === 1 ? "#999" : "#333",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "600"
                    }}
                  >
                    ← Back
                  </button>

                  <div style={{ display: "flex", gap: "8px" }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "8px",
                          border: currentPage === page ? "2px solid #d10000" : "1px solid #e0e0e0",
                          backgroundColor: currentPage === page ? "#d10000" : "#fff",
                          color: currentPage === page ? "#fff" : "#333",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: currentPage === page ? "600" : "500",
                          minWidth: "44px"
                        }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                      backgroundColor: currentPage === totalPages ? "#f5f5f5" : "#fff",
                      color: currentPage === totalPages ? "#999" : "#333",
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "600"
                    }}
                  >
                    Next →
                  </button>
                </div>

                <div style={{ textAlign: "center", color: "#666", fontSize: "13px" }}>
                  Showing {startIndex + 1} - {Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
