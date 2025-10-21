// file location: src/pages/job-cards/create/index.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useJobs } from "../../../context/JobsContext";
import { supabase } from "../../../lib/supabaseClient";
import NewCustomerPopup from "../../../components/popups/NewCustomerPopup";
import ExistingCustomerPopup from "../../../components/popups/ExistingCustomerPopup";

let localJobCounter = 30000; // local counter for job IDs

const detectJobTypes = (requests) => {
  const detected = new Set();
  requests.forEach((description) => {
    const lower = description.toLowerCase();
    if (lower.includes("mot")) detected.add("MOT");
    if (lower.includes("service") || lower.includes("oil") || lower.includes("inspection"))
      detected.add("Service");
    if (lower.includes("diag") || lower.includes("investigation") || lower.includes("check") || lower.includes("warning") || lower.includes("fault"))
      detected.add("Diagnostic");
  });
  if (detected.size === 0) detected.add("Other");
  return Array.from(detected);
};

export default function CreateJobCardPage() {
  const router = useRouter();
  const { addJob } = useJobs();

  const [vehicle, setVehicle] = useState({
    reg: "",
    colour: "",
    makeModel: "",
    chassis: "",
    engine: "",
    mileage: "",
  });

  const [customer, setCustomer] = useState(null);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const [vehicleDataSource, setVehicleDataSource] = useState("");
  const [error, setError] = useState("");

  const [requests, setRequests] = useState([{ text: "", time: "", paymentType: "Customer" }]);
  const [cosmeticNotes, setCosmeticNotes] = useState("");
  const [vhcRequired, setVhcRequired] = useState(false);
  const [waitingStatus, setWaitingStatus] = useState("Neither");
  const [jobSource, setJobSource] = useState("Retail");
  const [jobCategories, setJobCategories] = useState(["Other"]);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showExistingCustomer, setShowExistingCustomer] = useState(false);
  const [showVhcPopup, setShowVhcPopup] = useState(false);

  const [maintenance, setMaintenance] = useState({
    nextServiceDate: "",
    nextMotDate: "",
    leaseCO: "",
    privileges: "",
    nextVHC: "",
    warrantyExpiry: "",
    servicePlanSupplier: "",
    servicePlanType: "",
    servicePlanExpiry: "",
  });

  const modernInputStyle = {
    padding: "10px 14px",
    border: "2px solid #e0e0e0",
    borderRadius: "8px",
    fontSize: "0.95rem",
    fontFamily: "inherit",
    transition: "all 0.3s ease",
    outline: "none",
    backgroundColor: "#fafafa",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
  };

  const inputFocusStyle = {
    border: "2px solid #FF4040",
    backgroundColor: "#ffffff",
    boxShadow: "0 4px 8px rgba(255,64,64,0.1)",
  };

  const getBackgroundColor = (status, source) => {
    let baseColor = "white";
    switch (status) {
      case "Waiting":
        baseColor = "#ffcccc";
        break;
      case "Loan Car":
        baseColor = "#cce0ff";
        break;
      case "Collection":
        baseColor = "#d6f5d6";
        break;
      default:
        baseColor = "white";
    }
    if (source === "Warranty") {
      if (baseColor === "white") return "#ffeacc";
      return `linear-gradient(to bottom, ${baseColor} 50%, #ffeacc 50%)`;
    }
    return baseColor;
  };

  const handleRequestChange = (index, value) => {
    const updated = [...requests];
    updated[index].text = value;
    setRequests(updated);
    setJobCategories(detectJobTypes(updated.map((r) => r.text)));
  };

  const handleTimeChange = (index, value) => {
    const updated = [...requests];
    let num = parseFloat(value);
    if (isNaN(num) || num < 0) num = 0;
    updated[index].time = num;
    setRequests(updated);
  };

  const handlePaymentTypeChange = (index, value) => {
    const updated = [...requests];
    updated[index].paymentType = value;
    if (value === "Warranty") setJobSource("Warranty");
    setRequests(updated);
  };

  const handleAddRequest = () =>
    setRequests([...requests, { text: "", time: "", paymentType: "Customer" }]);
  const handleRemoveRequest = (index) => {
    const updated = requests.filter((_, i) => i !== index);
    setRequests(updated);
    setJobCategories(detectJobTypes(updated.map((r) => r.text)));
  };

  // -------------------- DVLA API Fetch --------------------
  const handleFetchVehicleData = async () => {
    if (!vehicle.reg.trim()) {
      setError("Please enter a registration number");
      return;
    }

    setIsLoadingVehicle(true);
    setVehicleDataSource("");
    setError("");

    try {
      const regUpper = vehicle.reg.trim().toUpperCase();

      const response = await fetch(`${window.location.origin}/api/vehicles/dvla`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: regUpper }),
      });

      if (!response.ok) throw new Error("Failed to fetch vehicle details");

      const data = await response.json();

      if (!data || Object.keys(data).length === 0) {
        setError("No vehicle data found for that registration.");
        setVehicle({
          reg: regUpper,
          makeModel: "No data provided",
          colour: "No data provided",
          chassis: "No data provided",
          engine: "No data provided",
          mileage: "",
        });
        setVehicleDataSource("DVLA API (No data)");
        return;
      }

      setVehicle({
        reg: regUpper,
        makeModel: `${data.make || "No data"} ${data.model || ""}`.trim(),
        colour: data.colour || "No data provided",
        chassis: data.vin || "No data provided",
        engine: data.engineNumber || "No data provided",
        mileage:
          data.motTests?.[0]?.odometerValue ||
          vehicle.mileage ||
          "No data provided",
      });

      setVehicleDataSource("DVLA API");
    } catch (err) {
      console.error("Error fetching vehicle data:", err);
      setError(
        "Error fetching vehicle details. Please check registration or API key."
      );
      setVehicle({
        reg: vehicle.reg.trim().toUpperCase(),
        makeModel: "No data provided",
        colour: "No data provided",
        chassis: "No data provided",
        engine: "No data provided",
        mileage: vehicle.mileage || "",
      });
      setVehicleDataSource("Error");
    } finally {
      setIsLoadingVehicle(false);
    }
  };

  // -------------------- ✅ ADD THIS FUNCTION --------------------
  const handleSaveJob = async () => {
    try {
      const newJobId = localJobCounter++;
      const jobData = {
        id: newJobId,
        customer: customer ? customer.name : "Unknown Customer",
        vehicleReg: vehicle.reg,
        vehicleMakeModel: vehicle.makeModel,
        waitingStatus,
        jobSource,
        jobCategories,
        requests,
        created_at: new Date().toISOString(),
      };

      await supabase.from("jobs").insert([jobData]); // save to Supabase
      addJob(jobData); // update local context

      alert(`Job #${newJobId} saved successfully.`);
      router.push("/job-cards");
    } catch (err) {
      console.error("Error saving job:", err);
      alert("Error saving job. Check console for details.");
    }
  };
  // ------------------------------------------------------------

 const sectionHeight = "320px";
  const bottomRowHeight = "100px";

  return (
    <Layout>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "16px",
          transition: "background 0.3s ease",
          background: getBackgroundColor(waitingStatus, jobSource),
          borderRadius: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#555" }}>
              Retail / Warranty
            </h2>
            <h1 style={{ color: "#FF4040", margin: 0 }}>Create New Job Card</h1>
          </div>
          <button
            onClick={handleSaveJob}
            style={{
              padding: "12px 24px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "1rem",
              cursor: "pointer",
              boxShadow: "0 4px 6px rgba(40,167,69,0.2)",
              transition: "all 0.3s ease",
            }}
          >
            Save Job
          </button>
        </div>

        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          <div style={{ flex: 1, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <h3 style={{ marginTop: 0 }}>Job Information</h3>
            <div style={{ marginBottom: "12px" }}>
              <strong style={{ width: "150px", display: "inline-block" }}>Customer Status:</strong>
              {["Waiting", "Loan Car", "Collection", "Neither"].map((status) => (
                <label key={status} style={{ marginRight: "12px" }}>
                  <input 
                    type="radio" 
                    name="waiting" 
                    value={status} 
                    checked={waitingStatus===status} 
                    onChange={()=>setWaitingStatus(status)}
                  /> {status}
                </label>
              ))}
            </div>
            <div style={{ marginBottom: "12px" }}>
              <strong style={{ width: "150px", display: "inline-block" }}>Job Source:</strong>
              {["Retail","Warranty"].map((src)=>( 
                <label key={src} style={{ marginRight: "12px" }}>
                  <input 
                    type="radio" 
                    name="source" 
                    value={src} 
                    checked={jobSource===src} 
                    onChange={()=>setJobSource(src)}
                  /> {src}
                </label>
              ))}
            </div>
            <div>
              <strong>Detected Job Types:</strong>{" "}
              {jobCategories.map((type,index)=>(
                <span 
                  key={index} 
                  style={{ 
                    display:"inline-block", 
                    marginRight:"8px", 
                    backgroundColor:"#FF4040", 
                    color:"white", 
                    padding:"6px 12px", 
                    borderRadius:"20px", 
                    fontWeight:"600", 
                    fontSize:"0.85rem" 
                  }}
                >
                  {type}
                </span>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <h3 style={{ marginTop: 0 }}>Maintenance</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "500", color: "#555", display: "block", marginBottom: "4px" }}>
                  Next Service Date
                </label>
                <input 
                  type="date" 
                  value={maintenance.nextServiceDate} 
                  onChange={e=>setMaintenance({...maintenance,nextServiceDate:e.target.value})}
                  style={{
                    ...modernInputStyle,
                    width: "100%",
                  }}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.border = "2px solid #e0e0e0";
                    e.target.style.backgroundColor = "#fafafa";
                    e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "500", color: "#555", display: "block", marginBottom: "4px" }}>
                  Next MOT Date
                </label>
                <input 
                  type="date" 
                  value={maintenance.nextMotDate} 
                  onChange={e=>setMaintenance({...maintenance,nextMotDate:e.target.value})}
                  style={{
                    ...modernInputStyle,
                    width: "100%",
                  }}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.border = "2px solid #e0e0e0";
                    e.target.style.backgroundColor = "#fafafa";
                    e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "500", color: "#555", display: "block", marginBottom: "4px" }}>
                  Lease Company
                </label>
                <input 
                  type="text" 
                  value={maintenance.leaseCO} 
                  onChange={e=>setMaintenance({...maintenance,leaseCO:e.target.value})}
                  placeholder="Enter lease company"
                  style={{
                    ...modernInputStyle,
                    width: "100%",
                  }}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.border = "2px solid #e0e0e0";
                    e.target.style.backgroundColor = "#fafafa";
                    e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "500", color: "#555", display: "block", marginBottom: "4px" }}>
                  Privileges
                </label>
                <input 
                  type="text" 
                  value={maintenance.privileges} 
                  onChange={e=>setMaintenance({...maintenance,privileges:e.target.value})}
                  placeholder="Enter privileges"
                  style={{
                    ...modernInputStyle,
                    width: "100%",
                  }}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.border = "2px solid #e0e0e0";
                    e.target.style.backgroundColor = "#fafafa";
                    e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ flex: 1, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <h3 style={{ marginTop: 0 }}>GDPR Settings</h3>
            <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:"16px", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left", padding: "4px 0" }}>Contact Type</th>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left", padding: "4px 0" }}>From Us</th>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left", padding: "4px 0" }}>From Franchise</th>
                </tr>
              </thead>
              <tbody>
                {["Email","SMS","Letter","Telephone","Social media"].map(method=>(
                  <tr key={method}>
                    <td style={{padding:"4px 0"}}>{method}</td>
                    <td><input type="checkbox"/></td>
                    <td><input type="checkbox"/></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left", padding: "4px 0" }}>Marketing / Service</th>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left", padding: "4px 0" }}>Allowed</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{padding:"4px 0"}}>Marketing Messages</td>
                  <td><input type="checkbox"/></td>
                </tr>
                <tr>
                  <td style={{padding:"4px 0"}}>Service Dept Follow Up</td>
                  <td><input type="checkbox"/></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display:"flex", gap:"16px", marginBottom:"24px" }}>
          <div style={{ flex:1, backgroundColor:"white", padding:"16px", borderRadius:"8px", boxShadow:"0 2px 4px rgba(0,0,0,0.1)", height:sectionHeight, overflow:"auto" }}>
            <h3 style={{marginTop:0}}>Vehicle Details</h3>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.9rem", fontWeight: "500", color: "#555", display: "block", marginBottom: "6px" }}>
                Registration Number
              </label>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <input 
                  type="text" 
                  value={vehicle.reg} 
                  onChange={e=>setVehicle({...vehicle,reg:e.target.value})}
                  placeholder="e.g. AB12 CDE" 
                  style={{
                    ...modernInputStyle,
                    flex: 1,
                    textTransform: "uppercase",
                  }}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => {
                    e.target.style.border = "2px solid #e0e0e0";
                    e.target.style.backgroundColor = "#fafafa";
                    e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                  }}
                />
                <button 
                  onClick={handleFetchVehicleData}
                  disabled={isLoadingVehicle}
                  style={{ 
                    padding: "10px 16px",
                    backgroundColor: isLoadingVehicle ? "#ccc" : "#FF4040",
                    color:"white", 
                    border:"none", 
                    borderRadius:"8px", 
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    cursor: isLoadingVehicle ? "not-allowed" : "pointer",
                    boxShadow: isLoadingVehicle ? "none" : "0 4px 6px rgba(255,64,64,0.2)",
                    transition: "all 0.3s ease",
                  }}
                  onMouseOver={(e) => {
                    if (!isLoadingVehicle) {
                      e.target.style.backgroundColor = "#cc0000";
                      e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isLoadingVehicle) {
                      e.target.style.backgroundColor = "#FF4040";
                      e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
                    }
                  }}
                >
                  {isLoadingVehicle ? "Loading..." : "Fetch Data"}
                </button>
              </div>
            </div>
            {vehicleDataSource && (
              <div style={{ 
                fontSize: "0.8rem", 
                color: "#007bff", 
                marginBottom: "12px",
                padding: "8px 12px",
                backgroundColor: "#e7f3ff",
                borderRadius: "6px",
                border: "1px solid #b3d9ff",
              }}>
                <strong>Data Source:</strong> {vehicleDataSource}
              </div>
            )}
            <div style={{ marginBottom: "10px" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>Colour</p>
              <p style={{ margin: 0, padding: "8px 12px", backgroundColor: "#f5f5f5", borderRadius: "6px", fontSize: "0.95rem" }}>
                {vehicle.colour || <span style={{ color: "#999" }}>Not available</span>}
              </p>
            </div>
            <div style={{ marginBottom: "10px" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>Make & Model</p>
              <p style={{ margin: 0, padding: "8px 12px", backgroundColor: "#f5f5f5", borderRadius: "6px", fontSize: "0.95rem" }}>
                {vehicle.makeModel || <span style={{ color: "#999" }}>Not available</span>}
              </p>
            </div>
            <div style={{ marginBottom: "10px" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>Chassis Number</p>
              <p style={{ margin: 0, padding: "8px 12px", backgroundColor: "#f5f5f5", borderRadius: "6px", fontSize: "0.95rem" }}>
                {vehicle.chassis || <span style={{ color: "#999" }}>Not available</span>}
              </p>
            </div>
            <div style={{ marginBottom: "10px" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>Engine Number</p>
              <p style={{ margin: 0, padding: "8px 12px", backgroundColor: "#f5f5f5", borderRadius: "6px", fontSize: "0.95rem" }}>
                {vehicle.engine || <span style={{ color: "#999" }}>Not available</span>}
              </p>
            </div>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: "500", color: "#555", display: "block", marginBottom: "6px" }}>
                Current Mileage
              </label>
              <input 
                type="number" 
                value={vehicle.mileage} 
                onChange={e=>setVehicle({...vehicle,mileage:e.target.value})}
                placeholder="Enter mileage" 
                style={{
                  ...modernInputStyle,
                  width: "100%",
                }}
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={(e) => {
                  e.target.style.border = "2px solid #e0e0e0";
                  e.target.style.backgroundColor = "#fafafa";
                  e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                }}
              />
            </div>
          </div>

          <div style={{ flex:1, backgroundColor:"white", padding:"16px", borderRadius:"8px", boxShadow:"0 2px 4px rgba(0,0,0,0.1)", height:sectionHeight, overflow:"auto" }}>
            <h3 style={{marginTop:0}}>Customer Details</h3>
            {customer ? (
              <div>
                <div style={{ marginBottom: "10px" }}>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>Name</p>
                  <p style={{ margin: 0, padding: "8px 12px", backgroundColor: "#f5f5f5", borderRadius: "6px", fontSize: "0.95rem" }}>
                    {customer.firstName} {customer.lastName}
                  </p>
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem",fontWeight: "500", color: "#555" }}>Address</p>
<p style={{ margin: 0, padding: "8px 12px", backgroundColor: "#f5f5f5", borderRadius: "6px", fontSize: "0.95rem" }}>
{customer.address}
</p>
</div>
<div style={{ marginBottom: "10px" }}>
<p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>Email</p>
<p style={{ margin: 0, padding: "8px 12px", backgroundColor: "#f5f5f5", borderRadius: "6px", fontSize: "0.95rem" }}>
{customer.email}
</p>
</div>
<div style={{ marginBottom: "10px" }}>
<p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", fontWeight: "500", color: "#555" }}>Phone</p>
<p style={{ margin: 0, padding: "8px 12px", backgroundColor: "#f5f5f5", borderRadius: "6px", fontSize: "0.95rem" }}>
{customer.mobile||customer.telephone}
</p>
</div>
<button
onClick={()=>setCustomer(null)}
style={{
marginTop:"12px",
padding:"10px 16px",
fontSize:"0.9rem",
backgroundColor:"#FF4040",
color:"white",
border:"none",
borderRadius:"8px",
cursor:"pointer",
fontWeight: "600",
boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
transition: "all 0.3s ease",
}}
onMouseOver={(e) => {
e.target.style.backgroundColor = "#cc0000";
e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
}}
onMouseOut={(e) => {
e.target.style.backgroundColor = "#FF4040";
e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
}}
>
Clear Customer
</button>
</div>
):(
<div style={{ display:"flex", flexDirection: "column", gap:"12px", marginTop: "20px" }}>
<button
onClick={()=>setShowNewCustomer(true)}
style={{
padding:"16px",
fontSize:"1rem",
backgroundColor:"#FF4040",
color:"white",
border:"none",
borderRadius:"8px",
cursor:"pointer",
fontWeight:"600",
boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
transition: "all 0.3s ease",
}}
onMouseOver={(e) => {
e.target.style.backgroundColor = "#cc0000";
e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
e.target.style.transform = "translateY(-2px)";
}}
onMouseOut={(e) => {
e.target.style.backgroundColor = "#FF4040";
e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
e.target.style.transform = "translateY(0)";
}}
>
+ New Customer
</button>
<button
onClick={()=>setShowExistingCustomer(true)}
style={{
padding:"16px",
fontSize:"1rem",
backgroundColor:"#FF4040",
color:"white",
border:"none",
borderRadius:"8px",
cursor:"pointer",
fontWeight:"600",
boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
transition: "all 0.3s ease",
}}
onMouseOver={(e) => {
e.target.style.backgroundColor = "#cc0000";
e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
e.target.style.transform = "translateY(-2px)";
}}
onMouseOut={(e) => {
e.target.style.backgroundColor = "#FF4040";
e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
e.target.style.transform = "translateY(0)";
}}
>
Search Existing Customer
</button>
</div>
)}
</div>
</div>
<div style={{ backgroundColor:"white", padding:"16px", borderRadius:"8px", boxShadow:"0 2px 4px rgba(0,0,0,0.1)", marginBottom:"24px" }}>
      <h3 style={{ marginTop: 0 }}>Job Requests</h3>
      {requests.map((req, i) => (
        <div key={i} style={{ 
          border: "2px solid #e0e0e0", 
          borderRadius: "8px", 
          marginBottom: "12px", 
          padding: "16px",
          backgroundColor: "#fafafa",
        }}>
          <strong style={{ fontSize: "0.95rem", color: "#333" }}>Request {i + 1}:</strong>
          <div style={{ marginTop: "10px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              value={req.text}
              onChange={(e) => handleRequestChange(i, e.target.value)}
              placeholder="Enter job request (MOT, Service, Diagnostic)"
              style={{ 
                flex: 2,
                minWidth: "200px",
                ...modernInputStyle,
              }}
              onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={(e) => {
                e.target.style.border = "2px solid #e0e0e0";
                e.target.style.backgroundColor = "#fafafa";
                e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="number"
                min="0"
                step="0.1"
                value={req.time || ""}
                onChange={(e) => handleTimeChange(i, e.target.value)}
                placeholder="Hours"
                style={{ 
                  width: "90px",
                  ...modernInputStyle,
                }}
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={(e) => {
                  e.target.style.border = "2px solid #e0e0e0";
                  e.target.style.backgroundColor = "#fafafa";
                  e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
                }}
              />
              <span style={{ fontSize: "0.9rem", color: "#666", fontWeight: "500", minWidth: "30px" }}>
                {req.time !== "" ? `${req.time}h` : ""}
              </span>
            </div>
            <select
              value={req.paymentType || "Customer"}
              onChange={(e) => handlePaymentTypeChange(i, e.target.value)}
              style={{
                ...modernInputStyle,
                width: "160px",
                cursor: "pointer",
              }}
              onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={(e) => {
                e.target.style.border = "2px solid #e0e0e0";
                e.target.style.backgroundColor = "#fafafa";
                e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
              }}
            >
              <option value="Customer">Customer</option>
              <option value="Warranty">Warranty</option>
              <option value="Sales Goodwill">Sales Goodwill</option>
              <option value="Service Goodwill">Service Goodwill</option>
              <option value="Internal">Internal</option>
              <option value="Insurance">Insurance</option>
              <option value="Lease Company">Lease Company</option>
              <option value="Staff">Staff</option>
            </select>
            <button
              onClick={() => handleRemoveRequest(i)}
              style={{ 
                backgroundColor: "#FF4040", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                padding: "10px 16px", 
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "0.9rem",
                boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
                transition: "all 0.3s ease",
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = "#cc0000";
                e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = "#FF4040";
                e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={handleAddRequest}
        style={{ 
          backgroundColor: "#FF4040", 
          color: "white", 
          border: "none", 
          borderRadius: "8px", 
          padding: "12px 20px", 
          cursor: "pointer",
          fontWeight: "600",
          fontSize: "0.95rem",
          boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
          transition: "all 0.3s ease",
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = "#cc0000";
          e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = "#FF4040";
          e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
        }}
      >
        + Add Request
      </button>
    </div>

    <div style={{ display:"flex", gap:"16px", height:bottomRowHeight }}>
      <div style={{ flex:1, backgroundColor:"white", padding:"12px", borderRadius:"8px", boxShadow:"0 2px 4px rgba(0,0,0,0.1)", overflow:"hidden" }}>
        <h4 style={{ marginTop:0, marginBottom: "8px", fontSize: "0.9rem", color: "#333" }}>Cosmetic Damage</h4>
        <textarea 
          value={cosmeticNotes} 
          onChange={e=>setCosmeticNotes(e.target.value)}
          placeholder="Describe any scratches, dents, or cosmetic damage..." 
          style={{ 
            width:"100%", 
            height:"55px", 
            ...modernInputStyle,
            resize: "none",
            fontFamily: "inherit",
            fontSize: "0.85rem",
          }}
          onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
          onBlur={(e) => {
            e.target.style.border = "2px solid #e0e0e0";
            e.target.style.backgroundColor = "#fafafa";
            e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
          }}
        />
      </div>
      <div 
        style={{ 
          flex:1, 
          backgroundColor:"#FF4040", 
          color:"white", 
          borderRadius:"8px", 
          display:"flex", 
          alignItems:"center", 
          justifyContent:"center", 
          cursor:"pointer",
          boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
          transition: "all 0.3s ease",
        }} 
        onClick={()=>setShowVhcPopup(true)}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = "#cc0000";
          e.currentTarget.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = "#FF4040";
          e.currentTarget.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "600" }}>Add VHC</h4>
      </div>
      <div 
        style={{ 
          flex:1, 
          backgroundColor:"#FF4040", 
          color:"white", 
          borderRadius:"8px", 
          display:"flex", 
          alignItems:"center", 
          justifyContent:"center", 
          cursor:"pointer",
          boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
          transition: "all 0.3s ease",
        }} 
        onClick={()=>alert("Full Car Details Coming Soon")}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = "#cc0000";
          e.currentTarget.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = "#FF4040";
          e.currentTarget.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "600" }}>Full Car Details</h4>
      </div>
    </div>

    {showNewCustomer && <NewCustomerPopup onClose={()=>setShowNewCustomer(false)} onSelect={c=>{setCustomer(c); setShowNewCustomer(false);}}/>}
    {showExistingCustomer && <ExistingCustomerPopup onClose={()=>setShowExistingCustomer(false)} onSelect={c=>{setCustomer(c); setShowExistingCustomer(false);}}/>}

    {showVhcPopup && (
      <div style={{ 
        position:"fixed", 
        top:0,
        left:0,
        right:0,
        bottom:0, 
        backgroundColor:"rgba(0,0,0,0.5)", 
        display:"flex", 
        alignItems:"center", 
        justifyContent:"center", 
        zIndex:1000 
      }}>
        <div style={{ 
          backgroundColor:"white", 
          padding:"32px", 
          borderRadius:"12px", 
          width:"360px", 
          textAlign:"center",
          boxShadow: "0 8px 16px rgba(0,0,0,0.2)",
        }}>
          <h3 style={{ margin: "0 0 20px 0", fontSize: "1.3rem", color: "#333" }}>Add VHC to this job?</h3>
          <div style={{ display:"flex", justifyContent:"space-around", marginTop:"20px"}}>
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px",
              cursor: "pointer",
              fontSize: "1rem",
            }}>
              <input 
                type="radio" 
                name="vhc" 
                value="yes" 
                onChange={()=>setVhcRequired(true)} 
                checked={vhcRequired===true}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              /> 
              <span>Yes</span>
            </label>
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px",
              cursor: "pointer",
              fontSize: "1rem",
            }}>
              <input 
                type="radio" 
                name="vhc" 
                value="no" 
                onChange={()=>setVhcRequired(false)} 
                checked={vhcRequired===false}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              /> 
              <span>No</span>
            </label>
          </div>
          <button 
            onClick={()=>setShowVhcPopup(false)}
            style={{ 
              marginTop:"24px", 
              padding:"12px 24px", 
              backgroundColor:"#FF4040", 
              color:"white", 
              border:"none", 
              borderRadius:"8px", 
              cursor:"pointer",
              fontWeight: "600",
              fontSize: "1rem",
              boxShadow: "0 4px 6px rgba(255,64,64,0.2)",
              transition: "all 0.3s ease",
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = "#cc0000";
              e.target.style.boxShadow = "0 6px 10px rgba(255,64,64,0.3)";
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = "#FF4040";
              e.target.style.boxShadow = "0 4px 6px rgba(255,64,64,0.2)";
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    )}
  </div>
</Layout>
);
}