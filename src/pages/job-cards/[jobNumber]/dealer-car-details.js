// src/pages/job-cards/[jobNumber]/dealer-car-details.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";

export default function DealerCarDetailsPage() {
  const router = useRouter();
  const [jobNumber, setJobNumber] = useState("");
  const [file, setFile] = useState(null);

  // Set jobNumber from query
  useEffect(() => {
    if (router.query.jobNumber) setJobNumber(router.query.jobNumber);
  }, [router.query.jobNumber]);

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

  return (
    <Layout>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040", marginBottom: "16px" }}>
          Dealer Car Details – Job #{jobNumber}
        </h1>
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
