// file location: src/components/JobCards/JobCardModal.js
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "../../context/UserContext"; // ✅ import user context to check login

export default function JobCardModal({ isOpen, onClose, existingJobs = [] }) {
  const router = useRouter();
  const { user } = useUser(); // ✅ access current user
  const [jobNumber, setJobNumber] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  // ✅ Redirect to login if not logged in
  useEffect(() => {
    if (isOpen && !user) {
      router.push("/api/auth/login"); // or your Keycloak dev login URL
      onClose(); // close popup while redirecting
    }
  }, [isOpen, user, router, onClose]);

  // ✅ Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current && user) {
      inputRef.current.focus();
      setJobNumber("");
      setError("");
    }
  }, [isOpen, user]);

  // ✅ Job number validation
  const isValidJobNumber = (num) => {
    const numVal = Number(num);
    return existingJobs.includes(numVal);
  };

  // ✅ Main Clock On button logic
  const handleClockOn = () => {
    const trimmedJob = jobNumber.trim();
    if (!trimmedJob) {
      setError("Please enter a job number");
      return;
    }
    if (!isValidJobNumber(trimmedJob)) {
      setError("Wrong job number or not accepted");
      return;
    }

    onClose(); // ✅ properly close modal
    router.push(`/job-cards/${jobNumber}`);
  };

  // ✅ Pressing Enter triggers Clock On
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleClockOn();
  };

  // ✅ Don’t render anything if modal isn’t open
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
      onClick={onClose} // ✅ click outside to close
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          width: "320px",
          textAlign: "center",
        }}
        onClick={(e) => e.stopPropagation()} // prevent backdrop click
      >
        <h2 style={{ marginBottom: "16px", color: "#FF4040" }}>
          Enter Job Number
        </h2>

        <input
          ref={inputRef}
          type="text"
          value={jobNumber}
          onChange={(e) => {
            setJobNumber(e.target.value);
            setError("");
          }}
          onKeyDown={handleKeyDown}
          placeholder="JOB NUMBER HERE"
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "16px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontSize: "1rem",
          }}
        />

        {error && (
          <p style={{ color: "red", marginBottom: "10px", fontSize: "0.9rem" }}>
            {error}
          </p>
        )}

        <button
          onClick={handleClockOn}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#FF4040",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Clock On
        </button>

        <button
          onClick={onClose} // ✅ properly closes modal
          style={{
            width: "100%",
            marginTop: "10px",
            padding: "10px",
            backgroundColor: "#ccc",
            color: "#333",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
