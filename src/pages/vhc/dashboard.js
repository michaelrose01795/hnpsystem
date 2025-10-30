// file location: src/pages/vhc/dashboard.js
"use client"; // enables client-side rendering for Next.js

import React, { useEffect, useState } from "react"; // import React and hooks
import { supabase } from "../../lib/supabaseClient"; // import Supabase client - CORRECT PATH
import Layout from "../../components/Layout"; // import layout wrapper
import { useRouter } from "next/router"; // for navigation to VHC detail page

// ✅ Status color mapping
const STATUS_COLORS = {
  "Outstanding": "#9ca3af", // grey
  "Accepted": "#d10000", // red
  "In Progress": "#3b82f6", // blue
  "Awaiting Authorization": "#fbbf24", // yellow
  "Authorized": "#9333ea", // purple
  "Ready": "#10b981", // green
  "Carry Over": "#f97316", // orange
  "Complete": "#06b6d4", // cyan
};

// ✅ Get last visit bubble color based on months
const getLastVisitColor = (lastVisitDate) => {
  if (!lastVisitDate || lastVisitDate === "First visit") return null;
  
  const visitDate = new Date(lastVisitDate);
  const today = new Date();
  const monthsDiff = (today - visitDate) / (1000 * 60 * 60 * 24 * 30);
  
  if (monthsDiff <= 4) return "#10b981"; // green - 0-4 months
  return "#fbbf24"; // amber - above 4 months
};

// ✅ Get next service bubble color based on months (same logic as last visit)
const getNextServiceColor = (nextServiceDate) => {
  if (!nextServiceDate || nextServiceDate === "Not scheduled") return null;
  
  const serviceDate = new Date(nextServiceDate);
  const today = new Date();
  const monthsDiff = (serviceDate - today) / (1000 * 60 * 60 * 24 * 30);
  
  if (monthsDiff <= 1) return "#ef4444"; // red - within 1 month or overdue
  if (monthsDiff <= 3) return "#fbbf24"; // amber - within 3 months
  return "#10b981"; // green - more than 3 months
};

// ✅ Get MOT expiry bubble color based on months remaining
const getMOTColor = (motExpiry) => {
  if (!motExpiry) return null;
  
  const expiryDate = new Date(motExpiry);
  const today = new Date();
  const monthsDiff = (expiryDate - today) / (1000 * 60 * 60 * 24 * 30);
  
  if (monthsDiff < 1) return "#ef4444"; // red - less than 1 month
  if (monthsDiff < 3) return "#fbbf24"; // amber - less than 3 months
  if (monthsDiff >= 4) return "#10b981"; // green - 4+ months
  return "#fbbf24"; // amber - default for 1-4 months
};

// ✅ Reusable card component for displaying each VHC job
const SectionCard = ({ job, onClick }) => {
  const lastVisitColor = getLastVisitColor(job.last_visit);
  const nextServiceColor = getNextServiceColor(job.next_service);
  const motColor = getMOTColor(job.mot_expiry);
  const statusColor = STATUS_COLORS[job.status] || "#9ca3af";

  return (
    <div
      onClick={onClick} // open detail page when clicked
      style={{
        border: "1px solid #ffe5e5",
        padding: "14px 18px",
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
      {/* ✅ LEFT SIDE - Status and Vehicle Info with Fixed Width */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "580px", flexShrink: 0 }}>
        {/* Status Badge - Larger to fit full text */}
        <div style={{
          backgroundColor: statusColor,
          color: "white",
          padding: "6px 12px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: "600",
          whiteSpace: "nowrap",
          minWidth: "180px",
          textAlign: "center"
        }}>
          {job.status}
        </div>

        {/* Vehicle Info - Single Line Layout - Starts at same position for all */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {/* Reg and Customer Name on same line */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ 
              fontSize: "17px", 
              fontWeight: "700", 
              color: "#1a1a1a",
              whiteSpace: "nowrap"
            }}>
              {job.reg || "N/A"}
            </span>
            <span style={{ 
              fontSize: "13px", 
              color: "#666",
              whiteSpace: "nowrap"
            }}>
              {job.customer_name || "N/A"}
            </span>
          </div>
          {/* Vehicle Make on second line */}
          <span style={{ 
            fontSize: "12px", 
            color: "#999",
            whiteSpace: "nowrap"
          }}>
            {job.vehicle_make || "N/A"}
          </span>
        </div>
      </div>

      {/* ✅ RIGHT SIDE - Table-like data */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "18px",
        flex: 1,
        justifyContent: "flex-end"
      }}>
        {/* Last Visit */}
        <div style={{ textAlign: "center", minWidth: "85px" }}>
          {lastVisitColor ? (
            <div style={{
              backgroundColor: lastVisitColor,
              color: "white",
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: "600"
            }}>
              {job.last_visit}
            </div>
          ) : (
            <span style={{ fontSize: "11px", color: "#ccc" }}>-</span>
          )}
        </div>

        {/* Next Service */}
        <div style={{ textAlign: "center", minWidth: "85px" }}>
          {nextServiceColor ? (
            <div style={{
              backgroundColor: nextServiceColor,
              color: "white",
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: "600"
            }}>
              {job.next_service}
            </div>
          ) : (
            <span style={{ fontSize: "11px", color: "#ccc" }}>-</span>
          )}
        </div>

        {/* MOT Expiry */}
        <div style={{ textAlign: "center", minWidth: "85px" }}>
          {motColor ? (
            <div style={{
              backgroundColor: motColor,
              color: "white",
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: "600"
            }}>
              {job.mot_expiry || "N/A"}
            </div>
          ) : (
            <span style={{ fontSize: "11px", color: "#ccc" }}>-</span>
          )}
        </div>

        {/* Spacer */}
        <div style={{ width: "1px", height: "30px", backgroundColor: "#e5e5e5" }}></div>

        {/* Red Work */}
        <div style={{ textAlign: "center", minWidth: "65px" }}>
          <span style={{ 
            fontSize: "13px", 
            fontWeight: "600",
            color: job.red_work !== "0.00" ? "#ef4444" : "#999" 
          }}>
            £{job.red_work || "0.00"}
          </span>
        </div>

        {/* Amber Work */}
        <div style={{ textAlign: "center", minWidth: "65px" }}>
          <span style={{ 
            fontSize: "13px", 
            fontWeight: "600",
            color: job.amber_work !== "0.00" ? "#fbbf24" : "#999" 
          }}>
            £{job.amber_work || "0.00"}
          </span>
        </div>

        {/* Authorized */}
        <div style={{ textAlign: "center", minWidth: "65px" }}>
          <span style={{ 
            fontSize: "13px", 
            fontWeight: "600",
            color: job.authorized !== "0.00" ? "#10b981" : "#999" 
          }}>
            £{job.authorized || "0.00"}
          </span>
        </div>

        {/* Spacer */}
        <div style={{ width: "1px", height: "30px", backgroundColor: "#e5e5e5" }}></div>

        {/* User Initials Bubbles - S, T, P, L, A with placeholders */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center", minWidth: "180px", justifyContent: "center" }}>
          {[
            { letter: "S", initials: job.service_advisor || "" }, 
            { letter: "T", initials: job.technician || "" }, 
            { letter: "P", initials: job.parts_person || "" }, 
            { letter: "L", initials: job.location_person || "" }, 
            { letter: "A", initials: job.admin_person || "" }
          ].map((person, index) => (
            <div
              key={index}
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                backgroundColor: person.initials ? "#d10000" : "transparent",
                border: person.initials ? "none" : "2px solid #d10000",
                color: person.initials ? "white" : "#d10000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: "600"
              }}
            >
              {person.initials || person.letter}
            </div>
          ))}
        </div>

        {/* Entry Time/Date */}
        <div style={{ 
          textAlign: "center", 
          minWidth: "105px",
          fontSize: "10px",
          color: "#999"
        }}>
          {job.updated_at ? new Date(job.updated_at).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
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
  "Complete",
];

// ✅ Generate dummy VHC data for testing
const generateDummyVHCData = () => {
  const statuses = ["Outstanding", "Accepted", "In Progress", "Awaiting Authorization", "Authorized", "Ready", "Carry Over", "Complete"];
  const makes = ["Ford", "BMW", "Mercedes", "Audi", "Toyota", "Honda", "Nissan", "Volkswagen"];
  const names = ["John Smith", "Sarah Johnson", "Michael Brown", "Emma Wilson", "James Taylor", "Olivia Davis", "William Martinez", "Sophia Anderson"];
  const techs = ["Tech A", "Tech B", "Tech C", "Tech D"];
  const placeholderInitials = ["MR", "SP", "DS", "JK", "LM", ""];
  
  return Array.from({ length: 45 }, (_, i) => ({ // generate 45 dummy records for testing
    id: `vhc-${i + 1}`, // unique id
    job_number: `JOB${1000 + i}`, // job number starting from JOB1000
    reg: `AB${10 + i} CDE`, // registration number
    customer_name: names[i % names.length], // cycle through customer names
    vehicle_make: makes[i % makes.length], // cycle through vehicle makes
    vehicle_model: "Model X", // placeholder model
    status: statuses[i % statuses.length], // cycle through statuses
    technician_name: techs[i % techs.length], // cycle through technicians
    last_visit: i % 3 === 0 ? new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : "First visit", // random last visit date
    next_service: i % 4 === 0 ? new Date(Date.now() + Math.random() * 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : "Not scheduled", // random next service date
    mot_expiry: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // random MOT date in future
    red_work: (Math.random() * 500).toFixed(2), // random red work cost
    amber_work: (Math.random() * 300).toFixed(2), // random amber work cost
    authorized: (Math.random() * 200).toFixed(2), // random authorized amount
    updated_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // random date within last 30 days
    // Team member initials - randomly assigned or empty
    service_advisor: placeholderInitials[i % placeholderInitials.length],
    technician: placeholderInitials[(i + 1) % placeholderInitials.length],
    parts_person: placeholderInitials[(i + 2) % placeholderInitials.length],
    location_person: placeholderInitials[(i + 3) % placeholderInitials.length],
    admin_person: placeholderInitials[(i + 4) % placeholderInitials.length],
  }));
};

// ✅ Main VHC Dashboard component
export default function VHCDashboard() {
  const router = useRouter(); // router for navigation
  const [vhcJobs, setVhcJobs] = useState([]); // list of VHC jobs
  const [loading, setLoading] = useState(true); // loading state
  const [filter, setFilter] = useState("All"); // current status filter
  const [search, setSearch] = useState({ reg: "", job_number: "", customer_name: "" }); // search filters
  const [currentPage, setCurrentPage] = useState(1); // current pagination page
  const itemsPerPage = 10; // number of items per page

  // ✅ Fetch all VHC jobs from Supabase (or use dummy data)
  useEffect(() => {
    const fetchVhcJobs = async () => {
      setLoading(true);
      
      // Try to fetch from Supabase
      const { data, error } = await supabase.from("vhc_checks").select("*"); // fetch table

      if (error || !data || data.length === 0) {
        console.log("Using dummy data for testing"); // log when using dummy data
        setVhcJobs(generateDummyVHCData()); // use dummy data if no real data
      } else {
        setVhcJobs(data); // use real data from database
      }
      
      setLoading(false);
    };

    fetchVhcJobs(); // call on load
  }, []);

  // ✅ Filter jobs by tab and search input
  const filteredJobs = vhcJobs
    .filter((job) => filter === "All" || job.status === filter) // filter by status
    .filter(
      (job) =>
        job.reg?.toLowerCase().includes(search.reg.toLowerCase()) && // filter by registration
        job.job_number?.toString().includes(search.job_number) && // filter by job number
        job.customer_name?.toLowerCase().includes(search.customer_name.toLowerCase()) // filter by customer name
    )
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)); // sort by updated_at DESC (newest first)

  // ✅ Pagination logic
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage); // calculate total pages
  const startIndex = (currentPage - 1) * itemsPerPage; // start index for current page
  const endIndex = startIndex + itemsPerPage; // end index for current page
  const currentJobs = filteredJobs.slice(startIndex, endIndex); // get jobs for current page

  // ✅ Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) { // check if page is valid
      setCurrentPage(newPage); // update current page
    }
  };

  // ✅ Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1); // reset to first page when filter or search changes
  }, [filter, search]);

  // ✅ Handle VHC card click - navigate to detail page
  const handleVHCClick = (jobNumber) => {
    router.push(`/vhc/details/${jobNumber}`); // navigate to VHC detail page with job number
  };

  return (
    <Layout>
      {/* ✅ MAIN CONTAINER - Full page layout */}
      <div style={{ 
        height: "100%", 
        display: "flex", 
        flexDirection: "column", 
        padding: "8px 16px",
        overflow: "hidden" 
      }}>
        
        {/* ✅ Search Section - Top Bar */}
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
            placeholder="Search Reg"
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
            value={search.job_number}
            onChange={(e) => setSearch({ ...search, job_number: e.target.value })}
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
            value={search.customer_name}
            onChange={(e) => setSearch({ ...search, customer_name: e.target.value })}
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

        {/* ✅ Status Filter Tabs */}
        <div style={{ 
          display: "flex", 
          gap: "12px", 
          marginBottom: "12px",
          overflowX: "auto",
          paddingBottom: "4px",
          flexShrink: 0
        }}>
          {STATUS_TABS.map((status) => (
            <div
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: "6px 12px",
                border: filter === status ? "2px solid #d10000" : "1px solid #d10000",
                color: filter === status ? "#fff" : "#d10000",
                backgroundColor: filter === status ? "#d10000" : "#fff",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: filter === status ? "600" : "500",
                fontSize: "14px",
                whiteSpace: "nowrap",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                if (filter !== status) {
                  e.target.style.backgroundColor = "#fff0f0";
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== status) {
                  e.target.style.backgroundColor = "#fff";
                }
              }}
            >
              {status}
            </div>
          ))}
        </div>

        {/* ✅ Job List Section - FIXED HEIGHT with gradient background */}
        <div style={{ 
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRadius: "24px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          border: "1px solid #ffe5e5",
          background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
          padding: "20px",
          overflow: "hidden",
          minHeight: 0
        }}>
          {loading ? (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              flex: 1,
              color: "#6B7280",
              fontSize: "16px"
            }}>
              Loading VHC reports...
            </div>
          ) : filteredJobs.length === 0 ? (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              flex: 1,
              color: "#6B7280",
              fontSize: "16px"
            }}>
              No VHC reports found for this filter/search.
            </div>
          ) : (
            <>
              {/* ✅ Column Headers - Properly aligned and shifted left */}
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: "12px",
                marginBottom: "12px",
                borderBottom: "1px solid #ffd6d6"
              }}>
                {/* Left section header - matches left side width */}
                <div style={{ width: "580px", flexShrink: 0 }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#000", textTransform: "uppercase" }}>
                    Vehicle Details
                  </span>
                </div>
                {/* Right section headers - aligned with data columns */}
                <div style={{ 
                  display: "flex", 
                  gap: "18px", 
                  flex: 1, 
                  justifyContent: "flex-end",
                  alignItems: "center"
                }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#000", minWidth: "85px", textAlign: "center" }}>Last Visit</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#000", minWidth: "85px", textAlign: "center" }}>Next Service</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#000", minWidth: "85px", textAlign: "center" }}>MOT Expiry</span>
                  <div style={{ width: "1px" }}></div>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#000", minWidth: "65px", textAlign: "center" }}>Red</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#000", minWidth: "65px", textAlign: "center" }}>Amber</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#000", minWidth: "65px", textAlign: "center" }}>Auth</span>
                  <div style={{ width: "1px" }}></div>
                  <div style={{ minWidth: "180px", textAlign: "center", display: "flex", gap: "8px", justifyContent: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#000" }}>S</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#000" }}>T</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#000" }}>P</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#000" }}>L</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#000" }}>A</span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#000", minWidth: "105px", textAlign: "center" }}>Entry Time</span>
                </div>
              </div>

              {/* ✅ VHC Cards - Scrollable with fixed height */}
              <div style={{ 
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                paddingRight: "8px",
                marginBottom: "16px"
              }}>
                {currentJobs.map((job) => (
                  <SectionCard
                    key={job.id}
                    job={job}
                    onClick={() => handleVHCClick(job.job_number)} // navigate to detail page
                  />
                ))}
              </div>

              {/* ✅ Pagination Controls - Fixed at bottom */}
              <div style={{ 
                flexShrink: 0,
                paddingTop: "16px",
                borderTop: "1px solid #ffd6d6"
              }}>
                <div style={{ 
                  display: "flex", 
                  justifyContent: "center", 
                  alignItems: "center", 
                  gap: "12px",
                  marginBottom: "12px"
                }}>
                  {/* Back Button */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                      backgroundColor: currentPage === 1 ? "#f5f5f5" : "#fff",
                      color: currentPage === 1 ? "#999" : "#333",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      transition: "all 0.2s"
                    }}
                  >
                    Back
                  </button>

                  {/* Page Numbers */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: currentPage === page ? "2px solid #d10000" : "1px solid #e0e0e0",
                          backgroundColor: currentPage === page ? "#d10000" : "#fff",
                          color: currentPage === page ? "#fff" : "#333",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: currentPage === page ? "600" : "500",
                          minWidth: "40px",
                          transition: "all 0.2s"
                        }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                      backgroundColor: currentPage === totalPages ? "#f5f5f5" : "#fff",
                      color: currentPage === totalPages ? "#999" : "#333",
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      transition: "all 0.2s"
                    }}
                  >
                    Next
                  </button>
                </div>

                {/* ✅ Page Info */}
                <div style={{ 
                  textAlign: "center", 
                  color: "#6B7280", 
                  fontSize: "13px" 
                }}>
                  Showing {startIndex + 1} - {Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} results
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}