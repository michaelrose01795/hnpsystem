// file location: src/pages/appointments/index.js
"use client";

import React, { useState, useEffect } from "react"; // Import React and useState/useEffect hooks
import Layout from "../../components/Layout"; // Main layout wrapper
import Popup from "../../components/popups/Popup"; // Reusable popup modal
import { useSearchParams } from "next/navigation"; // For reading query params
import { getAllJobs, createOrUpdateAppointment, getJobByNumberOrReg } from "../../lib/database/jobs"; // DB functions

const techsDefault = 6; // Default number of technicians available per day

// Generate list of dates excluding Sundays
const generateDates = (daysAhead = 60) => {
  const result = [];
  const today = new Date();
  let count = 0;
  let current = new Date(today);

  while (count < daysAhead) {
    if (current.getDay() !== 0) { // Skip Sundays
      result.push(new Date(current));
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return result;
};

// Generate time slots from 8:00 AM to 5:00 PM in 30-minute intervals
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 8; hour <= 17; hour++) { // 8 AM to 5 PM
    slots.push(`${hour.toString().padStart(2, "0")}:00`); // Add on the hour
    if (hour < 17) { // Don't add 5:30 PM
      slots.push(`${hour.toString().padStart(2, "0")}:30`); // Add half-hour
    }
  }
  return slots;
};

export default function Appointments() {
  const searchParams = useSearchParams();

  // ---------------- States ----------------
  const [jobs, setJobs] = useState([]); // All jobs from database
  const [dates, setDates] = useState([]); // List of available dates
  const [selectedDay, setSelectedDay] = useState(new Date()); // Currently selected day
  const [notes, setNotes] = useState({}); // Notes for each day
  const [showNotePopup, setShowNotePopup] = useState(false); // Show/hide note popup
  const [currentNote, setCurrentNote] = useState(""); // Current note being edited
  const [jobNumber, setJobNumber] = useState(""); // Job number input
  const [time, setTime] = useState(""); // Selected time slot
  const [highlightJob, setHighlightJob] = useState(""); // Job to highlight temporarily
  const [techHours, setTechHours] = useState({}); // Tech hours per day
  const [showTechHoursEditor, setShowTechHoursEditor] = useState(false); // Show/hide tech hours editor
  const [searchQuery, setSearchQuery] = useState(""); // Search input for filtering jobs
  const [timeSlots] = useState(generateTimeSlots()); // Available time slots
  const [isLoading, setIsLoading] = useState(false); // Loading state for booking

  // ---------------- Fetch Jobs ----------------
  const fetchJobs = async () => {
    console.log("📋 Fetching all jobs..."); // Debug log
    const jobsFromDb = await getAllJobs(); // Get all jobs from database
    console.log("✅ Jobs fetched:", jobsFromDb.length); // Debug log
    setJobs(jobsFromDb); // Update state
  };

  useEffect(() => {
    setDates(generateDates(60)); // Generate 60 days ahead
    fetchJobs(); // Load jobs on mount
  }, []);

  // Handle jobNumber in URL - automatically populate fields when redirected from create page
  useEffect(() => {
    const jobParam = searchParams.get("jobNumber"); // Get job number from URL
    console.log("🔍 Job number from URL:", jobParam); // Debug log
    
    if (jobParam) {
      setJobNumber(jobParam); // Set job number input
      const existingJob = jobs.find((j) => j.jobNumber === jobParam); // Find job in list
      
      if (existingJob) {
        console.log("✅ Found existing job:", existingJob); // Debug log
        if (existingJob.appointment) {
          setSelectedDay(new Date(existingJob.appointment.date)); // Set selected day
          setTime(existingJob.appointment.time); // Set time
        }
      } else {
        console.log("⚠️ Job not found in list, it may be new"); // Debug log
      }
    }
  }, [searchParams, jobs]);

  // ---------------- Notes ----------------
  const handleAddNote = (date) => {
    setSelectedDay(date); // Set selected day
    const dateKey = date.toDateString(); // Create date key
    setCurrentNote(notes[dateKey] || ""); // Load existing note or empty
    setShowNotePopup(true); // Show popup
  };

  const saveNote = () => {
    setNotes({ ...notes, [selectedDay.toDateString()]: currentNote }); // Save note for selected day
    setShowNotePopup(false); // Close popup
  };

  // ---------------- Add / Update Appointment ----------------
  const handleAddAppointment = async (customDate) => {
    console.log("🚀 Starting appointment booking..."); // Debug log
    
    const appointmentDate = customDate || (selectedDay ? selectedDay.toISOString().split("T")[0] : null);
    
    // Validate inputs
    if (!jobNumber) {
      alert("❌ Error: Job number is required");
      console.error("❌ Validation failed: No job number"); // Debug log
      return;
    }
    
    if (!appointmentDate) {
      alert("❌ Error: Please select a date");
      console.error("❌ Validation failed: No date"); // Debug log
      return;
    }
    
    if (!time) {
      alert("❌ Error: Please select a time");
      console.error("❌ Validation failed: No time"); // Debug log
      return;
    }

    console.log("📝 Booking details:", { jobNumber, appointmentDate, time }); // Debug log
    
    setIsLoading(true); // Show loading state

    try {
      // First, check if the job exists in our local state
      let job = jobs.find((j) => j.jobNumber === jobNumber);
      
      // If not in local state, fetch from database
      if (!job) {
        console.log("🔍 Job not in local state, fetching from database..."); // Debug log
        const fetchedJob = await getJobByNumberOrReg(jobNumber);
        
        if (!fetchedJob) {
          alert(`❌ Error: Job number ${jobNumber} does not exist. Please create the job first.`);
          console.error("❌ Job not found in database"); // Debug log
          setIsLoading(false);
          return;
        }
        
        job = fetchedJob;
        console.log("✅ Job fetched from database:", job); // Debug log
      } else {
        console.log("✅ Job found in local state:", job); // Debug log
      }

      // Now create/update the appointment for the existing job
      console.log("📅 Creating/updating appointment for existing job..."); // Debug log
      
      const appointmentResult = await createOrUpdateAppointment(
        jobNumber,
        appointmentDate,
        time
      );

      console.log("📦 Appointment result:", appointmentResult); // Debug log

      if (!appointmentResult.success) {
        const errorMessage = appointmentResult.error?.message || "Unknown error occurred";
        alert(`❌ Error booking appointment: ${errorMessage}`);
        console.error("❌ Appointment booking failed:", appointmentResult.error); // Debug log
        setIsLoading(false);
        return;
      }

      // Success! Update local state
      console.log("✅ Appointment booked successfully!"); // Debug log
      
      // Update job in local state with new appointment
      const updatedJob = {
        ...job,
        appointment: { date: appointmentDate, time },
        status: "Booked"
      };
      
      // Check if job exists in local jobs array
      const jobIndex = jobs.findIndex((j) => j.jobNumber === jobNumber);
      
      if (jobIndex !== -1) {
        // Update existing job in array
        const updatedJobs = [...jobs];
        updatedJobs[jobIndex] = updatedJob;
        setJobs(updatedJobs);
        console.log("✅ Updated job in local state"); // Debug log
      } else {
        // Add new job to array
        setJobs([...jobs, updatedJob]);
        console.log("✅ Added job to local state"); // Debug log
      }

      // Highlight briefly to show user the booking was successful
      setHighlightJob(jobNumber);
      setSelectedDay(new Date(appointmentDate));
      setTimeout(() => setHighlightJob(""), 2000); // Remove highlight after 2 seconds

      // Show success message
      alert(`✅ Appointment booked successfully!\n\nJob: ${jobNumber}\nDate: ${appointmentDate}\nTime: ${time}`);

      // Reset inputs
      setJobNumber("");
      setTime("");
      
    } catch (error) {
      console.error("❌ Unexpected error:", error); // Debug log
      alert(`❌ Unexpected error: ${error.message}`);
    } finally {
      setIsLoading(false); // Hide loading state
    }
  };

  // ---------------- Utilities ----------------
  const formatDate = (dateObj) =>
    dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); // Format: Mon 1 Jan
  const formatDateNoYear = (dateObj) =>
    dateObj.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); // Format without year
  const isSaturday = (date) => date.getDay() === 6; // Check if date is Saturday

  const getTechHoursForDay = (date) => techHours[date.toDateString()] || techsDefault; // Get tech hours or default
  const handleTechHoursChange = (e) =>
    setTechHours({ ...techHours, [selectedDay.toDateString()]: e.target.value }); // Update tech hours for day
  const toggleTechHoursEditor = () => setShowTechHoursEditor(!showTechHoursEditor); // Toggle editor visibility

  // Calculate job counts for a specific date
  const getJobCounts = (date) => {
    const jobsForDate = jobs.filter((j) => j.appointment?.date === date.toISOString().split("T")[0]); // Filter jobs for date
    return {
      totalJobs: jobsForDate.length,
      services: jobsForDate.filter((j) => j.reason?.toLowerCase().includes("service") || j.type?.toLowerCase().includes("service")).length,
      MOT: jobsForDate.filter((j) => j.MOT || j.type?.toLowerCase().includes("mot")).length,
      diagnosis: jobsForDate.filter((j) => j.reason?.toLowerCase().includes("diagnosis") || j.type?.toLowerCase().includes("diagnosis")).length,
      other: jobsForDate.filter(
        (j) =>
          !j.MOT &&
          !j.type?.toLowerCase().includes("mot") &&
          !j.reason?.toLowerCase().includes("service") &&
          !j.type?.toLowerCase().includes("service") &&
          !j.reason?.toLowerCase().includes("diagnosis") &&
          !j.type?.toLowerCase().includes("diagnosis")
      ).length,
    };
  };

  // Filter jobs for selected day
  const jobsForDay = jobs.filter(
    (j) => j.appointment?.date === selectedDay.toISOString().split("T")[0]
  );

  // Filter jobs based on search query (job number, name, reg)
  const filteredJobs = jobsForDay.filter((job) => {
    const query = searchQuery.toLowerCase(); // Convert search to lowercase
    return (
      job.jobNumber?.toLowerCase().includes(query) || // Match job number
      job.customer?.toLowerCase().includes(query) || // Match customer name
      job.reg?.toLowerCase().includes(query) // Match registration
    );
  });

  // Helper to safely display vehicle info
  const getVehicleDisplay = (job) => {
    if (job.make && job.model) {
      return `${job.make} ${job.model}`;
    }
    return job.vehicle_make_model || "N/A";
  };

  // ---------------- Render ----------------
  return (
    <Layout>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "8px 16px" }}>
        {/* Top Bar - Search and Appointment Booking */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginBottom: "12px",
            padding: "12px",
            backgroundColor: "#fff",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
          }}
        >
          {/* Add Note Button */}
          <button
            onClick={() => handleAddNote(selectedDay)}
            disabled={isLoading}
            style={{
              padding: "10px 20px",
              backgroundColor: isLoading ? "#ccc" : "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: "500",
              fontSize: "14px",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor = "#E63939";
                e.target.style.transform = "translateY(-1px)";
                e.target.style.boxShadow = "0 4px 8px rgba(255,64,64,0.2)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor = "#FF4040";
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "none";
              }
            }}
          >
            Add Note
          </button>

          {/* Search Bar */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Job #, Name, or Reg..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              outline: "none",
              fontSize: "14px",
              transition: "all 0.2s ease",
              opacity: isLoading ? 0.6 : 1,
            }}
            onFocus={(e) => {
              if (!isLoading) {
                e.target.style.borderColor = "#FF4040";
                e.target.style.boxShadow = "0 0 0 3px rgba(255,64,64,0.1)";
              }
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e0e0e0";
              e.target.style.boxShadow = "none";
            }}
          />

          {/* Job Number Input */}
          <input
            type="text"
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            placeholder="Job Number"
            disabled={isLoading}
            style={{
              width: "140px",
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              outline: "none",
              fontSize: "14px",
              transition: "all 0.2s ease",
              opacity: isLoading ? 0.6 : 1,
            }}
            onFocus={(e) => {
              if (!isLoading) {
                e.target.style.borderColor = "#FF4040";
                e.target.style.boxShadow = "0 0 0 3px rgba(255,64,64,0.1)";
              }
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e0e0e0";
              e.target.style.boxShadow = "none";
            }}
          />

          {/* Time Slot Dropdown */}
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={isLoading}
            style={{
              width: "120px",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              outline: "none",
              fontSize: "14px",
              backgroundColor: "#fff",
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
              paddingRight: "32px",
              opacity: isLoading ? 0.6 : 1,
            }}
            onFocus={(e) => {
              if (!isLoading) {
                e.target.style.borderColor = "#FF4040";
                e.target.style.boxShadow = "0 0 0 3px rgba(255,64,64,0.1)";
              }
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e0e0e0";
              e.target.style.boxShadow = "none";
            }}
          >
            <option value="">Select time</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>

          {/* Add Appointment Button */}
          <button
            onClick={() => handleAddAppointment(selectedDay.toISOString().split("T")[0])}
            disabled={isLoading}
            style={{
              padding: "10px 20px",
              backgroundColor: isLoading ? "#ccc" : "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: "500",
              fontSize: "14px",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor = "#E63939";
                e.target.style.transform = "translateY(-1px)";
                e.target.style.boxShadow = "0 4px 8px rgba(255,64,64,0.2)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor = "#FF4040";
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "none";
              }
            }}
          >
            {isLoading ? "Booking..." : "Book Appointment"}
          </button>
        </div>

        {/* Calendar Table Container */}
        <div
          style={{
            flex: "0 0 auto",
            maxHeight: "calc(14 * 42px + 60px)",
            overflowY: "auto",
            marginBottom: "12px",
            borderRadius: "10px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            backgroundColor: "#fff",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr
                style={{
                  backgroundColor: "#f6f6f6",
                  borderBottom: "2px solid #FF4040",
                }}
              >
                {[
                  "Day/Date",
                  "Availability",
                  "Total Hours",
                  "Total Jobs",
                  "Services",
                  "MOT",
                  "Diagnosis",
                  "Other",
                  "Notes",
                ].map((header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      fontWeight: "600",
                      fontSize: "14px",
                      color: "#333",
                      borderBottom: "1px solid #ddd",
                      background: "#f9f9f9",
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => {
                const dateKey = date.toDateString();
                const counts = getJobCounts(date);
                return (
                  <tr
                    key={dateKey}
                    onClick={() => setSelectedDay(date)}
                    style={{
                      cursor: "pointer",
                      backgroundColor:
                        selectedDay.toDateString() === date.toDateString()
                          ? "#FFF2F2"
                          : isSaturday(date)
                          ? "#FFF8E1"
                          : "#fff",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9f9f9")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        selectedDay.toDateString() === date.toDateString()
                          ? "#FFF2F2"
                          : isSaturday(date)
                          ? "#FFF8E1"
                          : "#fff")
                    }
                  >
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                      {formatDate(date)}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                      {getTechHoursForDay(date)} techs
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>0</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                      {counts.totalJobs}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                      {counts.services}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                      {counts.MOT}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                      {counts.diagnosis}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                      {counts.other}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                      {notes[dateKey] || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Jobs for Selected Day Section */}
        <div
          style={{
            flex: "0 0 40%",
            marginBottom: "8px",
            border: "1px solid #ccc",
            borderRadius: "10px",
            padding: "12px",
            backgroundColor: "#fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            overflowY: "auto",
          }}
        >
          <h3 style={{ marginBottom: "12px" }}>
            Jobs for <span style={{ color: "#FF4040" }}>{formatDateNoYear(selectedDay)}</span>
          </h3>

          <div style={{ display: "flex", gap: "12px", marginBottom: "8px" }}>
            {["All Jobs", "MOT", "Tech Hours"].map((tab) => (
              <div
                key={tab}
                style={{
                  padding: "6px 12px",
                  border: "1px solid #FF4040",
                  color: tab === "Tech Hours" ? "#FF4040" : "#000",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (tab === "Tech Hours") toggleTechHoursEditor();
                }}
              >
                {tab}
              </div>
            ))}
          </div>

          {showTechHoursEditor && (
            <div
              style={{
                marginBottom: "12px",
                padding: "12px",
                border: "1px solid #FF4040",
                borderRadius: "6px",
                background: "#FFF5F5",
              }}
            >
              <label>Tech Hours for {formatDateNoYear(selectedDay)}:</label>
              <input
                type="number"
                min="0"
                value={getTechHoursForDay(selectedDay)}
                onChange={handleTechHoursChange}
                style={{
                  marginLeft: "8px",
                  padding: "6px",
                  width: "60px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  "Job #",
                  "Reg",
                  "Vehicle",
                  "Customer",
                  "Time In",
                  "Time Out",
                  "Reason",
                  "Total Time",
                  "Time on Job",
                  "Waiting",
                  "Collection",
                  "Loan Car",
                  "MOT",
                  "Wash",
                  "Address",
                ].map((head) => (
                  <th
                    key={head}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      background: "#f6f6f6",
                      fontWeight: "600",
                      borderBottom: "2px solid #FF4040",
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job, idx) => (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor:
                        highlightJob === job.jobNumber ? "#D0F0C0" : "transparent",
                      transition: "background-color 0.5s",
                    }}
                  >
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.jobNumber || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.reg || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{getVehicleDisplay(job)}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.customer || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.appointment?.time || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>-</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.reason || job.description || job.type || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.totalTime || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.timeOnJob || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>
                      <input type="checkbox" checked={job.waiting || false} readOnly />
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>
                      <input type="checkbox" checked={job.collection || false} readOnly />
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>
                      <input type="checkbox" checked={job.loanCar || false} readOnly />
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>
                      <input type="checkbox" checked={job.MOT || false} readOnly />
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>
                      <input type="checkbox" checked={job.wash || false} readOnly />
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.customerAddress || "-"}</td>
                  </tr>
                ))
              ) : (
                Array.from({ length: 12 }).map((_, idx) => (
                  <tr key={idx}>
                    {Array.from({ length: 15 }).map((__, colIdx) => (
                      <td key={colIdx} style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}></td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add Note Popup */}
        <Popup isOpen={showNotePopup} onClose={() => setShowNotePopup(false)}>
          <h3>Add Note for {formatDateNoYear(selectedDay)}</h3>
          <textarea
            style={{ width: "100%", height: "100px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
          />
          <div
            style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", gap: "8px" }}
          >
            <button 
              onClick={saveNote}
              style={{
                padding: "8px 16px",
                backgroundColor: "#FF4040",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Update
            </button>
            <button 
              onClick={() => setShowNotePopup(false)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#666",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Close
            </button>
          </div>
        </Popup>
      </div>
    </Layout>
  );
}