// file location: src/pages/job-cards/[jobNumber].js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { useJobs } from "../../context/JobsContext";

export default function JobCardPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const { getJobByNumber } = useJobs();

  // Simulate user role (tech or other)
  const userRole = "tech"; // Change dynamically depending on auth in real app

  // Job state
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch job details
  useEffect(() => {
    if (!jobNumber) return;
    const fetchJob = async () => {
      const jobData = getJobByNumber(Number(jobNumber));
      setJob(jobData);
      setLoading(false);
    };
    fetchJob();
  }, [jobNumber, getJobByNumber]);

  if (loading || !job) {
    return (
      <Layout>
        <h2>Loading Job Card...</h2>
      </Layout>
    );
  }

  // Navigation handlers
  const handleStartVHC = () => router.push(`/job-cards/${jobNumber}/vhc`);
  const handleWriteUp = () => router.push(`/job-cards/${jobNumber}/write-up`);
  const handleCheckBox = () => router.push(`/job-cards/${jobNumber}/check-box`);
  const handleFullCarDetails = () =>
    router.push(`/job-cards/${jobNumber}/car-details`);
  const handleCompleteJob = () => {
    alert("Job marked as completed");
    router.push("/news");
  };

  // Layout heights
  const sectionHeight = "250px";
  const jobDetailsHeight = "350px";
  const bottomRowHeight = "150px";

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#555" }}>
              Retail / Sales / Warranty
            </h2>
            <h1 style={{ color: "#FF4040", margin: 0 }}>
              Job Card: {jobNumber}
            </h1>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            {/* Complete Job button only if job is VHC completed or not required */}
            {(job.vhcRequired ? job.vhcCompleted : true) && (
              <button
                onClick={handleCompleteJob}
                style={{
                  padding: "12px 20px",
                  backgroundColor: "green",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                Complete Job
              </button>
            )}

            {/* VHC button only for techs and if VHC required */}
            {userRole === "tech" && job.vhcRequired && (
              <button
                onClick={handleStartVHC}
                style={{
                  padding: "12px 20px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                {job.vhcCompleted ? "Reopen VHC" : "Start VHC"}
              </button>
            )}
          </div>
        </div>

        {/* Vehicle & Customer Details */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          {/* Vehicle Details */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              height: sectionHeight,
              overflow: "hidden",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "12px" }}>
              Vehicle Details
            </h3>
            <p>
              <strong>Registration:</strong> {job.vehicle?.reg || "-"}
            </p>
            <p>
              <strong>Colour:</strong> {job.vehicle?.colour || "-"}
            </p>
            <p>
              <strong>Make & Model:</strong> {job.vehicle?.makeModel || "-"}
            </p>
            <p>
              <strong>Chassis Number:</strong> {job.vehicle?.chassis || "-"}
            </p>
            <p>
              <strong>Engine Number:</strong> {job.vehicle?.engine || "-"}
            </p>
            <div style={{ marginTop: "8px" }}>
              <label>
                <strong>Mileage:</strong>
                <input
                  type="number"
                  value={job.vehicle?.mileage || ""}
                  placeholder="Enter miles"
                  style={{
                    marginLeft: "8px",
                    padding: "4px 8px",
                    width: "100px",
                  }}
                  readOnly
                />
              </label>
            </div>
          </div>

          {/* Customer Details */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              height: sectionHeight,
              overflow: "hidden",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "12px" }}>
              Customer Details
            </h3>
            <p>
              <strong>Full Name:</strong>{" "}
              {job.customer?.firstName
                ? `${job.customer.firstName} ${job.customer.lastName}`
                : "-"}
            </p>
            <p>
              <strong>Address:</strong> {job.customer?.address || "-"}
            </p>
            <p>
              <strong>Email:</strong> {job.customer?.email || "-"}
            </p>
            <p>
              <strong>Phone:</strong>{" "}
              {job.customer?.mobile || job.customer?.telephone || "-"}
            </p>
          </div>
        </div>

        {/* Job Details */}
        <div
          style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            marginBottom: "24px",
            height: jobDetailsHeight,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Job Details</h3>
          {job.requests?.map((req, index) => (
            <p key={index}>
              <strong>Request {index + 1}:</strong> {req}
            </p>
          ))}
        </div>

        {/* Bottom Sections */}
        <div style={{ display: "flex", gap: "16px", height: bottomRowHeight }}>
          {/* Cosmetic Damage */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              overflowY: "auto",
            }}
          >
            <h4 style={{ marginTop: 0 }}>Cosmetic Damage</h4>
            <textarea
              value={job.cosmeticNotes || ""}
              placeholder="Scratches, dents, paint damage..."
              style={{ width: "100%", height: "80px", padding: "8px" }}
              readOnly
            />
          </div>

          {/* Write-Up Button */}
          <div
            onClick={handleWriteUp}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#FF4040",
              color: "white",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <h4 style={{ margin: 0 }}>Go to Write-Up</h4>
          </div>
        </div>
      </div>
    </Layout>
  );
}
