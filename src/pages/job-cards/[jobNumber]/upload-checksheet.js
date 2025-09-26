// file location: src/pages/job-cards/[jobNumber]/upload-checksheet.js
import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";

export default function UploadChecksheet() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [file, setFile] = useState(null);

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

  return (
    <Layout>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>
        <h2>Upload Check Sheet for Job {jobNumber}</h2>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
        />
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
          }}
        >
          Upload
        </button>
      </div>
    </Layout>
  );
}
