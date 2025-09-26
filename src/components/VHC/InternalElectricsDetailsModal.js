// file location: src/components/VHC/InternalElectricsDetailsModal.js
import React, { useState, useEffect } from "react";

export default function InternalElectricsDetailsModal({
  isOpen, // whether modal is open
  initialData, // saved issues
  onClose, // close handler
  onComplete, // save handler
}) {
  const [data, setData] = useState([]);

  // ✅ Load initial data when opening
  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  // ✅ Add a new issue
  const handleAddIssue = (label) => {
    setData((prev) => [
      ...prev,
      { title: label, details: "", status: "amber" }, // default amber
    ]);
  };

  // ✅ Update issue details
  const handleUpdateIssue = (idx, key, value) => {
    setData((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, [key]: value } : item
      )
    );
  };

  // ✅ Remove an issue
  const handleRemoveIssue = (idx) => {
    setData((prev) => prev.filter((_, i) => i !== idx));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[90%] max-w-2xl p-6">
        <h2 className="text-xl font-bold text-red-600 mb-4">
          Internal / Lamps / Electrics
        </h2>

        {/* ✅ Buttons for quick add */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            "Lights Front",
            "Lights Rear",
            "Lights Interior",
            "Horn/Washers/Wipers",
            "Air Con/Heating/venterlation",
            "Warning Lamps",
            "Seatbelt",
            "Miscellaneous",
          ].map((label) => (
            <button
              key={label}
              onClick={() => handleAddIssue(label)}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              {label}
            </button>
          ))}
        </div>

        {/* ✅ List of issues */}
        <div className="space-y-4 max-h-64 overflow-y-auto mb-6">
          {data.map((item, idx) => (
            <div
              key={idx}
              className="border rounded p-3 bg-gray-50 shadow-sm"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-800">
                  {item.title}
                </span>
                <button
                  onClick={() => handleRemoveIssue(idx)}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>

              {/* Concern text */}
              <textarea
                className="w-full border rounded p-2 text-sm"
                placeholder="Add details..."
                value={item.details}
                onChange={(e) =>
                  handleUpdateIssue(idx, "details", e.target.value)
                }
              />

              {/* Status buttons */}
              <div className="flex gap-2 mt-2">
                {["red", "amber", "green"].map((status) => (
                  <button
                    key={status}
                    onClick={() =>
                      handleUpdateIssue(idx, "status", status)
                    }
                    className={`flex-1 py-1 rounded text-white ${
                      item.status === status
                        ? status === "red"
                          ? "bg-red-600"
                          : status === "amber"
                          ? "bg-yellow-500"
                          : "bg-green-600"
                        : "bg-gray-300"
                    }`}
                  >
                    {status.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ✅ Action buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Close
          </button>
          <button
            onClick={() => onComplete(data)}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}