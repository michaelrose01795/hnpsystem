// file location: src/pages/job-cards/[jobNumber]/vhc.js
import React, { useState } from "react"; // import React
import { useRouter } from "next/router"; // import router for navigation
import Layout from "../../../components/Layout"; // import layout

// import modals for each section
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal";
import BrakesHubsDetailsModal from "@/components/VHC/BrakesHubsDetailsModal";
import ServiceIndicatorDetailsModal from "@/components/VHC/ServiceIndicatorDetailsModal";
import ExternalDetailsModal from "@/components/VHC/ExternalDetailsModal";
import InternalElectricsDetailsModal from "@/components/VHC/InternalElectricsDetailsModal";
import UndersideDetailsModal from "@/components/VHC/UndersideDetailsModal";

// section titles for display
const SECTION_TITLES = {
  wheelsTyres: "Wheels & Tyres",
  brakesHubs: "Brakes & Hubs",
  serviceIndicator: "Service Indicator & Under Bonnet",
  externalInspection: "External / Drive-in Inspection",
  internalElectrics: "Internal / Lamps / Electrics",
  underside: "Underside",
};

export default function VHCPAGE() {
  const router = useRouter(); // use router for navigation
  const { jobNumber } = router.query; // get job number from URL

  // store VHC data
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

  // track active section modal
  const [activeSection, setActiveSection] = useState(null);

  // reusable card for sections
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

  // check if mandatory sections are complete
  const mandatoryComplete =
    vhcData.wheelsTyres &&
    vhcData.brakesHubs.length > 0 &&
    vhcData.serviceIndicator.length > 0;

  // handle saving data (simulate API save for now)
  const saveVhcData = async () => {
    try {
      await fetch(`/api/job-cards/${jobNumber}/vhc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vhcData),
      });
    } catch (err) {
      console.error("Error saving VHC data:", err);
    }
  };

  // handle back button
  const handleBack = async () => {
    await saveVhcData(); // save data before navigating
    router.push(`/job-cards/${jobNumber}`);
  };

  // handle complete button
  const handleComplete = async () => {
    if (!mandatoryComplete) return;
    await saveVhcData(); // save data first
    try {
      await fetch(`/api/job-cards/${jobNumber}/complete-vhc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vhcCompleted: true }),
      });
      router.push(`/job-cards/${jobNumber}`); // return to job card page
    } catch (err) {
      console.error("Error completing VHC:", err);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
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

        {/* Mandatory Sections */}
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

        {/* Optional Sections */}
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

        {/* Action Buttons under Optional */}
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

        {/* Modals */}
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
