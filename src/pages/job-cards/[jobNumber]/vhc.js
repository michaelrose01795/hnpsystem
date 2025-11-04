// ✅ File location: src/pages/job-cards/[jobNumber]/vhc.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";

// 🧩 Import database helper
import { getJobByNumberOrReg, saveChecksheet } from "@/lib/database/jobs";

// 🧩 Import section modals
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal";
import BrakesHubsDetailsModal from "@/components/VHC/BrakesHubsDetailsModal";
import ServiceIndicatorDetailsModal from "@/components/VHC/ServiceIndicatorDetailsModal";
import ExternalDetailsModal from "@/components/VHC/ExternalDetailsModal";
import InternalElectricsDetailsModal from "@/components/VHC/InternalElectricsDetailsModal";
import UndersideDetailsModal from "@/components/VHC/UndersideDetailsModal";

// Section labels
const SECTION_TITLES = {
  wheelsTyres: "Wheels & Tyres",
  brakesHubs: "Brakes & Hubs",
  serviceIndicator: "Service Indicator & Under Bonnet",
  externalInspection: "External / Drive-in Inspection",
  internalElectrics: "Internal / Lamps / Electrics",
  underside: "Underside",
};

export default function VHCPAGE() {
  const router = useRouter();
  const { jobNumber } = router.query;

  // ✅ Initial VHC data structure
  const [vhcData, setVhcData] = useState({
    wheelsTyres: null,
    brakesHubs: [],
    serviceIndicator: [],
    externalInspection: [],
    internalElectrics: {
      "Lights Front": { concerns: [] },
      "Lights Rear": { concerns: [] },
      "Lights Interior": { concerns: [] },
      "Horn/Washers/Wipers": { concerns: [] },
      "Air Con/Heating/Ventilation": { concerns: [] },
      "Warning Lamps": { concerns: [] },
      Seatbelt: { concerns: [] },
      Miscellaneous: { concerns: [] },
    },
    underside: {
      "Exhaust System/Catalyst": { concerns: [] },
      Steering: { concerns: [] },
      "Front Suspension": { concerns: [] },
      "Rear Suspension": { concerns: [] },
      "Driveshafts/Oil Leaks": { concerns: [] },
      Miscellaneous: { concerns: [] },
    },
  });

  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ============================================
     LOAD EXISTING VHC DATA IF IT EXISTS
  ============================================= */
  useEffect(() => {
    if (!jobNumber) return;
    const loadVhc = async () => {
      try {
        setLoading(true);
        const job = await getJobByNumberOrReg(jobNumber);
        if (job?.vhcChecks?.length > 0 && job.vhcChecks[0].data) {
          setVhcData(job.vhcChecks[0].data);
        }
      } catch (err) {
        console.error("❌ Error loading VHC:", err);
      } finally {
        setLoading(false);
      }
    };
    loadVhc();
  }, [jobNumber]);

  /* ============================================
     SAVE VHC DATA TO DATABASE
  ============================================= */
  const saveVhcData = async () => {
    if (!jobNumber) return;
    try {
      const result = await saveChecksheet(jobNumber, vhcData);
      if (!result.success) console.error("❌ Failed to save VHC:", result.error);
    } catch (err) {
      console.error("❌ Error saving VHC:", err);
    }
  };

  /* ============================================
     BUTTON HANDLERS
  ============================================= */
  const handleBack = async () => {
    await saveVhcData();
    router.push(`/job-cards/${jobNumber}`);
  };

  const handleComplete = async () => {
    if (!mandatoryComplete) return;
    await saveVhcData();
    router.push(`/job-cards/${jobNumber}`);
  };

  // Mandatory section check
  const mandatoryComplete =
    vhcData.wheelsTyres &&
    vhcData.brakesHubs.length > 0 &&
    vhcData.serviceIndicator.length > 0;

  // Section card component
  const SectionCard = ({ title, subtitle, onClick }) => (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        padding: "16px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.transform = "translateY(-2px)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#FF4040" }}>
        {title}
      </h3>
      <p style={{ marginTop: "4px", color: "#555" }}>{subtitle}</p>
    </div>
  );

  if (loading)
    return (
      <Layout>
        <div style={{ padding: "24px" }}>
          <h1 style={{ color: "#FF4040" }}>Loading VHC Data...</h1>
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <h1 style={{ color: "#FF4040", margin: 0 }}>
            Vehicle Health Check - Job {jobNumber || "Loading..."}
          </h1>
        </div>

        {/* MANDATORY SECTIONS */}
        <h2 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "#555" }}>
          Mandatory
        </h2>
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          <SectionCard
            title="Wheels & Tyres"
            subtitle={
              vhcData.wheelsTyres ? "Details completed" : "No issues logged yet"
            }
            onClick={() => setActiveSection("wheelsTyres")}
          />
          <SectionCard
            title="Brakes & Hubs"
            subtitle={`${vhcData.brakesHubs.length} issues logged`}
            onClick={() => setActiveSection("brakesHubs")}
          />
          <SectionCard
            title="Service Indicator & Under Bonnet"
            subtitle={`${vhcData.serviceIndicator.length} issues logged`}
            onClick={() => setActiveSection("serviceIndicator")}
          />
        </div>

        {/* OPTIONAL SECTIONS */}
        <h2 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "#555" }}>
          Optional
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
          {["externalInspection", "internalElectrics", "underside"].map(
            (section) => (
              <SectionCard
                key={section}
                title={SECTION_TITLES[section]}
                subtitle={`${Object.keys(vhcData[section]).length} categories`}
                onClick={() => setActiveSection(section)}
              />
            )
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "24px",
          }}
        >
          <button
            onClick={handleBack}
            style={{
              padding: "12px 20px",
              backgroundColor: "gray",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Back
          </button>
          <button
            onClick={handleComplete}
            disabled={!mandatoryComplete}
            style={{
              padding: "12px 20px",
              backgroundColor: mandatoryComplete ? "#FF4040" : "#aaa",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: mandatoryComplete ? "pointer" : "not-allowed",
              fontSize: "1rem",
            }}
          >
            Complete VHC
          </button>
        </div>

        {/* MODALS */}
        {activeSection === "wheelsTyres" && (
          <WheelsTyresDetailsModal
            isOpen
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, wheelsTyres: data }));
              setActiveSection(null);
            }}
          />
        )}
        {activeSection === "brakesHubs" && (
          <BrakesHubsDetailsModal
            isOpen
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
            isOpen
            initialData={vhcData.serviceIndicator}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, serviceIndicator: data }));
              setActiveSection(null);
            }}
          />
        )}
        {activeSection === "externalInspection" && (
          <ExternalDetailsModal
            isOpen
            initialData={vhcData.externalInspection}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, externalInspection: data }));
              setActiveSection(null);
            }}
          />
        )}
        {activeSection === "internalElectrics" && (
          <InternalElectricsDetailsModal
            isOpen
            initialData={vhcData.internalElectrics}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, internalElectrics: data }));
              setActiveSection(null);
            }}
          />
        )}
        {activeSection === "underside" && (
          <UndersideDetailsModal
            isOpen
            initialData={vhcData.underside}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, underside: data }));
              setActiveSection(null);
            }}
          />
        )}
      </div>
    </Layout>
  );
}