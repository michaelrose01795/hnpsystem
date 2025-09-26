// file location: src/pages/job-cards/[jobNumber]/check-box.js
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import SignatureCanvas from "react-signature-canvas";

export default function CheckBoxPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [formFields, setFormFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const sigCanvas = useRef(null);

  useEffect(() => {
    const loadPDFFields = async () => {
      if (!jobNumber) return;

      try {
        // fetch uploaded PDF from API
        const res = await fetch(`/api/job-cards/${jobNumber}/get-checksheet`);
        if (!res.ok) throw new Error("Failed to fetch check sheet");

        // here we would parse the PDF if needed, but for simplicity we'll mock
        const fields = [
          "Oil Level",
          "Brakes Condition",
          "Tyres Condition",
          "Lights Working",
          "Fluid Levels",
          "Suspension Check"
        ];

        const parsedFields = fields.map((name) => ({ name, checked: false }));
        setFormFields(parsedFields);
        setLoading(false);
      } catch (err) {
        console.error(err);
        alert("Failed to load check sheet");
        setLoading(false);
      }
    };

    loadPDFFields();
  }, [jobNumber]);

  const toggleCheckbox = (index) => {
    setFormFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, checked: !f.checked } : f))
    );
  };

  const handleClearSignature = () => {
    sigCanvas.current.clear();
  };

  const handleSave = async () => {
    const signatureData = sigCanvas.current.getTrimmedCanvas().toDataURL("image/png");

    const res = await fetch(`/api/job-cards/${jobNumber}/save-checksheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formFields, signatureData }),
    });

    if (res.ok) {
      alert("Check sheet saved successfully");
      router.push(`/job-cards/${jobNumber}`);
    } else {
      alert("Failed to save check sheet");
    }
  };

  if (loading) return <Layout><p>Loading check sheet...</p></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "16px" }}>
        <h2>Service Check Sheet for Job {jobNumber}</h2>

        {formFields.map((field, index) => (
          <div key={index} style={{ marginBottom: "8px" }}>
            <label>
              <input
                type="checkbox"
                checked={field.checked}
                onChange={() => toggleCheckbox(index)}
              />
              {field.name}
            </label>
          </div>
        ))}

        <h3>Technician Signature</h3>
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          canvasProps={{ width: 600, height: 150, className: "sigCanvas", style: { border: "1px solid #000" } }}
        />
        <div style={{ marginTop: "8px" }}>
          <button
            onClick={handleClearSignature}
            style={{ marginRight: "12px", padding: "8px 16px", backgroundColor: "#ccc", border: "none", borderRadius: "6px" }}
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px" }}
          >
            Save Check Sheet
          </button>
        </div>
      </div>
    </Layout>
  );
}
