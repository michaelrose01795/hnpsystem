// file location: src/pages/job-cards/[jobNumber]/vhc.js

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal";
import BrakesHubsDetailsModal from "@/components/VHC/BrakesHubsDetailsModal";
import ServiceIndicatorDetailsModal from "@/components/VHC/ServiceIndicatorDetailsModal";

// ✅ Reusable section card component
const SectionCard = ({ title, subtitle, onClick }) => (
  <div
    className={`border p-6 rounded-lg shadow-md bg-white transition transform hover:-translate-y-1 hover:shadow-xl ${
      onClick ? "cursor-pointer" : ""
    }`}
    onClick={onClick}
  >
    <h2 className="font-semibold text-red-600 text-lg mb-2">{title}</h2>
    <p className="text-sm text-gray-600">{subtitle}</p>
  </div>
);

export default function VHCPAGE() {
  const router = useRouter();
  const { jobNumber } = router.query;

  const [vhcData, setVhcData] = useState({
    wheelsTyres: null,
    brakesHubs: [],
    serviceIndicator: [],
    externalInspection: [],
    internalElectrics: [],
    underside: [],
    cosmetics: [],
  });

  const [activeSection, setActiveSection] = useState(null);

  return (
    <Layout>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <h1 style={{ color: "#FF4040", marginBottom: "24px" }}>
          Vehicle Health Check - Job {jobNumber || "Loading..."}
        </h1>

        {/* ✅ Mandatory Section */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">Mandatory</h2>
        <div className="flex flex-col gap-4 mb-6">
          {/* Top row: Wheels & Tyres + Brakes & Hubs side by side */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[48%]">
              <SectionCard
                title="Wheels & Tyres"
                subtitle={vhcData.wheelsTyres ? "Details completed" : "No issues logged yet"}
                onClick={() => setActiveSection("wheelsTyres")}
              />
            </div>
            <div className="flex-1 min-w-[48%]">
              <SectionCard
                title="Brakes & Hubs"
                subtitle={`${vhcData.brakesHubs.length} issues logged`}
                onClick={() => setActiveSection("brakesHubs")}
              />
            </div>
          </div>

          {/* Bottom row: Service Indicator + Under Bonnet full width */}
          <div className="w-full">
            <SectionCard
              title="Service Indicator and Under Bonnet"
              subtitle={`${vhcData.serviceIndicator.length} issues logged`}
              onClick={() => setActiveSection("serviceIndicator")}
            />
          </div>
        </div>

        {/* ✅ Divider */}
        <hr className="my-8 border-gray-300" />

        {/* ✅ Optional Section */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">Optional</h2>
        <div className="grid grid-cols-2 gap-4">
          <SectionCard
            title="External / Drive-in Inspection"
            subtitle={`${vhcData.externalInspection.length} issues logged`}
            onClick={() => setActiveSection("externalInspection")}
          />
          <SectionCard
            title="Internal / Lamps / Electrics"
            subtitle={`${vhcData.internalElectrics.length} issues logged`}
            onClick={() => setActiveSection("internalElectrics")}
          />
          <SectionCard
            title="Underside"
            subtitle={`${vhcData.underside.length} issues logged`}
            onClick={() => setActiveSection("underside")}
          />
          <SectionCard
            title="Cosmetics"
            subtitle={`${vhcData.cosmetics.length} issues logged`}
            onClick={() => setActiveSection("cosmetics")}
          />
        </div>

        {/* ✅ Modals */}
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

        {activeSection === "brakesHubs" && (
          <BrakesHubsDetailsModal
            isOpen={true}
            initialData={vhcData.brakesHubs}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, brakesHubs: data }));
              setActiveSection(null);
            }}
          />
        )}

        {activeSection === "serviceIndicator" && (
          <ServiceIndicatorDetailsModal
            isOpen={true}
            initialData={vhcData.serviceIndicator}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, serviceIndicator: data }));
              setActiveSection(null);
            }}
          />
        )}

        {/* Optional Section Modals */}
        {activeSection &&
          ["externalInspection", "internalElectrics", "underside", "cosmetics"].includes(
            activeSection
          ) && (
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
                  {
                    {
                      externalInspection: "External / Drive-in Inspection",
                      internalElectrics: "Internal / Lamps / Electrics",
                      underside: "Underside",
                      cosmetics: "Cosmetics",
                    }[activeSection]
                  }
                </h2>

                {vhcData[activeSection].length === 0 ? (
                  <p>No issues logged yet</p>
                ) : (
                  <ul style={{ marginBottom: "16px" }}>
                    {vhcData[activeSection].map((issue, idx) => (
                      <li
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 0",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        <span>{issue.title || "Untitled Issue"}</span>
                        <button
                          onClick={() => {
                            setVhcData((prev) => ({
                              ...prev,
                              [activeSection]: prev[activeSection].filter(
                                (_, i) => i !== idx
                              ),
                            }));
                          }}
                          style={{
                            background: "#FF4040",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

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
                    marginBottom: "16px",
                  }}
                >
                  + Add Issue
                </button>

                <div style={{ textAlign: "right" }}>
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