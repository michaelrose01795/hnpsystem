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
  getJobByNumber,
  updateJobStatus,
} from "@/lib/database/jobs";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import CheckSheetPopup from "@/components/popups/CheckSheetPopup";

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
const PARTS_ON_ORDER_STATUSES = new Set(["on-order", "on_order", "awaiting-stock", "awaiting_stock"]);

const extractNormalizedStatus = (value = "") =>
  `${value}`.toLowerCase().trim().replace(/\s+/g, "-");

const hasPartsOnOrder = (requests = []) =>
  (Array.isArray(requests) ? requests : []).some((request) =>
    PARTS_ON_ORDER_STATUSES.has(extractNormalizedStatus(request?.status))
  );

const determineJobStatusFromTasks = (tasks = [], requests = []) => {
  if (!Array.isArray(tasks)) {
    return null;
  }

  const hasIncomplete = tasks.some((task) => task.status !== "complete");
  if (!hasIncomplete) {
    return "Tech Complete";
  }

  return hasPartsOnOrder(requests) ? "Awaiting Parts" : "In Progress";
};

const sectionBoxStyle = {
  backgroundColor: "white",
  padding: "20px",
  borderRadius: "8px",
  boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
  border: "1px solid #ffe5e5",
  display: "flex",
  flexDirection: "column",
  flex: 1,
  height: "360px",
};

const sectionScrollerStyle = {
  flex: 1,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  paddingRight: "6px",
};

const createCauseEntry = (requestKey = "") => ({
  id: `${requestKey || "cause"}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  requestKey,
  text: "",
});

const normalizeCauseEntriesForSave = (entries = []) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry, index) => ({
      requestKey: entry?.requestKey || "",
      text: (entry?.text || "").toString(),
      id: entry?.id ?? `${entry?.requestKey || "cause"}-${index}`,
    }))
    .filter((entry) => entry.requestKey)
    .map((entry) => ({
      requestKey: entry.requestKey,
      text: entry.text,
    }));

const buildCauseSignature = (entries = []) =>
  JSON.stringify(
    (Array.isArray(entries) ? entries : []).map((entry) => ({
      requestKey: entry?.requestKey || "",
      text: (entry?.text || "").toString(),
    }))
  );

const hydrateCauseEntries = (entries, fallbackRequests = []) => {
  const normalized = (Array.isArray(entries) ? entries : [])
    .map((entry, index) => ({
      id:
        entry?.id ||
        `${entry?.requestKey || fallbackRequests[index]?.sourceKey || "cause"}-${index}-${Math.random()
          .toString(36)
          .slice(2)}`,
      requestKey: entry?.requestKey || fallbackRequests[index]?.sourceKey || "",
      text: entry?.text || entry?.notes || "",
    }))
    .filter((entry) => entry.requestKey);

  if (normalized.length > 0) {
    return normalized;
  }

  return (fallbackRequests || []).map((request) => ({
    id: `cause-${request.sourceKey}`,
    requestKey: request.sourceKey,
    text: "",
  }));
};

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
    causeEntries: [],
    vhcAuthorizationId: null,
  });

  const [showCheckSheetPopup, setShowCheckSheetPopup] = useState(false);
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false);

  const liveSyncTimeoutRef = useRef(null);
  const lastSyncedFieldsRef = useRef({
    fault: "",
    caused: "",
    rectification: "",
    causeSignature: "",
  });
  const [writeUpMeta, setWriteUpMeta] = useState({ jobId: null, writeupId: null });
  const markFieldsSynced = useCallback((fields) => {
    lastSyncedFieldsRef.current = {
      fault: fields.fault || "",
      caused: fields.caused || "",
      rectification: fields.rectification || "",
      causeSignature: fields.causeSignature || "",
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
        const fallbackRequests = buildRequestList(jobPayload?.jobCard?.requests);

        if (writeUpResponse) {
          const resolvedRequests = writeUpResponse.requests || fallbackRequests;
          const incomingCauseEntries = hydrateCauseEntries(
            writeUpResponse.causeEntries,
            resolvedRequests
          );
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
            causeEntries: incomingCauseEntries,
          }));
          markFieldsSynced({
            fault: writeUpResponse.fault || "",
            caused: writeUpResponse.caused || "",
            rectification: writeUpResponse.rectification || "",
            causeSignature: buildCauseSignature(incomingCauseEntries),
          });
        } else {
          const fallbackDescription = formatNoteValue(jobPayload?.jobCard?.description || "");
          const fallbackCauseEntries = hydrateCauseEntries([], fallbackRequests);
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
            causeEntries: fallbackCauseEntries,
          }));
          markFieldsSynced({
            fault: fallbackDescription,
            caused: "",
            rectification: "",
            causeSignature: buildCauseSignature(fallbackCauseEntries),
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

  const handleTaskLabelChange = (taskKey) => (event) => {
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

  const handleCauseRequestChange = (entryId) => (event) => {
    const value = event.target.value;
    setWriteUpData((prev) => ({
      ...prev,
      causeEntries: prev.causeEntries.map((entry) => {
        if (entry.id !== entryId) return entry;
        return { ...entry, requestKey: value };
      }),
    }));
  };

  const handleCauseTextChange = (entryId) => (event) => {
    const value = event.target.value;
    setWriteUpData((prev) => ({
      ...prev,
      causeEntries: prev.causeEntries.map((entry) => {
        if (entry.id !== entryId) return entry;
        return { ...entry, text: value };
      }),
    }));
  };

  const addCauseRow = () => {
    const defaultRequest = writeUpData.tasks.find((task) => task.source === "request");
    const newEntry = createCauseEntry(defaultRequest?.sourceKey || "");
    setWriteUpData((prev) => ({
      ...prev,
      causeEntries: [...prev.causeEntries, newEntry],
    }));
  };

  const removeCauseRow = (entryId) => {
    setWriteUpData((prev) => ({
      ...prev,
      causeEntries: prev.causeEntries.filter((entry) => entry.id !== entryId),
    }));
  };

  const persistLiveNotes = useCallback(
    async ({ fault, caused, rectification, causeEntries }) => {
      const jobId = writeUpMeta.jobId;
      if (!jobId) {
        return;
      }

      const sanitizedFields = {
        fault: fault || "",
        caused: caused || "",
        rectification: rectification || "",
      };

      const normalizedCauseEntries = normalizeCauseEntriesForSave(causeEntries);
      const payload = {
        work_performed: sanitizedFields.fault || null,
        recommendations: sanitizedFields.caused || null,
        ratification: sanitizedFields.rectification || null,
        cause_entries: normalizedCauseEntries,
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

        markFieldsSynced({
          ...sanitizedFields,
          causeSignature: buildCauseSignature(normalizedCauseEntries),
        });
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
    const causeSignature = buildCauseSignature(writeUpData.causeEntries);

    const hasChanges =
      snapshot.fault !== lastSyncedFieldsRef.current.fault ||
      snapshot.caused !== lastSyncedFieldsRef.current.caused ||
      snapshot.rectification !== lastSyncedFieldsRef.current.rectification ||
      causeSignature !== lastSyncedFieldsRef.current.causeSignature;

    if (!hasChanges || saving) {
      return;
    }

    if (liveSyncTimeoutRef.current) {
      clearTimeout(liveSyncTimeoutRef.current);
    }

      liveSyncTimeoutRef.current = setTimeout(() => {
        liveSyncTimeoutRef.current = null;
        persistLiveNotes({
          ...snapshot,
          causeEntries: writeUpData.causeEntries,
        });
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
    writeUpData.causeEntries,
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

        const prevCauseSignature = buildCauseSignature(prev.causeEntries);
        const incomingCauseEntries = hydrateCauseEntries(
          incoming.cause_entries,
          prev.tasks.filter((task) => task.source === "request")
        );
        const causeSignature = buildCauseSignature(incomingCauseEntries);
        if (causeSignature !== prevCauseSignature) {
          nextState.causeEntries = incomingCauseEntries;
          changed = true;
        }

        if (!changed) {
          return prev;
        }

        markFieldsSynced({
          fault: nextState.fault,
          caused: nextState.caused,
          rectification: nextState.rectification,
          causeSignature,
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

        const requestsForPartsStatus = jobData?.jobCard?.partsRequests || [];
        const desiredStatus = determineJobStatusFromTasks(writeUpData.tasks, requestsForPartsStatus);
        if (desiredStatus && jobData?.jobCard?.id) {
          try {
            await updateJobStatus(jobData.jobCard.id, desiredStatus);
          } catch (statusError) {
            console.error("❌ Failed to update job status after saving write-up:", statusError);
          }
        }

        alert("✅ Write-up saved successfully!");
        router.push(`/job-cards/${jobNumber}`);
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
  const openCheckSheetPopup = () => setShowCheckSheetPopup(true);
  const closeCheckSheetPopup = () => setShowCheckSheetPopup(false);
  const handleAddCheckSheetFromPopup = () => {
    closeCheckSheetPopup();
    router.push(`/job-cards/${jobNumber}/check-box`);
  };
  const handleAddDealerDetailsFromPopup = () => {
    closeCheckSheetPopup();
    router.push(`/job-cards/${jobNumber}/car-details`);
  };
  const openDocumentsPopup = () => setShowDocumentsPopup(true);
  const closeDocumentsPopup = () => setShowDocumentsPopup(false);

  const requestTasks = writeUpData.tasks.filter((task) => task && task.source === "request");
  const totalTasks = writeUpData.tasks.length;
  const completedTasks = writeUpData.tasks.filter((task) => task.status === "complete").length;
  const completionStatusLabel =
    writeUpData.completionStatus === "complete" ? "Complete" : "Waiting Additional Work";
  const completionStatusColor = writeUpData.completionStatus === "complete" ? "#10b981" : "#f59e0b";
  const visibleRequestCount = Math.max(2, requestTasks.length);
  const requestSlots = Array.from({ length: visibleRequestCount }, (_, index) => requestTasks[index] || null);
  const rectificationTasks = writeUpData.tasks.filter((task) => task && task.source !== "request");
  const metadataFields = [
    { label: "Warranty Claim Number", field: "warrantyClaim", type: "input" },
    { label: "TSR Number", field: "tsrNumber", type: "input" },
    { label: "PWA Number", field: "pwaNumber", type: "input" },
    { label: "Technical Bulletins", field: "technicalBulletins", type: "textarea" },
    { label: "Technical Signature", field: "technicalSignature", type: "input" },
    { label: "Quality Control", field: "qualityControl", type: "input" },
    { label: "Additional Parts", field: "additionalParts", type: "textarea" },
  ];

  useEffect(() => {
    const aggregated = requestTasks
      .map((task) => (task?.label || "").trim())
      .filter(Boolean)
      .join("\n");

    setWriteUpData((prev) => {
      if (prev.fault === aggregated) {
        return prev;
      }
      return { ...prev, fault: aggregated };
    });
  }, [requestTasks]);

  useEffect(() => {
    const aggregated = rectificationTasks
      .map((task) => (task?.label || "").trim())
      .filter(Boolean)
      .join("\n");

    setWriteUpData((prev) => {
      if (prev.rectification === aggregated) {
        return prev;
      }
      return { ...prev, rectification: aggregated };
    });
  }, [rectificationTasks]);

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

        {/* ✅ Main Content Layout */}
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
          minHeight: 0,
          gap: "16px"
        }}>
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            minHeight: 0
          }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={sectionBoxStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h3 style={{ margin: 0, color: "#d10000", textTransform: "capitalize", fontSize: "18px", fontWeight: "600" }}>
                      Fault
                    </h3>
                    <span style={{ fontSize: "12px", color: "#666" }}>Matching job requests</span>
                  </div>
                  <div style={sectionScrollerStyle}>
                    {requestSlots.map((task, index) => {
                      const slotKey = task ? composeTaskKey(task) : `slot-${index}`;
                      const isComplete = task?.status === "complete";
                      return (
                        <div
                          key={slotKey}
                          style={{
                            borderRadius: "8px",
                            border: `1px solid ${isComplete ? "#10b981" : "#f3c1c1"}`,
                            padding: "12px",
                            backgroundColor: isComplete ? "#ecfdf5" : "#fff",
                            minHeight: "120px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: isComplete ? "#047857" : "#b45309" }}>
                              <input
                                type="checkbox"
                                checked={isComplete}
                                onChange={() => task && toggleTaskStatus(slotKey)}
                                disabled={!task}
                                style={{ accentColor: "#d10000", cursor: task ? "pointer" : "not-allowed" }}
                              />
                              {isComplete ? "Completed" : "Mark as complete"}
                            </label>
                            <span style={{ fontSize: "12px", color: "#777" }}>Request {index + 1}</span>
                          </div>
                          <textarea
                            value={task?.label || ""}
                            onChange={task ? handleRequestLabelChange(slotKey) : undefined}
                            placeholder={task ? "" : "No request added yet."}
                            readOnly={!task}
                            style={{
                              flex: 1,
                              width: "100%",
                              minHeight: "80px",
                              borderRadius: "6px",
                              border: task ? "1px solid #e0e0e0" : "1px dashed #d1d5db",
                              padding: "10px",
                              fontSize: "14px",
                              fontFamily: "inherit",
                              resize: "none",
                              outline: "none",
                              backgroundColor: task ? "white" : "#f8fafc",
                              color: task ? "#111827" : "#9ca3af",
                            }}
                          />
                        </div>
                      );
                    })}
                    {requestSlots.length === 0 && (
                      <p style={{ color: "#9ca3af", fontSize: "13px" }}>No job requests available yet.</p>
                    )}
                  </div>
                </div>
                <div style={sectionBoxStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h3 style={{ margin: 0, color: "#d10000", fontSize: "18px", fontWeight: "600" }}>Cause</h3>
                    <button
                      type="button"
                      onClick={addCauseRow}
                      disabled={requestTasks.length === 0}
                      style={{
                        backgroundColor: requestTasks.length === 0 ? "#d1d5db" : "#1d4ed8",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        padding: "8px 14px",
                        cursor: requestTasks.length === 0 ? "not-allowed" : "pointer",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      + Add Cause
                    </button>
                  </div>
                  <div style={sectionScrollerStyle}>
                    {writeUpData.causeEntries.length === 0 ? (
                      <p style={{ margin: 0, color: "#9ca3af", fontSize: "13px" }}>
                        Add a cause edition to link a request. None added yet.
                      </p>
                    ) : (
                      writeUpData.causeEntries.map((entry) => {
                        const matchedRequest = requestTasks.find((task) => task.sourceKey === entry.requestKey);
                        return (
                          <div
                            key={entry.id}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              padding: "12px",
                              backgroundColor: "#f9fafb",
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                                {matchedRequest ? matchedRequest.label : "Unmapped request"}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeCauseRow(entry.id)}
                                style={{
                                  border: "none",
                                  backgroundColor: "#ef4444",
                                  color: "white",
                                  borderRadius: "6px",
                                  padding: "4px 12px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Remove
                              </button>
                            </div>
                            <textarea
                              placeholder="Describe the cause..."
                              value={entry.text}
                              onChange={handleCauseTextChange(entry.id)}
                              style={{
                                width: "100%",
                                minHeight: "100px",
                                borderRadius: "6px",
                                border: "1px solid #cbd5f5",
                                padding: "10px",
                                fontSize: "14px",
                                fontFamily: "inherit",
                                resize: "vertical",
                                outline: "none",
                                backgroundColor: "white",
                              }}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <div style={sectionBoxStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h3 style={{ margin: 0, color: "#d10000", fontSize: "18px", fontWeight: "600" }}>Rectification</h3>
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
                  <div style={sectionScrollerStyle}>
                    {rectificationTasks.length === 0 ? (
                      <p style={{ margin: 0, color: "#9ca3af", fontSize: "13px" }}>
                        Add authorised additional work to record rectifications.
                      </p>
                    ) : (
                      rectificationTasks.map((task, index) => {
                        const taskKey = composeTaskKey(task);
                        const isComplete = task.status === "complete";
                        return (
                          <div
                            key={taskKey}
                            style={{
                              border: `1px solid ${isComplete ? "#10b981" : "#f3c1c1"}`,
                              borderRadius: "8px",
                              padding: "12px",
                              backgroundColor: isComplete ? "#ecfdf5" : "#fff",
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: isComplete ? "#047857" : "#b45309" }}>
                                <input
                                  type="checkbox"
                                  checked={isComplete}
                                  onChange={() => toggleTaskStatus(taskKey)}
                                  style={{ accentColor: "#d10000" }}
                                />
                                Completed
                              </label>
                              <span style={{ fontSize: "12px", color: "#6b7280" }}>Item {index + 1}</span>
                            </div>
                            <textarea
                              value={task.label}
                              onChange={handleTaskLabelChange(taskKey)}
                              style={{
                                width: "100%",
                                minHeight: "80px",
                                borderRadius: "6px",
                                border: "1px solid #d1d5db",
                                padding: "10px",
                                fontSize: "14px",
                                fontFamily: "inherit",
                                resize: "vertical",
                                outline: "none",
                                backgroundColor: "white",
                              }}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "12px"
            }}>
              {metadataFields.map((fieldConfig) => (
                <div
                  key={fieldConfig.field}
                  style={{
                    backgroundColor: "white",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid #ffe5e5",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  <label style={{ fontSize: "14px", fontWeight: "600", color: "#333" }}>
                    {fieldConfig.label}
                  </label>
                  {fieldConfig.type === "textarea" ? (
                    <textarea
                      value={writeUpData[fieldConfig.field]}
                      onChange={handleNoteChange(fieldConfig.field)}
                      style={{
                        width: "100%",
                        minHeight: "80px",
                        borderRadius: "8px",
                        border: "1px solid #e0e0e0",
                        padding: "10px",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        resize: "vertical",
                        outline: "none",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#d10000")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#e0e0e0")}
                    />
                  ) : (
                    <input
                      type="text"
                      value={writeUpData[fieldConfig.field]}
                      onChange={handleInputChange(fieldConfig.field)}
                      style={{
                        width: "100%",
                        borderRadius: "8px",
                        border: "1px solid #e0e0e0",
                        padding: "10px",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        outline: "none",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#d10000")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#e0e0e0")}
                    />
                  )}
                </div>
              ))}
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
            onClick={openCheckSheetPopup}
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
            onClick={openDocumentsPopup}
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
      {showCheckSheetPopup && (
        <CheckSheetPopup
          onClose={closeCheckSheetPopup}
          onAddCheckSheet={handleAddCheckSheetFromPopup}
          onAddDealerDetails={handleAddDealerDetailsFromPopup}
        />
      )}

      {showDocumentsPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
          }}
          onClick={closeDocumentsPopup}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "480px",
              maxWidth: "90%",
              backgroundColor: "white",
              borderRadius: "18px",
              padding: "32px",
              boxShadow: "0 24px 60px rgba(15,23,42,0.35)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#0f172a" }}>Vehicle Documents</h3>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                  View or upload documents tied to this vehicle. Documents generated during job creation appear here.
                </p>
              </div>
              <button
                onClick={closeDocumentsPopup}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "22px",
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
              >
                ×
              </button>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  router.push(`/job-cards/${jobNumber}/car-details`);
                  closeDocumentsPopup();
                }}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  background: "#10b981",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Open vehicle viewer
              </button>
              <button
                type="button"
                onClick={closeDocumentsPopup}
                style={{
                  flex: 1,
                  border: "1px solid #d1d5db",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  background: "white",
                  color: "#0f172a",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
