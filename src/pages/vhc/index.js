// file location: src/pages/vhc/index.js

import React, { useState } from "react"; // ✅ Import React and state
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal"; // ✅ Use the new detailed modal

export default function VHCPage() {
  // ✅ State to control modal visibility
  const [isWheelsTyresOpen, setIsWheelsTyresOpen] = useState(false);

  // ✅ State to store saved data
  const [wheelsTyresData, setWheelsTyresData] = useState(null);

  // ✅ Save handler
  const handleSave = (data) => {
    setWheelsTyresData(data); // Store data
    console.log("Wheels & Tyres Saved:", data); // Log for testing
  };

  return (
    <div className="p-6">
      {/* ✅ Page Title */}
      <h1 className="text-2xl font-bold mb-6">
        Vehicle Health Check - Job JOB1234
      </h1>

      {/* ✅ Section list */}
      <div className="space-y-4">
        {/* Wheels & Tyres */}
        <div
          className="border p-4 rounded cursor-pointer hover:bg-gray-100"
          onClick={() => setIsWheelsTyresOpen(true)}
        >
          <h2 className="font-semibold">Wheels & Tyres</h2>
          <p>
            {wheelsTyresData
              ? `${wheelsTyresData.concerns?.length || 0} issues logged`
              : "0 issues logged"}
          </p>
        </div>

        {/* Other sections (placeholders for now) */}
        <div className="border p-4 rounded">
          <h2 className="font-semibold">Brakes & Hubs</h2>
          <p>0 issues logged</p>
        </div>
        <div className="border p-4 rounded">
          <h2 className="font-semibold">Service Book / Indicator</h2>
          <p>0 issues logged</p>
        </div>
        <div className="border p-4 rounded">
          <h2 className="font-semibold">Under Bonnet</h2>
          <p>0 issues logged</p>
        </div>
        <div className="border p-4 rounded">
          <h2 className="font-semibold">External / Drive-in Inspection</h2>
          <p>0 issues logged</p>
        </div>
        <div className="border p-4 rounded">
          <h2 className="font-semibold">Internal / Lamps / Electrics</h2>
          <p>0 issues logged</p>
        </div>
        <div className="border p-4 rounded">
          <h2 className="font-semibold">Underside</h2>
          <p>0 issues logged</p>
        </div>
        <div className="border p-4 rounded">
          <h2 className="font-semibold">Cosmetics</h2>
          <p>0 issues logged</p>
        </div>
      </div>

      {/* ✅ Show saved data (testing placeholder) */}
      {wheelsTyresData && (
        <div className="mt-6 p-4 border rounded bg-gray-50">
          <h2 className="font-semibold mb-2">Saved Wheels & Tyres Data:</h2>
          <pre className="text-sm">
            {JSON.stringify(wheelsTyresData, null, 2)}
          </pre>
        </div>
      )}

      {/* ✅ Wheels & Tyres Modal (new detailed version) */}
      <WheelsTyresDetailsModal
        isOpen={isWheelsTyresOpen}
        onClose={() => setIsWheelsTyresOpen(false)}
        onComplete={handleSave}
      />
    </div>
  );
}
