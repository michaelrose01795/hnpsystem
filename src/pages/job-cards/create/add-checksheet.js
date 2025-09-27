// file location: src/pages/job-cards/create/add-checksheet.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";

// ✅ Simple signature component
function Signature({ label, onChange }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label>{label}:</label>
      <input
        type="text"
        placeholder="Sign here"
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "6px", marginTop: "4px" }}
      />
    </div>
  );
}

export default function AddCheckSheetPage() {
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [checks, setChecks] = useState({
    brakes: false,
    tyres: false,
    engine: false,
    lights: false,
    fluids: false,
  });
  const [signatures, setSignatures] = useState({ technician: "", manager: "" });

  const handleFileChange = (e) => {
    setFiles([...e.target.files]);
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setChecks((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSignatureChange = (field, value) => {
    setSignatures((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const checkSheetData = { files, checks, signatures };
    console.log("Check Sheet Data (placeholder):", checkSheetData);

    // Navigate to dealer car details page after completing checksheet
    router.push(`/job-cards/${router.query.jobNumber}/dealer-car-details`);
  };

  return (
    <Layout>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040" }}>Add Check Sheet</h1>

        {/* File Upload */}
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", marginBottom: "24px" }}>
          <h3>Upload Check Sheet Files</h3>
          <input type="file" multiple onChange={handleFileChange} />
          {files.length > 0 && (
            <ul style={{ marginTop: "12px" }}>
              {files.map((file, index) => (
                <li key={index}>{file.name}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Checkboxes */}
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", marginBottom: "24px" }}>
          <h3>Checklist</h3>
          {Object.keys(checks).map((key) => (
            <div key={key} style={{ marginBottom: "8px" }}>
              <label>
                <input
                  type="checkbox"
                  name={key}
                  checked={checks[key]}
                  onChange={handleCheckboxChange}
                  style={{ marginRight: "8px" }}
                />
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
            </div>
          ))}
        </div>

        {/* Signatures */}
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", marginBottom: "24px" }}>
          <h3>Signatures</h3>
          <Signature label="Technician" onChange={(val) => handleSignatureChange("technician", val)} />
          <Signature label="Manager" onChange={(val) => handleSignatureChange("manager", val)} />
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
          Save Check Sheet & Continue
        </button>
      </div>
    </Layout>
  );
}
