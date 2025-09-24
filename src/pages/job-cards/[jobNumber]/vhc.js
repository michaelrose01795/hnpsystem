// file location: src/pages/job-cards/[jobNumber]/vhc.js

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal";

// ✅ Reusable section card component
const SectionCard = ({ title, subtitle, onClick }) => (
  <div
    className={`border p-4 rounded ${onClick ? "cursor-pointer hover:bg-gray-100" : ""}`}
    onClick={onClick}
  >
    <h2 className="font-semibold text-red-600">{title}</h2>
    <p>{subtitle}</p>
  </div>
);

export default function VHCPAGE() {
  const router = useRouter();
  const { jobNumber } = router.query;

  // ✅ VHC data for all sections
  const [vhcData, setVhcData] = useState({
    wheelsTyres: null, // detailed modal data
    brakesHubs: [],
    serviceBook: [],
    underBonnet: [],
    externalInspection: [],
    internalElectrics: [],
    underside: [],
    cosmetics: [],
  });

  // ✅ Currently active section (for modals)
  const [activeSection, setActiveSection] = useState(null);

  // ✅ Log whenever Wheels & Tyres modal opens (optional debug)
  useEffect(() => {
    if (activeSection === "wheelsTyres") {
      console.log("Opening Wheels & Tyres modal");
    }
  }, [activeSection]);

  // ✅ Sections config
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

        {/* ✅ Two-column grid for section cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          {sections.map((section) => (
            <SectionCard
              key={section.key}
              title={section.label}
              subtitle={
                section.key === "wheelsTyres"
                  ? vhcData.wheelsTyres
                    ? "Details completed"
                    : "No issues logged yet"
                  : `${vhcData[section.key].length} issues logged`
              }
              onClick={() => setActiveSection(section.key)}
            />
          ))}
        </div>

        {/* ========================= */}
        {/* ✅ Wheels & Tyres Detailed Modal */}
        {/* ========================= */}
        {activeSection === "wheelsTyres" && (
          <WheelsTyresDetailsModal
            isOpen={true}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, wheelsTyres: data }));
              setActiveSection(null);
            }}
          />
        )}

        {/* ========================= */}
        {/* ✅ Placeholder Modals for All Other Sections */}
        {/* ========================= */}
        {activeSection && activeSection !== "wheelsTyres" && (
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

              {/* Placeholder content */}
              <p>No issues logged yet (placeholder)</p>

              {/* Add new issue */}
              <button
                onClick={() =>
                  setVhcData((prev) => ({
                    ...prev,
                    [activeSection]: [
                      ...prev[activeSection],
                      { title: "New Issue", details: "" },
                    ],
                  }))
                }
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

              {/* Close modal */}
              <div style={{ marginTop: "20px", textAlign: "right" }}>
                <button
                  onClick={() => setActiveSection(null)}
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
