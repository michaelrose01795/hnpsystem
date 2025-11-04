// file location: src/components/JobCards/JobCardModal.js

import React, { useState, useRef, useEffect } from "react"; // React hooks for state/effects/refs
import { useRouter } from "next/router"; // Next.js router for navigation
import { useUser } from "../../context/UserContext"; // Custom user context (dev auth user)
import { // Job clocking functions to start/stop time on jobs
  clockInToJob,
  clockOutFromJob,
  getUserActiveJobs
} from "../../lib/database/jobClocking"; // DB: job clocking
import { getAllJobs } from "../../lib/database/jobs"; // DB: fetch list of jobs
import { supabase } from "../../lib/supabaseClient"; // Supabase client for direct queries
import { usersByRole } from "../../config/users"; // 🔧 Dev-only roster to infer roles

/* -------------------------- DEV HELPERS (no emails) -------------------------- */

// Slugify a display name for a fake email like "michael-rose@dev.local"
const slugify = (txt) => // Make a lowercase, hyphenated slug
  String(txt || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

// Try to infer a role from your usersByRole config using the display name
const inferRoleFromRoster = (displayName) => { // Map display name → role if found
  if (!displayName) return "Technician"; // Default if no name available
  const norm = displayName.toLowerCase().replace(/\s+/g, " ").trim(); // Normalize spaces
  for (const [role, names] of Object.entries(usersByRole)) { // Iterate roles
    for (const n of names) { // Iterate names under that role
      const comp = String(n).toLowerCase().replace(/\s+/g, " ").trim(); // Normalize roster name
      if (comp === norm) return role; // Exact match
      // Looser match: remove brackets or notes like "Jake (tech) - when Russel off"
      const softComp = comp.replace(/\(.*?\)/g, "").replace(/\s-\s.*$/, "").trim(); // Remove () and trailing notes
      const softNorm = norm.replace(/\(.*?\)/g, "").replace(/\s-\s.*$/, "").trim(); // Same for user
      if (softComp && softComp === softNorm) return role; // Soft match
      // Final loose: substring containment for awkward roster entries
      if (softComp && (softComp.includes(softNorm) || softNorm.includes(softComp))) return role; // Contains
    }
  }
  return "Technician"; // Fallback role if not found
};

// Split a display name into first/last to populate users table
const splitName = (displayName) => { // Break full name into first and last parts
  const safe = String(displayName || "").trim(); // Ensure string
  if (!safe) return { first: "Dev", last: "User" }; // Fallback names
  const parts = safe.split(/\s+/); // Split by spaces
  if (parts.length === 1) return { first: parts[0], last: "" }; // Single token → first only
  return { first: parts[0], last: parts.slice(1).join(" ") }; // First token + remainder
};

// Ensure there is a row in public.users for this dev user, return integer user_id
const ensureDevDbUserAndGetId = async (devUser) => { // Build/find users row for dev auth
  // Work out a display name from possible fields on your dev user object
  const displayName =
    devUser?.name ||
    devUser?.fullName ||
    devUser?.displayName ||
    devUser?.username ||
    `Tech-${devUser?.id || "dev"}`; // Fallback to Tech-<id>

  // Create a deterministic synthetic email that satisfies NOT NULL on users.email
  const fakeEmail = `${slugify(displayName)}@dev.local`; // e.g. "michael@dev.local"

  // Choose a role based on your roster; fallback to "Technician"
  const role = inferRoleFromRoster(displayName); // Map name → role

  // Try to find an existing users row by this fake email
  const { data: existing, error: findErr } = await supabase
    .from("users") // Users table
    .select("user_id, email, role") // Columns we need
    .eq("email", fakeEmail) // Match by synthetic email
    .limit(1) // Only one row
    .maybeSingle(); // 0 or 1 row

  if (findErr && findErr.code !== "PGRST116") { // Ignore "no rows" sentinel
    throw findErr; // Real error
  }

  if (existing?.user_id != null) { // If it already exists
    // Optionally keep the role in sync with roster
    if (existing.role !== role) { // If role changed
      await supabase.from("users").update({ role }).eq("user_id", existing.user_id); // Update role
    }
    return existing.user_id; // Return integer PK
  }

  // If not found, insert a new users row
  const { first, last } = splitName(displayName); // Compute first/last
  const { data: inserted, error: insErr } = await supabase
    .from("users") // Users table
    .insert([
      {
        first_name: first, // First name
        last_name: last, // Last name
        email: fakeEmail, // Synthetic email to satisfy NOT NULL
        password_hash: "external_auth", // Harmless sentinel (schema requires NOT NULL)
        role, // Role from roster or default
        phone: null // Optional phone
      }
    ])
    .select("user_id") // Return PK
    .single(); // Single row

  if (insErr) throw insErr; // Bubble insert error

  return inserted.user_id; // Integer PK returned
};

/* -------------------------- UI COMPONENT -------------------------- */

export default function JobCardModal({ isOpen, onClose, prefilledJobNumber = "" }) { // Main modal component - now accepts prefilledJobNumber prop
  const router = useRouter(); // Router for page navigation
  const { user } = useUser(); // Dev auth user from context
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
      j?.jobNumber ?? j?.job_number ?? j?.jobnumber ?? j?.jobNo ?? "", // Human code like JOB-2025-014
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
  const handleClockOut = async (jobId, jobNumText) => { // Finish work on a job
    if (dbUserId == null) { // Ensure user id exists
      setError("Could not resolve your workshop user id. Please reopen this modal."); // Message
      return; // Stop
    }
    const ok = confirm(`Clock out from Job ${jobNumText}?`); // Confirm action
    if (!ok) return; // Cancelled

    setLoading(true); // Start loader
    try {
      const res = await clockOutFromJob(dbUserId, jobId); // Call DB
      if (res.success) { // If OK
        alert(`✅ Clocked out from Job ${jobNumText}\n\nHours worked: ${res.hoursWorked}h`); // Show hours
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
        position: "fixed", // Full-screen overlay
        inset: 0, // Cover viewport
        backgroundColor: "rgba(0,0,0,0.6)", // Dim backdrop
        display: "flex", // Center content
        justifyContent: "center", // Horizontally centered
        alignItems: "center", // Vertically centered
        zIndex: 1000, // On top
        padding: "20px" // Page padding
      }}
      onClick={onClose} // Click backdrop to close
    >
      <div
        style={{
          backgroundColor: "white", // Modal card
          padding: "24px", // Inner spacing
          borderRadius: "12px", // Rounded corners
          width: "100%", // Responsive
          maxWidth: "600px", // Max width
          maxHeight: "90vh", // Constrain height
          overflowY: "auto", // Scroll content
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)" // Shadow
        }}
        onClick={(e) => e.stopPropagation()} // Prevent overlay close when clicking inside
      >
        <h2
          style={{
            marginBottom: "20px", // Space under heading
            color: "#FF4040", // Red brand accent
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
              backgroundColor: "#fff5f5", // Light red bg
              borderRadius: "8px", // Rounded
              border: "2px solid #FF4040" // Accent border
            }}
          >
            <h3
              style={{
                fontSize: "16px", // Heading size
                fontWeight: "600", // Bold
                color: "#FF4040", // Accent
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
                  backgroundColor: "white", // Card bg
                  borderRadius: "6px", // Rounded
                  marginBottom: "8px", // Gap between items
                  cursor: "pointer", // ✅ NEW: Show it's clickable
                  transition: "all 0.2s", // ✅ NEW: Smooth hover effect
                  border: "1px solid transparent" // ✅ NEW: Invisible border for hover
                }}
                onMouseEnter={(e) => { // ✅ NEW: Hover effect
                  e.currentTarget.style.backgroundColor = "#f9f9f9";
                  e.currentTarget.style.borderColor = "#FF4040";
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
                      color: "#FF4040", // Accent
                      marginBottom: "4px" // Tight spacing
                    }}
                  >
                    Job {job.jobNumber} - {job.reg} {/* Job label */}
                  </div>
                  <div style={{ fontSize: "13px", color: "#666" }}> {/* Meta */}
                    {job.makeModel} • {job.hoursWorked}h worked {/* Info */}
                  </div>
                </div>

                <button
                  onClick={(e) => { // ✅ Prevent parent click when clicking clock out
                    e.stopPropagation();
                    handleClockOut(job.jobId, job.jobNumber);
                  }}
                  disabled={loading || dbUserId == null} // Disable if busy or unmapped
                  style={{
                    padding: "8px 16px", // Button padding
                    backgroundColor: loading ? "#ccc" : "#ef4444", // Grey when loading
                    color: "white", // Text colour
                    border: "none", // No border
                    borderRadius: "6px", // Rounded
                    cursor: loading || dbUserId == null ? "not-allowed" : "pointer", // Cursor state
                    fontSize: "13px", // Font size
                    fontWeight: "600" // Bold
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
              color: "#333" // Text colour
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
            placeholder="e.g., JOB-2025-014" // Example format
            disabled={loading} // Disable when loading
            style={{
              width: "100%", // Full width
              padding: "12px", // Comfortable size
              marginBottom: "12px", // Gap below
              borderRadius: "6px", // Rounded
              border: "1px solid #e0e0e0", // Subtle border
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
              border: "1px solid #e0e0e0", // Subtle border
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
                color: "#ef4444", // Red text
                marginBottom: "12px", // Gap
                fontSize: "14px", // Size
                padding: "8px", // Inner padding
                backgroundColor: "#fee", // Light bg
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
                loading || !jobNumber.trim() || dbUserId == null ? "#ccc" : "#FF4040", // Grey when disabled
              color: "white", // Text colour
              border: "none", // No border
              borderRadius: "6px", // Rounded
              fontWeight: "600", // Bold
              fontSize: "16px", // Size
              cursor:
                loading || !jobNumber.trim() || dbUserId == null ? "not-allowed" : "pointer", // Cursor
              transition: "background-color 0.2s" // Smooth hover
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
              backgroundColor: showAvailableJobs ? "#FF4040" : "#f5f5f5", // Accent when open
              color: showAvailableJobs ? "white" : "#666", // Contrast
              border: "1px solid #e0e0e0", // Border
              borderRadius: "6px", // Rounded
              cursor: "pointer", // Pointer
              fontSize: "14px", // Size
              fontWeight: "600" // Bold
            }}
          >
            {showAvailableJobs ? "Hide Available Jobs" : "Show Available Jobs"} {/* Toggle text */}
          </button>
        </div>

        {/* Available jobs list */}
        {showAvailableJobs && (
          <div> {/* List container */}
            <input
              type="text" // Search input
              placeholder="🔍 Search jobs..." // Hint
              value={searchTerm} // Controlled value
              onChange={(e) => setSearchTerm(e.target.value)} // Update
              style={{
                width: "100%", // Full width
                padding: "10px", // Padding
                marginBottom: "12px", // Gap
                borderRadius: "6px", // Rounded
                border: "1px solid #e0e0e0", // Border
                fontSize: "14px" // Size
              }}
            />

            <div
              style={{
                maxHeight: "300px", // Scroll area height
                overflowY: "auto", // Vertical scroll
                border: "1px solid #e0e0e0", // Border
                borderRadius: "6px" // Rounded
              }}
            >
              {filteredJobs.length === 0 ? ( // No results
                <div
                  style={{
                    padding: "20px", // Inner padding
                    textAlign: "center", // Center text
                    color: "#999" // Muted
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
                      borderBottom: "1px solid #f0f0f0", // Divider
                      cursor: "pointer", // Clickable
                      transition: "background-color 0.2s" // Smooth hover
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")} // Hover in
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")} // Hover out
                  >
                    <div
                      style={{
                        fontWeight: "600", // Bold
                        color: "#FF4040", // Accent
                        marginBottom: "4px" // Gap
                      }}
                    >
                      Job {job.jobNumber} - {job.reg} {/* Job label */}
                    </div>
                    <div style={{ fontSize: "13px", color: "#666" }}> {/* Meta */}
                      {job.makeModel} • {job.customer} {/* Info */}
                    </div>
                    <div
                      style={{
                        fontSize: "12px", // Small
                        color: "#999", // Muted
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
            backgroundColor: "#f5f5f5", // Neutral bg
            color: "#666", // Muted text
            border: "none", // No border
            borderRadius: "6px", // Rounded
            fontWeight: "600", // Bold
            cursor: loading ? "not-allowed" : "pointer" // Cursor state
          }}
        >
          Cancel {/* Label */}
        </button>
      </div>
    </div>
  );
}