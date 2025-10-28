// file location: src/pages/vhc/dashboard.js
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import dayjs from "dayjs";
import Sidebar from "../../components/Sidebar";

export default function VHCDashboard() {
  const [vhcJobs, setVhcJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);

  const [filter, setFilter] = useState("All");

  useEffect(() => {
    const fetchVhcJobs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vhc_checks")
        .select(
          "job_number, technician_name, updated_at, wheels_tyres, brakes, service_book, under_bonnet, electrics, cosmetics, underside, status"
        );

      if (error) {
        console.error("Error fetching VHC data:", error);
        setLoading(false);
        return;
      }

      const formatted = data.map((item) => ({
        job_number: item.job_number,
        technician_name: item.technician_name,
        updated_at: item.updated_at,
        status: item.status,
        vhc_data: {
          wheels_tyres: item.wheels_tyres,
          brakes: item.brakes,
          service_book: item.service_book,
          under_bonnet: item.under_bonnet,
          electrics: item.electrics,
          cosmetics: item.cosmetics,
          underside: item.underside,
        },
      }));

      setVhcJobs(formatted);
      setLoading(false);
    };

    fetchVhcJobs();
  }, []);

  const filteredJobs =
    filter === "All"
      ? vhcJobs
      : vhcJobs.filter((job) => job.status === filter);

  // Function to handle Approve/Decline actions
  const handleAction = (job, action) => {
    alert(`VHC ${action} for Job ${job.job_number}`);
    setSelectedJob(null);
  };

  return (
    <div className="flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div id="main-content" style={{ flex: 1, padding: "24px" }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: "bold",
            color: "#FF4040",
            marginBottom: "24px",
          }}
        >
          VHC Dashboard
        </h1>

        {/* Filter Buttons */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
          {["All", "Awaiting Review", "Approved", "Declined"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                fontWeight: "bold",
                cursor: "pointer",
                backgroundColor: filter === status ? "#FF4040" : "#e2e2e2",
                color: filter === status ? "#fff" : "#333",
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading ? (
          <p style={{ color: "#777" }}>Loading VHC reports...</p>
        ) : filteredJobs.length === 0 ? (
          <p style={{ color: "#777" }}>No VHC reports found for this filter.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {filteredJobs.map((job) => (
              <div
                key={job.job_number}
                onClick={() => setSelectedJob(job)}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "16px",
                  backgroundColor: "#fff5f5",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  transition: "transform 0.1s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#333" }}>
                    {job.job_number}
                  </h2>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      backgroundColor:
                        job.status === "Approved"
                          ? "#c6f6d5"
                          : job.status === "Declined"
                          ? "#feb2b2"
                          : "#fefcbf",
                      color:
                        job.status === "Approved"
                          ? "#2f855a"
                          : job.status === "Declined"
                          ? "#c53030"
                          : "#975a16",
                    }}
                  >
                    {job.status || "Awaiting Review"}
                  </span>
                </div>
                <p style={{ color: "#555", fontSize: "0.9rem", marginTop: "4px" }}>
                  Technician: {job.technician_name || "Unassigned"}
                </p>
                <p style={{ color: "#555", fontSize: "0.9rem" }}>
                  Date: {dayjs(job.updated_at).format("DD/MM/YYYY HH:mm")}
                </p>
                <p style={{ marginTop: "8px", color: "#333", fontWeight: "bold" }}>
                  Sections Completed: {Object.keys(job.vhc_data || {}).length}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Popup Modal */}
        {selectedJob && (
          <div
            className="fixed inset-0 z-50 flex justify-center items-center"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "8px",
                width: "400px",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              <h3
                style={{
                  fontWeight: "bold",
                  fontSize: "1.25rem",
                  color: "#FF4040",
                  marginBottom: "12px",
                }}
              >
                VHC Details – Job {selectedJob.job_number}
              </h3>

              <p style={{ color: "#555", marginBottom: "4px" }}>
                <strong>Technician:</strong> {selectedJob.technician_name || "Unassigned"}
              </p>
              <p style={{ color: "#555", marginBottom: "12px" }}>
                <strong>Last Updated:</strong>{" "}
                {dayjs(selectedJob.updated_at).format("DD/MM/YYYY HH:mm")}
              </p>

              {selectedJob.vhc_data ? (
                Object.entries(selectedJob.vhc_data).map(([section, details], idx) => (
                  <div key={idx} style={{ border: "1px solid #e2e2e2", padding: "8px", borderRadius: "6px", marginBottom: "8px" }}>
                    <h4 style={{ fontWeight: "bold", color: "#333", marginBottom: "4px" }}>{section}</h4>
                    <pre
                      style={{
                        backgroundColor: "#f9f9f9",
                        padding: "6px",
                        borderRadius: "4px",
                        fontSize: "0.85rem",
                        overflowX: "auto",
                      }}
                    >
                      {JSON.stringify(details, null, 2)}
                    </pre>
                  </div>
                ))
              ) : (
                <p style={{ color: "#777" }}>No VHC data found for this job.</p>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <button
                  onClick={() => setSelectedJob(null)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#e2e2e2",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
                <button
                  onClick={() => handleAction(selectedJob, "Approved")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#28a745",
                    color: "white",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(selectedJob, "Declined")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#FF4040",
                    color: "white",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
