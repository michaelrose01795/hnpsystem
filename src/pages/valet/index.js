"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout";
import { useUser } from "../../context/UserContext";
import { getAllJobs, updateJob } from "../../lib/database/jobs";

const WASH_KEYWORDS = ["wash", "valet", "clean"];

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

const inferWorkshop = (job) => {
  const status = (job.status || "").toLowerCase();
  if (!status) return false;
  const workshopStates = [
    "workshop",
    "mot",
    "additional work",
    "being washed",
    "valet",
    "in progress",
  ];
  return workshopStates.some((state) => status.includes(state));
};

const inferMot = (job) => {
  const type = (job.type || "").toLowerCase();
  const description = (job.description || "").toLowerCase();
  const categories = Array.isArray(job.jobCategories)
    ? job.jobCategories.map((cat) => (cat || "").toLowerCase())
    : [];
  const requests = normalizeTextArray(job.requests);

  return (
    type.includes("mot") ||
    description.includes("mot") ||
    categories.some((category) => category.includes("mot")) ||
    requests.some((request) => request.includes("mot"))
  );
};

const inferWash = (job) => {
  const status = (job.status || "").toLowerCase();
  if (status.includes("washed") || status.includes("valet")) return true;
  return false;
};

const buildChecklist = (job) => {
  const stored = job.maintenanceInfo?.valetChecklist || {};
  const result = {
    workshop:
      typeof stored.workshop === "boolean"
        ? stored.workshop
        : inferWorkshop(job),
    mot:
      typeof stored.mot === "boolean"
        ? stored.mot
        : inferMot(job),
    wash:
      typeof stored.wash === "boolean"
        ? stored.wash
        : inferWash(job),
    updatedAt: stored.updatedAt || null,
    updatedBy: stored.updatedBy || null,
  };
  return result;
};

const ValetJobRow = ({ job, checklist, onToggle, isSaving }) => {
  const handleChange = (field) => (event) => {
    onToggle(job.id, field, event.target.checked);
  };

  return (
    <div
      style={{
        border: "1px solid #ffe5e5",
        padding: "16px 20px",
        borderRadius: "12px",
        backgroundColor: "white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          minWidth: "240px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "18px",
              fontWeight: "700",
              color: "#1a1a1a",
            }}
          >
            {job.reg || "N/A"}
          </span>
          <span
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#d10000",
            }}
          >
            {job.jobNumber || "No Job Number"}
          </span>
        </div>
        <span style={{ fontSize: "14px", color: "#555" }}>
          {job.makeModel || "Unknown Vehicle"}
        </span>
        <span style={{ fontSize: "13px", color: "#888" }}>
          {job.customer || "No customer assigned"}
        </span>
        <span
          style={{
            fontSize: "12px",
            color: "#999",
          }}
        >
          Status: {job.status || "N/A"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "32px",
          flexShrink: 0,
        }}
      >
        {[
          { field: "workshop", label: "Workshop" },
          { field: "mot", label: "MOT" },
          { field: "wash", label: "Wash Complete" },
        ].map(({ field, label }) => (
          <label
            key={field}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "#444",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(checklist[field])}
              onChange={handleChange(field)}
              disabled={isSaving}
              style={{
                width: "20px",
                height: "20px",
                cursor: isSaving ? "not-allowed" : "pointer",
              }}
            />
            {label}
          </label>
        ))}
      </div>

      <div style={{ textAlign: "right", minWidth: "160px" }}>
        {isSaving ? (
          <span style={{ fontSize: "12px", color: "#d10000" }}>Saving…</span>
        ) : checklist.updatedAt ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "12px",
              color: "#666",
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
          <span style={{ fontSize: "12px", color: "#bbb" }}>
            No valet updates yet
          </span>
        )}
      </div>
    </div>
  );
};

export default function ValetDashboard() {
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
        const washJobs = (allJobs || []).filter(jobHasWashFlag);

        if (!cancelled) {
          setJobs(washJobs);
          const initial = {};
          washJobs.forEach((job) => {
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

        setJobs((prev) =>
          prev.map((job) => (job.id === jobId ? result.data : job))
        );
        setValetState((prev) => ({
          ...prev,
          [jobId]: buildChecklist(result.data),
        }));
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
        <div
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
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div style={{ padding: "24px" }}>
          <p style={{ color: "#d10000", fontWeight: 600 }}>
            You must be logged in to view valet jobs.
          </p>
        </div>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "24px" }}>
          <p style={{ color: "#d10000", fontWeight: 600 }}>
            You do not have access to the valet dashboard.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "20px",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by reg, job number, customer, or vehicle"
              style={{
                flex: 1,
                minWidth: "240px",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
                fontSize: "14px",
              }}
            />
            <span style={{ fontSize: "14px", color: "#666" }}>
              Showing {filteredJobs.length} job
              {filteredJobs.length === 1 ? "" : "s"}
            </span>
          </div>
          {error && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "60px 0",
              fontSize: "16px",
              color: "#666",
            }}
          >
            Loading valet jobs…
          </div>
        ) : filteredJobs.length === 0 ? (
          <div
            style={{
              padding: "60px 0",
              textAlign: "center",
              color: "#888",
              fontSize: "16px",
            }}
          >
            No jobs requiring wash were found.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              paddingBottom: "24px",
            }}
          >
            {filteredJobs.map((job) => (
              <ValetJobRow
                key={job.id}
                job={job}
                checklist={valetState[job.id] || buildChecklist(job)}
                onToggle={handleToggle}
                isSaving={Boolean(savingMap[job.id])}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
