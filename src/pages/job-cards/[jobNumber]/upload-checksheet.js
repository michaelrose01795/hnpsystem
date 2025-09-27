// file location: src/pages/job-cards/[jobNumber]/upload-checksheet.js
import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";

export default function UploadChecksheet() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [file, setFile] = useState(null);
  const [showStatusPopup, setShowStatusPopup] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("Please select a PDF first");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/job-cards/${jobNumber}/upload-checksheet`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      alert("Check sheet uploaded successfully");
      router.push(`/job-cards/${jobNumber}/check-box`);
    } else {
      alert("Upload failed");
    }
  };

  const handleStatusChange = async (status) => {
    const res = await fetch(`/api/job-cards/${jobNumber}/update-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      alert(`Job marked as: ${status}`);
      router.push("/news-feed");
    } else {
      alert("Failed to update job status");
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>
        <h2>Upload Check Sheet for Job {jobNumber}</h2>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
        />

        {/* ✅ Button row */}
        <div
          style={{
            marginTop: "12px",
            display: "flex",
            gap: "12px",
          }}
        >
          {/* Upload button */}
          <button
            onClick={handleUpload}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Upload
          </button>

          {/* Complete button */}
          <button
            onClick={() => setShowStatusPopup(true)}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "limegreen",
              color: "black",
              fontWeight: "bold",
              border: "2px solid black",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            ✅ Mark Complete
          </button>
        </div>

        {/* Popup modal */}
        {showStatusPopup && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0,0,0,0.6)",
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
              }}
            >
              <h3>Update Job Status</h3>
              <p>Choose the status for this job:</p>

              <button
                onClick={() => handleStatusChange("Complete")}
                style={{
                  marginTop: "8px",
                  padding: "10px 16px",
                  backgroundColor: "green",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Complete
              </button>

              <button
                onClick={() => handleStatusChange("Additional Work Required")}
                style={{
                  marginTop: "8px",
                  padding: "10px 16px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
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