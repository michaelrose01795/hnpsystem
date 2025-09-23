// file location: src/components/VHC/WheelsTyresDetailsModal.js

import React, { useState } from "react";

export default function WheelsTyresDetailsModal({ isOpen, onClose, onComplete }) {
  const [selectedWheel, setSelectedWheel] = useState("NSF"); // ✅ Default wheel
  const [tyreData, setTyreData] = useState({
    NSF: { manufacturer: "", runFlat: false, size: "", load: "", speed: "", tread: { outer: "", middle: "", inner: "" }, concerns: [] },
    OSF: { manufacturer: "", runFlat: false, size: "", load: "", speed: "", tread: { outer: "", middle: "", inner: "" }, concerns: [] },
    NSR: { manufacturer: "", runFlat: false, size: "", load: "", speed: "", tread: { outer: "", middle: "", inner: "" }, concerns: [] },
    OSR: { manufacturer: "", runFlat: false, size: "", load: "", speed: "", tread: { outer: "", middle: "", inner: "" }, concerns: [] },
    Spare: { type: "", year: "", condition: "", concerns: [] },
  });

  if (!isOpen) return null;

  const handleFieldChange = (wheel, field, value) => {
    setTyreData((prev) => ({
      ...prev,
      [wheel]: { ...prev[wheel], [field]: value },
    }));
  };

  const copyToAll = () => {
    const base = tyreData[selectedWheel];
    setTyreData((prev) => ({
      ...prev,
      NSF: { ...base, tread: { ...prev.NSF.tread }, concerns: [...prev.NSF.concerns] },
      OSF: { ...base, tread: { ...prev.OSF.tread }, concerns: [...prev.OSF.concerns] },
      NSR: { ...base, tread: { ...prev.NSR.tread }, concerns: [...prev.NSR.concerns] },
      OSR: { ...base, tread: { ...prev.OSR.tread }, concerns: [...prev.OSR.concerns] },
    }));
  };

  const handleComplete = () => {
    // ✅ Save tyre data here (later connect to DB)
    console.log("Saved tyre data:", tyreData);
    onComplete(tyreData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-5xl p-6 flex gap-6">
        {/* Left: Car diagram */}
        <div className="w-2/5 flex flex-col items-center border-r pr-4">
          <h3 className="font-bold mb-4">Select Wheel</h3>
          <div className="grid grid-cols-2 gap-4">
            {["NSF", "OSF", "NSR", "OSR"].map((wheel) => (
              <button
                key={wheel}
                onClick={() => setSelectedWheel(wheel)}
                className={`p-3 border rounded ${selectedWheel === wheel ? "bg-red-600 text-white" : "bg-gray-100"}`}
              >
                {wheel}
              </button>
            ))}
            {/* Spare button */}
            <button
              onClick={() => setSelectedWheel("Spare")}
              className={`col-span-2 p-3 border rounded ${selectedWheel === "Spare" ? "bg-red-600 text-white" : "bg-gray-100"}`}
            >
              Spare
            </button>
          </div>
        </div>

        {/* Right: Wheel details */}
        <div className="w-3/5">
          <h3 className="font-bold mb-4">{selectedWheel} Details</h3>

          {selectedWheel !== "Spare" ? (
            <>
              {/* Manufacturer etc */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Manufacturer"
                  value={tyreData[selectedWheel].manufacturer}
                  onChange={(e) => handleFieldChange(selectedWheel, "manufacturer", e.target.value)}
                  className="border rounded px-2 py-1"
                />
                <button
                  onClick={() => handleFieldChange(selectedWheel, "runFlat", !tyreData[selectedWheel].runFlat)}
                  className={`px-3 py-1 rounded ${tyreData[selectedWheel].runFlat ? "bg-green-500 text-white" : "bg-gray-200"}`}
                >
                  Run Flat: {tyreData[selectedWheel].runFlat ? "Yes" : "No"}
                </button>
                <input
                  type="text"
                  placeholder="Size"
                  value={tyreData[selectedWheel].size}
                  onChange={(e) => handleFieldChange(selectedWheel, "size", e.target.value)}
                  className="border rounded px-2 py-1"
                />
                <input
                  type="text"
                  placeholder="Load"
                  value={tyreData[selectedWheel].load}
                  onChange={(e) => handleFieldChange(selectedWheel, "load", e.target.value)}
                  className="border rounded px-2 py-1"
                />
                <input
                  type="text"
                  placeholder="Speed"
                  value={tyreData[selectedWheel].speed}
                  onChange={(e) => handleFieldChange(selectedWheel, "speed", e.target.value)}
                  className="border rounded px-2 py-1"
                />
              </div>

              {/* Tread depths */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {["outer", "middle", "inner"].map((pos) => (
                  <input
                    key={pos}
                    type="number"
                    step="0.1"
                    placeholder={`${pos} tread`}
                    value={tyreData[selectedWheel].tread[pos]}
                    onChange={(e) =>
                      setTyreData((prev) => ({
                        ...prev,
                        [selectedWheel]: {
                          ...prev[selectedWheel],
                          tread: { ...prev[selectedWheel].tread, [pos]: e.target.value },
                        },
                      }))
                    }
                    className="border rounded px-2 py-1"
                  />
                ))}
              </div>

              {/* Concerns */}
              <button
                onClick={() =>
                  setTyreData((prev) => ({
                    ...prev,
                    [selectedWheel]: {
                      ...prev[selectedWheel],
                      concerns: [...prev[selectedWheel].concerns, `Concern ${prev[selectedWheel].concerns.length + 1}`],
                    },
                  }))
                }
                className="mb-4 px-3 py-1 bg-yellow-500 text-white rounded"
              >
                + Add Concern
              </button>
            </>
          ) : (
            <>
              {/* Spare options */}
              <select
                value={tyreData.Spare.type}
                onChange={(e) => handleFieldChange("Spare", "type", e.target.value)}
                className="border rounded px-2 py-1 mb-4 w-full"
              >
                <option value="">Select Spare Type</option>
                <option value="tyre">Spare Tyre</option>
                <option value="repair-kit">Repair Kit</option>
                <option value="space-saver">Space Saver</option>
                <option value="none">Not Checked</option>
              </select>

              {tyreData.Spare.type === "repair-kit" && (
                <select
                  value={tyreData.Spare.year}
                  onChange={(e) => handleFieldChange("Spare", "year", e.target.value)}
                  className="border rounded px-2 py-1 mb-4 w-full"
                >
                  <option value="">Select Year</option>
                  {Array.from({ length: 20 }, (_, i) => 2025 - i).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              )}

              {tyreData.Spare.type === "space-saver" && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => handleFieldChange("Spare", "condition", "Good")}
                    className={`px-3 py-1 rounded ${tyreData.Spare.condition === "Good" ? "bg-green-500 text-white" : "bg-gray-200"}`}
                  >
                    Good
                  </button>
                  <button
                    onClick={() => handleFieldChange("Spare", "condition", "Bad")}
                    className={`px-3 py-1 rounded ${tyreData.Spare.condition === "Bad" ? "bg-red-500 text-white" : "bg-gray-200"}`}
                  >
                    Bad
                  </button>
                </div>
              )}
            </>
          )}

          {/* Copy to all */}
          {selectedWheel !== "Spare" && (
            <button
              onClick={copyToAll}
              className="px-4 py-2 bg-blue-500 text-white rounded mb-4"
            >
              Copy to All
            </button>
          )}

          {/* Complete button */}
          <button
            onClick={handleComplete}
            className="px-4 py-2 bg-red-600 text-white rounded w-full"
          >
            Complete Wheels & Tyres
          </button>
        </div>
      </div>
    </div>
  );
}
