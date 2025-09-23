// file location: src/components/JobCards/JobCardModal.js
import React, { useState } from "react"; // React hooks
import styles from "./JobCardModal.module.css"; // Import CSS for styling (we'll create this next)

export default function JobCardModal({ isOpen, onClose }) {
  const [jobNumber, setJobNumber] = useState(""); // state for entered job number
  const [jobData, setJobData] = useState(null); // state for fetched job data
  const [error, setError] = useState(""); // state for errors

  // ✅ Mock database lookup
  const mockDatabase = {
    "12345": {
      jobNumber: "12345",
      vehicle: "Mitsubishi Outlander 2021",
      reg: "AB21 CDE",
      mileage: 15200,
      instructions: "Carry out 1st service",
      customer: "John Smith",
    },
    "67890": {
      jobNumber: "67890",
      vehicle: "Suzuki Swift 2019",
      reg: "XY19 ZZZ",
      mileage: 30500,
      instructions: "Investigate engine noise",
      customer: "Sarah Brown",
    },
  };

  // ✅ Lookup handler
  const handleLookup = () => {
    if (mockDatabase[jobNumber]) {
      setJobData(mockDatabase[jobNumber]); // set found data
      setError("");
    } else {
      setJobData(null);
      setError("Job not found, please try again.");
    }
  };

  if (!isOpen) return null; // Don’t render if modal is closed

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2>Enter Job Number</h2>
        <input
          type="text"
          value={jobNumber}
          onChange={(e) => setJobNumber(e.target.value)}
          placeholder="Enter job number"
          className={styles.input}
        />
        <button onClick={handleLookup} className={styles.button}>
          Lookup
        </button>
        <button onClick={onClose} className={styles.closeButton}>
          Close
        </button>

        {error && <p className={styles.error}>{error}</p>}

        {jobData && (
          <div className={styles.jobDetails}>
            <h3>Job Card</h3>
            <p><strong>Job Number:</strong> {jobData.jobNumber}</p>
            <p><strong>Customer:</strong> {jobData.customer}</p>
            <p><strong>Vehicle:</strong> {jobData.vehicle}</p>
            <p><strong>Reg:</strong> {jobData.reg}</p>
            <p><strong>Mileage:</strong> {jobData.mileage} miles</p>
            <p><strong>Instructions:</strong> {jobData.instructions}</p>
          </div>
        )}
      </div>
    </div>
  );
}