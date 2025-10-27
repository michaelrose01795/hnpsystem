// file location: src/pages/test-dvla.js

import { useState } from "react";

export default function TestDVLA() {
  const [registration, setRegistration] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log("🧪 Testing API with registration:", registration);
      
      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ registration: registration.toUpperCase() }),
      });

      console.log("📡 Response status:", response.status);
      console.log("📡 Response headers:", Object.fromEntries(response.headers.entries()));

      const text = await response.text();
      console.log("📡 Response text:", text);

      if (!response.ok) {
        setError(`Error ${response.status}: ${text}`);
        return;
      }

      const data = JSON.parse(text);
      console.log("✅ Parsed data:", data);
      setResult(data);

    } catch (err) {
      console.error("❌ Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>DVLA API Test Page</h1>
      
      <div style={{ marginTop: "20px" }}>
        <input
          type="text"
          value={registration}
          onChange={(e) => setRegistration(e.target.value)}
          placeholder="Enter registration (e.g., AB12CDE)"
          style={{
            padding: "10px",
            fontSize: "16px",
            width: "300px",
            marginRight: "10px",
          }}
        />
        <button
          onClick={testAPI}
          disabled={loading || !registration}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: loading ? "#ccc" : "#FF4040",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Testing..." : "Test API"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#ffebee",
            border: "1px solid #f44336",
            borderRadius: "5px",
            color: "#c62828",
          }}
        >
          <h3>Error:</h3>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {error}
          </pre>
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#e8f5e9",
            border: "1px solid #4caf50",
            borderRadius: "5px",
          }}
        >
          <h3>Success! Vehicle Data:</h3>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: "40px", padding: "15px", backgroundColor: "#f5f5f5", borderRadius: "5px" }}>
        <h3>Debug Checklist:</h3>
        <ol>
          <li>Check browser console (F12) for logs</li>
          <li>Check terminal/server console for API logs</li>
          <li>Verify .env.local has DVLA_API_KEY (or leave blank for mock data)</li>
          <li>Make sure Next.js dev server is running</li>
          <li>Try a test registration like "AB12CDE" or any UK registration</li>
        </ol>
      </div>
    </div>
  );
}