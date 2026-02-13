// file location: src/components/JobCards/WriteUpForm.js
// description: Reusable write-up form component that can be embedded in multiple locations
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import {
  getWriteUpByJobNumber,
  saveWriteUpToDatabase,
  getJobByNumber,
  updateJobStatus,
} from "@/lib/database/jobs";
import { logJobSubStatus } from "@/lib/services/jobStatusService";
import { resolveSubStatusId } from "@/lib/status/statusFlow";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import CheckSheetPopup from "@/components/popups/CheckSheetPopup";
import { useTheme } from "@/styles/themeProvider";
import ModalPortal from "@/components/popups/ModalPortal";

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

const toPastTenseRequest = (value = "") => {
  if (!value) return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  const prefixMatch = trimmed.match(/^(Request\s*\d+\s*:\s*)(.*)$/i);
  const prefix = prefixMatch ? prefixMatch[1] : "";
  let body = prefixMatch ? prefixMatch[2] : trimmed;

  body = body.replace(/^(please\s+)?(customer\s+)?(requests?|request\s+to)\s+/i, "");
  body = body.replace(/^(needs?\s+to|need\s+to)\s+/i, "");
  const crackedReplacementMatch = body.match(/^(.*)\bcracked\b.*replacement required\b/i);
  if (crackedReplacementMatch) {
    const part = crackedReplacementMatch[1].trim();
    return `${prefix}Carried out ${part} replacement`.trim();
  }

  const replacements = [
    [/^carry out\b/i, "Carried out"],
    [/^carryout\b/i, "Carried out"],
    [/^replace\b/i, "Replaced"],
    [/^renew\b/i, "Renewed"],
    [/^change\b/i, "Changed"],
    [/^repair\b/i, "Repaired"],
    [/^fix\b/i, "Fixed"],
    [/^check\b/i, "Checked"],
    [/^inspect\b/i, "Inspected"],
    [/^diagnose\b/i, "Diagnosed"],
    [/^investigate\b/i, "Investigated"],
    [/^test\b/i, "Tested"],
    [/^fit\b/i, "Fitted"],
    [/^install\b/i, "Installed"],
    [/^service\b/i, "Serviced"],
    [/^perform\b/i, "Performed"],
    [/^update\b/i, "Updated"],
    [/^adjust\b/i, "Adjusted"],
    [/^align\b/i, "Aligned"],
    [/^calibrate\b/i, "Calibrated"],
    [/^program\b/i, "Programmed"],
    [/^reprogram\b/i, "Reprogrammed"],
    [/^reset\b/i, "Reset"],
    [/^refill\b/i, "Refilled"],
    [/^top up\b/i, "Topped up"],
    [/^flush\b/i, "Flushed"],
    [/^bleed\b/i, "Bled"],
    [/^lubricate\b/i, "Lubricated"],
    [/^grease\b/i, "Greased"],
    [/^tighten\b/i, "Tightened"],
    [/^loosen\b/i, "Loosened"],
    [/^secure\b/i, "Secured"],
    [/^remove\b/i, "Removed"],
    [/^clean\b/i, "Cleaned"],
    [/^wash\b/i, "Washed"],
    [/^polish\b/i, "Polished"],
    [/^repaint\b/i, "Repainted"],
    [/^recharge\b/i, "Recharged"],
    [/^regas\b/i, "Regassed"],
    [/^recover\b/i, "Recovered"],
    [/^degrease\b/i, "Degreased"],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(body)) {
      body = body.replace(pattern, replacement);
      break;
    }
  }

  body = body.replace(/\s*-\s*(replacement|repair|replace|fix)\s+required\s*$/i, "");
  body = body.replace(/\s*(replacement|repair)\s+required\s*$/i, "");
  body = body.replace(/\s*-\s*(additional work|authorise[d]?)\s*$/i, "");
  body = body.replace(/\s*-\s*please\s+advise\s*$/i, "");
  body = body.replace(/\s*-\s*customer\s+request\s*$/i, "");

  return `${prefix}${body.trim()}`;
};

const ensureAuthorizedTasks = (tasks = [], authorizedItems = []) => {
  const baseTasks = (Array.isArray(tasks) ? tasks : []).filter(Boolean);
  const normalizedAuthorized = Array.isArray(authorizedItems) ? authorizedItems.filter(Boolean) : [];
  const normaliseLabel = (value = "") =>
    value
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const shouldOverrideLabel = (existingLabel = "", nextLabel = "") => {
    if (!existingLabel) return true;
    const existingKey = normaliseLabel(existingLabel);
    const nextKey = normaliseLabel(nextLabel);
    if (existingKey === nextKey) return false;
    if (existingKey.includes("service reminder") && existingKey.includes("oil")) return true;
    if (existingKey.includes("service reminder oil level")) return true;
    if (existingKey.includes("service reminder/oil")) return true;
    return false;
  };

  // Keep request tasks and any non-VHC manual tasks as-is, but replace VHC tasks with the current authorised list.
  const requestTasks = baseTasks.filter((task) => task.source === "request");
  const manualTasks = baseTasks.filter((task) => task.source !== "request" && task.source !== "vhc");

  const existingVhcTasks = baseTasks.filter((task) => task.source === "vhc");
  const existingByKey = new Map(existingVhcTasks.map((task) => [composeTaskKey(task), task]));
  const existingByLabel = new Map(
    existingVhcTasks
      .filter((task) => task?.label)
      .map((task) => [normaliseLabel(task.label), task])
  );

  const nextVhcTasks = [];
  normalizedAuthorized.forEach((item, index) => {
    const source = item.source || "vhc";
    if (source !== "vhc") {
      return;
    }

    const sourceKey = item.sourceKey || `${source}-${item.authorizationId || "auth"}-${index + 1}`;
    const label = item.label || item.description || "";
    if (!label) return;

    const candidate = {
      taskId: item.taskId || null,
      source,
      sourceKey,
      label,
      status: item.status === "complete" ? "complete" : "additional_work",
    };

    const key = composeTaskKey(candidate);
    const existing = existingByKey.get(key);
    if (existing) {
      // Preserve existing status/label edits for the same row.
      nextVhcTasks.push({
        ...candidate,
        taskId: existing.taskId ?? candidate.taskId ?? null,
        status: existing.status || candidate.status,
        label: shouldOverrideLabel(existing.label, candidate.label) ? candidate.label : existing.label,
      });
    } else {
      const labelKey = normaliseLabel(candidate.label);
      const labelMatch = labelKey ? existingByLabel.get(labelKey) : null;
      if (labelMatch) {
        nextVhcTasks.push({
          ...candidate,
          taskId: labelMatch.taskId ?? candidate.taskId ?? null,
          status: labelMatch.status || candidate.status,
          label: shouldOverrideLabel(labelMatch.label, candidate.label) ? candidate.label : labelMatch.label,
        });
      } else {
        nextVhcTasks.push(candidate);
      }
    }
  });

  return [...requestTasks, ...nextVhcTasks, ...manualTasks];
};

// ✅ Generate a reusable empty checkbox array
const createCheckboxArray = () => Array(10).fill(false);
const PARTS_ON_ORDER_STATUSES = new Set(["on-order", "on_order", "awaiting-stock", "awaiting_stock"]);

const createAuthorizedSourceKey = (item, index, jobId) => {
  const authSegment =
    item.authorizationId ||
    item.authorization_id ||
    item.authorization?.id ||
    jobId ||
    "auth";
  const vhcSegment =
    item.vhcItemId ??
    item.vhc_item_id ??
    null;
  if (vhcSegment !== null && vhcSegment !== undefined) {
    return `vhc-${authSegment}-${String(vhcSegment)}`;
  }
  const requestSegment = item.requestId ?? item.request_id ?? null;
  if (requestSegment !== null && requestSegment !== undefined) {
    return `vhc-${authSegment}-req-${String(requestSegment)}`;
  }
  const labelSeed = (item.label || item.description || item.issueDescription || item.issue_description || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeSeed = labelSeed || `idx-${index + 1}`;
  return `vhc-${authSegment}-${safeSeed}`;
};

const stripAuthorizedPrefix = (value = "") => {
  return value
    .toString()
    .replace(/^(authori[sz]ed\s+work|authorized\s+part|authorised\s+part):\s*/i, "");
};

const tasksAreEqual = (left = [], right = []) => {
  if (left === right) {
    return true;
  }
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const prevTask = left[index] || {};
    const nextTask = right[index] || {};
    if (
      prevTask.source !== nextTask.source ||
      prevTask.sourceKey !== nextTask.sourceKey ||
      prevTask.label !== nextTask.label ||
      prevTask.status !== nextTask.status ||
      (prevTask.taskId ?? null) !== (nextTask.taskId ?? null)
    ) {
      return false;
    }
  }
  return true;
};

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
    return "Technician Work Completed";
  }

  return hasPartsOnOrder(requests) ? "Waiting for Parts" : null;
};

const createSectionEditorsState = () => ({
  fault: [],
  cause: [],
  rectification: [],
});

const normalizeSectionEditorList = (value) => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0)
      )
    );
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
};

const normalizeSectionEditors = (value = {}) => ({
  fault: normalizeSectionEditorList(value.fault),
  cause: normalizeSectionEditorList(value.cause),
  rectification: normalizeSectionEditorList(value.rectification),
});

const buildTaskChecklistSnapshot = (tasks = []) =>
  (Array.isArray(tasks) ? tasks : []).map((task) => ({
    source: task?.source || "request",
    sourceKey: task?.sourceKey || composeTaskKey(task),
    label: task?.label || "",
    status: task?.status === "complete" ? "complete" : "additional_work",
  }));

const buildTaskSignature = (tasks = [], completionStatus = "", sectionEditors = createSectionEditorsState()) => {
  const list = (Array.isArray(tasks) ? tasks : []).map((task) =>
    `${task?.source || "request"}:${task?.sourceKey || composeTaskKey(task)}:${task?.status || "additional_work"}:${task?.label || ""}`
  );
  return `${list.join("|")}::${completionStatus || ""}::${JSON.stringify(normalizeSectionEditors(sectionEditors))}`;
};

const parseTaskChecklistPayload = (raw = null) => {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }
  if (typeof raw === "object") {
    return raw;
  }
  return null;
};

const deriveSectionEditorsFromChecklist = (rawChecklist) => {
  const parsed = parseTaskChecklistPayload(rawChecklist);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return createSectionEditorsState();
  }
  return normalizeSectionEditors(parsed.meta?.sectionEditors);
};

const extractTasksFromChecklist = (rawChecklist) => {
  const parsed = parseTaskChecklistPayload(rawChecklist);
  if (!parsed) {
    return [];
  }
  if (Array.isArray(parsed)) {
    return parsed;
  }
  return Array.isArray(parsed.tasks) ? parsed.tasks : [];
};

const formatLastSavedTime = (value) => {
  if (!value) return "Not saved yet";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not saved yet";
  return `Last saved ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const sectionBoxStyle = {
  backgroundColor: "var(--layer-section-level-3)",
  padding: "18px",
  borderRadius: "16px",
  boxShadow: "none",
  border: "1px solid var(--accent-purple-surface)",
  display: "flex",
  flexDirection: "column",
  minHeight: "360px",
};

const darkSectionBoxStyle = {
  ...sectionBoxStyle,
  backgroundColor: "var(--surface)",
  border: "1px solid var(--surface-muted)",
};

const sectionScrollerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  flex: 1,
  overflowY: "auto",
  paddingRight: "4px",
};

const defaultSectionEditorKeys = ["fault", "cause", "rectification"];

const sanitizeSectionEditors = (value = {}) => {
  const safe = {};
  defaultSectionEditorKeys.forEach((key) => {
    safe[key] = [];
  });

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, rawList]) => {
      if (!Array.isArray(rawList)) {
        return;
      }
      const cleaned = Array.from(
        new Set(
          rawList
            .map((entry) => (entry || "").toString().trim())
            .filter(Boolean)
        )
      );
      if (cleaned.length > 0) {
        safe[key] = cleaned;
      }
    });
  }

  return safe;
};

const computeSectionEditorsSignature = (value = {}) =>
  JSON.stringify(sanitizeSectionEditors(value));

const editorsAreEqual = (left = {}, right = {}) =>
  computeSectionEditorsSignature(left) === computeSectionEditorsSignature(right);

const computeTaskSignature = (tasks = [], completionStatus = "") => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return JSON.stringify({ tasks: [], completionStatus });
  }
  const payload = tasks.map((task) => ({
    source: task?.source || "",
    key: task?.sourceKey || "",
    status: task?.status || "",
    label: task?.label || "",
    originalLabel: task?.originalLabel || "",
  }));
  return JSON.stringify({ tasks: payload, completionStatus });
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
  backgroundColor: completed ? "var(--success-surface)" : "var(--layer-section-level-2)",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

const rectificationCardStyle = (completed) => ({
  borderRadius: "12px",
  border: `1px solid ${completed ? "var(--info)" : "var(--danger)"}`,
  padding: "12px",
  backgroundColor: completed ? "var(--success-surface)" : "var(--layer-section-level-3)",
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
  backgroundColor: "var(--layer-section-level-3)",
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

export default function WriteUpForm({
  jobNumber,
  jobCardData = null,
  showHeader = true,
  onSaveSuccess,
  onCompletionChange,
}) {
  const router = useRouter();
  const { user } = useUser();
  const username = user?.username;
  const userId = user?.id || user?.user_id || null;
  const userDisplayName =
    user?.displayName ||
    user?.fullName ||
    user?.username ||
    user?.email ||
    "";
  const { usersByRole, isLoading: rosterLoading } = useRoster();
  const { resolvedMode } = useTheme();
  const isDarkMode = resolvedMode === "dark";
  const closeButtonColor = isDarkMode ? "var(--accent-purple)" : "var(--danger)";

  const [jobData, setJobData] = useState(jobCardData);
  const [, setAuthorizedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
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
    sectionEditors: sanitizeSectionEditors()
  });

  useEffect(() => {
    if (jobCardData?.jobCard) {
      setJobData(jobCardData);
    }
  }, [jobCardData]);

  const [showCheckSheetPopup, setShowCheckSheetPopup] = useState(false);
  const [showDocumentsPopup, setShowDocumentsPopup] = useState(false);
  const [activeTab, setActiveTab] = useState("writeup");

  const liveSyncTimeoutRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const autoSaveExtrasTimeoutRef = useRef(null);
  const lastSyncedFieldsRef = useRef({
    fault: "",
    caused: "",
    rectification: "",
    causeSignature: "",
    sectionEditorsSignature: "",
  });
  const lastSyncedTasksRef = useRef({
    signature: "",
  });
  const lastSyncedExtrasRef = useRef({
    signature: "",
  });
  const [writeUpMeta, setWriteUpMeta] = useState({ jobId: null, writeupId: null });

  // When the parent job card refreshes, keep Rectification in sync immediately (no tab-local refetch required).
  useEffect(() => {
    const resolved = Array.isArray(jobCardData?.jobCard?.authorizedVhcItems)
      ? jobCardData.jobCard.authorizedVhcItems
      : null;

    if (!resolved) {
      return;
    }

    setAuthorizedItems(resolved);
    setWriteUpData((prev) => {
      const normalizedEntries = resolved.map((item, index) => {
        const baseLabel =
          item?.label ||
          item?.description ||
          item?.text ||
          item?.section ||
          "Authorised item";
        const detail =
          item?.issueDescription ||
          item?.noteText ||
          item?.issue_description ||
          item?.note_text ||
          "";
        const cleanedDetail =
          detail && baseLabel.toLowerCase().includes(detail.toLowerCase()) ? "" : detail;
        const description = cleanedDetail ? `${baseLabel} - ${cleanedDetail}` : baseLabel;
        return {
          ...item,
          source: "vhc",
          sourceKey: createAuthorizedSourceKey(item || {}, index, jobCardData?.jobCard?.id || writeUpMeta.jobId),
          label: description || `Authorised item ${index + 1}`,
          status: item?.status === "complete" ? "complete" : "additional_work",
        };
      });

      const mergedTasks = ensureAuthorizedTasks(prev.tasks, normalizedEntries);
      if (tasksAreEqual(prev.tasks, mergedTasks)) {
        return prev;
      }
      return { ...prev, tasks: mergedTasks };
    });
  }, [jobCardData?.jobCard?.authorizedVhcItems, jobCardData?.jobCard?.id, writeUpMeta.jobId]);
  const markFieldsSynced = useCallback((fields) => {
    lastSyncedFieldsRef.current = {
      fault: fields.fault || "",
      caused: fields.caused || "",
      rectification: fields.rectification || "",
      causeSignature: fields.causeSignature || "",
      sectionEditorsSignature: fields.sectionEditorsSignature || "",
    };
  }, []);

  const markTasksSynced = useCallback((signature) => {
    lastSyncedTasksRef.current = {
      signature: signature || "",
    };
  }, []);

  const techsList = usersByRole?.["Techs"] || [];
  const isTech = techsList.includes(username);

  const recordSectionEditor = useCallback(
    (sectionKey) => {
      if (!sectionKey || isTech) {
        return;
      }

      const editorName = userDisplayName.trim();
      if (!editorName) {
        return;
      }

      setWriteUpData((prev) => {
        const nextEditors = sanitizeSectionEditors(prev.sectionEditors);
        const existing = nextEditors[sectionKey] || [];
        if (existing.includes(editorName)) {
          return prev;
        }
        return {
          ...prev,
          sectionEditors: {
            ...nextEditors,
            [sectionKey]: [...existing, editorName],
          },
        };
      });
    },
    [isTech, userDisplayName]
  );

  const refreshAuthorizedWork = useCallback(async () => {
    if (!jobNumber) {
      return;
    }

    try {
      // IMPORTANT: Rectification must use the exact same source as Job Card "Authorised VHC Items".
      // Prefer job payload from the parent job card page; fall back to fetching if needed.
      let jobPayload = jobCardData;
      if (!jobPayload || !jobPayload?.jobCard) {
        const jobResponse = await getJobByNumber(jobNumber);
        jobPayload = jobResponse?.data || null;
      }
      if (jobPayload) {
        setJobData(jobPayload);
      }

      const parseJson = (value) => {
        if (!value) return null;
        if (typeof value === "object") return value;
        try {
          return JSON.parse(value);
        } catch (_error) {
          return null;
        }
      };
      const serviceChoiceLabels = {
        reset: "Service Reminder Reset",
        not_required: "Service Reminder Not Required",
        no_reminder: "Doesn't Have a Service Reminder",
        indicator_on: "Service Indicator On",
      };
      const checks = Array.isArray(jobPayload?.jobCard?.vhcChecks)
        ? jobPayload.jobCard.vhcChecks
        : [];
      const builderRecord = checks.find((check) => {
        const section = (check?.section || "").toString().trim();
        return section === "VHC_CHECKSHEET" || section === "VHC Checksheet";
      });
      const parsedPayload = parseJson(builderRecord?.issue_description || builderRecord?.data);
      const choiceKey = parsedPayload?.serviceIndicator?.serviceChoice || "";
      const serviceChoiceLabel = serviceChoiceLabels[choiceKey] || choiceKey || "";
      const normaliseServiceText = (value = "") =>
        value
          .toString()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const resolved = Array.isArray(jobPayload?.jobCard?.authorizedVhcItems)
        ? jobPayload.jobCard.authorizedVhcItems
        : [];
      setAuthorizedItems(resolved);

      setWriteUpData((prev) => {
        const normalizedEntries = resolved.map((item, index) => {
          const baseLabel = (
            item?.label ||
            item?.description ||
            item?.issueDescription ||
            item?.issue_description ||
            item?.section ||
            ""
          ).toString().trim();
          const sectionLabel = (item?.section || "").toString();
          const labelKey = normaliseServiceText(baseLabel);
          const sectionKey = normaliseServiceText(sectionLabel);
          const isServiceIndicatorRow =
            sectionKey.includes("service indicator") ||
            sectionKey.includes("under bonnet") ||
            labelKey.includes("service indicator") ||
            labelKey.includes("under bonnet");
          const isServiceReminderOil =
            (labelKey.includes("service reminder") && labelKey.includes("oil")) ||
            labelKey.includes("service reminder oil level") ||
            labelKey.includes("service reminder/oil level");
          const isServiceReminder =
            labelKey.includes("service reminder") || sectionKey.includes("service reminder");
          const description =
            isServiceIndicatorRow && (isServiceReminderOil || isServiceReminder) && serviceChoiceLabel
              ? `Service Reminder - ${serviceChoiceLabel}`
              : baseLabel;
          return {
            ...item,
            source: "vhc",
            sourceKey: createAuthorizedSourceKey(item || {}, index, jobPayload?.jobCard?.id || writeUpMeta.jobId || jobData?.jobCard?.id),
            label: description || `Authorised item ${index + 1}`,
            status: item?.status === "complete" ? "complete" : "additional_work",
          };
        });

        const mergedTasks = ensureAuthorizedTasks(prev.tasks, normalizedEntries);
        if (tasksAreEqual(prev.tasks, mergedTasks)) {
          return prev;
        }
        return {
          ...prev,
          tasks: mergedTasks,
        };
      });
    } catch (error) {
      console.error("Failed to refresh authorized work:", error);
    }
  }, [jobNumber, jobCardData, jobData?.jobCard?.authorizedVhcItems, jobData?.jobCard?.id, writeUpMeta.jobId]);

  const requestTasks = useMemo(
    () => writeUpData.tasks.filter((task) => task && task.source === "request"),
    [writeUpData.tasks]
  );
  const rectificationTasks = useMemo(
    () => writeUpData.tasks.filter((task) => task && task.source !== "request"),
    [writeUpData.tasks]
  );
  const showRectificationStatus = rectificationTasks.length > 0;
  const totalTasks = writeUpData.tasks.length;
  const completedTasks = writeUpData.tasks.filter((task) => task.status === "complete").length;

  // ✅ Fetch job + write-up data whenever the job number changes
  const performWriteUpSave = useCallback(
    async ({ silent = false } = {}) => {
      if (!jobNumber) {
        if (!silent) {
          alert("Missing job number");
        }
        return false;
      }

      try {
        if (!silent) {
          setSaving(true);
        }
        const result = await saveWriteUpToDatabase(jobNumber, writeUpData);

        if (result?.success) {
          const nextCompletionStatus = result.completionStatus || writeUpData.completionStatus;
          setWriteUpData((prev) => ({
            ...prev,
            completionStatus: nextCompletionStatus,
          }));
          setLastSavedAt(new Date());

          const requestsForPartsStatus = jobData?.jobCard?.partsRequests || [];
          const desiredStatus = determineJobStatusFromTasks(
            writeUpData.tasks,
            requestsForPartsStatus,
            rectificationTasks.length > 0
          );
          if (desiredStatus && jobData?.jobCard?.id) {
            try {
              const isSubStatus = Boolean(resolveSubStatusId(desiredStatus));
              if (isSubStatus) {
                await logJobSubStatus(
                  jobData.jobCard.id,
                  desiredStatus,
                  userId,
                  "Write-up updated"
                );
              } else {
                await updateJobStatus(jobData.jobCard.id, desiredStatus);
              }
            } catch (statusError) {
              console.error("❌ Failed to update job status after saving write-up:", statusError);
            }
          }

          markTasksSynced(computeTaskSignature(writeUpData.tasks, nextCompletionStatus));

          if (!silent) {
            alert("✅ Write-up saved successfully!");
            if (onSaveSuccess) {
              onSaveSuccess();
            } else if (isTech) {
              router.push(`/job-cards/myjobs/${jobNumber}`);
            } else {
              router.push(`/job-cards/${jobNumber}`);
            }
          }
          return true;
        }

        if (!silent) {
          alert(result?.error || "❌ Failed to save write-up");
        } else if (result?.error) {
          console.error("❌ Failed to save write-up:", result.error);
        }
        return false;
      } catch (error) {
        console.error("Error saving write-up:", error);
        if (!silent) {
          alert("❌ Error saving write-up");
        }
        return false;
      } finally {
        if (!silent) {
          setSaving(false);
        }
      }
    },
    [
      jobNumber,
      writeUpData,
      jobData?.jobCard?.partsRequests,
      jobData?.jobCard?.id,
      rectificationTasks.length,
      userId,
      onSaveSuccess,
      isTech,
      router,
      markTasksSynced,
    ]
  );

  useEffect(() => {
    if (!jobNumber) {
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        // Prefer job payload passed down from the job card page to avoid re-loading per tab.
        const jobPayload = jobCardData?.jobCard ? jobCardData : (await getJobByNumber(jobNumber))?.data || null;
        if (jobPayload) {
          setJobData(jobPayload);
        }

        const writeUpResponse = await getWriteUpByJobNumber(jobNumber);
        const fallbackRequests = buildRequestList(jobPayload?.jobCard?.requests);

        if (writeUpResponse) {
          const incomingCauseEntries = hydrateCauseEntries(writeUpResponse.causeEntries || []);

          // Use the same canonical source as the Job Card "Authorised VHC Items" section.
          // (Server-derived list on the job payload; avoids client-side RLS issues.)
          const canonicalAuthorised = Array.isArray(jobPayload?.jobCard?.authorizedVhcItems)
            ? jobPayload.jobCard.authorizedVhcItems
            : [];
          const canonicalEntries = canonicalAuthorised.map((item, index) => {
            const description = (item?.description || item?.label || "").toString().trim();
            return {
              ...item,
              source: "vhc",
              sourceKey: createAuthorizedSourceKey(item || {}, index, jobPayload?.jobCard?.id),
              label: description || `Authorised item ${index + 1}`,
              status: item?.status === "complete" ? "complete" : "additional_work",
            };
          });
          const mergedTasks = ensureAuthorizedTasks(writeUpResponse.tasks || [], canonicalEntries);
          const normalizedEditors = sanitizeSectionEditors(writeUpResponse.sectionEditors);
          const completionStatusValue = writeUpResponse.completionStatus || "additional_work";
          setAuthorizedItems(canonicalAuthorised);
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
            tasks: mergedTasks,
            completionStatus: completionStatusValue,
            jobDescription: writeUpResponse.jobDescription || writeUpResponse.fault || "",
            vhcAuthorizationId: writeUpResponse.vhcAuthorizationId || null,
            causeEntries: incomingCauseEntries,
            sectionEditors: normalizedEditors,
          }));
          markFieldsSynced({
            fault: writeUpResponse.fault || "",
            caused: writeUpResponse.caused || "",
            rectification: writeUpResponse.rectification || "",
            causeSignature: buildCauseSignature(incomingCauseEntries),
            sectionEditorsSignature: computeSectionEditorsSignature(normalizedEditors),
          });
          markTasksSynced(computeTaskSignature(mergedTasks, completionStatusValue));
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
            tasks: ensureAuthorizedTasks(
              fallbackRequests.map((item) => ({
                taskId: null,
                source: item.source,
                sourceKey: item.sourceKey,
                label: item.label,
                status: "additional_work",
              })),
              []
            ),
            completionStatus: "additional_work",
            jobDescription: fallbackDescription,
            vhcAuthorizationId: null,
            causeEntries: [],
            sectionEditors: sanitizeSectionEditors(),
          }));
          markFieldsSynced({
            fault: fallbackDescription,
            caused: "",
            rectification: "",
            causeSignature: "",
            sectionEditorsSignature: computeSectionEditorsSignature(),
          });
          markTasksSynced(computeTaskSignature([], "additional_work"));
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

  useEffect(() => {
    refreshAuthorizedWork();
  }, [refreshAuthorizedWork]);

  useEffect(() => {
    if (!writeUpMeta.jobId) {
      return undefined;
    }

    const channel = supabase.channel(`vhc-authorizations-${writeUpMeta.jobId}`);
    const handleAuthorizationChange = () => {
      refreshAuthorizedWork();
    };

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "vhc_authorizations",
        filter: `job_id=eq.${writeUpMeta.jobId}`,
      },
      handleAuthorizationChange
    );

    void channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [writeUpMeta.jobId, refreshAuthorizedWork]);

  useEffect(() => {
    if (!writeUpMeta.jobId) {
      return undefined;
    }

    const channel = supabase.channel(`vhc-checks-${writeUpMeta.jobId}`);
    const handleVhcCheckChange = () => {
      refreshAuthorizedWork();
    };

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "vhc_checks",
        filter: `job_id=eq.${writeUpMeta.jobId}`,
      },
      handleVhcCheckChange
    );

    void channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [writeUpMeta.jobId, refreshAuthorizedWork]);

  useEffect(() => {
    if (!writeUpMeta.jobId) {
      return undefined;
    }

    const channel = supabase.channel(`authorized-parts-${writeUpMeta.jobId}`);
    const handlePartsChange = () => {
      refreshAuthorizedWork();
    };

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "parts_job_items",
        filter: `job_id=eq.${writeUpMeta.jobId}`,
      },
      handlePartsChange
    );

    void channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [writeUpMeta.jobId, refreshAuthorizedWork]);

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
    recordSectionEditor("fault");
  };

  const handleRequestLabelChange = (taskKey) => (event) => {
    const value = event.target.value;
    let updated = false;
    setWriteUpData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (composeTaskKey(task) !== taskKey) {
          return task;
        }
        updated = true;
        if (task.status === "complete" && task.source === "request") {
          return {
            ...task,
            label: toPastTenseRequest(value),
            originalLabel: value,
          };
        }
        return { ...task, label: value, originalLabel: value };
      }),
    }));
    if (updated) {
      recordSectionEditor("fault");
    }
  };

  const handleTaskLabelChange = (taskKey) => (event) => {
    const value = event.target.value;
    let updated = false;
    setWriteUpData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (composeTaskKey(task) !== taskKey) {
          return task;
        }
        updated = true;
        return { ...task, label: value };
      }),
    }));
    if (updated) {
      recordSectionEditor("rectification");
    }
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
    recordSectionEditor("cause");
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
    recordSectionEditor("cause");
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
    async ({ fault, caused, rectification, causeEntries, sectionEditors }) => {
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
      const normalizedEditors = sanitizeSectionEditors(sectionEditors);
      const payload = {
        work_performed: sanitizedFields.fault || null,
        recommendations: sanitizedFields.caused || null,
        ratification: sanitizedFields.rectification || null,
        cause_entries: normalizedCauseEntries,
        updated_at: new Date().toISOString(),
        task_checklist: {
          sectionEditors: normalizedEditors,
        },
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

        setLastSavedAt(new Date());
        markFieldsSynced({
          ...sanitizedFields,
          causeSignature: buildCauseSignature(normalizedCauseEntries),
          sectionEditorsSignature: computeSectionEditorsSignature(normalizedEditors),
        });
      } catch (error) {
        console.error("❌ Live write-up sync failed:", error);
      }
    },
    [jobNumber, username, writeUpMeta.jobId, writeUpMeta.writeupId, markFieldsSynced]
  );

  // ✅ Toggle checklist status and auto-update completion state
  const toggleTaskStatus = (taskKey) => {
    let toggledSection = null;
    let nextCompletionStatus = null;
    let timelineEventLabel = null;
    setWriteUpData((prev) => {
      const updatedTasks = prev.tasks.map((task) => {
        const currentKey = composeTaskKey(task);
        if (currentKey !== taskKey) return task;
        if (!toggledSection) {
          toggledSection = task?.source === "request" ? "fault" : "rectification";
        }
        const nextStatus = task.status === "complete" ? "inprogress" : "complete";
        if (task?.source !== "request") {
          return { ...task, status: task.status === "complete" ? "additional_work" : "complete" };
        }

        if (nextStatus === "complete") {
          const originalLabel = task.originalLabel || task.label || "";
          const nextLabel = toPastTenseRequest(originalLabel);
          return { ...task, status: nextStatus, label: nextLabel, originalLabel };
        }

        if (task.originalLabel) {
          return { ...task, status: nextStatus, label: task.originalLabel, originalLabel: "" };
        }

        return { ...task, status: nextStatus };
      });

      const requestList = updatedTasks.filter((task) => task && task.source === "request");
      const authorisedList = updatedTasks.filter((task) => task && task.source !== "request");
      const toggledTask = updatedTasks.find((task) => composeTaskKey(task) === taskKey);
      if (toggledTask) {
        const isComplete = toggledTask.status === "complete";
        if (toggledTask.source === "request") {
          const requestIndex =
            requestList.findIndex((task) => composeTaskKey(task) === taskKey) + 1;
          timelineEventLabel = `Request ${requestIndex || 1} ${isComplete ? "Complete" : "Uncompleted"}`;
        } else {
          const authorisedIndex =
            authorisedList.findIndex((task) => composeTaskKey(task) === taskKey) + 1;
          timelineEventLabel = `Authorised ${authorisedIndex || 1} ${isComplete ? "Complete" : "Uncompleted"}`;
        }
      }

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

      nextCompletionStatus = completionStatus;
      return { ...prev, tasks: updatedTasks, completionStatus };
    });
    if (timelineEventLabel && writeUpMeta.jobId) {
      void (async () => {
        try {
          const { error } = await supabase.from("job_status_history").insert([
            {
              job_id: writeUpMeta.jobId,
              from_status: null,
              to_status: timelineEventLabel,
              changed_by: userId || null,
              reason: "write_up_task",
              changed_at: new Date().toISOString(),
            },
          ]);
          if (error) {
            console.error("Failed to log write-up task timeline event:", error);
          }
        } catch (error) {
          console.error("Failed to log write-up task timeline event:", error);
        }
      })();
    }
    if (nextCompletionStatus && typeof onCompletionChange === "function") {
      onCompletionChange(nextCompletionStatus);
    }
    if (toggledSection) {
      recordSectionEditor(toggledSection);
    }
  };
  useEffect(() => {
    if (!writeUpMeta.jobId || saving) {
      return;
    }

    const signature = computeTaskSignature(writeUpData.tasks, writeUpData.completionStatus);
    if (signature === lastSyncedTasksRef.current.signature) {
      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveTimeoutRef.current = null;
      void performWriteUpSave({ silent: true });
    }, 800);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [writeUpMeta.jobId, writeUpData.tasks, writeUpData.completionStatus, saving, performWriteUpSave]);

  useEffect(() => {
    if (typeof onCompletionChange !== "function") {
      return;
    }
    onCompletionChange(writeUpData.completionStatus || "additional_work");
  }, [onCompletionChange, writeUpData.completionStatus]);

  useEffect(() => {
    if (!writeUpMeta.jobId) {
      return;
    }

    const snapshot = {
      fault: writeUpData.fault,
      caused: writeUpData.caused,
      rectification: writeUpData.rectification,
      sectionEditors: writeUpData.sectionEditors,
    };
    const causeSignature = buildCauseSignature(writeUpData.causeEntries);
    const editorsSignature = computeSectionEditorsSignature(writeUpData.sectionEditors);

    const hasChanges =
      snapshot.fault !== lastSyncedFieldsRef.current.fault ||
      snapshot.caused !== lastSyncedFieldsRef.current.caused ||
      snapshot.rectification !== lastSyncedFieldsRef.current.rectification ||
      causeSignature !== lastSyncedFieldsRef.current.causeSignature ||
      editorsSignature !== lastSyncedFieldsRef.current.sectionEditorsSignature;

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
          sectionEditors: snapshot.sectionEditors,
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
    writeUpData.sectionEditors,
    writeUpMeta.jobId,
    persistLiveNotes,
    saving,
  ]);

  useEffect(() => {
    if (!writeUpMeta.jobId || saving) {
      return;
    }

    const signature = JSON.stringify({
      warrantyClaim: writeUpData.warrantyClaim || "",
      tsrNumber: writeUpData.tsrNumber || "",
      pwaNumber: writeUpData.pwaNumber || "",
      technicalBulletins: writeUpData.technicalBulletins || "",
      technicalSignature: writeUpData.technicalSignature || "",
      qualityControl: writeUpData.qualityControl || "",
      additionalParts: writeUpData.additionalParts || "",
      qty: writeUpData.qty || [],
      booked: writeUpData.booked || [],
      jobDescription: writeUpData.jobDescription || "",
    });

    if (signature === lastSyncedExtrasRef.current.signature) {
      return;
    }

    if (autoSaveExtrasTimeoutRef.current) {
      clearTimeout(autoSaveExtrasTimeoutRef.current);
    }

    autoSaveExtrasTimeoutRef.current = setTimeout(() => {
      autoSaveExtrasTimeoutRef.current = null;
      lastSyncedExtrasRef.current.signature = signature;
      void performWriteUpSave({ silent: true });
    }, 800);

    return () => {
      if (autoSaveExtrasTimeoutRef.current) {
        clearTimeout(autoSaveExtrasTimeoutRef.current);
        autoSaveExtrasTimeoutRef.current = null;
      }
    };
  }, [
    writeUpData.warrantyClaim,
    writeUpData.tsrNumber,
    writeUpData.pwaNumber,
    writeUpData.technicalBulletins,
    writeUpData.technicalSignature,
    writeUpData.qualityControl,
    writeUpData.additionalParts,
    writeUpData.qty,
    writeUpData.booked,
    writeUpData.jobDescription,
    writeUpMeta.jobId,
    performWriteUpSave,
    saving,
  ]);

  useEffect(() => {
    return () => {
      if (liveSyncTimeoutRef.current) {
        clearTimeout(liveSyncTimeoutRef.current);
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (autoSaveExtrasTimeoutRef.current) {
        clearTimeout(autoSaveExtrasTimeoutRef.current);
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
      const incomingEditors = deriveSectionEditorsFromChecklist(incoming.task_checklist);
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

        if (!editorsAreEqual(prev.sectionEditors, incomingEditors)) {
          nextState.sectionEditors = incomingEditors;
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
          sectionEditorsSignature: computeSectionEditorsSignature(incomingEditors),
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
  const requestSlots = requestTasks;
  const getProgressLabel = (total, completed) => {
    if (total <= 0) return "0 complete";
    if (completed === 0) return `${total} not started`;
    const remaining = total - completed;
    if (remaining <= 0) return `${total} complete`;
    return `${remaining} outstanding`;
  };
  const faultCompletedCount = requestTasks.filter((task) => task?.status === "complete").length;
  const rectificationCompletedCount = rectificationTasks.filter((task) => task?.status === "complete").length;
  const causeCompletedCount = writeUpData.causeEntries.filter(
    (entry) => (entry?.text || "").toString().trim().length > 0
  ).length;
  const faultProgressLabel = getProgressLabel(requestTasks.length, faultCompletedCount);
  const rectificationProgressLabel = getProgressLabel(rectificationTasks.length, rectificationCompletedCount);
  const assignedRequestKeys = new Set(
    writeUpData.causeEntries
      .map((entry) => entry.requestKey)
      .filter(Boolean)
  );
  const canAddCause =
    requestTasks.length > 0 && writeUpData.causeEntries.length < requestTasks.length;
  const isWarrantyJob = (jobData?.jobCard?.jobSource || "").toLowerCase() === "warranty";
  const causeProgressLabel = isWarrantyJob
    ? getProgressLabel(requestTasks.length, causeCompletedCount)
    : "";
  const getRequestOptions = (entryRequestKey) =>
    requestTasks.filter((task) => {
      if (entryRequestKey && task.sourceKey === entryRequestKey) {
        return true;
      }
      return !assignedRequestKeys.has(task.sourceKey);
    });
  const normalizedSectionEditors = useMemo(
    () => sanitizeSectionEditors(writeUpData.sectionEditors),
    [writeUpData.sectionEditors]
  );
  const renderSectionEditorMeta = (sectionKey) => {
    const editors = normalizedSectionEditors[sectionKey] || [];
    if (!Array.isArray(editors) || editors.length === 0) {
      return null;
    }
    return (
      <span style={{ ...sectionSubtitleStyle, color: "var(--accent-purple)", fontWeight: 600 }}>
        Edited by {editors.join(", ")}
      </span>
    );
  };
const renderLastSaved = () => (
    <span style={{ ...sectionSubtitleStyle, color: "var(--info-dark)" }}>
      {formatLastSavedTime(lastSavedAt)}
    </span>
  );
  const stripRequestPrefix = (value = "") =>
    value.replace(/^Request\s*\d+\s*:\s*/i, "");
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
      padding: 0,
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
        border: "none",
        background: "transparent",
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        gap: "8px"
      }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          {isWarrantyJob && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
              <div
                style={{
                  display: "inline-flex",
                  gap: "6px",
                  padding: "6px",
                  borderRadius: "999px",
                  border: "1px solid var(--surface-light)",
                  backgroundColor: "var(--surface)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab("writeup")}
                  style={{
                    borderRadius: "999px",
                    border: "1px solid transparent",
                    padding: "8px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    background: activeTab === "writeup" ? "var(--primary)" : "transparent",
                    color: activeTab === "writeup" ? "var(--surface)" : "var(--text-primary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Write-Up
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("extras")}
                  style={{
                    borderRadius: "999px",
                    border: "1px solid transparent",
                    padding: "8px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    background: activeTab === "extras" ? "var(--primary)" : "transparent",
                    color: activeTab === "extras" ? "var(--surface)" : "var(--text-primary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Warranty Extras
                </button>
              </div>
            </div>
          )}
          {activeTab === "writeup" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                minHeight: 0,
                width: "100%",
              }}
            >
              <div style={darkSectionBoxStyle}>
                <div style={{ ...sectionHeaderStyle }}>
                  <div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "baseline", flexWrap: "wrap" }}>
                      <p style={sectionTitleStyle}>Fault</p>
                      <span style={{ ...sectionSubtitleStyle, color: "var(--info)" }}>
                        {faultProgressLabel}
                      </span>
                    </div>
                    {renderLastSaved()}
                    {renderSectionEditorMeta("fault")}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }} />
                </div>
                <div
                  style={{
                    ...sectionScrollerStyle,
                    overflowY: requestSlots.length > 3 ? "auto" : "visible",
                    paddingRight: requestSlots.length > 3 ? "4px" : 0,
                  }}
                >
                  {requestSlots.map((task, index) => {
                    const slotKey = composeTaskKey(task);
                    const isComplete = task?.status === "complete";
                    return (
                      <div key={slotKey} style={cardRowStyle(isComplete)}>
                        <label style={checkboxLabelStyle(isComplete)}>
                          <input
                            type="checkbox"
                            checked={isComplete}
                            onChange={() => toggleTaskStatus(slotKey)}
                            style={checkboxStyle}
                          />
                          {isComplete ? "Completed" : "Mark complete"}
                        </label>
                        <div style={{ fontSize: "12px", color: "var(--info)" }}>Request {index + 1}</div>
                        <textarea
                          value={stripRequestPrefix(task?.label || "")}
                          onChange={handleRequestLabelChange(slotKey)}
                          rows={2}
                          style={{ ...modernTextareaStyle, minHeight: "60px", flex: 1 }}
                        />
                      </div>
                    );
                  })}
                  {requestSlots.length === 0 && (
                    <p style={{ color: "var(--info)", fontSize: "13px" }}>No job requests available yet.</p>
                  )}
                </div>
              </div>
              {isWarrantyJob && (
                <div style={sectionBoxStyle}>
                  <div style={sectionHeaderStyle}>
                  <div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "baseline", flexWrap: "wrap" }}>
                      <p style={sectionTitleStyle}>Cause</p>
                      <span style={{ ...sectionSubtitleStyle, color: "var(--info)" }}>
                        {causeProgressLabel}
                      </span>
                    </div>
                    {renderLastSaved()}
                    {renderSectionEditorMeta("cause")}
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
              )}
              <div style={darkSectionBoxStyle}>
                <div style={sectionHeaderStyle}>
                  <div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "baseline", flexWrap: "wrap" }}>
                      <p style={sectionTitleStyle}>Rectification</p>
                      <span style={{ ...sectionSubtitleStyle, color: "var(--info)" }}>
                        {rectificationProgressLabel}
                      </span>
                    </div>
                    {renderLastSaved()}
                    {renderSectionEditorMeta("rectification")}
                  </div>
                  {showRectificationStatus && (
                    <span style={{ ...completionBadgeStyle, backgroundColor: completionStatusColor }}>
                      {completionStatusLabel}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    ...sectionScrollerStyle,
                    overflowY: rectificationTasks.length > 3 ? "auto" : "visible",
                    paddingRight: rectificationTasks.length > 3 ? "4px" : 0,
                  }}
                >
                  {rectificationTasks.length === 0 ? (
                    <p style={{ margin: 0, color: "var(--info)", fontSize: "13px" }}>
                      Add authorised additional work to record rectifications.
                    </p>
                  ) : (
                    rectificationTasks.map((task, index) => {
                      const taskKey = composeTaskKey(task);
                      const isComplete = task.status === "complete";
                      return (
                        <div key={taskKey} style={cardRowStyle(isComplete)}>
                          <label style={checkboxLabelStyle(isComplete)}>
                            <input
                              type="checkbox"
                              checked={isComplete}
                              onChange={() => toggleTaskStatus(taskKey)}
                              style={checkboxStyle}
                            />
                            {isComplete ? "Completed" : "Mark complete"}
                          </label>
                          <div style={{ fontSize: "12px", color: "var(--info)" }}>Item {index + 1}</div>
                          <textarea
                            value={stripAuthorizedPrefix(task.label)}
                            onChange={handleTaskLabelChange(taskKey)}
                            rows={2}
                            style={{ ...modernTextareaStyle, minHeight: "60px", flex: 1 }}
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
                    backgroundColor: "var(--layer-section-level-3)",
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

      {showCheckSheetPopup && (
        <CheckSheetPopup
          onClose={closeCheckSheetPopup}
          onAddCheckSheet={handleAddCheckSheetFromPopup}
          onAddDealerDetails={handleAddDealerDetailsFromPopup}
        />
      )}

      {showDocumentsPopup && (
        <ModalPortal>
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
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  color: closeButtonColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "4px 0",
                }}
              >
                Close
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
        </ModalPortal>
      )}
    </div>
  );
}
