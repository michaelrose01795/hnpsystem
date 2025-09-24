// file location: src/pages/vhc/index.js

import React, { useState } from "react";
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal";

// ✅ Reusable card component
const SectionCard = ({ title, subtitle, onClick }) => (
  <div
    className={`border p-4 rounded ${onClick ? "cursor-pointer hover:bg-gray-100" : ""}`}
    onClick={onClick}
  >
    <h2 className="font-semibold">{title}</h2>
    <p>{subtitle}</p>
  </div>
);

export default function VHCPage() {
  const [isWheelsTyresOpen, setIsWheelsTyresOpen] = useState(false); // Modal open state
  const [wheelsTyresData, setWheelsTyresData] = useState(null); // Saved data

  // ✅ Handle saving Wheels & Tyres data
  const handleSave = (data) => {
    setWheelsTyresData(data);
    console.log("Wheels & Tyres saved:", data);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Vehicle Health Check - Job JOB1234</h1>

      <div className="space-y-4">
        {/* Wheels & Tyres - opens detailed modal */}
        <SectionCard
          title="Wheels & Tyres"
          subtitle={wheelsTyresData ? "Details completed" : "No issues logged yet"}
          onClick={() => setIsWheelsTyresOpen(true)}
        />

        {/* Placeholder sections */}
        <SectionCard title="Brakes & Hubs" subtitle="0 issues logged" />
        <SectionCard title="Service Book / Indicator" subtitle="0 issues logged" />
        <SectionCard title="Under Bonnet" subtitle="0 issues logged" />
        <SectionCard title="External / Drive-in Inspection" subtitle="0 issues logged" />
        <SectionCard title="Internal / Lamps / Electrics" subtitle="0 issues logged" />
        <SectionCard title="Underside" subtitle="0 issues logged" />
        <SectionCard title="Cosmetics" subtitle="0 issues logged" />
      </div>

      {/* Detailed Wheels & Tyres Modal */}
      <WheelsTyresDetailsModal
        isOpen={isWheelsTyresOpen}
        onClose={() => setIsWheelsTyresOpen(false)}
        onComplete={handleSave}
      />
    </div>
  );
}
