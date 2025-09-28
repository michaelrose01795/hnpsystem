
// src/pages/job-cards/[jobNumber].js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { useJobs } from "../../context/JobsContext";
import { Document, Page, pdfjs } from "react-pdf";

// ✅ Point pdf.js to the correct worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function JobCardPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const { jobs } = useJobs();

  const [jobData, setJobData] = useState(null);
  const [vhcCompleted, setVhcCompleted] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(null);

  useEffect(() => {
    if (!jobNumber || !jobs) return;
    const job = jobs.find((j) => j.jobNumber === jobNumber);
    if (job) {
      setJobData(job);
      setVhcCompleted(job.vhcCompleted || false);
      if (job.pdfUrl) setPdfFile(job.pdfUrl);
    }
  }, [jobNumber, jobs]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  // Navigation handlers
  const handleStartVHC = () => router.push(`/job-cards/${jobNumber}/vhc`);
  const handleWriteUp = () => router.push(`/job-cards/${jobNumber}/write-up`);
  const handleCheckBox = () => router.push(`/job-cards/${jobNumber}/check-box`);
  const handleFullCarDetails = () => router.push(`/job-cards/${jobNumber}/car-details`);

  const handleCompleteJob = () => {
    alert(`Job ${jobNumber} marked as completed`);
    // In real app, call API or update context here
    router.push("/news");
  };

  if (!jobData) {
    return (
      <Layout>
        <h2>Loading Job Card...</h2>
      </Layout>
    );
  }

  const { customer, car, vsmData, requests } = jobData;

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#555" }}>Retail / Sales / Warranty</h2>
            <h1 style={{ color: "#FF4040", margin: 0 }}>Job Card: {jobNumber}</h1>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            {vhcCompleted && (
              <button onClick={handleCompleteJob} style={{ padding: "12px 20px", backgroundColor: "green", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "1rem" }}>
                Complete Job
              </button>
            )}
            <button onClick={handleStartVHC} style={{ padding: "12px 20px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "1rem" }}>
              {vhcCompleted ? "Reopen VHC" : "Start VHC"}
            </button>
          </div>
        </div>

        {/* Vehicle & Customer Details */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          {/* Vehicle */}
          <div style={{ flex: 1, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <h3>Vehicle Details</h3>
            <p><strong>Registration:</strong> {car.registration}</p>
            <p><strong>Make:</strong> {vsmData.make}</p>
            <p><strong>Model:</strong> {vsmData.model}</p>
            <p><strong>Colour:</strong> {vsmData.colour}</p>
            <p><strong>Chassis Number:</strong> {vsmData.chassis}</p>
            <p><strong>Engine Number:</strong> {vsmData.engine}</p>
            <p><strong>Mileage:</strong> {car.mileage || "N/A"}</p>
          </div>

          {/* Customer */}
          <div style={{ flex: 1, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <h3>Customer Details</h3>
            <p><strong>Name:</strong> {customer.firstName} {customer.lastName}</p>
            <p><strong>Address:</strong> {customer.address}</p>
            <p><strong>Email:</strong> {customer.email}</p>
            <p><strong>Mobile:</strong> {customer.mobile}</p>
            <p><strong>Telephone:</strong> {customer.telephone}</p>
          </div>
        </div>

        {/* Job Details */}
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "24px" }}>
          <h3>Job Requests</h3>
          {requests.map((req, i) => (<p key={i}><strong>Request {i + 1}:</strong> {req}</p>))}

          {/* PDF */}
          {pdfFile && (
            <div style={{ marginTop: "16px" }}>
              <h4>Attached PDF:</h4>
              <Document file={pdfFile} onLoadSuccess={onDocumentLoadSuccess}>
                {Array.from(new Array(numPages), (el, index) => (
                  <Page key={index} pageNumber={index + 1} width={600} />
                ))}
              </Document>
            </div>
          )}
        </div>

        {/* Bottom sections */}
        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ flex: 1, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <h4>Cosmetic Damage</h4>
            <textarea placeholder="Scratches, dents, paint damage..." style={{ width: "100%", height: "80px", padding: "8px" }} />
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#FF4040", color: "white", borderRadius: "8px", cursor: "pointer" }} onClick={handleWriteUp}>
            <h4>Go to Write-Up</h4>
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#FF4040", color: "white", borderRadius: "8px", cursor: "pointer" }} onClick={handleCheckBox}>
            <h4>Go to Check Box</h4>
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#FF4040", color: "white", borderRadius: "8px", cursor: "pointer" }} onClick={handleFullCarDetails}>
            <h4>Full Car Details</h4>
          </div>
        </div>
      </div>
    </Layout>
  );
}
