// ✅ Imports converted to use absolute alias "@/"
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { useUser } from "@/context/UserContext";
import { getAllJobs, updateJob } from "@/lib/database/jobs";
import { resolveMainStatusId } from "@/lib/status/statusFlow";
import { logJobSubStatus } from "@/lib/services/jobStatusService";
import { SearchBar } from "@/components/searchBarAPI";
import { revalidateAllJobs } from "@/lib/swr/mutations";

const WASH_KEYWORDS = ["wash", "valet", "clean"];
const VALET_TABLE_COLUMNS =
  "minmax(0, 0.8fr) minmax(0, 0.72fr) minmax(0, 1.45fr) 48px 48px 48px 64px minmax(0, 0.88fr) minmax(0, 1.18fr) minmax(0, 1fr)";

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

const resolveEstimatedTechCompletion = (job) => {
  return job?.bookingRequest?.estimatedCompletion || null;
};

const formatEstimatedTechCompletion = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    dateLabel: parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    }),
    timeLabel: parsed.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
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

const ValetJobRow = ({ job, checklist, onToggle, isSaving, onOpenJob }) => {
  const estimatedCompletion = formatEstimatedTechCompletion(
    resolveEstimatedTechCompletion(job)
  );

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
        <div key={field} style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
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
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {resolveValetRowStatusLabel(job, checklist)}
      </span>

      <div style={{ textAlign: "right", minWidth: 0 }}>
        {isSaving ? (
          <span style={{ fontSize: "12px", color: "var(--accent-purple)" }}>Saving…</span>
        ) : checklist.updatedAt ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "12px",
              color: "var(--text-secondary)",
            }}
          >
            <span>Updated by {checklist.updatedBy || "Unknown"}</span>
            <span>
              {new Date(checklist.updatedAt).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            No valet updates yet
          </span>
        )}
      </div>

      <span
        style={{
          fontSize: "13px",
          color: "var(--text-primary)",
          fontWeight: 600,
          textAlign: "right",
          minWidth: 0,
        }}
      >
        {estimatedCompletion ? (
          <span
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "2px",
              color: "var(--text-primary)",
            }}
          >
            <span>{estimatedCompletion.dateLabel}</span>
            <span>{estimatedCompletion.timeLabel}</span>
          </span>
        ) : (
          <span style={{ color: "var(--text-secondary)" }}>No estimate</span>
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
  const [savingMap, setSavingMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const userRoles = useMemo(
    () => user?.roles?.map((role) => role.toLowerCase()) || [],
    [user]
  );

  const hasAccess = userRoles.some((role) =>
    ["valet service", "service manager", "admin", "workshop manager"].includes(
      role
    )
  );

  useEffect(() => {
    if (!user || !hasAccess) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchJobs = async () => {
      setLoading(true);
      setError("");
      try {
        const allJobs = await getAllJobs();
        const actor = user?.user_id || user?.id || user?.username || "VALET_SERVICE";

        // Filter jobs that match any of these criteria:
        // 1. Has wash-related flags
        // 2. Has "service" category
        // 3. Has authorized work >= £1000
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

        if (!cancelled) {
          setJobs(syncedJobs);
          revalidateAllJobs(); // sync SWR cache after auto-field updates
          const initial = {};
          syncedJobs.forEach((job) => {
            initial[job.id] = buildChecklist(job);
          });
          setValetState(initial);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load valet jobs");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchJobs();

    return () => {
      cancelled = true;
    };
  }, [user, hasAccess]);

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
                gap: "6px",
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
              <span style={{ textAlign: "center" }}>Vehicle Here</span>
              <span style={{ textAlign: "center" }}>Workshop</span>
              <span style={{ textAlign: "center" }}>MOT</span>
              <span style={{ textAlign: "center" }}>Wash</span>
              <span style={{ textAlign: "right" }}>Status</span>
              <span style={{ textAlign: "right" }}>Updated At</span>
              <span style={{ textAlign: "right" }}>Estimated Tech Completion</span>
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
              >
                <ValetJobRow
                  job={job}
                  checklist={valetState[job.id] || buildChecklist(job)}
                  onToggle={handleToggle}
                  isSaving={Boolean(savingMap[job.id])}
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
