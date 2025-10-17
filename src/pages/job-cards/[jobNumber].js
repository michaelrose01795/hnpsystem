// src/pages/job-cards/[jobNumber].js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { getJobByNumber } from "../../lib/database/jobs"; // ✅ Linked to jobs.js

export default function JobCardViewPage() {
  const router = useRouter();
  const { jobNumber } = router.query;

  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ Fetch job from Supabase using database helper
  useEffect(() => {
    if (!jobNumber) return;

    const fetchJob = async () => {
      try {
        const { data, error } = await getJobByNumber(jobNumber);

        if (error || !data) {
          setError("Job card not found");
        } else {
          setJobData(data);
        }
      } catch (err) {
        setError("Failed to load job card");
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [jobNumber]);

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2>Loading Job Card #{jobNumber}...</h2>
        </div>
      </Layout>
    );
  }

  if (error || !jobData) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2 style={{ color: "#FF4040" }}>{error || "Job card not found"}</h2>
          <button
            onClick={() => router.push("/job-cards")}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Back to Job Cards
          </button>
        </div>
      </Layout>
    );
  }

  const { jobCard, customer, vehicle, customerJobHistory, vehicleJobHistory } = jobData;

  return (
    <Layout>
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "30px",
            padding: "20px",
            backgroundColor: "white",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}
        >
          <div>
            <h1 style={{ margin: 0, color: "#FF4040" }}>
              Job Card #{jobCard.jobNumber}
            </h1>
            <p style={{ margin: "5px 0 0 0", color: "#666" }}>
              Created: {new Date(jobCard.created_at).toLocaleString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <span
              style={{
                padding: "8px 16px",
                backgroundColor: jobCard.status === "Open" ? "#28a745" : "#ffc107",
                color: "white",
                borderRadius: "20px",
                fontWeight: "bold"
              }}
            >
              {jobCard.status}
            </span>
            <span
              style={{
                padding: "8px 16px",
                backgroundColor: jobCard.jobSource === "Retail" ? "#007bff" : "#ff9800",
                color: "white",
                borderRadius: "20px",
                fontWeight: "bold"
              }}
            >
              {jobCard.jobSource}
            </span>
          </div>
        </div>

        {/* Customer + Vehicle sections */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
            marginBottom: "20px"
          }}
        >
          {/* ✅ Customer Info */}
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}
          >
            <h2
              style={{
                marginTop: 0,
                borderBottom: "2px solid #FF4040",
                paddingBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              Customer Details
              <button
                onClick={() => router.push(`/customers/${customer?.customerId}`)}
                style={{
                  padding: "6px 12px",
                  fontSize: "0.85rem",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                View Full Profile
              </button>
            </h2>
            {customer ? (
              <>
                <p><strong>Customer ID:</strong> {customer.customerId}</p>
                <p><strong>Name:</strong> {customer.firstName} {customer.lastName}</p>
                <p><strong>Email:</strong> {customer.email || "N/A"}</p>
                <p><strong>Mobile:</strong> {customer.mobile || "N/A"}</p>
                <p><strong>Telephone:</strong> {customer.telephone || "N/A"}</p>
                <p><strong>Address:</strong> {customer.address || "N/A"}</p>
                <p><strong>Postcode:</strong> {customer.postcode || "N/A"}</p>
              </>
            ) : (
              <p style={{ color: "#999" }}>Customer information not available</p>
            )}
          </div>

          {/* ✅ Vehicle Info */}
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}
          >
            <h2
              style={{
                marginTop: 0,
                borderBottom: "2px solid #FF4040",
                paddingBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              Vehicle Details
              <button
                onClick={() => router.push(`/vehicles/${vehicle?.reg}`)}
                style={{
                  padding: "6px 12px",
                  fontSize: "0.85rem",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                View History
              </button>
            </h2>
            {vehicle ? (
              <>
                <p><strong>Registration:</strong> {vehicle.reg}</p>
                <p><strong>Make & Model:</strong> {vehicle.make} {vehicle.model}</p>
                <p><strong>Colour:</strong> {vehicle.colour}</p>
                <p><strong>Chassis Number:</strong> {vehicle.chassis}</p>
                <p><strong>Engine Number:</strong> {vehicle.engine}</p>
                <p><strong>Mileage:</strong> {vehicle.mileage?.toLocaleString()} miles</p>
              </>
            ) : (
              <p style={{ color: "#999" }}>Vehicle information not available</p>
            )}
          </div>
        </div>

        {/* ✅ Job Information */}
        <div
          style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            marginBottom: "20px"
          }}
        >
          <h2
            style={{
              marginTop: 0,
              borderBottom: "2px solid #FF4040",
              paddingBottom: "10px"
            }}
          >
            Job Information
          </h2>

          <div style={{ marginBottom: "20px" }}>
            <strong>Job Requests:</strong>
            {jobCard.requests?.length ? (
              <ul>
                {jobCard.requests.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "#999" }}>No requests logged.</p>
            )}
          </div>
        </div>

        {/* ✅ Action Buttons */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button
            onClick={() => router.push("/job-cards")}
            style={{
              padding: "12px 24px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Back to All Jobs
          </button>
          <button
            onClick={() => router.push(`/job-cards/${jobNumber}/edit`)}
            style={{
              padding: "12px 24px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Edit Job Card
          </button>
        </div>
      </div>
    </Layout>
  );
}