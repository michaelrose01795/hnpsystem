// file location: src/pages/job-cards/[jobNumber]/vhc.js

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal";
import BrakesHubsDetailsModal from "@/components/VHC/BrakesHubsDetailsModal";
import ServiceIndicatorDetailsModal from "@/components/VHC/ServiceIndicatorDetailsModal";
import ExternalDetailsModal from "@/components/VHC/ExternalDetailsModal";
import InternalElectricsDetailsModal from "@/components/VHC/InternalElectricsDetailsModal"; // ✅ New Internal Electrics modal

// ✅ Section title mapping
const SECTION_TITLES = {
  wheelsTyres: "Wheels & Tyres",
  brakesHubs: "Brakes & Hubs",
  serviceIndicator: "Service Indicator",
  externalInspection: "External / Drive-in Inspection",
  internalElectrics: "Internal / Lamps / Electrics",
  underside: "Underside",
  cosmetics: "Cosmetics",
};

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

  // ✅ Handlers for adding/deleting issues (used for generic sections)
  const handleAddIssue = (section) =>
    setVhcData((prev) => ({
      ...prev,
      [section]: [...prev[section], { title: "New Issue", details: "" }],
    }));

  const handleDeleteIssue = (section, idx) =>
    setVhcData((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== idx),
    }));

  return (
    <Layout>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <h1 style={{ color: "#FF4040", marginBottom: "24px" }}>
          Vehicle Health Check - Job {jobNumber || "Loading..."}
        </h1>

        {/* ✅ Mandatory Section */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">Mandatory</h2>
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[48%]">
              <SectionCard
                title="Wheels & Tyres"
                subtitle={
                  vhcData.wheelsTyres
                    ? "Details completed"
                    : "No issues logged yet"
                }
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

          <div className="w-full">
            <SectionCard
              title="Service Indicator and Under Bonnet"
              subtitle={`${vhcData.serviceIndicator.length} issues logged`}
              onClick={() => setActiveSection("serviceIndicator")}
            />
          </div>
        </div>

        <hr className="my-8 border-gray-300" />

        {/* ✅ Optional Section */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">Optional</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            "externalInspection",
            "internalElectrics",
            "underside",
            "cosmetics",
          ].map((section) => (
            <SectionCard
              key={section}
              title={SECTION_TITLES[section]}
              subtitle={`${vhcData[section].length} issues logged`}
              onClick={() => setActiveSection(section)}
            />
          ))}
        </div>

        {/* ✅ Mandatory Modals */}
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

        {/* ✅ Optional Modals */}
        {activeSection === "externalInspection" && (
          <ExternalDetailsModal
            isOpen={true}
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
            isOpen={true}
            initialData={vhcData.internalElectrics}
            onClose={() => setActiveSection(null)}
            onComplete={(data) => {
              setVhcData((prev) => ({ ...prev, internalElectrics: data }));
              setActiveSection(null);
            }}
          />
        )}

        {["underside", "cosmetics"].includes(activeSection) && (
          <VHCModal
            title={SECTION_TITLES[activeSection]}
            issues={vhcData[activeSection]}
            onAddIssue={() => handleAddIssue(activeSection)}
            onDeleteIssue={(idx) => handleDeleteIssue(activeSection, idx)}
            onClose={() => setActiveSection(null)}
          />
        )}
      </div>
    </Layout>
  );
}