// file location: src/pages/job-cards/create/index.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useJobs } from "../../../context/JobsContext";
import JobCardModal from "../../../components/JobCards/JobCardModal";

// Popups
import NewCustomerPopup from "../../../components/popups/NewCustomerPopup";
import ExistingCustomerPopup from "../../../components/popups/ExistingCustomerPopup";

// Local job number counter
let localJobCounter = 30000;

export default function CreateJobCardPage() {
  const router = useRouter();
  const { jobs, addJob } = useJobs();

  // Vehicle & customer state
  const [vehicle, setVehicle] = useState({
    reg: "",
    colour: "",
    makeModel: "",
    chassis: "",
    engine: "",
    mileage: "",
  });
  const [customer, setCustomer] = useState(null);

  // Popups
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showExistingCustomer, setShowExistingCustomer] = useState(false);
  const [showVhcPopup, setShowVhcPopup] = useState(false);
  const [showChecksheetPopup, setShowChecksheetPopup] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);

  // Job state
  const [requests, setRequests] = useState([]);
  const [cosmeticNotes, setCosmeticNotes] = useState("");
  const [vhcRequired, setVhcRequired] = useState(false);
  const [checksheetRequired, setChecksheetRequired] = useState(false);
  const [jobNumber, setJobNumber] = useState(null);

  // Save or update job
  const handleSaveUpdates = () => {
    let currentJobNumber = jobNumber;

    if (!currentJobNumber) {
      localJobCounter++;
      currentJobNumber = localJobCounter;
      setJobNumber(currentJobNumber);
    }

    const updatedJob = {
      jobNumber: currentJobNumber,
      vehicle,
      customer,
      requests,
      cosmeticNotes,
      vhcRequired,
      checksheetRequired,
    };

    addJob(updatedJob); // addJob will auto-update if jobNumber exists
    return currentJobNumber;
  };

  // Layout heights
  const sectionHeight = "250px";
  const jobDetailsHeight = "350px";
  const bottomRowHeight = "150px";

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        {/* Top Row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#555" }}>Retail / Sales / Warranty</h2>
            <h1 style={{ color: "#FF4040", margin: 0 }}>Create New Job Card</h1>
          </div>

          {/* Save Job Button */}
          <button
            onClick={() => {
              const num = handleSaveUpdates();
              router.push(`/job-cards/${num}`);
            }}
            style={{ padding: "12px 20px", backgroundColor: "green", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "1rem" }}
          >
            Save Job
          </button>
        </div>

        {/* Vehicle & Customer Details */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          {/* Vehicle Details */}
          <div style={{ flex: 1, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", height: sectionHeight, overflow: "hidden" }}>
            <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Vehicle Details</h3>
            <p><strong>Registration:</strong> {vehicle.reg}</p>
            <p><strong>Colour:</strong> {vehicle.colour}</p>
            <p><strong>Make & Model:</strong> {vehicle.makeModel}</p>
            <p><strong>Chassis Number:</strong> {vehicle.chassis}</p>
            <p><strong>Engine Number:</strong> {vehicle.engine}</p>
            <div style={{ marginTop: "8px" }}>
              <label>
                <strong>Mileage:</strong>
                <input
                  type="number"
                  value={vehicle.mileage}
                  onChange={(e) => setVehicle({ ...vehicle, mileage: e.target.value })}
                  placeholder="Enter miles"
                  style={{ marginLeft: "8px", padding: "4px 8px", width: "100px" }}
                />
              </label>
            </div>
          </div>

          {/* Customer Details */}
          <div style={{ flex: 1, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", height: sectionHeight, overflow: "hidden" }}>
            <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Customer Details</h3>
            {customer ? (
              <>
                <p><strong>Full Name:</strong> {customer.firstName} {customer.lastName}</p>
                <p><strong>Address:</strong> {customer.address}</p>
                <p><strong>Email:</strong> {customer.email}</p>
                <p><strong>Phone:</strong> {customer.mobile || customer.telephone}</p>
              </>
            ) : (
              <p>No customer selected</p>
            )}
            <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
              <button onClick={() => setShowNewCustomer(true)} style={{ flex: 1, padding: "8px 12px", border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer" }}>New Customer</button>
              <button onClick={() => setShowExistingCustomer(true)} style={{ flex: 1, padding: "8px 12px", border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer" }}>Existing Customer</button>
            </div>
          </div>
        </div>

        {/* Job Requests */}
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "24px", height: jobDetailsHeight }}>
          <h3 style={{ marginTop: 0 }}>Job Requests</h3>
          <ul>
            {requests.map((req, i) => <li key={i}>{req}</li>)}
          </ul>
          <input
            type="text"
            placeholder="Add job request"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.value) {
                setRequests([...requests, e.target.value]);
                e.target.value = "";
              }
            }}
            style={{ width: "100%", padding: "8px", marginTop: "8px" }}
          />
        </div>

        {/* Bottom Sections */}
        <div style={{ display: "flex", gap: "16px", height: bottomRowHeight }}>
          {/* Cosmetic Damage */}
          <div style={{ flex: 1, backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", overflowY: "auto" }}>
            <h4 style={{ marginTop: 0 }}>Cosmetic Damage</h4>
            <textarea value={cosmeticNotes} onChange={(e) => setCosmeticNotes(e.target.value)} placeholder="Scratches, dents, paint damage..." style={{ width: "100%", height: "80px", padding: "8px" }} />
          </div>

          {/* VHC Button */}
          <div style={{ flex: 1, backgroundColor: "#FF4040", color: "white", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => setShowVhcPopup(true)}>
            <h4>Add VHC</h4>
          </div>

          {/* Check Sheet Button */}
          <div style={{ flex: 1, backgroundColor: "#FF4040", color: "white", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => setShowChecksheetPopup(true)}>
            <h4>Add Check Sheet</h4>
          </div>

          {/* Full Car Details */}
          <div style={{ flex: 1, backgroundColor: "#FF4040", color: "white", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => alert("Full Car Details Coming Soon")}>
            <h4>Full Car Details</h4>
          </div>
        </div>

        {/* Job Card Modal */}
        {showJobModal && <JobCardModal isOpen={showJobModal} onClose={() => setShowJobModal(false)} existingJobs={jobs.map(j => j.jobNumber)} />}

        {/* Customer Popups */}
        {showNewCustomer && <NewCustomerPopup onClose={() => setShowNewCustomer(false)} onSelectCustomer={(c) => setCustomer(c)} />}
        {showExistingCustomer && <ExistingCustomerPopup onClose={() => setShowExistingCustomer(false)} onSelectCustomer={(c) => setCustomer(c)} />}

        {/* VHC Popup */}
        {showVhcPopup && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", width: "320px", textAlign: "center" }}>
              <h3>Add VHC to this job?</h3>
              <div style={{ display: "flex", justifyContent: "space-around", marginTop: "16px" }}>
                <label>
                  <input type="radio" name="vhc" value="yes" onChange={() => setVhcRequired(true)} checked={vhcRequired === true} /> Yes
                </label>
                <label>
                  <input type="radio" name="vhc" value="no" onChange={() => setVhcRequired(false)} checked={vhcRequired === false} /> No
                </label>
              </div>
              <button onClick={() => setShowVhcPopup(false)} style={{ marginTop: "16px", padding: "8px 16px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Confirm</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}