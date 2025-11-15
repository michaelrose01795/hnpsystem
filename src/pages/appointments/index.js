// ✅ Imports converted to use absolute alias "@/" // comment
// file location: src/pages/appointments/index.js // comment
"use client"; // comment
// comment
import React, { useState, useEffect } from "react"; // Import React and useState/useEffect hooks // comment
import Layout from "@/components/Layout"; // Main layout wrapper // comment
import Popup from "@/components/popups/Popup"; // Reusable popup modal // comment
import { useRouter } from "next/router"; // For reading query params // comment
import {  // comment
  getAllJobs,  // comment
  createOrUpdateAppointment,  // comment
  getJobByNumberOrReg, // comment
  getJobsByDate // ✅ NEW: Get appointments by date // comment
} from "@/lib/database/jobs"; // DB functions // comment
// comment
const techsDefault = 6; // Default number of technicians available per day // comment
// comment
// Generate list of dates excluding Sundays // comment
const generateDates = (daysAhead = 60) => { // comment
  const result = []; // comment
  const today = new Date(); // comment
  let count = 0; // comment
  let current = new Date(today); // comment
// comment
  while (count < daysAhead) { // comment
    if (current.getDay() !== 0) { // Skip Sundays // comment
      result.push(new Date(current)); // comment
      count++; // comment
    } // comment
    current.setDate(current.getDate() + 1); // comment
  } // comment
  return result; // comment
}; // comment
// comment
// Generate time slots from 8:00 AM to 5:00 PM in 30-minute intervals // comment
const generateTimeSlots = () => { // comment
  const slots = []; // comment
  for (let hour = 8; hour <= 17; hour++) { // 8 AM to 5 PM // comment
    slots.push(`${hour.toString().padStart(2, "0")}:00`); // comment
    if (hour < 17) slots.push(`${hour.toString().padStart(2, "0")}:30`); // comment
  } // comment
  return slots; // comment
}; // comment
// comment
// ---------------- Utility Functions ---------------- // comment
// ✅ Display vehicle info using new database fields // comment
const getVehicleDisplay = (job) => { // comment
  // Try makeModel first (combined field), then fall back to make + model // comment
  if (job.makeModel) return job.makeModel; // comment
// comment
  const make = job.make || ""; // comment
  const model = job.model || ""; // comment
  const year = job.year || ""; // comment
  return [year, make, model].filter(Boolean).join(" ") || "-"; // comment
}; // comment
// comment
export default function Appointments() { // comment
  const router = useRouter(); // comment
  const jobQueryParam = Array.isArray(router.query.jobNumber) // comment
    ? router.query.jobNumber[0] // comment
    : router.query.jobNumber; // comment
// comment
  // ---------------- States ---------------- // comment
  const [jobs, setJobs] = useState([]); // comment
  const [dates, setDates] = useState([]); // comment
  const [selectedDay, setSelectedDay] = useState(new Date()); // comment
  const [notes, setNotes] = useState({}); // comment
  const [showNotePopup, setShowNotePopup] = useState(false); // comment
  const [currentNote, setCurrentNote] = useState(""); // comment
  const [jobNumber, setJobNumber] = useState(""); // comment
  const [time, setTime] = useState(""); // comment
  const [highlightJob, setHighlightJob] = useState(""); // comment
  const [techHours, setTechHours] = useState({}); // comment
  const [showTechHoursEditor, setShowTechHoursEditor] = useState(false); // comment
  const [searchQuery, setSearchQuery] = useState(""); // comment
  const [timeSlots] = useState(generateTimeSlots()); // comment
  const [isLoading, setIsLoading] = useState(false); // comment
// comment
  // ---------------- Fetch Jobs ---------------- // comment
  const fetchJobs = async () => { // comment
    console.log("📋 Fetching all jobs..."); // comment
    setIsLoading(true); // comment
// comment
    try { // comment
      const jobsFromDb = await getAllJobs(); // comment
      console.log("✅ Jobs fetched:", jobsFromDb.length); // comment
// comment
      // ✅ Filter only jobs with appointments // comment
      const jobsWithAppointments = jobsFromDb.filter(job => job.appointment); // comment
      console.log("✅ Jobs with appointments:", jobsWithAppointments.length); // comment
// comment
      setJobs(jobsWithAppointments); // comment
    } catch (error) { // comment
      console.error("❌ Error fetching jobs:", error); // comment
      alert("Failed to load appointments. Please refresh the page."); // comment
    } finally { // comment
      setIsLoading(false); // comment
    } // comment
  }; // comment
// comment
  useEffect(() => { // comment
    setDates(generateDates(60)); // comment
    fetchJobs(); // comment
  }, []); // comment
// comment
  // ✅ Handle jobNumber from URL parameters // comment
  useEffect(() => { // comment
    if (!router.isReady) return; // comment
    const jobParam = typeof jobQueryParam === "string" ? jobQueryParam : ""; // comment
    if (jobParam.trim().length > 0) { // comment
      setJobNumber(jobParam); // comment
      const existingJob = jobs.find((j) => j.jobNumber.toString() === jobParam || j.id.toString() === jobParam); // comment
      if (existingJob && existingJob.appointment) { // comment
        setSelectedDay(new Date(existingJob.appointment.date)); // comment
        setTime(existingJob.appointment.time); // comment
      } // comment
    } // comment
  }, [router.isReady, jobQueryParam, jobs]); // comment
// comment
  // ---------------- Notes ---------------- // comment
  const handleAddNote = (date) => { // comment
    setSelectedDay(date); // comment
    const dateKey = date.toDateString(); // comment
    setCurrentNote(notes[dateKey] || ""); // comment
    setShowNotePopup(true); // comment
  }; // comment
// comment
  const saveNote = () => { // comment
    setNotes({ ...notes, [selectedDay.toDateString()]: currentNote }); // comment
    setShowNotePopup(false); // comment
    // ✅ TODO: Save note to database (create appointments_notes table or use job_notes) // comment
  }; // comment
// comment
  // ---------------- Add / Update Appointment ---------------- // comment
  const handleAddAppointment = async (customDate) => { // comment
    const appointmentDate = customDate || (selectedDay ? selectedDay.toISOString().split("T")[0] : null); // comment
// comment
    // ✅ Validation // comment
    if (!jobNumber || jobNumber.trim() === "") { // comment
      alert("❌ Error: Job number is required"); // comment
      return; // comment
    } // comment
    if (!appointmentDate) { // comment
      alert("❌ Error: Please select a date"); // comment
      return; // comment
    } // comment
    if (!time || time === "") { // comment
      alert("❌ Error: Please select a time"); // comment
      return; // comment
    } // comment
// comment
    setIsLoading(true); // comment
// comment
    try { // comment
      const normalizedJobNumber = jobNumber.toString().trim(); // comment
      console.log("🔍 Attempting to book appointment for job:", normalizedJobNumber); // comment
// comment
      // ✅ Look for job in local state first // comment
      let job = jobs.find((j) =>  // comment
        j.jobNumber?.toString() === normalizedJobNumber ||  // comment
        j.id?.toString() === normalizedJobNumber // comment
      ); // comment
// comment
      // ✅ If not found locally, fetch from database // comment
      if (!job) { // comment
        console.log(`📡 Job ${normalizedJobNumber} not found locally, fetching from DB...`); // comment
        const fetchedJob = await getJobByNumberOrReg(normalizedJobNumber); // comment
// comment
        if (!fetchedJob) { // comment
          alert(`❌ Error: Job ${normalizedJobNumber} does not exist in the system.\n\nPlease create the job card first before booking an appointment.`); // comment
          setIsLoading(false); // comment
          return; // comment
        } // comment
// comment
        job = fetchedJob; // comment
        console.log("✅ Job fetched from database:", job); // comment
      } // comment
// comment
      // ✅ Create or update appointment using job number // comment
      console.log("📅 Creating appointment with:", { // comment
        jobNumber: job.jobNumber, // comment
        date: appointmentDate, // comment
        time: time // comment
      }); // comment
// comment
      const appointmentResult = await createOrUpdateAppointment( // comment
        job.jobNumber, // Use job number for appointment creation // comment
        appointmentDate, // comment
        time, // comment
        currentNote || null // ✅ Pass notes if available // comment
      ); // comment
// comment
      if (!appointmentResult.success) { // comment
        const errorMessage = appointmentResult.error?.message || "Unknown error occurred"; // comment
        console.error("❌ Appointment booking failed:", errorMessage); // comment
        alert(`❌ Error booking appointment:\n\n${errorMessage}\n\nPlease check the job number and try again.`); // comment
        setIsLoading(false); // comment
        return; // comment
      } // comment
// comment
      console.log("✅ Appointment booked successfully:", appointmentResult); // comment
// comment
      // ✅ Update local state with new appointment data // comment
      const updatedJob = { // comment
        ...job, // comment
        appointment: {  // comment
          appointmentId: appointmentResult.data?.appointment?.appointment_id, // comment
          date: appointmentDate,  // comment
          time: time, // comment
          notes: currentNote || "", // comment
          status: "Scheduled" // comment
        }, // comment
        status: "Booked" // comment
      }; // comment
// comment
      const jobIndex = jobs.findIndex((j) => j.id === job.id); // comment
      if (jobIndex !== -1) { // comment
        const updatedJobs = [...jobs]; // comment
        updatedJobs[jobIndex] = updatedJob; // comment
        setJobs(updatedJobs); // comment
      } else { // comment
        setJobs([...jobs, updatedJob]); // comment
      } // comment
// comment
      // ✅ Visual feedback // comment
      setHighlightJob(job.jobNumber || job.id.toString()); // comment
      setSelectedDay(new Date(appointmentDate)); // comment
      setTimeout(() => setHighlightJob(""), 3000); // comment
// comment
      // ✅ Success notification // comment
      alert( // comment
        `✅ Appointment booked successfully!\n\n` + // comment
        `Job Number: ${job.jobNumber}\n` + // comment
        `Customer: ${job.customer}\n` + // comment
        `Vehicle: ${job.reg}\n` + // comment
        `Date: ${appointmentDate}\n` + // comment
        `Time: ${time}` // comment
      ); // comment
// comment
      // ✅ Clear form // comment
      setJobNumber(""); // comment
      setTime(""); // comment
      setCurrentNote(""); // comment
// comment
    } catch (error) { // comment
      console.error("❌ Unexpected error booking appointment:", error); // comment
      alert(`❌ Unexpected error:\n\n${error.message}\n\nPlease try again or contact support.`); // comment
    } finally { // comment
      setIsLoading(false); // comment
    } // comment
  }; // comment
// comment
  // ---------------- Utilities ---------------- // comment
  const formatDate = (dateObj) =>  // comment
    dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); // comment
// comment
  const formatDateNoYear = (dateObj) =>  // comment
    dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); // comment
// comment
  const isSaturday = (date) => date.getDay() === 6; // comment
// comment
  const getTechHoursForDay = (date) => techHours[date.toDateString()] || techsDefault; // comment
// comment
  const handleTechHoursChange = (e) => { // comment
    const value = parseInt(e.target.value) || 0; // comment
    setTechHours({ ...techHours, [selectedDay.toDateString()]: value }); // comment
    // ✅ TODO: Save to database or localStorage // comment
  }; // comment
// comment
  const toggleTechHoursEditor = () => setShowTechHoursEditor(!showTechHoursEditor); // comment
// comment
  // ✅ Enhanced job counts with new job categories - FIXED to handle non-array requests // comment
  const getJobCounts = (date) => { // comment
    const jobsForDate = jobs.filter((j) => j.appointment?.date === date.toISOString().split("T")[0]); // comment
// comment
    return { // comment
      totalJobs: jobsForDate.length, // comment
      services: jobsForDate.filter((j) =>  // comment
        j.jobCategories?.includes("Service") ||  // comment
        j.type?.toLowerCase().includes("service") // comment
      ).length, // comment
      MOT: jobsForDate.filter((j) =>  // comment
        j.jobCategories?.includes("MOT") ||  // comment
        j.type?.toLowerCase().includes("mot") // comment
      ).length, // comment
      diagnosis: jobsForDate.filter((j) =>  // comment
        j.jobCategories?.includes("Diagnostic") ||  // comment
        j.type?.toLowerCase().includes("diagnosis") || // comment
        j.type?.toLowerCase().includes("diagnostic") // comment
      ).length, // comment
      other: jobsForDate.filter((j) =>  // comment
        !j.jobCategories?.includes("MOT") && // comment
        !j.jobCategories?.includes("Service") && // comment
        !j.jobCategories?.includes("Diagnostic") && // comment
        !j.type?.toLowerCase().includes("mot") && // comment
        !j.type?.toLowerCase().includes("service") && // comment
        !j.type?.toLowerCase().includes("diagnosis") // comment
      ).length, // comment
      // ✅ FIXED: Calculate total estimated hours safely checking if requests is an array // comment
      totalHours: jobsForDate.reduce((sum, j) => { // comment
        // ✅ Check if requests exists and is an array before using reduce // comment
        if (!j.requests || !Array.isArray(j.requests)) { // comment
          return sum; // Return current sum if no valid requests array // comment
        } // comment
// comment
        const jobHours = j.requests.reduce((reqSum, req) => { // comment
          return reqSum + (parseFloat(req.time) || 0); // comment
        }, 0); // comment
// comment
        return sum + jobHours; // comment
      }, 0).toFixed(1), // comment
    }; // comment
  }; // comment
// comment
  // ---------------- Filtered Jobs for Selected Day ---------------- // comment
  const jobsForDay = jobs.filter((j) => j.appointment?.date === selectedDay.toISOString().split("T")[0]); // comment
// comment
  const filteredJobs = jobsForDay.filter((job) => { // comment
    const query = searchQuery.toLowerCase(); // comment
    return ( // comment
      job.jobNumber?.toString().includes(query) ||  // comment
      job.id?.toString().includes(query) || // comment
      job.customer?.toLowerCase().includes(query) ||  // comment
      job.reg?.toLowerCase().includes(query) || // comment
      job.makeModel?.toLowerCase().includes(query) // comment
    ); // comment
  }); // comment
// comment
  // ✅ Sort jobs by appointment time // comment
  const sortedJobs = filteredJobs.sort((a, b) => { // comment
    const timeA = a.appointment?.time || "00:00"; // comment
    const timeB = b.appointment?.time || "00:00"; // comment
    return timeA.localeCompare(timeB); // comment
  }); // comment
// comment
  // ---------------- Render ---------------- // comment
  return ( // comment
    <Layout> // comment
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "8px 16px" }}> // comment
// comment
        {/* Top Bar */} // comment
        <div style={{  // comment
          display: "flex",  // comment
          gap: "12px",  // comment
          alignItems: "center",  // comment
          marginBottom: "12px",  // comment
          padding: "12px",  // comment
          backgroundColor: "#fff",  // comment
          borderRadius: "8px",  // comment
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)"  // comment
        }}> // comment
          <button  // comment
            onClick={() => handleAddNote(selectedDay)}  // comment
            disabled={isLoading}  // comment
            style={{  // comment
              padding: "10px 20px",  // comment
              backgroundColor: isLoading ? "#ccc" : "#FF4040",  // comment
              color: "white",  // comment
              border: "none",  // comment
              borderRadius: "8px",  // comment
              cursor: isLoading ? "not-allowed" : "pointer",  // comment
              fontWeight: "500",  // comment
              fontSize: "14px", // comment
              transition: "background-color 0.2s" // comment
            }} // comment
            onMouseEnter={(e) => !isLoading && (e.target.style.backgroundColor = "#cc0000")} // comment
            onMouseLeave={(e) => !isLoading && (e.target.style.backgroundColor = "#FF4040")} // comment
          > // comment
            📝 Add Note // comment
          </button> // comment
// comment
          <input  // comment
            type="text"  // comment
            value={searchQuery}  // comment
            onChange={(e) => setSearchQuery(e.target.value)}  // comment
            placeholder="Search by Job #, Name, Reg, or Vehicle..."  // comment
            disabled={isLoading}  // comment
            style={{  // comment
              flex: 1,  // comment
              padding: "10px 16px",  // comment
              borderRadius: "8px",  // comment
              border: "1px solid #e0e0e0",  // comment
              fontSize: "14px", // comment
              outline: "none" // comment
            }} // comment
            onFocus={(e) => e.target.style.borderColor = "#FF4040"} // comment
            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} // comment
          /> // comment
// comment
          <input  // comment
            type="text"  // comment
            value={jobNumber}  // comment
            onChange={(e) => setJobNumber(e.target.value)}  // comment
            placeholder="Job Number"  // comment
            disabled={isLoading}  // comment
            style={{  // comment
              width: "140px",  // comment
              padding: "10px 16px",  // comment
              borderRadius: "8px",  // comment
              border: "1px solid #e0e0e0",  // comment
              fontSize: "14px", // comment
              outline: "none" // comment
            }} // comment
            onFocus={(e) => e.target.style.borderColor = "#FF4040"} // comment
            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} // comment
          /> // comment
// comment
          <select  // comment
            value={time}  // comment
            onChange={(e) => setTime(e.target.value)}  // comment
            disabled={isLoading}  // comment
            style={{  // comment
              width: "120px",  // comment
              padding: "10px 12px",  // comment
              borderRadius: "8px",  // comment
              border: "1px solid #e0e0e0",  // comment
              fontSize: "14px", // comment
              cursor: "pointer", // comment
              outline: "none" // comment
            }} // comment
          > // comment
            <option value="">Select time</option> // comment
            {timeSlots.map((slot) => ( // comment
              <option key={slot} value={slot}>{slot}</option> // comment
            ))} // comment
          </select> // comment
// comment
          <button  // comment
            onClick={() => handleAddAppointment(selectedDay.toISOString().split("T")[0])}  // comment
            disabled={isLoading}  // comment
            style={{  // comment
              padding: "10px 20px",  // comment
              backgroundColor: isLoading ? "#ccc" : "#FF4040",  // comment
              color: "white",  // comment
              border: "none",  // comment
              borderRadius: "8px",  // comment
              cursor: isLoading ? "not-allowed" : "pointer",  // comment
              fontWeight: "600",  // comment
              fontSize: "14px", // comment
              transition: "background-color 0.2s" // comment
            }} // comment
            onMouseEnter={(e) => !isLoading && (e.target.style.backgroundColor = "#cc0000")} // comment
            onMouseLeave={(e) => !isLoading && (e.target.style.backgroundColor = "#FF4040")} // comment
          > // comment
            {isLoading ? "Booking..." : "📅 Book Appointment"} // comment
          </button> // comment
        </div> // comment
// comment
        {/* Calendar Table Container */} // comment
        <div style={{  // comment
          flex: "0 0 auto",  // comment
          maxHeight: "calc(8 * 42px + 60px)",  // comment
          overflowY: "auto",  // comment
          marginBottom: "12px",  // comment
          borderRadius: "10px",  // comment
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",  // comment
          backgroundColor: "#fff"  // comment
        }}> // comment
          <table style={{ width: "100%", borderCollapse: "collapse" }}> // comment
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}> // comment
              <tr style={{ backgroundColor: "#f6f6f6", borderBottom: "2px solid #FF4040" }}> // comment
                {["Day/Date","Availability","Total Hours","Total Jobs","Services","MOT","Diagnosis","Other","Notes"].map(header => ( // comment
                  <th  // comment
                    key={header}  // comment
                    style={{  // comment
                      textAlign: "left",  // comment
                      padding: "10px 12px",  // comment
                      fontWeight: "600",  // comment
                      fontSize: "14px",  // comment
                      color: "#333",  // comment
                      borderBottom: "1px solid #ddd",  // comment
                      background: "#f9f9f9",  // comment
                      position: "sticky",  // comment
                      top: 0  // comment
                    }} // comment
                  > // comment
                    {header} // comment
                  </th> // comment
                ))} // comment
              </tr> // comment
            </thead> // comment
            <tbody> // comment
              {dates.map((date) => { // comment
                const dateKey = date.toDateString(); // comment
                const counts = getJobCounts(date); // comment
                const isSelected = selectedDay.toDateString() === date.toDateString(); // comment
                const isSat = isSaturday(date); // comment
// comment
                return ( // comment
                  <tr  // comment
                    key={dateKey}  // comment
                    onClick={() => setSelectedDay(date)}  // comment
                    style={{  // comment
                      cursor: "pointer",  // comment
                      backgroundColor: isSelected ? "#FFF2F2" : isSat ? "#FFF8E1" : "#fff", // comment
                      transition: "background-color 0.2s" // comment
                    }} // comment
                    onMouseEnter={(e) => { // comment
                      if (!isSelected) { // comment
                        e.currentTarget.style.backgroundColor = "#f5f5f5"; // comment
                      } // comment
                    }} // comment
                    onMouseLeave={(e) => { // comment
                      if (!isSelected) { // comment
                        e.currentTarget.style.backgroundColor = isSat ? "#FFF8E1" : "#fff"; // comment
                      } // comment
                    }} // comment
                  > // comment
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontWeight: isSelected ? "600" : "400" }}> // comment
                      {formatDate(date)} // comment
                    </td> // comment
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}> // comment
                      {getTechHoursForDay(date)} techs // comment
                    </td> // comment
                    <td style={{  // comment
                      padding: "10px 12px",  // comment
                      borderBottom: "1px solid #eee", // comment
                      color: counts.totalHours > 0 ? "#333" : "#999" // comment
                    }}> // comment
                      {counts.totalHours}h // comment
                    </td> // comment
                    <td style={{  // comment
                      padding: "10px 12px",  // comment
                      borderBottom: "1px solid #eee", // comment
                      fontWeight: counts.totalJobs > 0 ? "600" : "400" // comment
                    }}> // comment
                      {counts.totalJobs} // comment
                    </td> // comment
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}> // comment
                      {counts.services} // comment
                    </td> // comment
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}> // comment
                      {counts.MOT} // comment
                    </td> // comment
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}> // comment
                      {counts.diagnosis} // comment
                    </td> // comment
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}> // comment
                      {counts.other} // comment
                    </td> // comment
                    <td style={{  // comment
                      padding: "10px 12px",  // comment
                      borderBottom: "1px solid #eee", // comment
                      fontSize: "13px", // comment
                      color: "#666", // comment
                      maxWidth: "200px", // comment
                      overflow: "hidden", // comment
                      textOverflow: "ellipsis", // comment
                      whiteSpace: "nowrap" // comment
                    }}> // comment
                      {notes[dateKey] || ""} // comment
                    </td> // comment
                  </tr> // comment
                ); // comment
              })} // comment
            </tbody> // comment
          </table> // comment
        </div> // comment
// comment
        {/* Jobs for Selected Day Section */} // comment
        <div style={{  // comment
          flex: "0 0 40%",  // comment
          marginBottom: "8px",  // comment
          border: "1px solid #e0e0e0",  // comment
          borderRadius: "10px",  // comment
          padding: "16px",  // comment
          backgroundColor: "#fff",  // comment
          boxShadow: "0 2px 6px rgba(0,0,0,0.05)",  // comment
          overflowY: "auto"  // comment
        }}> // comment
          <div style={{  // comment
            display: "flex",  // comment
            justifyContent: "space-between",  // comment
            alignItems: "center",  // comment
            marginBottom: "16px"  // comment
          }}> // comment
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}> // comment
              Jobs for <span style={{ color: "#FF4040" }}>{formatDateNoYear(selectedDay)}</span> // comment
            </h3> // comment
            <span style={{ // comment
              padding: "6px 14px", // comment
              backgroundColor: "#f0f0f0", // comment
              borderRadius: "16px", // comment
              fontSize: "14px", // comment
              fontWeight: "600", // comment
              color: "#333" // comment
            }}> // comment
              {sortedJobs.length} job{sortedJobs.length !== 1 ? 's' : ''} // comment
            </span> // comment
          </div> // comment
// comment
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}> // comment
            <button // comment
              style={{ // comment
                padding: "8px 16px", // comment
                border: "2px solid #FF4040", // comment
                backgroundColor: "#FFF2F2", // comment
                color: "#FF4040", // comment
                borderRadius: "8px", // comment
                cursor: "pointer", // comment
                fontWeight: "600", // comment
                fontSize: "13px" // comment
              }} // comment
            > // comment
              All Jobs ({sortedJobs.length}) // comment
            </button> // comment
// comment
            <button // comment
              onClick={toggleTechHoursEditor} // comment
              style={{ // comment
                padding: "8px 16px", // comment
                border: "1px solid #e0e0e0", // comment
                backgroundColor: showTechHoursEditor ? "#FFF2F2" : "white", // comment
                color: "#666", // comment
                borderRadius: "8px", // comment
                cursor: "pointer", // comment
                fontWeight: "500", // comment
                fontSize: "13px", // comment
                transition: "all 0.2s" // comment
              }} // comment
              onMouseEnter={(e) => e.target.style.backgroundColor = "#f5f5f5"} // comment
              onMouseLeave={(e) => e.target.style.backgroundColor = showTechHoursEditor ? "#FFF2F2" : "white"} // comment
            > // comment
              ⚙️ Tech Hours // comment
            </button> // comment
          </div> // comment
// comment
          {showTechHoursEditor && ( // comment
            <div style={{  // comment
              marginBottom: "16px",  // comment
              padding: "16px",  // comment
              border: "2px solid #FF4040",  // comment
              borderRadius: "8px",  // comment
              background: "#FFF5F5"  // comment
            }}> // comment
              <label style={{ fontSize: "14px", fontWeight: "600", color: "#333", display: "block", marginBottom: "8px" }}> // comment
                Tech Hours for {formatDateNoYear(selectedDay)}: // comment
              </label> // comment
              <input  // comment
                type="number"  // comment
                min="0"  // comment
                max="20" // comment
                value={getTechHoursForDay(selectedDay)}  // comment
                onChange={handleTechHoursChange}  // comment
                style={{  // comment
                  padding: "8px 12px",  // comment
                  width: "100px",  // comment
                  borderRadius: "6px",  // comment
                  border: "1px solid #ccc", // comment
                  fontSize: "14px", // comment
                  fontWeight: "600" // comment
                }}  // comment
              /> // comment
              <span style={{ marginLeft: "8px", fontSize: "14px", color: "#666" }}> // comment
                technicians available // comment
              </span> // comment
            </div> // comment
          )} // comment
// comment
          {/* ✅ Enhanced Jobs Table */} // comment
          <div style={{ overflowX: "auto" }}> // comment
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}> // comment
              <thead> // comment
                <tr> // comment
                  {[ // comment
                    "Time", // comment
                    "Job #", // comment
                    "Reg", // comment
                    "Vehicle", // comment
                    "Customer", // comment
                    "Job Type", // comment
                    "Waiting Status", // ✅ NEW // comment
                    "Source", // ✅ NEW // comment
                    "Est. Hours" // ✅ NEW // comment
                  ].map(head => ( // comment
                    <th  // comment
                      key={head}  // comment
                      style={{  // comment
                        textAlign: "left",  // comment
                        padding: "10px 12px",  // comment
                        background: "#f6f6f6",  // comment
                        fontWeight: "600",  // comment
                        borderBottom: "2px solid #FF4040",  // comment
                        position: "sticky",  // comment
                        top: 0,  // comment
                        zIndex: 1, // comment
                        whiteSpace: "nowrap" // comment
                      }} // comment
                    > // comment
                      {head} // comment
                    </th> // comment
                  ))} // comment
                </tr> // comment
              </thead> // comment
              <tbody> // comment
                {sortedJobs.length > 0 ? ( // comment
                  sortedJobs.map((job, idx) => ( // comment
                    <tr  // comment
                      key={idx}  // comment
                      style={{  // comment
                        backgroundColor: highlightJob === job.jobNumber ? "#D0F0C0" : idx % 2 === 0 ? "#fafafa" : "transparent",  // comment
                        transition: "background-color 0.5s", // comment
                        cursor: "pointer" // comment
                      }} // comment
                      onClick={() => window.open(`/job-cards/${job.jobNumber}`, '_blank')} // comment
                      onMouseEnter={(e) => { // comment
                        if (highlightJob !== job.jobNumber) { // comment
                          e.currentTarget.style.backgroundColor = "#f0f0f0"; // comment
                        } // comment
                      }} // comment
                      onMouseLeave={(e) => { // comment
                        if (highlightJob !== job.jobNumber) { // comment
                          e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#fafafa" : "transparent"; // comment
                        } // comment
                      }} // comment
                    > // comment
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontWeight: "600" }}> // comment
                        {job.appointment?.time || "-"} // comment
                      </td> // comment
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee", color: "#FF4040", fontWeight: "600" }}> // comment
                        {job.jobNumber || job.id || "-"} // comment
                      </td> // comment
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontWeight: "500" }}> // comment
                        {job.reg || "-"} // comment
                      </td> // comment
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}> // comment
                        {getVehicleDisplay(job)} // comment
                      </td> // comment
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}> // comment
                        {job.customer || "-"} // comment
                      </td> // comment
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}> // comment
                        {/* ✅ Show job categories as badges */} // comment
                        {job.jobCategories && job.jobCategories.length > 0 ? ( // comment
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}> // comment
                            {job.jobCategories.map((cat, i) => ( // comment
                              <span  // comment
                                key={i} // comment
                                style={{ // comment
                                  padding: "2px 8px", // comment
                                  backgroundColor: "#e0e0e0", // comment
                                  borderRadius: "10px", // comment
                                  fontSize: "11px", // comment
                                  fontWeight: "600" // comment
                                }} // comment
                              > // comment
                                {cat} // comment
                              </span> // comment
                            ))} // comment
                          </div> // comment
                        ) : ( // comment
                          job.type || "-" // comment
                        )} // comment
                      </td> // comment
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}> // comment
                        {/* ✅ Waiting status with color coding */} // comment
                        {job.waitingStatus && job.waitingStatus !== "Neither" ? ( // comment
                          <span style={{ // comment
                            padding: "4px 10px", // comment
                            borderRadius: "12px", // comment
                            fontSize: "11px", // comment
                            fontWeight: "600", // comment
                            backgroundColor:  // comment
                              job.waitingStatus === "Waiting" ? "#ffebee" : // comment
                              job.waitingStatus === "Loan Car" ? "#e3f2fd" : // comment
                              "#e8f5e9", // comment
                            color: // comment
                              job.waitingStatus === "Waiting" ? "#c62828" : // comment
                              job.waitingStatus === "Loan Car" ? "#1565c0" : // comment
                              "#2e7d32" // comment
                          }}> // comment
                            {job.waitingStatus} // comment
                          </span> // comment
                        ) : ( // comment
                          "-" // comment
                        )} // comment
                      </td> // comment
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}> // comment
                        {/* ✅ Job source badge */} // comment
                        <span style={{ // comment
                          padding: "4px 10px", // comment
                          borderRadius: "12px", // comment
                          fontSize: "11px", // comment
                          fontWeight: "600", // comment
                          backgroundColor: job.jobSource === "Warranty" ? "#fff3e0" : "#e8f5e9", // comment
                          color: job.jobSource === "Warranty" ? "#e65100" : "#2e7d32" // comment
                        }}> // comment
                          {job.jobSource || "Retail"} // comment
                        </span> // comment
                      </td> // comment
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontWeight: "600" }}> // comment
                        {/* ✅ FIXED: Calculate total estimated hours safely */} // comment
                        {job.requests && Array.isArray(job.requests) && job.requests.length > 0 ? ( // comment
                          job.requests.reduce((sum, req) => sum + (parseFloat(req.time) || 0), 0).toFixed(1) + "h" // comment
                        ) : ( // comment
                          "-" // comment
                        )} // comment
                      </td> // comment
                    </tr> // comment
                  )) // comment
                ) : ( // comment
                  <tr> // comment
                    <td  // comment
                      colSpan="9"  // comment
                      style={{  // comment
                        padding: "40px",  // comment
                        textAlign: "center",  // comment
                        color: "#999", // comment
                        fontSize: "14px" // comment
                      }} // comment
                    > // comment
                      No appointments booked for this day // comment
                    </td> // comment
                  </tr> // comment
                )} // comment
              </tbody> // comment
            </table> // comment
          </div> // comment
        </div> // comment
// comment
        {/* Add Note Popup */} // comment
        <Popup isOpen={showNotePopup} onClose={() => setShowNotePopup(false)}> // comment
          <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "20px", fontWeight: "600" }}> // comment
            Add Note for {formatDateNoYear(selectedDay)} // comment
          </h3> // comment
          <textarea  // comment
            style={{  // comment
              width: "100%",  // comment
              height: "120px",  // comment
              padding: "12px",  // comment
              borderRadius: "8px",  // comment
              border: "1px solid #e0e0e0", // comment
              fontSize: "14px", // comment
              fontFamily: "inherit", // comment
              resize: "vertical", // comment
              outline: "none" // comment
            }}  // comment
            value={currentNote}  // comment
            onChange={(e) => setCurrentNote(e.target.value)} // comment
            placeholder="Enter notes about this day's schedule..." // comment
            onFocus={(e) => e.target.style.borderColor = "#FF4040"} // comment
            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"} // comment
          /> // comment
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", gap: "10px" }}> // comment
            <button  // comment
              onClick={saveNote}  // comment
              style={{  // comment
                flex: 1, // comment
                padding: "10px 20px",  // comment
                backgroundColor: "#FF4040",  // comment
                color: "white",  // comment
                border: "none",  // comment
                borderRadius: "8px",  // comment
                cursor: "pointer", // comment
                fontWeight: "600", // comment
                fontSize: "14px", // comment
                transition: "background-color 0.2s" // comment
              }} // comment
              onMouseEnter={(e) => e.target.style.backgroundColor = "#cc0000"} // comment
              onMouseLeave={(e) => e.target.style.backgroundColor = "#FF4040"} // comment
            > // comment
              💾 Save Note // comment
            </button> // comment
            <button  // comment
              onClick={() => setShowNotePopup(false)}  // comment
              style={{  // comment
                flex: 1, // comment
                padding: "10px 20px",  // comment
                backgroundColor: "#666",  // comment
                color: "white",  // comment
                border: "none",  // comment
                borderRadius: "8px",  // comment
                cursor: "pointer", // comment
                fontWeight: "600", // comment
                fontSize: "14px", // comment
                transition: "background-color 0.2s" // comment
              }} // comment
              onMouseEnter={(e) => e.target.style.backgroundColor = "#555"} // comment
              onMouseLeave={(e) => e.target.style.backgroundColor = "#666"} // comment
            > // comment
              Cancel // comment
            </button> // comment
          </div> // comment
        </Popup> // comment
      </div> // comment
    </Layout> // comment
  ); // comment
} // comment
