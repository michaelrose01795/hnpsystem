// file location: src/pages/appointments/index.js
"use client";

import React, { useState, useEffect } from "react"; // Import React and useState/useEffect hooks
import Layout from "../../components/Layout"; // Main layout wrapper
import Popup from "../../components/popups/Popup"; // Reusable popup modal
import { useSearchParams } from "next/navigation"; // For reading query params
import { getAllJobs, addJobToDatabase, updateJobStatus } from "../../lib/database/jobs"; // DB functions

const techsDefault = 6; // Default number of technicians available per day

// Generate list of dates excluding Sundays
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

  // ---------------- Fetch Jobs ----------------
  const fetchJobs = async () => {
    const jobsFromDb = await getAllJobs();
    setJobs(jobsFromDb);
  };

  useEffect(() => {
    setDates(generateDates(60));
    fetchJobs();
  }, []);

  // Handle jobNumber in URL
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
    const appointmentDate =
      customDate || (selectedDay ? selectedDay.toISOString().split("T")[0] : null);
    if (!jobNumber || !appointmentDate || !time) return;

    let job = jobs.find((j) => j.jobNumber === jobNumber);

    if (!job) {
      // Add new job
      const result = await addJobToDatabase({
        jobNumber,
        reg: "",
        customerId: null,
        assignedTo: null,
        type: "Service",
        description: "",
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
      // Update existing job
      await updateJobStatus(job.id, "Booked");
      job.appointment = { date: appointmentDate, time };
      setJobs([...jobs]);
    }

    // Highlight briefly
    setHighlightJob(jobNumber);
    setSelectedDay(new Date(appointmentDate));
    setTimeout(() => setHighlightJob(""), 2000);

    // Reset inputs
    setJobNumber("");
    setTime("");
  };

  // ---------------- Utilities ----------------
  const formatDate = (dateObj) =>
    dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const formatDateNoYear = (dateObj) =>
    dateObj.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const isSaturday = (date) => date.getDay() === 6;

  const hours = Array.from({ length: 10 }, (_, i) => 8 + i);
  const getTechHoursForDay = (date) => techHours[date.toDateString()] || techsDefault;
  const handleTechHoursChange = (e) =>
    setTechHours({ ...techHours, [selectedDay.toDateString()]: e.target.value });
  const toggleTechHoursEditor = () => setShowTechHoursEditor(!showTechHoursEditor);

  const getJobCounts = (date) => {
    const jobsForDate = jobs.filter((j) => j.appointment?.date === date.toISOString().split("T")[0]);
    return {
      totalJobs: jobsForDate.length,
      services: jobsForDate.filter((j) => j.reason?.toLowerCase().includes("service")).length,
      MOT: jobsForDate.filter((j) => j.MOT).length,
      diagnosis: jobsForDate.filter((j) => j.reason?.toLowerCase().includes("diagnosis")).length,
      other: jobsForDate.filter(
        (j) =>
          !j.MOT &&
          !j.reason?.toLowerCase().includes("service") &&
          !j.reason?.toLowerCase().includes("diagnosis")
      ).length,
    };
  };

  const jobsForDay = jobs.filter(
    (j) => j.appointment?.date === selectedDay.toISOString().split("T")[0]
  );

  // ---------------- Render ----------------
  return (
    <Layout>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "8px 16px" }}>
        {/* Top Bar */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
          <button
            onClick={() => handleAddNote(selectedDay)}
            style={{
              padding: "6px 16px",
              backgroundColor: "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Add Note
          </button>
          <input
            type="text"
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            placeholder="Job Number"
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              outline: "none",
            }}
          />
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              outline: "none",
            }}
          >
            <option value="">Select time</option>
            {hours.map((h) => (
              <option key={h} value={`${h.toString().padStart(2, "0")}:00`}>
                {h}:00
              </option>
            ))}
          </select>
          <button
            onClick={() => handleAddAppointment(selectedDay.toISOString().split("T")[0])}
            style={{
              padding: "8px 16px",
              backgroundColor: "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Add Appointment
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
              {jobsForDay.length > 0 ? (
                jobsForDay.map((job, idx) => (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor:
                        highlightJob === job.jobNumber ? "#D0F0C0" : "transparent",
                      transition: "background-color 0.5s",
                    }}
                  >
                    <td>{job.jobNumber || "0"}</td>
                    <td>{job.reg || "0"}</td>
                    <td>{job.vehicle || "0"}</td>
                    <td>{job.customer || "0"}</td>
                    <td>{job.appointment?.time || "0"}</td>
                    <td>0</td>
                    <td>{job.reason || "0"}</td>
                    <td>{job.totalTime || "0"}</td>
                    <td>{job.timeOnJob || "0"}</td>
                    <td>
                      <input type="checkbox" checked={job.waiting || false} readOnly />
                    </td>
                    <td>
                      <input type="checkbox" checked={job.collection || false} readOnly />
                    </td>
                    <td>
                      <input type="checkbox" checked={job.loanCar || false} readOnly />
                    </td>
                    <td>
                      <input type="checkbox" checked={job.MOT || false} readOnly />
                    </td>
                    <td>
                      <input type="checkbox" checked={job.wash || false} readOnly />
                    </td>
                    <td>{job.address || "0"}</td>
                  </tr>
                ))
              ) : (
                Array.from({ length: 12 }).map((_, idx) => (
                  <tr key={idx}>
                    {Array.from({ length: 15 }).map((__, colIdx) => (
                      <td key={colIdx}></td>
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
            style={{ width: "100%", height: "100px" }}
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
          />
          <div
            style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}
          >
            <button onClick={saveNote}>Update</button>
            <button onClick={() => setShowNotePopup(false)}>Close</button>
          </div>
        </Popup>
      </div>
    </Layout>
  );
}
