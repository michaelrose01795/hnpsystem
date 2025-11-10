// file location: src/pages/job-cards/[jobNumber]/write-up.js
"use client";

<<<<<<< ours
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
=======
import React, { useEffect, useMemo, useState } from "react"; // import React utilities for state and lifecycle
import { useRouter } from "next/router"; // import router to navigate between job card pages
import Layout from "../../../components/Layout"; // import shared layout for consistent styling
>>>>>>> theirs
import {
  getWriteUpByJobNumber,
  saveWriteUpToDatabase,
  getJobByNumber
<<<<<<< ours
} from "../../../lib/database/jobs";
import { useUser } from "../../../context/UserContext";
import { usersByRole } from "../../../config/users";
=======
} from "../../../lib/database/jobs"; // import Supabase helpers for write-up data
import { useUser } from "../../../context/UserContext"; // import user context to determine permissions
import { usersByRole } from "../../../config/users"; // import role map to check if user is a technician

const formatBulletText = (text = "") => {
  if (!text || typeof text !== "string") {
    return ""; // ensure empty values return a blank string
  }

  const paragraphs = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0); // remove blank lines

  if (paragraphs.length === 0) {
    return ""; // if no meaningful content then return empty
  }

  return paragraphs
    .map((line) => (line.startsWith("-") ? line : `- ${line}`)) // prefix each paragraph with bullet dash
    .join("\n");
};

const normaliseRequestText = (request) => {
  if (!request) {
    return ""; // guard for null or undefined
  }

  if (typeof request === "string") {
    return request; // already a simple string
  }

  if (typeof request === "object") {
    return (
      request.description ||
      request.title ||
      request.name ||
      request.summary ||
      JSON.stringify(request)
    ); // attempt to extract a readable label from object requests
  }

  return String(request); // fallback to generic string conversion
};

const normaliseRequestsList = (requests) => {
  if (Array.isArray(requests)) {
    return requests; // already an array of requests
  }

  if (typeof requests === "string" && requests.trim().length > 0) {
    try {
      const parsed = JSON.parse(requests);
      if (Array.isArray(parsed)) {
        return parsed; // parsed JSON array
      }
    } catch (err) {
      return [requests]; // treat simple string as single request entry
    }
    return [requests];
  }

  if (requests && typeof requests === "object") {
    return Object.values(requests); // convert keyed object into array values
  }

  return []; // default to empty array
};

const buildFaultPrefill = ({ existingFault, jobDescription, jobRequests }) => {
  const contextLines = []; // store lines describing original job brief

  if (jobDescription) {
    contextLines.push(`Original Job Description: ${jobDescription}`); // include core description first
  }

  const requestsArray = Array.isArray(jobRequests) ? jobRequests : []; // ensure requests is an array

  requestsArray.forEach((request, index) => {
    const requestLabel = normaliseRequestText(request);
    if (requestLabel) {
      contextLines.push(`Request ${index + 1}: ${requestLabel}`); // number each request per requirement
    }
  });

  const contextBlock = formatBulletText(contextLines.join("\n")); // format the context with bullet prefix

  if (!existingFault) {
    return contextBlock; // if no existing fault text simply return context
  }

  const formattedExisting = formatBulletText(existingFault); // normalise the stored fault text

  if (contextBlock && formattedExisting.includes(jobDescription || "")) {
    return formattedExisting; // avoid duplicating description if already present
  }

  if (contextBlock) {
    return formatBulletText(`${formattedExisting}\n${contextBlock}`); // append new context with bullets
  }

  return formattedExisting; // fallback to stored value
};

const buildRectificationSummary = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return ""; // no rectification items produces blank summary
  }

  const lines = items.map((item, index) => {
    const description = item.description || `Rectification Item ${index + 1}`; // default description if empty
    const statusLabel = item.status === "complete" ? "Complete" : "Waiting Additional Work"; // choose status wording
    return `${index + 1}. ${description} (${statusLabel})`;
  });

  return formatBulletText(lines.join("\n")); // ensure bullets applied to combined text
};

const createManualRectificationItem = (nextIndex) => ({
  recordId: null, // no database id for manual items until saved
  description: `Manual Rectification Item ${nextIndex + 1}`, // provide placeholder text for editing
  status: "waiting", // default to waiting to flag additional work
  isAdditionalWork: false, // manual items are not automatically flagged as VHC additional work
  vhcItemId: null, // no linked VHC item
  authorizationId: null, // no authorization record
  authorizedAmount: null, // no monetary value assigned yet
  source: "manual", // mark as manual for UI controls
});

const getStatusPill = (status) => {
  if (status === "complete") {
    return { label: "Complete", background: "#dcfce7", color: "#047857" }; // green pill when complete
  }
  return { label: "Waiting Additional Work", background: "#fee2e2", color: "#b91c1c" }; // red pill when waiting
};
>>>>>>> theirs

// ✅ Helper ensures every paragraph is prefixed with a bullet dash
const formatNoteValue = (value = "") => {
  if (!value) return "";
  return value
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const cleaned = trimmed.replace(/^-+\s*/, "");
      return `- ${cleaned}`;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
};

// ✅ Normalise requests so we can show numbered entries consistently
const buildRequestList = (rawRequests) => {
  if (!rawRequests) return [];

  let requestArray = [];
  if (Array.isArray(rawRequests)) {
    requestArray = rawRequests;
  } else if (typeof rawRequests === "string") {
    try {
      const parsed = JSON.parse(rawRequests);
      if (Array.isArray(parsed)) {
        requestArray = parsed;
      } else if (rawRequests.includes("\n")) {
        requestArray = rawRequests.split(/\r?\n/);
      } else if (rawRequests.trim()) {
        requestArray = [rawRequests];
      }
    } catch (_error) {
      requestArray = rawRequests.split(/\r?\n/);
    }
  }

  return requestArray
    .map((entry, index) => {
      const rawText =
        typeof entry === "string"
          ? entry
          : typeof entry === "object" && entry !== null
            ? entry.text ?? entry.note ?? entry.description ?? ""
            : "";
      const cleaned = (rawText || "").toString().trim();
      if (!cleaned) return null;
      return {
        source: "request",
        sourceKey: `req-${index + 1}`,
        label: `Request ${index + 1}: ${cleaned}`,
      };
    })
    .filter(Boolean);
};

// ✅ Compose a unique key for checklist items
const composeTaskKey = (task) => `${task.source}:${task.sourceKey}`;

// ✅ Generate a reusable empty checkbox array
const createCheckboxArray = () => Array(10).fill(false);

export default function WriteUpPage() {
  const router = useRouter(); // initialise router for navigation actions
  const { jobNumber } = router.query; // read job number from URL parameters
  const { user } = useUser(); // get the logged in user for permissions

<<<<<<< ours
  const [jobData, setJobData] = useState(null);
  const [requestsSummary, setRequestsSummary] = useState([]);
  const [authorizedItems, setAuthorizedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
=======
  const [jobData, setJobData] = useState(null); // store job card details for header and context
  const [requestsList, setRequestsList] = useState([]); // store customer requests to render in sidebar
  const [rectificationItems, setRectificationItems] = useState([]); // store checklist items linked to additional work
>>>>>>> theirs
  const [writeUpData, setWriteUpData] = useState({
    fault: "",
    caused: "",
    rectification: "",
    warrantyClaim: "",
    tsrNumber: "",
    pwaNumber: "",
    technicalBulletins: "",
    technicalSignature: "",
    qualityControl: "",
    additionalParts: "",
<<<<<<< ours
    qty: createCheckboxArray(),
    booked: createCheckboxArray(),
    tasks: [],
    completionStatus: "additional_work",
    jobDescription: "",
    vhcAuthorizationId: null,
  });

  const username = user?.username;
  const techsList = usersByRole["Techs"] || [];
  const isTech = techsList.includes(username);

  // ✅ Fetch job + write-up data whenever the job number changes
=======
    qty: Array(10).fill(false),
    booked: Array(10).fill(false),
    rectificationItems: [],
  }); // track form data for write-up fields
  const [loading, setLoading] = useState(true); // show spinner while data loads

  const username = user?.username; // extract username for role lookup
  const techsList = usersByRole["Techs"] || []; // list of technician usernames
  const isTech = techsList.includes(username); // determine if current user is a technician

>>>>>>> theirs
  useEffect(() => {
    if (!jobNumber) {
      return; // avoid fetching until job number exists
    }

    const fetchData = async () => {
      try {
<<<<<<< ours
        setLoading(true);

        const jobResponse = await getJobByNumber(jobNumber);
        const jobPayload = jobResponse?.data || null;
        if (jobPayload) {
          setJobData(jobPayload);
        }

        const writeUpResponse = await getWriteUpByJobNumber(jobNumber);

        if (writeUpResponse) {
          setRequestsSummary(writeUpResponse.requests || buildRequestList(jobPayload?.jobCard?.requests));
          setAuthorizedItems(writeUpResponse.authorisedItems || []);
          setWriteUpData((prev) => ({
            ...prev,
            fault: writeUpResponse.fault || "",
            caused: writeUpResponse.caused || "",
            rectification: writeUpResponse.rectification || "",
            warrantyClaim: writeUpResponse.warrantyClaim || "",
            tsrNumber: writeUpResponse.tsrNumber || "",
            pwaNumber: writeUpResponse.pwaNumber || "",
            technicalBulletins: writeUpResponse.technicalBulletins || "",
            technicalSignature: writeUpResponse.technicalSignature || "",
            qualityControl: writeUpResponse.qualityControl || "",
            additionalParts: writeUpResponse.additionalParts || "",
            qty: writeUpResponse.qty || createCheckboxArray(),
            booked: writeUpResponse.booked || createCheckboxArray(),
            tasks: writeUpResponse.tasks || [],
            completionStatus: writeUpResponse.completionStatus || "additional_work",
            jobDescription: writeUpResponse.jobDescription || writeUpResponse.fault || "",
            vhcAuthorizationId: writeUpResponse.vhcAuthorizationId || null,
          }));
        } else {
          const fallbackRequests = buildRequestList(jobPayload?.jobCard?.requests);
          const fallbackDescription = formatNoteValue(jobPayload?.jobCard?.description || "");
          setRequestsSummary(fallbackRequests);
          setAuthorizedItems([]);
          setWriteUpData((prev) => ({
            ...prev,
            fault: fallbackDescription,
            caused: "",
            rectification: "",
            warrantyClaim: "",
            tsrNumber: "",
            pwaNumber: "",
            technicalBulletins: "",
            technicalSignature: "",
            qualityControl: "",
            additionalParts: "",
            qty: createCheckboxArray(),
            booked: createCheckboxArray(),
            tasks: fallbackRequests.map((item) => ({
              taskId: null,
              source: item.source,
              sourceKey: item.sourceKey,
              label: item.label,
              status: "additional_work",
            })),
            completionStatus: "additional_work",
            jobDescription: fallbackDescription,
            vhcAuthorizationId: null,
          }));
        }
      } catch (error) {
        console.error("❌ Error fetching write-up:", error);
=======
        setLoading(true); // indicate loading state while fetching data

        const { data: jobResponse } = await getJobByNumber(jobNumber); // fetch job card information

        if (jobResponse?.jobCard) {
          setJobData(jobResponse.jobCard); // store job card data for rendering
          setRequestsList(normaliseRequestsList(jobResponse.jobCard.requests)); // cache job requests for numbering
        }

        const writeUpResponse = await getWriteUpByJobNumber(jobNumber); // fetch existing write-up or default data

        if (writeUpResponse) {
          const nextRectificationItems = writeUpResponse.rectificationItems || []; // capture rectification data from backend

          setRectificationItems(nextRectificationItems); // sync rectification checklist to local state

          setWriteUpData((prev) => ({
            ...prev,
            ...writeUpResponse,
            fault: buildFaultPrefill({
              existingFault: writeUpResponse.fault,
              jobDescription: jobResponse?.jobCard?.description,
              jobRequests: normaliseRequestsList(jobResponse?.jobCard?.requests),
            }), // merge job description and requests into fault text
            rectification: buildRectificationSummary(nextRectificationItems), // auto generate rectification summary
            qty: writeUpResponse.qty || Array(10).fill(false), // ensure checkbox arrays always populated
            booked: writeUpResponse.booked || Array(10).fill(false),
            rectificationItems: nextRectificationItems,
          }));
        } else {
          setRectificationItems([]); // no rectification entries yet
          setWriteUpData((prev) => ({
            ...prev,
            fault: buildFaultPrefill({
              existingFault: "",
              jobDescription: jobResponse?.jobCard?.description,
              jobRequests: normaliseRequestsList(jobResponse?.jobCard?.requests),
            }), // seed fault text even without write-up record
            rectification: "",
            rectificationItems: [],
          }));
        }
      } catch (err) {
        console.error("Error fetching write-up:", err); // log error for debugging
        alert("❌ Failed to load write-up data. Please try again."); // show friendly error message
>>>>>>> theirs
      } finally {
        setLoading(false); // remove loading spinner once fetch completes
      }
    };

    fetchData();
  }, [jobNumber]);

<<<<<<< ours
  // ✅ Shared handler for plain text fields
  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setWriteUpData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // ✅ Handler for bullet-formatted text areas (except fault which also mirrors job description)
  const handleNoteChange = (field) => (event) => {
    const formatted = formatNoteValue(event.target.value);
    setWriteUpData((prev) => ({
      ...prev,
      [field]: formatted,
    }));
  };

  // ✅ Dedicated handler for the fault section so it keeps the job card description in sync
  const handleFaultChange = (event) => {
    const formatted = formatNoteValue(event.target.value);
    setWriteUpData((prev) => ({
      ...prev,
      fault: formatted,
      jobDescription: formatted,
    }));
  };

  // ✅ Toggle checklist status and auto-update completion state
  const toggleTaskStatus = (taskKey) => {
    setWriteUpData((prev) => {
      const updatedTasks = prev.tasks.map((task) => {
        const currentKey = composeTaskKey(task);
        if (currentKey !== taskKey) return task;
        const nextStatus = task.status === "complete" ? "additional_work" : "complete";
        return { ...task, status: nextStatus };
      });

      const completionStatus = updatedTasks.every((task) => task.status === "complete")
        ? "complete"
        : "additional_work";

      return { ...prev, tasks: updatedTasks, completionStatus };
    });
  };

  // ✅ Persist write-up back to the database
  const handleSave = async () => {
    if (!jobNumber) {
      alert("Missing job number");
      return;
    }

    try {
      setSaving(true);
      const result = await saveWriteUpToDatabase(jobNumber, writeUpData);
      setSaving(false);
=======
  const outstandingAdditionalWork = useMemo(
    () => rectificationItems.some((item) => item.status !== "complete"),
    [rectificationItems]
  ); // compute whether any checklist item is still waiting

  const handleChange = (field, value) => {
    setWriteUpData((prev) => ({ ...prev, [field]: value })); // update text input fields generically
  };

  const handleBulletBlur = (field) => {
    setWriteUpData((prev) => ({ ...prev, [field]: formatBulletText(prev[field]) })); // enforce bullet format on blur
  };

  const handleCheckboxChange = (field, index) => {
    setWriteUpData((prev) => {
      const updatedArray = [...prev[field]];
      updatedArray[index] = !updatedArray[index];
      return { ...prev, [field]: updatedArray };
    }); // toggle qty/booked checkbox state
  };

  const updateRectificationItems = (items) => {
    setRectificationItems(items); // sync local rectification array
    setWriteUpData((prev) => ({
      ...prev,
      rectificationItems: items,
      rectification: buildRectificationSummary(items),
    })); // keep summary aligned with checklist entries
  };

  const handleRectificationDescriptionChange = (index, value) => {
    updateRectificationItems(
      rectificationItems.map((item, idx) =>
        idx === index ? { ...item, description: value } : item
      )
    ); // update description per row
  };

  const toggleRectificationStatus = (index) => {
    updateRectificationItems(
      rectificationItems.map((item, idx) =>
        idx === index
          ? { ...item, status: item.status === "complete" ? "waiting" : "complete" }
          : item
      )
    ); // flip between waiting and complete states
  };

  const handleAddRectificationItem = () => {
    updateRectificationItems([
      ...rectificationItems,
      createManualRectificationItem(rectificationItems.length),
    ]); // append a new manual checklist entry
  };

  const handleRemoveRectificationItem = (index) => {
    const target = rectificationItems[index];
    if (target?.source === "vhc" || target?.recordId) {
      alert("🔒 Authorized items cannot be removed. Mark them complete when finished.");
      return; // prevent deleting VHC-authorized items to preserve audit trail
    }

    updateRectificationItems(rectificationItems.filter((_, idx) => idx !== index)); // remove manual row
  };

  const handleSave = async () => {
    if (!jobNumber) {
      alert("Missing job number");
      return; // guard for missing job number
    }

    try {
      const payload = {
        ...writeUpData,
        rectificationItems,
        fault: formatBulletText(writeUpData.fault),
        caused: formatBulletText(writeUpData.caused),
        rectification: buildRectificationSummary(rectificationItems),
        additionalParts: formatBulletText(writeUpData.additionalParts),
      }; // prepare payload with enforced bullet formatting

      const result = await saveWriteUpToDatabase(jobNumber, payload); // persist to Supabase
>>>>>>> theirs

      if (result?.success) {
        if (result.completionStatus) {
          setWriteUpData((prev) => ({ ...prev, completionStatus: result.completionStatus }));
        }

        alert("✅ Write-up saved successfully!");

        if (isTech) {
          router.push(`/job-cards/myjobs/${jobNumber}`); // return to technician job view
        } else {
          router.push(`/job-cards/${jobNumber}`); // return to manager job view
        }
      } else {
        alert(result?.error || "❌ Failed to save write-up");
      }
    } catch (error) {
      console.error("Error saving write-up:", error);
      setSaving(false);
      alert("❌ Error saving write-up");
    }
  };

  const goBackToJobCard = () => {
    if (isTech) {
      router.push(`/job-cards/myjobs/${jobNumber}`);
    } else {
      router.push(`/job-cards/${jobNumber}`);
    }
  }; // navigate back to appropriate job card view

  const goToCheckSheet = () => router.push(`/job-cards/${jobNumber}/check-box`); // jump to check sheet builder
  const goToVehicleDetails = () => router.push(`/job-cards/${jobNumber}/car-details`); // jump to vehicle detail view

<<<<<<< ours
  const totalTasks = writeUpData.tasks.length;
  const completedTasks = writeUpData.tasks.filter((task) => task.status === "complete").length;
  const completionStatusLabel =
    writeUpData.completionStatus === "complete" ? "Complete" : "Waiting Additional Work";
  const completionStatusColor = writeUpData.completionStatus === "complete" ? "#10b981" : "#f59e0b";

  // ✅ Loading state with spinner animation
=======
>>>>>>> theirs
  if (loading) {
    return (
      <Layout>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "80vh",
          flexDirection: "column",
          gap: "16px"
        }}>
          <div style={{
            width: "60px",
            height: "60px",
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #d10000",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "#666" }}>Loading write-up...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "8px 16px",
        overflow: "hidden"
      }}>
<<<<<<< ours

        {/* ✅ Header Section */}
=======
>>>>>>> theirs
        {jobData && (
          <div style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginBottom: "12px",
            padding: "12px",
            backgroundColor: "#fff",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
            flexShrink: 0
          }}>
            <button
              onClick={goBackToJobCard}
              style={{
                padding: "10px 24px",
                backgroundColor: "#d10000",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                boxShadow: "0 4px 10px rgba(209,0,0,0.16)",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
            >
              ← Back
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{
                color: "#d10000",
                fontSize: "28px",
                fontWeight: "700",
                margin: "0 0 4px 0"
              }}>
                Write-Up - Job #{jobNumber}
              </h1>
              <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
<<<<<<< ours
                {jobData.customer?.firstName} {jobData.customer?.lastName} | {jobData.jobCard?.reg}
              </p>
            </div>
            <div style={{
              padding: "8px 16px",
              backgroundColor: completionStatusColor,
              color: "white",
              borderRadius: "20px",
              fontWeight: "600",
              fontSize: "13px"
            }}>
              {completionStatusLabel}
            </div>
          </div>
        )}

        {/* ✅ Main Content Area with Scrolling */}
=======
                {(jobData.customer && typeof jobData.customer === "string") ? jobData.customer : "Customer"} |
                {" "}
                {jobData.reg || jobData.vehicle_reg || ""}
              </p>
            </div>
            {outstandingAdditionalWork ? (
              <div style={{
                padding: "8px 16px",
                borderRadius: "999px",
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                fontWeight: "600",
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.06em"
              }}>
                Additional Work Waiting
              </div>
            ) : (
              <div style={{
                padding: "8px 16px",
                borderRadius: "999px",
                backgroundColor: "#dcfce7",
                color: "#047857",
                fontWeight: "600",
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.06em"
              }}>
                All Additional Work Complete
              </div>
            )}
          </div>
        )}

>>>>>>> theirs
        <div style={{
          flex: 1,
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
          border: "1px solid #ffe5e5",
          background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
          padding: "24px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0
        }}>
<<<<<<< ours

=======
>>>>>>> theirs
          <div style={{
            flex: 1,
            overflowY: "auto",
            paddingRight: "8px",
            minHeight: 0
          }}>
            <div style={{
              display: "flex",
              gap: "16px",
              height: "100%"
            }}>
<<<<<<< ours

              {/* ✅ Left Section - Notes and Checklist */}
=======
>>>>>>> theirs
              <div style={{
                flex: 3,
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                height: "100%"
              }}>
                <div style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                  border: "1px solid #ffe5e5",
                  display: "flex",
                  flexDirection: "column",
<<<<<<< ours
                  flex: 1,
                  minHeight: 0
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h3 style={{
                      margin: 0,
                      color: "#d10000",
                      textTransform: "capitalize",
                      fontSize: "18px",
                      fontWeight: "600"
                    }}>
                      Fault (Job Description)
                    </h3>
                    <span style={{ fontSize: "12px", color: "#666" }}>
                      Linked to job card description
                    </span>
                  </div>
                  <textarea
                    placeholder="Enter fault details..."
                    value={writeUpData.fault}
                    onChange={handleFaultChange}
                    style={{
                      flex: 1,
                      padding: "12px",
                      width: "100%",
                      resize: "none",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      outline: "none",
                      transition: "border-color 0.2s",
                      minHeight: 0
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#d10000"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
                  />
                  <div style={{ marginTop: "16px" }}>
                    <h4 style={{ margin: "0 0 8px 0", color: "#444", fontSize: "15px", fontWeight: "600" }}>
                      Customer Requests
                    </h4>
                    {requestsSummary.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: "18px", color: "#555", fontSize: "14px" }}>
                        {requestsSummary.map((request) => (
                          <li key={request.sourceKey}>
                            {request.label}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: "#999", fontStyle: "italic", margin: 0 }}>
                        No requests recorded for this job.
                      </p>
                    )}
                  </div>
                </div>

                <div style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                  border: "1px solid #ffe5e5",
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0
                }}>
                  <h3 style={{
                    marginTop: 0,
                    marginBottom: "12px",
                    color: "#d10000",
                    fontSize: "18px",
                    fontWeight: "600"
                  }}>
                    Cause
                  </h3>
                  <textarea
                    placeholder="Enter cause details..."
                    value={writeUpData.caused}
                    onChange={handleNoteChange("caused")}
                    style={{
                      flex: 1,
                      padding: "12px",
                      width: "100%",
                      resize: "none",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      outline: "none",
                      transition: "border-color 0.2s",
                      minHeight: 0
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#d10000"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
                  />
                </div>

                <div style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                  border: "1px solid #ffe5e5",
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{
                      marginTop: 0,
                      marginBottom: "12px",
=======
                  gap: "16px",
                  flex: 1,
                  minHeight: 0
                }}>
                  <div>
                    <h3 style={{
                      margin: "0 0 12px 0",
>>>>>>> theirs
                      color: "#d10000",
                      fontSize: "18px",
                      fontWeight: "600"
                    }}>
<<<<<<< ours
                      Rectification & Checklist
                    </h3>
                    <div style={{
                      padding: "6px 14px",
                      backgroundColor: completionStatusColor,
                      color: "white",
                      borderRadius: "16px",
                      fontWeight: "600",
                      fontSize: "12px"
                    }}>
                      {completionStatusLabel}
                    </div>
                  </div>
                  <textarea
                    placeholder="Enter rectification details..."
                    value={writeUpData.rectification}
                    onChange={handleNoteChange("rectification")}
                    style={{
                      flex: 0,
                      padding: "12px",
                      width: "100%",
                      resize: "none",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      outline: "none",
                      transition: "border-color 0.2s",
                      minHeight: "100px",
                      marginBottom: "16px"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#d10000"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
                  />

                  <div style={{
                    backgroundColor: "#fff6f6",
                    border: "1px dashed #f3c1c1",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "16px"
                  }}>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px"
                    }}>
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#b91c1c" }}>
                        Checklist Progress
                      </h4>
                      <span style={{ fontSize: "13px", color: "#555" }}>
                        {completedTasks} of {totalTasks} complete
                      </span>
                    </div>
                    {totalTasks > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {writeUpData.tasks.map((task) => {
                          const taskKey = composeTaskKey(task);
                          const isComplete = task.status === "complete";
                          return (
                            <label
                              key={taskKey}
                              style={{
                                display: "flex",
                                gap: "12px",
                                alignItems: "flex-start",
                                backgroundColor: isComplete ? "#ecfdf5" : "#fff",
                                border: `1px solid ${isComplete ? "#10b981" : "#f3c1c1"}`,
                                borderRadius: "8px",
                                padding: "10px 12px",
                                cursor: "pointer"
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isComplete}
                                onChange={() => toggleTaskStatus(taskKey)}
                                style={{
                                  marginTop: "4px",
                                  width: "18px",
                                  height: "18px",
                                  cursor: "pointer",
                                  accentColor: "#d10000"
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "14px", color: "#333", fontWeight: "600", marginBottom: "4px" }}>
                                  {task.label}
                                </div>
                                <div style={{ fontSize: "12px", color: isComplete ? "#047857" : "#b45309", fontWeight: "600" }}>
                                  {isComplete ? "Complete" : "Waiting Additional Work"}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ color: "#999", fontStyle: "italic", margin: 0 }}>
                        No checklist items available.
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 style={{ margin: "0 0 8px 0", color: "#444", fontSize: "15px", fontWeight: "600" }}>
                      Authorized VHC Work
                    </h4>
                    {authorizedItems.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: "18px", color: "#555", fontSize: "14px" }}>
                        {authorizedItems.map((item) => (
                          <li key={item.sourceKey}>{item.label}</li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: "#999", fontStyle: "italic", margin: 0 }}>
                        No authorized VHC work linked yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ✅ Right Section - Metadata fields */}
              <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "16px" }}>
=======
                      Fault Summary
                    </h3>
                    <textarea
                      placeholder="Enter fault details..."
                      value={writeUpData.fault}
                      onChange={(e) => handleChange("fault", e.target.value)}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#e0e0e0";
                        handleBulletBlur("fault");
                      }}
                      style={{
                        flex: 1,
                        padding: "12px",
                        width: "100%",
                        minHeight: "160px",
                        resize: "vertical",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        outline: "none",
                        transition: "border-color 0.2s"
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#d10000")}
                    />
                  </div>

                  <div>
                    <h3 style={{
                      margin: "0 0 12px 0",
                      color: "#d10000",
                      fontSize: "18px",
                      fontWeight: "600"
                    }}>
                      Cause Notes
                    </h3>
                    <textarea
                      placeholder="Enter cause investigation notes..."
                      value={writeUpData.caused}
                      onChange={(e) => handleChange("caused", e.target.value)}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#e0e0e0";
                        handleBulletBlur("caused");
                      }}
                      style={{
                        flex: 1,
                        padding: "12px",
                        width: "100%",
                        minHeight: "160px",
                        resize: "vertical",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        outline: "none",
                        transition: "border-color 0.2s"
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#d10000")}
                    />
                  </div>

                  <div>
                    <h3 style={{
                      margin: "0 0 12px 0",
                      color: "#d10000",
                      fontSize: "18px",
                      fontWeight: "600"
                    }}>
                      Rectification Summary
                    </h3>
                    <textarea
                      value={writeUpData.rectification}
                      readOnly
                      style={{
                        flex: 1,
                        padding: "12px",
                        width: "100%",
                        minHeight: "160px",
                        resize: "vertical",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        backgroundColor: "#f9fafb",
                        color: "#374151",
                        cursor: "not-allowed"
                      }}
                    />
                    <p style={{
                      marginTop: "8px",
                      fontSize: "12px",
                      color: "#6b7280"
                    }}>
                      Rectification details auto-update as you toggle the checklist below.
                    </p>
                  </div>
                </div>

                <div style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                  border: "1px solid #ffe5e5",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{
                      margin: 0,
                      color: "#d10000",
                      fontSize: "18px",
                      fontWeight: "600"
                    }}>
                      Rectification Checklist
                    </h3>
                    <button
                      onClick={handleAddRectificationItem}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#d10000",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "600",
                        boxShadow: "0 2px 6px rgba(209,0,0,0.18)"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
                    >
                      ➕ Add Manual Item
                    </button>
                  </div>

                  {rectificationItems.length === 0 ? (
                    <div style={{
                      padding: "24px",
                      border: "2px dashed #fca5a5",
                      borderRadius: "8px",
                      backgroundColor: "#fff7f7",
                      textAlign: "center",
                      color: "#b91c1c",
                      fontWeight: "600"
                    }}>
                      No rectification items recorded yet.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {rectificationItems.map((item, index) => {
                        const pill = getStatusPill(item.status);
                        return (
                          <div
                            key={item.recordId || `${item.source || "manual"}-${index}`}
                            style={{
                              border: "1px solid #fca5a5",
                              borderRadius: "8px",
                              padding: "16px",
                              backgroundColor: "#fff",
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{
                                fontSize: "14px",
                                fontWeight: "600",
                                color: "#d10000"
                              }}>
                                Rectification {index + 1}
                              </span>
                              <div style={{
                                padding: "4px 12px",
                                borderRadius: "999px",
                                backgroundColor: pill.background,
                                color: pill.color,
                                fontSize: "12px",
                                fontWeight: "600"
                              }}>
                                {pill.label}
                              </div>
                            </div>

                            <textarea
                              value={item.description}
                              onChange={(e) => handleRectificationDescriptionChange(index, e.target.value)}
                              style={{
                                width: "100%",
                                minHeight: "80px",
                                border: "1px solid #e5e7eb",
                                borderRadius: "8px",
                                padding: "10px",
                                fontSize: "14px",
                                resize: "vertical",
                                fontFamily: "inherit"
                              }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = "#d10000")}
                              onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
                            />

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={item.status === "complete"}
                                  onChange={() => toggleRectificationStatus(index)}
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    accentColor: "#d10000",
                                    cursor: "pointer"
                                  }}
                                />
                                <span style={{ fontSize: "13px", color: "#374151" }}>
                                  Mark as complete
                                </span>
                              </label>

                              {item.source !== "vhc" && !item.recordId && (
                                <button
                                  onClick={() => handleRemoveRectificationItem(index)}
                                  style={{
                                    padding: "6px 12px",
                                    backgroundColor: "#f3f4f6",
                                    color: "#1f2937",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    fontWeight: "600"
                                  }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>

                            {item.authorizedAmount ? (
                              <div style={{
                                fontSize: "12px",
                                color: "#6b7280"
                              }}>
                                Authorized Amount: £{Number(item.authorizedAmount).toFixed(2)}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{
                  backgroundColor: "white",
                  padding: "16px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                  border: "1px solid #ffe5e5"
                }}>
                  <h3 style={{
                    margin: "0 0 12px 0",
                    color: "#d10000",
                    fontSize: "18px",
                    fontWeight: "600"
                  }}>
                    Customer Requests
                  </h3>
                  {requestsList.length === 0 ? (
                    <p style={{
                      fontSize: "13px",
                      color: "#6b7280",
                      margin: 0
                    }}>
                      No customer requests recorded.
                    </p>
                  ) : (
                    <ol style={{
                      listStyle: "decimal",
                      paddingLeft: "20px",
                      margin: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontSize: "13px",
                      color: "#374151"
                    }}>
                      {requestsList.map((request, index) => (
                        <li key={index}>
                          {normaliseRequestText(request)}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
>>>>>>> theirs

                {[{
                  label: "Warranty Claim Number",
                  field: "warrantyClaim"
                }, {
                  label: "TSR Number",
                  field: "tsrNumber"
                }, {
                  label: "PWA Number",
                  field: "pwaNumber"
                }].map(({ label, field }) => (
                  <div
                    key={field}
                    style={{
                      backgroundColor: "white",
                      padding: "16px",
                      borderRadius: "8px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                      border: "1px solid #ffe5e5"
                    }}
                  >
                    <label style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#333",
                      display: "block",
                      marginBottom: "8px"
                    }}>
                      {label}
                    </label>
                    <input
                      type="text"
                      value={writeUpData[field]}
<<<<<<< ours
                      onChange={handleInputChange(field)}
=======
                      onChange={(e) => handleChange(field, e.target.value)}
>>>>>>> theirs
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                        transition: "border-color 0.2s"
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#d10000")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#e0e0e0")}
                    />
                  </div>
                ))}

                <div
                  style={{
                    backgroundColor: "white",
                    padding: "16px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                    border: "1px solid #ffe5e5"
                  }}
                >
                  <label style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#333",
                    display: "block",
                    marginBottom: "8px"
                  }}>
                    Technical Bulletins
                  </label>
                  <textarea
                    value={writeUpData.technicalBulletins}
<<<<<<< ours
                    onChange={handleNoteChange("technicalBulletins")}
=======
                    onChange={(e) => handleChange("technicalBulletins", e.target.value)}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#e0e0e0";
                      handleBulletBlur("technicalBulletins");
                    }}
>>>>>>> theirs
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      resize: "vertical",
                      minHeight: "80px",
                      fontFamily: "inherit",
                      outline: "none",
                      transition: "border-color 0.2s"
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#d10000")}
                  />
                </div>

                {[{
                  label: "Technical Signature",
                  field: "technicalSignature"
                }, {
                  label: "Quality Control",
                  field: "qualityControl"
                }].map(({ label, field }) => (
                  <div
                    key={field}
                    style={{
                      backgroundColor: "white",
                      padding: "16px",
                      borderRadius: "8px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                      border: "1px solid #ffe5e5"
                    }}
                  >
                    <label style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#333",
                      display: "block",
                      marginBottom: "8px"
                    }}>
                      {label}
                    </label>
                    <input
                      type="text"
                      value={writeUpData[field]}
<<<<<<< ours
                      onChange={handleInputChange(field)}
=======
                      onChange={(e) => handleChange(field, e.target.value)}
>>>>>>> theirs
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                        transition: "border-color 0.2s"
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#d10000")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#e0e0e0")}
                    />
                  </div>
                ))}

                <div
                  style={{
                    backgroundColor: "white",
                    padding: "16px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                    border: "1px solid #ffe5e5"
                  }}
                >
                  <label style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#333",
                    display: "block",
                    marginBottom: "8px"
                  }}>
                    Additional Parts
                  </label>
                  <textarea
                    value={writeUpData.additionalParts}
<<<<<<< ours
                    onChange={handleNoteChange("additionalParts")}
=======
                    onChange={(e) => handleChange("additionalParts", e.target.value)}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#e0e0e0";
                      handleBulletBlur("additionalParts");
                    }}
>>>>>>> theirs
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      resize: "vertical",
                      minHeight: "80px",
                      fontFamily: "inherit",
                      outline: "none",
                      transition: "border-color 0.2s"
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#d10000")}
                  />
                </div>
<<<<<<< ours
=======

                <div style={{ display: "flex", gap: "16px" }}>
                  {["qty", "booked"].map((field) => (
                    <div
                      key={field}
                      style={{
                        flex: 1,
                        backgroundColor: "white",
                        padding: "16px",
                        borderRadius: "8px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                        border: "1px solid #ffe5e5"
                      }}
                    >
                      <h4 style={{
                        marginTop: 0,
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#d10000",
                        marginBottom: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em"
                      }}>
                        {field}
                      </h4>
                      {writeUpData[field].map((checked, idx) => (
                        <label
                          key={`${field}-${idx}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginBottom: "8px",
                            cursor: "pointer"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleCheckboxChange(field, idx)}
                            style={{
                              marginRight: "8px",
                              width: "16px",
                              height: "16px",
                              cursor: "pointer",
                              accentColor: "#d10000"
                            }}
                          />
                          <span style={{ fontSize: "13px", color: "#666" }}>Item {idx + 1}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
>>>>>>> theirs
              </div>
            </div>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 2fr",
          gap: "12px",
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "2px solid #ffd6d6",
          flexShrink: 0
        }}>
          <button
            onClick={goBackToJobCard}
            style={{
              padding: "14px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 8px rgba(108,117,125,0.18)",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#5a6268")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#6c757d")}
          >
            ← Back to Job
          </button>

          <button
            onClick={goToCheckSheet}
            style={{
              padding: "14px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 8px rgba(209,0,0,0.18)",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
          >
            📋 Check Sheet
          </button>

          <button
            onClick={goToVehicleDetails}
            style={{
              padding: "14px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 8px rgba(209,0,0,0.18)",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a60a0a")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d10000")}
          >
            🚗 Vehicle Details
          </button>

          <button
            onClick={handleSave}
<<<<<<< ours
            disabled={saving}
=======
>>>>>>> theirs
            style={{
              padding: "14px",
              backgroundColor: saving ? "#94a3b8" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 8px rgba(16,185,129,0.18)",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.backgroundColor = "#059669";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = saving ? "#94a3b8" : "#10b981";
            }}
          >
            {saving ? "💾 Saving..." : "💾 Save Write-Up"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
