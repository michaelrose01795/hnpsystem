// src/pages/appointments/index.js
"use client";

import React, { useState, useMemo } from "react";
import Layout from "../../components/Layout";
import { useJobs } from "../../context/JobsContext";
import FullCalendar from "@fullcalendar/react";
import timelinePlugin from "@fullcalendar/timeline";
import moment from "moment";
import "@fullcalendar/core/main.css";


export default function AppointmentsPage() {
  const { jobs, updateJob } = useJobs();

  // Form state
  const [jobNumber, setJobNumber] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const handleAddAppointment = () => {
    const job = jobs.find((j) => j.jobNumber === jobNumber);
    if (!job) return alert("Job not found");

    updateJob(jobNumber, { ...job, appointment: { date, time }, status: "Booked" });
    alert(`Appointment set for ${jobNumber} on ${date} at ${time}`);

    setJobNumber("");
    setDate("");
    setTime("");
  };

  // Transform jobs into FullCalendar events
  const events = useMemo(
    () =>
      jobs
        .filter((j) => j.appointment)
        .map((j) => ({
          id: j.jobNumber,
          title: `${j.jobNumber} - ${j.customer || "Unknown"}`,
          start: `${j.appointment.date}T${j.appointment.time}`,
          end: moment(`${j.appointment.date}T${j.appointment.time}`)
            .add(30, "minutes")
            .toISOString(),
          resourceId: j.jobNumber,
        })),
    [jobs]
  );

  // Jobs as resources for Y-axis
  const resources = useMemo(() => jobs.map((j) => ({ id: j.jobNumber, title: j.jobNumber })), [jobs]);

  return (
    <Layout>
      <div style={{ height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
        {/* Top 10% - Controls */}
        <div
          style={{
            flex: "0 0 10%",
            padding: "16px",
            display: "flex",
            gap: "12px",
            alignItems: "center",
            borderBottom: "1px solid #FFCCCC",
          }}
        >
          <input
            type="text"
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            placeholder="Job Number"
            style={{ flex: "1 1 150px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ flex: "1 1 150px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{ flex: "1 1 150px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
          <button
            onClick={handleAddAppointment}
            style={{
              padding: "8px 16px",
              backgroundColor: "#FF4040",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Add Appointment
          </button>
        </div>

        {/* Bottom 90% - Timeline Calendar */}
        <div
          style={{
            flex: "1 1 90%",
            padding: "16px",
            overflow: "auto",
          }}
        >
          <FullCalendar
            plugins={[timelinePlugin]}
            initialView="timelineWeek"
            events={events}
            resources={resources}
            resourceAreaHeaderContent="Jobs"
            slotMinTime="06:00:00"
            slotMaxTime="20:00:00"
            allDaySlot={false}
            nowIndicator={true}
            headerToolbar={false}
            height="100%"
            slotLabelFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            slotLabelContent={(arg) => (
              <div style={{ writingMode: "vertical-rl", textAlign: "center" }}>{arg.text}</div>
            )}
            scrollTime={moment().format("HH:mm:ss")}
          />
        </div>
      </div>
    </Layout>
  );
}
