// src/pages/job-cards/create/index.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useJobs } from "../../../context/JobsContext";

// Local job counter
let localJobCounter = 30000;

export default function CreateJobCardPage() {
  const router = useRouter();
  const { addJob } = useJobs();

  const [jobNumber, setJobNumber] = useState(null);
  const [registration, setRegistration] = useState("");
  const [vsmData, setVsmData] = useState({ colour: "", make: "", model: "", chassis: "", engine: "" });
  const [customer, setCustomer] = useState(null);
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState("");

  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [showExistingPopup, setShowExistingPopup] = useState(false);

  const handleAddRequest = () => {
    if (!newRequest.trim()) return;
    setRequests([...requests, newRequest.trim()]);
    setNewRequest("");
  };

  const handleFetchVSM = () => {
    setVsmData({
      colour: "Red",
      make: "Renault",
      model: "Clio Mk5 1.3 Turbo",
      chassis: "XYZ987654321",
      engine: "ENG123456789",
    });
  };

  const handleAddJobCard = () => {
    if (!registration || !customer || requests.length === 0) {
      alert("Please fill in registration, customer, and at least one request.");
      return;
    }

    const newJobNumber = "JOB" + localJobCounter;
    setJobNumber(newJobNumber);
    localJobCounter += 1;

    addJob({
      jobNumber: newJobNumber,
      customer,
      car: { registration, mileage: "" },
      vsmData,
      requests,
      status: "Waiting",
      vhcCompleted: false,
    });

    router.push(`/job-cards/${newJobNumber}`);
  };

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040" }}>Create Job Card: {jobNumber || "Generating..."}</h1>

        {/* Vehicle Details */}
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", marginBottom: "24px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          <h3>Vehicle Details</h3>
          <label>
            Registration:
            <input type="text" value={registration} onChange={(e) => setRegistration(e.target.value)} style={{ marginLeft: "8px", padding: "4px 8px" }} />
          </label>
          <button onClick={handleFetchVSM} style={{ marginLeft: "12px", padding: "6px 12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "4px" }}>Fetch VSM</button>
          {vsmData.make && (
            <div style={{ marginTop: "12px" }}>
              <p><strong>Make:</strong> {vsmData.make}</p>
              <p><strong>Model:</strong> {vsmData.model}</p>
              <p><strong>Colour:</strong> {vsmData.colour}</p>
              <p><strong>Chassis Number:</strong> {vsmData.chassis}</p>
              <p><strong>Engine Number:</strong> {vsmData.engine}</p>
            </div>
          )}
        </div>

        {/* Customer Details */}
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", marginBottom: "24px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          <h3>Customer Details</h3>
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <button onClick={() => setShowExistingPopup(true)} style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "4px" }}>Add Existing Customer</button>
            <button onClick={() => setShowCustomerPopup(true)} style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "4px" }}>Add New Customer</button>
          </div>
          {customer && (
            <div>
              <p><strong>Name:</strong> {customer.firstName} {customer.lastName}</p>
              <p><strong>Address:</strong> {customer.address}</p>
              <p><strong>Email:</strong> {customer.email}</p>
              <p><strong>Mobile:</strong> {customer.mobile}</p>
              <p><strong>Telephone:</strong> {customer.telephone}</p>
            </div>
          )}
        </div>

        {/* Job Requests */}
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", marginBottom: "24px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          <h3>Job Requests</h3>
          {requests.map((req, i) => (<p key={i}><strong>Request {i + 1}:</strong> {req}</p>))}
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <input type="text" value={newRequest} onChange={(e) => setNewRequest(e.target.value)} placeholder="Enter request" style={{ flex: 1, padding: "4px 8px" }} />
            <button onClick={handleAddRequest} style={{ padding: "6px 12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "4px" }}>Add Line</button>
          </div>
        </div>

        <button onClick={handleAddJobCard} disabled={!registration || !customer || requests.length === 0} style={{ padding: "12px 20px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold" }}>
          Create Job Card
        </button>
      </div>
    </Layout>
  );
}
