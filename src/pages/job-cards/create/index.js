// src/pages/job-cards/create/index.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";

// ✅ Popup to add a new customer
function NewCustomerPopup({ onClose, onAdd }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [telephone, setTelephone] = useState("");

  const handleAdd = () => {
    if (!firstName || !lastName) return alert("Enter first and last name");
    onAdd({ firstName, lastName, address, email, mobile, telephone });
    onClose();
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", minWidth: "400px" }}>
        <h2>Add New Customer</h2>
        <input placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ display: "block", marginBottom: "8px", width: "100%" }} />
        <input placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ display: "block", marginBottom: "8px", width: "100%" }} />
        <input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} style={{ display: "block", marginBottom: "8px", width: "100%" }} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ display: "block", marginBottom: "8px", width: "100%" }} />
        <input placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} style={{ display: "block", marginBottom: "8px", width: "100%" }} />
        <input placeholder="Telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} style={{ display: "block", marginBottom: "8px", width: "100%" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "6px 12px" }}>Cancel</button>
          <button onClick={handleAdd} style={{ padding: "6px 12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "4px" }}>Add</button>
        </div>
      </div>
    </div>
  );
}

// ✅ Popup to select an existing customer
function ExistingCustomerPopup({ onClose, onSelect }) {
  const dummyCustomers = [
    { firstName: "John", lastName: "Smith", address: "123 Street", email: "john@example.com", mobile: "07123456789", telephone: "0161234567" },
    { firstName: "Jane", lastName: "Doe", address: "456 Avenue", email: "jane@example.com", mobile: "07234567890", telephone: "0171234567" },
  ];

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", minWidth: "400px" }}>
        <h2>Select Existing Customer</h2>
        {dummyCustomers.map((c, i) => (
          <div key={i} style={{ marginBottom: "8px", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer" }}
               onClick={() => { onSelect(c); onClose(); }}>
            {c.firstName} {c.lastName} - {c.mobile}
          </div>
        ))}
        <button onClick={onClose} style={{ marginTop: "12px", padding: "6px 12px" }}>Cancel</button>
      </div>
    </div>
  );
}

// ✅ Popup to choose next step after creating job card
function CheckSheetPopup({ onClose, onAddCheckSheet, onAddDealerDetails, onAddAppointment }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", minWidth: "400px" }}>
        <h2>Next Step</h2>
        <p>Choose which section to fill in next:</p>
        <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
          <button onClick={onAddCheckSheet} style={{ padding: "6px 12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "4px" }}>Add Check Sheet</button>
          <button onClick={onAddDealerDetails} style={{ padding: "6px 12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "4px" }}>Add Dealer Details</button>
          <button onClick={onAddAppointment} style={{ padding: "6px 12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "4px" }}>Set Appointment</button>
        </div>
        <button onClick={onClose} style={{ marginTop: "12px", padding: "6px 12px" }}>Cancel</button>
      </div>
    </div>
  );
}

// ✅ Local job number counter (starts at 30000)
let localJobCounter = 30000;

export default function CreateJobCardPage() {
  const router = useRouter();
  const [jobNumber, setJobNumber] = useState(null);
  const [jobData, setJobData] = useState({});
  const [registration, setRegistration] = useState("");
  const [vsmData, setVsmData] = useState({ colour: "", make: "", model: "", chassis: "", engine: "" });
  const [customer, setCustomer] = useState(null);
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [showExistingPopup, setShowExistingPopup] = useState(false);
  const [showCheckSheetPopup, setShowCheckSheetPopup] = useState(false);
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState("");

  const handleAddRequest = () => {
    if (newRequest.trim() === "") return;
    setRequests([...requests, newRequest.trim()]);
    setNewRequest("");
  };

  const handleAddJobCard = () => {
    if (!registration || !customer || requests.length === 0) {
      alert("Please fill in registration, customer, and at least one request.");
      return;
    }

    const newJobNumber = "JOB" + localJobCounter;
    localJobCounter += 1;
    setJobNumber(newJobNumber);

    setJobData({
      jobNumber: newJobNumber,
      registration,
      vsmData,
      customer,
      requests
    });

    setShowCheckSheetPopup(true);
  };

  const handleAddCheckSheet = () => {
    setShowCheckSheetPopup(false);
    router.push(`/job-cards/${jobNumber}/add-checksheet`);
  };

  const handleAddDealerDetails = () => {
    setShowCheckSheetPopup(false);
    router.push(`/job-cards/${jobNumber}/dealer-car-details`);
  };

  const handleAddAppointment = () => {
    setShowCheckSheetPopup(false);
    router.push(`/appointments?jobNumber=${jobNumber}`);
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

  const isReadyToCreate = registration && customer && requests.length > 0;

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
          {requests.map((req, index) => (<p key={index}><strong>Request {index + 1}:</strong> {req}</p>))}
          <div style={{ display: "flex", marginTop: "12px", gap: "8px" }}>
            <input type="text" value={newRequest} onChange={(e) => setNewRequest(e.target.value)} placeholder="Enter request" style={{ flex: 1, padding: "4px 8px" }} />
            <button onClick={handleAddRequest} style={{ padding: "6px 12px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "4px" }}>Add Line</button>
          </div>
        </div>

        {/* Create Job Card Button */}
        <button
          onClick={handleAddJobCard}
          disabled={!isReadyToCreate}
          style={{
            padding: "12px 20px",
            backgroundColor: isReadyToCreate ? "#FF4040" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
          }}
        >
          Create Job Card
        </button>

        {showCustomerPopup && <NewCustomerPopup onClose={() => setShowCustomerPopup(false)} onAdd={(data) => setCustomer(data)} />}
        {showExistingPopup && <ExistingCustomerPopup onClose={() => setShowExistingPopup(false)} onSelect={(data) => setCustomer(data)} />}
        {showCheckSheetPopup && (
          <CheckSheetPopup
            onClose={() => setShowCheckSheetPopup(false)}
            onAddCheckSheet={handleAddCheckSheet}
            onAddDealerDetails={handleAddDealerDetails}
            onAddAppointment={handleAddAppointment}
          />
        )}
      </div>
    </Layout>
  );
}
