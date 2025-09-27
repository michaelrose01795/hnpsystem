// file location: src/pages/job-cards/create/index.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";

// ✅ Popup to add new customer
function NewCustomerPopup({ onClose, onAdd }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [number, setNumber] = useState("");
  const [street, setStreet] = useState("");
  const [town, setTown] = useState("");
  const [country, setCountry] = useState("");
  const [postcode, setPostcode] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [telephone, setTelephone] = useState("");

  const handleAdd = () => {
    onAdd({
      firstName,
      lastName,
      address: `${number} ${street}, ${town}, ${country}, ${postcode}`,
      email,
      mobile,
      telephone,
    });
    onClose();
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white", padding: "24px", borderRadius: "8px",
        width: "400px", maxHeight: "90vh", overflowY: "auto"
      }}>
        <h3>Add New Customer</h3>
        <label>First Name:</label>
        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ width: "100%", marginBottom: "8px" }} />
        <label>Last Name:</label>
        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ width: "100%", marginBottom: "8px" }} />
        <label>Number:</label>
        <input type="text" value={number} onChange={(e) => setNumber(e.target.value)} style={{ width: "100%", marginBottom: "8px" }} />
        <label>Street:</label>
        <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} style={{ width: "100%", marginBottom: "8px" }} />
        <label>Town/City:</label>
        <input type="text" value={town} onChange={(e) => setTown(e.target.value)} style={{ width: "100%", marginBottom: "8px" }} />
        <label>Country:</label>
        <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: "100%", marginBottom: "8px" }} />
        <label>Postcode:</label>
        <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} style={{ width: "100%", marginBottom: "8px" }} />
        <label>Email:</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", marginBottom: "8px" }} />
        <label>Mobile:</label>
        <input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} style={{ width: "100%", marginBottom: "8px" }} />
        <label>Telephone:</label>
        <input type="text" value={telephone} onChange={(e) => setTelephone(e.target.value)} style={{ width: "100%", marginBottom: "8px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
          <button onClick={onClose} style={{ padding: "8px 16px" }}>Close</button>
          <button onClick={handleAdd} style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white" }}>Add Customer</button>
        </div>
      </div>
    </div>
  );
}

// ✅ Popup to select an existing customer
function ExistingCustomerPopup({ onClose, onSelect }) {
  const [search, setSearch] = useState("");
  const [customerList] = useState([
    { id: 1, firstName: "John", lastName: "Doe", address: "1 Street, Town, UK, AB1 2CD", email: "john@example.com", mobile: "07123456789", telephone: "0123456789" },
    { id: 2, firstName: "Jane", lastName: "Smith", address: "2 Avenue, City, UK, XY1 9YZ", email: "jane@example.com", mobile: "07234567890", telephone: "0987654321" },
  ]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const filteredList = search
    ? customerList.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()))
    : [];

  const handleAdd = () => {
    if (selectedCustomer) {
      onSelect(selectedCustomer);
      onClose();
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white", padding: "24px", borderRadius: "8px",
        width: "400px", maxHeight: "90vh", overflowY: "auto"
      }}>
        <h3>Select Existing Customer</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          style={{ width: "100%", marginBottom: "12px", padding: "6px" }}
        />
        {filteredList.length > 0 && (
          <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "12px" }}>
            {filteredList.map(c => (
              <div
                key={c.id}
                onClick={() => setSelectedCustomer(c)}
                style={{
                  padding: "8px",
                  cursor: "pointer",
                  backgroundColor: selectedCustomer?.id === c.id ? "#f0f0f0" : "white"
                }}
              >
                {c.firstName} {c.lastName}
              </div>
            ))}
          </div>
        )}
        {selectedCustomer && (
          <div style={{ marginBottom: "12px" }}>
            <p><strong>Name:</strong> {selectedCustomer.firstName} {selectedCustomer.lastName}</p>
            <p><strong>Address:</strong> {selectedCustomer.address}</p>
            <p><strong>Email:</strong> {selectedCustomer.email}</p>
            <p><strong>Mobile:</strong> {selectedCustomer.mobile}</p>
            <p><strong>Telephone:</strong> {selectedCustomer.telephone}</p>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={onClose} style={{ padding: "8px 16px" }}>Close</button>
          <button onClick={handleAdd} disabled={!selectedCustomer} style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white" }}>Add Customer</button>
        </div>
      </div>
    </div>
  );
}

// ✅ Popup to ask for check sheet or dealer car details
function CheckSheetPopup({ onClose, onAddCheckSheet, onAddDealerDetails }) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
    }}>
      <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", width: "400px" }}>
        <h3>Next Step</h3>
        <p>This job may require additional details. Choose an option:</p>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
          <button onClick={onClose} style={{ padding: "8px 16px" }}>Cancel</button>
          <button onClick={onAddCheckSheet} style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white" }}>Add Check Sheet</button>
          <button onClick={onAddDealerDetails} style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white" }}>Add Dealer Car Details</button>
        </div>
      </div>
    </div>
  );
}

export default function CreateJobCardPage() {
  const router = useRouter();
  const [jobNumber, setJobNumber] = useState(null);
  const [registration, setRegistration] = useState("");
  const [vsmData, setVsmData] = useState({ colour: "", make: "", model: "", chassis: "", engine: "" });
  const [customer, setCustomer] = useState(null);
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [showExistingPopup, setShowExistingPopup] = useState(false);
  const [showCheckSheetPopup, setShowCheckSheetPopup] = useState(false);
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState("");

  useEffect(() => {
    setJobNumber("JOB" + Math.floor(Math.random() * 1000000));
  }, []);

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

  if (!jobNumber) return <Layout><p>Generating Job Number...</p></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040" }}>Create Job Card: {jobNumber}</h1>

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
          />
        )}
      </div>
    </Layout>
  );
}
