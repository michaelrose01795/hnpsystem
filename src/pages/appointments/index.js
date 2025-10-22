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
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    if (hour < 17) slots.push(`${hour.toString().padStart(2, "0")}:30`);
  }
  return slots;
};

// ---------------- Utility Functions ----------------
// Display vehicle info in one string
const getVehicleDisplay = (job) => {
  const make = job.vehicle_make || "";
  const model = job.vehicle_model || "";
  const year = job.vehicle_year || "";
  return [year, make, model].filter(Boolean).join(" ") || "-";
};

export default function Appointments() {
  const searchParams = useSearchParams();

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
    const jobsFromDb = await getAllJobs();
    console.log("✅ Jobs fetched:", jobsFromDb.length);
    setJobs(jobsFromDb);
  };

  useEffect(() => {
    setDates(generateDates(60));
    fetchJobs();
  }, []);

  useEffect(() => {
    const jobParam = searchParams.get("jobNumber");
    if (jobParam) {
      setJobNumber(jobParam);
      const existingJob = jobs.find((j) => j.id.toString() === jobParam);
      if (existingJob) {
        if (existingJob.appointment) {
          setSelectedDay(new Date(existingJob.appointment.date));
          setTime(existingJob.appointment.time);
        }
      }
    }
  }, [searchParams, jobs]);

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
  };

  // ---------------- Add / Update Appointment ----------------
  const handleAddAppointment = async (customDate) => {
    const appointmentDate = customDate || (selectedDay ? selectedDay.toISOString().split("T")[0] : null);

    if (!jobNumber) return alert("❌ Error: Job number is required");
    if (!appointmentDate) return alert("❌ Error: Please select a date");
    if (!time) return alert("❌ Error: Please select a time");

    setIsLoading(true);

    try {
      const normalizedJobNumber = jobNumber.toString().trim(); // Normalize to string
      console.log("Attempting to book appointment for job ID:", normalizedJobNumber);

      // Look for job in local state using id
      let job = jobs.find((j) => j.id.toString() === normalizedJobNumber);

      // If not found, fetch from DB
      if (!job) {
        console.log(`Job ID ${normalizedJobNumber} not found locally, fetching from DB...`);
        const fetchedJob = await getJobByNumberOrReg(normalizedJobNumber);
        if (!fetchedJob) {
          alert(`❌ Error: Job ID ${normalizedJobNumber} does not exist. Please create the job first.`);
          setIsLoading(false);
          return;
        }
        job = fetchedJob;
      }

      console.log("Job found:", job);

      // Use job.id for appointment creation
      const appointmentResult = await createOrUpdateAppointment(
        job.id,
        appointmentDate,
        time
      );

      if (!appointmentResult.success) {
        const errorMessage = appointmentResult.error?.message || "Unknown error occurred";
        alert(`❌ Error booking appointment: ${errorMessage}`);
        setIsLoading(false);
        return;
      }

      // Update local state
      const updatedJob = {
        ...job,
        appointment: { date: appointmentDate, time },
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

      // Highlight briefly
      setHighlightJob(normalizedJobNumber);
      setSelectedDay(new Date(appointmentDate));
      setTimeout(() => setHighlightJob(""), 2000);

      alert(`✅ Appointment booked successfully!\n\nJob ID: ${normalizedJobNumber}\nDate: ${appointmentDate}\nTime: ${time}`);

      setJobNumber("");
      setTime("");

    } catch (error) {
      console.error("❌ Unexpected error:", error);
      alert(`❌ Unexpected error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------- Utilities ----------------
  const formatDate = (dateObj) => dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const formatDateNoYear = (dateObj) => dateObj.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const isSaturday = (date) => date.getDay() === 6;
  const getTechHoursForDay = (date) => techHours[date.toDateString()] || techsDefault;
  const handleTechHoursChange = (e) => setTechHours({ ...techHours, [selectedDay.toDateString()]: e.target.value });
  const toggleTechHoursEditor = () => setShowTechHoursEditor(!showTechHoursEditor);

  const getJobCounts = (date) => {
    const jobsForDate = jobs.filter((j) => j.appointment?.date === date.toISOString().split("T")[0]);
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

  // ---------------- Filtered Jobs for Selected Day ----------------
  const jobsForDay = jobs.filter((j) => j.appointment?.date === selectedDay.toISOString().split("T")[0]);
  const filteredJobs = jobsForDay.filter((job) => {
    const query = searchQuery.toLowerCase();
    return job.id.toString().includes(query) || job.customer?.toLowerCase().includes(query) || job.vehicle_reg?.toLowerCase().includes(query);
  });

  // ---------------- Render ----------------
  return (
    <Layout>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "8px 16px" }}>
        {/* Top Bar */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px", padding: "12px", backgroundColor: "#fff", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)" }}>
          <button onClick={() => handleAddNote(selectedDay)} disabled={isLoading} style={{ padding: "10px 20px", backgroundColor: isLoading ? "#ccc" : "#FF4040", color: "white", border: "none", borderRadius: "8px", cursor: isLoading ? "not-allowed" : "pointer", fontWeight: "500", fontSize: "14px" }}>Add Note</button>

          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by Job #, Name, or Reg..." disabled={isLoading} style={{ flex: 1, padding: "10px 16px", borderRadius: "8px", border: "1px solid #e0e0e0", fontSize: "14px" }} />

          <input type="text" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} placeholder="Job Number" disabled={isLoading} style={{ width: "140px", padding: "10px 16px", borderRadius: "8px", border: "1px solid #e0e0e0", fontSize: "14px" }} />

          <select value={time} onChange={(e) => setTime(e.target.value)} disabled={isLoading} style={{ width: "120px", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e0e0e0", fontSize: "14px" }}>
            <option value="">Select time</option>
            {timeSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
          </select>

          <button onClick={() => handleAddAppointment(selectedDay.toISOString().split("T")[0])} disabled={isLoading} style={{ padding: "10px 20px", backgroundColor: isLoading ? "#ccc" : "#FF4040", color: "white", border: "none", borderRadius: "8px", cursor: isLoading ? "not-allowed" : "pointer", fontWeight: "500", fontSize: "14px" }}>{isLoading ? "Booking..." : "Book Appointment"}</button>
        </div>

        {/* Calendar Table Container */}
        <div style={{ flex: "0 0 auto", maxHeight: "calc(14 * 42px + 60px)", overflowY: "auto", marginBottom: "12px", borderRadius: "10px", boxShadow: "0 2px 6px rgba(0,0,0,0.1)", backgroundColor: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr style={{ backgroundColor: "#f6f6f6", borderBottom: "2px solid #FF4040" }}>
                {["Day/Date","Availability","Total Hours","Total Jobs","Services","MOT","Diagnosis","Other","Notes"].map(header => <th key={header} style={{ textAlign: "left", padding: "10px 12px", fontWeight: "600", fontSize: "14px", color: "#333", borderBottom: "1px solid #ddd", background: "#f9f9f9", position: "sticky", top: 0 }}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => {
                const dateKey = date.toDateString();
                const counts = getJobCounts(date);
                return (
                  <tr key={dateKey} onClick={() => setSelectedDay(date)} style={{ cursor: "pointer", backgroundColor: selectedDay.toDateString() === date.toDateString() ? "#FFF2F2" : isSaturday(date) ? "#FFF8E1" : "#fff" }}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{formatDate(date)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{getTechHoursForDay(date)} techs</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>0</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{counts.totalJobs}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{counts.services}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{counts.MOT}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{counts.diagnosis}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{counts.other}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{notes[dateKey] || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Jobs for Selected Day Section */}
        <div style={{ flex: "0 0 40%", marginBottom: "8px", border: "1px solid #ccc", borderRadius: "10px", padding: "12px", backgroundColor: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.05)", overflowY: "auto" }}>
          <h3 style={{ marginBottom: "12px" }}>Jobs for <span style={{ color: "#FF4040" }}>{formatDateNoYear(selectedDay)}</span></h3>

          <div style={{ display: "flex", gap: "12px", marginBottom: "8px" }}>
            {["All Jobs", "MOT", "Tech Hours"].map((tab) => (
              <div key={tab} style={{ padding: "6px 12px", border: "1px solid #FF4040", color: tab === "Tech Hours" ? "#FF4040" : "#000", borderRadius: "6px", cursor: "pointer" }} onClick={() => { if (tab === "Tech Hours") toggleTechHoursEditor(); }}>{tab}</div>
            ))}
          </div>

          {showTechHoursEditor && (
            <div style={{ marginBottom: "12px", padding: "12px", border: "1px solid #FF4040", borderRadius: "6px", background: "#FFF5F5" }}>
              <label>Tech Hours for {formatDateNoYear(selectedDay)}:</label>
              <input type="number" min="0" value={getTechHoursForDay(selectedDay)} onChange={handleTechHoursChange} style={{ marginLeft: "8px", padding: "6px", width: "60px", borderRadius: "4px", border: "1px solid #ccc" }} />
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Job #","Reg","Vehicle","Customer","Time In","Time Out","Reason","Total Time","Time on Job","Waiting","Collection","Loan Car","MOT","Wash","Address"].map(head => <th key={head} style={{ textAlign: "left", padding: "8px 10px", background: "#f6f6f6", fontWeight: "600", borderBottom: "2px solid #FF4040", position: "sticky", top: 0, zIndex: 1 }}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job, idx) => (
                  <tr key={idx} style={{ backgroundColor: highlightJob === job.jobNumber ? "#D0F0C0" : "transparent", transition: "background-color 0.5s" }}>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.jobNumber || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.reg || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{getVehicleDisplay(job)}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.customer || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.appointment?.time || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>-</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.reason || job.description || job.type || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.totalTime || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.timeOnJob || "-"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}><input type="checkbox" checked={job.waiting || false} readOnly /></td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}><input type="checkbox" checked={job.collection || false} readOnly /></td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}><input type="checkbox" checked={job.loanCar || false} readOnly /></td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}><input type="checkbox" checked={job.MOT || false} readOnly /></td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}><input type="checkbox" checked={job.wash || false} readOnly /></td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{job.customerAddress || "-"}</td>
                  </tr>
                ))
              ) : (
                Array.from({ length: 12 }).map((_, idx) => (
                  <tr key={idx}>{Array.from({ length: 15 }).map((__, colIdx) => <td key={colIdx} style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}></td>)}</tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add Note Popup */}
        <Popup isOpen={showNotePopup} onClose={() => setShowNotePopup(false)}>
          <h3>Add Note for {formatDateNoYear(selectedDay)}</h3>
          <textarea style={{ width: "100%", height: "100px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }} value={currentNote} onChange={(e) => setCurrentNote(e.target.value)} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", gap: "8px" }}>
            <button onClick={saveNote} style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Update</button>
            <button onClick={() => setShowNotePopup(false)} style={{ padding: "8px 16px", backgroundColor: "#666", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Close</button>
          </div>
        </Popup>
      </div>
    </Layout>
  );
}
