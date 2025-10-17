// src/pages/appointments/index.js
"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import Popup from "../../components/popups/Popup";
import { useSearchParams } from "next/navigation";
import { getAllJobs, addJobToDatabase, updateJobStatus } from "../../lib/database/jobs";

const techsDefault = 6;

const generateDates = (daysAhead = 60) => {
  const result = [];
  const today = new Date();
  let count = 0;
  let current = new Date(today);

  while (count < daysAhead) {
    if (current.getDay() !== 0) {
      result.push(new Date(current));
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return result;
};

export default function Appointments() {
  const searchParams = useSearchParams();

  const [jobs, setJobs] = useState([]);
  const [dates, setDates] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [notes, setNotes] = useState({});
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [time, setTime] = useState("");
  const [highlightJob, setHighlightJob] = useState(""); // highlight job number
  const [techHours, setTechHours] = useState({});
  const [showTechHoursEditor, setShowTechHoursEditor] = useState(false);

  /* -----------------------------
     Fetch all jobs from database
  ----------------------------- */
  const fetchJobs = async () => {
    const jobsFromDb = await getAllJobs();
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
      const existingJob = jobs.find((j) => j.jobNumber === jobParam);
      if (existingJob && existingJob.appointment) {
        setSelectedDay(new Date(existingJob.appointment.date));
        setTime(existingJob.appointment.time);
      }
    }
  }, [searchParams, jobs]);

  /* -----------------------------
     Add / Edit Note
  ----------------------------- */
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

  /* -----------------------------
     Add or update appointment in DB
  ----------------------------- */
  const handleAddAppointment = async (customDate) => {
    const appointmentDate = customDate || (selectedDay ? selectedDay.toISOString().split("T")[0] : null);
    if (!jobNumber || !appointmentDate || !time) return;

    let job = jobs.find((j) => j.jobNumber === jobNumber);

    if (!job) {
      // If job doesn't exist, add to database
      const result = await addJobToDatabase({
        jobNumber,
        reg: "",
        customerId: null, // Unknown customer
        assignedTo: null, // unassigned
        type: "Service",
        description: ""
      });

      if (!result.success) {
        alert("Error adding job to database");
        return;
      }

      job = result.data;
      job.appointment = { date: appointmentDate, time };
      job.status = "Booked";
      setJobs([...jobs, job]);
    } else {
      // Job exists → update appointment and status in DB
      await updateJobStatus(job.id, "Booked");
      job.appointment = { date: appointmentDate, time };
      setJobs([...jobs]);
    }

    // Highlight row for 2 seconds
    setHighlightJob(jobNumber);
    setSelectedDay(new Date(appointmentDate));
    setTimeout(() => setHighlightJob(""), 2000);

    // Clear inputs
    setJobNumber("");
    setTime("");
  };

  /* -----------------------------
     Utilities
  ----------------------------- */
  const formatDate = (dateObj) => dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const formatDateNoYear = (dateObj) => dateObj.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const isSaturday = (date) => date.getDay() === 6;

  const hours = Array.from({ length: 10 }, (_, i) => 8 + i);
  const stickyHeaderStyle = { position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 2 };

  const toggleTechHoursEditor = () => setShowTechHoursEditor(!showTechHoursEditor);
  const handleTechHoursChange = (e) => setTechHours({ ...techHours, [selectedDay.toDateString()]: e.target.value });
  const getTechHoursForDay = (date) => techHours[date.toDateString()] || techsDefault;

  const getJobCounts = (date) => {
    const jobsForDate = jobs.filter(j => j.appointment?.date === date.toISOString().split("T")[0]);
    return {
      totalJobs: jobsForDate.length,
      services: jobsForDate.filter(j => j.reason?.toLowerCase().includes("service")).length,
      MOT: jobsForDate.filter(j => j.MOT).length,
      diagnosis: jobsForDate.filter(j => j.reason?.toLowerCase().includes("diagnosis")).length,
      other: jobsForDate.filter(j => !j.MOT && !j.reason?.toLowerCase().includes("service") && !j.reason?.toLowerCase().includes("diagnosis")).length
    };
  };

  const jobsForDay = jobs.filter(j => j.appointment?.date === selectedDay.toISOString().split("T")[0]);

  /* ================================
     Render Component
  ================================ */
  return (
    <Layout>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "8px 16px" }}>
        {/* Top Bar */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "8px" }}>
          <button onClick={() => handleAddNote(selectedDay)} style={{ padding: "4px 16px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Add Note</button>
          <input type="text" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} placeholder="Job Number" style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }} />
          <select value={time} onChange={(e) => setTime(e.target.value)} style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}>
            <option value="">Select time</option>
            {hours.map((h) => <option key={h} value={`${h.toString().padStart(2,"0")}:00`}>{h}:00</option>)}
          </select>
          <button onClick={() => handleAddAppointment(selectedDay.toISOString().split("T")[0])} style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Add Appointment</button>
        </div>

        {/* Calendar Table */}
        <div style={{ flex: "0 0 auto", maxHeight: "calc(14 * 40px + 40px)", overflowY: "auto", marginBottom: "8px", border: "1px solid #ccc", padding: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={stickyHeaderStyle}>Day/Date</th>
                <th style={stickyHeaderStyle}>Availability</th>
                <th style={stickyHeaderStyle}>Total Hours</th>
                <th style={stickyHeaderStyle}>Total Jobs</th>
                <th style={stickyHeaderStyle}>Services</th>
                <th style={stickyHeaderStyle}>MOT</th>
                <th style={stickyHeaderStyle}>Diagnosis</th>
                <th style={stickyHeaderStyle}>Other</th>
                <th style={stickyHeaderStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => {
                const dateKey = date.toDateString();
                const counts = getJobCounts(date);
                return (
                  <tr key={dateKey} onClick={() => setSelectedDay(date)} style={{ cursor: "pointer", backgroundColor: isSaturday(date) ? "#FFD580" : "#fff" }}>
                    <td>{formatDate(date)}</td>
                    <td>{getTechHoursForDay(date)} techs available</td>
                    <td>0</td>
                    <td>{counts.totalJobs}</td>
                    <td>{counts.services}</td>
                    <td>{counts.MOT}</td>
                    <td>{counts.diagnosis}</td>
                    <td>{counts.other}</td>
                    <td>{notes[dateKey] || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Jobs for Selected Day */}
        <div style={{ flex: "0 0 40%", marginBottom: "8px", border: "1px solid #ccc", padding: "12px", overflowY: "auto" }}>
          <h3>Jobs for {formatDateNoYear(selectedDay)}</h3>
          <div style={{ display: "flex", gap: "12px", marginBottom: "8px" }}>
            {["All Jobs", "MOT", "Tech Hours"].map((tab) => (
              <div key={tab} style={{ padding: "6px 12px", border: "1px solid #000", cursor: "pointer" }} onClick={() => { if (tab === "Tech Hours") toggleTechHoursEditor(); }}>{tab}</div>
            ))}
          </div>

          {showTechHoursEditor && (
            <div style={{ marginBottom: "12px", padding: "12px", border: "1px solid #FF4040", borderRadius: "6px" }}>
              <label>Tech Hours for {formatDateNoYear(selectedDay)}:</label>
              <input type="number" min="0" value={getTechHoursForDay(selectedDay)} onChange={handleTechHoursChange} style={{ marginLeft: "8px", padding: "6px", width: "60px", borderRadius: "4px", border: "1px solid #ccc" }} />
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={stickyHeaderStyle}>Job #</th>
                <th style={stickyHeaderStyle}>Reg</th>
                <th style={stickyHeaderStyle}>Vehicle</th>
                <th style={stickyHeaderStyle}>Customer</th>
                <th style={stickyHeaderStyle}>Time In</th>
                <th style={stickyHeaderStyle}>Time Out</th>
                <th style={stickyHeaderStyle}>Reason</th>
                <th style={stickyHeaderStyle}>Total Time</th>
                <th style={stickyHeaderStyle}>Time on Job</th>
                <th style={stickyHeaderStyle}>Waiting</th>
                <th style={stickyHeaderStyle}>Collection</th>
                <th style={stickyHeaderStyle}>Loan Car</th>
                <th style={stickyHeaderStyle}>MOT</th>
                <th style={stickyHeaderStyle}>Wash</th>
                <th style={stickyHeaderStyle}>Address</th>
              </tr>
            </thead>
            <tbody>
              {jobsForDay.length > 0 ? jobsForDay.map((job, idx) => (
                <tr key={idx} style={{ backgroundColor: highlightJob === job.jobNumber ? "#D0F0C0" : "transparent", transition: "background-color 0.5s" }}>
                  <td>{job.jobNumber || "0"}</td>
                  <td>{job.reg || "0"}</td>
                  <td>{job.vehicle || "0"}</td>
                  <td>{job.customer || "0"}</td>
                  <td>{job.appointment?.time || "0"}</td>
                  <td>0</td>
                  <td>{job.reason || "0"}</td>
                  <td>{job.totalTime || "0"}</td>
                  <td>{job.timeOnJob || "0"}</td>
                  <td><input type="checkbox" checked={job.waiting || false} readOnly /></td>
                  <td><input type="checkbox" checked={job.collection || false} readOnly /></td>
                  <td><input type="checkbox" checked={job.loanCar || false} readOnly /></td>
                  <td><input type="checkbox" checked={job.MOT || false} readOnly /></td>
                  <td><input type="checkbox" checked={job.wash || false} readOnly /></td>
                  <td>{job.address || "0"}</td>
                </tr>
              )) : (
                Array.from({ length: 12 }).map((_, idx) => (
                  <tr key={idx}>{Array.from({ length: 15 }).map((__, colIdx) => <td key={colIdx}></td>)}</tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add Note Popup */}
        <Popup isOpen={showNotePopup} onClose={() => setShowNotePopup(false)}>
          <h3>Add Note for {formatDateNoYear(selectedDay)}</h3>
          <textarea style={{ width: "100%", height: "100px" }} value={currentNote} onChange={(e) => setCurrentNote(e.target.value)} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
            <button onClick={saveNote}>Update</button>
            <button onClick={() => setShowNotePopup(false)}>Close</button>
          </div>
        </Popup>
      </div>
    </Layout>
  );
}