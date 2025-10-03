// file location: src/pages/job-cards/create/index.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useJobs } from "../../../context/JobsContext";

// ✅ Import popups
import NewCustomerPopup from "../../../components/popups/NewCustomerPopup";
import ExistingCustomerPopup from "../../../components/popups/ExistingCustomerPopup";
import CheckSheetPopup from "../../../components/popups/CheckSheetPopup";

// ✅ Local job number counter
let localJobCounter = 30000;

export default function CreateJobCardPage() {
  const router = useRouter();
  const { addJob } = useJobs();

  // Vehicle data state
  const [vehicle, setVehicle] = useState({
    reg: "",
    colour: "",
    makeModel: "",
    chassis: "",
    engine: "",
    mileage: "",
  });

  // Customer & job data
  const [customer, setCustomer] = useState(null);
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState("");
  const [cosmeticNotes, setCosmeticNotes] = useState("");

  // Popup states
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showExistingCustomer, setShowExistingCustomer] = useState(false);
  const [showCheckSheet, setShowCheckSheet] = useState(false);

  // Dummy fetch for vehicle data
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

  // Add request
  const handleAddRequest = () => {
    if (!newRequest.trim()) return;
    setRequests([...requests, newRequest.trim()]);
    setNewRequest("");
  };

  // Create job
  const handleCreateJob = () => {
    if (!vehicle.reg || !customer || requests.length === 0) {
      alert("Please fill in registration, customer, and at least one request.");
      return;
    }
    localJobCounter++;
    const newJob = {
      jobNumber: localJobCounter,
      vehicle,
      customer,
      requests,
      cosmeticNotes,
    };
    addJob(newJob);
    setShowCheckSheet(true);
  };

  // CheckSheet actions
  const handleAddCheckSheet = () => {
    setShowCheckSheet(false);
    router.push(`/job-cards/${localJobCounter}/add-checksheet`);
  };
  const handleAddDealerDetails = () => {
    setShowCheckSheet(false);
    router.push(`/job-cards/${localJobCounter}/dealer-car-details`);
  };
  const handleAddAppointment = () => {
    setShowCheckSheet(false);
    router.push(`/appointments?jobNumber=${localJobCounter}`);
  };

  // Layout heights
  const sectionHeight = "250px";

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#555" }}>Retail / Sales / Warranty</h2>
            <h1 style={{ color: "#FF4040", margin: 0 }}>Create New Job Card</h1>
          </div>
          <button
            onClick={handleCreateJob}
            style={{
              padding: "12px 20px",
              backgroundColor: "green",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "1rem",
            }}
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
            }}
          >
            <h3>Vehicle Details</h3>
            <input
              placeholder="Registration"
              value={vehicle.reg}
              onChange={(e) => setVehicle({ ...vehicle, reg: e.target.value })}
              style={{ width: "100%", padding: "6px", marginBottom: "8px" }}
            />
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
                  onChange={(e) => setVehicle({ ...vehicle, mileage: e.target.value })}
                  placeholder="Enter miles"
                  style={{ marginLeft: "8px", padding: "4px 8px", width: "100px" }}
                />
              </label>
            </div>
            <button
              onClick={handleFetchVSM}
              style={{
                marginTop: "12px",
                padding: "6px 12px",
                backgroundColor: "#FF4040",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
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
            }}
          >
            <h3>Customer Details</h3>
            {customer ? (
              <>
                <p>
                  <strong>Name:</strong> {customer.firstName} {customer.lastName}
                </p>
                <p><strong>Address:</strong> {customer.address}</p>
                <p><strong>Email:</strong> {customer.email}</p>
                <p><strong>Phone:</strong> {customer.mobile || customer.telephone}</p>
              </>
            ) : (
              <p>No customer selected</p>
            )}
            <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowNewCustomer(true)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                New Customer
              </button>
              <button
                onClick={() => setShowExistingCustomer(true)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Existing Customer
              </button>
            </div>
          </div>
        </div>

        {/* Job Requests */}
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "24px" }}>
          <h3>Customer Requests</h3>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <input
              placeholder="Add a request..."
              value={newRequest}
              onChange={(e) => setNewRequest(e.target.value)}
              style={{ flex: 1, padding: "8px" }}
            />
            <button
              onClick={handleAddRequest}
              style={{
                padding: "8px 16px",
                backgroundColor: "#FF4040",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Add
            </button>
          </div>
          <ul>
            {requests.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        {/* Cosmetic Notes */}
        <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          <h3>Cosmetic Notes</h3>
          <textarea
            placeholder="Enter any cosmetic or visual notes..."
            value={cosmeticNotes}
            onChange={(e) => setCosmeticNotes(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: "8px" }}
          />
        </div>
      </div>

      {/* Popups */}
      {showNewCustomer && (
        <NewCustomerPopup onClose={() => setShowNewCustomer(false)} onAdd={(c) => setCustomer(c)} />
      )}
      {showExistingCustomer && (
        <ExistingCustomerPopup onClose={() => setShowExistingCustomer(false)} onSelect={(c) => setCustomer(c)} />
      )}
      {showCheckSheet && (
        <CheckSheetPopup
          onClose={() => setShowCheckSheet(false)}
          onAddCheckSheet={handleAddCheckSheet}
          onAddDealerDetails={handleAddDealerDetails}
          onAddAppointment={handleAddAppointment}
        />
      )}
    </Layout>
  );
}
