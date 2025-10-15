// file location: src/pages/job-cards/create/index.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useJobs } from "../../../context/JobsContext";
import JobCardModal from "../../../components/JobCards/JobCardModal";
import NewCustomerPopup from "../../../components/popups/NewCustomerPopup";
import ExistingCustomerPopup from "../../../components/popups/ExistingCustomerPopup";

let localJobCounter = 30000;

const detectJobTypes = (requests) => {
  const detected = new Set();
  requests.forEach((description) => {
    const lower = description.toLowerCase();
    if (lower.includes("mot")) detected.add("MOT");
    if (lower.includes("service") || lower.includes("oil") || lower.includes("inspection"))
      detected.add("Service");
    if (
      lower.includes("diag") ||
      lower.includes("investigation") ||
      lower.includes("check") ||
      lower.includes("warning") ||
      lower.includes("fault")
    )
      detected.add("Diagnostic");
  });
  if (detected.size === 0) detected.add("Other");
  return Array.from(detected);
};

const generateFakeVehicleData = (reg) => {
  const colours = ["Red", "Blue", "White", "Black", "Grey", "Silver"];
  const makes = [
    "Mitsubishi L200",
    "Suzuki Swift",
    "SsangYong Tivoli",
    "Nissan Qashqai",
    "Toyota Corolla",
  ];
  return {
    reg: reg.toUpperCase(),
    colour: colours[Math.floor(Math.random() * colours.length)],
    makeModel: makes[Math.floor(Math.random() * makes.length)],
    chassis: `CH${Math.floor(100000 + Math.random() * 900000)}`,
    engine: `EN${Math.floor(10000 + Math.random() * 90000)}`,
    mileage: Math.floor(10000 + Math.random() * 90000),
  };
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

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showExistingCustomer, setShowExistingCustomer] = useState(false);
  const [showVhcPopup, setShowVhcPopup] = useState(false);

  const [requests, setRequests] = useState([{ text: "", time: "" }]);
  const [cosmeticNotes, setCosmeticNotes] = useState("");
  const [vhcRequired, setVhcRequired] = useState(false);
  const [waitingStatus, setWaitingStatus] = useState("Neither");
  const [jobSource, setJobSource] = useState("Retail");
  const [jobCategories, setJobCategories] = useState(["Other"]);

  // Maintenance Section
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

    // Auto-fill Time Required
    const lower = value.toLowerCase();
    if (lower.includes("mot")) updated[index].time = updated[index].time || 0.1;
    else if (lower.includes("diag")) updated[index].time = updated[index].time || 1;

    setRequests(updated);
    const allTexts = updated.map((r) => r.text);
    setJobCategories(detectJobTypes(allTexts));
  };

  const handleTimeChange = (index, value) => {
    const updated = [...requests];
    let num = parseFloat(value);
    if (isNaN(num) || num < 0) num = 0;
    updated[index].time = num;
    setRequests(updated);
  };

  const handleAddRequest = () => setRequests([...requests, { text: "", time: "" }]);
  const handleRemoveRequest = (index) => {
    const updated = requests.filter((_, i) => i !== index);
    setRequests(updated);
    setJobCategories(detectJobTypes(updated.map((r) => r.text)));
  };

  const handleSaveJob = async () => {
    if (!vehicle.reg.trim()) {
      alert("Please enter a vehicle registration!");
      return;
    }
    if (!customer) {
      alert("Please select or create a customer!");
      return;
    }
    const validRequests = requests.filter((r) => r.text.trim());
    if (validRequests.length === 0) {
      alert("Please add at least one job request!");
      return;
    }

    localJobCounter++;
    const jobNumber = localJobCounter;

    const jobCardData = {
      jobNumber,
      createdAt: new Date().toISOString(),
      status: "Open",
      vehicle,
      customer,
      requests: validRequests.map((r) => r.text),
      cosmeticNotes,
      vhcRequired,
      waitingStatus,
      jobSource,
      jobCategories,
      maintenance,
    };

    addJob(jobCardData);

    const encodedData = encodeURIComponent(JSON.stringify(jobCardData));

    router.push(`/appointments?jobNumber=${jobNumber}&data=${encodedData}`);
  };

  const handleFetchVehicleData = () => {
    if (!vehicle.reg.trim()) {
      alert("Please enter a registration first!");
      return;
    }
    setVehicle(generateFakeVehicleData(vehicle.reg));
  };

  const sectionHeight = "260px";
  const bottomRowHeight = "150px";

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
        {/* Header */}
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
              padding: "12px 20px",
              backgroundColor: "green",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Save Job
          </button>
        </div>

        {/* Job Info + GDPR Section */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          <div style={{ flex: 7, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <h3 style={{ marginTop: 0 }}>Job Information</h3>
            <div style={{ marginBottom: "12px" }}>
              <strong style={{ width: "150px", display: "inline-block" }}>Customer Status:</strong>
              {["Waiting", "Loan Car", "Collection", "Neither"].map((status) => (
                <label key={status} style={{ marginRight: "12px" }}>
                  <input type="radio" name="waiting" value={status} checked={waitingStatus===status} onChange={()=>setWaitingStatus(status)} /> {status}
                </label>
              ))}
            </div>
            <div style={{ marginBottom: "12px" }}>
              <strong style={{ width: "150px", display: "inline-block" }}>Job Source:</strong>
              {["Retail","Warranty"].map((src)=>( 
                <label key={src} style={{ marginRight: "12px" }}>
                  <input type="radio" name="source" value={src} checked={jobSource===src} onChange={()=>setJobSource(src)} /> {src}
                </label>
              ))}
            </div>
            <div>
              <strong>Detected Job Types:</strong>{" "}
              {jobCategories.map((type,index)=>(
                <span key={index} style={{ display:"inline-block", marginRight:"8px", backgroundColor:"#FF4040", color:"white", padding:"4px 10px", borderRadius:"20px", fontWeight:"bold", fontSize:"0.9rem" }}>{type}</span>
              ))}
            </div>
          </div>
          <div style={{ flex: 3, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <h3 style={{ marginTop: 0 }}>GDPR Settings</h3>
            <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:"16px" }}>
              <thead>
                <tr>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left" }}>Contact Type</th>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left" }}>From Us</th>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left" }}>From Franchise</th>
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
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left" }}>Marketing / Service</th>
                  <th style={{ borderBottom:"1px solid #ddd", textAlign:"left" }}>Allowed</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Marketing Messages</td><td><input type="checkbox"/></td></tr>
                <tr><td>Service Dept Follow Up</td><td><input type="checkbox"/></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Vehicle & Customer + Maintenance */}
        <div style={{ display:"flex", gap:"16px", marginBottom:"24px" }}>
          <div style={{ flex:1, backgroundColor:"white", padding:"16px", borderRadius:"8px", boxShadow:"0 2px 4px rgba(0,0,0,0.1)", height:sectionHeight }}>
            <h3 style={{marginTop:0}}>Vehicle Details</h3>
            <label><strong>Registration:</strong> <input type="text" value={vehicle.reg} onChange={e=>setVehicle({...vehicle,reg:e.target.value})} placeholder="Enter reg" style={{ marginLeft:"8px", padding:"4px 8px", width:"120px"}}/></label>
            <button onClick={handleFetchVehicleData} style={{ marginLeft:"12px", backgroundColor:"#007bff", color:"white", border:"none", borderRadius:"4px", padding:"4px 10px", cursor:"pointer"}}>Fetch Vehicle Data</button>
            <p><strong>Colour:</strong> {vehicle.colour}</p>
            <p><strong>Make & Model:</strong> {vehicle.makeModel}</p>
            <p><strong>Chassis:</strong> {vehicle.chassis}</p>
            <p><strong>Engine:</strong> {vehicle.engine}</p>
            <label><strong>Mileage:</strong> <input type="number" value={vehicle.mileage} onChange={e=>setVehicle({...vehicle,mileage:e.target.value})} placeholder="Enter miles" style={{ marginLeft:"8px", padding:"4px 8px", width:"100px"}}/></label>

            {/* Maintenance Section */}
            <h4 style={{ marginTop:"16px" }}>Maintenance</h4>
            <label>Next Service Date: <input type="date" value={maintenance.nextServiceDate} onChange={e=>setMaintenance({...maintenance,nextServiceDate:e.target.value})}/></label><br/>
            <label>Next MOT Date: <input type="date" value={maintenance.nextMotDate} onChange={e=>setMaintenance({...maintenance,nextMotDate:e.target.value})}/></label><br/>
            <label>Lease CO: <input type="text" value={maintenance.leaseCO} onChange={e=>setMaintenance({...maintenance,leaseCO:e.target.value})}/></label><br/>
            <label>Privileges: <input type="text" value={maintenance.privileges} onChange={e=>setMaintenance({...maintenance,privileges:e.target.value})}/></label><br/>
            <label>Next VHC: <input type="date" value={maintenance.nextVHC} onChange={e=>setMaintenance({...maintenance,nextVHC:e.target.value})}/></label><br/>
            <label>Warranty Expiry: <input type="date" value={maintenance.warrantyExpiry} onChange={e=>setMaintenance({...maintenance,warrantyExpiry:e.target.value})}/></label><br/>
            <label>Service Plan Supplier: <input type="text" value={maintenance.servicePlanSupplier} onChange={e=>setMaintenance({...maintenance,servicePlanSupplier:e.target.value})}/></label><br/>
            <label>Service Plan Type: <input type="text" value={maintenance.servicePlanType} onChange={e=>setMaintenance({...maintenance,servicePlanType:e.target.value})}/></label><br/>
            <label>Service Plan Expiry: <input type="date" value={maintenance.servicePlanExpiry} onChange={e=>setMaintenance({...maintenance,servicePlanExpiry:e.target.value})}/></label>
          </div>

          <div style={{ flex:1, backgroundColor:"white", padding:"16px", borderRadius:"8px", boxShadow:"0 2px 4px rgba(0,0,0,0.1)", height:sectionHeight }}>
            <h3 style={{marginTop:0}}>Customer Details</h3>
            {customer ? (
              <>
                <p><strong>Name:</strong> {customer.firstName} {customer.lastName}</p>
                <p><strong>Address:</strong> {customer.address}</p>
                <p><strong>Email:</strong> {customer.email}</p>
                <p><strong>Phone:</strong> {customer.mobile||customer.telephone}</p>
                <button onClick={()=>setCustomer(null)} style={{ marginTop:"12px", padding:"6px 12px", fontSize:"0.9rem", backgroundColor:"#FF4040", color:"white", border:"none", borderRadius:"6px", cursor:"pointer"}}>Clear Customer</button>
              </>
            ):(
              <div style={{ display:"flex", gap:"12px" }}>
                <button onClick={()=>setShowNewCustomer(true)} style={{ flex:1, padding:"14px 0", fontSize:"1rem", backgroundColor:"#007bff", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontWeight:"bold"}}>New Customer</button>
                <button onClick={()=>setShowExistingCustomer(true)} style={{ flex:1, padding:"14px 0", fontSize:"1rem", backgroundColor:"#FF4040", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontWeight:"bold"}}>Existing Customer</button>
              </div>
            )}
          </div>
        </div>

        {/* Job Requests */}
        <div style={{ backgroundColor:"white", padding:"16px", borderRadius:"8px", boxShadow:"0 2px 4px rgba(0,0,0,0.1)", marginBottom:"24px" }}>
          <h3 style={{ marginTop: 0 }}>Job Requests</h3>
          {requests.map((req, i) => (
            <div key={i} style={{ border: "1px solid #ddd", borderRadius: "6px", marginBottom: "12px", padding: "12px" }}>
              <strong>Request {i + 1}:</strong>
              <div style={{ marginLeft: "20px", marginTop: "6px", display: "flex", gap: "12px", alignItems: "center" }}>
                <input
                  type="text"
                  value={req.text}
                  onChange={(e) => handleRequestChange(i, e.target.value)}
                  placeholder="Enter job request (MOT, Service, Diagnostic)"
                  style={{ flex: 2, padding: "6px 8px", border: "1px solid #ccc", borderRadius: "4px" }}
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={req.time || ""}
                  onChange={(e) => handleTimeChange(i, e.target.value)}
                  placeholder="Time (h)"
                  style={{ width: "80px", padding: "6px 8px", border: "1px solid #ccc", borderRadius: "4px" }}
                />
                <span>{req.time !== "" ? `${req.time}h` : ""}</span>
                <button
                  onClick={() => handleRemoveRequest(i)}
                  style={{ backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "4px", padding: "6px 10px", cursor: "pointer" }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={handleAddRequest}
            style={{ backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "6px", padding: "8px 14px", cursor: "pointer" }}
          >
            + Add Request
          </button>
        </div>

        {/* Cosmetic + VHC + Details Buttons */}
        <div style={{ display:"flex", gap:"16px", height:bottomRowHeight }}>
          <div style={{ flex:1, backgroundColor:"white", padding:"16px", borderRadius:"8px", boxShadow:"0 2px 4px rgba(0,0,0,0.1)" }}>
            <h4 style={{ marginTop:0 }}>Cosmetic Damage</h4>
            <textarea value={cosmeticNotes} onChange={e=>setCosmeticNotes(e.target.value)} placeholder="Scratches, dents, etc..." style={{ width:"100%", height:"80px", padding:"8px"}}/>
          </div>
          <div style={{ flex:1, backgroundColor:"#FF4040", color:"white", borderRadius:"8px", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer"}} onClick={()=>setShowVhcPopup(true)}>
            <h4>Add VHC</h4>
          </div>
          <div style={{ flex:1, backgroundColor:"#FF4040", color:"white", borderRadius:"8px", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer"}} onClick={()=>alert("Full Car Details Coming Soon")}>
            <h4>Full Car Details</h4>
          </div>
        </div>

        {/* Popups */}
        {showNewCustomer && <NewCustomerPopup onClose={()=>setShowNewCustomer(false)} onSelect={c=>{setCustomer(c); setShowNewCustomer(false);}}/>}
        {showExistingCustomer && <ExistingCustomerPopup onClose={()=>setShowExistingCustomer(false)} onSelect={c=>{setCustomer(c); setShowExistingCustomer(false);}}/>}

        {/* VHC Popup */}
        {showVhcPopup && (
          <div style={{ position:"fixed", top:0,left:0,right:0,bottom:0, backgroundColor:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
            <div style={{ backgroundColor:"white", padding:"24px", borderRadius:"8px", width:"320px", textAlign:"center"}}>
              <h3>Add VHC to this job?</h3>
              <div style={{ display:"flex", justifyContent:"space-around", marginTop:"16px"}}>
                <label><input type="radio" name="vhc" value="yes" onChange={()=>setVhcRequired(true)} checked={vhcRequired===true}/> Yes</label>
                <label><input type="radio" name="vhc" value="no" onChange={()=>setVhcRequired(false)} checked={vhcRequired===false}/> No</label>
              </div>
              <button onClick={()=>setShowVhcPopup(false)} style={{ marginTop:"16px", padding:"8px 16px", backgroundColor:"#FF4040", color:"white", border:"none", borderRadius:"6px", cursor:"pointer"}}>Confirm</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
