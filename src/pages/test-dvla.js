import { useState } from "react";

export default function TestDVLA() {
  const [registration, setRegistration] = useState("");
  const [vehicleData, setVehicleData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setVehicleData(null);

    try {
      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ registration: registration.toUpperCase() }),
      });

      if (!response.ok) {
        const text = await response.text();
        setError(`Error ${response.status}: ${text}`);
        return;
      }

      const data = await response.json();
      setVehicleData(data);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Vehicle Data Lookup</h1>
      
      <div style={{ marginTop: "20px" }}>
        <input
          type="text"
          value={registration}
          onChange={(e) => setRegistration(e.target.value)}
          placeholder="Enter UK registration"
          style={{
            padding: "10px",
            fontSize: "16px",
            width: "300px",
            marginRight: "10px",
          }}
        />
        <button
          onClick={fetchData}
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
          {loading ? "Fetching..." : "Fetch Data"}
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
          <strong>Error:</strong> {error}
        </div>
      )}

      {vehicleData && (
        <div style={{ marginTop: "30px" }}>
          <h2>Vehicle Information</h2>
          
          <div style={{ marginTop: "20px" }}>
            <div style={fieldStyle}>
              <strong>Registration:</strong> {vehicleData.registrationNumber || "Not supplied"}
            </div>
            
            <div style={fieldStyle}>
              <strong>Make:</strong> {vehicleData.make || "Not supplied"}
            </div>
            
            <div style={fieldStyle}>
              <strong>Model:</strong> {vehicleData.model || "Not supplied"}
            </div>
            
            <div style={fieldStyle}>
              <strong>Colour:</strong> {vehicleData.colour || "Not supplied"}
            </div>
            
            <div style={fieldStyle}>
              <strong>VIN:</strong> {vehicleData.vin || "Not supplied"}
            </div>
            
            <div style={fieldStyle}>
              <strong>Engine Code:</strong> {vehicleData.engineCode || "Not supplied"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const fieldStyle = {
  padding: "12px",
  marginBottom: "10px",
  backgroundColor: "#f5f5f5",
  borderRadius: "5px",
  fontSize: "16px",
};