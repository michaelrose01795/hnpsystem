// ✅ Imports converted to use absolute alias "@/"
// src/pages/job-cards/[jobNumber]/dealer-car-details.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { getJobByNumberOrReg } from "@/lib/database/jobs";

export default function DealerCarDetailsPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [jobData, setJobData] = useState(null);
  const [file, setFile] = useState(null);

  // Fetch job details from database
  useEffect(() => {
    if (!jobNumber) return;

    const fetchJob = async () => {
      const job = await getJobByNumberOrReg(jobNumber);
      if (job) setJobData(job);
    };

    fetchJob();
  }, [jobNumber]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file to upload");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("jobNumber", jobNumber);

    try {
      const res = await fetch(`/api/job-cards/${jobNumber}/upload-dealer-file`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        alert("File uploaded successfully");
        router.push(`/job-cards/${jobNumber}`);
      } else {
        alert("Failed to upload file");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while uploading");
    }
  };

  const handleGoToAppointment = () => {
    router.push(`/appointments?jobNumber=${jobNumber}`);
  };

  if (!jobData) return <Layout><p>Loading dealer car details...</p></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040", marginBottom: "16px" }}>
          Dealer Car Details – Job #{jobNumber}
        </h1>

        {/* Display basic job/vehicle info */}
        <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#f9f9f9", borderRadius: "8px" }}>
          <p><strong>Vehicle Registration:</strong> {jobData.reg}</p>
          <p><strong>Make & Model:</strong> {jobData.vehicle?.make} {jobData.vehicle?.model}</p>
          <p><strong>Customer:</strong> {jobData.customer}</p>
        </div>

        {/* File upload section */}
        <input type="file" onChange={handleFileChange} />
        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          <button
            onClick={handleUpload}
            style={{
              padding: "12px 20px",
              backgroundColor: "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "6px",
            }}
          >
            Upload File
          </button>

          <button
            onClick={handleGoToAppointment}
            style={{
              padding: "12px 20px",
              backgroundColor: "#4040FF",
              color: "white",
              border: "none",
              borderRadius: "6px",
            }}
          >
            Go To Appointment
          </button>
        </div>
      </div>
    </Layout>
  );
}