// file location: src/components/JobCards/JobCardModal.js

import React, { useState, useRef, useEffect } from "react"; // React hooks
import { useRouter } from "next/router"; // Next.js router
import { useUser } from "../../context/UserContext"; // User context to check login
import { 
  clockInToJob, 
  clockOutFromJob, 
  getUserActiveJobs 
} from "../../lib/database/jobClocking"; // ✅ NEW: Import job clocking functions
import { getAllJobs } from "../../lib/database/jobs"; // ✅ NEW: Import jobs function

export default function JobCardModal({ isOpen, onClose }) {
  const router = useRouter(); // Router for navigation
  const { user } = useUser(); // Access current user
  const [jobNumber, setJobNumber] = useState(""); // Job number input
  const [error, setError] = useState(""); // Error message
  const [loading, setLoading] = useState(false); // Loading state
  const [activeJobs, setActiveJobs] = useState([]); // Jobs user is clocked into
  const [availableJobs, setAvailableJobs] = useState([]); // Available jobs to clock into
  const [showAvailableJobs, setShowAvailableJobs] = useState(false); // Toggle available jobs list
  const [workType, setWorkType] = useState("initial"); // Type of work (initial or additional)
  const [searchTerm, setSearchTerm] = useState(""); // Search filter
  const inputRef = useRef(null); // Reference to input field

  // ✅ Redirect to login if not logged in
  useEffect(() => {
    if (isOpen && !user) {
      router.push("/login"); // Redirect to login
      onClose(); // Close modal
    }
  }, [isOpen, user, router, onClose]);

  // ✅ Fetch data when modal opens
  useEffect(() => {
    if (isOpen && user) {
      fetchData(); // Load active jobs and available jobs
      if (inputRef.current) {
        inputRef.current.focus(); // Focus input field
      }
    }
  }, [isOpen, user]);

  // ✅ Fetch active jobs and available jobs
  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Fetch jobs user is currently clocked into
      const activeResult = await getUserActiveJobs(user.id);
      if (activeResult.success) {
        setActiveJobs(activeResult.data);
      }
      
      // Fetch available jobs
      const allJobs = await getAllJobs();
      // Filter to active jobs only
      const activeJobsList = allJobs.filter(job => 
        !["Complete", "Completed", "Invoiced", "Collected", "Cancelled"].includes(job.status)
      );
      setAvailableJobs(activeJobsList);
      
    } catch (error) {
      console.error("❌ Error fetching data:", error);
      setError("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle clock in to job
  const handleClockIn = async () => {
    const trimmedJob = jobNumber.trim();
    
    if (!trimmedJob) {
      setError("Please enter a job number");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      // Find the job in available jobs
      const job = availableJobs.find(j => 
        j.jobNumber?.toString() === trimmedJob || 
        j.id?.toString() === trimmedJob
      );
      
      if (!job) {
        setError("Job not found or already completed");
        setLoading(false);
        return;
      }
      
      // Clock in to the job
      const result = await clockInToJob(
        user.id, 
        job.id, 
        job.jobNumber, 
        workType
      );
      
      if (result.success) {
        console.log("✅ Clocked in successfully");
        
        // Navigate to job card page
        onClose();
        router.push(`/job-cards/${job.jobNumber}`);
      } else {
        console.error("❌ Clock in failed:", result.error);
        setError(result.error || "Failed to clock in");
      }
      
    } catch (error) {
      console.error("❌ Error clocking in:", error);
      setError("Error clocking in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle clock out from job
  const handleClockOut = async (jobId, jobNumber) => {
    const confirmed = confirm(`Clock out from Job ${jobNumber}?`);
    if (!confirmed) return;
    
    setLoading(true);
    
    try {
      const result = await clockOutFromJob(user.id, jobId);
      
      if (result.success) {
        console.log("✅ Clocked out successfully");
        alert(`✅ Clocked out from Job ${jobNumber}\n\nHours worked: ${result.hoursWorked}h`);
        
        // Refresh data
        await fetchData();
      } else {
        console.error("❌ Clock out failed:", result.error);
        setError(result.error || "Failed to clock out");
      }
      
    } catch (error) {
      console.error("❌ Error clocking out:", error);
      setError("Error clocking out. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle selecting job from list
  const handleSelectJob = (job) => {
    setJobNumber(job.jobNumber);
    setShowAvailableJobs(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // ✅ Pressing Enter triggers Clock In
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      handleClockIn();
    }
  };

  // ✅ Filter available jobs based on search term
  const filteredJobs = availableJobs.filter(job => {
    if (!searchTerm.trim()) return true;
    
    const lower = searchTerm.toLowerCase();
    return (
      job.jobNumber?.toString().toLowerCase().includes(lower) ||
      job.reg?.toLowerCase().includes(lower) ||
      job.customer?.toLowerCase().includes(lower) ||
      job.makeModel?.toLowerCase().includes(lower)
    );
  });

  // ✅ Don't render anything if modal isn't open
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        padding: "20px"
      }}
      onClick={onClose} // Click outside to close
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
        }}
        onClick={(e) => e.stopPropagation()} // Prevent backdrop click
      >
        <h2 style={{ 
          marginBottom: "20px", 
          color: "#FF4040",
          fontSize: "24px",
          fontWeight: "700",
          textAlign: "center"
        }}>
          🔧 Start Job
        </h2>

        {/* ✅ Currently Clocked Jobs Section */}
        {activeJobs.length > 0 && (
          <div style={{
            marginBottom: "24px",
            padding: "16px",
            backgroundColor: "#fff5f5",
            borderRadius: "8px",
            border: "2px solid #FF4040"
          }}>
            <h3 style={{ 
              fontSize: "16px", 
              fontWeight: "600", 
              color: "#FF4040",
              marginBottom: "12px"
            }}>
              Currently Working On:
            </h3>
            
            {activeJobs.map((job) => (
              <div
                key={job.clockingId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px",
                  backgroundColor: "white",
                  borderRadius: "6px",
                  marginBottom: "8px"
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", color: "#FF4040", marginBottom: "4px" }}>
                    Job {job.jobNumber} - {job.reg}
                  </div>
                  <div style={{ fontSize: "13px", color: "#666" }}>
                    {job.makeModel} • {job.hoursWorked}h worked
                  </div>
                </div>
                
                <button
                  onClick={() => handleClockOut(job.jobId, job.jobNumber)}
                  disabled={loading}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: loading ? "#ccc" : "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    fontWeight: "600"
                  }}
                >
                  Clock Out
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ✅ Manual Job Number Entry */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ 
            display: "block", 
            marginBottom: "8px", 
            fontSize: "14px",
            fontWeight: "600",
            color: "#333"
          }}>
            Enter Job Number:
          </label>
          
          <input
            ref={inputRef}
            type="text"
            value={jobNumber}
            onChange={(e) => {
              setJobNumber(e.target.value);
              setError("");
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g., 12345"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "12px",
              borderRadius: "6px",
              border: "1px solid #e0e0e0",
              fontSize: "16px",
              outline: "none"
            }}
          />

          {/* Work Type Selection */}
          <select
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "12px",
              borderRadius: "6px",
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            <option value="initial">Initial Work</option>
            <option value="additional">Additional Work</option>
          </select>

          {error && (
            <p style={{ 
              color: "#ef4444", 
              marginBottom: "12px", 
              fontSize: "14px",
              padding: "8px",
              backgroundColor: "#fee",
              borderRadius: "4px"
            }}>
              ⚠️ {error}
            </p>
          )}

          <button
            onClick={handleClockIn}
            disabled={loading || !jobNumber.trim()}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: loading || !jobNumber.trim() ? "#ccc" : "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "16px",
              cursor: loading || !jobNumber.trim() ? "not-allowed" : "pointer",
              transition: "background-color 0.2s"
            }}
          >
            {loading ? "Clocking In..." : "⏱️ Clock In"}
          </button>
        </div>

        {/* ✅ Toggle Available Jobs List */}
        <div style={{ marginBottom: "16px" }}>
          <button
            onClick={() => setShowAvailableJobs(!showAvailableJobs)}
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: showAvailableJobs ? "#FF4040" : "#f5f5f5",
              color: showAvailableJobs ? "white" : "#666",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            {showAvailableJobs ? "Hide Available Jobs" : "Show Available Jobs"}
          </button>
        </div>

        {/* ✅ Available Jobs List */}
        {showAvailableJobs && (
          <div>
            {/* Search Bar */}
            <input
              type="text"
              placeholder="🔍 Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: "12px",
                borderRadius: "6px",
                border: "1px solid #e0e0e0",
                fontSize: "14px"
              }}
            />

            {/* Jobs List */}
            <div style={{
              maxHeight: "300px",
              overflowY: "auto",
              border: "1px solid #e0e0e0",
              borderRadius: "6px"
            }}>
              {filteredJobs.length === 0 ? (
                <div style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#999"
                }}>
                  No jobs found
                </div>
              ) : (
                filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => handleSelectJob(job)}
                    style={{
                      padding: "12px",
                      borderBottom: "1px solid #f0f0f0",
                      cursor: "pointer",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                  >
                    <div style={{ fontWeight: "600", color: "#FF4040", marginBottom: "4px" }}>
                      Job {job.jobNumber} - {job.reg}
                    </div>
                    <div style={{ fontSize: "13px", color: "#666" }}>
                      {job.makeModel} • {job.customer}
                    </div>
                    <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
                      Status: {job.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ✅ Cancel Button */}
        <button
          onClick={onClose}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "10px",
            backgroundColor: "#f5f5f5",
            color: "#666",
            border: "none",
            borderRadius: "6px",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}