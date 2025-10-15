"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { useJobs } from "../../context/JobsContext";
import { useSearchParams } from "next/navigation";

export default function AppointmentsPage() {
  const { jobs, addJob, updateJob } = useJobs();
  const searchParams = useSearchParams();

  const [jobNumber, setJobNumber] = useState("");
  const [time, setTime] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const jobParam = searchParams.get("jobNumber");
    if (jobParam) setJobNumber(jobParam);
  }, [searchParams]);

  const hours = Array.from({ length: 10 }, (_, i) => 8 + i); // 8am to 5pm

  const handleAddAppointment = (customDate) => {
    const appointmentDate = customDate || (selectedDate ? selectedDate.toISOString().split("T")[0] : null);
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
    setIsModalOpen(false);
    setSelectedDate(new Date(appointmentDate));
  };

  const generateDates = () => {
    const today = new Date();
    return Array.from({ length: 37 }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() + i);
      return d;
    });
  };

  const dates = generateDates();

  const getAppointmentsAt = (dateObj, hour) =>
    jobs.filter((job) => {
      if (!job.appointment) return false;
      const jobHour = Number(job.appointment.time.split(":")[0]);
      const appDate = new Date(job.appointment.date);
      return (
        appDate.getFullYear() === dateObj.getFullYear() &&
        appDate.getMonth() === dateObj.getMonth() &&
        appDate.getDate() === dateObj.getDate() &&
        jobHour === hour
      );
    });

  const getAppointmentsForDay = (dateObj) =>
    jobs
      .filter((job) => {
        if (!job.appointment) return false;
        const appDate = new Date(job.appointment.date);
        return (
          appDate.getFullYear() === dateObj.getFullYear() &&
          appDate.getMonth() === dateObj.getMonth() &&
          appDate.getDate() === dateObj.getDate()
        );
      })
      .slice(0, 20);

  const handleClickAppointment = (job) => {
    setJobNumber(job.jobNumber);
    setTime(job.appointment.time);
    setSelectedDate(new Date(job.appointment.date));
    setIsModalOpen(true);
  };

  const formatDateNoYear = (dateObj) => {
    const options = { weekday: "short", month: "short", day: "numeric" };
    return dateObj.toLocaleDateString(undefined, options);
  };

  return (
    <Layout>
      <div style={{ height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
        {/* Top Controls */}
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
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{ flex: "1 1 150px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          >
            <option value="">Select time</option>
            {hours.map((h) => (
              <option key={h} value={`${h.toString().padStart(2, "0")}:00`}>
                {h}:00
              </option>
            ))}
          </select>
          <button
            onClick={() => handleAddAppointment(selectedDate ? selectedDate.toISOString().split("T")[0] : null)}
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

        {/* Calendar */}
        <div style={{ flex: "0 0 40%", overflow: "auto", padding: "8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${hours.length}, 120px)`, gridAutoRows: "40px" }}>
            <div style={{ borderBottom: "1px solid #ccc", borderRight: "1px solid #ccc" }}></div>
            {hours.map((hour) => (
              <div
                key={hour}
                style={{
                  textAlign: "center",
                  fontWeight: "bold",
                  borderBottom: "1px solid #ccc",
                  borderRight: "1px solid #ccc",
                  backgroundColor: "#f9f9f9",
                  lineHeight: "40px",
                }}
              >
                {hour}:00
              </div>
            ))}
            {dates.map((dateObj, rowIdx) => (
              <React.Fragment key={rowIdx}>
                <div
                  style={{
                    borderBottom: "1px solid #ccc",
                    borderRight: "1px solid #ccc",
                    padding: "4px",
                    fontWeight: "bold",
                    backgroundColor: "#f9f9f9",
                    textAlign: "center",
                    lineHeight: "40px",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setSelectedDate(dateObj);
                    setIsModalOpen(true);
                  }}
                >
                  {formatDateNoYear(dateObj)}
                </div>

                {hours.map((hour) => {
                  const apps = getAppointmentsAt(dateObj, hour);
                  return (
                    <div
                      key={hour}
                      style={{
                        borderBottom: "1px solid #eee",
                        borderRight: "1px solid #eee",
                        position: "relative",
                        minHeight: "40px",
                        cursor: apps.length > 0 ? "pointer" : "default",
                      }}
                      onClick={() => apps.length > 0 && handleClickAppointment(apps[0])}
                    >
                      {apps.map((job) => (
                        <div
                          key={job.jobNumber}
                          style={{
                            position: "absolute",
                            top: 2,
                            left: 2,
                            right: 2,
                            bottom: 2,
                            backgroundColor: "#FF4040",
                            color: "white",
                            fontSize: "12px",
                            textAlign: "center",
                            borderRadius: "4px",
                            padding: "2px",
                            lineHeight: "16px",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {job.jobNumber}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Selected Day's Appointments */}
        <div style={{ flex: "0 0 50%", padding: "16px", overflowY: "auto", borderTop: "1px solid #FFCCCC", backgroundColor: "#fdfdfd" }}>
          <h3>{selectedDate ? formatDateNoYear(selectedDate) : "Select a day to see appointments"}</h3>
          {selectedDate &&
            getAppointmentsForDay(selectedDate).map((job) => (
              <div
                key={job.jobNumber}
                onClick={() => handleClickAppointment(job)}
                style={{
                  padding: "8px",
                  marginBottom: "6px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {job.jobNumber} - {job.appointment.time} - {job.customer || "Unknown"}
              </div>
            ))}
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "8px",
                minWidth: "300px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <h3>Add Appointment for {selectedDate && formatDateNoYear(selectedDate)}</h3>
              <input
                type="text"
                placeholder="Job Number"
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value)}
                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value="">Select time</option>
                {hours.map((h) => (
                  <option key={h} value={`${h.toString().padStart(2, "0")}:00`}>
                    {h}:00
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: "6px", border: "none", cursor: "pointer" }}
                >
                  Close
                </button>
                <button
                  onClick={() => handleAddAppointment(selectedDate.toISOString().split("T")[0])}
                  style={{ padding: "8px 16px", borderRadius: "6px", border: "none", backgroundColor: "#FF4040", color: "white", cursor: "pointer" }}
                >
                  Add Appointment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// file location: src/pages/appointments/index.js
"use client"; // enables client-side rendering in Next.js

import React, { useState, useEffect } from "react"; // imports React and hooks
import Layout from "../../components/Layout"; // imports your Layout wrapper
import { useJobs } from "../../context/JobsContext"; // imports job context for state management
import { useSearchParams } from "next/navigation"; // allows reading query parameters

export default function AppointmentsPage() {
  const { jobs, addJob, updateJob } = useJobs(); // jobs context functions
  const searchParams = useSearchParams(); // query params

  const [jobNumber, setJobNumber] = useState(""); // holds job number input
  const [time, setTime] = useState(""); // holds selected time
  const [selectedDate, setSelectedDate] = useState(null); // holds selected date
  const [isModalOpen, setIsModalOpen] = useState(false); // controls modal state

  // Pre-populate jobNumber if passed in query string
  useEffect(() => {
    const jobParam = searchParams.get("jobNumber");
    if (jobParam) setJobNumber(jobParam);
  }, [searchParams]);

  // appointment hours from 8am–5pm
  const hours = Array.from({ length: 10 }, (_, i) => 8 + i);

  // Add appointment handler
  const handleAddAppointment = (customDate) => {
    const appointmentDate =
      customDate || (selectedDate ? selectedDate.toISOString().split("T")[0] : null);
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
    setIsModalOpen(false);
    setSelectedDate(new Date(appointmentDate));
  };

  // Generate list of days (37 days ahead)
  const generateDates = () => {
    const today = new Date();
    return Array.from({ length: 37 }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() + i);
      return d;
    });
  };

  const dates = generateDates();

  // Get jobs at a specific hour
  const getAppointmentsAt = (dateObj, hour) =>
    jobs.filter((job) => {
      if (!job.appointment) return false;
      const jobHour = Number(job.appointment.time.split(":")[0]);
      const appDate = new Date(job.appointment.date);
      return (
        appDate.getFullYear() === dateObj.getFullYear() &&
        appDate.getMonth() === dateObj.getMonth() &&
        appDate.getDate() === dateObj.getDate() &&
        jobHour === hour
      );
    });

  // Get all jobs for a given day
  const getAppointmentsForDay = (dateObj) =>
    jobs
      .filter((job) => {
        if (!job.appointment) return false;
        const appDate = new Date(job.appointment.date);
        return (
          appDate.getFullYear() === dateObj.getFullYear() &&
          appDate.getMonth() === dateObj.getMonth() &&
          appDate.getDate() === dateObj.getDate()
        );
      })
      .slice(0, 20);

  // Handle clicking an appointment
  const handleClickAppointment = (job) => {
    setJobNumber(job.jobNumber);
    setTime(job.appointment.time);
    setSelectedDate(new Date(job.appointment.date));
    setIsModalOpen(true);
  };

  // Format date (no year)
  const formatDateNoYear = (dateObj) => {
    const options = { weekday: "short", month: "short", day: "numeric" };
    return dateObj.toLocaleDateString(undefined, options);
  };

  return (
    <Layout>
      <div style={{ height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
        {/* Top Controls */}
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
            style={{
              flex: "1 1 150px",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          />
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{
              flex: "1 1 150px",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
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
            onClick={() =>
              handleAddAppointment(selectedDate ? selectedDate.toISOString().split("T")[0] : null)
            }
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

        {/* Calendar */}
        <div style={{ flex: "0 0 40%", overflow: "auto", padding: "8px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `120px repeat(${hours.length}, 120px)`,
              gridAutoRows: "40px",
            }}
          >
            <div style={{ borderBottom: "1px solid #ccc", borderRight: "1px solid #ccc" }}></div>
            {hours.map((hour) => (
              <div
                key={hour}
                style={{
                  textAlign: "center",
                  fontWeight: "bold",
                  borderBottom: "1px solid #ccc",
                  borderRight: "1px solid #ccc",
                  backgroundColor: "#f9f9f9",
                  lineHeight: "40px",
                }}
              >
                {hour}:00
              </div>
            ))}
            {dates.map((dateObj, rowIdx) => (
              <React.Fragment key={rowIdx}>
                <div
                  style={{
                    borderBottom: "1px solid #ccc",
                    borderRight: "1px solid #ccc",
                    padding: "4px",
                    fontWeight: "bold",
                    backgroundColor: "#f9f9f9",
                    textAlign: "center",
                    lineHeight: "40px",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setSelectedDate(dateObj);
                    setIsModalOpen(true);
                  }}
                >
                  {formatDateNoYear(dateObj)}
                </div>

                {hours.map((hour) => {
                  const apps = getAppointmentsAt(dateObj, hour);
                  return (
                    <div
                      key={hour}
                      style={{
                        borderBottom: "1px solid #eee",
                        borderRight: "1px solid #eee",
                        position: "relative",
                        minHeight: "40px",
                        cursor: apps.length > 0 ? "pointer" : "default",
                      }}
                      onClick={() => apps.length > 0 && handleClickAppointment(apps[0])}
                    >
                      {apps.map((job) => (
                        <div
                          key={job.jobNumber}
                          style={{
                            position: "absolute",
                            top: 2,
                            left: 2,
                            right: 2,
                            bottom: 2,
                            backgroundColor: "#FF4040",
                            color: "white",
                            fontSize: "12px",
                            textAlign: "center",
                            borderRadius: "4px",
                            padding: "2px",
                            lineHeight: "16px",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {job.jobNumber}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Selected Day's Appointments */}
        <div
          style={{
            flex: "0 0 50%",
            padding: "16px",
            overflowY: "auto",
            borderTop: "1px solid #FFCCCC",
            backgroundColor: "#fdfdfd",
          }}
        >
          <h3>
            {selectedDate
              ? formatDateNoYear(selectedDate)
              : "Select a day to see appointments"}
          </h3>
          {selectedDate &&
            getAppointmentsForDay(selectedDate).map((job) => (
              <div
                key={job.jobNumber}
                onClick={() => handleClickAppointment(job)}
                style={{
                  padding: "8px",
                  marginBottom: "6px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {job.jobNumber} - {job.appointment.time} -{" "}
                {job.customer || "Unknown"}
              </div>
            ))}
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "8px",
                minWidth: "300px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <h3>
                Add Appointment for{" "}
                {selectedDate && formatDateNoYear(selectedDate)}
              </h3>
              <input
                type="text"
                placeholder="Job Number"
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value)}
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              >
                <option value="">Select time</option>
                {hours.map((h) => (
                  <option key={h} value={`${h.toString().padStart(2, "0")}:00`}>
                    {h}:00
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
                <button
                  onClick={() =>
                    handleAddAppointment(selectedDate.toISOString().split("T")[0])
                  }
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#FF4040",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Add Appointment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}