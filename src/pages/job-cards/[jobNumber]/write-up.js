// ✅ Imports converted to use absolute alias "@/"
// ✅ Database linked through /src/lib/database
// file location: src/pages/job-cards/[jobNumber]/write-up.js
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import {
  getWriteUpByJobNumber,
  saveWriteUpToDatabase,
  getJobByNumber
} from "@/lib/database/jobs";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";

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
  const { usersByRole, isLoading: rosterLoading } = useRoster();

  const [jobData, setJobData] = useState(null);
  const [authorizedItems, setAuthorizedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    qty: createCheckboxArray(),
    booked: createCheckboxArray(),
    tasks: [],
    completionStatus: "additional_work",
    jobDescription: "",
    vhcAuthorizationId: null,
  });

  const liveSyncTimeoutRef = useRef(null);
  const lastSyncedFieldsRef = useRef({
    fault: "",
    caused: "",
    rectification: "",
  });
  const [writeUpMeta, setWriteUpMeta] = useState({ jobId: null, writeupId: null });
  const markFieldsSynced = useCallback((fields) => {
    lastSyncedFieldsRef.current = {
      fault: fields.fault || "",
      caused: fields.caused || "",
      rectification: fields.rectification || "",
    };
  }, []);

  const username = user?.username;
  const techsList = usersByRole?.["Techs"] || [];
  // ⚠️ Mock data found — replacing with Supabase query
  // ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)
  const isTech = techsList.includes(username);

  // ✅ Fetch job + write-up data whenever the job number changes
  useEffect(() => {
    if (!jobNumber) {
      return; // avoid fetching until job number exists
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        const jobResponse = await getJobByNumber(jobNumber);
        const jobPayload = jobResponse?.data || null;
        if (jobPayload) {
          setJobData(jobPayload);
        }

        const writeUpResponse = await getWriteUpByJobNumber(jobNumber);

        if (writeUpResponse) {
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
          markFieldsSynced({
            fault: writeUpResponse.fault || "",
            caused: writeUpResponse.caused || "",
            rectification: writeUpResponse.rectification || "",
          });
        } else {
          const fallbackRequests = buildRequestList(jobPayload?.jobCard?.requests);
          const fallbackDescription = formatNoteValue(jobPayload?.jobCard?.description || "");
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
          markFieldsSynced({
            fault: fallbackDescription,
            caused: "",
            rectification: "",
          });
        }
      } catch (error) {
        console.error("❌ Error fetching write-up:", error);
      } finally {
        setLoading(false); // remove loading spinner once fetch completes
      }
    };

    fetchData();
  }, [jobNumber]);

  useEffect(() => {
    setWriteUpMeta({ jobId: null, writeupId: null });
  }, [jobNumber]);

  useEffect(() => {
    if (!jobData?.jobCard) return;
    setWriteUpMeta((prev) => ({
      jobId: jobData.jobCard.id ?? prev.jobId,
      writeupId: jobData.jobCard.writeUp?.writeup_id ?? prev.writeupId,
    }));
  }, [jobData]);

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

  const handleRequestLabelChange = (taskKey) => (event) => {
    const value = event.target.value;
    setWriteUpData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (composeTaskKey(task) !== taskKey) {
          return task;
        }
        return { ...task, label: value };
      }),
    }));
  };

  const persistLiveNotes = useCallback(
    async ({ fault, caused, rectification }) => {
      const jobId = writeUpMeta.jobId;
      if (!jobId) {
        return;
      }

      const sanitizedFields = {
        fault: fault || "",
        caused: caused || "",
        rectification: rectification || "",
      };

      const payload = {
        work_performed: sanitizedFields.fault || null,
        recommendations: sanitizedFields.caused || null,
        ratification: sanitizedFields.rectification || null,
        updated_at: new Date().toISOString(),
      };

      try {
        let savedRecord = null;

        if (writeUpMeta.writeupId) {
          const { data: updated, error } = await supabase
            .from("job_writeups")
            .update(payload)
            .eq("writeup_id", writeUpMeta.writeupId)
            .select()
            .maybeSingle();

          if (error) {
            throw error;
          }

          savedRecord = updated;
        }

        if (!savedRecord) {
          const { data: inserted, error } = await supabase
            .from("job_writeups")
            .insert([
              {
                ...payload,
                job_id: jobId,
                created_at: new Date().toISOString(),
              },
            ])
            .select()
            .maybeSingle();

          if (error) {
            throw error;
          }

          savedRecord = inserted;
        }

        if (savedRecord?.writeup_id && savedRecord.writeup_id !== writeUpMeta.writeupId) {
          setWriteUpMeta((prev) => ({
            ...prev,
            writeupId: savedRecord.writeup_id,
          }));
        }

        markFieldsSynced(sanitizedFields);
      } catch (error) {
        console.error("❌ Live write-up sync failed:", error);
      }
    },
    [writeUpMeta.jobId, writeUpMeta.writeupId, markFieldsSynced]
  );

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

  useEffect(() => {
    if (!writeUpMeta.jobId) {
      return;
    }

    const snapshot = {
      fault: writeUpData.fault,
      caused: writeUpData.caused,
      rectification: writeUpData.rectification,
    };

    const hasChanges =
      snapshot.fault !== lastSyncedFieldsRef.current.fault ||
      snapshot.caused !== lastSyncedFieldsRef.current.caused ||
      snapshot.rectification !== lastSyncedFieldsRef.current.rectification;

    if (!hasChanges || saving) {
      return;
    }

    if (liveSyncTimeoutRef.current) {
      clearTimeout(liveSyncTimeoutRef.current);
    }

    liveSyncTimeoutRef.current = setTimeout(() => {
      liveSyncTimeoutRef.current = null;
      persistLiveNotes(snapshot);
    }, 600);

    return () => {
      if (liveSyncTimeoutRef.current) {
        clearTimeout(liveSyncTimeoutRef.current);
        liveSyncTimeoutRef.current = null;
      }
    };
  }, [
    writeUpData.fault,
    writeUpData.caused,
    writeUpData.rectification,
    writeUpMeta.jobId,
    persistLiveNotes,
    saving,
  ]);

  useEffect(() => {
    return () => {
      if (liveSyncTimeoutRef.current) {
        clearTimeout(liveSyncTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!writeUpMeta.jobId) {
      return;
    }

    const channel = supabase.channel(`write-up-live-${writeUpMeta.jobId}`);
    const handleRealtime = (payload) => {
      const incoming = payload?.new;
      if (!incoming) {
        return;
      }

      const normalizedFault = incoming.work_performed ?? "";
      const normalizedCause = incoming.recommendations ?? "";
      const normalizedRectification = incoming.ratification ?? "";

      setWriteUpData((prev) => {
        const nextState = { ...prev };
        let changed = false;

        if (normalizedFault !== prev.fault) {
          nextState.fault = normalizedFault;
          nextState.jobDescription = normalizedFault;
          changed = true;
        }

        if (normalizedCause !== prev.caused) {
          nextState.caused = normalizedCause;
          changed = true;
        }

        if (normalizedRectification !== prev.rectification) {
          nextState.rectification = normalizedRectification;
          changed = true;
        }

        if (!changed) {
          return prev;
        }

        markFieldsSynced({
          fault: nextState.fault,
          caused: nextState.caused,
          rectification: nextState.rectification,
        });

        return nextState;
      });

      if (incoming.writeup_id) {
        setWriteUpMeta((prev) => ({
          ...prev,
          writeupId: incoming.writeup_id,
        }));
      }
    };

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "job_writeups",
        filter: `job_id=eq.${writeUpMeta.jobId}`,
      },
      handleRealtime
    );

    void channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [writeUpMeta.jobId, markFieldsSynced]);

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

  const requestTasks = writeUpData.tasks.filter((task) => task && task.source === "request");
  const totalTasks = writeUpData.tasks.length;
  const completedTasks = writeUpData.tasks.filter((task) => task.status === "complete").length;
  const completionStatusLabel =
    writeUpData.completionStatus === "complete" ? "Complete" : "Waiting Additional Work";
  const completionStatusColor = writeUpData.completionStatus === "complete" ? "#10b981" : "#f59e0b";

  // ✅ Loading state with spinner animation
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

  if (rosterLoading) {
    return (
      <Layout>
        <div style={{ padding: "24px", color: "#6B7280" }}>Loading roster…</div>
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

        {/* ✅ Header Section */}
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

              {/* ✅ Left Section - Notes and Checklist */}
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
                      Job requests (each box auto-loaded from the job card)
                    </h4>
                    {requestTasks.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {requestTasks.map((task, index) => {
                          const taskKey = composeTaskKey(task);
                          const isComplete = task.status === "complete";
                          return (
                            <div
                              key={taskKey}
                              style={{
                                borderRadius: "8px",
                                border: `1px solid ${isComplete ? "#10b981" : "#f3c1c1"}`,
                                padding: "12px",
                                backgroundColor: isComplete ? "#ecfdf5" : "#fff",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px", color: isComplete ? "#047857" : "#b45309" }}>
                                  <input
                                    type="checkbox"
                                    checked={isComplete}
                                    onChange={() => toggleTaskStatus(taskKey)}
                                    style={{ accentColor: "#d10000", cursor: "pointer" }}
                                  />
                                  {isComplete ? "Marked complete" : "Mark as complete"}
                                </label>
                                <span style={{ fontSize: "12px", color: "#777" }}>Request {index + 1}</span>
                              </div>
                              <textarea
                                value={task.label}
                                onChange={handleRequestLabelChange(taskKey)}
                                style={{
                                  width: "100%",
                                  minHeight: "80px",
                                  borderRadius: "6px",
                                  border: "1px solid #e0e0e0",
                                  padding: "10px",
                                  fontSize: "14px",
                                  fontFamily: "inherit",
                                  resize: "vertical",
                                  outline: "none",
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ color: "#999", fontStyle: "italic", margin: 0 }}>
                        No requests recorded for this job card.
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
                      color: "#d10000",
                      fontSize: "18px",
                      fontWeight: "600"
                    }}>
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
                      onChange={handleInputChange(field)}
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
                    onChange={handleNoteChange("technicalBulletins")}
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
                      onChange={handleInputChange(field)}
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
                    onChange={handleNoteChange("additionalParts")}
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
            disabled={saving}
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
