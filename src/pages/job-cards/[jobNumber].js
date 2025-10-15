// file location: src/pages/job-cards/[jobNumber].js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";

export default function JobCardViewPage() {
  const router = useRouter();
  const { jobNumber } = router.query;

  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobNumber) return;

    // Fetch job card with all linked data
    fetch(`/api/jobcards/${jobNumber}`)
      .then(res => res.json())
      .then(data => {
        if (data.jobCard) {
          setJobData(data);
        } else {
          setError("Job card not found");
        }
        setLoading(false);
      })
      .catch(err => {
        setError("Failed to load job card");
        setLoading(false);
      });
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
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "30px",
          padding: "20px",
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div>
            <h1 style={{ margin: 0, color: "#FF4040" }}>
              Job Card #{jobCard.jobNumber}
            </h1>
            <p style={{ margin: "5px 0 0 0", color: "#666" }}>
              Created: {new Date(jobCard.createdAt).toLocaleString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <span style={{
              padding: "8px 16px",
              backgroundColor: jobCard.status === "Open" ? "#28a745" : "#ffc107",
              color: "white",
              borderRadius: "20px",
              fontWeight: "bold"
            }}>
              {jobCard.status}
            </span>
            <span style={{
              padding: "8px 16px",
              backgroundColor: jobCard.jobSource === "Retail" ? "#007bff" : "#ff9800",
              color: "white",
              borderRadius: "20px",
              fontWeight: "bold"
            }}>
              {jobCard.jobSource}
            </span>
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          
          {/* Customer Details */}
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}>
            <h2 style={{ 
              marginTop: 0, 
              borderBottom: "2px solid #FF4040", 
              paddingBottom: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
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
                <p style={{ marginTop: "15px", padding: "10px", backgroundColor: "#f0f0f0", borderRadius: "4px" }}>
                  <strong>Total Jobs:</strong> {customerJobHistory?.length || 0}
                </p>
              </>
            ) : (
              <p style={{ color: "#999" }}>Customer information not available</p>
            )}
          </div>

          {/* Vehicle Details */}
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}>
            <h2 style={{ 
              marginTop: 0, 
              borderBottom: "2px solid #FF4040", 
              paddingBottom: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
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
                <p><strong>Make & Model:</strong> {vehicle.makeModel}</p>
                <p><strong>Colour:</strong> {vehicle.colour}</p>
                <p><strong>Chassis Number:</strong> {vehicle.chassis}</p>
                <p><strong>Engine Number:</strong> {vehicle.engine}</p>
                <p><strong>Mileage:</strong> {vehicle.mileage?.toLocaleString()} miles</p>
                <p style={{ marginTop: "15px", padding: "10px", backgroundColor: "#f0f0f0", borderRadius: "4px" }}>
                  <strong>Total Jobs:</strong> {vehicleJobHistory?.length || 0}
                </p>
              </>
            ) : (
              <p style={{ color: "#999" }}>Vehicle information not available</p>
            )}
          </div>
        </div>

        {/* Job Details */}
        <div style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          marginBottom: "20px"
        }}>
          <h2 style={{ marginTop: 0, borderBottom: "2px solid #FF4040", paddingBottom: "10px" }}>
            Job Information
          </h2>
          
          <div style={{ marginBottom: "20px" }}>
            <strong>Job Categories:</strong>
            <div style={{ marginTop: "10px" }}>
              {jobCard.jobCategories?.map((category, i) => (
                <span key={i} style={{
                  display: "inline-block",
                  marginRight: "10px",
                  padding: "6px 14px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  borderRadius: "20px",
                  fontWeight: "bold"
                }}>
                  {category}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <strong>Customer Status:</strong> 
            <span style={{ 
              marginLeft: "10px",
              padding: "4px 12px",
              backgroundColor: 
                jobCard.waitingStatus === "Waiting" ? "#ffcccc" :
                jobCard.waitingStatus === "Loan Car" ? "#cce0ff" :
                jobCard.waitingStatus === "Collection" ? "#d6f5d6" : "#f0f0f0",
              borderRadius: "4px"
            }}>
              {jobCard.waitingStatus}
            </span>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <strong>VHC Required:</strong> {jobCard.vhcRequired ? "Yes" : "No"}
          </div>

          <h3 style={{ marginTop: "25px" }}>Job Requests:</h3>
          {jobCard.requests?.map((request, i) => (
            <div key={i} style={{
              padding: "12px",
              marginBottom: "10px",
              backgroundColor: "#f8f9fa",
              borderLeft: "4px solid #FF4040",
              borderRadius: "4px"
            }}>
              <strong>Request {i + 1}:</strong> {request}
            </div>
          ))}

          {jobCard.cosmeticNotes && (
            <>
              <h3 style={{ marginTop: "25px" }}>Cosmetic Damage Notes:</h3>
              <div style={{
                padding: "12px",
                backgroundColor: "#fff3cd",
                border: "1px solid #ffc107",
                borderRadius: "4px"
              }}>
                {jobCard.cosmeticNotes}
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
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
          <button
            onClick={() => alert("Print functionality coming soon!")}
            style={{
              padding: "12px 24px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Print Job Card
          </button>
        </div>
      </div>
    </Layout>
  );
}