// src/pages/job-cards/[jobNumber]/dealer-car-details.js
"use client";

import React, { useState } from "react";
import Layout from "../../../components/Layout";
import { useRouter } from "next/router";

export default function DealerCarDetailsPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) setFile(e.target.files[0]);
  };

  const handleSubmit = () => {
    console.log("Dealer Car Details File (placeholder):", file);
    alert("Dealer car details saved (placeholder)");
    // Optionally navigate back to job card page
    router.push(`/job-cards/${router.query.jobNumber}`);
  };

  return (
    <Layout>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040" }}>Add Dealer Car Details</h1>
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", marginBottom: "24px" }}>
          <input type="file" onChange={handleFileChange} />
          {file && <p>Selected file: {file.name}</p>}
        </div>
        <button
          onClick={handleSubmit}
          style={{
            padding: "12px 20px",
            backgroundColor: "#FF4040",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
          }}
        >
          Save Dealer Car Details
        </button>
      </div>
    </Layout>
  );
}
