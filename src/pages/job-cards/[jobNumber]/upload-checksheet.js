// file location: src/pages/job-cards/[jobNumber]/upload-checksheet.js
import React, { useState } from "react"; // import React and hooks
import { useRouter } from "next/router"; // import router for navigation
import Layout from "../../../components/Layout"; // import Layout wrapper

export default function UploadChecksheet() {
  const router = useRouter(); // get router instance
  const { jobNumber } = router.query; // extract job number from URL
  const [file, setFile] = useState(null); // store selected file
  const [showStatusPopup, setShowStatusPopup] = useState(false); // toggle popup modal

  // ✅ Upload handler
  const handleUpload = async () => {
    if (!file) return alert("Please select a PDF first"); // validate file

    const formData = new FormData(); // create form data
    formData.append("file", file); // append file to form data

    const res = await fetch(`/api/job-cards/${jobNumber}/upload-checksheet`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      alert("Check sheet uploaded successfully");
      router.push(`/job-cards/${jobNumber}/check-box`); // go to checkbox page
    } else {
      alert("Upload failed");
    }
  };

  // ✅ Job status update handler
  const handleStatusChange = async (status) => {
    try {
      const res = await fetch(`/api/job-cards/${jobNumber}/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        alert(`Job marked as: ${status}`);
        router.push("/news-feed"); // redirect back to news feed
      } else {
        alert("Failed to update job status");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating job status");
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>
        <h2>Upload Check Sheet for Job {jobNumber}</h2>

        {/* File upload input */}
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
        />

        {/* Upload button */}
        <button
          onClick={handleUpload}
          style={{
            marginTop: "12px",
            padding: "10px 16px",
            backgroundColor: "#FF4040",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            display: "block",
          }}
        >
          Upload
        </button>

        {/* Complete button */}
        <button
          onClick={() => setShowStatusPopup(true)} // show popup
          style={{
            marginTop: "12px",
            padding: "10px 16px",
            backgroundColor: "green",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            display: "block",
          }}
        >
          Complete
        </button>

        {/* ✅ Popup Modal */}
        {showStatusPopup && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0,0,0,0.5)",
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

              {/* Buttons for status options */}
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

              {/* Cancel button */}
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