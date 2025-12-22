// ✅ Imports converted to use absolute alias "@/"
// src/pages/job-cards/[jobNumber]/dealer-car-details.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import useJobcardsApi from "@/hooks/api/useJobcardsApi";

export default function DealerCarDetailsPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [jobData, setJobData] = useState(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const { getJobcard } = useJobcardsApi();

  // Fetch job details from database
  useEffect(() => {
    if (!jobNumber) return;
    let mounted = true;

    const fetchJob = async () => {
      setError("");
      try {
        const payload = await getJobcard(jobNumber);
        if (!mounted) return;
        const job = payload?.job || payload?.legacy?.jobCard || null;
        if (!job) {
          throw new Error("Job card not found");
        }
        setJobData(job);
      } catch (loadError) {
        console.error("Failed to load dealer details", loadError);
        if (mounted) {
          setError(loadError.message || "Unable to load job details");
          setJobData(null);
        }
      }
    };

    fetchJob();
    return () => {
      mounted = false;
    };
  }, [jobNumber, getJobcard]);

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

  if (error) {
    return (
      <Layout>
        <div style={{ padding: "24px" }}>
          <p style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      </Layout>
    );
  }

  if (!jobData) {
    return (
      <Layout>
        <p>Loading dealer car details...</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "var(--primary)", marginBottom: "16px" }}>
          Dealer Car Details – Job #{jobNumber}
        </h1>

        {/* Display basic job/vehicle info */}
        <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "var(--surface)", borderRadius: "8px" }}>
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
              backgroundColor: "var(--primary)",
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
              backgroundColor: "var(--accent-purple)",
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
