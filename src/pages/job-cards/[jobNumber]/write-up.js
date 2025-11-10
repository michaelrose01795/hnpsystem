// file location: src/pages/job-cards/[jobNumber]/write-up.js
"use client";

import React, { useEffect, useMemo, useState } from "react"; // import React utilities for state and lifecycle
import { useRouter } from "next/router"; // import router to navigate between job card pages
import Layout from "../../../components/Layout"; // import shared layout for consistent styling
import {
  getWriteUpByJobNumber,
  saveWriteUpToDatabase,
  getJobByNumber
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

export default function WriteUpPage() {
  const router = useRouter(); // initialise router for navigation actions
  const { jobNumber } = router.query; // read job number from URL parameters
  const { user } = useUser(); // get the logged in user for permissions

  const [jobData, setJobData] = useState(null); // store job card details for header and context
  const [requestsList, setRequestsList] = useState([]); // store customer requests to render in sidebar
  const [rectificationItems, setRectificationItems] = useState([]); // store checklist items linked to additional work
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
    qty: Array(10).fill(false),
    booked: Array(10).fill(false),
    rectificationItems: [],
  }); // track form data for write-up fields
  const [loading, setLoading] = useState(true); // show spinner while data loads

  const username = user?.username; // extract username for role lookup
  const techsList = usersByRole["Techs"] || []; // list of technician usernames
  const isTech = techsList.includes(username); // determine if current user is a technician

  useEffect(() => {
    if (!jobNumber) {
      return; // avoid fetching until job number exists
    }

    const fetchData = async () => {
      try {
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
      } finally {
        setLoading(false); // remove loading spinner once fetch completes
      }
    };

    fetchData();
  }, [jobNumber]);

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

      if (result?.success) {
        alert("✅ Write-up saved successfully!");

        if (isTech) {
          router.push(`/job-cards/myjobs/${jobNumber}`); // return to technician job view
        } else {
          router.push(`/job-cards/${jobNumber}`); // return to manager job view
        }
      } else {
        alert("❌ Failed to save write-up");
      }
    } catch (err) {
      console.error("Error saving write-up:", err);
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
                  gap: "16px",
                  flex: 1,
                  minHeight: 0
                }}>
                  <div>
                    <h3 style={{
                      margin: "0 0 12px 0",
                      color: "#d10000",
                      fontSize: "18px",
                      fontWeight: "600"
                    }}>
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
                      onChange={(e) => handleChange(field, e.target.value)}
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
                    onChange={(e) => handleChange("technicalBulletins", e.target.value)}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#e0e0e0";
                      handleBulletBlur("technicalBulletins");
                    }}
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
                      onChange={(e) => handleChange(field, e.target.value)}
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
                    onChange={(e) => handleChange("additionalParts", e.target.value)}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#e0e0e0";
                      handleBulletBlur("additionalParts");
                    }}
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
            style={{
              padding: "14px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 8px rgba(16,185,129,0.18)",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#059669")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#10b981")}
          >
            💾 Save Write-Up
          </button>
        </div>
      </div>
    </Layout>
  );
}
