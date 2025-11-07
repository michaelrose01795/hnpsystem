// file location: src/pages/job-cards/appointments.js
"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import CustomLoader from "../../components/Loading/CustomLoader";
import { 
  createOrUpdateAppointment, 
  getJobByNumberOrReg 
} from "../../lib/database/jobs";
import { useRouter } from "next/router";

export default function AppointmentsPage() {
  const router = useRouter();
  const [jobNumber, setJobNumber] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobDetails, setJobDetails] = useState(null);

  // ✅ Generate time slots
  const timeSlots = [];
  for (let hour = 8; hour <= 17; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, "0")}:00`);
    if (hour < 17) timeSlots.push(`${hour.toString().padStart(2, "0")}:30`);
  }

  // ✅ Set default date to today
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
  }, []);

  // ✅ Lookup job when job number changes
  useEffect(() => {
    if (jobNumber.length >= 3) {
      const lookupJob = async () => {
        const job = await getJobByNumberOrReg(jobNumber);
        if (job) {
          setJobDetails(job);
        } else {
          setJobDetails(null);
        }
      };
      lookupJob();
    } else {
      setJobDetails(null);
    }
  }, [jobNumber]);

  const handleAddAppointment = async () => {
    // ✅ Validation
    if (!jobNumber || jobNumber.trim() === "") {
      alert("❌ Please enter a job number");
      return;
    }
    if (!date) {
      alert("❌ Please select a date");
      return;
    }
    if (!time) {
      alert("❌ Please select a time");
      return;
    }

    setLoading(true);

    try {
      console.log("📅 Booking appointment for job:", jobNumber);

      // ✅ Check if job exists
      const job = await getJobByNumberOrReg(jobNumber);
      
      if (!job) {
        alert(`❌ Job ${jobNumber} not found.\n\nPlease create the job card first before booking an appointment.`);
        setLoading(false);
        return;
      }

      console.log("✅ Job found:", job);

      // ✅ Create or update appointment
      const result = await createOrUpdateAppointment(
        job.jobNumber,
        date,
        time,
        notes || null
      );

      if (!result.success) {
        const errorMessage = result.error?.message || "Unknown error occurred";
        alert(`❌ Error booking appointment:\n\n${errorMessage}`);
        setLoading(false);
        return;
      }

      console.log("✅ Appointment created:", result);

      // ✅ Success notification
      alert(
        `✅ Appointment booked successfully!\n\n` +
        `Job Number: ${job.jobNumber}\n` +
        `Customer: ${job.customer}\n` +
        `Vehicle: ${job.reg}\n` +
        `Date: ${date}\n` +
        `Time: ${time}` +
        (notes ? `\n\nNotes: ${notes}` : "")
      );

      // ✅ Ask if user wants to view appointments or book another
      const viewAppointments = confirm(
        "Appointment booked successfully!\n\nWould you like to view the appointments calendar?"
      );

      if (viewAppointments) {
        router.push("/appointments");
      } else {
        // Reset form
        setJobNumber("");
        setTime("");
        setNotes("");
        setJobDetails(null);
      }

    } catch (error) {
      console.error("❌ Unexpected error:", error);
      alert(`❌ Unexpected error:\n\n${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <CustomLoader isVisible={loading} />
      <div style={{ 
        maxWidth: "700px", 
        margin: "0 auto", 
        padding: "24px",
        height: "100%",
        display: "flex",
        flexDirection: "column"
      }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ 
            color: "#FF4040", 
            marginBottom: "8px",
            fontSize: "32px",
            fontWeight: "700"
          }}>
            Book Appointment
          </h1>
          <p style={{ color: "#666", fontSize: "14px" }}>
            Schedule an appointment for an existing job card
          </p>
        </div>

        {/* Form */}
        <div style={{
          backgroundColor: "white",
          padding: "32px",
          borderRadius: "16px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          border: "1px solid #e0e0e0"
        }}>
          
          {/* Job Number Input */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "8px", 
              fontWeight: "600",
              fontSize: "14px",
              color: "#333"
            }}>
              Job Number *
            </label>
            <input
              type="text"
              value={jobNumber}
              onChange={(e) => setJobNumber(e.target.value)}
              placeholder="Enter job number (e.g., JOB1001)"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#FF4040"}
              onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
            />
            
            {/* Job Details Preview */}
            {jobDetails && (
              <div style={{
                marginTop: "12px",
                padding: "12px",
                backgroundColor: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: "8px"
              }}>
                <p style={{ fontSize: "13px", color: "#166534", margin: "0 0 4px 0" }}>
                  ✓ <strong>Customer:</strong> {jobDetails.customer}
                </p>
                <p style={{ fontSize: "13px", color: "#166534", margin: 0 }}>
                  <strong>Vehicle:</strong> {jobDetails.reg} ({jobDetails.makeModel || "N/A"})
                </p>
              </div>
            )}
            
            {jobNumber.length >= 3 && !jobDetails && (
              <div style={{
                marginTop: "12px",
                padding: "12px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px"
              }}>
                <p style={{ fontSize: "13px", color: "#991b1b", margin: 0 }}>
                  ⚠️ Job not found. Please create the job card first.
                </p>
              </div>
            )}
          </div>

          {/* Date Input */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "8px", 
              fontWeight: "600",
              fontSize: "14px",
              color: "#333"
            }}>
              Appointment Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#FF4040"}
              onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
            />
          </div>

          {/* Time Input */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "8px", 
              fontWeight: "600",
              fontSize: "14px",
              color: "#333"
            }}>
              Appointment Time *
            </label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                fontSize: "14px",
                outline: "none",
                cursor: "pointer",
                backgroundColor: "white"
              }}
            >
              <option value="">Select time slot</option>
              {timeSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>

          {/* Notes Input */}
          <div style={{ marginBottom: "32px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "8px", 
              fontWeight: "600",
              fontSize: "14px",
              color: "#333"
            }}>
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes..."
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                fontSize: "14px",
                outline: "none",
                resize: "vertical",
                minHeight: "100px",
                fontFamily: "inherit"
              }}
              onFocus={(e) => e.target.style.borderColor = "#FF4040"}
              onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={handleAddAppointment}
              disabled={loading || !jobNumber || !date || !time}
              style={{
                flex: 1,
                padding: "14px 24px",
                backgroundColor: loading || !jobNumber || !date || !time ? "#ccc" : "#FF4040",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "15px",
                cursor: loading || !jobNumber || !date || !time ? "not-allowed" : "pointer",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => {
                if (!loading && jobNumber && date && time) {
                  e.target.style.backgroundColor = "#cc0000";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && jobNumber && date && time) {
                  e.target.style.backgroundColor = "#FF4040";
                }
              }}
            >
              {loading ? "Booking..." : "📅 Book Appointment"}
            </button>

            <button
              onClick={() => router.push("/appointments")}
              disabled={loading}
              style={{
                padding: "14px 24px",
                backgroundColor: "white",
                color: "#666",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "15px",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = "#f5f5f5";
                  e.target.style.borderColor = "#d0d0d0";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = "white";
                  e.target.style.borderColor = "#e0e0e0";
                }
              }}
            >
              View Calendar
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div style={{
          marginTop: "24px",
          padding: "16px",
          backgroundColor: "#f0f9ff",
          border: "1px solid #bfdbfe",
          borderRadius: "8px"
        }}>
          <p style={{ fontSize: "13px", color: "#1e40af", margin: "0 0 8px 0", fontWeight: "600" }}>
            💡 Quick Tips:
          </p>
          <ul style={{ fontSize: "13px", color: "#3730a3", margin: 0, paddingLeft: "20px" }}>
            <li>Make sure the job card exists before booking an appointment</li>
            <li>Appointments are available Monday-Saturday, 8:00 AM - 5:30 PM</li>
            <li>You can view and manage all appointments in the calendar view</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
