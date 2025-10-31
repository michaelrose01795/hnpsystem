// file location: src/pages/job-cards/[jobNumber].js
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
        console.log("🔍 Fetching job:", jobNumber); // debug log
        const { data, error } = await getJobByNumber(jobNumber);

        if (error || !data) {
          console.error("❌ Job fetch error:", error); // debug log
          setError("Job card not found");
        } else {
          console.log("✅ Job data loaded:", data); // debug log
          setJobData(data);
        }
      } catch (err) {
        console.error("❌ Exception fetching job:", err); // debug log
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
        <div style={{ 
          padding: "40px", 
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh"
        }}>
          <div style={{
            width: "60px",
            height: "60px",
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #FF4040",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            marginBottom: "20px"
          }}></div>
          <h2 style={{ color: "#666", fontWeight: "500" }}>
            Loading Job Card #{jobNumber}...
          </h2>
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

  if (error || !jobData) {
    return (
      <Layout>
        <div style={{ 
          padding: "40px", 
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh"
        }}>
          <div style={{
            fontSize: "60px",
            marginBottom: "20px"
          }}>⚠️</div>
          <h2 style={{ color: "#FF4040", marginBottom: "10px" }}>
            {error || "Job card not found"}
          </h2>
          <p style={{ color: "#666", marginBottom: "30px" }}>
            Job #{jobNumber} could not be loaded from the database.
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => router.push("/job-cards/view")}
              style={{
                padding: "12px 24px",
                backgroundColor: "#FF4040",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#cc0000"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#FF4040"}
            >
              View All Job Cards
            </button>
            <button
              onClick={() => router.push("/job-cards/create")}
              style={{
                padding: "12px 24px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#0056b3"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#007bff"}
            >
              Create New Job Card
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const { jobCard, customer, vehicle, customerJobHistory, vehicleJobHistory } = jobData;

  return (
    <Layout>
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px" }}>
        {/* ✅ Header with enhanced styling */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "30px",
            padding: "24px",
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0"
          }}
        >
          <div>
            <h1 style={{ margin: 0, color: "#FF4040", fontSize: "32px", fontWeight: "700" }}>
              Job Card #{jobCard.jobNumber}
            </h1>
            <p style={{ margin: "8px 0 0 0", color: "#666", fontSize: "14px" }}>
              Created: {new Date(jobCard.createdAt).toLocaleString()} | 
              Last Updated: {new Date(jobCard.updatedAt).toLocaleString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <span
              style={{
                padding: "10px 18px",
                backgroundColor: 
                  jobCard.status === "Open" ? "#28a745" : 
                  jobCard.status === "Complete" ? "#007bff" : 
                  "#ffc107",
                color: "white",
                borderRadius: "24px",
                fontWeight: "600",
                fontSize: "14px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}
            >
              {jobCard.status}
            </span>
            <span
              style={{
                padding: "10px 18px",
                backgroundColor: jobCard.jobSource === "Retail" ? "#007bff" : "#ff9800",
                color: "white",
                borderRadius: "24px",
                fontWeight: "600",
                fontSize: "14px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}
            >
              {jobCard.jobSource || "RETAIL"}
            </span>
            {/* ✅ Waiting Status Badge */}
            {jobCard.waitingStatus && jobCard.waitingStatus !== "Neither" && (
              <span
                style={{
                  padding: "10px 18px",
                  backgroundColor: 
                    jobCard.waitingStatus === "Waiting" ? "#ff4444" : 
                    jobCard.waitingStatus === "Loan Car" ? "#4488ff" : 
                    "#44ff88",
                  color: "white",
                  borderRadius: "24px",
                  fontWeight: "600",
                  fontSize: "14px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}
              >
                {jobCard.waitingStatus}
              </span>
            )}
            {/* ✅ VHC Required Badge */}
            {jobCard.vhcRequired && (
              <span
                style={{
                  padding: "10px 18px",
                  backgroundColor: "#be123c",
                  color: "white",
                  borderRadius: "24px",
                  fontWeight: "600",
                  fontSize: "14px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}
              >
                VHC REQUIRED
              </span>
            )}
          </div>
        </div>

        {/* ✅ Job Categories Section */}
        {jobCard.jobCategories && jobCard.jobCategories.length > 0 && (
          <div
            style={{
              backgroundColor: "white",
              padding: "16px 24px",
              borderRadius: "12px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              marginBottom: "20px",
              border: "1px solid #e0e0e0"
            }}
          >
            <strong style={{ fontSize: "14px", color: "#666", marginRight: "12px" }}>
              Job Types:
            </strong>
            {jobCard.jobCategories.map((category, idx) => (
              <span
                key={idx}
                style={{
                  display: "inline-block",
                  marginRight: "8px",
                  padding: "6px 14px",
                  backgroundColor: "#f0f0f0",
                  color: "#333",
                  borderRadius: "16px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}
              >
                {category}
              </span>
            ))}
          </div>
        )}

        {/* Customer + Vehicle sections */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
            marginBottom: "20px"
          }}
        >
          {/* ✅ Enhanced Customer Info */}
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              border: "1px solid #e0e0e0"
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "20px",
                borderBottom: "3px solid #FF4040",
                paddingBottom: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "20px",
                fontWeight: "700",
                color: "#1a1a1a"
              }}
            >
              Customer Details
              <button
                onClick={() => router.push(`/customers/${customer?.customerId}`)}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#0056b3"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "#007bff"}
              >
                View Profile
              </button>
            </h2>
            {customer ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#666", fontSize: "14px" }}>Customer ID:</span>
                  <span style={{ fontWeight: "600", fontSize: "14px" }}>{customer.customerId}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#666", fontSize: "14px" }}>Name:</span>
                  <span style={{ fontWeight: "600", fontSize: "14px" }}>{customer.firstName} {customer.lastName}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#666", fontSize: "14px" }}>Email:</span>
                  <span style={{ fontWeight: "600", fontSize: "14px", color: "#007bff" }}>
                    {customer.email || "N/A"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#666", fontSize: "14px" }}>Mobile:</span>
                  <span style={{ fontWeight: "600", fontSize: "14px" }}>{customer.mobile || "N/A"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#666", fontSize: "14px" }}>Telephone:</span>
                  <span style={{ fontWeight: "600", fontSize: "14px" }}>{customer.telephone || "N/A"}</span>
                </div>
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  paddingTop: "12px", 
                  borderTop: "1px solid #f0f0f0" 
                }}>
                  <span style={{ color: "#666", fontSize: "14px", marginBottom: "6px" }}>Address:</span>
                  <span style={{ fontWeight: "600", fontSize: "14px" }}>
                    {customer.address || "N/A"}
                    {customer.postcode && <><br />{customer.postcode}</>}
                  </span>
                </div>
                {/* ✅ Contact Preference */}
                {customer.contactPreference && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#666", fontSize: "14px" }}>Contact Preference:</span>
                    <span style={{ 
                      fontWeight: "600", 
                      fontSize: "13px",
                      padding: "4px 10px",
                      backgroundColor: "#f0f9ff",
                      color: "#0369a1",
                      borderRadius: "12px"
                    }}>
                      {customer.contactPreference}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: "#999", textAlign: "center", padding: "20px" }}>
                Customer information not available
              </p>
            )}
          </div>

          {/* ✅ Enhanced Vehicle Info */}
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              border: "1px solid #e0e0e0"
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "20px",
                borderBottom: "3px solid #FF4040",
                paddingBottom: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "20px",
                fontWeight: "700",
                color: "#1a1a1a"
              }}
            >
              Vehicle Details
              <button
                onClick={() => router.push(`/vehicles/${vehicle?.reg}`)}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#0056b3"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "#007bff"}
              >
                View History
              </button>
            </h2>
            {vehicle ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#666", fontSize: "14px" }}>Registration:</span>
                  <span style={{ 
                    fontWeight: "700", 
                    fontSize: "16px",
                    color: "#FF4040"
                  }}>
                    {vehicle.reg}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#666", fontSize: "14px" }}>Make & Model:</span>
                  <span style={{ fontWeight: "600", fontSize: "14px" }}>
                    {vehicle.makeModel || `${vehicle.make} ${vehicle.model}`}
                  </span>
                </div>
                {vehicle.year && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#666", fontSize: "14px" }}>Year:</span>
                    <span style={{ fontWeight: "600", fontSize: "14px" }}>{vehicle.year}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#666", fontSize: "14px" }}>Colour:</span>
                  <span style={{ fontWeight: "600", fontSize: "14px" }}>{vehicle.colour || "N/A"}</span>
                </div>
                {vehicle.vin && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#666", fontSize: "14px" }}>VIN:</span>
                    <span style={{ fontWeight: "600", fontSize: "12px", fontFamily: "monospace" }}>
                      {vehicle.vin}
                    </span>
                  </div>
                )}
                {vehicle.chassis && vehicle.chassis !== vehicle.vin && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#666", fontSize: "14px" }}>Chassis:</span>
                    <span style={{ fontWeight: "600", fontSize: "12px", fontFamily: "monospace" }}>
                      {vehicle.chassis}
                    </span>
                  </div>
                )}
                {vehicle.engine && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#666", fontSize: "14px" }}>Engine Number:</span>
                    <span style={{ fontWeight: "600", fontSize: "12px", fontFamily: "monospace" }}>
                      {vehicle.engine || vehicle.engineNumber}
                    </span>
                  </div>
                )}
                {vehicle.mileage && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#666", fontSize: "14px" }}>Mileage:</span>
                    <span style={{ fontWeight: "600", fontSize: "14px" }}>
                      {vehicle.mileage?.toLocaleString()} miles
                    </span>
                  </div>
                )}
                {vehicle.fuelType && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#666", fontSize: "14px" }}>Fuel Type:</span>
                    <span style={{ fontWeight: "600", fontSize: "14px" }}>{vehicle.fuelType}</span>
                  </div>
                )}
                {vehicle.transmission && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#666", fontSize: "14px" }}>Transmission:</span>
                    <span style={{ fontWeight: "600", fontSize: "14px" }}>{vehicle.transmission}</span>
                  </div>
                )}
                {vehicle.motDue && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#666", fontSize: "14px" }}>MOT Due:</span>
                    <span style={{ 
                      fontWeight: "600", 
                      fontSize: "14px",
                      color: new Date(vehicle.motDue) < new Date() ? "#ff4444" : "#28a745"
                    }}>
                      {new Date(vehicle.motDue).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: "#999", textAlign: "center", padding: "20px" }}>
                Vehicle information not available
              </p>
            )}
          </div>
        </div>

        {/* ✅ Enhanced Job Information */}
        <div
          style={{
            backgroundColor: "white",
            padding: "24px",
            borderRadius: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            marginBottom: "20px",
            border: "1px solid #e0e0e0"
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "20px",
              borderBottom: "3px solid #FF4040",
              paddingBottom: "12px",
              fontSize: "20px",
              fontWeight: "700",
              color: "#1a1a1a"
            }}
          >
            Job Information
          </h2>

          {/* ✅ Job Requests with enhanced display */}
          <div style={{ marginBottom: "24px" }}>
            <strong style={{ fontSize: "16px", color: "#333", display: "block", marginBottom: "12px" }}>
              Customer Requests:
            </strong>
            {jobCard.requests && jobCard.requests.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {jobCard.requests.map((req, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "14px",
                      backgroundColor: "#f9f9f9",
                      borderLeft: "4px solid #FF4040",
                      borderRadius: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "14px", color: "#333" }}>
                        {req.text || req}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      {req.time && (
                        <span style={{
                          padding: "4px 10px",
                          backgroundColor: "#e3f2fd",
                          color: "#1976d2",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "600"
                        }}>
                          {req.time}h
                        </span>
                      )}
                      {req.paymentType && (
                        <span style={{
                          padding: "4px 10px",
                          backgroundColor: 
                            req.paymentType === "Warranty" ? "#fff3cd" : 
                            req.paymentType === "Customer" ? "#d4edda" : 
                            "#f8d7da",
                          color: 
                            req.paymentType === "Warranty" ? "#856404" : 
                            req.paymentType === "Customer" ? "#155724" : 
                            "#721c24",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "600"
                        }}>
                          {req.paymentType}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#999", fontStyle: "italic" }}>No requests logged.</p>
            )}
          </div>

          {/* ✅ Cosmetic Notes */}
          {jobCard.cosmeticNotes && (
            <div style={{ marginBottom: "24px" }}>
              <strong style={{ fontSize: "16px", color: "#333", display: "block", marginBottom: "12px" }}>
                Cosmetic Damage Notes:
              </strong>
              <div style={{
                padding: "14px",
                backgroundColor: "#fff9e6",
                borderLeft: "4px solid #ffc107",
                borderRadius: "6px"
              }}>
                <p style={{ margin: 0, fontSize: "14px", color: "#333" }}>
                  {jobCard.cosmeticNotes}
                </p>
              </div>
            </div>
          )}

          {/* ✅ Appointment Info */}
          {jobCard.appointment && (
            <div style={{ marginBottom: "24px" }}>
              <strong style={{ fontSize: "16px", color: "#333", display: "block", marginBottom: "12px" }}>
                Appointment:
              </strong>
              <div style={{
                padding: "14px",
                backgroundColor: "#e8f5e9",
                borderLeft: "4px solid #4caf50",
                borderRadius: "6px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <p style={{ margin: "0 0 6px 0", fontSize: "14px", color: "#333" }}>
                    <strong>Date:</strong> {jobCard.appointment.date}
                  </p>
                  <p style={{ margin: 0, fontSize: "14px", color: "#333" }}>
                    <strong>Time:</strong> {jobCard.appointment.time}
                  </p>
                  {jobCard.appointment.notes && (
                    <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#666" }}>
                      <strong>Notes:</strong> {jobCard.appointment.notes}
                    </p>
                  )}
                </div>
                <span style={{
                  padding: "8px 16px",
                  backgroundColor: jobCard.appointment.status === "Scheduled" ? "#4caf50" : "#ffc107",
                  color: "white",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  {jobCard.appointment.status || "Scheduled"}
                </span>
              </div>
            </div>
          )}

          {/* ✅ Maintenance Info */}
          {jobCard.maintenanceInfo && Object.keys(jobCard.maintenanceInfo).length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <strong style={{ fontSize: "16px", color: "#333", display: "block", marginBottom: "12px" }}>
                Maintenance Information:
              </strong>
              <div style={{
                padding: "14px",
                backgroundColor: "#f0f9ff",
                border: "1px solid #bfdbfe",
                borderRadius: "6px"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {jobCard.maintenanceInfo.nextServiceDate && (
                    <div>
                      <span style={{ color: "#666", fontSize: "13px" }}>Next Service:</span>
                      <p style={{ margin: "4px 0 0 0", fontWeight: "600", fontSize: "14px" }}>
                        {jobCard.maintenanceInfo.nextServiceDate}
                      </p>
                    </div>
                  )}
                  {jobCard.maintenanceInfo.nextMotDate && (
                    <div>
                      <span style={{ color: "#666", fontSize: "13px" }}>Next MOT:</span>
                      <p style={{ margin: "4px 0 0 0", fontWeight: "600", fontSize: "14px" }}>
                        {jobCard.maintenanceInfo.nextMotDate}
                      </p>
                    </div>
                  )}
                  {jobCard.maintenanceInfo.warrantyExpiry && (
                    <div>
                      <span style={{ color: "#666", fontSize: "13px" }}>Warranty Expiry:</span>
                      <p style={{ margin: "4px 0 0 0", fontWeight: "600", fontSize: "14px" }}>
                        {jobCard.maintenanceInfo.warrantyExpiry}
                      </p>
                    </div>
                  )}
                  {jobCard.maintenanceInfo.servicePlanSupplier && (
                    <div>
                      <span style={{ color: "#666", fontSize: "13px" }}>Service Plan:</span>
                      <p style={{ margin: "4px 0 0 0", fontWeight: "600", fontSize: "14px" }}>
                        {jobCard.maintenanceInfo.servicePlanSupplier}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ✅ Additional Info Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "20px"
        }}>
          {/* VHC Checks */}
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#0369a1", marginBottom: "8px" }}>
              {jobCard.vhcChecks?.length || 0}
            </div>
            <div style={{ fontSize: "14px", color: "#666", fontWeight: "500" }}>
              VHC Checks
            </div>
          </div>

          {/* Parts Requests */}
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#92400e", marginBottom: "8px" }}>
              {jobCard.partsRequests?.length || 0}
            </div>
            <div style={{ fontSize: "14px", color: "#666", fontWeight: "500" }}>
              Parts Requests
            </div>
          </div>

          {/* Notes */}
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#166534", marginBottom: "8px" }}>
              {jobCard.notes?.length || 0}
            </div>
            <div style={{ fontSize: "14px", color: "#666", fontWeight: "500" }}>
              Notes
            </div>
          </div>

          {/* Files */}
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#991b1b", marginBottom: "8px" }}>
              {jobCard.files?.length || 0}
            </div>
            <div style={{ fontSize: "14px", color: "#666", fontWeight: "500" }}>
              Attachments
            </div>
          </div>
        </div>

        {/* ✅ Action Buttons - Enhanced */}
        <div style={{ 
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "20px"
        }}>
          <button
            onClick={() => router.push("/job-cards/view")}
            style={{
              padding: "14px 20px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#5a6268"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#6c757d"}
          >
            ← Back to All Jobs
          </button>
          
          <button
            onClick={() => router.push(`/job-cards/${jobNumber}/vhc`)}
            style={{
              padding: "14px 20px",
              backgroundColor: "#0369a1",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#0c4a6e"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#0369a1"}
          >
            🔍 View VHC
          </button>

          <button
            onClick={() => router.push(`/job-cards/${jobNumber}/write-up`)}
            style={{
              padding: "14px 20px",
              backgroundColor: "#166534",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#14532d"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#166534"}
          >
            ✍️ Write-Up
          </button>
          
          <button
            onClick={() => router.push(`/job-cards/${jobNumber}/edit`)}
            style={{
              padding: "14px 20px",
              backgroundColor: "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#cc0000"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#FF4040"}
          >
            ✏️ Edit Job Card
          </button>
        </div>
      </div>
    </Layout>
  );
}