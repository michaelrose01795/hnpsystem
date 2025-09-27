// file location: src/pages/job-cards/[jobNumber]/add-checksheet.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";

function ChecksheetRenderer({ sections, onSave }) {
  const [formData, setFormData] = useState({});

  const handleChange = (sectionKey, fieldKey, value) => {
    setFormData((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        [fieldKey]: value,
      },
    }));
  };

  return (
    <div className="space-y-6">
      {sections.map((section, idx) => (
        <div key={idx} className="border rounded-xl p-4 shadow-sm bg-white">
          <h2 className="font-bold text-lg mb-2">{section.title}</h2>
          {section.fields.map((field, fIdx) => (
            <div key={fIdx} className="flex items-center gap-3 mb-2">
              {field.type === "checkbox" && (
                <input
                  type="checkbox"
                  checked={formData?.[section.key]?.[field.key] || false}
                  onChange={(e) =>
                    handleChange(section.key, field.key, e.target.checked)
                  }
                />
              )}
              {field.type === "text" && (
                <input
                  type="text"
                  placeholder={field.label}
                  value={formData?.[section.key]?.[field.key] || ""}
                  onChange={(e) =>
                    handleChange(section.key, field.key, e.target.value)
                  }
                  className="border rounded px-2 py-1 w-full"
                />
              )}
              <label>{field.label}</label>
            </div>
          ))}
        </div>
      ))}
      <button
        onClick={() => onSave(formData)}
        className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700"
      >
        Save Checksheet
      </button>
    </div>
  );
}

export default function AddChecksheet() {
  const router = useRouter();
  const { jobNumber } = router.query;

  const [sections, setSections] = useState([]);
  const [savedData, setSavedData] = useState(null);

  // ✅ Default checksheet layout
  const defaultSections = [
    {
      key: "brakes",
      title: "Brakes",
      fields: [
        { key: "front", label: "Front Brakes OK", type: "checkbox" },
        { key: "rear", label: "Rear Brakes OK", type: "checkbox" },
      ],
    },
    {
      key: "tyres",
      title: "Tyres",
      fields: [
        { key: "tread", label: "Tread Depth", type: "text" },
        { key: "pressure", label: "Tyre Pressure", type: "text" },
      ],
    },
    {
      key: "signature",
      title: "Technician Signature",
      fields: [{ key: "sign", label: "Signature", type: "text" }],
    },
  ];

  const handleAddChecksheet = () => {
    setSections(defaultSections);
  };

  const handleSave = (data) => {
    setSavedData(data);
    console.log("Saved checksheet:", data);
    alert("Checksheet saved (local state only). DB integration needed.");
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Add Checksheet – Job #{jobNumber}</h1>

        {/* Button to skip PDF upload */}
        <button
          onClick={handleAddChecksheet}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700"
        >
          Add Checksheet
        </button>

        {sections.length > 0 && (
          <ChecksheetRenderer sections={sections} onSave={handleSave} />
        )}

        {savedData && (
          <pre className="bg-black text-green-400 p-3 rounded-xl">
            {JSON.stringify(savedData, null, 2)}
          </pre>
        )}
      </div>
    </Layout>
  );
}
