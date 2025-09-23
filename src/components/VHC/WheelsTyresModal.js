// file location: src/components/VHC/WheelsTyresModal.js

import React, { useState } from "react";

export default function WheelsTyresModal({ isOpen, onClose, onComplete }) {
  const [selectedWheel, setSelectedWheel] = useState("NSF");
  const [tyreData, setTyreData] = useState({
    manufacturer: "",
    runFlat: false,
    size: "",
    load: "",
    speed: "",
    tread: { outer: "", middle: "", inner: "" },
    concerns: [],
  });

  if (!isOpen) return null;

  const handleCopyToAll = () => {
    alert("✅ Copied tyre details to all wheels (placeholder logic).");
  };

  const handleComplete = () => {
    onComplete(tyreData); // Pass data back to VHC page
    onClose(); // Close modal
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-5xl p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>

        {/* Header */}
        <h2 className="text-2xl font-bold mb-4 text-red-600">
          Wheels & Tyres – {selectedWheel}
        </h2>

        <div className="flex gap-6">
          {/* Left side – wheel diagram */}
          <div className="w-1/3 flex flex-col items-center border-r pr-4">
            <p className="font-semibold mb-2">Select Wheel</p>
            <div className="grid grid-cols-2 gap-4">
              {["NSF", "OSF", "NSR", "OSR", "Spare"].map((wheel) => (
                <button
                  key={wheel}
                  onClick={() => setSelectedWheel(wheel)}
                  className={`p-3 border rounded ${
                    selectedWheel === wheel
                      ? "bg-red-600 text-white"
                      : "bg-gray-100"
                  }`}
                >
                  {wheel}
                </button>
              ))}
            </div>
          </div>

          {/* Right side – tyre details */}
          <div className="w-2/3">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Manufacturer"
                value={tyreData.manufacturer}
                onChange={(e) =>
                  setTyreData({ ...tyreData, manufacturer: e.target.value })
                }
                className="border p-2 rounded"
              />
              <div className="flex items-center">
                <span className="mr-2">Run Flat:</span>
                <button
                  onClick={() =>
                    setTyreData({ ...tyreData, runFlat: !tyreData.runFlat })
                  }
                  className={`px-3 py-1 rounded ${
                    tyreData.runFlat ? "bg-red-600 text-white" : "bg-gray-200"
                  }`}
                >
                  {tyreData.runFlat ? "Yes" : "No"}
                </button>
              </div>
              <input
                type="text"
                placeholder="Size"
                value={tyreData.size}
                onChange={(e) =>
                  setTyreData({ ...tyreData, size: e.target.value })
                }
                className="border p-2 rounded"
              />
              <input
                type="text"
                placeholder="Load"
                value={tyreData.load}
                onChange={(e) =>
                  setTyreData({ ...tyreData, load: e.target.value })
                }
                className="border p-2 rounded"
              />
              <input
                type="text"
                placeholder="Speed"
                value={tyreData.speed}
                onChange={(e) =>
                  setTyreData({ ...tyreData, speed: e.target.value })
                }
                className="border p-2 rounded"
              />
            </div>

            {/* Tread depths */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              {["outer", "middle", "inner"].map((pos) => (
                <input
                  key={pos}
                  type="number"
                  placeholder={`${pos} tread (mm)`}
                  value={tyreData.tread[pos]}
                  onChange={(e) =>
                    setTyreData({
                      ...tyreData,
                      tread: { ...tyreData.tread, [pos]: e.target.value },
                    })
                  }
                  className="border p-2 rounded"
                />
              ))}
            </div>

            {/* Add concern */}
            <button
              onClick={() =>
                setTyreData({
                  ...tyreData,
                  concerns: [...tyreData.concerns, "New concern"],
                })
              }
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 mb-4"
            >
              + Add Concern
            </button>

            {/* Copy to all */}
            <button
              onClick={handleCopyToAll}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 ml-2"
            >
              Copy to All
            </button>

            {/* Complete */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleComplete}
                className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Complete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
