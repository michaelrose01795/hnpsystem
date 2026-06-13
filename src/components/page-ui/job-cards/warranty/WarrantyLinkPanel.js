// file location: src/components/page-ui/job-cards/warranty/WarrantyLinkPanel.js
// Empty-state for the Warranty tab: link (or change) the warranty job card that
// this job is paired with. Logic ported from the legacy inline WarrantyTab; the
// presentation is rebuilt on the LayerTheme/LayerSurface primitives (no borders).
import React, { useCallback, useEffect, useState } from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { supabase } from "@/lib/database/supabaseClient";
import { updateJob } from "@/lib/database/jobs";

export default function WarrantyLinkPanel({
  jobData,
  canEdit = false,
  onLinkComplete = () => {},
  alert = (msg) => window.alert(msg),
}) {
  const [linkMode, setLinkMode] = useState(false);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const isLinked = Boolean(jobData?.linkedWarrantyJobId);

  const loadWarrantyJobs = useCallback(async () => {
    if (!canEdit) return;
    setLoadingJobs(true);
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id, job_number, status, job_source, vehicle_reg, vehicle_make_model, warranty_linked_job_id"
        )
        .eq("job_source", "Warranty")
        .neq("id", jobData.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const filtered = (data || []).filter(
        (record) =>
          !record.warranty_linked_job_id || record.warranty_linked_job_id === jobData.id
      );
      setAvailableJobs(filtered);
      setLinkError(filtered.length ? "" : "No warranty jobs are available to link right now.");
    } catch (err) {
      console.error("❌ Failed to load warranty jobs:", err);
      setLinkError(err?.message || "Failed to load warranty jobs.");
    } finally {
      setLoadingJobs(false);
    }
  }, [canEdit, jobData?.id]);

  useEffect(() => {
    if (linkMode) {
      loadWarrantyJobs();
    } else {
      setAvailableJobs([]);
      setSelectedJobId("");
      setLinkError("");
    }
  }, [linkMode, loadWarrantyJobs]);

  const handleLinkJob = async () => {
    if (!selectedJobId) {
      setLinkError("Select a warranty job card to link.");
      return;
    }
    const numericJobId = Number(selectedJobId);
    if (Number.isNaN(numericJobId)) {
      setLinkError("Invalid job selection.");
      return;
    }
    const targetJob = availableJobs.find((job) => job.id === numericJobId) || null;
    if (!targetJob) {
      setLinkError("Selected warranty job is no longer available.");
      return;
    }

    const targetIsWarranty = (targetJob.job_source || "").toLowerCase() === "warranty";
    const currentIsWarranty = (jobData?.jobSource || "").toLowerCase() === "warranty";
    const masterJobId =
      !currentIsWarranty && targetIsWarranty
        ? jobData.id
        : currentIsWarranty && !targetIsWarranty
        ? targetJob.id
        : jobData.id;

    setLinking(true);
    setLinkError("");

    const currentUpdate = await updateJob(jobData.id, {
      warranty_linked_job_id: numericJobId,
      warranty_vhc_master_job_id: masterJobId,
    });
    if (!currentUpdate?.success) {
      setLinkError(currentUpdate?.error?.message || "Failed to update primary job.");
      setLinking(false);
      return;
    }

    const targetUpdate = await updateJob(numericJobId, {
      warranty_linked_job_id: jobData.id,
      warranty_vhc_master_job_id: masterJobId,
      status: jobData.status,
    });
    if (!targetUpdate?.success) {
      await updateJob(jobData.id, {
        warranty_linked_job_id: null,
        warranty_vhc_master_job_id: null,
      });
      setLinkError(targetUpdate?.error?.message || "Failed to update warranty job.");
      setLinking(false);
      return;
    }

    alert("✅ Warranty job card linked successfully.");
    setLinkMode(false);
    setSelectedJobId("");
    setAvailableJobs([]);
    setLinking(false);
    onLinkComplete();
  };

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-link"
      parentKey="jobcard-tab-warranty-panel"
      gap="14px"
    >
      <div>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
          Warranty Job Card
        </h3>
        <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "var(--text-1)", opacity: 0.75 }}>
          No warranty job card is linked to this job yet. Link one to manage its claim,
          authorisations, and parts &amp; labour from here.
        </p>
      </div>

      {!canEdit && (
        <div className="app-status-message app-status-message--info">
          You do not have permission to link a warranty job on this job card.
        </div>
      )}

      {canEdit && !linkMode && (
        <div>
          <button
            type="button"
            className="app-btn app-btn--primary"
            onClick={() => setLinkMode(true)}
          >
            {isLinked ? "Change Linked Warranty Job" : "Link Warranty Job Card"}
          </button>
        </div>
      )}

      {canEdit && linkMode && (
        <LayerSurface
          sectionKey="jobcard-tab-warranty-link-form"
          parentKey="jobcard-tab-warranty-link"
          gap="12px"
        >
          <DropdownField
            label="Select Warranty Job"
            placeholder={loadingJobs ? "Loading warranty jobs..." : "Choose a warranty job number"}
            value={selectedJobId}
            onValueChange={(val) => setSelectedJobId(val)}
            disabled={loadingJobs || linking}
            options={availableJobs.map((job) => ({
              value: String(job.id),
              label: `${job.job_number} · ${job.vehicle_reg || "No Reg"} · ${
                job.vehicle_make_model || "Warranty Job"
              }`,
            }))}
          />
          {linkError && (
            <p style={{ margin: 0, fontSize: "12px", color: "var(--danger)" }}>{linkError}</p>
          )}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={handleLinkJob}
              disabled={linking || !selectedJobId}
            >
              {linking ? "Linking..." : "Link Job"}
            </button>
            <button
              type="button"
              className="app-btn app-btn--ghost"
              onClick={() => setLinkMode(false)}
              disabled={linking}
            >
              Cancel
            </button>
          </div>
        </LayerSurface>
      )}
    </LayerTheme>
  );
}
