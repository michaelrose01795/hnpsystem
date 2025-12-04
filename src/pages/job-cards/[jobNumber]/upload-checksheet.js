// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/job-cards/[jobNumber]/upload-checksheet.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";

export default function UploadChecksheet() {
  const router = useRouter();
  const { jobNumber } = router.query;

  const [file, setFile] = useState(null);
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ Upload PDF check sheet
  const handleUpload = async () => {
    if (!jobNumber) return alert("Job number missing.");
    if (!file) return alert("Please select a PDF before uploading.");

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/job-cards/${jobNumber}/upload-checksheet`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      alert("✅ Check sheet uploaded successfully!");
      router.push(`/job-cards/${jobNumber}/check-box`);
    } catch (err) {
      console.error("Upload error:", err);
      alert("❌ Failed to upload check sheet. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Update job status
  const handleStatusChange = async (status) => {
    if (!jobNumber) return alert("Job number missing.");

    setLoading(true);
    try {
      const res = await fetch(`/api/job-cards/${jobNumber}/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error("Status update failed");

      alert(`✅ Job marked as: ${status}`);
      router.push("/news-feed");
    } catch (err) {
      console.error("Status update error:", err);
      alert("❌ Failed to update job status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>
        <h2 style={{ color: "var(--primary)", marginBottom: "16px" }}>
          Upload Check Sheet for Job {jobNumber}
        </h2>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ marginBottom: "12px" }}
        />

        {/* ✅ Button row */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleUpload}
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Uploading..." : "Upload"}
          </button>

          <button
            onClick={() => setShowStatusPopup(true)}
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "limegreen",
              color: "black",
              fontWeight: "bold",
              border: "2px solid black",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            ✅ Mark Complete
          </button>
        </div>

        {/* ✅ Status update popup */}
        {showStatusPopup && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(var(--shadow-rgb),0.6)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "8px",
                textAlign: "center",
                width: "300px",
                boxShadow: "0 4px 10px rgba(var(--shadow-rgb),0.2)",
              }}
            >
              <h3 style={{ color: "var(--primary)" }}>Update Job Status</h3>
              <p style={{ marginBottom: "12px" }}>
                Choose the status for this job:
              </p>

              <button
                onClick={() => handleStatusChange("Complete")}
                disabled={loading}
                style={{
                  marginTop: "8px",
                  padding: "10px 16px",
                  backgroundColor: "green",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: loading ? "not-allowed" : "pointer",
                  width: "100%",
                }}
              >
                Complete
              </button>

              <button
                onClick={() =>
                  handleStatusChange("Additional Work Required")
                }
                disabled={loading}
                style={{
                  marginTop: "8px",
                  padding: "10px 16px",
                  backgroundColor: "var(--primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: loading ? "not-allowed" : "pointer",
                  width: "100%",
                }}
              >
                Additional Work Required
              </button>

              <button
                onClick={() => setShowStatusPopup(false)}
                style={{
                  marginTop: "12px",
                  padding: "8px 12px",
                  backgroundColor: "grey",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}