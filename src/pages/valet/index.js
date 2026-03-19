// ✅ Imports converted to use absolute alias "@/"
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { useUser } from "@/context/UserContext";
import { getAllJobs, updateJob } from "@/lib/database/jobs";
import { getValetEtaSignals } from "@/lib/database/valetEtaSignals";
import { resolveMainStatusId } from "@/lib/status/statusFlow";
import { logJobSubStatus } from "@/lib/services/jobStatusService";
import { SearchBar } from "@/components/searchBarAPI";
import { revalidateAllJobs } from "@/lib/swr/mutations";
import { calculateSmartTechEta } from "@/utils/jobs/calculateSmartTechEta";

const WASH_KEYWORDS = ["wash", "valet", "clean"];
const VALET_TABLE_COLUMNS =
  "minmax(0, 0.8fr) minmax(0, 0.72fr) minmax(0, 1.45fr) repeat(4, minmax(84px, 0.62fr)) minmax(0, 1fr)";
const VALET_ROW_HEIGHT = "84px";

const normalizeTextArray = (values) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => {
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
    })
    .filter(Boolean)
    .map((text) => text.toLowerCase());
};

const containsKeyword = (text, keywords = WASH_KEYWORDS) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
};

const COMPLETE_STATUSES = new Set(["complete", "completed", "done", "waiting_additional_work"]);
const REQUEST_DONE_STATUSES = new Set(["complete", "completed", "done"]);

const normalizeStatusValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const isRequestComplete = (status) => REQUEST_DONE_STATUSES.has(normalizeStatusValue(status));

const isMotRequest = (request = {}) => {
  const haystack = [
    request?.description,
    request?.jobType,
    request?.serviceType,
    request?.requestSource,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
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
  const categories = Array.isArray(job.jobCategories)
    ? job.jobCategories.map((cat) => (cat || "").toLowerCase())
    : [];
  return categories.some((category) => category.includes("service"));
};

const jobHasHighValueAuthorizedWork = (job) => {
  if (!Array.isArray(job?.vhcChecks)) {
    return false;
  }

  const totalAuthorized = job.vhcChecks.reduce((total, check) => {
    const state = String(
      check?.authorizationState ?? check?.authorization_state ?? check?.approvalStatus ?? check?.approval_status ?? ""
    )
      .trim()
      .toLowerCase();
    if (state !== "authorized" && state !== "authorised" && state !== "completed") {
      return total;
    }
    return total + sumAuthorisedCheckAmount(check);
  }, 0);

  return totalAuthorized >= 1000;
};

const jobHasWashFlag = (job) => {
  const categories = Array.isArray(job.jobCategories)
    ? job.jobCategories.map((cat) => (cat || "").toLowerCase())
    : [];
  const requests = normalizeTextArray(job.requests);

  return (
    containsKeyword(job.description) ||
    containsKeyword(job.status) ||
    containsKeyword(job.waitingStatus) ||
    containsKeyword(job.cosmeticNotes) ||
    categories.some((category) => containsKeyword(category)) ||
    requests.some((request) => containsKeyword(request)) ||
    Boolean(job.maintenanceInfo?.valetChecklist)
  );
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
  const result = {
    vehicleHere: inferVehicleHere(job),
    workshop: inferWorkshop(job),
    mot: inferMot(job),
    wash: typeof stored.wash === "boolean" ? stored.wash : false,
    updatedAt: stored.updatedAt || null,
    updatedBy: stored.updatedBy || null,
  };
  return result;
};

const resolveValetRowStatusLabel = (job, checklist) => {
  if (checklist?.wash) return "Wash Complete";
  return job?.status || "N/A";
};

const logChecklistCompletionTransitions = async ({
  jobId,
  beforeChecklist,
  afterChecklist,
  actor,
}) => {
  const tasks = [];

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
      `Elapsed: ${reasoning.elapsedMinutes || 0} min`,
    ].filter(Boolean);
    return lines.join("\n");
  }, [smartEta]);

  const handleChange = (field) => (event) => {
    onToggle(job.id, field, event.target.checked);
  };

  return (
    <div
      onClick={() => {
        if (typeof onOpenJob === "function") {
          onOpenJob(job);
        }
      }}
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
        cursor: "pointer",
      }}
    >
      <span
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: "var(--accent-purple)",
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {job.jobNumber || "No Job Number"}
      </span>
      <span
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "var(--accent-purple)",
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {job.reg || "N/A"}
      </span>
      <span
        style={{
          fontSize: "14px",
          color: "var(--text-primary)",
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {job.customer || "No customer assigned"}
      </span>

      {[
        { field: "vehicleHere", label: "Vehicle Here", manual: false },
        { field: "workshop", label: "Workshop", manual: false },
        { field: "mot", label: "MOT", manual: false },
        { field: "wash", label: "Wash", manual: true },
      ].map(({ field, label, manual }) => (
        <div
          key={field}
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minWidth: 0,
            width: "100%",
          }}
        >
          <input
            type="checkbox"
            checked={Boolean(checklist[field])}
            onChange={handleChange(field)}
            onClick={(event) => event.stopPropagation()}
            disabled={isSaving || !manual}
            aria-label={`${label} for ${job.jobNumber || job.reg || "job"}`}
            title={label}
            style={{
              width: "20px",
              height: "20px",
              cursor: isSaving || !manual ? "not-allowed" : "pointer",
              opacity: manual ? 1 : 0.9,
            }}
          />
        </div>
      ))}

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
          height: "100%",
        }}
      >
        {smartEta ? (
          <span
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "2px",
              color: etaMainColor,
              whiteSpace: "normal",
            }}
            title={etaTitle}
          >
            <span>{smartEta.displayText}</span>
            {etaSecondaryLabel ? (
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                {etaSecondaryLabel}
              </span>
            ) : null}
          </span>
        ) : (
          <span style={{ color: "var(--text-secondary)" }}>Awaiting timing data</span>
        )}
      </span>
    </div>
  );
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
            jobHasHighValueAuthorizedWork(job)
          );
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
            };

            const maintenanceInfo = {
              ...(job.maintenanceInfo || {}),
              valetChecklist: mergedChecklist,
            };

            const result = await updateJob(job.id, {
              maintenance_info: maintenanceInfo,
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
              maintenanceInfo: result.data.maintenanceInfo || maintenanceInfo,
            };

            await logChecklistCompletionTransitions({
              jobId: job.id,
              beforeChecklist: {
                vehicleHere: Boolean(storedChecklist?.vehicleHere),
                workshop: Boolean(storedChecklist?.workshop),
                mot: Boolean(storedChecklist?.mot),
                wash: Boolean(storedChecklist?.wash),
              },
              afterChecklist: buildChecklist(persistedJob),
              actor,
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
    if (!searchTerm.trim()) return jobs;
    const lower = searchTerm.toLowerCase();
    return jobs.filter((job) => {
      const reg = job.reg?.toLowerCase() || "";
      const jobNumber = job.jobNumber?.toLowerCase() || "";
      const customer = (job.customer || "")
        .toString()
        .toLowerCase();
      const makeModel = job.makeModel?.toLowerCase() || "";
      return (
        reg.includes(lower) ||
        jobNumber.includes(lower) ||
        customer.includes(lower) ||
        makeModel.includes(lower)
      );
    });
  }, [jobs, searchTerm]);

  const handleToggle = useCallback(
    async (jobId, field, value) => {
      if (field !== "wash") return;
      const targetJob = jobs.find((job) => job.id === jobId);
      if (!targetJob) return;

      const previousState = valetState[jobId] || buildChecklist(targetJob);
      const nextState = { ...previousState, [field]: value };

      setValetState((prev) => ({
        ...prev,
        [jobId]: nextState,
      }));
      setSavingMap((prev) => ({ ...prev, [jobId]: true }));
      setError("");

      try {
        const maintenanceInfo = {
          ...(targetJob.maintenanceInfo || {}),
          valetChecklist: {
            ...nextState,
            updatedAt: new Date().toISOString(),
            updatedBy: user?.username || "Valet",
          },
        };

        const result = await updateJob(jobId, {
          maintenance_info: maintenanceInfo,
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
          maintenanceInfo: result.data.maintenanceInfo || maintenanceInfo,
        };
        const persistedChecklist = buildChecklist(persistedJob);
        await logChecklistCompletionTransitions({
          jobId,
          beforeChecklist: previousState,
          afterChecklist: persistedChecklist,
          actor: user?.user_id || user?.id || user?.username || "VALET_SERVICE",
        });

        setJobs((prev) =>
          prev.map((job) => (job.id === jobId ? persistedJob : job))
        );
        setValetState((prev) => ({
          ...prev,
          [jobId]: persistedChecklist,
        }));
        revalidateAllJobs(); // sync SWR cache after wash toggle
      } catch (err) {
        setValetState((prev) => ({
          ...prev,
          [jobId]: previousState,
        }));
        setError(err?.message || "Unable to update checklist");
      } finally {
        setSavingMap((prev) => ({ ...prev, [jobId]: false }));
      }
    },
    [jobs, valetState, user]
  );

  if (userLoading) {
    return (
      <Layout>
        <DevLayoutSection sectionKey="valet-loading-shell" sectionType="page-shell" shell>
          <DevLayoutSection
            sectionKey="valet-loading-panel"
            parentKey="valet-loading-shell"
            sectionType="content-card"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              padding: "40px",
              fontSize: "16px",
            }}
          >
            Loading user…
          </DevLayoutSection>
        </DevLayoutSection>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <DevLayoutSection sectionKey="valet-auth-shell" sectionType="page-shell" shell>
          <DevLayoutSection
            sectionKey="valet-auth-message"
            parentKey="valet-auth-shell"
            sectionType="content-card"
            style={{ padding: "24px" }}
          >
            <p style={{ color: "var(--primary)", fontWeight: 600 }}>
              You must be logged in to view valet jobs.
            </p>
          </DevLayoutSection>
        </DevLayoutSection>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <DevLayoutSection sectionKey="valet-no-access-shell" sectionType="page-shell" shell>
          <DevLayoutSection
            sectionKey="valet-no-access-message"
            parentKey="valet-no-access-shell"
            sectionType="content-card"
            style={{ padding: "24px" }}
          >
            <p style={{ color: "var(--primary)", fontWeight: 600 }}>
              You do not have access to the valet dashboard.
            </p>
          </DevLayoutSection>
        </DevLayoutSection>
      </Layout>
    );
  }

  return (
    <Layout>
      <DevLayoutSection
        sectionKey="valet-shell"
        sectionType="page-shell"
        shell
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "20px",
          gap: "16px",
        }}
      >
        <DevLayoutSection
          sectionKey="valet-controls-shell"
          parentKey="valet-shell"
          sectionType="section-shell"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <DevLayoutSection
            sectionKey="valet-filter-row"
            parentKey="valet-controls-shell"
            sectionType="filter-row"
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <SearchBar
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onClear={() => setSearchTerm("")}
              placeholder="Search by reg, job number, customer, or vehicle"
              style={{
                flex: 1,
                minWidth: "240px",
              }}
            />
            <span style={{ fontSize: "14px", color: "var(--grey-accent)" }}>
              Showing {filteredJobs.length} job
              {filteredJobs.length === 1 ? "" : "s"}
            </span>
          </DevLayoutSection>
          {!loading && filteredJobs.length > 0 && (
            <DevLayoutSection
              sectionKey="valet-table-header"
              parentKey="valet-controls-shell"
              sectionType="toolbar"
              style={{
                display: "grid",
                gridTemplateColumns: VALET_TABLE_COLUMNS,
                gap: "10px",
                width: "100%",
                padding: "0 16px 4px",
                alignItems: "center",
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              <span style={{ minWidth: 0 }}>Job Number</span>
              <span style={{ minWidth: 0 }}>Reg</span>
              <span style={{ minWidth: 0 }}>Customer</span>
              <span style={{ textAlign: "center", minWidth: 0 }}>Vehicle Here</span>
              <span style={{ textAlign: "center", minWidth: 0 }}>Workshop</span>
              <span style={{ textAlign: "center", minWidth: 0 }}>MOT</span>
              <span style={{ textAlign: "center", minWidth: 0 }}>Wash</span>
              <span style={{ textAlign: "right" }}>EST TECH COMPLETION</span>
            </DevLayoutSection>
          )}
          {error && (
            <DevLayoutSection
              sectionKey="valet-error-banner"
              parentKey="valet-controls-shell"
              sectionType="content-card"
              style={{
                padding: "12px 16px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: "var(--danger-surface)",
                color: "var(--danger)",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {error}
            </DevLayoutSection>
          )}
        </DevLayoutSection>

        {loading ? (
          <DevLayoutSection
            sectionKey="valet-jobs-loading"
            parentKey="valet-shell"
            sectionType="content-card"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "60px 0",
              fontSize: "16px",
              color: "var(--grey-accent)",
            }}
          >
            Loading valet jobs…
          </DevLayoutSection>
        ) : filteredJobs.length === 0 ? (
          <DevLayoutSection
            sectionKey="valet-jobs-empty"
            parentKey="valet-shell"
            sectionType="content-card"
            style={{
              padding: "60px 0",
              textAlign: "center",
              color: "var(--grey-accent-light)",
              fontSize: "16px",
            }}
          >
            No jobs requiring wash were found.
          </DevLayoutSection>
        ) : (
          <DevLayoutSection
            sectionKey="valet-jobs-list"
            parentKey="valet-shell"
            sectionType="section-shell"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              paddingBottom: "24px",
              width: "100%",
            }}
          >
            {filteredJobs.map((job) => (
              <DevLayoutSection
                key={job.id}
                sectionKey={`valet-job-row-${job.id}`}
                parentKey="valet-jobs-list"
                sectionType="content-card"
                style={{ minHeight: VALET_ROW_HEIGHT }}
              >
                <ValetJobRow
                  job={job}
                  checklist={valetState[job.id] || buildChecklist(job)}
                  onToggle={handleToggle}
                  isSaving={Boolean(savingMap[job.id])}
                  etaSignals={etaSignalsByJobId[job.id] || null}
                  now={etaNow}
                  onOpenJob={(selectedJob) => {
                    const selectedJobNumber = selectedJob?.jobNumber;
                    if (!selectedJobNumber) return;
                    void router.push(`/job-cards/valet/${encodeURIComponent(selectedJobNumber)}`);
                  }}
                />
              </DevLayoutSection>
            ))}
          </DevLayoutSection>
        )}
      </DevLayoutSection>
    </Layout>
  );
}
