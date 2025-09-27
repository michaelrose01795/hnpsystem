// file location: src/pages/job-cards/[jobNumber]/add-checksheet.js
"use client";

import React, { useState, useRef } from "react"; // React state + refs
import { useRouter } from "next/router"; // Next.js router for jobNumber
import Layout from "../../../components/Layout"; // Shared layout wrapper
import { pdfjs } from "react-pdf"; // Only using parser utilities, not rendering pages

// ✅ Point pdf.js to the correct worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// ✅ Renderer for parsed checksheet
function ChecksheetRenderer({ sections, onSave }) {
  const [formData, setFormData] = useState({}); // Store field values

  // Handle checkbox/text updates
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
        <div
          key={idx}
          className="border rounded-xl p-4 shadow-sm bg-white"
        >
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
  const router = useRouter(); // Get job number from route
  const { jobNumber } = router.query;

  const fileInputRef = useRef(null); // File upload ref
  const [sections, setSections] = useState([]); // Store parsed layout structure
  const [savedData, setSavedData] = useState(null); // Store user’s filled data
  const [loading, setLoading] = useState(false);

  // ✅ Upload PDF to backend API for parsing with safe JSON handling
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // ✅ Ensure jobNumber is ready
    if (!jobNumber) {
      alert("Job number not available yet. Please wait a moment.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      console.log("Uploading PDF for jobNumber:", jobNumber);

      const res = await fetch(`/api/jobcards/${jobNumber}/parse-checksheet`, {
        method: "POST",
        body: formData,
      });

      let result;
      try {
        result = await res.json(); // Try parse JSON
      } catch (jsonErr) {
        console.error("Failed to parse JSON response:", jsonErr);
        const text = await res.text();
        console.error("Server returned:", text);
        alert("Server returned invalid JSON. See console for details.");
        return;
      }

      if (res.ok) {
        setSections(result.sections || []);
        console.log("Extracted text:", result.extractedText);
      } else {
        alert(result.error || "Failed to parse PDF");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error uploading file");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Save filled checksheet (local state, later hook to DB)
  const handleSave = (data) => {
    setSavedData(data);
    console.log("Saved checksheet:", data);
    alert("Checksheet saved (local state only). DB integration needed.");
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">
          Add Checksheet – Job #{jobNumber}
        </h1>

        {/* File upload */}
        <div className="border p-4 rounded-xl bg-gray-50">
          <h2 className="font-semibold mb-2">Upload OEM PDF</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
          />
        </div>

        {loading && <p className="text-gray-600">Parsing PDF...</p>}

        {/* Render structured checksheet */}
        {sections.length > 0 && (
          <ChecksheetRenderer sections={sections} onSave={handleSave} />
        )}

        {/* Debug preview */}
        {savedData && (
          <pre className="bg-black text-green-400 p-3 rounded-xl">
            {JSON.stringify(savedData, null, 2)}
          </pre>
        )}
      </div>
    </Layout>
  );
}
