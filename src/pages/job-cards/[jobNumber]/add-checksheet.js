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
        <div key={idx} style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          <h2 style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "8px" }}>{section.title}</h2>
          {section.fields.map((field, fIdx) => (
            <div key={fIdx} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
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
                  style={{ flex: 1, border: "1px solid #ccc", borderRadius: "4px", padding: "6px 8px" }}
                />
              )}
              <label>{field.label}</label>
            </div>
          ))}
        </div>
      ))}
      <button
        onClick={() => onSave(formData)}
        style={{
          padding: "12px 20px",
          backgroundColor: "#FF4040",
          color: "white",
          border: "none",
          borderRadius: "6px",
          fontWeight: "bold",
        }}
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
    setSavedData(data); // Save locally
    console.log("Saved checksheet (local):", data);

    // Forward to dealer car details page
    router.push(`/job-cards/${jobNumber}/dealer-car-details`);
  };

  return (
    <Layout>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <h1 style={{ color: "#FF4040" }}>Add Checksheet – Job #{jobNumber}</h1>

        {/* Button to initialize checksheet */}
        <button
          onClick={handleAddChecksheet}
          style={{
            padding: "12px 20px",
            backgroundColor: "#FF4040",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
          }}
        >
          Add Checksheet
        </button>

        {/* Render checksheet if sections exist */}
        {sections.length > 0 && (
          <ChecksheetRenderer sections={sections} onSave={handleSave} />
        )}

        {/* Debug: show saved data */}
        {savedData && (
          <pre style={{ backgroundColor: "black", color: "#00ff90", padding: "12px", borderRadius: "8px" }}>
            {JSON.stringify(savedData, null, 2)}
          </pre>
        )}
      </div>
    </Layout>
  );
}
