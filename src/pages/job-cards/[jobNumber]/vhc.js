// file location: src/pages/job-cards/[jobNumber]/vhc.js
import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";

export default function VHCPAGE() {
  const router = useRouter();
  const { jobNumber } = router.query;

  // Keep all VHC data here
  const [vhcData, setVhcData] = useState({
    wheelsTyres: [],
    brakesHubs: [],
    serviceBook: [],
    underBonnet: [],
    externalInspection: [],
    internalElectrics: [],
    underside: [],
    cosmetics: [],
  });

  const [activeSection, setActiveSection] = useState(null); // which modal is open

  // Add placeholder issue
  const addIssue = (section) => {
    setVhcData((prev) => ({
      ...prev,
      [section]: [...prev[section], { title: "New Issue", details: "" }],
    }));
  };

  // Close modal
  const closeModal = () => setActiveSection(null);

  // Config of sections
  const sections = [
    { key: "wheelsTyres", label: "Wheels & Tyres" },
    { key: "brakesHubs", label: "Brakes & Hubs" },
    { key: "serviceBook", label: "Service Book / Indicator" },
    { key: "underBonnet", label: "Under Bonnet" },
    { key: "externalInspection", label: "External / Drive-in Inspection" },
    { key: "internalElectrics", label: "Internal / Lamps / Electrics" },
    { key: "underside", label: "Underside" },
    { key: "cosmetics", label: "Cosmetics" },
  ];

  return (
    <Layout>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <h1 style={{ color: "#FF4040", marginBottom: "24px" }}>
          Vehicle Health Check - Job {jobNumber || "Loading..."}
        </h1>

        {/* Two-column grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          {sections.map((section) => (
            <div
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <h2
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "#FF4040",
                }}
              >
                {section.label}
              </h2>
              <p style={{ fontSize: "0.9rem", color: "#555" }}>
                {vhcData[section.key].length} issues logged
              </p>
            </div>
          ))}
        </div>

        {/* Modal */}
        {activeSection && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "white",
                padding: "24px",
                borderRadius: "10px",
                width: "600px",
                maxHeight: "80vh",
                overflowY: "auto",
              }}
            >
              <h2 style={{ color: "#FF4040", marginBottom: "16px" }}>
                {sections.find((s) => s.key === activeSection)?.label}
              </h2>

              {/* Show current issues */}
              {vhcData[activeSection].length === 0 && (
                <p>No issues logged yet</p>
              )}
              {vhcData[activeSection].map((issue, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: "10px",
                    padding: "10px",
                    border: "1px solid #FFCCCC",
                    borderRadius: "4px",
                  }}
                >
                  <strong>{issue.title}</strong>:{" "}
                  {issue.details || "No details"}
                </div>
              ))}

              {/* Add new issue */}
              <button
                onClick={() => addIssue(activeSection)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "0.9rem",
                  marginTop: "10px",
                }}
              >
                + Add Issue
              </button>

              <div style={{ marginTop: "20px", textAlign: "right" }}>
                <button
                  onClick={closeModal}
                  style={{
                    padding: "8px 16px",
                    border: "none",
                    background: "#FF4040",
                    color: "white",
                    borderRadius: "6px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
