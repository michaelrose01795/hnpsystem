// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/JobCards/JobCardModal.js

import React, { useState, useRef, useEffect } from "react"; // React hooks for state/effects/refs
import { useRouter } from "next/router"; // Next.js router for navigation
import { useUser } from "@/context/UserContext"; // Custom user context (dev auth user)
import { useConfirmation } from "@/context/ConfirmationContext";
import {
  // Job clocking functions to start/stop time on jobs
  clockInToJob,
  clockOutFromJob,
  getUserActiveJobs
} from "@/lib/database/jobClocking"; // DB: job clocking
import { getAllJobs } from "@/lib/database/jobs"; // DB: fetch list of jobs
import { ensureDevDbUserAndGetId } from "@/lib/users/devUsers";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";

/* -------------------------- UI COMPONENT -------------------------- */

export default function JobCardModal({ isOpen, onClose, prefilledJobNumber = "" }) { // Main modal component - now accepts prefilledJobNumber prop
  const router = useRouter(); // Router for page navigation
  const { user, setStatus, refreshCurrentJob, setCurrentJob } = useUser(); // Dev auth user & helpers from context
  const { confirm } = useConfirmation();
  const [jobNumber, setJobNumber] = useState(""); // Input state for job number
  const [error, setError] = useState(""); // Error banner text
  const [loading, setLoading] = useState(false); // Loading flag

  const [dbUserId, setDbUserId] = useState(null); // ✅ Real DB users.user_id (integer)
  const [activeJobs, setActiveJobs] = useState([]); // Jobs currently clocked into
  const [availableJobs, setAvailableJobs] = useState([]); // Jobs that can be clocked into
  const [showAvailableJobs, setShowAvailableJobs] = useState(false); // Toggle listing section
  const [workType, setWorkType] = useState("initial"); // "initial" or "additional"
  const [searchTerm, setSearchTerm] = useState(""); // Filter text for lists
  const inputRef = useRef(null); // Ref for auto-focus on input

  // ✅ Prefill job number when modal opens with a job selected
  useEffect(() => {
    if (isOpen && prefilledJobNumber) {
      setJobNumber(prefilledJobNumber); // Prefill the job number input
      inputRef.current?.focus(); // Focus the input for immediate action
    }
  }, [isOpen, prefilledJobNumber]); // Run when modal opens or prefilled job changes

  // Normalize various job object shapes into a single predictable shape
  const normaliseJob = (j) => ({ // Convert DB/job list rows to a standard object
    id: j?.id ?? j?.job_id ?? j?.jobId ?? null, // Numeric jobs.id
    jobNumber:
      j?.jobNumber ?? j?.job_number ?? j?.jobnumber ?? j?.jobNo ?? "", // Human code like 00001
    reg:
      j?.vehicle_reg ??
      j?.reg ??
      j?.vehicle?.registration ??
      j?.vehicle?.reg_number ??
      "", // Registration
    makeModel:
      j?.vehicle_make_model ??
      j?.makeModel ??
      j?.vehicle?.make_model ??
      "", // Make/model text
    customer:
      j?.customer ??
      (j?.vehicle?.customer
        ? `${j.vehicle.customer.firstname ?? ""} ${j.vehicle.customer.lastname ?? ""}`.trim()
        : ""), // Customer name
    status: j?.status ?? "New" // Status fallback
  });

  // Redirect to login if not logged in
  useEffect(() => {
    if (isOpen && !user) { // If modal opens without a user
      router.push("/login"); // Navigate to login page
      onClose(); // Close modal to prevent interaction
    }
  }, [isOpen, user, router, onClose]); // Dependencies for this effect

  // When modal opens and we have a user, ensure DB user exists and load data
  useEffect(() => {
    if (!isOpen || !user) return; // Only run when open and we have a dev user

    let mounted = true; // Guard to avoid state updates after unmount

    (async () => { // Async IIFE
      try {
        setLoading(true); // Start loader
        setError(""); // Clear any prior error

        // ✅ DEV: Ensure a users row exists and get integer user_id (no email needed)
        const realId = await ensureDevDbUserAndGetId(user); // Create/find users row
        if (!mounted) return; // Stop if unmounted
        setDbUserId(realId); // Save integer users.user_id

        // Fetch active jobs for this DB user
        const act = await getUserActiveJobs(realId); // Query open clock-ins
        if (act.success) setActiveJobs(act.data); // Put into state

        // Fetch all jobs, keep only active ones, normalize shape
        const allJobsRaw = await getAllJobs(); // Fetch jobs list
        const allJobs = Array.isArray(allJobsRaw) ? allJobsRaw : []; // Safe array
        const activeOnly = allJobs
          .filter(
            (job) =>
              !["Complete", "Completed", "Invoiced", "Collected", "Cancelled"].includes(
                job?.status
              )
          ) // Keep only non-completed jobs
          .map(normaliseJob); // Normalize per UI
        setAvailableJobs(activeOnly); // Save available jobs
      } catch (e) {
        console.error("ensureDevDbUserAndGetId/load error:", e); // Log any failure
        setError(e.message || "Failed to prepare your account for clocking"); // Show message
      } finally {
        if (mounted) setLoading(false); // Stop loader
      }
    })();

    return () => {
      mounted = false; // Cleanup flag
    };
  }, [isOpen, user]); // Re-run when opening modal or user changes

  // Handle pressing Enter in the job number input
  const handleKeyDown = (e) => { // Key handler for input
    if (e.key === "Enter" && !loading) { // If Enter and not loading
      handleClockIn(); // Trigger clock in
    }
  };

  // Attempt to clock into the job typed/selected
  const handleClockIn = async () => { // Start work on a job
    const trimmed = jobNumber.trim(); // Clean input
    if (!trimmed) { // Guard empty
      setError("Please enter a job number"); // Prompt
      return; // Stop
    }
    if (dbUserId == null) { // Must have integer users.user_id
      setError("Could not resolve your workshop user id. Please reopen this modal."); // Helpful text
      return; // Stop
    }

    setLoading(true); // Start loader
    setError(""); // Clear message

    try {
      // Find job by code or by numeric id typed
      const job = availableJobs.find(
        (j) =>
          j.jobNumber?.toString().toLowerCase() === trimmed.toLowerCase() ||
          j.id?.toString() === trimmed
      ); // Filter list
      if (!job) { // If no match
        setError("Job not found or already completed"); // Inform user
        setLoading(false); // Stop loader
        return; // Stop
      }
      if (!Number.isInteger(Number(job.id))) { // Safety: ID must be integer
        setError("Selected job does not have a valid numeric ID."); // Inform
        setLoading(false); // Stop loader
        return; // Stop
      }

      // Do the clock-in with real integer ids
      const res = await clockInToJob(dbUserId, Number(job.id), job.jobNumber, workType); // Call DB
      if (res.success) { // If OK
        setStatus("In Progress"); // Reflect active work in status bar
        await refreshCurrentJob(); // Keep context in sync with active job
        onClose(); // Close modal
        router.push(`/job-cards/myjobs/${job.jobNumber}`); // Navigate to tech's job page
      } else {
        setError(res.error || "Failed to clock in"); // Show DB error
      }
    } catch (e) {
      console.error("Clock-in error:", e); // Log
      setError(e.message || "Error clocking in. Please try again."); // UI message
    } finally {
      setLoading(false); // Stop loader
    }
  };

  // Clock out from a specific job
  const handleClockOut = async (jobId, jobNumText, clockingId) => { // Finish work on a job
    if (dbUserId == null) { // Ensure user id exists
      setError("Could not resolve your workshop user id. Please reopen this modal."); // Message
      return; // Stop
    }
    const ok = await confirm(`Clock out from Job ${jobNumText}?`); // Confirm action
    if (!ok) return; // Cancelled

    setLoading(true); // Start loader
    try {
      const res = await clockOutFromJob(dbUserId, jobId, clockingId); // Call DB
      if (res.success) { // If OK
        alert(`✅ Clocked out from Job ${jobNumText}\n\nHours worked: ${res.hoursWorked}h`); // Show hours
        setCurrentJob(null); // Immediately clear cached current job
        const nextJob = await refreshCurrentJob(); // Sync active job state
        if (!nextJob) {
          setStatus("Waiting for Job"); // Return to waiting status when free
        }
        await fetchData(); // Refresh lists
      } else {
        setError(res.error || "Failed to clock out"); // Show DB error
      }
    } catch (e) {
      console.error("Clock-out error:", e); // Log
      setError(e.message || "Error clocking out. Please try again."); // UI message
    } finally {
      setLoading(false); // Stop loader
    }
  };

  // Re-usable loader after clock-out
  const fetchData = async () => { // Refresh active/available lists
    if (dbUserId == null) return; // Only run when mapped
    setLoading(true); // Start loader
    setError(""); // Clear
    try {
      const act = await getUserActiveJobs(dbUserId); // Active clock-ins
      if (act.success) setActiveJobs(act.data); // Save
      const raw = await getAllJobs(); // All jobs
      const all = Array.isArray(raw) ? raw : []; // Safe array
      const list = all
        .filter(
          (job) =>
            !["Complete", "Completed", "Invoiced", "Collected", "Cancelled"].includes(
              job?.status
            )
        ) // Keep active
        .map(normaliseJob); // Normalize
      setAvailableJobs(list); // Save
    } catch (e) {
      console.error("Fetch data error:", e); // Log
      setError("Failed to load jobs"); // UI message
    } finally {
      setLoading(false); // Stop loader
    }
  };

  // Selecting a job from the list populates the input
  const handleSelectJob = (job) => { // Choose from list
    setJobNumber(job.jobNumber); // Set input
    setShowAvailableJobs(false); // Hide list
    inputRef.current?.focus(); // Refocus input
  };

  // ✅ NEW: Handle clicking on active job - navigate to job page
  const handleActiveJobClick = (job) => {
    onClose(); // Close modal
    router.push(`/job-cards/myjobs/${job.jobNumber}`); // Navigate to tech's job detail page
  };

  // Filter the list by search term
  const filteredJobs = availableJobs.filter((job) => { // Apply search filter
    if (!searchTerm.trim()) return true; // Show all if empty
    const q = searchTerm.toLowerCase(); // Lowercase query
    return (
      job.jobNumber?.toString().toLowerCase().includes(q) || // Match by code
      job.reg?.toLowerCase().includes(q) || // By reg
      job.customer?.toLowerCase().includes(q) || // By customer
      job.makeModel?.toLowerCase().includes(q) // By make/model
    );
  });

  if (!isOpen) return null; // Do not render when closed

  return (
    <div
      style={{
        ...popupOverlayStyles,
        padding: "20px",
      }}
      onClick={onClose} // Click backdrop to close
    >
      <div
        style={{
          ...popupCardStyles,
          width: "100%", // Responsive
          maxWidth: "600px", // Max width
          maxHeight: "90vh", // Constrain height
          overflowY: "auto", // Scroll content
          padding: "24px", // Inner spacing
          borderRadius: "20px",
        }}
        onClick={(e) => e.stopPropagation()} // Prevent overlay close when clicking inside
      >
        <h2
          style={{
            marginBottom: "20px", // Space under heading
            color: "var(--primary)", // Red brand accent
            fontSize: "24px", // Large title
            fontWeight: "700", // Bold
            textAlign: "center" // Centered
          }}
        >
          🔧 Start Job
        </h2>

        {/* Active clock-ins */}
        {activeJobs.length > 0 && (
          <div
            style={{
              marginBottom: "24px", // Space below
              padding: "16px", // Inner padding
              backgroundColor: "var(--surface-light)", // Light red bg
              borderRadius: "8px", // Rounded
              border: "2px solid var(--primary)" // Accent border
            }}
          >
            <h3
              style={{
                fontSize: "16px", // Heading size
                fontWeight: "600", // Bold
                color: "var(--primary)", // Accent
                marginBottom: "12px" // Space under
              }}
            >
              Currently Working On:
            </h3>

            {activeJobs.map((job) => (
              <div
                key={job.clockingId} // List key
                onClick={() => handleActiveJobClick(job)} // ✅ NEW: Click to navigate to job
                style={{
                  display: "flex", // Row
                  justifyContent: "space-between", // Space between cols
                  alignItems: "center", // Vertically center
                  padding: "12px", // Inner spacing
                  backgroundColor: "var(--surface)", // Card bg
                  borderRadius: "6px", // Rounded
                  marginBottom: "8px", // Gap between items
                  cursor: "pointer", // ✅ NEW: Show it's clickable
                  transition: "all 0.2s", // ✅ NEW: Smooth hover effect
                  border: "1px solid transparent" // ✅ NEW: Invisible border for hover
                }}
                onMouseEnter={(e) => { // ✅ NEW: Hover effect
                  e.currentTarget.style.backgroundColor = "var(--surface)";
                  e.currentTarget.style.borderColor = "var(--primary)";
                }}
                onMouseLeave={(e) => { // ✅ NEW: Remove hover effect
                  e.currentTarget.style.backgroundColor = "white";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <div style={{ flex: 1 }}> {/* Left column */}
                  <div
                    style={{
                      fontWeight: "600", // Bold
                      color: "var(--primary)", // Accent
                      marginBottom: "4px" // Tight spacing
                    }}
                  >
                    Job {job.jobNumber} - {job.reg} {/* Job label */}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}> {/* Meta */}
                    {job.makeModel} • {job.hoursWorked}h worked {/* Info */}
                  </div>
                </div>

                <button
                  onClick={(e) => { // ✅ Prevent parent click when clicking clock out
                    e.stopPropagation();
                    handleClockOut(job.jobId, job.jobNumber, job.clockingId);
                  }}
                  disabled={loading || dbUserId == null} // Disable if busy or unmapped
                style={{
                  padding: "8px 16px", // Button padding
                  backgroundColor: loading ? "var(--background)" : "var(--danger)", // Grey when loading
                  color: "white", // Text colour
                  border: "none", // No border
                  borderRadius: "6px", // Rounded
                  cursor: loading || dbUserId == null ? "not-allowed" : "pointer", // Cursor state
                  fontSize: "13px", // Font size
                  fontWeight: "600", // Bold
                  transform: "none" // Keep hit target aligned
                }}
              >
                Clock Out {/* Button label */}
              </button>
              </div>
            ))}
          </div>
        )}

        {/* Manual Entry */}
        <div style={{ marginBottom: "20px" }}> {/* Entry section */}
          <label
            style={{
              display: "block", // Own line
              marginBottom: "8px", // Gap below
              fontSize: "14px", // Label size
              fontWeight: "600", // Bold
              color: "var(--text-secondary)" // Text colour
            }}
          >
            Enter Job Number: {/* Label text */}
          </label>

          <input
            ref={inputRef} // For focus
            type="text" // Text input
            value={jobNumber} // Controlled value
            onChange={(e) => {
              setJobNumber(e.target.value); // Update input
              setError(""); // Clear errors when typing
            }}
            onKeyDown={handleKeyDown} // Enter handler
            placeholder="e.g., 00001" // Example format
            disabled={loading} // Disable when loading
            style={{
              width: "100%", // Full width
              padding: "12px", // Comfortable size
              marginBottom: "12px", // Gap below
              borderRadius: "6px", // Rounded
              border: "1px solid var(--surface-light)", // Subtle border
              fontSize: "16px", // Readable size
              outline: "none" // No outline
            }}
          />

          {/* Work type selector */}
          <select
            value={workType} // Current value
            onChange={(e) => setWorkType(e.target.value)} // Update
            disabled={loading} // Disable when loading
            style={{
              width: "100%", // Full width
              padding: "12px", // Padding
              marginBottom: "12px", // Gap
              borderRadius: "6px", // Rounded
              border: "1px solid var(--surface-light)", // Subtle border
              fontSize: "14px", // Text size
              cursor: "pointer" // Pointer cursor
            }}
          >
            <option value="initial">Initial Work</option> {/* Default */}
            <option value="additional">Additional Work</option> {/* Extra */}
          </select>

          {/* Error banner */}
          {error && (
            <p
              style={{
                color: "var(--danger)", // Red text
                marginBottom: "12px", // Gap
                fontSize: "14px", // Size
                padding: "8px", // Inner padding
                backgroundColor: "var(--danger-surface)", // Light bg
                borderRadius: "4px" // Rounded
              }}
            >
              ⚠️ {error} {/* Error message */}
            </p>
          )}

          <button
            onClick={handleClockIn} // Start clocking
            disabled={loading || !jobNumber.trim() || dbUserId == null} // Disable until ready
            style={{
              width: "100%", // Full width
              padding: "12px", // Button padding
              backgroundColor:
                loading || !jobNumber.trim() || dbUserId == null ? "var(--background)" : "var(--primary)", // Grey when disabled
              color: "white", // Text colour
              border: "none", // No border
              borderRadius: "6px", // Rounded
              fontWeight: "600", // Bold
              fontSize: "16px", // Size
              cursor:
                loading || !jobNumber.trim() || dbUserId == null ? "not-allowed" : "pointer", // Cursor
              transition: "background-color 0.2s", // Smooth hover
              transform: "none" // Prevent hover shift offset
            }}
          >
            {loading ? "Clocking In..." : "⏱️ Clock In"} {/* Label */}
          </button>
        </div>

        {/* Toggle available jobs */}
        <div style={{ marginBottom: "16px" }}> {/* Toggle area */}
          <button
            onClick={() => setShowAvailableJobs(!showAvailableJobs)} // Show/hide list
            disabled={loading} // Disable when busy
            style={{
              width: "100%", // Full width
              padding: "10px", // Padding
              backgroundColor: showAvailableJobs ? "var(--primary)" : "var(--surface)", // Accent when open
              color: showAvailableJobs ? "white" : "var(--grey-accent)", // Contrast
              border: "1px solid var(--surface-light)", // Border
              borderRadius: "6px", // Rounded
              cursor: "pointer", // Pointer
              fontSize: "14px", // Size
              fontWeight: "600", // Bold
              transform: "none" // Prevent hover offset
            }}
          >
            {showAvailableJobs ? "Hide Available Jobs" : "Show Available Jobs"} {/* Toggle text */}
          </button>
        </div>

        {/* Available jobs list */}
        {showAvailableJobs && (
          <div> {/* List container */}
            <input
              type="search" // Search input
              placeholder="🔍 Search jobs..." // Hint
              value={searchTerm} // Controlled value
              onChange={(e) => setSearchTerm(e.target.value)} // Update
              style={{
                width: "100%", // Full width
                padding: "10px", // Padding
                marginBottom: "12px", // Gap
                borderRadius: "6px", // Rounded
                border: "1px solid var(--search-surface-muted)", // Border
                fontSize: "14px", // Size
                outline: "none",
                backgroundColor: "var(--search-surface)",
                color: "var(--search-text)"
              }}
            />

            <div
              style={{
                maxHeight: "300px", // Scroll area height
                overflowY: "auto", // Vertical scroll
                border: "1px solid var(--surface-light)", // Border
                borderRadius: "6px" // Rounded
              }}
            >
              {filteredJobs.length === 0 ? ( // No results
                <div
                  style={{
                    padding: "20px", // Inner padding
                    textAlign: "center", // Center text
                    color: "var(--grey-accent-light)" // Muted
                  }}
                >
                  No jobs found {/* Empty state */}
                </div>
              ) : (
                filteredJobs.map((job) => ( // Render list
                  <div
                    key={`${job.id}-${job.jobNumber}`} // Unique key
                    onClick={() => handleSelectJob(job)} // Choose job
                    style={{
                      padding: "12px", // Row padding
                      borderBottom: "1px solid var(--surface)", // Divider
                      cursor: "pointer", // Clickable
                      transition: "background-color 0.2s" // Smooth hover
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--info-surface)")} // Hover in
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")} // Hover out
                  >
                    <div
                      style={{
                        fontWeight: "600", // Bold
                        color: "var(--primary)", // Accent
                        marginBottom: "4px" // Gap
                      }}
                    >
                      Job {job.jobNumber} - {job.reg} {/* Job label */}
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--grey-accent)" }}> {/* Meta */}
                      {job.makeModel} • {job.customer} {/* Info */}
                    </div>
                    <div
                      style={{
                        fontSize: "12px", // Small
                        color: "var(--grey-accent-light)", // Muted
                        marginTop: "4px" // Gap
                      }}
                    >
                      Status: {job.status} {/* Status */}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Cancel button */}
        <button
          onClick={onClose} // Close modal
          disabled={loading} // Disable when busy
          style={{
            width: "100%", // Full width
            marginTop: "16px", // Gap
            padding: "10px", // Padding
            backgroundColor: "var(--surface)", // Neutral bg
            color: "var(--grey-accent)", // Muted text
            border: "none", // No border
            borderRadius: "6px", // Rounded
            fontWeight: "600", // Bold
            cursor: loading ? "not-allowed" : "pointer", // Cursor state
            transform: "none" // Prevent hover offset
          }}
        >
          Cancel {/* Label */}
        </button>
      </div>
    </div>
  );
}
