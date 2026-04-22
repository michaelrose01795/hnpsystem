// file location: src/pages/valet/index.js
// ✅ Imports converted to use absolute alias "@/"
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { useUser } from "@/context/UserContext";
import { getAllJobs, updateJob } from "@/lib/database/jobs";
import { getValetEtaSignals } from "@/lib/database/valetEtaSignals";
import { resolveMainStatusId } from "@/lib/status/statusFlow";
import { logJobSubStatus } from "@/lib/services/jobStatusService";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { CalendarField } from "@/components/ui/calendarAPI";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import { revalidateAllJobs } from "@/lib/swr/mutations";
import { calculateSmartTechEta } from "@/utils/jobs/calculateSmartTechEta";
import ValetDashboardUi from "@/components/page-ui/valet/valet-ui"; // Extracted presentation layer.

const WASH_KEYWORDS = ["wash", "valet", "clean"];
const VALET_TABLE_COLUMNS =
"minmax(0, 0.8fr) minmax(0, 0.72fr) minmax(0, 1.45fr) repeat(4, minmax(84px, 0.62fr)) minmax(0, 1fr)";
const VALET_ROW_HEIGHT = "84px";

const formatDateOnly = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTodayDateValue = () => formatDateOnly(new Date());

const formatDateOnlyLabel = (value) => {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const getJobDayValue = (job) => {
  const source = job?.appointment?.date ?
  `${job.appointment.date}T00:00:00` :
  job?.checkedInAt || null;
  if (!source) return "";
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatDateOnly(parsed);
};

const isCancelledJob = (job) => {
  const normalized = normalizeStatusValue(job?.status);
  return normalized === "cancelled" || normalized === "canceled";
};

const resolveWashState = (checklist = {}, job = null) => {
  const rawState = String(
    checklist?.washState ||
    job?.maintenanceInfo?.valetChecklist?.washState ||
    ""
  ).trim().toLowerCase();
  if (rawState === "complete") return "complete";
  if (rawState === "no_wash") return "no_wash";
  if (checklist?.wash || job?.maintenanceInfo?.valetChecklist?.wash) return "complete";
  return "blank";
};

const getNextWashState = (currentState) => {
  if (currentState === "blank") return "complete";
  if (currentState === "complete") return "no_wash";
  return "blank";
};

const getWashIndicatorMeta = (state) => {
  if (state === "complete") {
    return {
      symbol: "✓",
      color: "var(--success)",
      borderColor: "rgba(var(--success-rgb), 0.35)",
      background: "rgba(var(--success-rgb), 0.1)",
      label: "Wash complete"
    };
  }
  if (state === "no_wash") {
    return {
      symbol: "✕",
      color: "var(--danger)",
      borderColor: "rgba(var(--danger-rgb), 0.35)",
      background: "rgba(var(--danger-rgb), 0.08)",
      label: "No wash to be done"
    };
  }
  return {
    symbol: "",
    color: "var(--text-secondary)",
    borderColor: "rgba(var(--grey-accent-rgb), 0.35)",
    background: "var(--surface)",
    label: "Wash not set"
  };
};

const normalizeTextArray = (values) => {
  if (!Array.isArray(values)) return [];
  return values.
  map((value) => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const raw =
      value.text ||
      value.description ||
      value.title ||
      value.request ||
      "";
      return raw;
    }
    return "";
  }).
  filter(Boolean).
  map((text) => text.toLowerCase());
};

const containsKeyword = (text, keywords = WASH_KEYWORDS) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
};

const COMPLETE_STATUSES = new Set(["complete", "completed", "done", "waiting_additional_work"]);
const REQUEST_DONE_STATUSES = new Set(["complete", "completed", "done"]);

const normalizeStatusValue = (value) =>
String(value || "").
trim().
toLowerCase().
replace(/\s+/g, "_");

const isRequestComplete = (status) => REQUEST_DONE_STATUSES.has(normalizeStatusValue(status));

const isMotRequest = (request = {}) => {
  const haystack = [
  request?.description,
  request?.jobType,
  request?.serviceType,
  request?.requestSource].

  map((value) => String(value || "").toLowerCase()).
  join(" ");
  return haystack.includes("mot");
};

const extractWriteUpTasks = (job) => {
  const rawChecklist = job?.writeUp?.task_checklist;
  if (Array.isArray(rawChecklist)) return rawChecklist;
  if (rawChecklist && typeof rawChecklist === "object" && Array.isArray(rawChecklist.tasks)) {
    return rawChecklist.tasks;
  }
  if (typeof rawChecklist === "string") {
    try {
      const parsed = JSON.parse(rawChecklist);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.tasks)) {
        return parsed.tasks;
      }
    } catch (_error) {
      return [];
    }
  }
  return [];
};

const isTaskComplete = (task) => {
  if (!task || typeof task !== "object") return false;
  if (typeof task.checked === "boolean") return task.checked;
  return isRequestComplete(task.status);
};

const sumAuthorisedCheckAmount = (row) => {
  if (!row || typeof row !== "object") return 0;
  const override = Number(row.totalOverride ?? row.total_override);
  if (Number.isFinite(override) && override > 0) {
    return override;
  }
  const labour = Number(row.labourHours ?? row.labour_hours);
  const parts = Number(row.partsCost ?? row.parts_cost);
  return (Number.isFinite(labour) ? labour : 0) + (Number.isFinite(parts) ? parts : 0);
};

const jobHasServiceCategory = (job) => {
  const categories = Array.isArray(job.jobCategories) ?
  job.jobCategories.map((cat) => (cat || "").toLowerCase()) :
  [];
  return categories.some((category) => category.includes("service"));
};

const jobHasHighValueAuthorizedWork = (job) => {
  if (!Array.isArray(job?.vhcChecks)) {
    return false;
  }

  const totalAuthorized = job.vhcChecks.reduce((total, check) => {
    const state = String(
      check?.authorizationState ?? check?.authorization_state ?? check?.approvalStatus ?? check?.approval_status ?? ""
    ).
    trim().
    toLowerCase();
    if (state !== "authorized" && state !== "authorised" && state !== "completed") {
      return total;
    }
    return total + sumAuthorisedCheckAmount(check);
  }, 0);

  return totalAuthorized >= 1000;
};

const jobHasWashFlag = (job) => {
  const categories = Array.isArray(job.jobCategories) ?
  job.jobCategories.map((cat) => (cat || "").toLowerCase()) :
  [];
  const requests = normalizeTextArray(job.requests);

  return (
    Boolean(job.maintenanceInfo?.washRequired) ||
    containsKeyword(job.description) ||
    containsKeyword(job.status) ||
    containsKeyword(job.waitingStatus) ||
    containsKeyword(job.cosmeticNotes) ||
    categories.some((category) => containsKeyword(category)) ||
    requests.some((request) => containsKeyword(request)) ||
    Boolean(job.maintenanceInfo?.valetChecklist));

};

const inferVehicleHere = (job) => {
  const mainStatusId = resolveMainStatusId(job?.status);
  if (mainStatusId === "released") return false;
  return Boolean(job?.checkedInAt);
};

const inferWorkshop = (job) => {
  const writeUpCompletionStatus = normalizeStatusValue(
    job?.writeUp?.completion_status || job?.completionStatus || ""
  );
  const writeUpMarkedComplete = COMPLETE_STATUSES.has(writeUpCompletionStatus);

  const requestRows = Array.isArray(job?.jobRequests) ? job.jobRequests : [];
  const allRequestsComplete =
  requestRows.length > 0 && requestRows.every((request) => isRequestComplete(request?.status));

  const requestTasks = extractWriteUpTasks(job).filter((task) => {
    const source = String(task?.source || "").toLowerCase();
    return source === "request";
  });
  const allRequestTasksComplete =
  requestTasks.length > 0 && requestTasks.every((task) => isTaskComplete(task));

  return writeUpMarkedComplete || allRequestsComplete || allRequestTasksComplete;
};

const inferMot = (job) => {
  const requestRows = Array.isArray(job?.jobRequests) ? job.jobRequests : [];
  const motRows = requestRows.filter((request) => isMotRequest(request));
  return motRows.length > 0 && motRows.every((request) => isRequestComplete(request?.status));
};

const buildChecklist = (job) => {
  const stored = job.maintenanceInfo?.valetChecklist || {};
  const washState =
  stored.washState === "complete" || stored.washState === "no_wash" ?
  stored.washState :
  stored.wash ?
  "complete" :
  "blank";
  const result = {
    vehicleHere: inferVehicleHere(job),
    workshop: inferWorkshop(job),
    mot: inferMot(job),
    wash: washState === "complete",
    washState,
    updatedAt: stored.updatedAt || null,
    updatedBy: stored.updatedBy || null
  };
  return result;
};

const resolveValetRowStatusLabel = (job, checklist) => {
  if (resolveWashState(checklist, job) === "complete") return "Wash Complete";
  if (resolveWashState(checklist, job) === "no_wash") return "No Wash";
  return job?.status || "N/A";
};

const logChecklistCompletionTransitions = async ({
  jobId,
  beforeChecklist,
  afterChecklist,
  actor
}) => {
  const tasks = [];
  const beforeWashState = resolveWashState(beforeChecklist);
  const afterWashState = resolveWashState(afterChecklist);

  if (!beforeChecklist?.workshop && afterChecklist?.workshop) {
    tasks.push(
      logJobSubStatus(
        jobId,
        "Technician Work Completed",
        actor,
        "Workshop checklist auto-completed from Customer Request completion."
      )
    );
  }

  if (!beforeChecklist?.mot && afterChecklist?.mot) {
    tasks.push(
      logJobSubStatus(
        jobId,
        "MOT Completed",
        actor,
        "MOT request line marked complete."
      )
    );
  }

  if (!beforeChecklist?.wash && afterChecklist?.wash) {
    tasks.push(
      logJobSubStatus(
        jobId,
        "Wash Complete",
        actor,
        "Valet wash manually completed."
      )
    );
  }

  if (beforeWashState !== "no_wash" && afterWashState === "no_wash") {
    tasks.push(
      logJobSubStatus(
        jobId,
        "No Wash",
        actor,
        "Wash marked as not required from Valet."
      )
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
};

const formatConfidenceLabel = (value) => {
  if (!value) return "";
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return "";
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} confidence`;
};

const ValetJobRow = ({ job, checklist, onToggle, isSaving, onOpenJob, etaSignals, now }) => {
  const washState = useMemo(() => resolveWashState(checklist, job), [checklist, job]);
  const washMeta = useMemo(() => getWashIndicatorMeta(washState), [washState]);
  const cancelled = useMemo(() => isCancelledJob(job), [job]);
  const rowStatusLabel = useMemo(() => resolveValetRowStatusLabel(job, checklist), [job, checklist]);
  const smartEta = useMemo(
    () => calculateSmartTechEta(job, { etaSignals, now }),
    [job, etaSignals, now]
  );
  const etaConfidenceLabel = useMemo(
    () => formatConfidenceLabel(smartEta?.confidence),
    [smartEta?.confidence]
  );
  const etaSecondaryLabel = useMemo(() => {
    if (smartEta?.status !== "predicted") return "";
    return etaConfidenceLabel;
  }, [smartEta?.status, etaConfidenceLabel]);
  const etaMainColor = useMemo(() => {
    if (smartEta?.status === "completed") return "var(--success)";
    if (smartEta?.status === "awaiting_data" || smartEta?.status === "not_started") {
      return "var(--text-secondary)";
    }
    return "var(--text-primary)";
  }, [smartEta?.status]);
  const etaTitle = useMemo(() => {
    if (!smartEta?.reasoning) return smartEta?.displayText || "";
    const reasoning = smartEta.reasoning;
    const lines = [
    smartEta.displayText,
    reasoning.startSource ? `Start source: ${reasoning.startSource}` : null,
    reasoning.startTimeUsed ? `Start used: ${reasoning.startTimeUsed}` : null,
    `Allocated: ${reasoning.totalAllocatedMinutes || 0} min`,
    `Completed allocated: ${reasoning.completedAllocatedMinutes || 0} min`,
    `Remaining allocated: ${reasoning.remainingAllocatedMinutes || 0} min`,
    `Elapsed: ${reasoning.elapsedMinutes || 0} min`].
    filter(Boolean);
    return lines.join("\n");
  }, [smartEta]);

  const handleWashCycle = (event) => {
    event.stopPropagation();
    onToggle(job.id, "wash", getNextWashState(washState));
  };

  return (
    <div
      style={{
        border: "none",
        padding: "12px 16px",
        borderRadius: "var(--radius-sm)",
        backgroundColor: "var(--accent-purple-surface)",
        boxShadow: "none",
        display: "grid",
        gridTemplateColumns: VALET_TABLE_COLUMNS,
        gap: "6px",
        alignItems: "center",
        width: "100%",
        minHeight: VALET_ROW_HEIGHT,
        boxSizing: "border-box",
        color: cancelled ? "var(--text-secondary)" : "inherit",
        textDecoration: cancelled ? "line-through" : "none",
        opacity: cancelled ? 0.72 : 1
      }}>
      
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (typeof onOpenJob === "function") {
            onOpenJob(job);
          }
        }}
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: "var(--accent-purple)",
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          background: "transparent",
          border: "none",
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
          textDecoration: cancelled ? "line-through" : "none"
        }}>
        
        {job.jobNumber || "No Job Number"}
      </button>
      <span
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "var(--accent-purple)",
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}>
        
        {job.reg || "N/A"}
      </span>
      <span
        style={{
          fontSize: "14px",
          color: "var(--text-primary)",
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}>
        
        {job.customer || "No customer assigned"}
      </span>

      {[
      { field: "vehicleHere", label: "Vehicle Here", manual: false },
      { field: "workshop", label: "Workshop", manual: false },
      { field: "mot", label: "MOT", manual: false }].
      map(({ field, label, manual }) =>
      <div
        key={field}
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minWidth: 0,
          width: "100%"
        }}>
        
          <input
          type="checkbox"
          checked={Boolean(checklist[field])}
          readOnly
          onClick={(event) => event.stopPropagation()}
          disabled={isSaving || !manual}
          aria-label={`${label} for ${job.jobNumber || job.reg || "job"}`}
          title={label}
          style={{
            width: "20px",
            height: "20px",
            cursor: isSaving || !manual ? "not-allowed" : "pointer",
            opacity: manual ? 1 : 0.9
          }} />
        
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minWidth: 0,
          width: "100%"
        }}>
        
        <div
          style={{
            width: "20px",
            height: "20px",
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
          
          <input
            type="checkbox"
            checked={washState === "complete"}
            readOnly
            onClick={handleWashCycle}
            disabled={isSaving}
            aria-label={`${washMeta.label} for ${job.jobNumber || job.reg || "job"}`}
            title={washMeta.label}
            style={{
              width: "20px",
              height: "20px",
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: 1,
              margin: 0
            }} />
          
          {washState === "no_wash" && !isSaving ?
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: washMeta.color,
              fontSize: "0.9rem",
              fontWeight: 800,
              lineHeight: 1,
              pointerEvents: "none"
            }}>
            
              ×
            </span> :
          null}
          {isSaving ?
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              fontSize: "0.8rem",
              lineHeight: 1,
              pointerEvents: "none"
            }}>
            
              …
            </span> :
          null}
        </div>
      </div>

      <span
        style={{
          fontSize: "13px",
          color: "var(--text-primary)",
          fontWeight: 600,
          textAlign: "right",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          minWidth: 0,
          height: "100%"
        }}
        title={rowStatusLabel}>
        
        {smartEta ?
        <span
          style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "2px",
            color: etaMainColor,
            whiteSpace: "normal"
          }}
          title={etaTitle}>
          
            <span>{smartEta.displayText}</span>
            {etaSecondaryLabel ?
          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                {etaSecondaryLabel}
              </span> :
          null}
          </span> :

        <span style={{ color: "var(--text-secondary)" }}>Awaiting timing data</span>
        }
      </span>
    </div>);

};

export default function ValetDashboard() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [jobs, setJobs] = useState([]);
  const [valetState, setValetState] = useState({});
  const [etaSignalsByJobId, setEtaSignalsByJobId] = useState({});
  const [savingMap, setSavingMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDay, setSelectedDay] = useState(() => getTodayDateValue());
  const [etaNow, setEtaNow] = useState(() => Date.now());
  const isMountedRef = useRef(true);
  const fetchInFlightRef = useRef(false);

  const userRoles = useMemo(
    () => user?.roles?.map((role) => role.toLowerCase()) || [],
    [user]
  );

  const hasAccess = userRoles.some((role) =>
  ["valet service", "service manager", "admin", "workshop manager"].includes(
    role
  )
  );

  const fetchJobs = useCallback(
    async ({ background = false } = {}) => {
      if (!user || !hasAccess) {
        if (isMountedRef.current) {
          setJobs([]);
          setValetState({});
          setEtaSignalsByJobId({});
          setLoading(false);
        }
        return;
      }

      if (fetchInFlightRef.current) {
        return;
      }

      fetchInFlightRef.current = true;

      if (!background && isMountedRef.current) {
        setLoading(true);
      }
      if (isMountedRef.current) {
        setError("");
      }

      try {
        const allJobs = await getAllJobs();
        const actor = user?.user_id || user?.id || user?.username || "VALET_SERVICE";

        const filteredJobs = (allJobs || []).filter((job) => {
          return (
            jobHasWashFlag(job) ||
            jobHasServiceCategory(job) ||
            jobHasHighValueAuthorizedWork(job));

        });

        const syncedJobs = await Promise.all(
          filteredJobs.map(async (job) => {
            const derivedChecklist = buildChecklist(job);
            const storedChecklist = job?.maintenanceInfo?.valetChecklist || {};
            const autoFieldChanged =
            Boolean(storedChecklist?.vehicleHere) !== Boolean(derivedChecklist.vehicleHere) ||
            Boolean(storedChecklist?.workshop) !== Boolean(derivedChecklist.workshop) ||
            Boolean(storedChecklist?.mot) !== Boolean(derivedChecklist.mot);

            if (!autoFieldChanged) return job;

            const mergedChecklist = {
              ...storedChecklist,
              vehicleHere: derivedChecklist.vehicleHere,
              workshop: derivedChecklist.workshop,
              mot: derivedChecklist.mot,
              wash: typeof storedChecklist?.wash === "boolean" ? storedChecklist.wash : false,
              washState:
              storedChecklist?.washState === "complete" || storedChecklist?.washState === "no_wash" ?
              storedChecklist.washState :
              storedChecklist?.wash ?
              "complete" :
              "blank"
            };

            const maintenanceInfo = {
              ...(job.maintenanceInfo || {}),
              valetChecklist: mergedChecklist
            };

            const result = await updateJob(job.id, {
              maintenance_info: maintenanceInfo
            });

            if (!result?.success || !result?.data) {
              return job;
            }

            const persistedJob = {
              ...job,
              ...result.data,
              jobRequests: Array.isArray(job.jobRequests) ? job.jobRequests : [],
              writeUp: job.writeUp || null,
              checkedInAt: result.data.checkedInAt ?? job.checkedInAt ?? null,
              status: result.data.status || job.status,
              completionStatus: result.data.completionStatus ?? job.completionStatus ?? null,
              maintenanceInfo: result.data.maintenanceInfo || maintenanceInfo
            };

            await logChecklistCompletionTransitions({
              jobId: job.id,
              beforeChecklist: {
                vehicleHere: Boolean(storedChecklist?.vehicleHere),
                workshop: Boolean(storedChecklist?.workshop),
                mot: Boolean(storedChecklist?.mot),
                wash: Boolean(storedChecklist?.wash)
              },
              afterChecklist: buildChecklist(persistedJob),
              actor
            });

            return persistedJob;
          })
        );

        const nextEtaSignalsByJobId = await getValetEtaSignals(
          syncedJobs.map((job) => job?.id).filter(Boolean)
        );

        if (!isMountedRef.current) {
          return;
        }

        setJobs(syncedJobs);
        setEtaSignalsByJobId(nextEtaSignalsByJobId);
        revalidateAllJobs();

        const initial = {};
        syncedJobs.forEach((job) => {
          initial[job.id] = buildChecklist(job);
        });
        setValetState(initial);
      } catch (err) {
        if (isMountedRef.current) {
          setError(err?.message || "Failed to load valet jobs");
        }
      } finally {
        fetchInFlightRef.current = false;
        if (isMountedRef.current && !background) {
          setLoading(false);
        }
      }
    },
    [user, hasAccess]
  );

  useEffect(() => {
    isMountedRef.current = true;
    void fetchJobs();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchJobs]);

  useEffect(() => {
    const interval = setInterval(() => {
      setEtaNow(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user || !hasAccess) return undefined;

    const handleRefresh = () => {
      void fetchJobs({ background: true });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleRefresh();
      }
    };

    window.addEventListener("focus", handleRefresh);
    window.addEventListener("statusFlowRefresh", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("statusFlowRefresh", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, hasAccess, fetchJobs]);

  const filteredJobs = useMemo(() => {
    const jobsForDay = selectedDay ?
    jobs.filter((job) => getJobDayValue(job) === selectedDay) :
    jobs;
    if (!searchTerm.trim()) return jobsForDay;
    const lower = searchTerm.toLowerCase();
    return jobsForDay.filter((job) => {
      const reg = job.reg?.toLowerCase() || "";
      const jobNumber = job.jobNumber?.toLowerCase() || "";
      const customer = (job.customer || "").
      toString().
      toLowerCase();
      const makeModel = job.makeModel?.toLowerCase() || "";
      return (
        reg.includes(lower) ||
        jobNumber.includes(lower) ||
        customer.includes(lower) ||
        makeModel.includes(lower));

    });
  }, [jobs, searchTerm, selectedDay]);

  const handleToggle = useCallback(
    async (jobId, field, value) => {
      if (field !== "wash") return;
      const targetJob = jobs.find((job) => job.id === jobId);
      if (!targetJob) return;

      const previousState = valetState[jobId] || buildChecklist(targetJob);
      const nextWashState =
      value === "complete" || value === "no_wash" || value === "blank" ?
      value :
      value ?
      "complete" :
      "blank";
      const nextState = {
        ...previousState,
        [field]: nextWashState === "complete",
        washState: nextWashState
      };

      setValetState((prev) => ({
        ...prev,
        [jobId]: nextState
      }));
      setSavingMap((prev) => ({ ...prev, [jobId]: true }));
      setError("");

      try {
        const maintenanceInfo = {
          ...(targetJob.maintenanceInfo || {}),
          valetChecklist: {
            ...nextState,
            wash: nextWashState === "complete",
            washState: nextWashState === "blank" ? null : nextWashState,
            updatedAt: new Date().toISOString(),
            updatedBy: user?.username || "Valet"
          }
        };

        const result = await updateJob(jobId, {
          maintenance_info: maintenanceInfo
        });

        if (!result?.success) {
          throw new Error(result?.error?.message || "Failed to save checklist");
        }

        const persistedJob = {
          ...targetJob,
          ...result.data,
          jobRequests: Array.isArray(targetJob.jobRequests) ? targetJob.jobRequests : [],
          writeUp: targetJob.writeUp || null,
          checkedInAt: result.data.checkedInAt ?? targetJob.checkedInAt ?? null,
          status: result.data.status || targetJob.status,
          completionStatus: result.data.completionStatus ?? targetJob.completionStatus ?? null,
          maintenanceInfo: result.data.maintenanceInfo || maintenanceInfo
        };
        const persistedChecklist = buildChecklist(persistedJob);
        await logChecklistCompletionTransitions({
          jobId,
          beforeChecklist: previousState,
          afterChecklist: persistedChecklist,
          actor: user?.user_id || user?.id || user?.username || "VALET_SERVICE"
        });

        setJobs((prev) =>
        prev.map((job) => job.id === jobId ? persistedJob : job)
        );
        setValetState((prev) => ({
          ...prev,
          [jobId]: persistedChecklist
        }));
        revalidateAllJobs(); // sync SWR cache after wash toggle
      } catch (err) {
        setValetState((prev) => ({
          ...prev,
          [jobId]: previousState
        }));
        setError(err?.message || "Unable to update checklist");
      } finally {
        setSavingMap((prev) => ({ ...prev, [jobId]: false }));
      }
    },
    [jobs, valetState, user]
  );

  if (userLoading) {
    return <ValetDashboardUi view="section1" DevLayoutSection={DevLayoutSection} InlineLoading={InlineLoading} />;




















  }

  if (!user) {
    return <ValetDashboardUi view="section2" DevLayoutSection={DevLayoutSection} />;















  }

  if (!hasAccess) {
    return <ValetDashboardUi view="section3" DevLayoutSection={DevLayoutSection} />;















  }

  return <ValetDashboardUi view="section4" buildChecklist={buildChecklist} CalendarField={CalendarField} DevLayoutSection={DevLayoutSection} error={error} etaNow={etaNow} etaSignalsByJobId={etaSignalsByJobId} filteredJobs={filteredJobs} formatDateOnlyLabel={formatDateOnlyLabel} getTodayDateValue={getTodayDateValue} handleToggle={handleToggle} loading={loading} router={router} savingMap={savingMap} SearchBar={SearchBar} searchTerm={searchTerm} selectedDay={selectedDay} setSearchTerm={setSearchTerm} setSelectedDay={setSelectedDay} VALET_ROW_HEIGHT={VALET_ROW_HEIGHT} VALET_TABLE_COLUMNS={VALET_TABLE_COLUMNS} ValetJobRow={ValetJobRow} valetState={valetState} />;
















































































































































































































}
