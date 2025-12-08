// file location: src/components/JobCards/WriteUpForm.js
// description: Reusable write-up form component that can be embedded in multiple locations
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
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

const determineJobStatusFromTasks = (tasks = [], requests = [], hasRectificationItems = false) => {
  if (!Array.isArray(tasks)) {
    return null;
  }

  if (!hasRectificationItems) return null;

  const hasIncomplete = tasks.some((task) => task.status !== "complete");
  if (!hasIncomplete) {
    return "Tech Complete";
  }

  return hasPartsOnOrder(requests) ? "Awaiting Parts" : "In Progress";
};

const sectionBoxStyle = {
  backgroundColor: "var(--info-surface)",
  padding: "18px",
  borderRadius: "16px",
  boxShadow: "none",
  border: "1px solid var(--accent-purple-surface)",
  display: "flex",
  flexDirection: "column",
  minHeight: "360px",
};

const sectionScrollerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  flex: 1,
  overflowY: "auto",
  paddingRight: "4px",
};

const modernInputStyle = {
  width: "100%",
  borderRadius: "10px",
  border: "1px solid var(--info)",
  padding: "10px 12px",
  fontSize: "14px",
  fontFamily: "inherit",
  outline: "none",
  backgroundColor: "var(--surface)",
};

const modernTextareaStyle = {
  width: "100%",
  borderRadius: "10px",
  border: "1px solid var(--info)",
  padding: "10px 12px",
  fontSize: "14px",
  fontFamily: "inherit",
  resize: "vertical",
  outline: "none",
  backgroundColor: "var(--surface)",
};

const modernSelectStyle = {
  ...modernInputStyle,
  appearance: "none",
  cursor: "pointer",
  backgroundImage: "var(--info) 50%), var(--info) 50%, transparent 50%)",
  backgroundPosition: "calc(100% - 12px) calc(50% - 2px), calc(100% - 7px) calc(50% - 2px)",
  backgroundSize: "6px 6px, 6px 6px",
  backgroundRepeat: "no-repeat",
};

const modernButtonStyle = {
  borderRadius: "12px",
  border: "none",
  padding: "12px 20px",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
  transition: "transform 0.15s ease",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: "12px",
  marginBottom: "12px",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: "1.1rem",
  fontWeight: 600,
  color: "var(--accent-purple)",
};

const sectionSubtitleStyle = {
  margin: 0,
  fontSize: "0.85rem",
  color: "var(--info)",
};

const statusBadgeStyle = {
  borderRadius: "999px",
  padding: "6px 14px",
  backgroundColor: "var(--info-surface)",
  color: "var(--info-dark)",
  fontSize: "12px",
  fontWeight: 600,
};

const completionBadgeStyle = {
  borderRadius: "999px",
  color: "white",
  fontSize: "12px",
  fontWeight: 600,
  padding: "6px 14px",
};

const cardRowStyle = (completed) => ({
  borderRadius: "12px",
  border: `1px solid ${completed ? "var(--info)" : "var(--accent-purple-surface)"}`,
  padding: "12px",
  backgroundColor: completed ? "var(--success-surface)" : "var(--surface)",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

const rectificationCardStyle = (completed) => ({
  borderRadius: "12px",
  border: `1px solid ${completed ? "var(--info)" : "var(--danger)"}`,
  padding: "12px",
  backgroundColor: completed ? "var(--success-surface)" : "var(--surface)",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  boxShadow: "none",
});

const rectRowHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const checkboxLabelStyle = (completed) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
  color: completed ? "var(--info-dark)" : "var(--warning)",
});

const checkboxStyle = {
  accentColor: "var(--primary)",
  cursor: "pointer",
};

const causeRowStyle = {
  borderRadius: "12px",
  border: "1px solid var(--info)",
  backgroundColor: "var(--surface)",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  boxShadow: "none",
};

const generateCauseId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `cause-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createCauseEntry = ({ jobNumber = "", createdBy = "" } = {}) => ({
  id: generateCauseId(),
  requestKey: "",
  text: "",
  jobNumber,
  createdBy: createdBy || "",
  updatedAt: new Date().toISOString(),
});

const normalizeCauseEntriesForSave = (entries = [], jobNumber = "", createdBy = "") =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      id: entry?.id || generateCauseId(),
      jobNumber: entry?.jobNumber || jobNumber || "",
      requestKey: entry?.requestKey || entry?.request_id || entry?.requestId || "",
      text: (entry?.text || entry?.cause_text || "").toString(),
      createdBy: entry?.createdBy || entry?.created_by || createdBy || "",
      updatedAt: entry?.updatedAt || entry?.updated_at || new Date().toISOString(),
    }))
    .filter((entry) => entry.requestKey);

const buildCauseSignature = (entries = []) =>
  JSON.stringify(
    (Array.isArray(entries) ? entries : []).map((entry) => ({
      requestKey: entry?.requestKey || "",
      text: (entry?.text || "").toString(),
    }))
  );

const hydrateCauseEntries = (entries) => {
  return (Array.isArray(entries) ? entries : [])
    .map((entry, index) => {
      const requestKey = entry?.requestKey || entry?.request_id || entry?.requestId || "";
      if (!requestKey) return null;

      return {
        id:
          entry?.id ||
          `${requestKey}-${index}-${Math.random().toString(36).slice(2)}`,
        requestKey,
        text: entry?.text || entry?.cause_text || entry?.notes || "",
        createdBy: entry?.createdBy || entry?.created_by || "",
        jobNumber: entry?.jobNumber || entry?.job_number || "",
        updatedAt: entry?.updatedAt || entry?.updated_at || new Date().toISOString(),
      };
    })
    .filter(Boolean);
};

export default function WriteUpForm({ jobNumber, showHeader = true, onSaveSuccess }) {
  const router = useRouter();
  const { user } = useUser();
  const username = user?.username;
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
  const [activeTab, setActiveTab] = useState("writeup");

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

  const techsList = usersByRole?.["Techs"] || [];
  const isTech = techsList.includes(username);

  // ✅ Fetch job + write-up data whenever the job number changes
  useEffect(() => {
    if (!jobNumber) {
      return;
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
          const incomingCauseEntries = hydrateCauseEntries(writeUpResponse.causeEntries || []);
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
            causeEntries: [],
          }));
          markFieldsSynced({
            fault: fallbackDescription,
            caused: "",
            rectification: "",
            causeSignature: "",
          });
        }
      } catch (error) {
        console.error("❌ Error fetching write-up:", error);
      } finally {
        setLoading(false);
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
    const timestamp = new Date().toISOString();
    setWriteUpData((prev) => ({
      ...prev,
      causeEntries: prev.causeEntries.map((entry) => {
        if (entry.id !== entryId) return entry;
        return {
          ...entry,
          requestKey: value,
          jobNumber: jobNumber || entry.jobNumber || "",
          updatedAt: timestamp,
        };
      }),
    }));
  };

  const handleCauseTextChange = (entryId) => (event) => {
    const value = event.target.value;
    const timestamp = new Date().toISOString();
    setWriteUpData((prev) => ({
      ...prev,
      causeEntries: prev.causeEntries.map((entry) => {
        if (entry.id !== entryId) return entry;
        return {
          ...entry,
          text: value,
          updatedAt: timestamp,
        };
      }),
    }));
  };

  const addCauseRow = () => {
    const requestCount = (writeUpData.tasks || []).filter((task) => task?.source === "request").length;
    if (requestCount === 0) {
      return;
    }

    if (writeUpData.causeEntries.length >= requestCount) {
      return;
    }

    const newEntry = createCauseEntry({
      jobNumber: jobNumber || "",
      createdBy: username || "",
    });

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

      const normalizedCauseEntries = normalizeCauseEntriesForSave(
        causeEntries,
        jobNumber || "",
        username || ""
      );
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
    [jobNumber, username, writeUpMeta.jobId, writeUpMeta.writeupId, markFieldsSynced]
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

      // Check if there are any rectification tasks (additional work authorized)
      const hasAdditionalWork = updatedTasks.some((task) => task && task.source !== "request");

      // Check if all checkboxes are complete
      const allCheckboxesComplete = updatedTasks.every((task) => task.status === "complete");

      // Smart completion logic:
      // - If NO additional work authorized AND all checkboxes complete → "complete"
      // - If additional work authorized AND all checkboxes complete → "waiting_additional_work"
      // - Otherwise → "additional_work" (waiting for write up)
      let completionStatus;
      if (allCheckboxesComplete) {
        completionStatus = hasAdditionalWork ? "waiting_additional_work" : "complete";
      } else {
        completionStatus = "additional_work";
      }

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
        const incomingCauseEntries = hydrateCauseEntries(incoming.cause_entries);
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
        const desiredStatus = determineJobStatusFromTasks(writeUpData.tasks, requestsForPartsStatus, rectificationTasks.length > 0);
        if (desiredStatus && jobData?.jobCard?.id) {
          try {
            await updateJobStatus(jobData.jobCard.id, desiredStatus);
          } catch (statusError) {
            console.error("❌ Failed to update job status after saving write-up:", statusError);
          }
        }

        alert("✅ Write-up saved successfully!");

        // Call the callback if provided, otherwise navigate
        if (onSaveSuccess) {
          onSaveSuccess();
        } else {
          router.push(`/job-cards/${jobNumber}`);
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
  };

  const goToCheckSheet = () => router.push(`/job-cards/${jobNumber}/check-box`);
  const goToVehicleDetails = () => router.push(`/job-cards/${jobNumber}/car-details`);
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
  const rectificationTasks = writeUpData.tasks.filter((task) => task && task.source !== "request");
  const getCompletionStatusLabel = () => {
    if (writeUpData.completionStatus === "complete") return "Complete";
    if (writeUpData.completionStatus === "waiting_additional_work") return "Waiting for Additional Work";
    return "Wait for Write Up";
  };

  const getCompletionStatusColor = () => {
    if (writeUpData.completionStatus === "complete") return "var(--info)";
    if (writeUpData.completionStatus === "waiting_additional_work") return "var(--warning)";
    return "var(--warning)";
  };

  const completionStatusLabel = getCompletionStatusLabel();
  const completionStatusColor = getCompletionStatusColor();
  const showRectificationStatus = rectificationTasks.length > 0;
  const visibleRequestCount = Math.max(2, requestTasks.length);
  const requestSlots = Array.from({ length: visibleRequestCount }, (_, index) => requestTasks[index] || null);
  const assignedRequestKeys = new Set(
    writeUpData.causeEntries
      .map((entry) => entry.requestKey)
      .filter(Boolean)
  );
  const canAddCause =
    requestTasks.length > 0 && writeUpData.causeEntries.length < requestTasks.length;
  const getRequestOptions = (entryRequestKey) =>
    requestTasks.filter((task) => {
      if (entryRequestKey && task.sourceKey === entryRequestKey) {
        return true;
      }
      return !assignedRequestKeys.has(task.sourceKey);
    });
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
          border: "4px solid var(--surface)",
          borderTop: "4px solid var(--primary)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }}></div>
        <p style={{ color: "var(--grey-accent)" }}>Loading write-up...</p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (rosterLoading) {
    return (
      <div style={{ padding: "24px", color: "var(--info)" }}>Loading roster…</div>
    );
  }

  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      padding: "8px 16px",
      overflow: "hidden"
    }}>

      {/* ✅ Header Section */}
      {showHeader && jobData && (
        <div style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginBottom: "12px",
          padding: "16px",
          backgroundColor: "var(--surface)",
          borderRadius: "16px",
          boxShadow: "none",
          flexShrink: 0
        }}>
          <button
            onClick={goBackToJobCard}
            style={{
              ...modernButtonStyle,
              backgroundColor: "var(--accent-purple)",
              color: "white",
              boxShadow: "none",
            }}
          >
            ← Back to job
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{
              color: "var(--primary)",
              fontSize: "28px",
              fontWeight: "700",
              margin: "0 0 4px 0"
            }}>
              Write-Up - Job #{jobNumber}
            </h1>
            <p style={{ color: "var(--grey-accent)", fontSize: "14px", margin: 0 }}>
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
        boxShadow: "none",
        border: "1px solid var(--surface-light)",
        background: "var(--surface)",
        padding: "24px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        gap: "16px"
      }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("writeup")}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "8px",
              border: activeTab === "writeup" ? "2px solid var(--primary)" : "1px solid var(--accent-purple-surface)",
              backgroundColor: activeTab === "writeup" ? "var(--surface-light)" : "white",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <span style={{ color: "var(--primary)" }}>Write-Up</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("extras")}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "8px",
              border: activeTab === "extras" ? "2px solid var(--primary)" : "1px solid var(--accent-purple-surface)",
              backgroundColor: activeTab === "extras" ? "var(--surface-light)" : "white",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <span style={{ color: "var(--primary)" }}>Warranty Extras</span>
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {activeTab === "writeup" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
                minHeight: 0,
              }}
            >
              <div style={sectionBoxStyle}>
                <div style={{ ...sectionHeaderStyle }}>
                  <div>
                    <p style={sectionTitleStyle}>Fault</p>
                    <span style={sectionSubtitleStyle}>Matching job requests</span>
                  </div>
                  <span style={statusBadgeStyle}>Requests</span>
                </div>
                <div style={sectionScrollerStyle}>
                  {requestSlots.map((task, index) => {
                    const slotKey = task ? composeTaskKey(task) : `slot-${index}`;
                    const isComplete = task?.status === "complete";
                    return (
                      <div key={slotKey} style={cardRowStyle(isComplete)}>
                        <label style={checkboxLabelStyle(isComplete)}>
                          <input
                            type="checkbox"
                            checked={isComplete}
                            onChange={() => task && toggleTaskStatus(slotKey)}
                            disabled={!task}
                            style={checkboxStyle}
                          />
                          {isComplete ? "Completed" : "Mark complete"}
                        </label>
                        <div style={{ fontSize: "12px", color: "var(--info)" }}>Request {index + 1}</div>
                        <textarea
                          value={task?.label || ""}
                          onChange={task ? handleRequestLabelChange(slotKey) : undefined}
                          placeholder={task ? "" : "No request added yet."}
                          readOnly={!task}
                          style={task ? modernTextareaStyle : { ...modernTextareaStyle, borderStyle: "dashed", backgroundColor: "var(--info-surface)" }}
                        />
                      </div>
                    );
                  })}
                  {requestSlots.length === 0 && (
                    <p style={{ color: "var(--info)", fontSize: "13px" }}>No job requests available yet.</p>
                  )}
                </div>
              </div>
              <div style={sectionBoxStyle}>
                <div style={sectionHeaderStyle}>
                  <div>
                    <p style={sectionTitleStyle}>Cause</p>
                    <span style={sectionSubtitleStyle}>Link faults to root causes</span>
                  </div>
                  {canAddCause && (
                    <button
                      type="button"
                      onClick={addCauseRow}
                      style={{ ...modernButtonStyle, backgroundColor: "var(--accent-purple)", color: "var(--surface)" }}
                    >
                      + Add Cause
                    </button>
                  )}
                </div>
                <div style={sectionScrollerStyle}>
                      {writeUpData.causeEntries.map((entry) => {
                        const matchedRequest = requestTasks.find((task) => task.sourceKey === entry.requestKey);
                        const baseOptions = getRequestOptions(entry.requestKey);
                        const dropdownOptions =
                          entry.requestKey && !matchedRequest
                            ? [{ sourceKey: entry.requestKey, label: entry.requestKey }, ...baseOptions]
                            : baseOptions;
                        return (
                          <div key={entry.id} style={causeRowStyle}>
                            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                              <select
                                value={entry.requestKey}
                                onChange={handleCauseRequestChange(entry.id)}
                                style={{ ...modernSelectStyle, flex: "0 0 38%" }}
                              >
                                <option value="">Select a job request…</option>
                                {dropdownOptions.map((request) => (
                                  <option key={request.sourceKey} value={request.sourceKey}>
                                    {request.label}
                                  </option>
                                ))}
                              </select>
                              <textarea
                                placeholder="Describe the cause..."
                                value={entry.text}
                                onChange={handleCauseTextChange(entry.id)}
                                style={{ ...modernTextareaStyle, flex: 1, minHeight: "120px" }}
                              />
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => removeCauseRow(entry.id)}
                                style={{ ...modernButtonStyle, backgroundColor: "var(--danger)", color: "white" }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                </div>
              </div>
              <div style={sectionBoxStyle}>
                <div style={sectionHeaderStyle}>
                  <div>
                    <p style={sectionTitleStyle}>Rectification</p>
                    <span style={sectionSubtitleStyle}>Capture completed work</span>
                  </div>
                  {showRectificationStatus && (
                    <span style={{ ...completionBadgeStyle, backgroundColor: completionStatusColor }}>
                      {completionStatusLabel}
                    </span>
                  )}
                </div>
                <div style={sectionScrollerStyle}>
                  {rectificationTasks.length === 0 ? (
                    <p style={{ margin: 0, color: "var(--info)", fontSize: "13px" }}>
                      Add authorised additional work to record rectifications.
                    </p>
                  ) : (
                    rectificationTasks.map((task, index) => {
                      const taskKey = composeTaskKey(task);
                      const isComplete = task.status === "complete";
                      return (
                        <div key={taskKey} style={rectificationCardStyle(isComplete)}>
                          <div style={rectRowHeaderStyle}>
                            <label style={checkboxLabelStyle(isComplete)}>
                              <input
                                type="checkbox"
                                checked={isComplete}
                                onChange={() => toggleTaskStatus(taskKey)}
                                style={checkboxStyle}
                              />
                              Completed
                            </label>
                            <span style={{ fontSize: "12px", color: "var(--info)" }}>Item {index + 1}</span>
                          </div>
                          <textarea
                            value={task.label}
                            onChange={handleTaskLabelChange(taskKey)}
                            style={{ ...modernTextareaStyle, minHeight: "90px" }}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
              minHeight: 0
            }}>
              {metadataFields.map((fieldConfig) => (
                <div
                  key={fieldConfig.field}
                  style={{
                    backgroundColor: "var(--surface)",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid var(--surface-light)",
                    boxShadow: "none",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "140px",
                    gap: "8px"
                  }}
                >
                  <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>
                    {fieldConfig.label}
                  </label>
                    {fieldConfig.type === "textarea" ? (
                      <textarea
                        value={writeUpData[fieldConfig.field]}
                        onChange={handleNoteChange(fieldConfig.field)}
                        style={{ ...modernTextareaStyle, minHeight: "90px", flex: 1 }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--info)")}
                      />
                    ) : (
                      <input
                        type="text"
                        value={writeUpData[fieldConfig.field]}
                        onChange={handleInputChange(fieldConfig.field)}
                        style={{ ...modernInputStyle, flex: 1 }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--info)")}
                      />
                    )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
        marginTop: "12px",
        paddingTop: "12px",
        borderTop: "2px solid rgba(var(--primary-rgb), 0.1)",
        flexShrink: 0
      }}>
        <button
          onClick={goBackToJobCard}
          style={{
            ...modernButtonStyle,
            backgroundColor: "var(--info-dark)",
            color: "white",
            boxShadow: "none",
          }}
        >
          ← Back to job
        </button>

        <button
          onClick={openCheckSheetPopup}
          style={{
            ...modernButtonStyle,
            backgroundColor: "var(--primary)",
            color: "white",
            boxShadow: "none",
          }}
        >
          📋 Check sheet
        </button>

        <button
          onClick={openDocumentsPopup}
          style={{
            ...modernButtonStyle,
            backgroundColor: "var(--primary)",
            color: "white",
            boxShadow: "none",
          }}
        >
          🚗 Vehicle details
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            ...modernButtonStyle,
            backgroundColor: saving ? "var(--info)" : "var(--info)",
            color: "white",
            boxShadow: "none",
          }}
        >
          {saving ? "💾 Saving..." : "💾 Save write-up"}
        </button>
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
            backgroundColor: "rgba(var(--accent-purple-rgb), 0.65)",
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
              backgroundColor: "var(--surface)",
              borderRadius: "18px",
              padding: "32px",
              boxShadow: "none",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "var(--accent-purple)" }}>Vehicle Documents</h3>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--info)" }}>
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
                  color: "var(--info)",
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
                  background: "var(--info)",
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
                  border: "1px solid var(--info)",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  background: "var(--surface)",
                  color: "var(--accent-purple)",
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
    </div>
  );
}
