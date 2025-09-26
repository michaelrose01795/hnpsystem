// file location: src/pages/job-cards/[jobNumber]/write-up.js
import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";

export default function WriteUpPage() {
  const router = useRouter();
  const { jobNumber } = router.query;

  const [writeUpData, setWriteUpData] = useState({
    fault: "",
    caused: "",
    ratification: "",
    warrantyClaim: "",
    tsrNumber: "",
    pwaNumber: "",
    technicalBulletins: "",
    technicalSignature: "",
    qualityControl: "",
    additionalParts: "",
    qty: Array(10).fill(false),
    booked: Array(10).fill(false),
  });

  const handleChange = (field, value) => {
    setWriteUpData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field, index) => {
    const updatedArray = [...writeUpData[field]];
    updatedArray[index] = !updatedArray[index];
    setWriteUpData(prev => ({ ...prev, [field]: updatedArray }));
  };

  // Navigation buttons
  const goBackToJobCard = () => router.push(`/job-cards/${jobNumber}`);
  const goToCheckSheet = () => router.push(`/job-cards/${jobNumber}/check-box`);
  const goToVehicleDetails = () => router.push(`/job-cards/${jobNumber}/dealership-car-details`);

  return (
    <Layout>
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "16px", display: "flex", gap: "16px" }}>
        
        {/* Left 60%: Fault / Caused / Ratification */}
        <div style={{ flex: 3, display: "flex", flexDirection: "column", gap: "16px" }}>
          {["fault", "caused", "ratification"].map((field, idx) => (
            <div key={idx} style={{
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              flex: 1,
              display: "flex",
              flexDirection: "column"
            }}>
              <h3 style={{ marginTop: 0, color: "#FF4040", textTransform: "capitalize" }}>{field}</h3>
              <textarea
                placeholder={`Enter ${field} details...`}
                value={writeUpData[field]}
                onChange={e => handleChange(field, e.target.value)}
                style={{ flex: 1, padding: "8px", width: "100%", resize: "none" }}
              />
            </div>
          ))}
        </div>

        {/* Right 40%: Other fields */}
        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Warranty / TSR */}
          <div style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            <label>
              Warranty Claim Number
              <input
                type="text"
                value={writeUpData.warrantyClaim}
                onChange={e => handleChange("warrantyClaim", e.target.value)}
                style={{ width: "100%", padding: "6px", marginTop: "4px" }}
              />
            </label>
            <label>
              TSR Number
              <input
                type="text"
                value={writeUpData.tsrNumber}
                onChange={e => handleChange("tsrNumber", e.target.value)}
                style={{ width: "100%", padding: "6px", marginTop: "4px" }}
              />
            </label>
          </div>

          {/* PWA Number */}
          <div style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}>
            <label>
              PWA Number
              <input
                type="text"
                value={writeUpData.pwaNumber}
                onChange={e => handleChange("pwaNumber", e.target.value)}
                style={{ width: "100%", padding: "6px", marginTop: "4px" }}
              />
            </label>
          </div>

          {/* Technical Bulletins */}
          <div style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}>
            <label>
              Technical Bulletins
              <textarea
                value={writeUpData.technicalBulletins}
                onChange={e => handleChange("technicalBulletins", e.target.value)}
                style={{ width: "100%", padding: "6px", marginTop: "4px", resize: "none" }}
              />
            </label>
          </div>

          {/* Technical Signature & Quality Control */}
          <div style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            <label>
              Technical Signature
              <input
                type="text"
                value={writeUpData.technicalSignature}
                onChange={e => handleChange("technicalSignature", e.target.value)}
                style={{ width: "100%", padding: "6px", marginTop: "4px" }}
              />
            </label>
            <label>
              Quality Control
              <input
                type="text"
                value={writeUpData.qualityControl}
                onChange={e => handleChange("qualityControl", e.target.value)}
                style={{ width: "100%", padding: "6px", marginTop: "4px" }}
              />
            </label>
          </div>

          {/* Additional Parts */}
          <div style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}>
            <label>
              Additional Parts
              <textarea
                value={writeUpData.additionalParts}
                onChange={e => handleChange("additionalParts", e.target.value)}
                style={{ width: "100%", padding: "6px", marginTop: "4px", resize: "none" }}
              />
            </label>
          </div>

          {/* Qty & Booked Y/N */}
          <div style={{ display: "flex", gap: "16px" }}>
            
            {/* Qty */}
            <div style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}>
              <h4 style={{ marginTop: 0 }}>QTY</h4>
              {writeUpData.qty.map((checked, idx) => (
                <label key={idx} style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleCheckboxChange("qty", idx)}
                    style={{ marginRight: "8px" }}
                  />
                </label>
              ))}
            </div>

            {/* Booked Y/N */}
            <div style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}>
              <h4 style={{ marginTop: 0 }}>Booked Y/N</h4>
              {writeUpData.booked.map((checked, idx) => (
                <label key={idx} style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleCheckboxChange("booked", idx)}
                    style={{ marginRight: "8px" }}
                  />
                </label>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Bottom Navigation Buttons */}
      <div style={{ maxWidth: "1400px", margin: "24px auto 0 auto", display: "flex", gap: "12px" }}>
        <button
          onClick={goBackToJobCard}
          style={{ flex: 1, padding: "12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px" }}
        >
          Back to Job Card
        </button>

        <button
          onClick={goToCheckSheet}
          style={{ flex: 1, padding: "12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px" }}
        >
          Check Sheet
        </button>

        <button
          onClick={goToVehicleDetails}
          style={{ flex: 1, padding: "12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px" }}
        >
          Vehicle Details
        </button>
      </div>
    </Layout>
  );
}
