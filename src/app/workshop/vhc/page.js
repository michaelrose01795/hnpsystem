"use client";
import { useState } from "react";
import VHCSection from "@/components/Workshop/VHCSection";

export default function VHCPage() {
  const sections = ["Brakes", "Tyres", "Service Reminders / Oil Level", "Underside", "Under Bonnet", "Cosmetics", "Electronics"];
  const [vhcData, setVhcData] = useState({});

  const handleAddIssue = (section, issue) => {
    setVhcData((prev) => ({
      ...prev,
      [section]: prev[section] ? [...prev[section], issue] : [issue],
    }));
  };

  const handleSave = () => {
    console.log("VHC Data:", vhcData);
    alert("VHC saved! Placeholder for backend integration.");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Vehicle Health Check (VHC)</h1>

      {sections.map((section) => (
        <VHCSection key={section} sectionName={section} onAddIssue={handleAddIssue} />
      ))}

      <button
        onClick={handleSave}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mt-4"
      >
        Save VHC
      </button>
    </div>
  );
}