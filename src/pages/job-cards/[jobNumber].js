// file location: src/pages/job-cards/[jobNumber].js
import React, { useState, useEffect } from "react"; // Added useEffect for loading job data
import { useRouter } from "next/router";
import Layout from "../../components/Layout";

export default function JobCardPage() {
  const router = useRouter();
  const { jobNumber } = router.query;

  // Track requests list
  const [requests, setRequests] = useState([
    "Oil change",
    "Brake inspection",
    "MOT preparation",
  ]);

  // Track job data and VHC completion
  const [vhcCompleted, setVhcCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch job data (simulate API for now)
  useEffect(() => {
    if (!jobNumber) return;
    const fetchJob = async () => {
      try {
        const res = await fetch(`/api/job-cards/${jobNumber}`);
        if (res.ok) {
          const data = await res.json();
          setVhcCompleted(data.vhcCompleted || false);
        }
      } catch (err) {
        console.error("Error loading job card:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [jobNumber]);

  // Handle navigation buttons
  const handleStartVHC = () => {
    if (!jobNumber) return;
    router.push(`/job-cards/${jobNumber}/vhc`);
  };

  const handleWriteUp = () => {
    if (!jobNumber) return;
    router.push(`/job-cards/${jobNumber}/write-up`);
  };

  const handleCheckBox = () => {
    if (!jobNumber) return;
    router.push(`/job-cards/${jobNumber}/check-box`);
  };

  const handleFullCarDetails = () => {
    if (!jobNumber) return;
    router.push(`/job-cards/${jobNumber}/car-details`);
  };

  // Handle job completion
  const handleCompleteJob = async () => {
    if (!jobNumber) return;
    try {
      const res = await fetch(`/api/job-cards/${jobNumber}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        router.push("/news"); // Redirect to News page
      } else {
        console.error("Failed to complete job");
      }
    } catch (err) {
      console.error("Error completing job:", err);
    }
  };

  // Fixed heights
  const sectionHeight = "250px"; // vehicle & customer
  const jobDetailsHeight = "350px"; // 3x taller
  const bottomRowHeight = "150px"; // last row

  if (loading) {
    return (
      <Layout>
        <h2>Loading Job Card...</h2>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        {/* Top row */}
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
              Job Card: {jobNumber || "Loading..."}
            </h1>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "12px" }}>
            {vhcCompleted && (
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
              {vhcCompleted ? "Reopen VHC" : "Start VHC"}
            </button>
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
              <strong>Registration:</strong> ABC123
            </p>
            <p>
              <strong>Colour:</strong> Red
            </p>
            <p>
              <strong>Make & Model:</strong> Renault Clio Mk5 1.3 Turbo
            </p>
            <p>
              <strong>Chassis Number:</strong> XYZ987654321
            </p>
            <p>
              <strong>Engine Number:</strong> ENG123456789
            </p>
            <div style={{ marginTop: "8px" }}>
              <label>
                <strong>Mileage:</strong>
                <input
                  type="number"
                  placeholder="Enter miles"
                  style={{
                    marginLeft: "8px",
                    padding: "4px 8px",
                    width: "100px",
                  }}
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
              <strong>Full Name:</strong> John Doe
            </p>
            <p>
              <strong>Address:</strong>
              <br />
              123 Example St,
              <br />
              London,
              <br />
              UK
            </p>
            <p>
              <strong>Email:</strong> john@example.com
            </p>
            <p>
              <strong>Phone:</strong> 01234 567890
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
          {requests.map((req, index) => (
            <p key={index}>
              <strong>Request {index + 1}:</strong> {req}
            </p>
          ))}
        </div>

        {/* Bottom 4 sections */}
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
              placeholder="Scratches, dents, paint damage..."
              style={{ width: "100%", height: "80px", padding: "8px" }}
            />
          </div>

          {/* Write-Up */}
          <div
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
            onClick={handleWriteUp}
          >
            <h4>Go to Write-Up</h4>
          </div>

          {/* Check Box */}
          <div
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
            onClick={handleCheckBox}
          >
            <h4>Go to Check Box</h4>
          </div>

          {/* Full Car Details */}
          <div
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
            onClick={handleFullCarDetails}
          >
            <h4>Full Car Details</h4>
          </div>
        </div>
      </div>
    </Layout>
  );
}
