// file location: src/components/page-ui/job-cards/scheduling/TechnicianAssignmentSection.js
// Scheduling dashboard → Technician Assignment.
// Dropdown of assignable technicians; on selection shows the tech's name,
// skill chips, today's capacity (hours done vs available) and their job count
// for today (with this job's position in the queue). Wired to real data via
// GET /api/technicians and POST /api/job-cards/[jobNumber]/technician.
import React, { useEffect, useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { DropdownField } from "@/components/ui/dropdownAPI";

const sectionTitleStyle = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 700,
  color: "var(--text-1)",
};
const labelStyle = {
  fontSize: "var(--text-label)",
  fontWeight: 600,
  color: "var(--text-1)",
  opacity: 0.65,
};

export default function TechnicianAssignmentSection({
  jobData,
  canEdit = false,
  jobNumber,
  onRefreshJob = () => {},
}) {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const assignedId = jobData?.assignedTo != null ? String(jobData.assignedTo) : "";
  const currentJobId = jobData?.id ?? jobData?.jobId ?? null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/technicians")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.success) setTechnicians(data.technicians || []);
        else setError(data?.error || "Failed to load technicians");
      })
      .catch((err) => active && setError(err?.message || "Failed to load technicians"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const selectedTech = useMemo(
    () => technicians.find((tech) => String(tech.id) === assignedId) || null,
    [technicians, assignedId]
  );

  const handleAssign = async (value) => {
    if (!canEdit || saving) return;
    setSaving(true);
    setError("");
    const tech = technicians.find((t) => String(t.id) === String(value));
    try {
      const res = await fetch(
        `/api/job-cards/${encodeURIComponent(jobNumber)}/technician`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technicianId: value ? Number(value) : null,
            technicianName: tech?.name || "",
          }),
        }
      );
      const data = await res.json();
      if (!data?.success) {
        setError(data?.error || "Failed to update assignment");
      } else {
        await onRefreshJob();
      }
    } catch (err) {
      setError(err?.message || "Failed to update assignment");
    } finally {
      setSaving(false);
    }
  };

  // Position of this job in the tech's day, e.g. "4 of 6".
  const jobPosition = useMemo(() => {
    if (!selectedTech || currentJobId == null) return null;
    const idx = (selectedTech.jobIdsToday || []).findIndex(
      (id) => Number(id) === Number(currentJobId)
    );
    return idx >= 0 ? idx + 1 : null;
  }, [selectedTech, currentJobId]);

  const hoursDone = selectedTech?.hoursDone ?? 0;
  const hoursAvailable = selectedTech?.hoursAvailable || 8;
  const capacityPct = Math.min(
    100,
    Math.round((hoursDone / (hoursAvailable || 1)) * 100)
  );
  const overCapacity = hoursDone > hoursAvailable;

  return (
    <LayerSurface
      sectionKey="jobcard-scheduling-technician"
      sectionType="content-card"
      parentKey="jobcard-tab-scheduling"
      style={{ gap: "14px" }}
    >
      <h3 style={sectionTitleStyle}>Technician Assignment</h3>

      <DropdownField
        label="Assigned technician"
        placeholder={loading ? "Loading technicians…" : "Select a technician"}
        value={assignedId}
        onChange={(event) => handleAssign(event.target.value)}
        disabled={!canEdit || loading || saving}
        className="compact-picker"
        options={[
          { value: "", label: "Unassigned" },
          ...technicians.map((tech) => ({
            value: String(tech.id),
            label: tech.jobTitle ? `${tech.name} · ${tech.jobTitle}` : tech.name,
          })),
        ]}
      />

      {error && (
        <div className="app-status-message app-status-message--danger">{error}</div>
      )}

      {selectedTech ? (
        <LayerTheme
          sectionKey="jobcard-scheduling-technician-detail"
          sectionType="content-card"
          parentKey="jobcard-scheduling-technician"
          style={{ gap: "12px" }}
        >
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-1)" }}>
              {selectedTech.name}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.7 }}>
              {selectedTech.jobTitle || selectedTech.role || "Technician"}
            </div>
          </div>

          {/* Skill chips */}
          <div>
            <div style={{ ...labelStyle, marginBottom: "6px" }}>Skill set</div>
            {selectedTech.skills && selectedTech.skills.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {selectedTech.skills.map((skill) => (
                  <span key={skill} className="app-badge app-badge--accent-soft">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.55 }}>
                No skills recorded.
              </div>
            )}
          </div>

          {/* Capacity bar */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "6px",
              }}
            >
              <span style={labelStyle}>Capacity today</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: overCapacity ? "var(--danger)" : "var(--text-1)",
                }}
              >
                {hoursDone}h of {hoursAvailable}h
              </span>
            </div>
            {/* Functional progress indicator (not a card) — tinted track + fill. */}
            <div
              style={{
                height: "10px",
                borderRadius: "var(--radius-pill)",
                background: "rgba(var(--grey-accent-rgb), 0.25)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${capacityPct}%`,
                  borderRadius: "var(--radius-pill)",
                  background: overCapacity ? "var(--danger)" : "var(--success)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>

          {/* Jobs today */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={labelStyle}>Jobs today</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-1)" }}>
              {jobPosition
                ? `${jobPosition} of ${selectedTech.jobsToday}`
                : `${selectedTech.jobsToday} scheduled`}
            </span>
          </div>
        </LayerTheme>
      ) : (
        <div style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.6 }}>
          No technician assigned to this job yet.
        </div>
      )}
    </LayerSurface>
  );
}
