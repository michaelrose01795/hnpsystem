// file location: src/pages/job-cards/create/index.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";

// Small popup component for adding new customer
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
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          width: "400px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3>Add New Customer</h3>
        <label>First Name:</label>
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />
        <label>Last Name:</label>
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />
        <label>Number:</label>
        <input
          type="text"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />
        <label>Street:</label>
        <input
          type="text"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />
        <label>Town/City:</label>
        <input
          type="text"
          value={town}
          onChange={(e) => setTown(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />
        <label>Country:</label>
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />
        <label>Postcode:</label>
        <input
          type="text"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />
        <label>Email:</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />
        <label>Mobile:</label>
        <input
          type="text"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />
        <label>Telephone:</label>
        <input
          type="text"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
          <button onClick={onClose} style={{ padding: "8px 16px" }}>
            Close
          </button>
          <button
            onClick={handleAdd}
            style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white" }}
          >
            Add Customer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreateJobCardPage() {
  const router = useRouter();

  const [jobNumber, setJobNumber] = useState(null);
  useEffect(() => {
    setJobNumber("JOB" + Math.floor(Math.random() * 1000000));
  }, []);

  const [registration, setRegistration] = useState("");
  const [vsmData, setVsmData] = useState({
    colour: "",
    make: "",
    model: "",
    chassis: "",
    engine: "",
  });

  const [customer, setCustomer] = useState(null);
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);

  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState("");

  const handleAddRequest = () => {
    if (newRequest.trim() === "") return;
    setRequests([...requests, newRequest.trim()]);
    setNewRequest("");
  };

  // ✅ Submit job card to API
  const handleAddJobCard = async () => {
    if (!registration || !customer || requests.length === 0) {
      alert("Please fill in registration, customer, and at least one request.");
      return;
    }

    const jobData = { jobNumber, registration, vsmData, customer, requests };

    try {
      const res = await fetch("/api/jobcards/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData),
      });

      if (!res.ok) throw new Error("Failed to create job card");

      const data = await res.json();
      alert(`Job Card ${jobNumber} added successfully!`);
      router.push(`/job-cards/${jobNumber}`);
    } catch (err) {
      console.error(err);
      alert("Error adding job card");
    }
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

  if (!jobNumber) {
    return (
      <Layout>
        <p>Generating Job Number...</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        <h1 style={{ color: "#FF4040" }}>Create Job Card: {jobNumber}</h1>

        {/* Vehicle Details */}
        <div
          style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "24px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <h3>Vehicle Details</h3>
          <label>
            Registration:
            <input
              type="text"
              value={registration}
              onChange={(e) => setRegistration(e.target.value)}
              style={{ marginLeft: "8px", padding: "4px 8px" }}
            />
          </label>
          <button
            onClick={handleFetchVSM}
            style={{
              marginLeft: "12px",
              padding: "6px 12px",
              backgroundColor: "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            Fetch VSM
          </button>
          {vsmData.make && (
            <div style={{ marginTop: "12px" }}>
              <p>
                <strong>Make:</strong> {vsmData.make}
              </p>
              <p>
                <strong>Model:</strong> {vsmData.model}
              </p>
              <p>
                <strong>Colour:</strong> {vsmData.colour}
              </p>
              <p>
                <strong>Chassis Number:</strong> {vsmData.chassis}
              </p>
              <p>
                <strong>Engine Number:</strong> {vsmData.engine}
              </p>
            </div>
          )}
        </div>

        {/* Customer Details */}
        <div
          style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "24px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <h3>Customer Details</h3>
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <button
              onClick={() => setCustomer(null)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#FF4040",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Add Existing Customer
            </button>
            <button
              onClick={() => setShowCustomerPopup(true)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#FF4040",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Add New Customer
            </button>
          </div>
          {customer && (
            <div>
              <p>
                <strong>Name:</strong> {customer.firstName} {customer.lastName}
              </p>
              <p>
                <strong>Address:</strong> {customer.address}
              </p>
              <p>
                <strong>Email:</strong> {customer.email}
              </p>
              <p>
                <strong>Mobile:</strong> {customer.mobile}
              </p>
              <p>
                <strong>Telephone:</strong> {customer.telephone}
              </p>
            </div>
          )}
        </div>

        {/* Job Details */}
        <div
          style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "24px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <h3>Job Requests</h3>
          {requests.map((req, index) => (
            <p key={index}>
              <strong>Request {index + 1}:</strong> {req}
            </p>
          ))}
          <div style={{ display: "flex", marginTop: "12px", gap: "8px" }}>
            <input
              type="text"
              value={newRequest}
              onChange={(e) => setNewRequest(e.target.value)}
              placeholder="Enter request"
              style={{ flex: 1, padding: "4px 8px" }}
            />
            <button
              onClick={handleAddRequest}
              style={{
                padding: "6px 12px",
                backgroundColor: "#FF4040",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Add Line
            </button>
          </div>
        </div>

        <button
          onClick={handleAddJobCard}
          style={{
            padding: "12px 20px",
            backgroundColor: "#FF4040",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
          }}
        >
          Add Job Card
        </button>

        {showCustomerPopup && (
          <NewCustomerPopup
            onClose={() => setShowCustomerPopup(false)}
            onAdd={(data) => setCustomer(data)}
          />
        )}
      </div>
    </Layout>
  );
}
