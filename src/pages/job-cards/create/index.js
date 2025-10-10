// file location: src/pages/job-cards/create/index.js
"use client"; // must stay at the top

import React, { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import { useJobs } from "../../../context/JobsContext";
import JobCardModal from "../../../components/JobCards/JobCardModal";
import NewCustomerPopup from "../../../components/popups/NewCustomerPopup";
import ExistingCustomerPopup from "../../../components/popups/ExistingCustomerPopup";

// Local job number counter
let localJobCounter = 30000;

// Helper function to auto-detect job types from all requests
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
  const [showJobModal, setShowJobModal] = useState(false);

  // Job state
  const [requests, setRequests] = useState([{ text: "" }]);
  const [cosmeticNotes, setCosmeticNotes] = useState("");
  const [vhcRequired, setVhcRequired] = useState(false);
  const [jobNumber, setJobNumber] = useState(null);
  const [waitingStatus, setWaitingStatus] = useState("Neither");
  const [jobSource, setJobSource] = useState("Retail");
  const [jobCategories, setJobCategories] = useState(["Other"]);

  // Determine colour tag for waiting status (stored for later use)
  const getWaitingColor = (status) => {
    switch (status) {
      case "Waiting":
        return "red";
      case "Loan Car":
        return "blue";
      case "Collection":
        return "green";
      default:
        return "default";
    }
  };

  // Update job requests and re-run detection
  const handleRequestChange = (index, value) => {
    const updated = [...requests];
    updated[index].text = value;
    setRequests(updated);
    const allTexts = updated.map((r) => r.text);
    setJobCategories(detectJobTypes(allTexts));
  };

  // Add new request line
  const handleAddRequest = () => {
    setRequests([...requests, { text: "" }]);
  };

  // Remove a specific request line
  const handleRemoveRequest = (index) => {
    const updated = requests.filter((_, i) => i !== index);
    setRequests(updated);
    const allTexts = updated.map((r) => r.text);
    setJobCategories(detectJobTypes(allTexts));
  };

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
      requests: requests.map((r) => r.text),
      cosmeticNotes,
      vhcRequired,
      waitingStatus,
      waitingColor: getWaitingColor(waitingStatus),
      jobSource,
      jobCategories,
    };

    addJob(updatedJob);
    return currentJobNumber;
  };

  // Layout heights
  const sectionHeight = "260px";
  const jobDetailsHeight = "auto";
  const bottomRowHeight = "150px";

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
        {/* Top Section */}
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
            onClick={() => {
              const num = handleSaveUpdates();
              router.push(`/job-cards/${num}`);
            }}
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

        {/* Job Meta Info */}
        <div
          style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Job Information</h3>

          {/* Waiting Status */}
          <div style={{ marginBottom: "12px" }}>
            <strong style={{ width: "150px", display: "inline-block" }}>
              Customer Status:
            </strong>
            {["Waiting", "Loan Car", "Collection", "Neither"].map((status) => (
              <label key={status} style={{ marginRight: "12px" }}>
                <input
                  type="radio"
                  name="waiting"
                  value={status}
                  checked={waitingStatus === status}
                  onChange={() => setWaitingStatus(status)}
                />{" "}
                {status}
              </label>
            ))}
          </div>

          {/* Job Source */}
          <div style={{ marginBottom: "12px" }}>
            <strong style={{ width: "150px", display: "inline-block" }}>
              Job Source:
            </strong>
            {["Retail", "Warranty"].map((src) => (
              <label key={src} style={{ marginRight: "12px" }}>
                <input
                  type="radio"
                  name="source"
                  value={src}
                  checked={jobSource === src}
                  onChange={() => setJobSource(src)}
                />{" "}
                {src}
              </label>
            ))}
          </div>

          {/* Auto Job Types Display */}
          <div>
            <strong>Detected Job Types:</strong>{" "}
            {jobCategories.length > 0 ? (
              jobCategories.map((type, index) => (
                <span
                  key={index}
                  style={{
                    display: "inline-block",
                    marginRight: "8px",
                    backgroundColor: "#FF4040",
                    color: "white",
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                  }}
                >
                  {type}
                </span>
              ))
            ) : (
              <span style={{ color: "#777" }}>None detected</span>
            )}
          </div>
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
            <h3 style={{ marginTop: 0 }}>Vehicle Details</h3>
            <p><strong>Registration:</strong> {vehicle.reg}</p>
            <p><strong>Colour:</strong> {vehicle.colour}</p>
            <p><strong>Make & Model:</strong> {vehicle.makeModel}</p>
            <p><strong>Chassis Number:</strong> {vehicle.chassis}</p>
            <p><strong>Engine Number:</strong> {vehicle.engine}</p>
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
            <h3 style={{ marginTop: 0 }}>Customer Details</h3>
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
              <button onClick={() => setShowNewCustomer(true)} style={{ flex: 1 }}>New Customer</button>
              <button onClick={() => setShowExistingCustomer(true)} style={{ flex: 1 }}>Existing Customer</button>
            </div>
          </div>
        </div>

        {/* Job Requests Section */}
        <div
          style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Job Requests</h3>
          {requests.map((req, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #ddd",
                borderRadius: "6px",
                marginBottom: "12px",
                padding: "12px",
              }}
            >
              <strong>Request {i + 1}:</strong>
              <div style={{ marginLeft: "20px", marginTop: "6px" }}>
                <input
                  type="text"
                  value={req.text}
                  onChange={(e) => handleRequestChange(i, e.target.value)}
                  placeholder="Enter job request (e.g. MOT, Service, Diagnosis)"
                  style={{
                    width: "90%",
                    padding: "6px 8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                  }}
                />
                <button
                  onClick={() => handleRemoveRequest(i)}
                  style={{
                    marginLeft: "8px",
                    backgroundColor: "#FF4040",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    cursor: "pointer",
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
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            + Add Request
          </button>
        </div>

        {/* Bottom Row */}
        <div style={{ display: "flex", gap: "16px", height: bottomRowHeight }}>
          {/* Cosmetic Damage */}
          <div
            style={{
              flex: 1,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
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

          {/* VHC Button */}
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
            onClick={() => setShowVhcPopup(true)}
          >
            <h4>Add VHC</h4>
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
            onClick={() => alert("Full Car Details Coming Soon")}
          >
            <h4>Full Car Details</h4>
          </div>
        </div>

        {/* Popups */}
        {showJobModal && (
          <JobCardModal
            isOpen={showJobModal}
            onClose={() => setShowJobModal(false)}
            existingJobs={jobs.map((j) => j.jobNumber)}
          />
        )}
        {showNewCustomer && (
          <NewCustomerPopup
            onClose={() => setShowNewCustomer(false)}
            onSelect={(c) => {
              setCustomer(c);
              setShowNewCustomer(false);
            }}
          />
        )}
        {showExistingCustomer && (
          <ExistingCustomerPopup
            onClose={() => setShowExistingCustomer(false)}
            onSelect={(c) => {
              setCustomer(c);
              setShowExistingCustomer(false);
            }}
          />
        )}

        {/* VHC Popup */}
        {showVhcPopup && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "8px",
                width: "320px",
                textAlign: "center",
              }}
            >
              <h3>Add VHC to this job?</h3>
              <div
                style={{ display: "flex", justifyContent: "space-around", marginTop: "16px" }}
              >
                <label>
                  <input
                    type="radio"
                    name="vhc"
                    value="yes"
                    onChange={() => setVhcRequired(true)}
                    checked={vhcRequired === true}
                  />{" "}
                  Yes
                </label>
                <label>
                  <input
                    type="radio"
                    name="vhc"
                    value="no"
                    onChange={() => setVhcRequired(false)}
                    checked={vhcRequired === false}
                  />{" "}
                  No
                </label>
              </div>
              <button
                onClick={() => setShowVhcPopup(false)}
                style={{
                  marginTop: "16px",
                  padding: "8px 16px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
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