// file location: src/pages/tracking/index.js
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { buildApiUrl } from "@/utils/apiClient";
import { fetchTrackingSnapshot } from "@/lib/database/tracking";
import { supabaseClient } from "@/lib/supabaseClient";

const CAR_LOCATIONS = [
  { id: "service-side", label: "Service side" },
  { id: "sales-side", label: "Sales side" },
  { id: "staff-parking", label: "Staff parking" },
];

const KEY_LOCATION_GROUPS = [
  {
    title: "Showroom Cupboard",
    options: [
      { id: "showroom-main", label: "Main" },
    ],
  },
  {
    title: "Workshop Cupboard",
    options: [
      { id: "workshop-jobs-to-start", label: "Jobs to be Started" },
      { id: "workshop-jobs-in-progress", label: "Jobs in Progress" },
      { id: "workshop-mot", label: "MOT" },
      { id: "workshop-wash", label: "Wash" },
      { id: "workshop-complete", label: "Complete" },
    ],
  },
];

const KEY_LOCATIONS = KEY_LOCATION_GROUPS.flatMap((group) =>
  group.options.map((option) => ({
    id: option.id,
    label: `${group.title} – ${option.label}`,
    group: group.title,
  }))
);

const AUTO_MOVEMENT_RULES = {
  "workshop in progress": {
    keyLocation: "Workshop Cupboard – Jobs in Progress",
    vehicleLocation: "In Workshop",
    vehicleStatus: "In Workshop",
  },
  wash: {
    keyLocation: "Workshop Cupboard – Wash",
    vehicleStatus: "Wash",
  },
  complete: {
    keyLocation: "Workshop Cupboard – Complete",
    vehicleLocation: "Ready for Release",
    vehicleStatus: "Ready for Release",
  },
};

const getAutoMovementRule = (status) => {
  if (!status) return null;
  return AUTO_MOVEMENT_RULES[status.trim().toLowerCase()] || null;
};

const STATUS_COLORS = {
  "Awaiting Authorization": "var(--danger)",
  "Waiting For Collection": "var(--info)",
  "Ready For Collection": "var(--info)",
  "Complete": "var(--info)",
  "Valet Hold": "var(--accent-orange)",
  "In Transit": "var(--accent-purple)",
};

const NEXT_ACTION_ENDPOINT = "/api/tracking/next-action";

const emptyForm = {
  id: null,
  jobNumber: "",
  reg: "",
  customer: "",
  serviceType: "",
  vehicleLocation: CAR_LOCATIONS[0].label,
  keyLocation: KEY_LOCATIONS[0].label,
  keyTip: "",
  status: "Waiting For Collection",
  notes: "",
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "now";
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(1, Math.round(diff / (1000 * 60)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const CombinedTrackerCard = ({ entry }) => {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: "16px",
        border: "1px solid rgba(var(--grey-accent-rgb), 0.3)",
        background: "white",
        boxShadow: "0 8px 16px rgba(var(--grey-accent-rgb), 0.15)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
        <div>
          <strong style={{ fontSize: "1.05rem", color: "var(--accent-purple)" }}>{entry.jobNumber || "Unknown job"}</strong>
          <p style={{ margin: "2px 0 0", color: "var(--info-dark)" }}>{entry.customer || "Customer pending"}</p>
        </div>
        <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Updated {formatRelativeTime(entry.updatedAt)}</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--info)" }}>Vehicle</p>
          <strong style={{ color: "var(--accent-purple)" }}>{entry.reg || "Unknown reg"}</strong>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--info)" }}>Car location</p>
          <strong style={{ color: "var(--success-dark)" }}>{entry.vehicleLocation || "Unallocated"}</strong>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--info)" }}>Key location</p>
          <strong style={{ color: "var(--accent-purple)" }}>{entry.keyLocation || "Pending"}</strong>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--info)" }}>Last move</p>
          <strong style={{ color: "var(--accent-purple)" }}>{formatRelativeTime(entry.updatedAt)}</strong>
        </div>
      </div>

      <p style={{ margin: 0, color: "var(--info-dark)" }}>{entry.notes || "No additional notes"}</p>
    </div>
  );
};

const LocationSearchModal = ({ type, options, onClose, onSelect }) => {
  const [query, setQuery] = useState("");
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(var(--shadow-rgb),0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: "min(600px, 100%)",
          background: "white",
          borderRadius: "24px",
          padding: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--info)", letterSpacing: "0.08em" }}>
              {type === "car" ? "Parking library" : "Key hook library"}
            </p>
            <h2 style={{ margin: "4px 0 0" }}>Search location</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "1px solid rgba(var(--shadow-rgb),0.15)",
              backgroundColor: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={type === "car" ? "Search bays or overflow" : "Search key safes, drawers"}
          style={{ padding: "10px 14px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)" }}
        />

        <div style={{ maxHeight: "320px", overflow: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((option) => (
            <div
              key={option.id}
              style={{
                padding: "14px",
                borderRadius: "16px",
                border: "1px solid var(--accent-purple-surface)",
                background: "linear-gradient(180deg, var(--surface), var(--info-surface))",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <strong style={{ color: "var(--accent-purple)" }}>{option.label}</strong>
              <button
                type="button"
                onClick={() => onSelect(option)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(var(--primary-rgb),0.3)",
                  backgroundColor: "white",
                  color: "var(--primary-dark)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Use location
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <div
              style={{
                padding: "18px",
                borderRadius: "16px",
                border: "1px dashed var(--info-surface)",
                textAlign: "center",
                color: "var(--info)",
              }}
            >
              No locations found.
            </div>
          )}
        </div>

        {/* TODO: Replace static location lists with DB-driven results */}
      </div>
    </div>
  );
};

const LocationEntryModal = ({ context, entry, onClose, onSave }) => {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...entry,
    vehicleLocation: entry?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: entry?.keyLocation || KEY_LOCATIONS[0].label,
    status: entry?.status || "Waiting For Collection",
  }));

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const actionType = context === "car" ? "job_checked_in" : "job_complete";
    onSave({ ...form, actionType, context });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(var(--shadow-rgb),0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 60,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "min(720px, 100%)",
          background: "white",
          borderRadius: "24px",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.08em", color: "var(--info)" }}>
              {context === "car" ? "Update vehicle location" : "Update key location"}
            </p>
            <h2 style={{ margin: "4px 0 0" }}>{entry ? "Edit existing" : "Log new"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "1px solid rgba(var(--shadow-rgb),0.15)",
              backgroundColor: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px",
          }}
        >
          {[
            { label: "Job Number", field: "jobNumber", placeholder: "HNP-4821" },
            { label: "Registration", field: "reg", placeholder: "GY21 HNP" },
            { label: "Customer", field: "customer", placeholder: "Customer name" },
            { label: "Service Type", field: "serviceType", placeholder: "MOT, Service..." },
          ].map((input) => (
            <label key={input.field} style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
              <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>{input.label}</span>
              <input
                required
                value={form[input.field]}
                onChange={(event) => handleChange(input.field, event.target.value)}
                placeholder={input.placeholder}
                style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)" }}
              />
            </label>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>Vehicle Location</span>
            <select
              value={form.vehicleLocation}
              onChange={(event) => handleChange("vehicleLocation", event.target.value)}
              style={{ padding: "10px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)" }}
            >
              {CAR_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.label}>
                  {loc.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>Key Location</span>
            <select
              required
              value={form.keyLocation}
              onChange={(event) => handleChange("keyLocation", event.target.value)}
              style={{ padding: "10px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)" }}
            >
              {KEY_LOCATION_GROUPS.map((group) => (
                <optgroup key={group.title} label={group.title}>
                  {group.options.map((option) => {
                    const label = `${group.title} – ${option.label}`;
                    return (
                      <option key={option.id} value={label}>
                        {option.label}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>Status</span>
            <select
              value={form.status}
              onChange={(event) => handleChange("status", event.target.value)}
              style={{ padding: "10px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)" }}
            >
              {Object.keys(STATUS_COLORS).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>Key Tag / Guidance</span>
          <input
            value={form.keyTip}
            onChange={(event) => handleChange("keyTip", event.target.value)}
            placeholder="Green tag #4, handover drawer, etc."
            style={{ padding: "10px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) => handleChange("notes", event.target.value)}
            placeholder="Collection time, valet status, instructions..."
            style={{ padding: "10px", borderRadius: "12px", border: "1px solid var(--accent-purple-surface)", resize: "vertical" }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(var(--shadow-rgb),0.15)",
              backgroundColor: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(120deg, var(--primary), var(--primary-dark))",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save update
          </button>
        </div>

        {/* TODO: Persist vehicle/key updates via API endpoint */}
      </form>
    </div>
  );
};

export default function TrackingDashboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchModal, setSearchModal] = useState({ open: false, type: null });
  const [entryModal, setEntryModal] = useState({ open: false, type: null, entry: null });
  const { dbUserId } = useUser();

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchTrackingSnapshot();
      if (!snapshot.success) {
        throw new Error(snapshot.error?.message || "Failed to load tracking data");
      }
      const normalized = Array.isArray(snapshot.data) ? snapshot.data : [];
      setEntries(normalized);
      setLastUpdated(new Date().toISOString());
    } catch (fetchError) {
      console.error("Failed to fetch tracking snapshot", fetchError);
      setEntries([]);
      setError(fetchError?.message || "Unable to load tracking data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleAutoMovement = useCallback(
    async (job, rule, newStatus) => {
      try {
        const payload = {
          actionType: "job_status_change",
          jobId: job.id || job.job_id || null,
          jobNumber: (job.job_number || job.jobNumber || "").toString().trim().toUpperCase(),
          vehicleId: job.vehicle_id || job.vehicleId || null,
          vehicleReg: (job.vehicle_reg || job.reg || "").toString().trim().toUpperCase(),
          keyLocation: rule.keyLocation,
          vehicleLocation: rule.vehicleLocation,
          vehicleStatus: rule.vehicleStatus,
          notes: `Auto-sync from status "${newStatus}"`,
          performedBy: dbUserId || null,
        };

        const response = await fetch(buildApiUrl(NEXT_ACTION_ENDPOINT), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorPayload = await response
            .json()
            .catch(() => ({ message: "Failed to auto-sync locations" }));
          console.error("Auto movement failed", errorPayload?.message || response.statusText);
          return;
        }

        await loadEntries();
      } catch (autoError) {
        console.error("Auto movement error", autoError);
      }
    },
    [dbUserId, loadEntries]
  );

  useEffect(() => {
    const channel = supabaseClient
      .channel("tracking-job-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs" },
        (payload) => {
          const newJob = payload?.new;
          const oldJob = payload?.old;
          if (!newJob?.status || newJob.status === oldJob?.status) {
            return;
          }
          const rule = getAutoMovementRule(newJob.status);
          if (!rule) return;
          handleAutoMovement(newJob, rule, newJob.status);
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [handleAutoMovement]);

  const recentEntries = useMemo(() => entries.slice(0, 3), [entries]);
  const activeEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.jobId)
        .sort(
          (a, b) =>
            new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        ),
    [entries]
  );

  const openSearchModal = (type) => setSearchModal({ open: true, type });
  const closeSearchModal = () => setSearchModal({ open: false, type: null });

  const openEntryModal = (type, entry = null) => setEntryModal({ open: true, type, entry });
  const closeEntryModal = () => setEntryModal({ open: false, type: null, entry: null });

  const handleLocationSelect = (option) => {
    closeSearchModal();
    openEntryModal(searchModal.type, {
      ...emptyForm,
      vehicleLocation: searchModal.type === "car" ? option.label : CAR_LOCATIONS[0].label,
      keyLocation: searchModal.type === "key" ? option.label : KEY_LOCATIONS[0].label,
    });
  };

  const handleSave = async (form) => {
    try {
      setError(null);
      const jobNumberQuery = form.jobNumber ? form.jobNumber.trim() : "";
      const regQuery = form.reg ? form.reg.trim() : "";
      let resolvedJob = null;

      if (!form.jobId && jobNumberQuery) {
        const { data: jobMatches, error: jobLookupError } = await supabaseClient
          .from("jobs")
          .select("id, vehicle_id")
          .ilike("job_number", jobNumberQuery)
          .limit(1);

        if (jobLookupError) {
          console.warn("Job lookup failed", jobLookupError);
        } else {
          resolvedJob = jobMatches?.[0] || null;
        }
      }

      if (!resolvedJob && !form.vehicleId && regQuery) {
        const { data: regMatches, error: regLookupError } = await supabaseClient
          .from("jobs")
          .select("id, vehicle_id")
          .ilike("vehicle_reg", regQuery)
          .limit(1);

        if (regLookupError) {
          console.warn("Vehicle lookup failed", regLookupError);
        } else {
          resolvedJob = regMatches?.[0] || null;
        }
      }

      const payload = {
        actionType: form.actionType || "job_complete",
        jobId: form.jobId || resolvedJob?.id || null,
        jobNumber: jobNumberQuery ? jobNumberQuery.toUpperCase() : "",
        vehicleId: form.vehicleId || resolvedJob?.vehicle_id || null,
        vehicleReg: regQuery ? regQuery.toUpperCase() : "",
        keyLocation: form.keyLocation,
        vehicleLocation: form.vehicleLocation,
        notes: form.notes,
        performedBy: dbUserId || null,
      };

      const response = await fetch(buildApiUrl(NEXT_ACTION_ENDPOINT), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ message: "Failed to save entry" }));
        throw new Error(errorPayload?.message || "Failed to save entry");
      }

      await loadEntries();
      closeEntryModal();
    } catch (saveError) {
      console.error("Failed to log tracking entry", saveError);
      setError(saveError.message || "Unable to save tracking entry");
    }
  };

  return (
    <Layout>
      <div
        style={{
          padding: "32px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "24px",
        }}
      >
        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderRadius: "18px",
            border: "1px solid rgba(var(--danger-rgb), 0.18)",
            background: "linear-gradient(120deg, rgba(var(--danger-rgb), 0.65), rgba(var(--danger-rgb), 0.9))",
            boxShadow: "0 18px 28px rgba(var(--danger-rgb), 0.08)",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--danger)" }}>Tracking Sync</span>
            <strong style={{ color: "var(--danger-dark)" }}>Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "Syncing..."}</strong>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {loading && (<span style={{ color: "var(--danger)", fontWeight: 600 }}>Refreshing…</span>)}
            <button
              type="button"
              onClick={loadEntries}
              style={{
                padding: "8px 16px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, var(--danger), var(--danger))",
                color: "var(--surface)",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 12px 24px rgba(var(--danger-rgb), 0.25)",
              }}
            >
              Refresh
            </button>
          </div>
        </div>
        {error && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "12px 16px",
              borderRadius: "16px",
              border: "1px solid rgba(var(--danger-rgb), 0.25)",
              background: "rgba(var(--danger-rgb), 0.8)",
              color: "var(--danger)",
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <section
          style={{
            padding: "24px",
            borderRadius: "24px",
            background: "white",
            border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
            boxShadow: "0 20px 40px rgba(var(--shadow-rgb),0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.12em", color: "var(--info-dark)" }}>Live tracker</p>
              <h1 style={{ margin: "6px 0 0", fontSize: "1.5rem", color: "var(--accent-purple)" }}>Active jobs</h1>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => openEntryModal("car")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(120deg, var(--primary), var(--primary-dark))",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Add location
              </button>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "12px",
            }}
          >
            {entries.length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
                  textAlign: "center",
                  color: "var(--info-dark)",
                }}
              >
                No active job tracking data yet.
              </div>
            )}
            {activeEntries.length === 0 && entries.length > 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
                  textAlign: "center",
                  color: "var(--info-dark)",
                }}
              >
                Waiting for job-mapped tracking entries.
              </div>
            )}
            {activeEntries.map((entry) => (
              <CombinedTrackerCard
                key={entry.jobId || entry.id || `${entry.jobNumber}-${entry.updatedAt}`}
                entry={entry}
              />
            ))}
          </div>
        </section>
      </div>

      {searchModal.open && (
        <LocationSearchModal
          type={searchModal.type}
          options={searchModal.type === "car" ? CAR_LOCATIONS : KEY_LOCATIONS}
          onClose={closeSearchModal}
          onSelect={handleLocationSelect}
        />
      )}

      {entryModal.open && (
        <LocationEntryModal
          context={entryModal.type}
          entry={entryModal.entry}
          onClose={closeEntryModal}
          onSave={handleSave}
        />
      )}
    </Layout>
  );
}
