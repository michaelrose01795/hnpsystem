// file location: src/pages/job-cards/create/index.js
"use client";

import React, { useState } from "react"; // React imports
import { useRouter } from "next/router"; // Router for navigation
import Layout from "../../../components/Layout"; // Layout wrapper
import { useJobs } from "../../../context/JobsContext"; // Jobs context

// ✅ Import popups (now lowercase folder name "popups")
import NewCustomerPopup from "../../../components/popups/NewCustomerPopup";
import ExistingCustomerPopup from "../../../components/popups/ExistingCustomerPopup";
import CheckSheetPopup from "../../../components/popups/CheckSheetPopup";

// Local job number counter (starts at 30000)
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

  // Customer & job data states
  const [customer, setCustomer] = useState(null);
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState("");
  const [cosmeticNotes, setCosmeticNotes] = useState("");

  // VHC state
  const [vhcRequired, setVhcRequired] = useState(null);
  const [showVhcPopup, setShowVhcPopup] = useState(false);

  // Popup states
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showExistingCustomer, setShowExistingCustomer] = useState(false);
  const [showCheckSheet, setShowCheckSheet] = useState(false);

  // Handle vehicle autofill (dummy fetch)
  const handleFetchVSM = () => {
    setVehicle({
      reg: "ABC123",
      colour: "Red",
      makeModel: "Renault Clio Mk5 1.3 Turbo",
      chassis: "XYZ987654321",
      engine: "ENG123456789",
      mileage: "",
    });
  };

  // Handle add job
  const handleCreateJob = () => {
    localJobCounter++;
    const newJob = {
      jobNumber: localJobCounter,
      vehicle,
      customer,
      requests,
      cosmeticNotes,
      vhcRequired: vhcRequired !== null ? vhcRequired : false,
    };
    addJob(newJob);
    router.push(`/job-cards/${localJobCounter}`);
  };

  // Layout heights
  const sectionHeight = "250px";

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        {/* Top Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#555" }}>Retail / Sales / Warranty</h2>
            <h1 style={{ color: "#FF4040", margin: 0 }}>Create New Job Card</h1>
          </div>
          <button
            onClick={() => { handleSaveUpdates(); router.push(`/job-cards/${jobNumber || localJobCounter}`); }}
            style={{ padding: "12px 20px", backgroundColor: "green", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "1rem" }}
          >
            Save Job
          </button>
        </div>

        {/* Vehicle & Customer Details */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          {/* Vehicle Details */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              height: sectionHeight,
              overflow: "hidden",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "12px" }}>
              Vehicle Details
            </h3>
            <p><strong>Registration:</strong> {vehicle.reg}</p>
            <p><strong>Colour:</strong> {vehicle.colour}</p>
            <p><strong>Make & Model:</strong> {vehicle.makeModel}</p>
            <p><strong>Chassis:</strong> {vehicle.chassis}</p>
            <p><strong>Engine:</strong> {vehicle.engine}</p>
            <div>
              <label>
                <strong>Mileage:</strong>
                <input
                  type="number"
                  value={vehicle.mileage}
                  onChange={(e) =>
                    setVehicle({ ...vehicle, mileage: e.target.value })
                  }
                  placeholder="Enter miles"
                  style={{ marginLeft: "8px", padding: "4px 8px", width: "100px" }}
                />
              </label>
            </div>
            <button
              onClick={() => { handleFetchVSM(); handleSaveUpdates(); }}
              style={{ marginTop: "12px", padding: "6px 12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
            >
              Fetch VSM
            </button>
          </div>

          {/* Customer Details */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              height: sectionHeight,
              overflow: "hidden",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "12px" }}>
              Customer Details
            </h3>
            {customer ? (
              <>
                <p>
                  <strong>Full Name:</strong> {customer.firstName}{" "}
                  {customer.lastName}
                </p>
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
        <div
          style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            marginBottom: "24px",
            height: jobDetailsHeight,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Job Requests</h3>
          <ul>
            {requests.map((req, i) => (
              <li key={i}>{req}</li>
            ))}
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
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              overflowY: "auto",
            }}
          >
            <h4 style={{ marginTop: 0 }}>Cosmetic Damage</h4>
            <textarea
              value={cosmeticNotes}
              onChange={(e) => setCosmeticNotes(e.target.value)}
              placeholder="Scratches, dents, paint damage..."
              style={{ width: "100%", height: "80px", padding: "8px" }}
            />
          </div>

          {/* Write-Up */}
          <div
            style={{
              flex: 1,
              backgroundColor: "#FF4040",
              color: "white",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onClick={() => setShowCheckSheet(true)}
          >
            <h4>Go to Write-Up</h4>
          </div>

          {/* Check Box */}
          <div
            style={{
              flex: 1,
              backgroundColor: "#FF4040",
              color: "white",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onClick={() => setShowCheckSheet(true)}
          >
            <h4>Go to Check Box</h4>
          </div>

          {/* Full Car Details */}
          <div
            style={{
              flex: 1,
              backgroundColor: "#FF4040",
              color: "white",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onClick={() => setShowCheckSheet(true)}
          >
            <h4>Full Car Details</h4>
          </div>
        </div>
      </div>

      {/* Popups */}
      {showNewCustomer && (
        <NewCustomerPopup
          onClose={() => setShowNewCustomer(false)}
          onAdd={(c) => setCustomer(c)}
        />
      )}
      {showExistingCustomer && (
        <ExistingCustomerPopup
          onClose={() => setShowExistingCustomer(false)}
          onSelect={(c) => setCustomer(c)}
        />
      )}
      {showCheckSheet && (
        <CheckSheetPopup
          onClose={() => setShowCheckSheet(false)}
          onAddCheckSheet={() => alert("Check sheet added")}
          onAddDealerDetails={() => alert("Dealer car details added")}
        />
      )}
    </Layout>
  );
}
