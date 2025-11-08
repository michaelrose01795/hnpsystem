// file location: src/pages/appointments/index.js
"use client";

import React, { useState, useEffect } from "react"; // Import React and useState/useEffect hooks
import Layout from "../../components/Layout"; // Main layout wrapper
import Popup from "../../components/popups/Popup"; // Reusable popup modal
import { useRouter } from "next/router"; // For reading query params
import { 
  getAllJobs, 
  createOrUpdateAppointment, 
  getJobByNumberOrReg,
  getJobsByDate // ✅ NEW: Get appointments by date
} from "../../lib/database/jobs"; // DB functions

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
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    if (hour < 17) slots.push(`${hour.toString().padStart(2, "0")}:30`);
  }
  return slots;
};

// ---------------- Utility Functions ----------------
// ✅ Display vehicle info using new database fields
const getVehicleDisplay = (job) => {
  // Try makeModel first (combined field), then fall back to make + model
  if (job.makeModel) return job.makeModel;
  
  const make = job.make || "";
  const model = job.model || "";
  const year = job.year || "";
  return [year, make, model].filter(Boolean).join(" ") || "-";
};

export default function Appointments() {
  const router = useRouter();
  const jobQueryParam = Array.isArray(router.query.jobNumber)
    ? router.query.jobNumber[0]
    : router.query.jobNumber;

  // ---------------- States ----------------
  const [jobs, setJobs] = useState([]);
  const [dates, setDates] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [notes, setNotes] = useState({});
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [time, setTime] = useState("");
  const [highlightJob, setHighlightJob] = useState("");
  const [techHours, setTechHours] = useState({});
  const [showTechHoursEditor, setShowTechHoursEditor] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeSlots] = useState(generateTimeSlots());
  const [isLoading, setIsLoading] = useState(false);

  // ---------------- Fetch Jobs ----------------
  const fetchJobs = async () => {
    console.log("📋 Fetching all jobs...");
    setIsLoading(true);
    
    try {
      const jobsFromDb = await getAllJobs();
      console.log("✅ Jobs fetched:", jobsFromDb.length);
      
      // ✅ Filter only jobs with appointments
      const jobsWithAppointments = jobsFromDb.filter(job => job.appointment);
      console.log("✅ Jobs with appointments:", jobsWithAppointments.length);
      
      setJobs(jobsWithAppointments);
    } catch (error) {
      console.error("❌ Error fetching jobs:", error);
      alert("Failed to load appointments. Please refresh the page.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setDates(generateDates(60));
    fetchJobs();
  }, []);

  // ✅ Handle jobNumber from URL parameters
  useEffect(() => {
    if (!router.isReady) return;
    const jobParam = typeof jobQueryParam === "string" ? jobQueryParam : "";
    if (jobParam.trim().length > 0) {
      setJobNumber(jobParam);
      const existingJob = jobs.find((j) => j.jobNumber.toString() === jobParam || j.id.toString() === jobParam);
      if (existingJob && existingJob.appointment) {
        setSelectedDay(new Date(existingJob.appointment.date));
        setTime(existingJob.appointment.time);
      }
    }
  }, [router.isReady, jobQueryParam, jobs]);

  // ---------------- Notes ----------------
  const handleAddNote = (date) => {
    setSelectedDay(date);
    const dateKey = date.toDateString();
    setCurrentNote(notes[dateKey] || "");
    setShowNotePopup(true);
  };

  const saveNote = () => {
    setNotes({ ...notes, [selectedDay.toDateString()]: currentNote });
    setShowNotePopup(false);
    // ✅ TODO: Save note to database (create appointments_notes table or use job_notes)
  };

  // ---------------- Add / Update Appointment ----------------
  const handleAddAppointment = async (customDate) => {
    const appointmentDate = customDate || (selectedDay ? selectedDay.toISOString().split("T")[0] : null);

    // ✅ Validation
    if (!jobNumber || jobNumber.trim() === "") {
      alert("❌ Error: Job number is required");
      return;
    }
    if (!appointmentDate) {
      alert("❌ Error: Please select a date");
      return;
    }
    if (!time || time === "") {
      alert("❌ Error: Please select a time");
      return;
    }

    setIsLoading(true);

    try {
      const normalizedJobNumber = jobNumber.toString().trim();
      console.log("🔍 Attempting to book appointment for job:", normalizedJobNumber);

      // ✅ Look for job in local state first
      let job = jobs.find((j) => 
        j.jobNumber?.toString() === normalizedJobNumber || 
        j.id?.toString() === normalizedJobNumber
      );

      // ✅ If not found locally, fetch from database
      if (!job) {
        console.log(`📡 Job ${normalizedJobNumber} not found locally, fetching from DB...`);
        const fetchedJob = await getJobByNumberOrReg(normalizedJobNumber);
        
        if (!fetchedJob) {
          alert(`❌ Error: Job ${normalizedJobNumber} does not exist in the system.\n\nPlease create the job card first before booking an appointment.`);
          setIsLoading(false);
          return;
        }
        
        job = fetchedJob;
        console.log("✅ Job fetched from database:", job);
      }

      // ✅ Create or update appointment using job number
      console.log("📅 Creating appointment with:", {
        jobNumber: job.jobNumber,
        date: appointmentDate,
        time: time
      });

      const appointmentResult = await createOrUpdateAppointment(
        job.jobNumber, // Use job number for appointment creation
        appointmentDate,
        time,
        currentNote || null // ✅ Pass notes if available
      );

      if (!appointmentResult.success) {
        const errorMessage = appointmentResult.error?.message || "Unknown error occurred";
        console.error("❌ Appointment booking failed:", errorMessage);
        alert(`❌ Error booking appointment:\n\n${errorMessage}\n\nPlease check the job number and try again.`);
        setIsLoading(false);
        return;
      }

      console.log("✅ Appointment booked successfully:", appointmentResult);

      // ✅ Update local state with new appointment data
      const updatedJob = {
        ...job,
        appointment: { 
          appointmentId: appointmentResult.data?.appointment?.appointment_id,
          date: appointmentDate, 
          time: time,
          notes: currentNote || "",
          status: "Scheduled"
        },
        status: "Booked"
      };

      const jobIndex = jobs.findIndex((j) => j.id === job.id);
      if (jobIndex !== -1) {
        const updatedJobs = [...jobs];
        updatedJobs[jobIndex] = updatedJob;
        setJobs(updatedJobs);
      } else {
        setJobs([...jobs, updatedJob]);
      }

      // ✅ Visual feedback
      setHighlightJob(job.jobNumber || job.id.toString());
      setSelectedDay(new Date(appointmentDate));
      setTimeout(() => setHighlightJob(""), 3000);

      // ✅ Success notification
      alert(
        `✅ Appointment booked successfully!\n\n` +
        `Job Number: ${job.jobNumber}\n` +
        `Customer: ${job.customer}\n` +
        `Vehicle: ${job.reg}\n` +
        `Date: ${appointmentDate}\n` +
        `Time: ${time}`
      );

      // ✅ Clear form
      setJobNumber("");
      setTime("");
      setCurrentNote("");

    } catch (error) {
      console.error("❌ Unexpected error booking appointment:", error);
      alert(`❌ Unexpected error:\n\n${error.message}\n\nPlease try again or contact support.`);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------- Utilities ----------------
  const formatDate = (dateObj) => 
    dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  
  const formatDateNoYear = (dateObj) => 
    dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  
  const isSaturday = (date) => date.getDay() === 6;
  
  const getTechHoursForDay = (date) => techHours[date.toDateString()] || techsDefault;
  
  const handleTechHoursChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setTechHours({ ...techHours, [selectedDay.toDateString()]: value });
    // ✅ TODO: Save to database or localStorage
  };
  
  const toggleTechHoursEditor = () => setShowTechHoursEditor(!showTechHoursEditor);

  // ✅ Enhanced job counts with new job categories - FIXED to handle non-array requests
  const getJobCounts = (date) => {
    const jobsForDate = jobs.filter((j) => j.appointment?.date === date.toISOString().split("T")[0]);
    
    return {
      totalJobs: jobsForDate.length,
      services: jobsForDate.filter((j) => 
        j.jobCategories?.includes("Service") || 
        j.type?.toLowerCase().includes("service")
      ).length,
      MOT: jobsForDate.filter((j) => 
        j.jobCategories?.includes("MOT") || 
        j.type?.toLowerCase().includes("mot")
      ).length,
      diagnosis: jobsForDate.filter((j) => 
        j.jobCategories?.includes("Diagnostic") || 
        j.type?.toLowerCase().includes("diagnosis") ||
        j.type?.toLowerCase().includes("diagnostic")
      ).length,
      other: jobsForDate.filter((j) => 
        !j.jobCategories?.includes("MOT") &&
        !j.jobCategories?.includes("Service") &&
        !j.jobCategories?.includes("Diagnostic") &&
        !j.type?.toLowerCase().includes("mot") &&
        !j.type?.toLowerCase().includes("service") &&
        !j.type?.toLowerCase().includes("diagnosis")
      ).length,
      // ✅ FIXED: Calculate total estimated hours safely checking if requests is an array
      totalHours: jobsForDate.reduce((sum, j) => {
        // ✅ Check if requests exists and is an array before using reduce
        if (!j.requests || !Array.isArray(j.requests)) {
          return sum; // Return current sum if no valid requests array
        }
        
        const jobHours = j.requests.reduce((reqSum, req) => {
          return reqSum + (parseFloat(req.time) || 0);
        }, 0);
        
        return sum + jobHours;
      }, 0).toFixed(1),
    };
  };

  // ---------------- Filtered Jobs for Selected Day ----------------
  const jobsForDay = jobs.filter((j) => j.appointment?.date === selectedDay.toISOString().split("T")[0]);
  
  const filteredJobs = jobsForDay.filter((job) => {
    const query = searchQuery.toLowerCase();
    return (
      job.jobNumber?.toString().includes(query) || 
      job.id?.toString().includes(query) ||
      job.customer?.toLowerCase().includes(query) || 
      job.reg?.toLowerCase().includes(query) ||
      job.makeModel?.toLowerCase().includes(query)
    );
  });

  // ✅ Sort jobs by appointment time
  const sortedJobs = filteredJobs.sort((a, b) => {
    const timeA = a.appointment?.time || "00:00";
    const timeB = b.appointment?.time || "00:00";
    return timeA.localeCompare(timeB);
  });

  // ---------------- Render ----------------
  return (
    <Layout>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "8px 16px" }}>

        {/* Top Bar */}
        <div style={{ 
          display: "flex", 
          gap: "12px", 
          alignItems: "center", 
          marginBottom: "12px", 
          padding: "12px", 
          backgroundColor: "#fff", 
          borderRadius: "8px", 
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)" 
        }}>
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
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => !isLoading && (e.target.style.backgroundColor = "#cc0000")}
            onMouseLeave={(e) => !isLoading && (e.target.style.backgroundColor = "#FF4040")}
          >
            📝 Add Note
          </button>

          <input 
            type="text" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search by Job #, Name, Reg, or Vehicle..." 
            disabled={isLoading} 
            style={{ 
              flex: 1, 
              padding: "10px 16px", 
              borderRadius: "8px", 
              border: "1px solid #e0e0e0", 
              fontSize: "14px",
              outline: "none"
            }}
            onFocus={(e) => e.target.style.borderColor = "#FF4040"}
            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
          />

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
              fontSize: "14px",
              outline: "none"
            }}
            onFocus={(e) => e.target.style.borderColor = "#FF4040"}
            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
          />

          <select 
            value={time} 
            onChange={(e) => setTime(e.target.value)} 
            disabled={isLoading} 
            style={{ 
              width: "120px", 
              padding: "10px 12px", 
              borderRadius: "8px", 
              border: "1px solid #e0e0e0", 
              fontSize: "14px",
              cursor: "pointer",
              outline: "none"
            }}
          >
            <option value="">Select time</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>

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
              fontWeight: "600", 
              fontSize: "14px",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => !isLoading && (e.target.style.backgroundColor = "#cc0000")}
            onMouseLeave={(e) => !isLoading && (e.target.style.backgroundColor = "#FF4040")}
          >
            {isLoading ? "Booking..." : "📅 Book Appointment"}
          </button>
        </div>

        {/* Calendar Table Container */}
        <div style={{ 
          flex: "0 0 auto", 
          maxHeight: "calc(14 * 42px + 60px)", 
          overflowY: "auto", 
          marginBottom: "12px", 
          borderRadius: "10px", 
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)", 
          backgroundColor: "#fff" 
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr style={{ backgroundColor: "#f6f6f6", borderBottom: "2px solid #FF4040" }}>
                {["Day/Date","Availability","Total Hours","Total Jobs","Services","MOT","Diagnosis","Other","Notes"].map(header => (
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
                      top: 0 
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
                const isSelected = selectedDay.toDateString() === date.toDateString();
                const isSat = isSaturday(date);
                
                return (
                  <tr 
                    key={dateKey} 
                    onClick={() => setSelectedDay(date)} 
                    style={{ 
                      cursor: "pointer", 
                      backgroundColor: isSelected ? "#FFF2F2" : isSat ? "#FFF8E1" : "#fff",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = "#f5f5f5";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = isSat ? "#FFF8E1" : "#fff";
                      }
                    }}
                  >
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontWeight: isSelected ? "600" : "400" }}>
                      {formatDate(date)}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                      {getTechHoursForDay(date)} techs
                    </td>
                    <td style={{ 
                      padding: "10px 12px", 
                      borderBottom: "1px solid #eee",
                      color: counts.totalHours > 0 ? "#333" : "#999"
                    }}>
                      {counts.totalHours}h
                    </td>
                    <td style={{ 
                      padding: "10px 12px", 
                      borderBottom: "1px solid #eee",
                      fontWeight: counts.totalJobs > 0 ? "600" : "400"
                    }}>
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
                    <td style={{ 
                      padding: "10px 12px", 
                      borderBottom: "1px solid #eee",
                      fontSize: "13px",
                      color: "#666",
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {notes[dateKey] || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Jobs for Selected Day Section */}
        <div style={{ 
          flex: "0 0 40%", 
          marginBottom: "8px", 
          border: "1px solid #e0e0e0", 
          borderRadius: "10px", 
          padding: "16px", 
          backgroundColor: "#fff", 
          boxShadow: "0 2px 6px rgba(0,0,0,0.05)", 
          overflowY: "auto" 
        }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: "16px" 
          }}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
              Jobs for <span style={{ color: "#FF4040" }}>{formatDateNoYear(selectedDay)}</span>
            </h3>
            <span style={{
              padding: "6px 14px",
              backgroundColor: "#f0f0f0",
              borderRadius: "16px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#333"
            }}>
              {sortedJobs.length} job{sortedJobs.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <button
              style={{
                padding: "8px 16px",
                border: "2px solid #FF4040",
                backgroundColor: "#FFF2F2",
                color: "#FF4040",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "13px"
              }}
            >
              All Jobs ({sortedJobs.length})
            </button>
            
            <button
              onClick={toggleTechHoursEditor}
              style={{
                padding: "8px 16px",
                border: "1px solid #e0e0e0",
                backgroundColor: showTechHoursEditor ? "#FFF2F2" : "white",
                color: "#666",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "13px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#f5f5f5"}
              onMouseLeave={(e) => e.target.style.backgroundColor = showTechHoursEditor ? "#FFF2F2" : "white"}
            >
              ⚙️ Tech Hours
            </button>
          </div>

          {showTechHoursEditor && (
            <div style={{ 
              marginBottom: "16px", 
              padding: "16px", 
              border: "2px solid #FF4040", 
              borderRadius: "8px", 
              background: "#FFF5F5" 
            }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "#333", display: "block", marginBottom: "8px" }}>
                Tech Hours for {formatDateNoYear(selectedDay)}:
              </label>
              <input 
                type="number" 
                min="0" 
                max="20"
                value={getTechHoursForDay(selectedDay)} 
                onChange={handleTechHoursChange} 
                style={{ 
                  padding: "8px 12px", 
                  width: "100px", 
                  borderRadius: "6px", 
                  border: "1px solid #ccc",
                  fontSize: "14px",
                  fontWeight: "600"
                }} 
              />
              <span style={{ marginLeft: "8px", fontSize: "14px", color: "#666" }}>
                technicians available
              </span>
            </div>
          )}

          {/* ✅ Enhanced Jobs Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  {[
                    "Time",
                    "Job #",
                    "Reg",
                    "Vehicle",
                    "Customer",
                    "Job Type",
                    "Waiting Status", // ✅ NEW
                    "Source", // ✅ NEW
                    "Est. Hours" // ✅ NEW
                  ].map(head => (
                    <th 
                      key={head} 
                      style={{ 
                        textAlign: "left", 
                        padding: "10px 12px", 
                        background: "#f6f6f6", 
                        fontWeight: "600", 
                        borderBottom: "2px solid #FF4040", 
                        position: "sticky", 
                        top: 0, 
                        zIndex: 1,
                        whiteSpace: "nowrap"
                      }}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedJobs.length > 0 ? (
                  sortedJobs.map((job, idx) => (
                    <tr 
                      key={idx} 
                      style={{ 
                        backgroundColor: highlightJob === job.jobNumber ? "#D0F0C0" : idx % 2 === 0 ? "#fafafa" : "transparent", 
                        transition: "background-color 0.5s",
                        cursor: "pointer"
                      }}
                      onClick={() => window.open(`/job-cards/${job.jobNumber}`, '_blank')}
                      onMouseEnter={(e) => {
                        if (highlightJob !== job.jobNumber) {
                          e.currentTarget.style.backgroundColor = "#f0f0f0";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (highlightJob !== job.jobNumber) {
                          e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#fafafa" : "transparent";
                        }
                      }}
                    >
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontWeight: "600" }}>
                        {job.appointment?.time || "-"}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee", color: "#FF4040", fontWeight: "600" }}>
                        {job.jobNumber || job.id || "-"}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontWeight: "500" }}>
                        {job.reg || "-"}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                        {getVehicleDisplay(job)}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                        {job.customer || "-"}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                        {/* ✅ Show job categories as badges */}
                        {job.jobCategories && job.jobCategories.length > 0 ? (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {job.jobCategories.map((cat, i) => (
                              <span 
                                key={i}
                                style={{
                                  padding: "2px 8px",
                                  backgroundColor: "#e0e0e0",
                                  borderRadius: "10px",
                                  fontSize: "11px",
                                  fontWeight: "600"
                                }}
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        ) : (
                          job.type || "-"
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                        {/* ✅ Waiting status with color coding */}
                        {job.waitingStatus && job.waitingStatus !== "Neither" ? (
                          <span style={{
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "600",
                            backgroundColor: 
                              job.waitingStatus === "Waiting" ? "#ffebee" :
                              job.waitingStatus === "Loan Car" ? "#e3f2fd" :
                              "#e8f5e9",
                            color:
                              job.waitingStatus === "Waiting" ? "#c62828" :
                              job.waitingStatus === "Loan Car" ? "#1565c0" :
                              "#2e7d32"
                          }}>
                            {job.waitingStatus}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>
                        {/* ✅ Job source badge */}
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "600",
                          backgroundColor: job.jobSource === "Warranty" ? "#fff3e0" : "#e8f5e9",
                          color: job.jobSource === "Warranty" ? "#e65100" : "#2e7d32"
                        }}>
                          {job.jobSource || "Retail"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontWeight: "600" }}>
                        {/* ✅ FIXED: Calculate total estimated hours safely */}
                        {job.requests && Array.isArray(job.requests) && job.requests.length > 0 ? (
                          job.requests.reduce((sum, req) => sum + (parseFloat(req.time) || 0), 0).toFixed(1) + "h"
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td 
                      colSpan="9" 
                      style={{ 
                        padding: "40px", 
                        textAlign: "center", 
                        color: "#999",
                        fontSize: "14px"
                      }}
                    >
                      No appointments booked for this day
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Note Popup */}
        <Popup isOpen={showNotePopup} onClose={() => setShowNotePopup(false)}>
          <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "20px", fontWeight: "600" }}>
            Add Note for {formatDateNoYear(selectedDay)}
          </h3>
          <textarea 
            style={{ 
              width: "100%", 
              height: "120px", 
              padding: "12px", 
              borderRadius: "8px", 
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none"
            }} 
            value={currentNote} 
            onChange={(e) => setCurrentNote(e.target.value)}
            placeholder="Enter notes about this day's schedule..."
            onFocus={(e) => e.target.style.borderColor = "#FF4040"}
            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", gap: "10px" }}>
            <button 
              onClick={saveNote} 
              style={{ 
                flex: 1,
                padding: "10px 20px", 
                backgroundColor: "#FF4040", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#cc0000"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#FF4040"}
            >
              💾 Save Note
            </button>
            <button 
              onClick={() => setShowNotePopup(false)} 
              style={{ 
                flex: 1,
                padding: "10px 20px", 
                backgroundColor: "#666", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#555"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#666"}
            >
              Cancel
            </button>
          </div>
        </Popup>
      </div>
    </Layout>
  );
}
