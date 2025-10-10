// file location: src/pages/appointments/index.js
"use client"; // must be at the top

import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import Popup from "../../components/popups/Popup";
import { useJobs } from "../../context/JobsContext";
import { useSearchParams } from "next/navigation";

// Placeholder tech availability
const techsDefault = 6;

// Placeholder jobs for a day
const placeholderJobs = [
  {
    jobNumber: "1001",
    reg: "AB12 CDE",
    vehicle: "Renault Clio",
    customer: "John Smith",
    timeIn: "09:00",
    timeOut: "10:00",
    reason: "Service",
    totalTime: "1h",
    timeOnJob: "55min",
    waiting: false,
    collection: true,
    loanCar: false,
    MOT: false,
    wash: true,
    address: "123 High St, Town"
  },
  {
    jobNumber: "1002",
    reg: "XY34 ZYX",
    vehicle: "Ford Fiesta",
    customer: "Jane Doe",
    timeIn: "10:00",
    timeOut: "11:30",
    reason: "MOT",
    totalTime: "1.5h",
    timeOnJob: "1h 25min",
    waiting: true,
    collection: false,
    loanCar: false,
    MOT: true,
    wash: false,
    address: "45 Station Rd, Town"
  }
];

// Helper to generate dates for the calendar
const generateDates = (daysAhead = 20) => {
  const result = [];
  const today = new Date();
  let count = 0;
  let current = new Date(today);

  while (count < daysAhead) {
    const day = current.getDay();
    if (day !== 0) { // skip Sundays
      result.push(new Date(current));
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return result;
};

export default function Appointments() {
  const { jobs, addJob, updateJob } = useJobs();
  const searchParams = useSearchParams();

  const [dates, setDates] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [notes, setNotes] = useState({});
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [showAppointmentPopup, setShowAppointmentPopup] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [time, setTime] = useState("");

  // Tech hours state per day
  const [techHours, setTechHours] = useState({});
  const [showTechHoursEditor, setShowTechHoursEditor] = useState(false);

  // Initialize dates
  useEffect(() => {
    setDates(generateDates(20));
  }, []);

  // Pull jobNumber from URL if present
  useEffect(() => {
    const jobParam = searchParams.get("jobNumber");
    if (jobParam) setJobNumber(jobParam);
  }, [searchParams]);

  // Add note handlers
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

  // Add/Edit appointment
  const handleAddAppointment = (customDate) => {
    const appointmentDate = customDate || (selectedDay ? selectedDay.toISOString().split("T")[0] : null);
    if (!jobNumber || !appointmentDate || !time) return;

    let job = jobs.find((j) => j.jobNumber === jobNumber);
    if (!job) {
      job = { jobNumber, customer: "Unknown", status: "Booked" };
      addJob(job);
    }

    updateJob(jobNumber, {
      ...job,
      appointment: { date: appointmentDate, time },
      status: "Booked",
    });

    setJobNumber("");
    setTime("");
    setShowAppointmentPopup(false);
    setSelectedDay(new Date(appointmentDate));
  };

  // Helpers
  const formatDate = (dateObj) => dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const formatDateNoYear = (dateObj) => dateObj.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const isSaturday = (date) => date.getDay() === 6;

  const hours = Array.from({ length: 10 }, (_, i) => 8 + i); // 8am to 5pm
  const stickyHeaderStyle = { position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 2 };

  // Tech hours editor
  const toggleTechHoursEditor = () => {
    setShowTechHoursEditor(!showTechHoursEditor);
  };
  const handleTechHoursChange = (e) => {
    setTechHours({
      ...techHours,
      [selectedDay.toDateString()]: e.target.value
    });
  };

  const getTechHoursForDay = (date) => {
    return techHours[date.toDateString()] || techsDefault;
  };

  return (
    <Layout>
      <div style={{ height: "100%", padding: "16px", display: "flex", flexDirection: "column" }}>
        {/* Top 10% - Add Note / Appointment */}
        <div style={{ flex: "0 0 10%", display: "flex", gap: "12px", alignItems: "center" }}>
          <button onClick={() => handleAddNote(selectedDay)} style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
            Add Note
          </button>
          <input
            type="text"
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            placeholder="Job Number"
            style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
          <select value={time} onChange={(e) => setTime(e.target.value)} style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}>
            <option value="">Select time</option>
            {hours.map((h) => (
              <option key={h} value={`${h.toString().padStart(2, "0")}:00`}>{h}:00</option>
            ))}
          </select>
          <button onClick={() => setShowAppointmentPopup(true)} style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
            Add Appointment
          </button>
        </div>

        {/* Calendar Table */}
        <div style={{ flex: "0 0 40%", overflow: "auto", marginTop: "16px" }}>
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
                return (
                  <tr key={dateKey} onClick={() => setSelectedDay(date)} style={{ cursor: "pointer", backgroundColor: isSaturday(date) ? "#FFD580" : "#fff" }}>
                    <td>{formatDate(date)}</td>
                    <td>{getTechHoursForDay(date)} techs available</td>
                    <td>Placeholder</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td>{notes[dateKey] || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Jobs for Selected Day */}
        <div style={{ flex: "0 0 50%", marginTop: "16px", border: "1px solid #ccc", padding: "12px", overflowY: "auto" }}>
          <h3>Jobs for {formatDateNoYear(selectedDay)}</h3>
          <div style={{ display: "flex", gap: "12px", marginBottom: "8px" }}>
            {["All Jobs", "MOT", "Tech Hours"].map((tab) => (
              <div
                key={tab}
                style={{ padding: "6px 12px", border: "1px solid #000", cursor: "pointer" }}
                onClick={() => {
                  if (tab === "Tech Hours") toggleTechHoursEditor();
                }}
              >
                {tab}
              </div>
            ))}
          </div>

          {showTechHoursEditor && (
            <div style={{ marginBottom: "12px", padding: "12px", border: "1px solid #FF4040", borderRadius: "6px" }}>
              <label>Tech Hours for {formatDateNoYear(selectedDay)}:</label>
              <input
                type="number"
                min="0"
                value={getTechHoursForDay(selectedDay)}
                onChange={handleTechHoursChange}
                style={{ marginLeft: "8px", padding: "6px", width: "60px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
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
              {placeholderJobs.map((job, idx) => (
                <tr key={idx}>
                  <td>{job.jobNumber}</td>
                  <td>{job.reg}</td>
                  <td>{job.vehicle}</td>
                  <td>{job.customer}</td>
                  <td>{job.timeIn}</td>
                  <td>{job.timeOut}</td>
                  <td>{job.reason}</td>
                  <td>{job.totalTime}</td>
                  <td>{job.timeOnJob}</td>
                  <td><input type="checkbox" checked={job.waiting} readOnly /></td>
                  <td><input type="checkbox" checked={job.collection} readOnly /></td>
                  <td><input type="checkbox" checked={job.loanCar} readOnly /></td>
                  <td><input type="checkbox" checked={job.MOT} readOnly /></td>
                  <td><input type="checkbox" checked={job.wash} readOnly /></td>
                  <td>{job.address}</td>
                </tr>
              ))}
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

        {/* Appointment Popup */}
        <Popup isOpen={showAppointmentPopup} onClose={() => setShowAppointmentPopup(false)}>
          <h3>Add Appointment for {selectedDay && formatDateNoYear(selectedDay)}</h3>
          <input type="text" placeholder="Job Number" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }} />
          <select value={time} onChange={(e) => setTime(e.target.value)} style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}>
            <option value="">Select time</option>
            {hours.map((h) => <option key={h} value={`${h.toString().padStart(2,"0")}:00`}>{h}:00</option>)}
          </select>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
            <button onClick={() => setShowAppointmentPopup(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", cursor: "pointer" }}>Close</button>
            <button onClick={() => handleAddAppointment(selectedDay.toISOString().split("T")[0])} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", backgroundColor: "#FF4040", color: "white", cursor: "pointer" }}>Add Appointment</button>
          </div>
        </Popup>
      </div>
    </Layout>
  );
}