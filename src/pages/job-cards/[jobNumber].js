// file location: src/pages/job-cards/[jobNumber].js
import React from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";

export default function JobCardPage() {
  const router = useRouter();
  const { jobNumber } = router.query; // get placeholder job number from URL

  const handleStartVHC = () => {
    // Navigate to VHC page for this job
    router.push(`/job-cards/${jobNumber}/vhc`);
  };

  return (
    <Layout>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ color: "#FF4040", marginBottom: "16px" }}>
          Job Card: {jobNumber || "Loading..."}
        </h1>

        <div
          style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            marginBottom: "24px",
          }}
        >
          <p><strong>Vehicle:</strong> Placeholder Vehicle</p>
          <p><strong>Customer:</strong> Placeholder Customer</p>
          <p><strong>Assigned Tech:</strong> You</p>
          <p><strong>Status:</strong> Not Started</p>
        </div>

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
          🚗 Start VHC
        </button>
      </div>
    </Layout>
  );
}
