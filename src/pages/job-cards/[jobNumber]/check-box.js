// file location: src/pages/job-cards/[jobNumber]/check-box.js
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import SignatureCanvas from "react-signature-canvas";
import { getJobByNumberOrReg, updateJobVhcCheck } from "../../../lib/database/jobs";

export default function CheckBoxPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [formFields, setFormFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const sigCanvas = useRef(null);

  useEffect(() => {
    if (!jobNumber) return;

    const loadCheckSheet = async () => {
      const job = await getJobByNumberOrReg(jobNumber);
      if (job?.vhcChecks?.length > 0) {
        // Load existing checksheet
        const existing = job.vhcChecks[0]; // Assuming one check sheet per job
        const fields = [
          "Oil Level",
          "Brakes Condition",
          "Tyres Condition",
          "Lights Working",
          "Fluid Levels",
          "Suspension Check"
        ];
        setFormFields(fields.map(name => ({
          name,
          checked: existing[name] || false
        })));
        if (existing.signature) {
          sigCanvas.current?.fromDataURL(existing.signature);
        }
      } else {
        // No existing checksheet → create blank
        const fields = [
          "Oil Level",
          "Brakes Condition",
          "Tyres Condition",
          "Lights Working",
          "Fluid Levels",
          "Suspension Check"
        ];
        setFormFields(fields.map(name => ({ name, checked: false })));
      }
      setLoading(false);
    };

    loadCheckSheet();
  }, [jobNumber]);

  const toggleCheckbox = (index) => {
    setFormFields(prev =>
      prev.map((f, i) => (i === index ? { ...f, checked: !f.checked } : f))
    );
  };

  const checkAll = () => {
    setFormFields(prev => prev.map(f => ({ ...f, checked: true })));
  };

  const handleClearSignature = () => {
    sigCanvas.current.clear();
  };

  const handleSave = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert("Please provide a signature before saving.");
      return;
    }

    const signatureData = sigCanvas.current.getCanvas().toDataURL("image/png");

    // Create a payload with checkbox values
    const checkData = {};
    formFields.forEach(f => {
      checkData[f.name] = f.checked;
    });
    checkData.signature = signatureData;

    try {
      const result = await updateJobVhcCheck(jobNumber, checkData);
      if (result.success) {
        alert("Check sheet saved successfully");
        router.push(`/job-cards/${jobNumber}`);
      } else {
        alert("Failed to save check sheet");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save check sheet");
    }
  };

  // Navigation buttons
  const goBackToJobCard = () => router.push(`/job-cards/${jobNumber}`);
  const goToWriteUp = () => router.push(`/job-cards/${jobNumber}/write-up`);
  const goToVehicleDetails = () => router.push(`/job-cards/${jobNumber}/car-details`);

  if (loading) return <Layout><p>Loading check sheet...</p></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "16px" }}>
        <h2>Service Check Sheet for Job {jobNumber}</h2>

        {formFields.map((field, index) => (
          <div key={index} style={{ marginBottom: "8px" }}>
            <label>
              <input
                type="checkbox"
                checked={field.checked}
                onChange={() => toggleCheckbox(index)}
              />
              {field.name}
            </label>
          </div>
        ))}

        <h3>Technician Signature</h3>
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          canvasProps={{
            width: 600,
            height: 150,
            className: "sigCanvas",
            style: { border: "1px solid #000" }
          }}
        />

        {/* Main action buttons */}
        <div style={{ marginTop: "16px" }}>
          <button
            onClick={handleClearSignature}
            style={{ marginRight: "12px", padding: "8px 16px", backgroundColor: "#ccc", border: "none", borderRadius: "6px" }}
          >
            Clear
          </button>

          <button
            onClick={handleSave}
            style={{ marginRight: "12px", padding: "8px 16px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px" }}
          >
            Save Check Sheet
          </button>

          <button
            onClick={checkAll}
            style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px" }}
          >
            Check All
          </button>
        </div>

        {/* Navigation buttons at the bottom */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
          <button
            onClick={goBackToJobCard}
            style={{ flex: 1, marginRight: "8px", padding: "12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px" }}
          >
            Back to Job Card
          </button>

          <button
            onClick={goToWriteUp}
            style={{ flex: 1, marginRight: "8px", padding: "12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px" }}
          >
            Write-Up
          </button>

          <button
            onClick={goToVehicleDetails}
            style={{ flex: 1, padding: "12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px" }}
          >
            Vehicle Details
          </button>
        </div>
      </div>
    </Layout>
  );
}