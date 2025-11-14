// ✅ Imports converted to use absolute alias "@/" // file context comment
// file location: src/pages/appointments/index.js // clarify file path
"use client"; // Ensure client-side rendering for interactive calendar
// Added per instruction to keep comment coverage
import React, { useState, useEffect } from "react"; // React + hooks for stateful calendar UX
import Layout from "@/components/Layout"; // Shared dashboard layout wrapper
import Popup from "@/components/popups/Popup"; // Modal used for the daily note editor
import { // Import appointment database helpers
  getAllJobs, // Fetch all jobs with appointment metadata
  createOrUpdateAppointment, // Persist appointment updates
  getJobByNumberOrReg // Lookup job by number or registration
} from "@/lib/database/jobs"; // Source of Supabase job queries
// Added per instruction to keep comment coverage
const techsDefault = 6; // Default technician availability per day
// Added per instruction to keep comment coverage
const generateDates = (daysAhead = 60) => { // Build an ordered list of dates excluding Sundays
  const result = []; // Holds allowed days
  const today = new Date(); // Reference starting point
  let count = 0; // Track number of valid days gathered
  let current = new Date(today); // Movable pointer for iteration
  while (count < daysAhead) { // Continue until requested range satisfied
    if (current.getDay() !== 0) { // Skip Sundays (0)
      result.push(new Date(current)); // Store copy of the date to avoid mutations
      count++; // Increment valid day counter
    } // Close Sunday guard
    current.setDate(current.getDate() + 1); // Move pointer one day ahead
  } // Close loop over daysAhead
  return result; // Provide generated calendar days
}; // End generateDates helper
// Added per instruction to keep comment coverage
const generateTimeSlots = () => { // Produce appointment slot list from 08:00-17:30
  const slots = []; // Storage for slot strings
  for (let hour = 8; hour <= 17; hour++) { // Hours between 8 AM and 5 PM inclusive
    slots.push(`${hour.toString().padStart(2, "0")}:00`); // Insert :00 slot
    if (hour < 17) slots.push(`${hour.toString().padStart(2, "0")}:30`); // Insert :30 slot if before final hour
  } // Close loop over hours
  return slots; // Provide slots to dropdown
}; // End generateTimeSlots helper
// Added per instruction to keep comment coverage
const getVehicleDisplay = (job) => { // Present vehicle description gracefully
  if (job.makeModel) return job.makeModel; // Prefer precombined make-model line
  const make = job.make || ""; // Individual make fallback
  const model = job.model || ""; // Individual model fallback
  const year = job.year || ""; // Vehicle year fallback
  return [year, make, model].filter(Boolean).join(" ") || "-"; // Build composite label or dash placeholder
}; // End getVehicleDisplay helper
// Added per instruction to keep comment coverage
export default function Appointments() { // Main appointments calendar component
  const [jobs, setJobs] = useState([]); // Jobs pulled from Supabase
  const [dates, setDates] = useState([]); // Available days for the calendar table
  const [selectedDay, setSelectedDay] = useState(new Date()); // Currently highlighted day
  const [notes, setNotes] = useState({}); // Local note cache per day key
  const [showNotePopup, setShowNotePopup] = useState(false); // Modal visibility state
  const [currentNote, setCurrentNote] = useState(""); // Text for the note being edited
  const [jobNumber, setJobNumber] = useState(""); // Form input for job number
  const [time, setTime] = useState(""); // Form input for appointment time
  const [highlightJob, setHighlightJob] = useState(""); // Recently updated job to highlight row
  const [techHours, setTechHours] = useState({}); // Editable tech capacity overrides per day
  const [showTechHoursEditor, setShowTechHoursEditor] = useState(false); // Toggle for capacity editor view
  const [searchQuery, setSearchQuery] = useState(""); // Quick filter string
  const [timeSlots] = useState(generateTimeSlots()); // Memoized slot list
  const [isLoading, setIsLoading] = useState(false); // Global loading spin indicator
// Added per instruction to keep comment coverage
  const fetchJobs = async () => { // Load jobs from Supabase and keep only those with appointments
    setIsLoading(true); // Trigger loading UI
    try { // Attempt DB call
      const jobsFromDb = await getAllJobs(); // Fetch entire job collection
      const jobsWithAppointments = jobsFromDb.filter((job) => job.appointment); // Keep only booked entries
      setJobs(jobsWithAppointments); // Store curated data set
    } catch (error) { // Capture issues
      console.error("Failed to fetch appointments", error); // Log for debugging
      alert("Failed to load appointments. Please refresh the page."); // Notify operator
    } finally { // Always executed
      setIsLoading(false); // Release loading state
    } // Close try/catch/finally
  }; // End fetchJobs helper
// Added per instruction to keep comment coverage
  useEffect(() => { // Bootstrap calendar data on mount
    setDates(generateDates(60)); // Prefill calendar dates (60 business days)
    fetchJobs(); // Kick data fetch to start directly on calendar view
  }, []); // Run once
// Added per instruction to keep comment coverage
  const handleAddNote = (date) => { // Open note popup prepopulated for selected date
    setSelectedDay(date); // Align table selection with note context
    const dateKey = date.toDateString(); // Build dictionary key
    setCurrentNote(notes[dateKey] || ""); // Load stored note text if available
    setShowNotePopup(true); // Show modal
  }; // End handleAddNote helper
// Added per instruction to keep comment coverage
  const saveNote = () => { // Persist note locally (future: DB)
    setNotes({ ...notes, [selectedDay.toDateString()]: currentNote }); // Update keyed note map
    setShowNotePopup(false); // Hide modal after save
  }; // End saveNote helper
// Added per instruction to keep comment coverage
  const handleAddAppointment = async (customDate) => { // Create or update booking against a job
    const appointmentDate = customDate || (selectedDay ? selectedDay.toISOString().split("T")[0] : null); // Determine ISO date string
    if (!jobNumber.trim()) { // Validate job number entry
      alert("❌ Error: Job number is required"); // Warn user
      return; // Abort action
    } // Close job number guard
    if (!appointmentDate) { // Validate date selection
      alert("❌ Error: Please select a date"); // Warn user
      return; // Abort action
    } // Close date guard
    if (!time.trim()) { // Validate time slot
      alert("❌ Error: Please select a time"); // Warn user
      return; // Abort action
    } // Close time guard
    setIsLoading(true); // Lock controls during request
    try { // Wrap asynchronous logic
      const normalizedJobNumber = jobNumber.toString().trim(); // Normalize user input
      let job = jobs.find((j) => j.jobNumber?.toString() === normalizedJobNumber || j.id?.toString() === normalizedJobNumber); // Attempt to find job locally
      if (!job) { // If not already cached
        job = await getJobByNumberOrReg(normalizedJobNumber); // Query Supabase
        if (!job) { // Confirm job exists
          alert(`❌ Error: Job ${normalizedJobNumber} does not exist in the system.`); // Inform user
          setIsLoading(false); // Release spinner early
          return; // Abort action
        } // Close no job guard
      } // Close local job guard
      const appointmentResult = await createOrUpdateAppointment(job.jobNumber, appointmentDate, time, currentNote || null); // Persist appointment info
      if (!appointmentResult.success) { // Validate Supabase response
        const errorMessage = appointmentResult.error?.message || "Unknown error occurred"; // Build message string
        alert(`❌ Error booking appointment:\n\n${errorMessage}`); // Display blocking alert
        setIsLoading(false); // Release loading
        return; // Abort action
      } // Close success guard
      const updatedJob = { // Compose job object with refreshed appointment info
        ...job, // Keep original job data
        appointment: { // Provide appointment details for UI
          appointmentId: appointmentResult.data?.appointment?.appointment_id, // Database identifier when available
          date: appointmentDate, // Selected date
          time: time, // Selected time slot
          notes: currentNote || "", // Inline note value
          status: "Scheduled" // Friendly state label
        }, // Close appointment object
        status: "Booked" // Update job workflow state for UI clarity
      }; // Close updatedJob literal
      const jobIndex = jobs.findIndex((j) => j.id === job.id); // Determine whether job exists in current set
      if (jobIndex !== -1) { // If yes, update existing entry
        const updatedJobs = [...jobs]; // Clone array
        updatedJobs[jobIndex] = updatedJob; // Replace slot with new data
        setJobs(updatedJobs); // Commit updates
      } else { // If new entry
        setJobs([...jobs, updatedJob]); // Append to list
      } // Close job replacement guard
      setHighlightJob(job.jobNumber || job.id?.toString() || ""); // Trigger highlight animation for touched job
      setSelectedDay(new Date(appointmentDate)); // Jump table selection to booked day
      setTimeout(() => setHighlightJob(""), 3000); // Reset highlight after animation delay
      alert( // Provide user confirmation summary
        `✅ Appointment booked successfully!\n\n` + // Title line
        `Job Number: ${job.jobNumber}\n` + // Job reference line
        `Customer: ${job.customer}\n` + // Customer line
        `Vehicle: ${job.reg}\n` + // Registration line
        `Date: ${appointmentDate}\n` + // Date line
        `Time: ${time}` // Time line
      ); // Finish alert
      setJobNumber(""); // Reset job input after success
      setTime(""); // Reset time dropdown
      setCurrentNote(""); // Reset inline note entry
    } catch (error) { // Catch unexpected failures
      console.error("Unexpected error booking appointment", error); // Log issue
      alert(`❌ Unexpected error:\n\n${error.message}`); // Notify user gracefully
    } finally { // Always executed
      setIsLoading(false); // Unlock UI
    } // Close try/catch/finally
  }; // End handleAddAppointment helper
// Added per instruction to keep comment coverage
  const formatDate = (dateObj) => dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); // Format dates with day/month for headers
  const formatDateNoYear = (dateObj) => dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); // Shared note modal label formatter
  const isSaturday = (date) => date.getDay() === 6; // Identify Saturdays for styling
  const getTechHoursForDay = (date) => techHours[date.toDateString()] || techsDefault; // Lookup tech capacity override
// Added per instruction to keep comment coverage
  const handleTechHoursChange = (event) => { // Persist local tech count edits for selected day
    const value = parseInt(event.target.value, 10) || 0; // Parse numeric value safely
    setTechHours({ ...techHours, [selectedDay.toDateString()]: value }); // Update map entry
  }; // End handleTechHoursChange helper
// Added per instruction to keep comment coverage
  const toggleTechHoursEditor = () => setShowTechHoursEditor((prev) => !prev); // Toggle inline capacity editor panel
// Added per instruction to keep comment coverage
  const getJobCounts = (date) => { // Aggregate job statistics per day
    const dateKey = date.toISOString().split("T")[0]; // ISO calendar key for match comparisons
    const jobsForDate = jobs.filter((job) => job.appointment?.date === dateKey); // Filter by day
    const getTypeMatch = (job, keyword) => { // Helper for safe text matches against job type
      const type = job.type?.toLowerCase() || ""; // Normalize type string or fallback
      return type.includes(keyword.toLowerCase()); // Evaluate substring match
    }; // Close helper
    return { // Provide metrics for UI badges
      totalJobs: jobsForDate.length, // Count all jobs for day
      services: jobsForDate.filter((job) => job.jobCategories?.includes("Service") || getTypeMatch(job, "service")).length, // Service rows
      MOT: jobsForDate.filter((job) => job.jobCategories?.includes("MOT") || getTypeMatch(job, "mot")).length, // MOT rows
      diagnosis: jobsForDate.filter((job) => job.jobCategories?.includes("Diagnostic") || getTypeMatch(job, "diagnosis") || getTypeMatch(job, "diagnostic")).length, // Diagnostic rows
      other: jobsForDate.filter((job) => { // Everything else bucket
        const categories = job.jobCategories || []; // Normalized array
        const type = job.type?.toLowerCase() || ""; // Lowercase type
        const keywords = ["mot", "service", "diagnosis", "diagnostic"]; // Known categories to exclude
        const hasKnownCategory = categories.some((cat) => ["MOT", "Service", "Diagnostic"].includes(cat)); // Check categories
        const hasKnownType = keywords.some((word) => type.includes(word)); // Check type string
        return !hasKnownCategory && !hasKnownType; // Only include if neither matches
      }).length, // Finish other metric
      totalHours: jobsForDate.reduce((sum, job) => { // Sum estimated labor hours
        if (!Array.isArray(job.requests)) return sum; // Skip jobs without structured requests
        const jobHours = job.requests.reduce((requestSum, request) => requestSum + (parseFloat(request.time) || 0), 0); // Sum request durations
        return sum + jobHours; // Add to total
      }, 0).toFixed(1) // Show hours with single decimal precision
    }; // Close metrics object
  }; // End getJobCounts helper
// Added per instruction to keep comment coverage
  const jobsForDay = jobs.filter((job) => job.appointment?.date === selectedDay.toISOString().split("T")[0]); // Extract bookings for selected table row
  const filteredJobs = jobsForDay.filter((job) => { // Apply text search filter
    const query = searchQuery.toLowerCase(); // Normalize input
    return ( // Evaluate matching conditions
      job.jobNumber?.toString().includes(query) || // Match job number
      job.id?.toString().includes(query) || // Match internal id
      job.customer?.toLowerCase().includes(query) || // Match customer name
      job.reg?.toLowerCase().includes(query) || // Match registration
      job.makeModel?.toLowerCase().includes(query) // Match vehicle description
    ); // Close OR block
  }); // End filteredJobs computation
  const sortedJobs = filteredJobs.sort((a, b) => { // Keep appointments ordered by time
    const timeA = a.appointment?.time || "00:00"; // Default earlier for missing time
    const timeB = b.appointment?.time || "00:00"; // Same default for comparator
    return timeA.localeCompare(timeB); // Compare lexicographically (HH:MM sorted)
  }); // End sortedJobs computation
// Added per instruction to keep comment coverage
  return ( // Begin render tree
    <Layout> // Wrap page in layout (already direct calendar view)
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "8px 16px" }}> // Primary container
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px", padding: "12px", backgroundColor: "#fff", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)" }}> // Toolbar with actions
          <button onClick={() => handleAddNote(selectedDay)} disabled={isLoading} style={{ padding: "10px 20px", backgroundColor: isLoading ? "#ccc" : "#FF4040", color: "white", border: "none", borderRadius: "8px", cursor: isLoading ? "not-allowed" : "pointer", fontWeight: "500", fontSize: "14px", transition: "background-color 0.2s" }}> // Trigger note popup
            📝 Add Note // Button label
          </button> // Close note button
          <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by Job #, Name, Reg, or Vehicle..." disabled={isLoading} style={{ flex: 1, padding: "10px 16px", borderRadius: "8px", border: "1px solid #e0e0e0", fontSize: "14px", outline: "none" }} /> // Search input for appointments list
          <input type="text" value={jobNumber} onChange={(event) => setJobNumber(event.target.value)} placeholder="Job Number" disabled={isLoading} style={{ width: "140px", padding: "10px 16px", borderRadius: "8px", border: "1px solid #e0e0e0", fontSize: "14px", outline: "none" }} /> // Job number form field
          <select value={time} onChange={(event) => setTime(event.target.value)} disabled={isLoading} style={{ width: "120px", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e0e0e0", fontSize: "14px", cursor: "pointer", outline: "none" }}> // Time slot dropdown
            <option value="">Select time</option> // Placeholder option
            {timeSlots.map((slot) => ( // Iterate over available time slots
              <option key={slot} value={slot}>{slot}</option> // Present each slot value
            ))} // Close slot mapping
          </select> // Close select field
          <button onClick={() => handleAddAppointment(selectedDay.toISOString().split("T")[0])} disabled={isLoading} style={{ padding: "10px 20px", backgroundColor: isLoading ? "#ccc" : "#FF4040", color: "white", border: "none", borderRadius: "8px", cursor: isLoading ? "not-allowed" : "pointer", fontWeight: "600", fontSize: "14px", transition: "background-color 0.2s" }}> // Submit appointment booking directly from calendar view
            {isLoading ? "Booking..." : "📅 Book Appointment"} // Dynamic CTA text
          </button> // Close booking button
        </div> // Close toolbar
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}> // Secondary controls row
          <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: "8px", padding: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)" }}> // Tech availability panel
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}> // Panel header
              <h3 style={{ margin: 0, fontSize: "16px" }}>Technician Capacity</h3> // Title
              <button onClick={toggleTechHoursEditor} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #ddd", backgroundColor: "#f9f9f9", cursor: "pointer", fontSize: "12px" }}> // Toggle button
                {showTechHoursEditor ? "Hide Editor" : "Edit"} // Toggle label
              </button> // Close toggle
            </div> // Close header
            <div style={{ fontSize: "14px", color: "#555" }}> // Panel body
              Default capacity per day: {techsDefault} technicians // Display baseline
            </div> // Close body text
            {showTechHoursEditor && ( // Conditionally display editor UI
              <div style={{ marginTop: "12px" }}> // Editor wrapper
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13px" }}> // Label for editor input
                  Techs for {formatDate(selectedDay)} // Label text referencing selected day
                </label> // Close label
                <input type="number" min="0" value={techHours[selectedDay.toDateString()] ?? techsDefault} onChange={handleTechHoursChange} style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "14px" }} /> // Numeric input for overriding tech count
              </div> // Close editor wrapper
            )} // Close conditional editor
          </div> // Close capacity panel
          <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: "8px", padding: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)" }}> // Selected day summary card
            <h3 style={{ marginTop: 0, marginBottom: "12px", fontSize: "16px" }}>Overview for {formatDate(selectedDay)}</h3> // Card title
            {(() => { // Self-invoking block to render metrics
              const counts = getJobCounts(selectedDay); // Retrieve stats
              return ( // Output summary rows
                <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "14px", color: "#555" }}> // Stats list container
                  <li>Total Jobs: {counts.totalJobs}</li> // Total jobs metric
                  <li>Total Hours: {counts.totalHours}</li> // Total hours metric
                  <li>Services: {counts.services}</li> // Services metric
                  <li>MOT: {counts.MOT}</li> // MOT metric
                  <li>Diagnosis: {counts.diagnosis}</li> // Diagnosis metric
                  <li>Other: {counts.other}</li> // Other metric
                </ul> // Close list
              ); // Close return block
            })()} // Close IIFE render
          </div> // Close summary card
        </div> // Close secondary controls row
        <div style={{ flex: "0 0 auto", maxHeight: "calc(14 * 42px + 60px)", overflowY: "auto", marginBottom: "12px", borderRadius: "10px", boxShadow: "0 2px 6px rgba(0,0,0,0.1)", backgroundColor: "#fff" }}> // Calendar table container for direct landing experience
          <table style={{ width: "100%", borderCollapse: "collapse" }}> // Calendar table
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}> // Sticky header for readability
              <tr style={{ backgroundColor: "#f6f6f6", borderBottom: "2px solid #FF4040" }}> // Header row styling
                {["Day/Date", "Availability", "Total Hours", "Total Jobs", "Services", "MOT", "Diagnosis", "Other", "Notes"].map((header) => ( // Column headers definition
                  <th key={header} style={{ textAlign: "left", padding: "10px 12px", fontWeight: "600", fontSize: "14px", color: "#333", borderBottom: "1px solid #ddd", background: "#f9f9f9", position: "sticky", top: 0 }}> // Header cell styling
                    {header} // Header text
                  </th> // Close header cell
                ))} // Close map over headers
              </tr> // Close table row
            </thead> // Close header
            <tbody> // Begin calendar body
              {dates.map((date) => { // Loop through generated business days
                const dateKey = date.toDateString(); // Unique key for note map
                const counts = getJobCounts(date); // Stats for row
                const isSelected = selectedDay.toDateString() === date.toDateString(); // Determine selection state
                const isSat = isSaturday(date); // Determine Saturday styling
                return ( // Render each day row
                  <tr key={dateKey} onClick={() => setSelectedDay(date)} style={{ cursor: "pointer", backgroundColor: isSelected ? "#FFF2F2" : isSat ? "#FFF8E1" : "#fff", transition: "background-color 0.2s" }}> // Row with click selection
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontWeight: isSelected ? "600" : "400" }}>{formatDate(date)}</td> // Day label
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{getTechHoursForDay(date)} techs</td> // Tech availability cell
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{counts.totalHours}</td> // Hours metric cell
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{counts.totalJobs}</td> // Job count cell
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{counts.services}</td> // Services cell
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{counts.MOT}</td> // MOT cell
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{counts.diagnosis}</td> // Diagnosis cell
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{counts.other}</td> // Other cell
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>{notes[dateKey] || "-"}</td> // Notes cell from local cache
                  </tr> // Close row
                ); // Close return for row
              })} // Close date map
            </tbody> // Close table body
          </table> // Close calendar table
        </div> // Close calendar container
        <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: "10px", padding: "12px", boxShadow: "0 2px 6px rgba(0,0,0,0.1)", overflow: "hidden" }}> // Appointment list wrapper
          <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "20px" }}>Appointments for {formatDate(selectedDay)}</h2> // Section title
          <div style={{ maxHeight: "420px", overflowY: "auto" }}> // Scroll area for job cards
            {sortedJobs.length > 0 ? ( // Conditionally render jobs
              sortedJobs.map((job) => ( // Iterate over sorted bookings
                <div key={job.appointment?.appointmentId || job.id} style={{ border: highlightJob === (job.jobNumber || job.id?.toString()) ? "2px solid #FF4040" : "1px solid #eee", borderRadius: "8px", padding: "12px", marginBottom: "12px", backgroundColor: "#fafafa", transition: "border-color 0.2s" }}> // Individual job card container
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}> // Header row for card
                    <strong>Job #{job.jobNumber || job.id}</strong> // Job identifier
                    <span>{job.appointment?.time || "--:--"}</span> // Appointment time label
                  </div> // Close header row
                  <div style={{ fontSize: "14px", color: "#555" }}> // Details block
                    <div>Customer: {job.customer || "-"}</div> // Customer row
                    <div>Vehicle: {getVehicleDisplay(job)} ({job.reg || "No Reg"})</div> // Vehicle row
                    <div>Status: {job.status || "Pending"}</div> // Status row
                    {job.appointment?.notes && ( // Show appointment note when available
                      <div>Notes: {job.appointment.notes}</div> // Appointment note text
                    )} // Close appointment notes conditional
                  </div> // Close details block
                </div> // Close job card
              )) // Close map over jobs
            ) : ( // Empty state fallback when no appointments match
              <div style={{ padding: "40px", textAlign: "center", color: "#999" }}> // Empty state container
                No appointments booked for this day // Empty state text
              </div> // Close empty state container
            )} // Close conditional render
          </div> // Close scroll area
        </div> // Close appointment list wrapper
        <Popup isOpen={showNotePopup} onClose={() => setShowNotePopup(false)}> // Note editing modal always available on this page
          <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "20px", fontWeight: "600" }}>Add Note for {formatDateNoYear(selectedDay)}</h3> // Popup title
          <textarea style={{ width: "100%", height: "120px", padding: "12px", borderRadius: "8px", border: "1px solid #e0e0e0", fontSize: "14px", fontFamily: "inherit", resize: "vertical", outline: "none" }} value={currentNote} onChange={(event) => setCurrentNote(event.target.value)} placeholder="Enter notes about this day's schedule..." /> // Note textarea
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", gap: "10px" }}> // Popup actions wrapper
            <button onClick={saveNote} style={{ flex: 1, padding: "10px 20px", backgroundColor: "#FF4040", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", transition: "background-color 0.2s" }}> // Save note button
              💾 Save Note // Save label
            </button> // Close save button
            <button onClick={() => setShowNotePopup(false)} style={{ flex: 1, padding: "10px 20px", backgroundColor: "#666", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", transition: "background-color 0.2s" }}> // Cancel button
              Cancel // Cancel label
            </button> // Close cancel button
          </div> // Close popup actions
        </Popup> // Close note popup
      </div> // Close main container
    </Layout> // Close layout wrapper
  ); // Close component render
} // End Appointments component
